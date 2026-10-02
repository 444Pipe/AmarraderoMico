"""Datos que el navbar del panel necesita en todas sus páginas."""
from .models import Pedido


def panel_nav(request):
    """Insignia de pedidos nuevos, visible desde cualquier sección del panel.

    Solo se consulta para usuarios autenticados: la landing y el login no pagan
    la consulta extra."""
    user = getattr(request, 'user', None)
    if not (user and user.is_authenticated):
        return {}
    return {
        'nav_nuevos': Pedido.objects.filter(estado=Pedido.ESTADO_NUEVO).count(),
    }
