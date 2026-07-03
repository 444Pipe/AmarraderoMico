"""Agregaciones para el panel: fichas de cliente y estadísticas del negocio.

No hay modelo Cliente: un "cliente" es el conjunto de pedidos que comparten el
mismo teléfono normalizado (ver Pedido.normalizar_telefono). Todo se calcula en
Python sobre los pedidos: el volumen de un restaurante pequeño lo permite y evita
duplicar clientes por diferencias de formato del teléfono.
"""
from collections import Counter, defaultdict
from datetime import timedelta

from django.utils import timezone

from .models import Pedido


def _to_int(v):
    try:
        return max(0, int(v))
    except (TypeError, ValueError):
        return 0


def clave_cliente(pedido):
    """Clave estable para agrupar pedidos por cliente (teléfono normalizado)."""
    tel = Pedido.normalizar_telefono(pedido.telefono)
    return tel or f'anon-{pedido.pk}'


def resumen_clientes(pedidos=None):
    """Lista de dicts (uno por cliente) ordenada por total gastado desc.

    Cada ficha trae: nombre (el más reciente), teléfono, nº de pedidos, total
    gastado, ticket promedio, primero/último pedido, reparto domicilio/recoger y
    la última dirección con enlace al mapa.
    """
    if pedidos is None:
        pedidos = Pedido.objects.all()
    # Ascendente para que 'nombre' y 'última dirección' queden con el dato más reciente.
    pedidos = sorted(pedidos, key=lambda p: p.creado)

    clientes = {}
    for p in pedidos:
        key = clave_cliente(p)
        c = clientes.get(key)
        if c is None:
            c = clientes[key] = {
                'key': key,
                'nombre': p.nombre or 'Sin nombre',
                'telefono': p.telefono,
                'telefono_e164': p.telefono_e164,
                'whatsapp_url': p.whatsapp_url,
                'pedidos': 0,
                'cancelados': 0,
                'gastado': 0,
                'primero': p.creado,
                'ultimo': p.creado,
                'delivery': 0,
                'pickup': 0,
                'ultima_direccion': '',
                'maps_url': '',
            }
        if p.nombre:
            c['nombre'] = p.nombre
        c['telefono'] = p.telefono
        c['telefono_e164'] = p.telefono_e164
        c['whatsapp_url'] = p.whatsapp_url
        c['ultimo'] = p.creado
        if p.creado < c['primero']:
            c['primero'] = p.creado
        if p.estado == Pedido.ESTADO_CANCELADO:
            c['cancelados'] += 1
        else:
            c['pedidos'] += 1
            c['gastado'] += p.subtotal or 0
        if p.tipo == Pedido.TIPO_DELIVERY:
            c['delivery'] += 1
            if p.direccion:
                c['ultima_direccion'] = p.direccion
            if p.maps_url:
                c['maps_url'] = p.maps_url
        else:
            c['pickup'] += 1

    salida = list(clientes.values())
    for c in salida:
        c['ticket'] = round(c['gastado'] / c['pedidos']) if c['pedidos'] else 0
    salida.sort(key=lambda c: (c['gastado'], c['pedidos']), reverse=True)
    return salida


def ficha_cliente(key):
    """Detalle de un cliente: resumen, historial de pedidos y platos favoritos.

    Devuelve None si no existe ningún pedido con esa clave.
    """
    suyos = [p for p in Pedido.objects.all() if clave_cliente(p) == key]
    if not suyos:
        return None
    suyos.sort(key=lambda p: p.creado, reverse=True)

    resumen = resumen_clientes(suyos)[0]

    conteo = Counter()
    gasto_item = defaultdict(int)
    for p in suyos:
        if p.estado == Pedido.ESTADO_CANCELADO:
            continue
        for it in p.items or []:
            nombre = it.get('name', 'Artículo')
            qty = _to_int(it.get('qty'))
            price = _to_int(it.get('price'))
            conteo[nombre] += qty
            gasto_item[nombre] += qty * price
    max_qty = max(conteo.values(), default=0)
    favoritos = [
        {
            'nombre': n,
            'qty': q,
            'gastado': gasto_item[n],
            'pct': round(q / max_qty * 100) if max_qty else 0,
        }
        for n, q in conteo.most_common(6)
    ]
    return {'resumen': resumen, 'pedidos': suyos, 'favoritos': favoritos}


def estadisticas_generales(pedidos=None):
    """KPIs del negocio + plato más vendido + horas pico + ventas por día.

    Todo pensado para visualizarse con barras simples (sin librerías externas).
    Los cancelados no cuentan para ventas; sí se reportan aparte.
    """
    if pedidos is None:
        pedidos = list(Pedido.objects.all())
    else:
        pedidos = list(pedidos)

    validos = [p for p in pedidos if p.estado != Pedido.ESTADO_CANCELADO]
    total_vendido = sum(p.subtotal or 0 for p in validos)
    n_pedidos = len(validos)
    ticket = round(total_vendido / n_pedidos) if n_pedidos else 0
    n_clientes = len({clave_cliente(p) for p in validos})
    n_delivery = sum(1 for p in validos if p.tipo == Pedido.TIPO_DELIVERY)
    n_pickup = n_pedidos - n_delivery
    n_cancelados = len(pedidos) - n_pedidos

    # --- Platos más vendidos (por cantidad) ---
    conteo = Counter()
    ingreso_item = defaultdict(int)
    for p in validos:
        for it in p.items or []:
            nombre = it.get('name', 'Artículo')
            qty = _to_int(it.get('qty'))
            price = _to_int(it.get('price'))
            conteo[nombre] += qty
            ingreso_item[nombre] += qty * price
    max_qty = max(conteo.values(), default=0)
    top_platos = [
        {
            'nombre': n,
            'qty': q,
            'ingreso': ingreso_item[n],
            'pct': round(q / max_qty * 100) if max_qty else 0,
        }
        for n, q in conteo.most_common(8)
    ]

    # --- Horas pico (0–23, hora local Bogotá) ---
    horas = [0] * 24
    for p in validos:
        horas[timezone.localtime(p.creado).hour] += 1
    max_hora = max(horas) if horas else 0
    horas_data = [
        {
            'hora': h,
            'label': f'{h:02d}',
            'count': horas[h],
            'pct': round(horas[h] / max_hora * 100) if max_hora else 0,
        }
        for h in range(24)
    ]
    hora_pico = horas.index(max_hora) if max_hora else None

    # --- Ventas de los últimos 14 días ---
    por_dia = defaultdict(lambda: [0, 0])  # fecha -> [nº pedidos, total]
    for p in validos:
        d = timezone.localtime(p.creado).date()
        por_dia[d][0] += 1
        por_dia[d][1] += p.subtotal or 0
    hoy = timezone.localtime(timezone.now()).date()
    serie = []
    for i in range(13, -1, -1):
        d = hoy - timedelta(days=i)
        c, t = por_dia.get(d, [0, 0])
        serie.append({'fecha': d, 'count': c, 'total': t})
    max_dia = max((s['total'] for s in serie), default=0)
    for s in serie:
        s['pct'] = round(s['total'] / max_dia * 100) if max_dia else 0

    return {
        'total_vendido': total_vendido,
        'n_pedidos': n_pedidos,
        'ticket': ticket,
        'n_clientes': n_clientes,
        'n_delivery': n_delivery,
        'n_pickup': n_pickup,
        'n_cancelados': n_cancelados,
        'pct_delivery': round(n_delivery / n_pedidos * 100) if n_pedidos else 0,
        'pct_pickup': round(n_pickup / n_pedidos * 100) if n_pedidos else 0,
        'top_platos': top_platos,
        'top_plato': top_platos[0] if top_platos else None,
        'horas': horas_data,
        'hora_pico': hora_pico,
        'serie_dias': serie,
    }
