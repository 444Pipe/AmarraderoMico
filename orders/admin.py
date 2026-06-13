from django.contrib import admin

from .models import Pedido


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'telefono', 'tipo', 'estado', 'subtotal', 'creado')
    list_filter = ('estado', 'tipo', 'creado')
    search_fields = ('nombre', 'telefono', 'direccion')
    readonly_fields = ('creado', 'actualizado', 'items', 'subtotal', 'lat', 'lng')
    list_per_page = 50
