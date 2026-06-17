import re

from django.db import models


class Pedido(models.Model):
    ESTADO_NUEVO = 'nuevo'
    ESTADO_ACEPTADO = 'aceptado'
    ESTADO_DESPACHADO = 'despachado'
    ESTADO_CANCELADO = 'cancelado'
    ESTADOS = [
        (ESTADO_NUEVO, 'Nuevo'),
        (ESTADO_ACEPTADO, 'Aceptado'),
        (ESTADO_DESPACHADO, 'Despachado'),
        (ESTADO_CANCELADO, 'Cancelado'),
    ]

    TIPO_DELIVERY = 'delivery'
    TIPO_PICKUP = 'pickup'
    TIPOS = [
        (TIPO_DELIVERY, 'Domicilio'),
        (TIPO_PICKUP, 'Recoger en sede'),
    ]

    PAGO_EFECTIVO = 'efectivo'
    PAGO_PSE = 'pse'
    METODOS_PAGO = [
        (PAGO_EFECTIVO, 'Efectivo'),
        (PAGO_PSE, 'PSE (transferencia bancaria)'),
    ]

    # Datos del cliente
    nombre = models.CharField('Nombre', max_length=120)
    telefono = models.CharField('Teléfono', max_length=30)
    tipo = models.CharField('Tipo de pedido', max_length=12, choices=TIPOS, default=TIPO_DELIVERY)
    direccion = models.CharField('Dirección', max_length=255, blank=True)
    notas = models.TextField('Notas', blank=True)
    lat = models.FloatField('Latitud', null=True, blank=True)
    lng = models.FloatField('Longitud', null=True, blank=True)

    # Pago
    metodo_pago = models.CharField('Método de pago', max_length=12, choices=METODOS_PAGO, default=PAGO_EFECTIVO)
    paga_con = models.CharField('Paga con', max_length=60, blank=True)

    # Wompi (solo si metodo_pago=pse)
    ESTADO_PAGO_PENDIENTE = 'pendiente'
    ESTADO_PAGO_APROBADO = 'aprobado'
    ESTADO_PAGO_RECHAZADO = 'rechazado'
    ESTADO_PAGO_NO_APLICA = 'no_aplica'
    ESTADOS_PAGO = [
        (ESTADO_PAGO_NO_APLICA, 'No aplica (efectivo)'),
        (ESTADO_PAGO_PENDIENTE, 'Pendiente'),
        (ESTADO_PAGO_APROBADO, 'Aprobado'),
        (ESTADO_PAGO_RECHAZADO, 'Rechazado'),
    ]
    estado_pago = models.CharField('Estado del pago', max_length=12, choices=ESTADOS_PAGO, default=ESTADO_PAGO_NO_APLICA)
    wompi_reference = models.CharField('Referencia Wompi', max_length=80, blank=True)
    wompi_transaction_id = models.CharField('Transaction ID Wompi', max_length=120, blank=True)

    # Detalle del pedido. items = [{id, name, qty, price}, ...]
    items = models.JSONField('Artículos', default=list)
    subtotal = models.PositiveIntegerField('Subtotal (COP)', default=0)

    # Gestión
    estado = models.CharField('Estado', max_length=12, choices=ESTADOS, default=ESTADO_NUEVO)
    creado = models.DateTimeField('Creado', auto_now_add=True)
    actualizado = models.DateTimeField('Actualizado', auto_now=True)

    class Meta:
        verbose_name = 'pedido'
        verbose_name_plural = 'pedidos'
        ordering = ['-creado']

    def __str__(self):
        return f'#{self.pk} · {self.nombre} · {self.get_estado_display()}'

    # --- Utilidades de presentación ---
    @property
    def telefono_e164(self):
        """Número solo dígitos, con indicativo de Colombia (57) si hace falta."""
        digitos = re.sub(r'\D', '', self.telefono or '')
        if not digitos:
            return ''
        if digitos.startswith('57'):
            return digitos
        if len(digitos) == 10:  # celular colombiano sin indicativo
            return '57' + digitos
        return digitos

    @property
    def whatsapp_url(self):
        if not self.telefono_e164:
            return ''
        return f'https://wa.me/{self.telefono_e164}'

    @property
    def maps_url(self):
        if self.lat is None or self.lng is None:
            return ''
        return f'https://www.google.com/maps?q={self.lat},{self.lng}'

    @property
    def lineas(self):
        """Lista legible del pedido: '2× Bandeja Llanera — $76.000'."""
        out = []
        for it in self.items or []:
            nombre = it.get('name', 'Artículo')
            qty = it.get('qty', 1)
            precio = it.get('price', 0) or 0
            out.append({
                'texto': f"{qty}× {nombre}",
                'subtotal': precio * qty,
            })
        return out

    @property
    def es_activo(self):
        return self.estado in (self.ESTADO_NUEVO, self.ESTADO_ACEPTADO)
