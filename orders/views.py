import hashlib
import json
import logging
import re

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.paginator import Paginator
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import analytics, catalogo
from .models import Pedido

logger = logging.getLogger(__name__)

INDEX_PATH = settings.BASE_DIR / 'index.html'

IMG_PATTERN = re.compile(
    r'(src|href)="(statics/[^"]+\.(?:jpg|jpeg|png|gif|webp|svg))"',
    re.IGNORECASE,
)


def _cloudinary_url(path):
    absolute = f"{settings.SITE_URL}/{path}"
    return (
        f"https://res.cloudinary.com/{settings.CLOUDINARY_CLOUD}"
        f"/image/fetch/{settings.CLOUDINARY_TRANSFORM}/{absolute}"
    )


# Cache en memoria del HTML procesado (evita leer el archivo + regex en cada request)
_INDEX_HTML_CACHE = None


def home(request):
    """Sirve la landing. Reescribe imágenes a Cloudinary si está configurado."""
    global _INDEX_HTML_CACHE
    if _INDEX_HTML_CACHE is None or settings.DEBUG:
        html = INDEX_PATH.read_text(encoding='utf-8')
        if settings.CLOUDINARY_CLOUD and settings.SITE_URL:
            html = IMG_PATTERN.sub(
                lambda m: f'{m.group(1)}="{_cloudinary_url(m.group(2))}"',
                html,
            )
        # URLs absolutas para OG/JSON-LD; en local (sin SITE_URL) quedan relativas
        html = html.replace('__SITE_URL__', settings.SITE_URL)
        _INDEX_HTML_CACHE = html
    response = HttpResponse(_INDEX_HTML_CACHE)
    # Permite al navegador cachear el HTML por 5 min (con revalidacion)
    response['Cache-Control'] = 'public, max-age=300, must-revalidate'
    return response


def healthz(request):
    """Healthcheck de Railway: verifica que la BD responde, no solo que el proceso vive."""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        logger.exception('healthz: la base de datos no responde')
        return JsonResponse({'status': 'degraded'}, status=503)
    return JsonResponse({'status': 'ok'})


def robots_txt(request):
    """robots.txt: la landing es indexable; el panel, la API y el pago no aportan a SEO."""
    lines = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /panel/',
        'Disallow: /api/',
        'Disallow: /pago/',
    ]
    if settings.SITE_URL:
        lines += ['', f'Sitemap: {settings.SITE_URL}/sitemap.xml']
    return HttpResponse('\n'.join(lines) + '\n', content_type='text/plain')


def sitemap_xml(request):
    """Sitemap mínimo: el sitio público es una sola página."""
    base = settings.SITE_URL or f'https://{request.get_host()}'
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{base}/</loc><changefreq>monthly</changefreq></url>\n'
        '</urlset>\n'
    )
    return HttpResponse(xml, content_type='application/xml')


# ---------------- API pública: recibir pedido del formulario web ----------------

# Límites anti-abuso del endpoint público (hallazgos #6 y #9 de la auditoría).
MAX_ITEMS_PEDIDO = 60        # renglones distintos por pedido (la carta tiene 92 platos)
MAX_QTY_POR_ITEM = 50
MAX_NOTAS = 500
RATE_LIMIT_PEDIDOS = 10      # pedidos por IP...
RATE_LIMIT_VENTANA = 10 * 60  # ...cada 10 minutos


def _client_ip(request):
    """IP real del cliente detrás del proxy de Railway (X-Forwarded-For)."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _rate_limited(request):
    """True si esta IP ya agotó su cupo de pedidos en la ventana.

    Usa el cache por defecto (memoria local del proceso): con varios workers
    cada uno lleva su propia cuenta, suficiente para frenar spam de scripts a
    este volumen sin infraestructura extra. El cupo es holgado a propósito:
    los celulares en Colombia comparten IP por CGNAT."""
    ip = _client_ip(request)
    if not ip:
        return False
    key = f'rl-pedidos-{ip}'
    cache.add(key, 0, RATE_LIMIT_VENTANA)
    try:
        intentos = cache.incr(key)
    except ValueError:  # la clave expiró entre add e incr
        cache.set(key, 1, RATE_LIMIT_VENTANA)
        intentos = 1
    return intentos > RATE_LIMIT_PEDIDOS


@csrf_exempt
@require_POST
def crear_pedido(request):
    """Recibe el pedido del formulario (fetch JSON) y lo guarda. Devuelve el id creado."""
    if _rate_limited(request):
        return JsonResponse(
            {'ok': False, 'error': 'Demasiados pedidos seguidos. Espera unos minutos.'},
            status=429,
        )

    try:
        data = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'error': 'JSON inválido'}, status=400)

    nombre = (data.get('nombre') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    if not nombre or not telefono:
        return JsonResponse({'ok': False, 'error': 'Faltan nombre o teléfono'}, status=400)

    # Validación laxa del teléfono (#16): la mesera confirma por WhatsApp, así que
    # basta con que parezca un número marcable (celular CO: 10 dígitos; con +57: 12).
    telefono_digitos = re.sub(r'\D', '', telefono)
    if not 7 <= len(telefono_digitos) <= 15:
        return JsonResponse(
            {'ok': False, 'error': 'El teléfono no parece válido. Revísalo e intenta de nuevo.'},
            status=400,
        )

    items = data.get('items') or []
    if not isinstance(items, list):
        items = []
    if len(items) > MAX_ITEMS_PEDIDO:
        return JsonResponse({'ok': False, 'error': 'Demasiados artículos en el pedido'}, status=400)

    # Precios server-side (#5): del cliente solo se usan id y qty; el nombre y el
    # precio salen del catálogo del servidor (menu-data.js). El `price` del payload
    # se ignora, así que falsearlo no cambia lo que se cobra.
    try:
        carta = catalogo.catalogo()
    except Exception:
        logger.exception('No se pudo cargar el catálogo (menu-data.js)')
        return JsonResponse({'ok': False, 'error': 'Error interno con la carta'}, status=500)

    subtotal = 0
    limpios = []
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            qty = int(it.get('qty', 0))
        except (TypeError, ValueError):
            continue
        qty = min(max(0, qty), MAX_QTY_POR_ITEM)
        if qty == 0:
            continue
        plato_id = str(it.get('id', ''))
        plato = carta.get(plato_id)
        if plato is None:
            # id fuera de la carta: puede ser manipulación o una carta vieja en el
            # cache del navegador. Se rechaza el pedido (WhatsApp queda de respaldo).
            logger.warning('Pedido rechazado: artículo desconocido %r (ip %s)', plato_id, _client_ip(request))
            return JsonResponse(
                {'ok': False, 'error': 'Un artículo ya no está en la carta. Recarga la página e intenta de nuevo.'},
                status=400,
            )
        limpios.append({'id': plato_id, 'name': plato['name'], 'qty': qty, 'price': plato['price']})
        subtotal += qty * plato['price']

    if not limpios:
        return JsonResponse({'ok': False, 'error': 'El pedido no tiene artículos'}, status=400)

    tipo = data.get('tipo')
    if tipo not in (Pedido.TIPO_DELIVERY, Pedido.TIPO_PICKUP):
        tipo = Pedido.TIPO_DELIVERY

    def _coord(val):
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    metodo_pago = data.get('metodo_pago')
    if metodo_pago not in (Pedido.PAGO_EFECTIVO, Pedido.PAGO_PSE):
        metodo_pago = Pedido.PAGO_EFECTIVO

    estado_pago = (
        Pedido.ESTADO_PAGO_PENDIENTE if metodo_pago == Pedido.PAGO_PSE
        else Pedido.ESTADO_PAGO_NO_APLICA
    )

    try:
        pedido = Pedido.objects.create(
            nombre=nombre[:120],
            telefono=telefono[:30],
            tipo=tipo,
            direccion=(data.get('direccion') or '').strip()[:255],
            notas=(data.get('notas') or '').strip()[:MAX_NOTAS],
            lat=_coord(data.get('lat')),
            lng=_coord(data.get('lng')),
            items=limpios,
            subtotal=subtotal,
            metodo_pago=metodo_pago,
            paga_con=(data.get('paga_con') or '').strip()[:60],
            estado_pago=estado_pago,
        )
    except Exception:
        logger.exception('Error guardando pedido de %r', telefono[:30])
        return JsonResponse({'ok': False, 'error': 'No se pudo guardar el pedido'}, status=500)

    payload = {'ok': True, 'id': pedido.pk}

    # Si es PSE, devolvemos la URL de checkout de Wompi para redirigir al cliente
    if metodo_pago == Pedido.PAGO_PSE and settings.WOMPI_PUBLIC_KEY:
        checkout = _build_wompi_checkout_url(pedido)
        if checkout:
            payload['wompi_checkout_url'] = checkout

    return JsonResponse(payload)


# ---------------- Wompi (pasarela PSE) ----------------

def _build_wompi_checkout_url(pedido):
    """Construye la URL de checkout de Wompi con firma de integridad."""
    if not settings.WOMPI_PUBLIC_KEY or not settings.WOMPI_INTEGRITY_SECRET:
        return None

    # Referencia unica por intento de pago (incluye pk para idempotencia + sufijo)
    import time
    reference = f'pedido-{pedido.pk}-{int(time.time())}'
    pedido.wompi_reference = reference
    pedido.save(update_fields=['wompi_reference'])

    # Wompi usa amount_in_cents (subtotal en COP * 100, sin decimales)
    amount_in_cents = pedido.subtotal * 100
    currency = 'COP'

    # Firma de integridad: SHA256(reference + amount + currency + secret)
    raw = f'{reference}{amount_in_cents}{currency}{settings.WOMPI_INTEGRITY_SECRET}'
    signature = hashlib.sha256(raw.encode('utf-8')).hexdigest()

    # URL de retorno (cliente vuelve aqui despues del pago)
    redirect_url = f'{settings.SITE_URL or ""}/pago/resultado/'

    from urllib.parse import urlencode
    params = {
        'public-key': settings.WOMPI_PUBLIC_KEY,
        'currency': currency,
        'amount-in-cents': amount_in_cents,
        'reference': reference,
        'signature:integrity': signature,
        'redirect-url': redirect_url,
        'customer-data:email': '',  # opcional
        'customer-data:full-name': pedido.nombre,
        'customer-data:phone-number': pedido.telefono,
        # Sin forzar metodo: el cliente elige PSE, tarjeta o Nequi en Wompi
    }
    return f'{settings.WOMPI_CHECKOUT_URL}?{urlencode(params)}'


@csrf_exempt
@require_POST
def wompi_webhook(request):
    """Webhook de Wompi: notifica cuando una transaccion cambia de estado."""
    # Fail-closed: sin secreto de eventos no podemos verificar la firma, y este
    # endpoint es publico. Nunca procesar un evento cuya firma no se pueda validar.
    if not settings.WOMPI_EVENTS_SECRET:
        logger.error('Webhook de Wompi rechazado: WOMPI_EVENTS_SECRET no esta configurado')
        return JsonResponse({'ok': False, 'error': 'webhook no configurado'}, status=403)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False}, status=400)

    # Verificar firma del evento (HMAC-SHA256-like, en realidad concatena props ordenadas)
    signature = (body.get('signature') or {}).get('checksum', '')
    properties = (body.get('signature') or {}).get('properties', [])
    timestamp = body.get('timestamp', '')
    data = body.get('data') or {}

    concat = ''
    for prop in properties:
        # prop puede ser "transaction.id", navegamos el data dict
        value = data
        for part in prop.split('.'):
            if isinstance(value, dict):
                value = value.get(part)
            else:
                value = None
                break
        concat += str(value if value is not None else '')
    concat += str(timestamp) + settings.WOMPI_EVENTS_SECRET
    expected = hashlib.sha256(concat.encode('utf-8')).hexdigest()
    if expected != signature:
        return JsonResponse({'ok': False, 'error': 'firma invalida'}, status=403)

    # Actualizar pedido segun el evento
    tx = (data.get('transaction') or {})
    reference = tx.get('reference', '')
    status = tx.get('status', '')
    tx_id = tx.get('id', '')

    if reference:
        pedido = Pedido.objects.filter(wompi_reference=reference).first()
        if pedido:
            if status == 'APPROVED':
                # El monto aprobado debe ser exactamente el del pedido: un APPROVED
                # con otro monto (reference reutilizado, evento manipulado) no paga nada.
                try:
                    monto_evento = int(tx.get('amount_in_cents'))
                except (TypeError, ValueError):
                    monto_evento = None
                if monto_evento != pedido.subtotal * 100:
                    logger.warning(
                        'Webhook de Wompi descartado: monto %s no coincide con el '
                        'esperado %s (pedido #%s, tx %s)',
                        monto_evento, pedido.subtotal * 100, pedido.pk, tx_id,
                    )
                    return JsonResponse({'ok': False, 'error': 'monto no coincide'}, status=400)
                pedido.estado_pago = Pedido.ESTADO_PAGO_APROBADO
            elif status in ('DECLINED', 'VOIDED', 'ERROR'):
                pedido.estado_pago = Pedido.ESTADO_PAGO_RECHAZADO
            pedido.wompi_transaction_id = tx_id
            pedido.save(update_fields=['wompi_transaction_id', 'estado_pago', 'actualizado'])

    return JsonResponse({'ok': True})


def pago_resultado(request):
    """Pagina simple que muestra el resultado del pago tras el redirect de Wompi."""
    tx_id = request.GET.get('id', '')
    pedido = None
    if tx_id:
        pedido = Pedido.objects.filter(wompi_transaction_id=tx_id).first()
    return TemplateResponse(request, 'orders/pago_resultado.html', {'pedido': pedido, 'tx_id': tx_id})


def pago_estado(request):
    """Estado del pago por id de transaccion. Lo consulta el polling de pago_resultado:
    el redirect del navegador suele llegar antes que el webhook de Wompi, asi que la
    pagina nace "en proceso" y esta vista permite enterarse cuando el webhook aterrice."""
    tx_id = (request.GET.get('id') or '').strip()[:80]
    pedido = Pedido.objects.filter(wompi_transaction_id=tx_id).first() if tx_id else None
    if pedido is None:
        return JsonResponse({'estado': 'desconocido'})
    return JsonResponse({'estado': pedido.estado_pago})


# ---------------- Panel de la mesera (protegido) ----------------

ACCIONES_VALIDAS = {
    'aceptar': Pedido.ESTADO_ACEPTADO,
    'despachar': Pedido.ESTADO_DESPACHADO,
    'cancelar': Pedido.ESTADO_CANCELADO,
}


@login_required
def dashboard(request):
    activos = Pedido.objects.filter(estado__in=[Pedido.ESTADO_NUEVO, Pedido.ESTADO_ACEPTADO])
    historial = Pedido.objects.filter(
        estado__in=[Pedido.ESTADO_DESPACHADO, Pedido.ESTADO_CANCELADO]
    )[:30]
    nuevos_count = activos.filter(estado=Pedido.ESTADO_NUEVO).count()
    return TemplateResponse(request, 'orders/dashboard.html', {
        'seccion': 'pedidos',
        'activos': activos,
        'historial': historial,
        'nuevos_count': nuevos_count,
        'aceptados_count': activos.count() - nuevos_count,
        'activos_count': activos.count(),
    })


@login_required
@require_POST
def cambiar_estado(request, pk, accion):
    pedido = get_object_or_404(Pedido, pk=pk)
    nuevo = ACCIONES_VALIDAS.get(accion)
    if nuevo:
        pedido.estado = nuevo
        pedido.save(update_fields=['estado', 'actualizado'])
    return redirect('dashboard')


@login_required
def pedidos_json(request):
    """Conteo de pedidos activos para refrescar el panel sin recargar a ciegas."""
    activos = Pedido.objects.filter(estado__in=[Pedido.ESTADO_NUEVO, Pedido.ESTADO_ACEPTADO])
    return JsonResponse({
        'activos': activos.count(),
        'nuevos': activos.filter(estado=Pedido.ESTADO_NUEVO).count(),
        'ultimo': activos.values_list('pk', flat=True).first() or 0,
    })


# ---------------- Clientes (agrupados por teléfono) ----------------

@login_required
def clientes(request):
    """Lista de clientes con sus stats. Búsqueda por nombre o teléfono con ?q=."""
    q = (request.GET.get('q') or '').strip()
    lista = analytics.resumen_clientes()
    if q:
        ql = q.lower()
        qd = re.sub(r'\D', '', q)
        lista = [
            c for c in lista
            if ql in c['nombre'].lower() or (qd and qd in c['telefono_e164'])
        ]
    return TemplateResponse(request, 'orders/clientes.html', {
        'seccion': 'clientes',
        'clientes': lista,
        'total_clientes': len(lista),
        'total_gastado': sum(c['gastado'] for c in lista),
        'q': q,
    })


@login_required
def cliente_detalle(request, telefono):
    """Ficha de un cliente: resumen, historial y platos favoritos."""
    ficha = analytics.ficha_cliente(telefono)
    if ficha is None:
        return redirect('clientes')
    return TemplateResponse(request, 'orders/cliente_detalle.html', {
        'seccion': 'clientes',
        'ficha': ficha,
    })


# ---------------- Historial de pagos ----------------

@login_required
def pagos(request):
    """Historial de pagos: cuántos pedidos se pagan en efectivo y cuántos por
    transferencia. El resumen es siempre sobre todo el histórico; el filtro
    ?metodo= solo recorta el listado de abajo.

    Los cancelados quedan fuera del historial: nadie los pagó, y así los
    contadores de los filtros cuadran con las filas que se ven."""
    todos = list(Pedido.objects.all())
    pagados = [p for p in todos if p.estado != Pedido.ESTADO_CANCELADO]

    metodo = request.GET.get('metodo') or ''
    if metodo not in (Pedido.PAGO_EFECTIVO, Pedido.PAGO_PSE):
        metodo = ''
    listado = [p for p in pagados if p.metodo_pago == metodo] if metodo else pagados

    pagina = Paginator(listado, 40).get_page(request.GET.get('pagina'))
    return TemplateResponse(request, 'orders/pagos.html', {
        'seccion': 'pagos',
        'resumen': analytics.resumen_pagos(todos),
        'pagina': pagina,
        'metodo': metodo,
    })


# ---------------- Estadísticas del negocio ----------------

@login_required
def estadisticas(request):
    """Panel de estadísticas: KPIs, plato más vendido, horas pico y ventas por día."""
    return TemplateResponse(request, 'orders/estadisticas.html', {
        'seccion': 'estadisticas',
        'stats': analytics.estadisticas_generales(),
    })
