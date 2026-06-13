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
    )
    return JsonResponse({'ok': True, 'id': pedido.pk})


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
