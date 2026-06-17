import hashlib
import json
import re

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import Pedido

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


def home(request):
    """Sirve la landing. Reescribe imágenes a Cloudinary si está configurado (igual que el Flask viejo)."""
    html = INDEX_PATH.read_text(encoding='utf-8')
    if settings.CLOUDINARY_CLOUD and settings.SITE_URL:
        html = IMG_PATTERN.sub(
            lambda m: f'{m.group(1)}="{_cloudinary_url(m.group(2))}"',
            html,
        )
    return HttpResponse(html)


def healthz(request):
    return JsonResponse({'status': 'ok'})


# ---------------- API pública: recibir pedido del formulario web ----------------

@csrf_exempt
@require_POST
def crear_pedido(request):
    """Recibe el pedido del formulario (fetch JSON) y lo guarda. Devuelve el id creado."""
    try:
        data = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'error': 'JSON inválido'}, status=400)

    nombre = (data.get('nombre') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    if not nombre or not telefono:
        return JsonResponse({'ok': False, 'error': 'Faltan nombre o teléfono'}, status=400)

    items = data.get('items') or []
    if not isinstance(items, list):
        items = []

    # Recalculamos el subtotal en el servidor (no confiamos en el del cliente).
    subtotal = 0
    limpios = []
    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            qty = max(0, int(it.get('qty', 0)))
            price = max(0, int(it.get('price', 0)))
        except (TypeError, ValueError):
            continue
        limpios.append({
            'id': str(it.get('id', '')),
            'name': str(it.get('name', 'Artículo'))[:120],
            'qty': qty,
            'price': price,
        })
        subtotal += qty * price

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

    pedido = Pedido.objects.create(
        nombre=nombre[:120],
        telefono=telefono[:30],
        tipo=tipo,
        direccion=(data.get('direccion') or '').strip()[:255],
        notas=(data.get('notas') or '').strip(),
        lat=_coord(data.get('lat')),
        lng=_coord(data.get('lng')),
        items=limpios,
        subtotal=subtotal,
        metodo_pago=metodo_pago,
        paga_con=(data.get('paga_con') or '').strip()[:60],
        estado_pago=estado_pago,
    )

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
    try:
        body = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False}, status=400)

    # Verificar firma del evento (HMAC-SHA256-like, en realidad concatena props ordenadas)
    signature = (body.get('signature') or {}).get('checksum', '')
    properties = (body.get('signature') or {}).get('properties', [])
    timestamp = body.get('timestamp', '')
    data = body.get('data') or {}

    if settings.WOMPI_EVENTS_SECRET:
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
            pedido.wompi_transaction_id = tx_id
            if status == 'APPROVED':
                pedido.estado_pago = Pedido.ESTADO_PAGO_APROBADO
            elif status in ('DECLINED', 'VOIDED', 'ERROR'):
                pedido.estado_pago = Pedido.ESTADO_PAGO_RECHAZADO
            pedido.save(update_fields=['wompi_transaction_id', 'estado_pago'])

    return JsonResponse({'ok': True})


def pago_resultado(request):
    """Pagina simple que muestra el resultado del pago tras el redirect de Wompi."""
    tx_id = request.GET.get('id', '')
    pedido = None
    if tx_id:
        pedido = Pedido.objects.filter(wompi_transaction_id=tx_id).first()
    return TemplateResponse(request, 'orders/pago_resultado.html', {'pedido': pedido, 'tx_id': tx_id})


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
