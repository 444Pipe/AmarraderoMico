"""
Crea (o actualiza) el usuario del panel a partir de variables de entorno.

Pensado para Railway: defines ADMIN_USERNAME y ADMIN_PASSWORD en las variables del
servicio y este comando crea la cuenta en el despliegue, sin necesidad de consola.
Si las variables no están, no hace nada (no rompe el arranque).

Uso:  python manage.py crear_admin
"""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Crea o actualiza el usuario del panel desde ADMIN_USERNAME/ADMIN_PASSWORD.'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()

        if not username or not password:
            self.stdout.write('ADMIN_USERNAME/ADMIN_PASSWORD no definidas: omito crear_admin.')
            return

        User = get_user_model()
        user, creado = User.objects.get_or_create(username=username, defaults={'email': email})
        user.email = email or user.email
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        accion = 'creado' if creado else 'actualizado'
        self.stdout.write(self.style.SUCCESS(f'Usuario "{username}" {accion} correctamente.'))
