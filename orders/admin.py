import re

from django.contrib import admin
from django.template.response import TemplateResponse
from django.urls import reverse

from . import analytics
from .models import Cliente, Pedido


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'telefono', 'tipo', 'estado', 'metodo_pago', 'estado_pago', 'subtotal', 'creado')
    list_display_links = ('id', 'nombre')
    list_filter = ('estado', 'tipo', 'metodo_pago', 'estado_pago', 'creado')
    search_fields = ('nombre', 'telefono', 'direccion')
    date_hierarchy = 'creado'
    readonly_fields = ('creado', 'actualizado', 'items', 'subtotal', 'lat', 'lng',
                       'wompi_reference', 'wompi_transaction_id')
    list_per_page = 50


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    """Vista agregada: un renglón por cliente (pedidos agrupados por teléfono).

    Es de solo lectura: no se crean ni editan clientes aquí. Cada fila enlaza a
    los pedidos de ese teléfono y a su ficha en el panel de la mesera.
    """
    change_list_template = 'admin/orders/cliente/change_list.html'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        q = (request.GET.get('q') or '').strip()
        clientes = analytics.resumen_clientes()
        if q:
            ql = q.lower()
            qd = re.sub(r'\D', '', q)
            clientes = [
                c for c in clientes
                if ql in c['nombre'].lower() or (qd and qd in c['telefono_e164'])
            ]

        pedido_changelist = reverse('admin:orders_pedido_changelist')
        for c in clientes:
            # Busca por el teléfono tal cual se guardó (coincide con el formato más reciente).
            c['pedidos_url'] = f"{pedido_changelist}?q={c['telefono'] or c['telefono_e164']}"

        ctx = {
            **self.admin_site.each_context(request),
            'title': 'Clientes',
            'opts': self.model._meta,
            'clientes': clientes,
            'q': q,
            'total_clientes': len(clientes),
            'total_gastado': sum(c['gastado'] for c in clientes),
        }
        ctx.update(extra_context or {})
        return TemplateResponse(request, self.change_list_template, ctx)
