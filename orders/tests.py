"""Tests de integridad del backend: webhook de Wompi (fail-closed, firma y monto),
catálogo de precios server-side, rate limiting y usuario del panel sin superusuario."""
import hashlib
import json
import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings

from .models import Pedido


def _evento(reference, amount_in_cents, tx_id='tx-123', status='APPROVED', secret=None):
    data = {
        'transaction': {
            'id': tx_id,
            'reference': reference,
            'status': status,
            'amount_in_cents': amount_in_cents,
        }
    }
    timestamp = 1234567890
    body = {
        'data': data,
        'timestamp': timestamp,
        'signature': {
            'properties': ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
            'checksum': '',
        },
    }
    if secret:
        concat = f'{tx_id}{status}{amount_in_cents}{timestamp}{secret}'
        body['signature']['checksum'] = hashlib.sha256(concat.encode()).hexdigest()
    return body


class WompiWebhookTests(TestCase):
    def _pedido(self):
        return Pedido.objects.create(
            nombre='Test', telefono='3001234567', subtotal=50000,
            metodo_pago=Pedido.PAGO_PSE, estado_pago=Pedido.ESTADO_PAGO_PENDIENTE,
            wompi_reference='pedido-1-111',
        )

    def _post(self, body):
        return self.client.post(
            '/api/wompi/webhook/', json.dumps(body), content_type='application/json'
        )

    @override_settings(WOMPI_EVENTS_SECRET='')
    def test_sin_secreto_rechaza(self):
        p = self._pedido()
        r = self._post(_evento(p.wompi_reference, 5000000))
        self.assertEqual(r.status_code, 403)
        p.refresh_from_db()
        self.assertEqual(p.estado_pago, Pedido.ESTADO_PAGO_PENDIENTE)

    @override_settings(WOMPI_EVENTS_SECRET='s3cr3t')
    def test_firma_invalida_rechaza(self):
        p = self._pedido()
        r = self._post(_evento(p.wompi_reference, 5000000))  # checksum vacío
        self.assertEqual(r.status_code, 403)
        p.refresh_from_db()
        self.assertEqual(p.estado_pago, Pedido.ESTADO_PAGO_PENDIENTE)

    @override_settings(WOMPI_EVENTS_SECRET='s3cr3t')
    def test_firma_ok_monto_ok_aprueba(self):
        p = self._pedido()
        r = self._post(_evento(p.wompi_reference, 5000000, secret='s3cr3t'))
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.estado_pago, Pedido.ESTADO_PAGO_APROBADO)
        self.assertEqual(p.wompi_transaction_id, 'tx-123')

    @override_settings(WOMPI_EVENTS_SECRET='s3cr3t')
    def test_monto_distinto_descarta(self):
        p = self._pedido()
        r = self._post(_evento(p.wompi_reference, 100, secret='s3cr3t'))
        self.assertEqual(r.status_code, 400)
        p.refresh_from_db()
        self.assertEqual(p.estado_pago, Pedido.ESTADO_PAGO_PENDIENTE)
        self.assertEqual(p.wompi_transaction_id, '')

    @override_settings(WOMPI_EVENTS_SECRET='s3cr3t')
    def test_declined_marca_rechazado(self):
        p = self._pedido()
        r = self._post(_evento(p.wompi_reference, 5000000, status='DECLINED', secret='s3cr3t'))
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.estado_pago, Pedido.ESTADO_PAGO_RECHAZADO)


class CrearPedidoTests(TestCase):
    """Precios server-side (#5), rate limiting (#6) y límites de tamaño (#9)."""

    def setUp(self):
        cache.clear()  # el rate limit cuenta en el cache local

    def _post(self, payload):
        return self.client.post(
            '/api/pedidos/', json.dumps(payload), content_type='application/json'
        )

    def _payload(self, **kw):
        base = {
            'nombre': 'Cliente', 'telefono': '3001234567', 'tipo': 'delivery',
            # price falso a propósito: el servidor debe ignorarlo
            'items': [{'id': 'arepa-casa', 'qty': 2, 'price': 1}],
        }
        base.update(kw)
        return base

    def test_precio_lo_resuelve_el_servidor(self):
        r = self._post(self._payload())
        self.assertEqual(r.status_code, 200)
        p = Pedido.objects.get(pk=r.json()['id'])
        self.assertEqual(p.subtotal, 2 * 5000)  # arepa-casa vale 5000 en menu-data.js
        self.assertEqual(p.items[0]['price'], 5000)
        self.assertEqual(p.items[0]['name'], 'Arepa de la Casa')

    def test_articulo_desconocido_rechaza(self):
        r = self._post(self._payload(items=[{'id': 'plato-inventado', 'qty': 1}]))
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_pedido_sin_articulos_rechaza(self):
        r = self._post(self._payload(items=[]))
        self.assertEqual(r.status_code, 400)

    def test_qty_se_acota(self):
        r = self._post(self._payload(items=[{'id': 'arepa-casa', 'qty': 999}]))
        p = Pedido.objects.get(pk=r.json()['id'])
        self.assertEqual(p.items[0]['qty'], 50)

    def test_notas_truncadas(self):
        r = self._post(self._payload(notas='x' * 2000))
        p = Pedido.objects.get(pk=r.json()['id'])
        self.assertEqual(len(p.notas), 500)

    def test_telefono_invalido_rechaza(self):
        for telefono in ('123', 'no soy un numero', '9' * 20):
            r = self._post(self._payload(telefono=telefono))
            self.assertEqual(r.status_code, 400, telefono)
        self.assertEqual(Pedido.objects.count(), 0)

    def test_telefono_con_formato_pasa(self):
        r = self._post(self._payload(telefono='+57 320 858 3991'))
        self.assertEqual(r.status_code, 200)

    def test_rate_limit_por_ip(self):
        for _ in range(10):
            self.assertEqual(self._post(self._payload()).status_code, 200)
        r = self._post(self._payload())
        self.assertEqual(r.status_code, 429)
        self.assertEqual(Pedido.objects.count(), 10)


class HealthzTests(TestCase):
    """/healthz debe verificar la BD (#59)."""

    def test_ok_con_bd_viva(self):
        r = self.client.get('/healthz')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'ok')

    def test_degraded_si_la_bd_falla(self):
        with mock.patch('django.db.backends.base.base.BaseDatabaseWrapper.cursor', side_effect=Exception('boom')):
            r = self.client.get('/healthz')
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()['status'], 'degraded')


class PagoEstadoTests(TestCase):
    """Endpoint de polling de pago/resultado (N7)."""

    def test_desconocido_sin_pedido(self):
        r = self.client.get('/pago/estado/?id=tx-que-no-existe')
        self.assertEqual(r.json()['estado'], 'desconocido')

    def test_devuelve_estado_del_pedido(self):
        Pedido.objects.create(
            nombre='Test', telefono='3001234567', subtotal=50000,
            metodo_pago=Pedido.PAGO_PSE, estado_pago=Pedido.ESTADO_PAGO_APROBADO,
            wompi_transaction_id='tx-999',
        )
        r = self.client.get('/pago/estado/?id=tx-999')
        self.assertEqual(r.json()['estado'], 'aprobado')


class SeoTests(TestCase):
    """robots.txt, sitemap.xml y las etiquetas OG de la landing."""

    def test_robots_bloquea_panel_api_pago(self):
        r = self.client.get('/robots.txt')
        self.assertEqual(r.status_code, 200)
        cuerpo = r.content.decode()
        for ruta in ('/panel/', '/api/', '/pago/'):
            self.assertIn(f'Disallow: {ruta}', cuerpo)

    @override_settings(SITE_URL='https://ejemplo.test')
    def test_sitemap_usa_site_url(self):
        r = self.client.get('/sitemap.xml')
        self.assertEqual(r.status_code, 200)
        self.assertIn('<loc>https://ejemplo.test/</loc>', r.content.decode())

    @override_settings(SITE_URL='https://ejemplo.test', DEBUG=True)
    def test_home_reemplaza_site_url_en_og(self):
        # DEBUG=True evita el cache en memoria del HTML entre tests
        r = self.client.get('/')
        cuerpo = r.content.decode()
        self.assertNotIn('__SITE_URL__', cuerpo)
        self.assertIn('property="og:url" content="https://ejemplo.test/"', cuerpo)


class CrearAdminTests(TestCase):
    """La cuenta del panel no debe ser superusuario (#7)."""

    def test_mesera_sin_superusuario_con_grupo(self):
        env = {'ADMIN_USERNAME': 'mesera', 'ADMIN_PASSWORD': 'clave-de-prueba-123'}
        with mock.patch.dict(os.environ, env):
            call_command('crear_admin')
        user = get_user_model().objects.get(username='mesera')
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.groups.filter(name='Mesera').exists())
        self.assertTrue(user.has_perm('orders.change_pedido'))
        self.assertFalse(user.has_perm('auth.add_user'))

    def test_degrada_superusuario_existente(self):
        User = get_user_model()
        User.objects.create_user('mesera', password='x', is_staff=True, is_superuser=True)
        env = {'ADMIN_USERNAME': 'mesera', 'ADMIN_PASSWORD': 'clave-de-prueba-123'}
        with mock.patch.dict(os.environ, env):
            call_command('crear_admin')
        user = User.objects.get(username='mesera')
        self.assertFalse(user.is_superuser)
