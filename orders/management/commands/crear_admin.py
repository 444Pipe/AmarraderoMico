"""
Crea (o actualiza) el usuario del panel a partir de variables de entorno.

Pensado para Railway: defines ADMIN_USERNAME y ADMIN_PASSWORD en las variables del
servicio y este comando crea la cuenta en el despliegue, sin necesidad de consola.
Si las variables no están, no hace nada (no rompe el arranque).

La cuenta es la de la MESERA: entra al panel (/panel/) y al admin de Django solo
con permisos de ver/editar pedidos y clientes (grupo "Mesera"), sin superusuario.
Para administrar todo (usuarios, config), crea un superusuario aparte con
`manage.py createsuperuser` (acepta DJANGO_SUPERUSER_USERNAME/PASSWORD/EMAIL).

Uso:  python manage.py crear_admin
"""
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

PERMISOS_MESERA = ['view_pedido', 'change_pedido', 'view_cliente', 'change_cliente']


class Command(BaseCommand):
    help = 'Crea o actualiza el usuario del panel (mesera, sin superusuario) desde ADMIN_USERNAME/ADMIN_PASSWORD.'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()

        if not username or not password:
            self.stdout.write('ADMIN_USERNAME/ADMIN_PASSWORD no definidas: omito crear_admin.')
            return

        grupo, _ = Group.objects.get_or_create(name='Mesera')
        grupo.permissions.set(Permission.objects.filter(
            content_type__app_label='orders',
            codename__in=PERMISOS_MESERA,
        ))

        User = get_user_model()
        user, creado = User.objects.get_or_create(username=username, defaults={'email': email})
        user.email = email or user.email
        user.is_staff = True        # puede entrar al admin de Django...
        user.is_superuser = False   # ...pero solo a lo que le da el grupo Mesera
        user.set_password(password)
        user.save()
        user.groups.add(grupo)

        accion = 'creado' if creado else 'actualizado'
        self.stdout.write(self.style.SUCCESS(
            f'Usuario "{username}" {accion} correctamente (grupo Mesera, sin superusuario).'
        ))
