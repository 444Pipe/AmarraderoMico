# Auditoría del proyecto — El Amarradero del Mico

> Segunda auditoría, 2026-07-10. La primera (`ESTADO_DEL_PROYECTO.md`, 2026-07-02) sigue siendo válida como histórico; este documento audita el **estado actual** tras el crecimiento del proyecto (pagos Wompi, mini-CRM de clientes, panel de estadísticas, `analytics.py`, rediseño del menú/carta) y hace **seguimiento** de los 60 hallazgos anteriores.
>
> Metodología: 3 exploraciones paralelas (backend, frontend, panel/CSS) y verificación directa en el código de cada hallazgo con referencia `archivo:línea`. Igual que la auditoría previa, las severidades están calibradas por los mitigantes reales del negocio: **humano en el bucle vía WhatsApp**, volumen pequeño, y sin cobro automático irreversible (la mesera confirma cada pedido).
>
> **Actualización (2026-07-10, misma tarde):** los bloques "Ahora" y "Siguiente" de la sección 5 están aplicados — **N1, N2, N3, N4, N5, N6, N9, N10 y N11 corregidos**, y también los medios de integridad **#5 (catálogo de precios server-side), #6 (rate limiting), #7 (mesera sin superusuario) y #9 (límites de tamaño)**. `orders/tests.py` cubre webhook, `crear_pedido` y `crear_admin` (13 tests). ⚠️ Dos consecuencias operativas: (1) **confirmar que `WOMPI_EVENTS_SECRET` esté seteado en Railway** — con el *fail-closed*, sin él se rechazan también los webhooks legítimos; (2) el próximo deploy **degrada la cuenta del panel a no-superusuario** — si esa cuenta se usaba para el admin completo, crear antes un superusuario aparte (`manage.py createsuperuser`, acepta `DJANGO_SUPERUSER_*`).
>
> **Actualización 2 (2026-07-10, más tarde):** aplicada otra tanda de "cuando haya aire" — **N7** (polling en `pago/resultado/` + endpoint `pago/estado/`), **bloque SEO completo** (OG + Twitter Card, JSON-LD `Restaurant`, canonical, `loading="lazy"` en las 15 imágenes bajo el pliegue, `robots.txt` + `sitemap.xml`, y `statics/videopagina.mp4` eliminado del repo — A1, A2, A4, A5), **CSS** (#54 `will-change` removido, #55 `-webkit-backdrop-filter` en los 5 usos, #58 fallbacks `dvh`, `@keyframes fadeIn` duplicado renombrado a `fadeInDown`) y **bloque `LOGGING` a stdout** en `settings.py` (#29 parcial). Las URLs absolutas de OG/JSON-LD usan un placeholder `__SITE_URL__` que `home()` reemplaza con la env var `SITE_URL` — **requiere `SITE_URL` seteada en Railway** (ya lo estaba para Cloudinary). `orders/tests.py` sube a **18 tests** (nuevos: `pago_estado`, robots, sitemap, reemplazo de `__SITE_URL__`).
>
> **Actualización 3 (2026-07-10, noche):** tercera tanda — **#28 CI en GitHub Actions** (`.github/workflows/ci.yml`: tests + `manage.py check --deploy` con config de producción simulada), **#25 backups documentados** (sección nueva en `CONTEXTO.md`: activar los backups de Railway + receta de `pg_dump`/`pg_restore` manual — ⚠️ **falta activar los backups en el dashboard de Railway**), **#16 validación de teléfono** (backend exige 7–15 dígitos + `pattern` en el input), **#59 `/healthz` verifica la BD** (`SELECT 1`, devuelve 503 `degraded` si no responde), **#21 Inter 700/800 ya se cargan**, **#30 residuo `$5.000` eliminado** (el HTML inicial ya dice "Según ubicación") y **#48 `dom.cartDeliveryRow` muerto removido**. `orders/tests.py` sube a **22 tests** (nuevos: teléfono inválido/válido, healthz ok/degraded). N8 (agregaciones de `analytics.py` en BD) queda a propósito para cuando crezca el volumen, como calibra esta misma auditoría.

---

## 1. Resumen ejecutivo

El proyecto **maduró de forma notable** desde julio 2: los cuatro riesgos altos de la auditoría anterior están resueltos (config *secure-by-default*, `django-axes` en el login, Django 5.2.15 LTS + gunicorn 23, y ciclo de pedido cerrado con pantalla de éxito). Se añadió una integración de pagos **Wompi** con firma de integridad, un **mini-CRM** de clientes y un **panel de estadísticas** artesanal (sin librerías externas), todo bien construido y sin XSS.

El crecimiento, sin embargo, **abrió una superficie nueva** y el hallazgo más serio de esta auditoría vive ahí: el **webhook de Wompi es *fail-open***. La verificación de la firma del evento está envuelta en `if settings.WOMPI_EVENTS_SECRET:` (`orders/views.py:196`); si esa variable no está configurada en producción, cualquier POST anónimo a `/api/wompi/webhook/` puede marcar un pedido como **`aprobado`**. Y aunque el secreto esté puesto, el webhook **no compara el monto** del evento contra el `subtotal` del pedido. Como el endpoint es público y `@csrf_exempt`, esto es una brecha de integridad de pago real.

El resto son riesgos **medios y bajos** ya conocidos que persisten (precio confiado al cliente, sin rate limiting, mesera superusuario) más un puñado de **bugs nuevos de frontend** introducidos con el rediseño (race del mapa al cambiar de "recoger" a "domicilio" dentro del checkout; el mensaje de WhatsApp que dice "pagado en línea" aunque el pago no ocurriera; el acordeón de la carta que se colapsa entero al limpiar el buscador). La deuda transversal sigue igual que en julio: **sin tests, sin CI/CD, sin observabilidad y sin backups documentados**.

**Qué atacar primero:** (1) el webhook de Wompi — exigir el secreto y validar el monto; (2) los tres bugs de frontend, que son de esfuerzo bajo; (3) cerrar por fin los medios de integridad del backend (precio server-side, rate limiting, mesera sin superusuario).

---

## 2. Lo que funciona bien (incluye lo corregido desde julio)

**Resuelto desde la auditoría anterior:**
- **Config *secure-by-default*** (`amarradero/settings.py:23-69`): `DEBUG=False` por defecto; sin `SECRET_KEY` propia y con `DEBUG=False` la app **no arranca** (`ImproperlyConfigured`); `ALLOWED_HOSTS` sin comodín, derivado de `RAILWAY_PUBLIC_DOMAIN`; HTTPS/HSTS/cookies `Secure` en producción con exención de `/healthz`. Cierra los antiguos #1 y #8.
- **`django-axes` activo** (`settings.py:82,95,140-153`): 5 intentos → bloqueo 1 h por `username+ip_address`, respeta `X-Forwarded-For`. Cierra #2.
- **Dependencias al día** (`requirements.txt`): `Django==5.2.15` (LTS), `gunicorn==23.0.0`, `django-axes[ipware]==8.3.1`. Cierra #3.
- **Ciclo de pedido cerrado** (`script.js`): flag `isSubmitting` que bloquea el doble envío (`script.js:422,1459`), `savePedido` que lee `r.ok` y distingue error de red vs backend (`script.js:1317-1330`), pantalla de éxito con nº de pedido y limpieza del carrito, fallback si el popup de WhatsApp se bloquea (`script.js:1479-1482`). Cierra #4, #12, #13, #14, #47.
- **`home()` cacheado** (`orders/views.py:32-50`): el HTML reescrito a Cloudinary se guarda en memoria (`_INDEX_HTML_CACHE`); en producción se lee una sola vez. Añade `Cache-Control`. Cierra #11.
- **Modelo `Pedido` enriquecido** (`orders/models.py`): ahora guarda `direccion`, `subtotal`, `metodo_pago`, `paga_con`, `estado_pago`, `wompi_reference`, `wompi_transaction_id`. Resuelve en gran parte #36.
- **`prefers-reduced-motion`** bien implementado en la landing (`styles.css:46`) y en el login. Cierra #23 para la landing.

**Bien construido en lo nuevo:**
- **Firma de integridad de Wompi al crear el checkout** (`orders/views.py:158-160`): `SHA256(reference + amount + currency + secret)`, correcto.
- **Panel sin XSS**: todo se pinta con autoescape de Django; las únicas interpolaciones dentro de `<script>` son enteros (`dashboard.html:488-489`); el `confirm()` de cancelar usa `escapejs` (`dashboard.html:378`); no hay `innerHTML` con datos de usuario en ninguna plantilla del panel. CSRF token presente en todos los `<form method="post">`.
- **Estadísticas artesanales sin dependencias**: barras y columnas con `style="width/height:{{pct}}%"`, sin Chart.js ni CDN de charting; `analytics.py` blinda las divisiones con `if ... else 0` en todos los porcentajes.
- **Frontend cuidado**: delegación de eventos sin listeners duplicados (guards `dataset.accBound`), geolocalización con `watchPosition` que se queda con la mejor precisión, Leaflet cargado on-demand, cero inyección de input en `innerHTML` (solo a WhatsApp con `encodeURIComponent`).

---

## 3. Hallazgos nuevos priorizados

> Numeración con prefijo **N** (nuevos), para no chocar con los #1–#60 de la auditoría anterior.

| # | Sev. | Categoría | Título | Archivo | Esfuerzo | Estado |
|---|------|-----------|--------|---------|----------|--------|
| N1 | 🔴 | seguridad/pago | Webhook de Wompi *fail-open*: sin `WOMPI_EVENTS_SECRET` acepta cualquier evento no firmado | `orders/views.py:196` | bajo | ✅ fail-closed (403 sin secreto) |
| N2 | 🟠 | seguridad/pago | El webhook no valida el monto del evento contra el `subtotal` del pedido | `orders/views.py:213-227` | bajo | ✅ APPROVED exige monto exacto |
| N3 | 🟠 | producto/pago | Pedido PSE nace en estado `nuevo`: un pago nunca completado aparece como activo en el panel | `orders/views.py:110-127` | medio | ✅ chip de estado de pago en el panel |
| N4 | 🟡 | bug | Race del mapa: cambiar de "Recoger" a "Domicilio" ya en el checkout deja el mapa vacío | `script.js:912, 928-935` | bajo | ✅ `setOrderType` monta mapa y resumen |
| N5 | 🟡 | bug/confianza | El mensaje de WhatsApp dice "pagado en línea por Wompi" aunque el pago no se haya hecho | `script.js:1263-1265` | bajo | ✅ ahora dice "NO se completó el pago" |
| N6 | 🟡 | bug/ux | Al limpiar el buscador, el acordeón de la carta colapsa TODAS las categorías (incluidas las 2 abiertas por defecto) | `script.js:538-545` | bajo | ✅ restaura las 2 primeras abiertas |
| N7 | 🟡 | rendimiento | `pago_resultado` sin auto-refresh: el estado "en proceso" nunca se actualiza solo | `orders/views.py:232`, `pago_resultado.html` | bajo | ✅ polling ~90 s contra `pago/estado/` |
| N8 | 🟡 | rendimiento | `analytics.py` carga `Pedido.objects.all()` completo en Python en cada request de clientes/estadísticas | `orders/analytics.py:29,96,134` | medio | ⭕ |
| N9 | ⚪ | infra | `WOMPI_CHECKOUT_URL`: las dos ramas del condicional son idénticas (código muerto) | `amarradero/settings.py:202-206` | bajo | ✅ colapsado (y `WOMPI_ENV` eliminado) |
| N10 | ⚪ | mantenibilidad | Condición redundante en el polling del panel (`d.ultimo !== X && d.ultimo > X`) | `orders/templates/orders/dashboard.html:495` | bajo | ✅ simplificado |
| N11 | ⚪ | mantenibilidad | El webhook no refresca `actualizado` (falta en `update_fields`) | `orders/views.py:227` | bajo | ✅ incluido en `update_fields` |

### 🔴 N1 — Webhook de Wompi *fail-open* (lo más serio de esta auditoría)

`orders/views.py:196`. La verificación de la firma del evento está dentro de `if settings.WOMPI_EVENTS_SECRET:`. Si esa variable de entorno no está configurada, **todo el bloque de verificación se salta** y el webhook procesa el cuerpo del POST tal cual. Siendo `/api/wompi/webhook/` un endpoint **público y `@csrf_exempt`**, un atacante que conozca (o adivine) un `wompi_reference` puede enviar `{"data":{"transaction":{"reference":"pedido-N-...","status":"APPROVED"}}}` y marcar ese pedido como `aprobado` sin haber pagado.

- *Impacto*: falsificación del estado de pago. Atenúa que la mesera confirma manualmente y que en producción el secreto probablemente esté puesto — pero es un *footgun* que depende de una variable de entorno correctamente seteada, exactamente el patrón que la config del resto del proyecto ya evita (fail-fast).
- *Recomendación*: invertir la lógica a *fail-closed* — si `WOMPI_EVENTS_SECRET` está vacío, **rechazar** el webhook (403) en lugar de aceptarlo; o exigir el secreto al arrancar (como se hace con `SECRET_KEY`). Nunca procesar un evento sin firma verificada.

### 🟠 N2 — El webhook no valida el monto

`orders/views.py:213-227`. Al recibir `APPROVED` se marca `estado_pago=aprobado` sin comparar `data.transaction.amount_in_cents` contra `pedido.subtotal * 100`. Combinado con N1 (o con un `reference` reutilizado), permite "aprobar" un pedido por un monto distinto al cobrado.
- *Recomendación*: verificar que el monto del evento coincide con el esperado del pedido antes de marcarlo aprobado; loguear y descartar si no cuadra.

### 🟠 N3 — Pedido PSE nace "activo" aunque no se pague

`orders/views.py:110-127`. Un pedido con `metodo_pago='pse'` se crea con `estado_pago='pendiente'` pero con `estado` (de gestión) en el default `nuevo`, así que **aparece en el dashboard como pedido activo** aunque el cliente abandone el checkout de Wompi y nunca pague. La mesera no distingue un pedido pagado de uno solo iniciado.
- *Recomendación*: no mostrar en "activos" los pedidos PSE con `estado_pago='pendiente'`, o marcarlos visualmente en el panel ("esperando pago"); opcionalmente expirarlos tras N minutos sin webhook aprobado.

### 🟡 N4 — Race del mapa al cambiar de tipo dentro del checkout

`initMapPicker()` solo se invoca en `showCheckoutView()` cuando `orderType === 'delivery'` (`script.js:912`). `setOrderType()` (`script.js:928-935`) actualiza `applyOrderTypeToCheckout()` pero **no inicializa el mapa**. Si el usuario entra al checkout en "Recoger" y luego cambia a "Domicilio" (el toggle sigue visible), `#mapContainer` queda vacío/sin `invalidateSize()`.
- *Recomendación*: en `setOrderType`, si el checkout está visible y el nuevo tipo es `delivery`, llamar `initMapPicker()` (es idempotente por diseño).

### 🟡 N5 — WhatsApp dice "pagado en línea" cuando no se pagó

`script.js:1263-1265`. `buildWhatsappMessage` añade "🏦 _(pagado en línea por Wompi)_" siempre que `metodo_pago==='pse'`. Pero si Wompi no estaba configurado o el POST no devolvió `wompi_checkout_url`, el flujo **cae al fallback de WhatsApp** (`script.js:1470-1482`) sin haber cobrado nada — y aun así el mensaje afirma que se pagó. La mesera puede despachar un pedido no pagado creyendo que sí lo estaba.
- *Recomendación*: solo etiquetar "pagado en línea" cuando la redirección a Wompi efectivamente ocurrió; en el fallback, decir "eligió pago Wompi (verificar)".

### 🟡 N6 — El acordeón colapsa entero al limpiar el buscador

`script.js:538-545`. En modo acordeón, cuando `filtering` es falso (búsqueda vacía y antojo "Todos"), el bucle pone `is-open=false` en **todas** las categorías, incluidas las 2 que `renderFullMenu()` abre por defecto. Tras buscar y borrar, la carta queda completamente colapsada.
- *Recomendación*: al salir del modo filtro, restaurar el estado por defecto (2 primeras abiertas) en vez de colapsar todo.

### 🟡 N7 — `pago/resultado/` no se auto-actualiza

`pago_resultado.html` no tiene JS ni polling. Como el redirect del navegador desde Wompi suele llegar **antes** que el webhook (que es asíncrono), `pedido.wompi_transaction_id` puede estar aún vacío y la página mostrará "en proceso" indefinidamente; el cliente debe recargar a mano.
- *Recomendación*: pequeño polling (cada 3-5 s, unos pocos intentos) que consulte el estado, o un endpoint de estado por `reference`.

### 🟡 N8 — `analytics.py` es O(n) en memoria por request

`resumen_clientes` (`analytics.py:29`), `ficha_cliente` (`:96`) y `estadisticas_generales` (`:134`) hacen `Pedido.objects.all()` y agregan en Python. `cliente_detalle` carga **toda** la tabla para filtrar un solo cliente (`analytics.py:96`). El propio docstring lo asume aceptable para un restaurante pequeño; lo es hoy, pero escala mal.
- *Recomendación*: cuando el volumen crezca, mover las agregaciones a `annotate/aggregate` en la BD y filtrar `cliente_detalle` por teléfono normalizado en la query, no en Python.

### ⚪ N9–N11 (pulido)
- **N9** `amarradero/settings.py:202-206`: `WOMPI_CHECKOUT_URL` devuelve la misma URL en ambas ramas del `if WOMPI_ENV=='production' else`. Es código muerto; o se diferencia sandbox/producción de verdad, o se colapsa a una sola línea.
- **N10** `dashboard.html:495`: `d.ultimo !== ULTIMO_ACTUAL && d.ultimo > ULTIMO_ACTUAL` — el segundo término implica el primero. Simplificable a `d.ultimo > ULTIMO_ACTUAL`.
- **N11** `orders/views.py:227`: el `save(update_fields=['wompi_transaction_id','estado_pago'])` del webhook no incluye `actualizado`, así que ese timestamp no refleja los cambios de pago.

---

## 4. Seguimiento de los 60 hallazgos previos

Estado: ✅ corregido · 🟡 parcial · ⭕ abierto.

| # | Título (abreviado) | Estado | Evidencia |
|---|--------------------|--------|-----------|
| 1 | Config fail-open (`SECRET_KEY`/`DEBUG`) | ✅ | secure-by-default en `settings.py:23-34` |
| 2 | Login sin anti-fuerza-bruta | ✅ | `django-axes` `settings.py:140-153` |
| 3 | Dependencias con CVE / Django EOL | ✅ | Django 5.2.15 LTS, gunicorn 23 (`requirements.txt`) |
| 4 | "Pedido fantasma" sin confirmación | ✅ | pantalla de éxito + `r.ok` (`script.js:1317-1372`) |
| 5 | Backend confía en el `price` del cliente | ✅ | catálogo server-side (`orders/catalogo.py` + `menu-data.js` como fuente única); `crear_pedido` ignora el `price` del payload y rechaza ids fuera de la carta (2026-07-10) |
| 6 | Endpoint público sin rate limiting | ✅ | throttle por IP en `crear_pedido`: 10 pedidos/10 min con el cache local (2026-07-10) |
| 7 | Mesera como superusuario | ✅ | `crear_admin.py` crea staff SIN superusuario, grupo "Mesera" con view/change de pedido/cliente (2026-07-10) |
| 8 | `ALLOWED_HOSTS='*'` por defecto | ✅ | sin comodín (`settings.py:39-55`) |
| 9 | Sin límites de tamaño en items/notas | ✅ | tope de 60 renglones por pedido, qty ≤ 50, `notas` truncada a 500 (2026-07-10) |
| 10 | Admin en ruta "secreta" con default público | ⭕ | `ADMIN_URL` default `gestion-mico-9q2x` en `settings.py:186` y CONTEXTO.md |
| 11 | `home()` lee index.html + regex por request | ✅ | cache en memoria (`views.py:32-50`) |
| 12 | Doble/triple envío del pedido | ✅ | flag `isSubmitting` (`script.js:1459`) |
| 13 | POST falla en silencio | ✅ | `savePedido` lee `r.ok` (`script.js:1317-1330`) |
| 14 | Sin confirmación ni limpieza del carrito | ✅ | `showSuccessView` vacía el carrito (`script.js:1345-1372`) |
| 15 | Carrito/datos no persisten (localStorage) | ⭕ | sigue sin `localStorage`; carrito en `Map` volátil |
| 16 | Validación de teléfono inexistente | ✅ | backend exige 7–15 dígitos (400 si no); input con `pattern` + `inputmode` (2026-07-10) |
| 17 | CDN Leaflet/unpkg sin fallback | ⭕ | `loadLeaflet()` inyecta desde unpkg sin respaldo |
| 18 | Modal sin gestión de foco / mapa sin teclado | ⭕ | sin focus trap ni `role=dialog`; ESC sí cierra |
| 19 | Nominatim sin control de rate-limit | ⭕ | llamadas directas con `try/catch`, sin 429/User-Agent propio |
| 20 | Áreas táctiles <44px en botones cantidad | ⭕ | `.cart-qty-btn` 26→24→22px (`styles.css:811,1990,2069`) |
| 21 | Pesos 700/800 usados pero no cargados | ✅ | import de Inter ampliado a `300..800` (2026-07-10) |
| 22 | Desktop-first pese a público móvil | ⭕ | todos los `@media` siguen siendo `max-width` |
| 23 | Sin `prefers-reduced-motion` | 🟡 | ✅ en la landing (`styles.css:46`) y login; falta en las plantillas del panel |
| 24 | `<head>` pesado (Font Awesome completo) | ⭕ | FA 6.5.1 completo desde cdnjs (`index.html:18`) |
| 25 | Sin plan de backups de Postgres | 🟡 | plan documentado en `CONTEXTO.md` (Railway Backups + `pg_dump` manual); falta activarlos en el dashboard |
| 26 | Arranque acopla migrate+collectstatic+crear_admin | ⭕ | sigue en `railway.json:7` y `Procfile` |
| 27 | Assets con `django.views.static.serve` | ⭕ | `urls.py:19-21` sigue sirviendo con la vista de dev |
| 28 | Sin CI/CD, lockfile, linters, Dependabot | 🟡 | CI en `.github/workflows/ci.yml` (tests + `check --deploy`); sin lockfile/linters/Dependabot |
| 29 | Sin `LOGGING`/observabilidad | 🟡 | bloque `LOGGING` a stdout en `settings.py` (Railway lo captura); falta Sentry/alertas |
| 30 | Costo de domicilio/total no se muestra | ✅/decisión | intencional: "Según ubicación"; el residuo `$5.000` del HTML inicial ya se corrigió (2026-07-10) |
| 31 | Sin horario de atención | ⭕ | la hora solo reordena el menú; se pide a cualquier hora |
| 32 | Menú hardcodeado | ⭕ | `MENU_DATA` con 92 platos en `script.js:95-253`; sin panel de edición |
| 33 | Sin totales del día en el panel | ✅ | panel de estadísticas (`estadisticas.html` + `analytics.py`) |
| 34 | Sin pago en línea | ✅ | integración Wompi (PSE/tarjeta/Nequi) añadida |
| 35 | Notificación de pedido frágil (chime) | 🟡 | sigue el `chime()` WebAudio con riesgo de autoplay; sin push/Notification API |
| 36 | `Pedido` sin domicilio/total/pago | 🟡 | ahora guarda dirección/subtotal/método/estado_pago; falta `costo_domicilio`/`total` explícitos |
| 37 | Zona de cobertura no validada | ⭕ | `pickedLocation` acepta cualquier punto; sin geofence |
| 38 | Cliente sin seguimiento de estado | ⭕ | `cambiar_estado` no avisa al cliente |
| 39 | Domicilios a una sola sede (hay 3) | ⭕ | WhatsApp fijo `573159265910` (Sede Vanguardia) |
| 40 | Historial limitado a 30 | ⭕ | `dashboard` `[:30]` sigue igual (`views.py`) |
| 41 | Sin edición de pedido en el panel | ⭕ | solo aceptar/despachar/cancelar |
| 42 | Sin mínimo de pedido a domicilio | ⭕ | checkout con 1 ítem de cualquier valor |
| 43 | Sin tests ni `transaction` en `crear_pedido` | 🟡 | 22 tests en `orders/tests.py` + CI que los corre en cada push (2026-07-10); el `create` ya va en `try/except`; queda la rama PSE con `save` extra sin envoltura |
| 44 | Sin comanda imprimible / vista cocina | ⭕ | no añadido |
| 45 | `:focus-visible` propio ausente | ⭕ | se apoya en el default del navegador |
| 46 | WhatsApp de sede hardcodeado en JS | ⭕ | `DELIVERY_CONFIG.whatsapp` fijo (`script.js:78`) |
| 47 | `window.open` WhatsApp sin fallback | ✅ | `popupBlocked` → botón "Abrir WhatsApp" (`script.js:1479-1482`) |
| 48 | Handlers globales sin guardas de nulos | ✅ | guards `if (dom.x)` extendidos y `dom.cartDeliveryRow` muerto removido (2026-07-10) |
| 49 | Pin opcional en domicilio pese al copy | ⭕ | el pin sigue siendo opcional |
| 50 | Prueba social sin reseñas reales | ⭕ | estrellas decorativas en `index.html` |
| 51 | Domicilio sin tiempo estimado | ⭕ | no se muestra rango de tiempo |
| 52 | Fotos genéricas/repetidas en el menú | 🟡 | la carta landing sí tiene fotos reales; el menú del pedido cae a iconos FA |
| 53 | `.checkout-summary` duplicada/anulada | 🟡 | siguen múltiples definiciones y la capa "OVERRIDE FINAL" con `!important` (`styles.css:3670-3732`) |
| 54 | `will-change` permanente | ✅ | removido de `.reveal` y `.hero-content` (2026-07-10) |
| 55 | `backdrop-filter` sin `-webkit-` | ✅ | prefijo añadido en los 5 usos de la landing (2026-07-10) |
| 56 | Gradiente/z-index mágicos repetidos | ⭕ | sin tokens; además paleta duplicada en 4 archivos con `--green` inconsistente |
| 57 | Contraste rust sobre crema | ⭕ | sin cambios; vigilar dorados como texto |
| 58 | Alturas `vh` sin `dvh` | ✅ | fallback `dvh` en hero, experiencia y `body.loading` (2026-07-10) |
| 59 | `/healthz` no verifica la BD | ✅ | `SELECT 1` contra la BD; 503 `degraded` si falla (2026-07-10) |
| 60 | `db.sqlite3` en el working dir | 🟡 | sigue presente (no versionado, correcto) |

**Balance** (tras las tres tandas del 2026-07-10)**:** de 60, **24 corregidos** (1,2,3,4,5,6,7,8,9,11,12,13,14,16,21,30,33,34,47,48,54,55,58,59), **10 parciales** (23,25,28,29,35,36,43,52,53,60), y el resto abiertos — mayormente producto/UX de baja urgencia. Los altos de julio y los medios de integridad (5,6,7,9) están cerrados; de seguridad queda solo #10 (default público de `ADMIN_URL`), mitigado si la variable está seteada en Railway.

---

## 5. Recomendaciones priorizadas (impacto / esfuerzo)

**Ahora (esfuerzo bajo, impacto alto):** ✅ **aplicado el 2026-07-10**
1. ~~**Cerrar el webhook de Wompi** (N1, N2)~~: *fail-closed* + validación de monto, con tests en `orders/tests.py`.
2. ~~**Corregir los tres bugs de frontend** (N4 race del mapa, N5 "pagado en línea" falso, N6 acordeón)~~: corregidos en `script.js`.
3. ~~**Marcar los PSE pendientes en el panel** (N3)~~: chip de estado de pago en las tarjetas del dashboard (activos e historial).

**Siguiente (integridad del backend, aún pendiente de julio):** ✅ **aplicado el 2026-07-10**
4. ~~**Catálogo de precios server-side** (#5)~~: `menu-data.js` es la fuente única (la leen `script.js` y `orders/catalogo.py`); el backend resuelve precio y nombre por `id` y rechaza ids fuera de la carta.
5. ~~**Rate limiting + límites de tamaño** en `crear_pedido` (#6, #9)~~: throttle por IP (10 pedidos/10 min), tope de 60 renglones, qty ≤ 50, `notas` a 500, `create` con `try/except`+logging.
6. ~~**Mesera sin superusuario** (#7)~~: `crear_admin` crea staff sin superusuario con grupo "Mesera" (`view/change` de pedido/cliente). Para el admin completo: superusuario aparte con `createsuperuser`.

**Cuando haya aire (deuda transversal):**
7. **Base de calidad**: ~~tests mínimos~~ (22 tests), ~~`LOGGING` a stdout~~, ~~CI con `check --deploy`~~ y ~~backups documentados~~ (todo 2026-07-10); **falta**: activar los backups en el dashboard de Railway, Sentry/alertas, lockfile/Dependabot (#25 parcial, #28 parcial, #29 parcial, #43 parcial).
8. ~~**SEO/redes** (A1, A2, A4, A5)~~: ✅ **aplicado el 2026-07-10** — OG + Twitter Card + canonical, JSON-LD `Restaurant`, lazy en las 15 imágenes bajo el pliegue (loader/nav/footer se quedan eager), `videopagina.mp4` fuera del repo y en `.gitignore`, `robots.txt` (bloquea `/panel/`, `/api/`, `/pago/`) y `sitemap.xml`. Las URLs absolutas dependen de `SITE_URL` en Railway.
9. **Rendimiento del panel** (N8): mover agregaciones de `analytics.py` a la BD cuando crezca el volumen.
10. ~~**CSS** (#54, #55, #58 y el `fadeIn` duplicado)~~: ✅ **aplicado el 2026-07-10** — `-webkit-backdrop-filter` en los 5 usos, fallbacks `dvh`, `will-change` removido, `@keyframes fadeIn` de `payment-info` renombrado a `fadeInDown` (el fade del backdrop ya no hereda el `translateY`). **Queda**: unificar tokens de color (#56) y el contraste rust/crema (#57).

---

## 6. Nota final

El proyecto **no tiene emergencias operativas** — la mesera confirma cada pedido por WhatsApp y no hay cobro automático irreversible. Pero con Wompi en producción, el estado de pago pasó a ser un dato con valor, y el webhook *fail-open* (N1) es la primera cosa que debería cerrarse. Después, los tres bugs de frontend son correcciones de una tarde que mejoran notablemente la experiencia. El resto es la misma hoja de ruta de julio, ahora con cuatro de sus grandes bloques ya tachados.
