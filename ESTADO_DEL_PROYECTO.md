# Estado del proyecto — El Amarradero del Mico

> Documento de consolidación de auditoría (6 dimensiones: Backend/Seguridad, Front JS, CSS/Responsive, Infra/DevOps, Producto/UX, y HTML/SEO). Los hallazgos marcados como "críticos" por los auditores fueron degradados tras verificación por mitigantes reales del proyecto (sin pasarela de pago, humano en el bucle vía WhatsApp, producción ya con `DEBUG=false` y `SECRET_KEY` configurada). La dimensión **HTML/SEO/redes sociales** se auditó directamente (ver **Anexo A**). Fecha: 2026-07-02.

> **✅ Actualización 2026-07-02 — corregidos los 4 riesgos altos.** Se aplicaron los fixes de
> **#1** (config *secure-by-default*: `DEBUG=False` por defecto + *fail-fast* de `SECRET_KEY`, y de paso **#8** `ALLOWED_HOSTS` sin `'*'`),
> **#2** (anti-fuerza-bruta en el login con `django-axes`: 5 intentos → bloqueo 1 h por usuario+IP),
> **#3** (dependencias: `Django 5.2.15` LTS y `gunicorn 23.0.0`, ambos con los CVE parcheados; se añadió `django-axes[ipware] 8.3.1`) y
> **#4** (ciclo del pedido en `script.js`: se verifica `r.ok`, se bloquea el doble envío, hay pantalla de éxito con nº de pedido, se limpia el carrito y hay fallback si el navegador bloquea el popup de WhatsApp).
> Verificado con `manage.py check --deploy` (0 issues) y `migrate` (tablas de axes creadas). Pendientes: los medios/bajos y de producto de las secciones siguientes.

## 1. Resumen ejecutivo

El proyecto está **en un estado funcional y sano para su tamaño**: una landing con storytelling fuerte (historia familiar, prensa real) y un sistema de pedidos completo (carrito, domicilio/recoger, mapa Leaflet, guardado en BD + WhatsApp, panel de la mesera con estados y sonido). El backend es pequeño y con decisiones correctas (CSRF activo en el panel, `login_required`, whitelisting de tipo/estado/acciones, endurecimiento HTTPS/HSTS cuando `DEBUG=False`), y el despliegue en Railway es razonable (gunicorn + whitenoise, secretos externalizados, healthcheck).

**Tras la verificación, ningún hallazgo crítico sobrevive**: los tres "críticos" reportados (config fail-open, `SECRET_KEY` embebida, "pedido fantasma") se degradaron a alta/media porque su explotación es contingente (producción ya está configurada) o su impacto está acotado (no hay cobro en línea y la mesera confirma manualmente). Aun así hay **4 riesgos altos** que conviene atacar ya: (1) configuración *insegura por omisión* (`SECRET_KEY` con fallback y `DEBUG=True` por defecto en repo público); (2) login del panel sin anti-fuerza-bruta, agravado porque la mesera es superusuario; (3) dependencias en fin de vida / con CVE (Django 5.0 EOL, gunicorn 21.2.0 con request smuggling); (4) "pedido fantasma": el cliente nunca ve confirmación y el doble canal BD+WhatsApp no está conciliado. Transversalmente, la mayor deuda es la **ausencia total de tests, CI/CD, observabilidad y backups**.

## 2. Lo que ya funciona bien

- **Panel bien protegido**: todas las vistas de gestión llevan `@login_required` y `cambiar_estado` usa `@require_POST` **sin** `@csrf_exempt`, quedando cubierto por `CsrfViewMiddleware` (`orders/views.py:117-152`).
- **Uso consistente de listas blancas**: tipo de pedido contra `{delivery, pickup}`, acciones del panel contra `ACCIONES_VALIDAS`, estados como `choices` cerrados; nada acepta valores arbitrarios (`orders/views.py:84-114`).
- **Parseo defensivo de entrada**: `qty`/`price` con `max(0, int(...))` en `try/except`, coordenadas con `float()` protegido (`orders/views.py:71-92`).
- **Endurecimiento de transporte correcto** cuando `DEBUG=False`: `SECURE_SSL_REDIRECT`, HSTS a 1 año con `include_subdomains`+`preload`, cookies `Secure`, `SECURE_PROXY_SSL_HEADER` para Railway, y exención de `/healthz` del redirect (`amarradero/settings.py:47-57`).
- **Admin endurecido**: `readonly_fields` sobre campos sensibles (`items`, `subtotal`, `lat`, `lng`, `creado`, `actualizado`) en `orders/admin.py`, ruta configurable por `ADMIN_URL` y `/admin/` retirado.
- **Secretos externalizados** a variables de entorno y `crear_admin` idempotente (`get_or_create`, no rompe el arranque si faltan variables).
- **Frontend cuidado**: delegación de eventos (sin listeners duplicados), geolocalización robusta con `watchPosition` que se queda con la mejor precisión, `initMapPicker` de inicialización única, `keepalive:true` en el `fetch` para que el POST sobreviva a la navegación a WhatsApp, y **cero inyección de input de usuario en `innerHTML`** (solo va a WhatsApp con `encodeURIComponent`), evitando XSS de DOM.
- **CSS artesanal y coherente**: sistema de variables en `:root`, tipografía fluida con `clamp()`, rediseño móvil trabajado del sistema de pedidos (bottom-sheet, barra sticky, FAB con badge), base sólida contra scroll horizontal (`overflow-x: clip`, `box-sizing`, `max-width` en media).
- **Producto**: storytelling y prueba social que generan confianza antes de pedir; panel de la mesera práctico (estados con color, filtros, historial, campana WebAudio sin archivo, polling que solo recarga ante cambios).
- **Infra**: `.gitignore` correcto (verificado que `db.sqlite3` nunca se commiteó), `dj-database-url` con `conn_max_age=600` y fallback a SQLite en local, healthcheck y restart policy en `railway.json`, dependencias directas fijadas a versión exacta y `runtime.txt` a Python 3.11.9.

## 3. Hallazgos priorizados

> Ningún hallazgo crítico (🔴) sobrevivió a la verificación; los tres reportados como críticos fueron degradados. La lista arranca en severidad alta.

| # | Sev. | Categoría | Título | Archivo | Esfuerzo |
|---|------|-----------|--------|---------|----------|
| 1 | 🟠 | seguridad | Configuración *fail-open*: `SECRET_KEY` con fallback y `DEBUG=True` por defecto | `amarradero/settings.py` | bajo |
| 2 | 🟠 | seguridad | Login del panel sin anti-fuerza-bruta (agravado por superusuario) | `amarradero/urls.py` | medio |
| 3 | 🟠 | seguridad | Dependencias con CVE / Django en fin de vida | `requirements.txt` | medio |
| 4 | 🟠 | producto | "Pedido fantasma": doble canal sin conciliar y sin confirmación al cliente | `script.js` | medio |
| 5 | 🟡 | datos | Falseo de precios: el backend confía en el `price` del cliente (sin catálogo server-side) | `orders/views.py`, `script.js` | medio |
| 6 | 🟡 | seguridad | Endpoint público sin rate limiting ni anti-spam | `orders/views.py` | medio |
| 7 | 🟡 | seguridad | La mesera se crea como superusuario (viola mínimo privilegio) | `orders/management/commands/crear_admin.py` | bajo |
| 8 | 🟡 | seguridad | `ALLOWED_HOSTS` por defecto `'*'` | `amarradero/settings.py` | bajo |
| 9 | 🟡 | bug | Sin límites de tamaño en items/id/notas + overflow de `subtotal` | `orders/views.py` | medio |
| 10 | 🟡 | seguridad | Admin en ruta "secreta" con default publicado en repo y CONTEXTO.md | `amarradero/settings.py` | bajo |
| 11 | 🟡 | rendimiento | `home()` lee `index.html` + regex por request, sin cache ni manejo de error | `orders/views.py` | medio |
| 12 | 🟡 | bug | Doble/triple envío del pedido: sin bloqueo del botón | `script.js` | bajo |
| 13 | 🟡 | bug | El POST a `/api/pedidos/` falla en silencio (no se lee `r.ok`) | `script.js` | medio |
| 14 | 🟡 | ux | Sin confirmación ni limpieza del carrito tras enviar | `script.js` | bajo |
| 15 | 🟡 | ux | El carrito y los datos del cliente no persisten (sin localStorage) | `script.js` | bajo |
| 16 | 🟡 | datos | Validación de teléfono inexistente (front + back) | `index.html`, `script.js`, `orders/views.py` | bajo |
| 17 | 🟡 | infra | Dependencia de CDN (Leaflet/unpkg) sin fallback ni aviso | `index.html`, `script.js` | medio |
| 18 | 🟡 | accesibilidad | Modal sin gestión de foco / mapa no operable por teclado | `script.js`, `index.html` | medio |
| 19 | 🟡 | infra | Nominatim sin control de rate-limit ni verificación de respuesta | `script.js` | medio |
| 20 | 🟡 | accesibilidad | Áreas táctiles por debajo de 44px en botones de cantidad | `styles.css` | medio |
| 21 | 🟡 | ux | Pesos de fuente 700/800 usados pero no cargados (faux-bold) | `styles.css`, `index.html` | bajo |
| 22 | 🟡 | mantenibilidad | Enfoque desktop-first pese a público mayoritariamente móvil | `styles.css` | alto |
| 23 | 🟡 | accesibilidad | Sin `prefers-reduced-motion` con varias animaciones infinitas | `styles.css`, `script.js` | bajo |
| 24 | 🟡 | rendimiento | Dependencias externas pesadas y bloqueantes en `<head>` (Font Awesome completo) | `index.html` | medio |
| 25 | 🟡 | datos | Sin plan de backups documentado para Postgres | `CONTEXTO.md` | medio |
| 26 | 🟡 | infra | `migrate`+`collectstatic`+`crear_admin` acoplados al arranque en cada boot | `railway.json` | medio |
| 27 | 🟡 | rendimiento | Assets de la landing servidos con `django.views.static.serve` | `amarradero/urls.py` | medio |
| 28 | 🟡 | mantenibilidad | Sin CI/CD, lockfile, linters, Dependabot ni pre-commit | (raíz del repo) | medio |
| 29 | 🟡 | infra | Sin `LOGGING`/observabilidad ni access logs de gunicorn | `amarradero/settings.py` | medio |
| 30 | 🟡 | ux | El costo de domicilio y el total final nunca se muestran al cliente | `script.js` | medio |
| 31 | 🟡 | producto | Sin horario de atención: se aceptan pedidos con el local cerrado | `index.html` | bajo |
| 32 | 🟡 | mantenibilidad | Menú hardcodeado: la dueña no puede cambiar precios ni marcar agotados | `script.js` | alto |
| 33 | 🟡 | datos | Sin totales del día ni reportes de venta en el panel | `orders/views.py` | medio |
| 34 | 🟡 | producto | Sin pago en línea (Nequi/Daviplata/pasarela) | `index.html` | alto |
| 35 | 🟡 | ux | Notificación de pedido nuevo frágil: el chime puede no sonar, sin push | `orders/templates/orders/dashboard.html` | medio |
| 36 | 🟡 | datos | El modelo `Pedido` no guarda domicilio, total ni método/estado de pago | `orders/models.py` | medio |
| 37 | 🟡 | producto | Zona de cobertura no validada: se aceptan domicilios fuera de rango | `script.js` | medio |
| 38 | 🟡 | producto | El cliente no recibe seguimiento del estado del pedido | `orders/views.py` | medio |
| 39 | 🟡 | producto | Domicilios a una sola sede aunque hay tres | `script.js` | medio |
| 40 | 🟡 | datos | Historial limitado a 30 pedidos, sin filtro por fecha ni búsqueda | `orders/views.py` | medio |
| 41 | 🟡 | producto | Sin edición de pedido en el panel | `orders/templates/orders/dashboard.html` | medio |
| 42 | 🟡 | producto | Sin mínimo de pedido a domicilio | `script.js` | bajo |
| 43 | ⚪ | mantenibilidad | Sin tests ni `try/except`/`transaction` en `crear_pedido` | `orders/views.py` | medio |
| 44 | ⚪ | producto | Sin impresión de comanda ni vista de cocina | `orders/templates/orders/dashboard.html` | bajo |
| 45 | ⚪ | accesibilidad | `:focus-visible` propio ausente (se apoya en el default del navegador) | `styles.css` | bajo |
| 46 | ⚪ | mantenibilidad | WhatsApp de la sede hardcodeado en el JS | `script.js` | bajo |
| 47 | ⚪ | ux | `window.open` a WhatsApp sin fallback si se bloquea el popup | `script.js` | bajo |
| 48 | ⚪ | mantenibilidad | Handlers globales sin guardas de nulos y acoplamiento DOM frágil | `script.js` | bajo |
| 49 | ⚪ | producto | El pin de ubicación es opcional en domicilio pese al copy | `script.js`, `index.html` | bajo |
| 50 | ⚪ | producto | Prueba social sin reseñas reales de clientes | `index.html` | medio |
| 51 | ⚪ | ux | Domicilio sin tiempo estimado de entrega | `index.html` | bajo |
| 52 | ⚪ | ux | Fotos genéricas y repetidas en el menú del pedido | `script.js` | bajo |
| 53 | ⚪ | mantenibilidad | Regla `.checkout-summary` duplicada y anulada en el mismo breakpoint | `styles.css` | bajo |
| 54 | ⚪ | rendimiento | `will-change` permanente en muchos elementos | `styles.css` | bajo |
| 55 | ⚪ | ux | `backdrop-filter` sin prefijo `-webkit-` (iOS < 16) | `styles.css` | bajo |
| 56 | ⚪ | mantenibilidad | Gradiente marrón y z-index mágicos repetidos (falta de tokens) | `styles.css` | bajo |
| 57 | ⚪ | accesibilidad | Contraste insuficiente de texto rust sobre fondos crema | `styles.css` | bajo |
| 58 | ⚪ | ux | Alturas `100vh/88vh/92vh` sin unidades dinámicas (`dvh`) | `styles.css` | bajo |
| 59 | ⚪ | infra | `/healthz` no verifica la conexión a la base de datos | `orders/views.py` | bajo |
| 60 | ⚪ | infra | `db.sqlite3` presente en el working dir (no versionado) | `.gitignore` | bajo |

## 4. Detalle por prioridad

### 🟠 Altos

**#1 — Configuración *fail-open*: `SECRET_KEY` con fallback y `DEBUG=True` por defecto** (`amarradero/settings.py:20-24, 47-57`)
Consolida tres hallazgos (backend + infra). `SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-inseguro-...')` deja un fallback embebido en un **repo público** (`github.com/444Pipe/AmarraderoMico`, HTTP 200), y `DEBUG = env_bool('DEBUG', default=True)`. Todo el bloque de endurecimiento (`SECURE_SSL_REDIRECT`, cookies `Secure`, HSTS) vive bajo `if not DEBUG`, y `ALLOWED_HOSTS` default es `'*'`.
- *Impacto*: si en cualquier entorno faltara `SECRET_KEY`, la app arranca con una clave conocida → se pueden forjar cookies de sesión y tokens (suplantar a la mesera/superusuario). Si falta `DEBUG`, se filtran trazas y se desactiva en silencio todo el HTTPS/HSTS. **No es explotable hoy** porque producción ya corre con `DEBUG=false` y `SECRET_KEY` definida (CONTEXTO.md), pero es un *footgun* latente para forks o redeploys. Con `DEBUG=True` Django enmascara `SECRET_KEY`/`PASSWORD` en el dump, pero igual filtra trazas y configuración.
- *Recomendación*: invertir el default de `DEBUG` a `False`. Hacer fail-fast: si `not DEBUG` y `SECRET_KEY` está vacía o es el default, lanzar `ImproperlyConfigured` para impedir el arranque. No versionar ninguna `SECRET_KEY` (ni de respaldo); rotar la actual en Railway por precaución. Exigir `ALLOWED_HOSTS` explícito (o derivarlo solo de `RAILWAY_PUBLIC_DOMAIN`) sin default `'*'`.

**#2 — Login del panel sin anti-fuerza-bruta, agravado por superusuario** (`amarradero/urls.py:32`)
Se usa `auth_views.LoginView` estándar sin lockout, CAPTCHA, 2FA ni logging de intentos fallidos (no hay `django-axes` ni `ratelimit` en `requirements.txt`; middleware estándar). La ruta `/panel/login/` es pública y fija. Se combina con **#7**: la única cuenta del panel es superusuario, así que adivinar esa contraseña entrega control total del admin. Detalle que refuerza el riesgo: `crear_admin` usa `set_password()`+`save()`, que **no** ejecuta `AUTH_PASSWORD_VALIDATORS`, por lo que la fortaleza depende solo del valor de `ADMIN_PASSWORD`.
- *Impacto*: toma de control por fuerza bruta / credential stuffing sin fricción ni alertas. Atenúan (no eliminan) el riesgo el hashing PBKDF2 y la latencia de red.
- *Recomendación*: instalar y configurar `django-axes` (bloqueo por usuario/IP con backoff), registrar intentos fallidos, y garantizar una contraseña fuerte de forma explícita. Resolver **#7** en paralelo.

**#3 — Dependencias con CVE / Django en fin de vida** (`requirements.txt`)
Verificado y confirmado. `Django==5.0.6`: la serie 5.0 está **en fin de vida** (soporte terminó ~abril 2025 con la salida de 5.2 LTS); faltan los parches de 5.0.7–5.0.14, que incluyen **SQL injection** (CVE-2024-42005 en `QuerySet.values()/values_list()`, CVE-2024-53908), DoS y enumeración de usuarios. `gunicorn==21.2.0` es vulnerable a **CVE-2024-1135** (HTTP request smuggling vía `Transfer-Encoding`, corregido en 22.0.0) y **CVE-2024-6827** (corregido en 23.0.0); gunicorn es el servidor real de producción, expuesto tras el proxy de Railway. `psycopg2-binary 2.9.9` y Python 3.11.9 siguen vigentes.
- *Impacto*: exposición a inyección SQL y request smuggling en un servicio de cara a Internet con API de pedidos y panel con login.
- *Recomendación*: subir a **Django 5.2.x LTS** (revisar release notes), **gunicorn ≥ 23.0.0**. Considerar `psycopg2` compilado (no `-binary`) en producción. Añadir `pip-audit` y Dependabot/Renovate para no volver a quedarse atrás.

**#4 — "Pedido fantasma": doble canal sin conciliar y sin confirmación al cliente** (`script.js`, submit + `savePedido`)
`savePedido()` hace un `fetch('/api/pedidos/', {keepalive:true}).catch(...)` *fire-and-forget*: no lee la respuesta ni usa el `{id}` que sí devuelve el backend (`orders/views.py:105`). El pedido se crea con estado `ESTADO_NUEVO` y aparece de inmediato en el panel, **independientemente de que el mensaje de WhatsApp llegue a enviarse**. Luego `window.open(wa.me..., '_blank')` sin pantalla de éxito, sin número ni tiempo estimado; tampoco se limpia el carrito ni se cierra el modal (habilita re-clicks → duplicados; ver **#12/#14**).
- *Impacto*: pedidos "fantasma"/abandonados que la mesera no distingue de los reales; si el popup se bloquea o el escritorio no tiene WhatsApp, el cliente cree que falló pese a estar en BD. Atenúa: no hay pérdida de datos (el pedido persiste) y la audiencia mobile-first abre WhatsApp casi siempre. Sigue siendo el mayor riesgo operativo diario.
- *Recomendación*: mostrar una **pantalla/estado de éxito** con el `{id}` ya disponible (número de pedido + tiempo estimado). Definir una **única fuente de verdad**: o se confirma en la web (WhatsApp opcional), o se marca en el panel cuál llegó también por WhatsApp; considerar estado "pendiente de confirmación" hasta recibir el mensaje.

### 🟡 Medios

**Seguridad / robustez del backend**
- **#5 Falseo de precios** (`orders/views.py:73`, `script.js`): el servidor "recalcula" el subtotal pero con el `price` que manda el cliente (`price = max(0, int(it.get('price',0)))`); el comentario "no confiamos en el del cliente" solo aplica al `subtotal`. No hay catálogo autoritativo en el backend (solo en `script.js`). Un POST con `price=0` persiste un subtotal falso. Impacto acotado (no hay cobro automático, la mesera detecta un total absurdo), pero es una brecha de **integridad**. *Rec*: catálogo `id→precio` en backend; el front envía solo `id`+`qty`; validar que cada `id` exista.
- **#6 Endpoint sin rate limiting** (`orders/views.py:47-49`): `crear_pedido` es `@csrf_exempt`, sin auth y sin captcha/honeypot/Origin/dedup. Vector de spam/DoS operativo y polución de BD (amplificado porque `notas` e `items` no se acotan, ver **#9**). *Rec*: rate limit por IP (`django-ratelimit`/cache), honeypot o captcha, validar `Origin`/`Referer`, deduplicar por teléfono+ventana.
- **#7 Mesera como superusuario** (`crear_admin.py:31-32`): fija `is_staff=True`+`is_superuser=True` en cada deploy; el panel `/panel/` solo necesita `@login_required`. *Rec*: `is_superuser=False`, permisos `view/change` sobre `Pedido` vía un `Group`, o directamente sin acceso al admin.
- **#8 `ALLOWED_HOSTS='*'` por defecto** (`settings.py:28`): habilita Host header injection/cache poisoning si falta la variable. *Rec*: no usar `'*'`; derivar de `RAILWAY_PUBLIC_DOMAIN` y fallar si queda vacío con `DEBUG=False`.
- **#9 Sin límites de tamaño + overflow** (`orders/views.py:61-103`): `items` sin tope, `id` sin truncar, `notas` (TextField) sin límite; `subtotal` es `PositiveIntegerField` y `qty*price` grandes pueden superar el máximo de Postgres → `IntegerOutOfRange` en un `INSERT` sin `try/except` (500). *Rec*: limitar nº de items (~50), truncar `id`/`notas`, acotar `qty`/`price`, `BigIntegerField`/clamp, y envolver el `create`.
- **#10 Admin ruta "secreta" con default publicado** (`settings.py:152`, CONTEXTO.md:42,79): `ADMIN_URL` default `gestion-mico-9q2x` está en el repo público y en CONTEXTO.md; la ocultación no es control. *Rec*: exigir `ADMIN_URL` por entorno (sin default utilizable) y no documentar el valor real; priorizar controles reales (**#2**).
- **#11 `home()` sin cache ni manejo de error** (`orders/views.py:30-38`): `read_text()` + `IMG_PATTERN.sub` en cada request de la ruta más visitada, sin `try/except` (500 si falta el archivo). *Rec*: cachear el HTML reescrito (invalidar por `mtime`), envolver la lectura, o servir la landing como estático vía whitenoise con la reescritura Cloudinary en build.

**Front (script.js) — ruta crítica de pedido y UX**
- **#12 Doble/triple envío** (submit handler): no hay flag `isSubmitting` ni se deshabilita el botón; cada clic dispara otro POST y otro `window.open`. El backend no tiene idempotencia (`Pedido.objects.create` incondicional). *Rec*: flag + deshabilitar botón ("Enviando…") hasta resolver el `fetch`; idealmente clave de idempotencia en backend.
- **#13 POST falla en silencio** (`savePedido`): `fetch` no rechaza ante 4xx/5xx y solo hay `.catch(console.warn)`; nunca se comprueba `r.ok` ni se lee `{ok,id}`. El caso realista es 500/caída de BD (el 400 "faltan nombre/teléfono" casi no ocurre porque los campos son `required`). *Rec*: `savePedido` `async`, `await` + verificar `r.ok`; ante fallo avisar y ofrecer reintento; ante éxito mostrar "Pedido recibido #id".
- **#14 Sin confirmación ni limpieza del carrito** tras enviar: el checkout queda igual, invitando a reenviar (alimenta **#12**). *Rec*: al confirmar, vaciar `cart`, refrescar FAB/barra y pasar a vista de éxito con nº de pedido y "Hacer otro pedido".
- **#15 Carrito y datos del cliente no persisten** (`const cart = new Map()`, sin localStorage): recargar o volver de WhatsApp vacía el carrito y obliga a reescribir dirección y re-fijar el pin. *Rec*: serializar `ids+qty` y últimos datos de entrega a localStorage; rehidratar validando que los `id` sigan existiendo.
- **#16 Validación de teléfono inexistente** (`index.html:117`, `orders/views.py`): `type=tel required` sin `pattern`/`inputmode`; el backend solo trunca a 30. Un teléfono inválido rompe el botón WhatsApp de la mesera. (También falta validar rango de `lat/lng`.) *Rec*: `inputmode="numeric"` + `pattern` de 10 dígitos (Colombia), normalizar antes de enviar, validar también en backend y acotar coordenadas a `[-90,90]/[-180,180]`.
- **#17 CDN Leaflet/unpkg sin fallback** (`index.html:16-17`, `script.js`): si unpkg está caído/bloqueado, `initMapPicker` retorna en silencio (`typeof L === 'undefined'`) → caja gris sin explicación y posible domicilio sin pin. *Rec*: auto-hospedar Leaflet (JS/CSS + imágenes del marcador) con whitenoise; si aun así falta, mensaje de fallback en `#mapCoords`.
- **#18 Accesibilidad del modal/mapa**: al abrir se pone `aria-hidden=false` pero no se mueve ni atrapa el foco, y el pin solo se coloca con ratón/touch (sin alternativa por teclado). *Rec*: focus trap + restaurar foco al cerrar; la confirmación por texto de la dirección como camino equivalente al pin; `aria-label` en los `+/-`.
- **#19 Nominatim sin control** (`reverseLookup`/`forwardLookup`): llamadas directas sin verificar `r.ok`, sin tratar 429 ni respetar la política (~1 req/s, User-Agent identificable). *Rec*: proxyear la geocodificación por el backend con caché/throttle y User-Agent propio; manejar 429.

**CSS / rendimiento / accesibilidad**
- **#20 Áreas táctiles <44px** en `.menu-qty button` (28px) y `.cart-qty-btn` (26→24→22px en móvil): por debajo del mínimo recomendado justo en el dispositivo principal. *Rec*: elevar el hit-area a ≥40-44px con padding o pseudo-elemento invisible.
- **#21 Faux-bold**: Google Fonts importa Inter solo en `300;400;500;600` pero el CSS usa 700/800 en badges, subtotales, precios (29 usos). *Rec*: añadir `700` (y `800`) al import o bajar esos usos a `600`.
- **#22 Desktop-first**: todos los `@media` son `max-width`, con breakpoints repetidos (768/480 tres veces cada uno). No urgente (funciona), pero encarece mantenimiento y arriesga reglas contradictorias. *Rec*: migrar a mobile-first o al menos consolidar un bloque por ancho.
- **#23 Sin `prefers-reduced-motion`** (consolida CSS + parallax JS): animaciones infinitas (`fabPulse`, `loaderPulse`, `scrollPulse`) y parallax del hero sin media query de reducción. *Rec*: añadir `@media (prefers-reduced-motion: reduce)` que anule animaciones/transiciones y desactive el parallax en JS.
- **#24 `<head>` pesado**: Font Awesome completo desde cdnjs para ~15 iconos, 3 familias de Google Fonts y Leaflet CSS, todas render-blocking; Leaflet solo se usa en el modal. *Rec*: subset/kit de Font Awesome o SVG inline, diferir Leaflet CSS al abrir el modal, self-host de fuentes con `font-display: swap`.

**Infra / DevOps**
- **#25 Sin backups de Postgres** (CONTEXTO.md:83-85): no hay `pg_dump` programado, retención ni procedimiento de restauración (verificado: sin `.github/workflows`, sin cron). Mitiga que cada pedido tiene respaldo de facto en WhatsApp y la cuenta de la mesera se recrea en cada deploy. *Rec*: activar/verificar snapshots de Railway **y** un `pg_dump` periódico a almacenamiento externo con retención; documentar y probar el restore en CONTEXTO.md.
- **#26 Arranque acoplado** (`railway.json:7`, `Procfile:1`): `migrate && collectstatic && crear_admin && gunicorn` corre en cada boot → riesgo de carrera en `migrate` si se escala, `collectstatic` que alarga el arranque (margen de `healthcheckTimeout`), y `crear_admin` que **resetea la contraseña** en cada deploy. *Rec*: `collectstatic` a la fase de build; `migrate` como paso de release único; `crear_admin` condicional a que el usuario no exista.
- **#27 Assets con `django.views.static.serve`** (`amarradero/urls.py:19-21`): `styles.css`, `script.js` y `statics/` se sirven con la vista de desarrollo (sin cache de largo plazo ni compresión, ocupando un worker de gunicorn; solo hay 2). *Rec*: servirlos vía whitenoise (bajo `STATIC_ROOT` o `WHITENOISE_ROOT`) para `Cache-Control` inmutable y compresión.
- **#28 Sin CI/CD, lockfile, linters, Dependabot**: no hay `.github/`, ni tests, ni `ruff`/`black`, ni pre-commit; `requirements.txt` no fija transitivas (builds no reproducibles). *Rec*: lockfile (`pip-tools`/`uv`/`poetry`), workflow mínimo (`ruff`/`black --check` + `manage.py check --deploy`), Dependabot + `pip-audit`.
- **#29 Sin logging/observabilidad** (`amarradero/settings.py`): sin bloque `LOGGING`, sin Sentry, y gunicorn sin `--access-logfile`. Un 500 en `/api/pedidos/` pasa desapercibido. *Rec*: `LOGGING` a stdout, integrar Sentry (plan gratuito), añadir `--access-logfile - --error-logfile -`.

**Producto / operación**
- **#30 Costo de domicilio y total final ocultos** (`renderCart`/`renderCheckoutSummary`): el total mostrado es solo el subtotal; el domicilio aparece "Según ubicación" y hay un `$5.000` muerto en `#cartDelivery`. Para "recoger" sí se muestra el precio real. *Rec*: como mínimo mostrar un **rango** ("Domicilio: $5.000–$9.000 según zona"); a futuro, tarifa por distancia/zona (requiere añadir coordenadas de sede a `DELIVERY_CONFIG`).
- **#31 Sin horario de atención** (`index.html`): las sedes dicen 6am–6pm pero no hay validación; un pedido a las 2am queda "nuevo" sin atender. *Rec*: indicador "Abierto/Cerrado ahora" según hora local y aviso/bloqueo fuera de horario, configurable por la dueña.
- **#32 Menú hardcodeado** (`DELIVERY_CONFIG.categories`, "Menu de muestra"): cambiar precio, agregar plato o marcar agotado exige editar `script.js` y redeployar. Hoy el catálogo es diminuto (~7 ítems) y hay fallback humano por WhatsApp, pero es inviable a mediano plazo. *Rec*: modelo `Producto` (nombre, precio, categoría, imagen, `disponible`, orden) gestionable desde el panel/admin; el front consume una API; toggle "agotado".
- **#33 Sin totales del día ni reportes** (`dashboard`): el panel muestra solo conteos, ningún agregado en dinero (verificado: cero `Sum/aggregate`). El importe sí aparece por pedido, y todos los datos ya se persisten. *Rec*: bloque de cierre del día (total vendido, nº pedidos, ticket promedio, domicilio vs recoger, top de platos) y reportes por rango de fechas.
- **#34 Sin pago en línea** (`index.html:161` "No se procesa pago en línea"): decisión de negocio común, pero sin filtro de clientes serios ni solución al cambio en efectivo. *Rec*: empezar simple (número de Nequi/Daviplata + campo `comprobante`); a mediano plazo pasarela colombiana (Wompi/Bold/Mercado Pago/PayU) con "pagar ahora" o "al recibir".
- **#35 Notificación frágil** (`dashboard.html:453-487`): `chime()` crea un `AudioContext` nuevo y nunca hace `resume()`, así que el **primer** aviso puede no sonar (política de autoplay); polling con `location.reload()` exige pestaña visible; sin Notification API ni push. El pedido no se pierde (siempre en BD) pero el aviso se retrasa. *Rec*: desbloquear/mantener vivo el `AudioContext` en el primer gesto, usar Notification API con permiso, service worker a futuro, y reemplazar `reload` por actualización parcial del DOM.
- **#36 Modelo `Pedido` sin domicilio/total/pago** (`orders/models.py:25-41`): solo `subtotal`. Por diseño `total==subtotal` (sin impuestos ni cargo en línea) y el domicilio es offline, así que no hay pérdida de datos, pero falta base para reconciliar caja. *Rec*: añadir `costo_domicilio`, `total`, `metodo_pago`, `estado_pago` cuando se aborde reporting/pago.
- **#37 Zona de cobertura no validada**: el mapa permite fijar cualquier punto (otra ciudad) y el pedido se envía igual. *Rec*: validar distancia del pin a la sede (ya se tienen coordenadas) y avisar en el momento, sugiriendo recoger; radio configurable.
- **#38 Cliente sin seguimiento de estado** (`cambiar_estado`): al marcar "Aceptado"/"Despachado" el cliente no recibe aviso. *Rec*: al despachar, disparar WhatsApp/enlace de estado; opcional página consultable por nº de pedido.
- **#39 Domicilios a una sola sede** (`DELIVERY_CONFIG.whatsapp/branchName` fijos en "Sede Vanguardia"): hay tres sedes con WhatsApp propio pero no se elige ni se enruta por cercanía. *Rec*: elegir sede o enrutar por la más cercana a las coordenadas.
- **#40 Historial limitado a 30** (`dashboard`): sin filtro por fecha ni búsqueda por cliente/teléfono. *Rec*: filtro por rango de fechas + búsqueda + paginación.
- **#41 Sin edición de pedido en el panel**: solo aceptar/despachar/cancelar; ajustar ítems obliga a cancelar y recrear (ensucia historial/conteos). *Rec*: permitir editar ítems/cantidades/notas desde el panel o el admin.
- **#42 Sin mínimo de pedido a domicilio**: nada impide un domicilio de $7.000. *Rec*: mínimo (p. ej. $25.000) con aviso de cuánto falta en el carrito.

### ⚪ Bajos

Correcciones menores de pulido, mantenibilidad y accesibilidad (baja urgencia, casi todas de bajo esfuerzo):

- **#43** Sin tests ni `try/except`/`transaction.atomic` en `crear_pedido` (`orders/views.py`) — añadir tests básicos (creación de pedido, whitelist, acceso protegido) y envolver el `create` con logging. *(Ver también §6.)*
- **#44** Sin comanda imprimible ni vista de cocina (`dashboard.html`) — botón "Imprimir comanda" con vista limpia (ítems, cantidades, notas, nº).
- **#45** `:focus-visible` propio ausente (`styles.css`) — los controles son nativos y el navegador sí pinta el foco por teclado (no incumple WCAG), pero conviene un `:focus-visible` global de marca por robustez/contraste.
- **#46** WhatsApp de la sede hardcodeado (`script.js:76`) — inyectarlo desde backend/`data-*` para gestionarlo por variable de entorno.
- **#47** `window.open` sin fallback si el popup se bloquea (`script.js`) — capturar el retorno; si es `null`, `location.href = url` o enlace visible.
- **#48** Handlers globales sin guardas de nulos y acoplamiento DOM frágil (`script.js`) — guardas de nulo, referenciar por `id`, eliminar `dom.cartDeliveryRow` muerto.
- **#49** Pin opcional en domicilio pese al copy "pinea tu ubicación exacta" — decidir: exigir pin (bloquear submit) o suavizar el copy.
- **#50** Prueba social sin reseñas reales (`index.html`, 5 estrellas decorativas) — incluir Google Reviews/testimonios verificables cerca del CTA.
- **#51** Domicilio sin tiempo estimado (`index.html`) — mostrar rango ("45–60 min según zona").
- **#52** Fotos genéricas/repetidas en bebidas (`script.js`) — fotos reales o placeholder de marca consistente.
- **#53** `.checkout-summary` duplicada y anulada en `@media (max-width:768px)` (`styles.css:1079/1101`) — eliminar la regla muerta; revisar también las dos `.cart-items`.
- **#54** `will-change` permanente en `.reveal`/`.hero-content` (`styles.css`) — quitarlo tras la animación.
- **#55** `backdrop-filter` sin `-webkit-` (5 usos, `styles.css`) — duplicar con prefijo para WebKit antiguo.
- **#56** Gradiente marrón y z-index mágicos repetidos (`styles.css`) — extraer `--gradient-brand` y escala nombrada de z-index/espaciado.
- **#57** Contraste rust (#B8541F) sobre crema (#F5E6D3) ≈4:1 en `.fee-coord` (`styles.css`) — oscurecer el rust para texto pequeño o aumentar tamaño/peso.
- **#58** Alturas `vh` sin `dvh` en hero y bottom-sheet (`styles.css`) — `height: 92vh; height: 92dvh;`.
- **#59** `/healthz` no verifica la BD (`orders/views.py`) — `SELECT 1` ligero y devolver 503 si falla (manteniendo la exención de HTTPS y timeout corto).
- **#60** `db.sqlite3` en el working dir, no versionado (`.gitignore`) — mantener el ignore; opcionalmente ubicar la BD local fuera del repo.

## 5. Mejoras de producto / roadmap sugerido

### Corto plazo (1-2 semanas) — mayormente bajo esfuerzo, alto retorno
- **Cerrar el ciclo de pedido**: bloquear doble envío (flag + botón deshabilitado) y pantalla de éxito con nº de pedido usando el `{id}` que ya devuelve el backend (**#12, #13, #14, #4**).
- **Persistir carrito + datos del cliente** en localStorage (**#15**).
- **Transparencia**: indicador "Abierto/Cerrado ahora" y horario (**#31**), y mostrar al menos un **rango** de costo de domicilio (**#30**).
- **Validar teléfono** (10 dígitos Colombia) en front y back (**#16**), y mínimo de pedido a domicilio (**#42**).
- **Endurecer config** (fail-fast `SECRET_KEY`, `DEBUG=False` por defecto, `ALLOWED_HOSTS` sin `'*'`) (**#1, #8**), `django-axes` + mesera sin superusuario (**#2, #7**), subir gunicorn/Django (**#3**).
- **Documentar y activar backups** de Postgres (`pg_dump` + snapshots) (**#25**).

### Mediano plazo
- **Menú gestionable**: modelo `Producto` con precios/agotados desde el panel; el front consume una API (**#32**). Elimina redeploys por cambios triviales.
- **Reportes de venta** del día en el panel (total, nº pedidos, ticket promedio, top de platos) y campos `costo_domicilio/total/metodo_pago` (**#33, #36**); historial con filtros/búsqueda/paginación (**#40**).
- **Operación de cocina**: comanda imprimible (**#44**), edición de pedido sin cancelar (**#41**), seguimiento de estado al cliente por WhatsApp (**#38**).
- **Logística**: cálculo de domicilio por distancia + zona de cobertura (**#30, #37**).
- **Notificaciones robustas** en el panel (desbloquear audio, Notification API) (**#35**); rate limiting del endpoint (**#6**); acotar tamaños/overflow (**#9**).
- **Rendimiento/infra**: mover estáticos a whitenoise (**#27**), self-host de Leaflet/Font Awesome subset (**#17, #24**), `LOGGING` + Sentry (**#29**), CI/CD + lockfile + linters (**#28**), desacoplar el arranque (**#26**).
- **Accesibilidad**: focus trap del modal, touch targets ≥44px, `prefers-reduced-motion`, `:focus-visible` de marca (**#18, #20, #23, #45**).

### Largo plazo
- **Pagos**: Nequi/Daviplata con comprobante y, después, pasarela (Wompi/Bold/PayU) con "pagar ahora / al recibir" (**#34**).
- **Multi-sede** con enrutamiento por cercanía a la sede correcta (**#39**).
- **Push real** con service worker para el panel (**#35**).
- **Migración CSS mobile-first** consolidando breakpoints (**#22**).
- **Prueba social real** (reseñas verificables enfocadas en domicilio) (**#50**).

## 6. Deuda técnica y calidad

- **Tests**: no existen (`orders/` sin tests). Falta cobertura mínima: creación de pedido, whitelist de tipo/estado, acceso protegido al panel, `cambiar_estado` (**#43**).
- **CI/CD**: no hay `.github/workflows`. Los cambios llegan a Railway sin ninguna barrera. Añadir un workflow mínimo (`ruff`/`black --check`, `pytest`, `manage.py check --deploy`) por push/PR (**#28**).
- **Linters/formato**: sin `ruff`/`black`/`flake8` ni pre-commit.
- **Dependencias**: `requirements.txt` solo fija directas (transitivas sin fijar → builds no reproducibles); framework EOL y CVEs sin parchear. Introducir lockfile (`pip-tools`/`uv`/`poetry`), Dependabot/Renovate y `pip-audit` (**#3, #28**).
- **Observabilidad**: sin `LOGGING`, sin Sentry, sin access logs de gunicorn; errores 500 silenciosos. `crear_pedido` sin `try/except` ni logging. `/healthz` no toca la BD (puede reportar "healthy" con Postgres caído) (**#29, #43, #59**).
- **Backups/DR**: sin `pg_dump` programado ni procedimiento de restauración documentado/probado (**#25**).
- **Reproducibilidad de arranque**: `migrate`/`collectstatic`/`crear_admin` acoplados al proceso web en cada boot; `crear_admin` resetea la contraseña en cada deploy (**#26**).

## 7. Notas finales — qué atacar primero y por qué

El proyecto **no tiene emergencias**: ningún hallazgo crítico sobrevivió a la verificación, y lo que hay es corregible de forma incremental. La secuencia recomendada, priorizando **retorno / esfuerzo**:

1. **Config *secure-by-default*** (**#1, #8**): esfuerzo bajo y elimina el mayor *footgun* de un repo público (fail-fast de `SECRET_KEY`, `DEBUG=False` por defecto). Es prevención pura contra un despiste de operador.
2. **Actualizar dependencias** (**#3**): es un servicio expuesto a Internet con CVEs de inyección SQL (Django EOL) y request smuggling (gunicorn); subir gunicorn ≥23 y Django a 5.2 LTS es mecánico y de alto valor.
3. **Cerrar el vector de toma de control del panel** (**#2 + #7**): `django-axes` y quitar el superusuario de la mesera se hacen juntos y de forma barata; hoy una sola contraseña adivinable equivale al control total.
4. **Cerrar el ciclo de confirmación del pedido** (**#4, #12, #13, #14**): es el mayor riesgo **operativo diario** (duplicados, fantasmas, cliente sin confirmación). Deshabilitar el botón + pantalla de éxito con el `id` que ya existe es esfuerzo bajo.

Estos cuatro bloques son mayoritariamente de esfuerzo bajo/medio y cubren seguridad, robustez y la experiencia real del negocio. A partir de ahí, el mayor salto de producto es **darle a la dueña control del menú y visibilidad de ventas** (**#32, #33**), y montar la base de calidad ausente (**tests + CI + observabilidad + backups**) para poder iterar sin regresiones.

---

## Anexo A — HTML / SEO / compartir en redes (auditoría directa)

> El auditor automático de esta dimensión no completó su salida en el workflow, así que los siguientes hallazgos se verificaron manualmente sobre `index.html`. Para un restaurante que capta clientes por Google y por WhatsApp/redes, esta es la dimensión de **mayor retorno comercial** y hoy está a medias.

**Lo que ya está bien**: `<title>` y `meta description` presentes y descriptivos (`index.html:6-7`), `<html lang="es">`, favicon y `apple-touch-icon` (`index.html:8-11`), `theme-color`, viewport correcto, las **18 imágenes tienen `alt`**, y el **video hero se sirve desde Cloudinary** con `autoplay muted loop playsinline` (buena práctica), no desde el repo.

| # | Sev. | Categoría | Título | Archivo | Esfuerzo |
|---|------|-----------|--------|---------|----------|
| A1 | 🟠 | seo | Sin Open Graph ni Twitter Card: al compartir el enlace en WhatsApp/Facebook/Instagram no sale imagen ni descripción | `index.html` (`<head>`) | bajo |
| A2 | 🟡 | seo | Sin datos estructurados JSON-LD `Restaurant`/`LocalBusiness` (horarios, dirección, teléfono, geo, menú) | `index.html` | bajo |
| A3 | 🟡 | seo | Sin `<link rel="canonical">` ni `robots.txt` ni `sitemap.xml` | `index.html`, raíz del repo | bajo |
| A4 | 🟡 | rendimiento | 17 de 18 imágenes sin `loading="lazy"` (solo 1 lo usa) | `index.html` | bajo |
| A5 | 🟡 | infra | `statics/videopagina.mp4` (**28 MB**) versionado en el repo pero **sin referenciar** en ningún archivo → peso muerto | `statics/`, `.gitignore` | bajo |

**Detalle y recomendación:**

- **A1 — Open Graph / Twitter Card (lo más importante de este anexo).** No hay ninguna etiqueta `og:*` ni `twitter:*` en el `<head>` (verificado). Cuando alguien pega el enlace del restaurante en WhatsApp, Facebook o Instagram, el mensaje sale **sin foto, sin título y sin descripción** — justo el canal por el que este negocio se difunde. *Rec*: añadir `og:title`, `og:description`, `og:image` (una foto apetitosa 1200×630, p. ej. `hero.jpg` o una de `statics/img/`), `og:type=website`, `og:url`, `og:locale=es_CO`, y el equivalente `twitter:card=summary_large_image`. Es esfuerzo bajo y alto impacto de marketing.
- **A2 — JSON-LD `Restaurant`.** Sin datos estructurados, Google no puede mostrar el *rich result* con estrellas, horario, dirección y teléfono. *Rec*: incrustar un `<script type="application/ld+json">` con schema `Restaurant` (nombre, `address` de las sedes, `telephone`, `geo`, `openingHours`, `servesCuisine: "Llanera"`, `priceRange`, `image`, `url`). Ayuda al SEO local en Villavicencio.
- **A3 — Canonical / robots / sitemap.** Falta `<link rel="canonical">` (evita contenido duplicado si el dominio responde con/sin `www` o por la URL de Railway) y no hay `robots.txt` ni `sitemap.xml` en el repo. *Rec*: canonical al dominio final, un `robots.txt` mínimo que apunte al sitemap, y un `sitemap.xml` (aunque sea de una sola URL) servidos por rutas dedicadas como ya se hace con `styles.css`/`script.js` en `amarradero/urls.py`.
- **A4 — Lazy-loading de imágenes.** Solo 1 de 18 `<img>` usa `loading="lazy"`; el resto se descargan de entrada aunque estén muy abajo. *Rec*: añadir `loading="lazy"` a todas las imágenes por debajo del pliegue (mantener *eager* solo el logo y lo visible al cargar). Mejora el LCP en móvil, que es el dispositivo principal del público.
- **A5 — Video de 28 MB muerto en el repo.** `statics/videopagina.mp4` pesa 28 MB, está commiteado y **no lo referencia** `index.html`, `script.js` ni `styles.css` (el hero real usa la URL de Cloudinary `videoherofinal_hbehbp.mp4`). Infla el clon del repo y el build de Railway sin aportar nada. *Rec*: eliminarlo del control de versiones (y añadirlo a `.gitignore` como ya se hizo con los otros dos `.mp4` pesados). Si en algún momento se necesita, servirlo desde Cloudinary como el resto.