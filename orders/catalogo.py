"""Catálogo de precios server-side (hallazgo #5 de la auditoría).

La fuente única de la carta es `menu-data.js` (raíz del repo): el frontend la
pinta y este módulo la lee para resolver los precios EN EL SERVIDOR al crear
un pedido. El `price` que envía el navegador nunca se usa para cobrar.

El archivo es JS solo por la primera línea (`window.MENU_DATA = ...`); el
payload es JSON estricto, así que aquí basta recortar la asignación y parsear.
"""
import json

from django.conf import settings

MENU_PATH = settings.BASE_DIR / 'menu-data.js'
# Anclado a inicio de línea para no confundirse con menciones en los comentarios.
_MARKER = '\nwindow.MENU_DATA ='

# Cache en memoria (mismo patrón que _INDEX_HTML_CACHE en views): en producción
# la carta solo cambia con un deploy, que reinicia el proceso.
_CATALOGO_CACHE = None


def catalogo():
    """Dict id_plato -> {'name': str, 'price': int} con toda la carta."""
    global _CATALOGO_CACHE
    if _CATALOGO_CACHE is None or settings.DEBUG:
        text = MENU_PATH.read_text(encoding='utf-8')
        payload = text[text.index(_MARKER) + len(_MARKER):].strip().rstrip(';')
        data = json.loads(payload)
        _CATALOGO_CACHE = {
            str(item['id']): {'name': str(item['name']), 'price': int(item['price'])}
            for cat in data
            for item in cat.get('items', [])
        }
    return _CATALOGO_CACHE
