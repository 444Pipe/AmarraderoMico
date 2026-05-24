import os
import re
from flask import Flask, send_from_directory, Response

app = Flask(__name__, static_folder='.', static_url_path='')

CLOUDINARY_CLOUD = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
SITE_URL = os.environ.get('SITE_URL', '').strip().rstrip('/')
CLOUDINARY_TRANSFORM = os.environ.get('CLOUDINARY_TRANSFORM', 'f_auto,q_auto').strip()
GOOGLE_MAPS_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()

IMG_PATTERN = re.compile(
    r'(src|href)="(statics/[^"]+\.(?:jpg|jpeg|png|gif|webp|svg))"',
    re.IGNORECASE,
)


def _cloudinary_url(path: str) -> str:
    absolute = f"{SITE_URL}/{path}"
    return (
        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD}"
        f"/image/fetch/{CLOUDINARY_TRANSFORM}/{absolute}"
    )


def _render_index() -> str:
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    if CLOUDINARY_CLOUD and SITE_URL:
        html = IMG_PATTERN.sub(
            lambda m: f'{m.group(1)}="{_cloudinary_url(m.group(2))}"',
            html,
        )
    html = html.replace('__GOOGLE_MAPS_KEY__', GOOGLE_MAPS_KEY)
    return html


@app.route('/')
def index():
    return Response(_render_index(), mimetype='text/html')


@app.route('/statics/<path:filename>')
def statics(filename):
    return send_from_directory('statics', filename)


@app.route('/healthz')
def healthz():
    return {'status': 'ok'}, 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
