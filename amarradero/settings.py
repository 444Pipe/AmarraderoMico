"""
Configuración de Django para El Amarradero del Mico.

Sirve la landing estática + la API de pedidos + el panel de la mesera.
Pensado para correr local (SQLite) y en Railway (Postgres vía DATABASE_URL).
"""
import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


# --- Seguridad básica ---
SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'dev-inseguro-cambiar-en-produccion-con-la-variable-SECRET_KEY',
)
DEBUG = env_bool('DEBUG', default=True)

# En Railway el dominio cambia; por defecto permitimos todo y se puede restringir
# con la variable ALLOWED_HOSTS="midominio.com,www.midominio.com".
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',') if h.strip()]

# Para que el login del panel funcione bajo HTTPS en Railway.
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()
]
# Railway expone el dominio público en esta variable; lo agregamos automáticamente.
_railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
if _railway_domain:
    CSRF_TRUSTED_ORIGINS.append(f'https://{_railway_domain}')
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_railway_domain)

# Railway envía healthchecks desde este hostname; debe estar permitido siempre.
if 'healthcheck.railway.app' not in ALLOWED_HOSTS and '*' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('healthcheck.railway.app')

# Endurecimiento en producción (DEBUG=false). El panel tiene login, así que forzamos HTTPS.
# Railway sirve detrás de un proxy que añade X-Forwarded-Proto.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SECURE_REDIRECT_EXEMPT = [r'^healthz$']  # Railway healthcheck usa HTTP interno
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# --- Apps ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'amarradero.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'amarradero.wsgi.application'


# --- Base de datos ---
# Local: SQLite. Producción: define DATABASE_URL (Postgres de Railway).
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}


# --- Validación de contraseñas ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- Internacionalización ---
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True


# --- Archivos estáticos ---
# /static/ -> assets del admin de Django (se recogen con collectstatic).
# La landing (index.html, styles.css, script.js, statics/) vive en la raíz del repo
# y se sirve con rutas dedicadas en urls.py (conserva las rutas 'statics/...').
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- Login del panel ---
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'login'


# --- Ruta secreta del admin de Django ---
# El repo es público, así que la ruta real debe venir de una variable de entorno en
# Railway (ADMIN_URL). El valor por defecto ya es poco obvio como respaldo.
ADMIN_URL = os.environ.get('ADMIN_URL', 'gestion-mico-9q2x').strip().strip('/')


# --- Cloudinary (reescritura de imágenes de la landing, igual que el viejo Flask) ---
CLOUDINARY_CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
SITE_URL = os.environ.get('SITE_URL', '').strip().rstrip('/')
CLOUDINARY_TRANSFORM = os.environ.get('CLOUDINARY_TRANSFORM', 'f_auto,q_auto').strip()
]  # Railway healthcheck usa HTTP interno
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# --- Apps ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'amarradero.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'amarradero.wsgi.application'


# --- Base de datos ---
# Local: SQLite. Producción: define DATABASE_URL (Postgres de Railway).
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}


# --- Validación de contraseñas ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- Internacionalización ---
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True


# --- Archivos estáticos ---
# /static/ -> assets del admin de Django (se recogen con collectstatic).
# La landing (index.html, styles.css, script.js, statics/) vive en la raíz del repo
# y se sirve con rutas dedicadas en urls.py (conserva las rutas 'statics/...').
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- Login del panel ---
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'login'


# --- Ruta secreta del admin de Django ---
# El repo es público, así que la ruta real debe venir de una variable de entorno en
# Railway (ADMIN_URL). El valor por defecto ya es poco obvio como respaldo.
ADMIN_URL = os.environ.get('ADMIN_URL', 'gestion-mico-9q2x').strip().strip('/')


# --- Cloudinary (reescritura de imágenes de la landing, igual que el viejo Flask) ---
CLOUDINARY_CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
SITE_URL = os.environ.get('SITE_URL', '').strip().rstrip('/')
CLOUDINARY_TRANSFORM = os.environ.get('CLOUDINARY_TRANSFORM', 'f_auto,q_auto').strip()
]  # Railway healthcheck usa HTTP interno
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# --- Apps ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'amarradero.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'amarradero.wsgi.application'


# --- Base de datos ---
# Local: SQLite. Producción: define DATABASE_URL (Postgres de Railway).
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}


# --- Validación de contraseñas ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- Internacionalización ---
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True


# --- Archivos estáticos ---
# /static/ -> assets del admin de Django (se recogen con collectstatic).
# La landing (index.html, styles.css, script.js, statics/) vive en la raíz del repo
# y se sirve con rutas dedicadas en urls.py (conserva las rutas 'statics/...').
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- Login del panel ---
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'login'


# --- Ruta secreta del admin de Django ---
# El repo es público, así que la ruta real debe venir de una variable de entorno en
# Railway (ADMIN_URL). El valor por defecto ya es poco obvio como respaldo.
ADMIN_URL = os.environ.get('ADMIN_URL', 'gestion-mico-9q2x').strip().strip('/')


# --- Cloudinary (reescritura de imágenes de la landing, igual que el viejo Flask) ---
CLOUDINARY_CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
SITE_URL = os.environ.get('SITE_URL', '').strip().rstrip('/')
CLOUDINARY_TRANSFORM = os.environ.get('CLOUDINARY_TRANSFORM', 'f_auto,q_auto').strip()
]  # Railway healthcheck usa HTTP interno
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# --- Apps ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'amarradero.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'amarradero.wsgi.application'


# --- Base de datos ---
# Local: SQLite. Producción: define DATABASE_URL (Postgres de Railway).
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}


# --- Validación de contraseñas ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# --- Internacionalización ---
LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True


# --- Archivos estáticos ---
# /static/ -> assets del admin de Django (se recogen con collectstatic).
# La landing (index.html, styles.css, script.js, statics/) vive en la raíz del repo
# y se sirve con rutas dedicadas en urls.py (conserva las rutas 'statics/...').
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- Login del panel ---
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'login'


# --- Ruta secreta del admin de Django ---
# El repo es público, así que la ruta real debe venir de una variable de entorno en
# Railway (ADMIN_URL). El valor por defecto ya es poco obvio como respaldo.
ADMIN_URL = os.environ.get('ADMIN_URL', 'gestion-mico-9q2x').strip().strip('/')


# --- Cloudinary (reescritura de imágenes de la landing, igual que el viejo Flask) ---
CLOUDINARY_CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
SITE_URL = os.environ.get('SITE_URL', '').strip().rstrip('/')
CLOUDINARY_TRANSFORM = os.environ.get('CLOUDINARY_TRANSFORM', 'f_auto,q_auto').strip()
