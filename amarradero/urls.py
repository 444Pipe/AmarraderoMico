from django.conf import settings
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path
from django.views.static import serve as static_serve

from orders import views as order_views

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

urlpatterns = [
    # Landing
    path('', order_views.home, name='home'),
    path('healthz', order_views.healthz, name='healthz'),

    # Assets de la landing (conservan las rutas relativas del index.html)
    path('styles.css', static_serve, {'document_root': BASE_DIR, 'path': 'styles.css'}),
    path('script.js', static_serve, {'document_root': BASE_DIR, 'path': 'script.js'}),
    path('statics/<path:path>', static_serve, {'document_root': BASE_DIR / 'statics'}),

    # API de pedidos (la usa el formulario de la web)
    path('api/pedidos/', order_views.crear_pedido, name='crear_pedido'),

    # Wompi (pasarela PSE)
    path('api/wompi/webhook/', order_views.wompi_webhook, name='wompi_webhook'),
    path('pago/resultado/', order_views.pago_resultado, name='pago_resultado'),

    # Panel de la mesera (requiere login)
    path('panel/', order_views.dashboard, name='dashboard'),
    path('panel/pedido/<int:pk>/<str:accion>/', order_views.cambiar_estado, name='cambiar_estado'),
    path('panel/datos/', order_views.pedidos_json, name='pedidos_json'),

    # Login / logout del panel
    path('panel/login/', auth_views.LoginView.as_view(template_name='orders/login.html'), name='login'),
    path('panel/logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),

    # Admin de Django en una ruta secreta (configurable con ADMIN_URL en producción)
    path(f'{settings.ADMIN_URL}/', admin.site.urls),
]
