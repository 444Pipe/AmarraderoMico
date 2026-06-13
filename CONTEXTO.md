# Contexto del proyecto — El Amarradero del Mico

Sitio web de un restaurante folclórico llanero en Villavicencio (Meta, Colombia).
Landing de una sola vista con un sistema de pedidos a domicilio + un panel para la mesera.

## Arquitectura

- **Backend: Django** (proyecto `amarradero/`, app `orders/`). Sirve la landing, la API de
  pedidos y el panel protegido con login. Reemplazó al viejo `app.py` (Flask).
- **Frontend de la landing**: `index.html` + `styles.css` + `script.js` (vanilla JS, una sola página).
- **Base de datos**: SQLite en local; en Railway se usa Postgres vía `DATABASE_URL`.
  En producción hay un servicio **Postgres** conectado al servicio web con la variable de
  referencia `DATABASE_URL = ${{Postgres.DATABASE_URL}}` (red interna de Railway). Las tablas
  se crean solas en el deploy (`migrate`); confirmado funcionando (tablas creadas en Postgres).
- **Despliegue**: Railway (`railway.json` / `Procfile`) con gunicorn + whitenoise. Python 3.11.
  `DEBUG=false` en producción.
- **Imágenes/Video**: carpeta `statics/`. La landing reescribe imágenes a Cloudinary
  (Cloudinary **activo** en producción: `CLOUDINARY_CLOUD_NAME` + `SITE_URL` definidas).

## Flujo de un pedido

1. El cliente arma el carrito en la web y elige **domicilio** o **recoger en sede**.
2. **Ubicación** (solo domicilio): mapa Leaflet + OpenStreetMap + Nominatim. El cliente fija un
   pin → `pickedLocation = {lat, lng}`. "Usar mi ubicación" acerca el mapa y dibuja un círculo
   con la precisión del GPS.
3. Al enviar (`script.js`):
   - `savePedido()` hace `POST /api/pedidos/` → **guarda el pedido en la BD** (aparece en el panel).
   - Y además abre `wa.me/<numero>` con el resumen (respaldo, como siempre).
4. La mesera ve el pedido en el **panel** y lo gestiona.

## Panel de la mesera

- URL: `/panel/` (requiere login). Login en `/panel/login/`.
- Muestra cada pedido con nombre, detalle completo, datos de entrega, ubicación y notas.
- Tres acciones por pedido:
  1. **Aceptar** → el pedido pasa a "Aceptado" y aparece el botón **Despachado**.
  2. **Cancelar**.
  3. **WhatsApp** → abre la conversación con el teléfono del cliente (`wa.me`).
- Se refresca solo cuando entra un pedido nuevo (chequeo cada 12 s contra `/panel/datos/`).
- Acceso discreto desde la web: enlace "Personal" al final del footer.
- Gestión avanzada / exportar: admin de Django en una **ruta secreta** (`ADMIN_URL`,
  por defecto `/gestion-mico-9q2x/`). La ruta `/admin/` ya no existe (404).

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `amarradero/settings.py` | Configuración (BD, estáticos, login, Cloudinary). |
| `amarradero/urls.py` | Rutas: landing, assets, API, panel, login, admin. |
| `orders/models.py` | Modelo `Pedido` (estados, items, helpers WhatsApp/maps). |
| `orders/views.py` | Landing, API `crear_pedido`, dashboard, cambiar estado. |
| `orders/templates/orders/dashboard.html` | Panel de la mesera. |
| `index.html` | Landing + formulario de checkout. |
| `script.js` | Carrito, mapa y envío del pedido (sección "SISTEMA DE DOMICILIOS"). |

## Cómo correr en local

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser     # crea el usuario admin
python manage.py runserver
```

### Crear el usuario de la mesera

La mesera necesita una cuenta para entrar al panel. Crea un superusuario (acceso total) o,
desde el admin (ruta secreta `/gestion-mico-9q2x/`) → Usuarios, crea un usuario con permiso de
"staff". Con `createsuperuser` basta para empezar.

## Variables de entorno (Railway)

| Variable | Para qué |
|---|---|
| `SECRET_KEY` | Clave de Django (obligatoria en producción). |
| `DEBUG` | `false` en producción. |
| `DATABASE_URL` | Postgres de Railway (si no, usa SQLite efímero). |
| `ALLOWED_HOSTS` | Dominios permitidos (ej. `amarradero.up.railway.app`). |
| `ADMIN_URL` | Ruta secreta del admin (ej. `mi-clave-secreta`). Recomendado en producción. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Crean la cuenta del panel en el despliegue. |
| `CLOUDINARY_CLOUD_NAME`, `SITE_URL` | Reescritura de imágenes a Cloudinary (opcional). |

> ✅ Ya configurado en producción: servicio **Postgres** conectado con
> `DATABASE_URL = ${{Postgres.DATABASE_URL}}`, `DEBUG=false` y Cloudinary activo.
> ⚠️ No quites `DATABASE_URL`: con SQLite la base se borra en cada despliegue (se perderían los pedidos).

## WhatsApp de la sede

`script.js` → `DELIVERY_CONFIG.whatsapp = '573208583991'` (número al que llega el pedido).
