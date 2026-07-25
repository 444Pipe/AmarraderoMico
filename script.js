// Loader: barra de progreso real segun recursos cargados
(function initLoader() {
    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loaderBar');
    if (!loader || !loaderBar) return;

    const images = Array.from(document.querySelectorAll('img'));
    const hasVideo = !!document.getElementById('heroVideo');
    const total = images.length + (hasVideo ? 1 : 0);
    let loaded = 0;
    let minProgress = 0;
    const ticker = setInterval(() => {
        minProgress = Math.min(minProgress + 2, 90);
        const realPct = total ? (loaded / total) * 100 : 0;
        const pct = Math.max(realPct, minProgress);
        loaderBar.style.width = pct + '%';
    }, 120);

    const bump = () => { loaded++; };
    images.forEach(img => {
        if (img.complete) bump();
        else {
            img.addEventListener('load', bump, { once: true });
            img.addEventListener('error', bump, { once: true });
        }
    });
    if (hasVideo) {
        const v = document.getElementById('heroVideo');
        if (v.readyState >= 1) bump();
        else {
            v.addEventListener('loadedmetadata', bump, { once: true });
            v.addEventListener('error', bump, { once: true });
        }
    }

    const hideLoader = () => {
        clearInterval(ticker);
        loaderBar.style.width = '100%';
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.classList.remove('loading');
        }, 450);
    };

    if (document.readyState === 'complete') hideLoader();
    else window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 7000); // failsafe
})();

// Navbar scroll effect (con rAF + passive para no bloquear)
const navbar = document.getElementById('navbar');
let navTicking = false;
const updateNavbar = () => {
    if (window.scrollY > 60) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
    navTicking = false;
};
window.addEventListener('scroll', () => {
    if (!navTicking) { requestAnimationFrame(updateNavbar); navTicking = true; }
}, { passive: true });

// Mobile menu (drawer lateral con backdrop y bloqueo de scroll)
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navBackdrop = document.getElementById('navBackdrop');
const navClose = document.getElementById('navClose');

const setNavOpen = (open) => {
    navMenu.classList.toggle('active', open);
    navToggle.classList.toggle('active', open);
    navBackdrop.classList.toggle('active', open);
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open);
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};

navToggle.addEventListener('click', () => setNavOpen(!navMenu.classList.contains('active')));
navClose.addEventListener('click', () => setNavOpen(false));
navBackdrop.addEventListener('click', () => setNavOpen(false));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('active')) setNavOpen(false);
});

// Cerrar el menú al tocar un enlace o el CTA de domicilio
document.querySelectorAll('.nav-menu a, .nav-menu [data-open-delivery]').forEach(el => {
    el.addEventListener('click', () => setNavOpen(false));
});

// ============= SISTEMA DE DOMICILIOS =============
const DELIVERY_CONFIG = {
    whatsapp: '573159265910', // Número de la Sede Principal (Vanguardia)
    branchName: 'Sede Vanguardia',
    // El costo de domicilio se coordina con la sede segun distancia
    // (no se cobra fijo en linea, solo se muestra el subtotal de productos)
};

// Carta oficial de El Amarradero del Mico (menú 2026, Sede Vanguardia).
// Fuente única: alimenta tanto la sección "Menú" de la landing como el menú
// del domicilio. Cada categoría tiene un `icon` de Font Awesome (avatar por
// tipo de plato, ya que la carta no maneja foto por plato).
// El ORDEN base de las categorías es el de este arreglo; `orderedCategories()`
// lo reordena dinámicamente según la hora (desayunos en la mañana, almuerzos
// y picadas al mediodía).
// Catálogo. Cada plato: { id, name, price }. Opcionalmente `img` (ruta a una foto),
// que hoy solo usa la vitrina "Los más pedidos" de la carta: si el plato está en
// POPULAR y trae `img`, la tarjeta muestra la foto; si no, un marcador a la espera.
// Ej: { id: 'plato-mamona', name: 'Plato de Mamona', price: 38000, img: 'statics/img/mamona.jpg' }
const MENU_DATA = [
    {
        id: 'pa-empezar', name: "Pa' Empezar", icon: 'fa-plate-wheat',
        items: [
            { id: 'chicharrones', name: 'Chicharrones Carnudos', price: 25000 },
            { id: 'arepa-casa', name: 'Arepa de la Casa', price: 5000 },
            { id: 'rellena', name: 'Rellena', price: 15000 },
            { id: 'patacones-hogao', name: 'Patacones con Hogao', price: 14000 },
            { id: 'chunchullitas', name: 'Chunchullitas', price: 25000 },
            { id: 'empanaditas-mamona', name: 'Empanaditas de Mamona', price: 19000 },
            { id: 'chorizo-santarrosano', name: 'Chorizo Santarrosano', price: 12000 },
            { id: 'platano-queso', name: 'Plátano con Queso y Bocadillo', price: 12000 },
        ]
    },
    {
        id: 'lo-tipico', name: 'Lo Típico', icon: 'fa-fire',
        items: [
            { id: 'plato-mamona', name: 'Plato de Mamona', price: 38000 },
            { id: 'carne-cerdo', name: 'Carne de Cerdo', price: 38000 },
            { id: 'carne-mixta', name: 'Carne Mixta', price: 38000 },
            { id: 'chuleta-res', name: 'Chuleta de Res', price: 45000 },
            { id: 'costilla-cerdo-tulio', name: 'Costilla de Cerdo — Tulio', price: 55000 },
            { id: 'palo-costilla-mixto', name: 'Palo de Costilla Mixto', price: 50000 },
            { id: 'costilla-res', name: 'Costilla de Res', price: 65000 },
        ]
    },
    {
        id: 'pa-compartir', name: "Pa' Compartir", icon: 'fa-users',
        items: [
            { id: 'picada-3', name: 'Picada del Mico (3 pax aprox)', price: 90000 },
            { id: 'picada-4', name: 'Picada del Mico (4 pax aprox)', price: 110000 },
        ]
    },
    {
        id: 'otras-opciones', name: 'Otras Opciones', icon: 'fa-utensils',
        items: [
            { id: 'hamburguesa-mamona', name: 'Hamburguesa de Mamona', price: 32000 },
            { id: 'arroz-vegetariano', name: 'Arroz Vegetariano', price: 32000 },
            { id: 'sudado-cola', name: 'Sudado de Cola', price: 40000 },
            { id: 'arroz-mico', name: 'Arroz del Mico', price: 40000 },
            { id: 'lengua-salsa', name: 'Lengua en Salsa', price: 42000 },
            { id: 'costillas-bbq', name: 'Costillas BBQ', price: 35000 },
            { id: 'salchipapa', name: 'Salchipapa', price: 20000 },
        ]
    },
    {
        id: 'parrilla', name: 'Parrilla', icon: 'fa-drumstick-bite',
        items: [
            { id: 'sobrebarriga', name: 'Sobrebarriga a la Parrilla', price: 45000 },
            { id: 'pechuga-plancha', name: 'Pechuga a la Plancha', price: 40000 },
            { id: 'pechuga-champinones', name: 'Pechuga en Salsa de Champiñones', price: 50000 },
            { id: 'pechuga-hawaiana', name: 'Pechuga Hawaiana', price: 48000 },
            { id: 'lomo-cerdo', name: 'Lomo de Cerdo a la Parrilla', price: 40000 },
            { id: 'punta-anca', name: 'Punta de Anca', price: 55000 },
            { id: 'churrasco', name: 'Churrasco', price: 48000 },
            { id: 'baby-beef', name: 'Baby Beef', price: 52000 },
        ]
    },
    {
        id: 'pescados', name: 'Pescados', icon: 'fa-fish',
        items: [
            { id: 'mojarra', name: 'Mojarra Frita o en Salsa', price: 50000 },
            { id: 'trucha-ajillo', name: 'Trucha al Ajillo', price: 50000 },
            { id: 'bagre', name: 'Bagre Frito o en Salsa', price: 50000 },
            { id: 'amarillo-monsenor', name: 'Amarillo a la Monseñor', price: 60000 },
            { id: 'cachama', name: 'Cachama de Río', price: 55000 },
            { id: 'salmon-parrilla', name: 'Salmón a la Parrilla', price: 55000 },
            { id: 'salmon-camaron', name: 'Salmón con Camarón', price: 65000 },
            { id: 'cazuela-mariscos', name: 'Cazuela de Mariscos', price: 60000 },
        ]
    },
    {
        id: 'sopitas', name: 'Sopitas', icon: 'fa-bowl-food',
        items: [
            { id: 'sancocho-res', name: 'Sancocho de Res Especial', price: 20000 },
            { id: 'mondongo', name: 'Mondongo', price: 25000 },
            { id: 'sancocho-gallina', name: 'Sancocho de Gallina', price: 40000 },
        ]
    },
    {
        id: 'desayunos', name: 'Desayunos', icon: 'fa-egg',
        items: [
            { id: 'caldo-hueso', name: 'Caldo de Hueso', price: 15000 },
            { id: 'caldo-picado', name: 'Caldo de Picado', price: 20000 },
            { id: 'caldo-pez', name: 'Caldo de Pez', price: 24000 },
            { id: 'huevos-arroz', name: 'Huevos con Arroz', price: 15000 },
            { id: 'huevos-gusto', name: 'Huevos al Gusto', price: 11000 },
            { id: 'huevos-rancheros', name: 'Huevos Rancheros', price: 15000 },
            { id: 'hayaca', name: 'Hayaca', price: 19000 },
            { id: 'omelette', name: 'Omelette', price: 16000 },
            { id: 'calentao-paisa', name: 'Calentao Paisa', price: 26000 },
            { id: 'higado-plancha', name: 'Hígado a la Plancha', price: 23000 },
            { id: 'carne-bisteck', name: 'Carne en Bisteck', price: 25000 },
            { id: 'bisteck-caballo', name: 'Bisteck a Caballo', price: 28000 },
            { id: 'carne-plancha-des', name: 'Carne a la Plancha', price: 23000 },
        ]
    },
    {
        id: 'porciones', name: 'Porciones', icon: 'fa-plate-wheat',
        items: [
            { id: 'papa-criolla', name: 'Papa Criolla', price: 10000 },
            { id: 'papa-salada', name: 'Papa Salada', price: 5000 },
            { id: 'papa-francesa', name: 'Papa a la Francesa', price: 6000 },
            { id: 'yuca', name: 'Yuca', price: 5000 },
            { id: 'guacamole', name: 'Guacamole', price: 6000 },
            { id: 'platano-maduro', name: 'Plátano Maduro', price: 5000 },
        ]
    },
    {
        id: 'postres', name: 'Postres', icon: 'fa-ice-cream',
        items: [
            { id: 'merengon', name: 'Merengón', price: 14000 },
            { id: 'postre-casa', name: 'Postre de la Casa', price: 12000 },
            { id: 'arroz-leche', name: 'Arroz con Leche', price: 10000 },
            { id: 'paletas-amarelo', name: 'Paletas de Amarelo', price: 8000 },
            { id: 'alfajores', name: 'Alfajores (caja x8 und)', price: 20000 },
        ]
    },
    {
        id: 'bebidas', name: 'Bebidas', icon: 'fa-glass-water',
        items: [
            { id: 'sodas', name: 'Sodas', price: 13000 },
            { id: 'jarra-panela', name: 'Jarra de Panela y Limón', price: 15000 },
            { id: 'jarra-citrica', name: 'Jarra de Cítrica', price: 26000 },
            { id: 'citrica-personal', name: 'Cítrica Personal', price: 9000 },
            { id: 'jugos-naturales', name: 'Jugos Naturales', price: 9000 },
            { id: 'jugo-naranja', name: 'Jugo de Naranja', price: 7000 },
            { id: 'limonada-coco', name: 'Limonada de Coco', price: 14000 },
            { id: 'gatorade', name: 'Gatorade', price: 6000 },
            { id: 'agua-botella', name: 'Agua en Botella', price: 5000 },
            { id: 'gaseosa', name: 'Gaseosa', price: 5000 },
            { id: 'gaseosa-15', name: 'Gaseosa (1.5 Lt)', price: 10000 },
            { id: 'jugos-hit', name: 'Jugos Hit', price: 5000 },
            { id: 'agua-h2o', name: 'Agua H2O', price: 5000 },
        ]
    },
    {
        id: 'bebidas-calientes', name: 'Bebidas Calientes', icon: 'fa-mug-hot',
        items: [
            { id: 'tinto', name: 'Tinto', price: 4000 },
            { id: 'americano', name: 'Americano', price: 4000 },
            { id: 'capuchino', name: 'Capuchino', price: 5000 },
            { id: 'chocolate', name: 'Chocolate', price: 5000 },
        ]
    },
    {
        id: 'cervezas-licores', name: 'Cervezas & Licores', icon: 'fa-beer-mug-empty',
        items: [
            { id: 'cerveza-corona', name: 'Cerveza Corona', price: 10000 },
            { id: 'cerveza-coronita', name: 'Cerveza Coronita', price: 6000 },
            { id: 'cerveza-llanera', name: 'Cerveza Llanera', price: 11000 },
            { id: 'cerveza-aguila', name: 'Cerveza Águila / Poker / Light', price: 6000 },
            { id: 'club-colombia', name: 'Club Colombia', price: 9000 },
            { id: 'cerveza-stella', name: 'Cerveza Stella Artois', price: 6000 },
            { id: 'aguardiente-botella', name: 'Aguardiente (Botella)', price: 120000 },
            { id: 'aguardiente-media', name: 'Aguardiente (Media)', price: 70000 },
        ]
    },
];

// Reordena las categorías según la hora del día (hora local del cliente):
//  · 8:00–11:59  -> Desayunos y Sopitas de primeras.
//  · 12:00–17:59 -> Almuerzos (Lo Típico, Otras, Parrilla, Pescados) y Picadas de primeras.
//  · resto        -> orden base del arreglo MENU_DATA.
function orderedCategories() {
    let h = 12;
    try { h = new Date().getHours(); } catch (e) { /* usa 12 por defecto */ }
    let priority = [];
    if (h >= 8 && h < 12) {
        priority = ['desayunos', 'sopitas'];
    } else if (h >= 12 && h < 18) {
        priority = ['lo-tipico', 'pa-compartir', 'otras-opciones', 'parrilla', 'pescados'];
    }
    const byId = new Map(MENU_DATA.map(c => [c.id, c]));
    const seen = new Set();
    const result = [];
    priority.forEach(id => {
        if (byId.has(id)) { result.push(byId.get(id)); seen.add(id); }
    });
    MENU_DATA.forEach(c => { if (!seen.has(c.id)) result.push(c); });
    return result;
}

// Icono representativo por categoría, usado como respaldo cuando el nombre del
// plato no coincide con ninguna palabra clave.
const CAT_FALLBACK_ICON = {
    'desayunos': 'fa-egg', 'sopitas': 'fa-bowl-food', 'pa-empezar': 'fa-plate-wheat',
    'lo-tipico': 'fa-drumstick-bite', 'pa-compartir': 'fa-drumstick-bite', 'otras-opciones': 'fa-utensils',
    'pescados': 'fa-fish', 'parrilla': 'fa-drumstick-bite', 'porciones': 'fa-plate-wheat',
    'postres': 'fa-ice-cream', 'bebidas': 'fa-glass-water', 'bebidas-calientes': 'fa-mug-hot',
    'cervezas-licores': 'fa-beer-mug-empty',
};

// Elige el icono de Font Awesome que mejor representa el plato según su nombre:
// si es sopa -> bowl, si son huevos -> egg, carne -> cow, cerdo -> bacon, etc.
// El orden importa: lo más específico primero (p. ej. "caldo de pez" es sopa,
// no pescado; "salmón con camarón" resalta el marisco).
function iconFor(item, cat) {
    const n = (item.name || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const any = (...ws) => ws.some(w => n.includes(w));

    // --- Bebidas y licores (antes que la comida) ---
    if (any('aguardiente')) return 'fa-wine-bottle';
    if (any('cerveza', 'corona', 'coronita', 'poker', 'aguila', 'stella', 'club colombia', 'llanera')) return 'fa-beer-mug-empty';
    if (any('tinto', 'americano', 'capuchino', 'chocolate')) return 'fa-mug-hot';
    if (any('limonada', 'citrica', 'naranja', 'coco', 'limon', 'panela')) return 'fa-martini-glass-citrus';
    if (any('agua')) return 'fa-bottle-water';
    if (any('gaseosa', 'soda', 'gatorade', 'jugo', 'hit')) return 'fa-glass-water';

    // --- Postres (antes que "arroz", para "arroz con leche") ---
    if (any('alfajor')) return 'fa-cookie-bite';
    if (any('merengon', 'postre', 'paleta', 'con leche')) return 'fa-ice-cream';

    // --- Mariscos y pescados ---
    if (any('marisco', 'camaron')) return 'fa-shrimp';

    // --- Sopas (antes que pescado/carne: "caldo de pez", "sancocho de gallina") ---
    if (any('caldo', 'sancocho', 'mondongo', 'sopa', 'sudado', 'cazuela')) return 'fa-bowl-food';
    if (any('mojarra', 'trucha', 'bagre', 'cachama', 'salmon', 'amarillo', 'pescado', 'pez')) return 'fa-fish';

    // --- Huevos ---
    if (any('huevo', 'omelette', 'perico', 'ranchero')) return 'fa-egg';

    // --- Cerdo (antes que res: "lomo/costilla de cerdo") ---
    if (any('cerdo', 'chicharr', 'tocineta', 'chunchull')) return 'fa-bacon';

    // --- Hamburguesa y embutidos ---
    if (any('hamburguesa')) return 'fa-burger';
    if (any('salchipapa', 'chorizo', 'rellena', 'salchich')) return 'fa-hotdog';

    // --- Pollo ---
    if (any('pechuga', 'pollo', 'gallina')) return 'fa-drumstick-bite';

    // --- Vegetariano ---
    if (any('vegetarian')) return 'fa-seedling';

    // --- Arroces ---
    if (any('arroz')) return 'fa-bowl-rice';

    // --- Guacamole ---
    if (any('guacamole')) return 'fa-mortar-pestle';

    // --- Almidones y entradas ---
    if (any('arepa', 'hayaca', 'patacon', 'platano', 'calentao', 'empanad', 'queso', 'yuca', 'papa')) return 'fa-plate-wheat';

    // --- Res y carnes ---
    if (any('mamona', 'carne', 'res', 'chuleta', 'costilla', 'sobrebarriga', 'punta', 'churrasco', 'baby beef', 'lengua', 'bistec', 'higado', 'picada', 'lomo')) return 'fa-cow';

    return CAT_FALLBACK_ICON[cat.id] || 'fa-utensils';
}

// Índice plano id -> item (con el icono resuelto por plato y la categoría),
// para búsquedas O(1) desde el carrito y el checkout.
const MENU_INDEX = new Map();
MENU_DATA.forEach(cat => cat.items.forEach(item => {
    MENU_INDEX.set(item.id, { ...item, icon: iconFor(item, cat), catIcon: cat.icon, category: cat.name });
}));

// Normaliza texto para buscar sin importar acentos ni mayúsculas.
const normalizeText = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

// Platos estrella (los más pedidos): llevan sello 🔥 y son filtrables por antojo.
// Los familiares (Picadas del Mico, pa' compartir) van de primeros en la vitrina.
const POPULAR = new Set([
    'picada-3', 'picada-4', 'plato-mamona', 'chicharrones', 'mojarra',
    'sancocho-gallina', 'punta-anca', 'carne-cerdo', 'costilla-cerdo-tulio',
]);

// Filtros rápidos por antojo. `match` recibe el dataset (data-*) del plato.
const ANTOJOS = [
    { key: 'todos', label: 'Todos', icon: null, match: () => true },
    { key: 'populares', label: 'Más pedidos', icon: 'fa-fire', match: d => d.popular === '1' },
    { key: 'desayunos', label: 'Desayunos', icon: 'fa-egg', match: d => d.cat === 'desayunos' },
    { key: 'parrilla', label: 'Parrilla', icon: 'fa-drumstick-bite', match: d => d.cat === 'parrilla' },
    { key: 'pescados', label: 'Pescados', icon: 'fa-fish', match: d => d.cat === 'pescados' },
    { key: 'compartir', label: 'Compartir', icon: 'fa-users', match: d => d.cat === 'pa-compartir' },
    { key: 'ratico', label: "Pa' un ratico", icon: 'fa-champagne-glasses', match: d => ['pa-empezar', 'pa-compartir', 'cervezas-licores'].includes(d.cat) },
    { key: 'bebidas', label: 'Bebidas', icon: 'fa-beer-mug-empty', match: d => ['bebidas', 'bebidas-calientes', 'cervezas-licores'].includes(d.cat) },
];

const cart = new Map(); // id -> { item, qty }
let pickedLocation = null; // { lat, lng } seleccionado en el mapa
let orderType = 'delivery'; // 'delivery' | 'pickup'

const formatCOP = (n) => '$' + n.toLocaleString('es-CO');

const dom = {
    fab: document.getElementById('fabDelivery'),
    fabCount: document.getElementById('fabCount'),
    modal: document.getElementById('deliveryModal'),
    menu: document.getElementById('deliveryMenu'),
    cart: document.getElementById('deliveryCart'),
    items: document.getElementById('cartItems'),
    totals: document.getElementById('cartTotals'),
    subtotal: document.getElementById('cartSubtotal'),
    delivery: document.getElementById('cartDelivery'),
    total: document.getElementById('cartTotal'),
    checkoutBtn: document.getElementById('cartCheckout'),
    body: document.getElementById('deliveryBody'),
    checkout: document.getElementById('deliveryCheckout'),
    checkoutBack: document.getElementById('checkoutBack'),
    checkoutSummary: document.getElementById('checkoutSummary'),
    checkoutTotal: document.getElementById('checkoutTotal'),
    form: document.getElementById('checkoutForm'),
    mobileBar: document.getElementById('mobileCartBar'),
    barCount: document.getElementById('barCount'),
    barTotal: document.getElementById('barTotal'),
    cartBackdrop: document.getElementById('cartBackdrop'),
    cartCloseMobile: document.getElementById('cartCloseMobile'),
    orderTypeToggle: document.getElementById('orderTypeToggle'),
    deliveryOnlyFields: document.getElementById('deliveryOnlyFields'),
    pickupInfo: document.getElementById('pickupInfo'),
    paymentOptions: document.getElementById('paymentOptions'),
    paymentExtra: document.getElementById('paymentExtra'),
    confirmBtn: document.getElementById('confirmBtn'),
    confirmLabel: document.getElementById('confirmLabel'),
    confirmTotal: document.getElementById('confirmTotal'),
    // Pantalla de exito tras enviar el pedido
    success: document.getElementById('deliverySuccess'),
    successOrder: document.getElementById('successOrder'),
    successOrderNum: document.getElementById('successOrderNum'),
    successText: document.getElementById('successText'),
    successWa: document.getElementById('successWa'),
    successAgain: document.getElementById('successAgain'),
    cartDeliveryRow: null, // se setea dinamicamente
};

// Evita el doble/triple envio del pedido mientras uno esta en curso.
let isSubmitting = false;

// Actualiza el texto y total del boton de confirmar pedido
function updateConfirmButton() {
    if (!dom.confirmBtn) return;
    const subtotal = [...cart.values()].reduce((s, { item, qty }) => s + item.price * qty, 0);
    const selected = document.querySelector('input[name="metodo_pago"]:checked');
    const method = selected ? selected.value : 'efectivo';
    if (dom.confirmLabel) {
        dom.confirmLabel.textContent = method === 'pse' ? 'Pagar con Wompi' : 'Confirmar pedido';
    }
    if (dom.confirmTotal) {
        dom.confirmTotal.textContent = formatCOP(subtotal);
    }
}

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

function openCartMobile() {
    if (!isMobile()) return;
    dom.cart.classList.add('open');
    dom.cartBackdrop.classList.add('show');
}
function closeCartMobile() {
    dom.cart.classList.remove('open');
    dom.cartBackdrop.classList.remove('show');
}

// Buscador + filtros por antojo, reutilizable para la carta de la landing y el
// menú del domicilio. Trabaja sobre el DOM ya renderizado (no re-renderiza):
// oculta/muestra platos y categorías con la clase `filtered-out`.
function setupMenuFilter(cfg) {
    const listRoot = document.getElementById(cfg.listRootId);
    if (!listRoot) return;

    // Evita duplicar la barra si el menú se vuelve a renderizar.
    const oldBar = document.getElementById(cfg.barId);
    if (oldBar) oldBar.remove();
    const oldNR = document.getElementById(cfg.barId + '-nr');
    if (oldNR) oldNR.remove();

    const bar = document.createElement('div');
    bar.id = cfg.barId;
    bar.className = 'menu-filter ' + cfg.barClass;
    bar.innerHTML = `
        <div class="menu-search">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input type="search" class="menu-search-input" placeholder="¿Qué se te antoja?" aria-label="Buscar plato">
            <button type="button" class="menu-search-clear" hidden aria-label="Limpiar búsqueda"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="menu-antojos">
            ${ANTOJOS.map((a, i) => `
                <button type="button" class="antojo-chip${i === 0 ? ' active' : ''}" data-antojo="${a.key}">
                    ${a.icon ? `<i class="fa-solid ${a.icon}" aria-hidden="true"></i> ` : ''}${a.label}
                </button>
            `).join('')}
        </div>`;

    const noResults = document.createElement('p');
    noResults.id = cfg.barId + '-nr';
    noResults.className = 'menu-noresults';
    noResults.hidden = true;
    noResults.innerHTML = `<i class="fa-solid fa-utensils" aria-hidden="true"></i> No encontramos platos con ese nombre. Prueba con otra palabra.`;

    cfg.mount(bar, noResults, listRoot);

    const input = bar.querySelector('.menu-search-input');
    const clearBtn = bar.querySelector('.menu-search-clear');
    const chipsWrap = bar.querySelector('.menu-antojos');
    let query = '';
    let antojo = 'todos';

    // Respeta a quien prefiere menos movimiento (accesibilidad).
    const reduceMotion = () => window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Animación sutil al cambiar de filtro: los platos visibles entran con un
    // fade + leve subida, escalonados. Web Animations API (re-disparable en cada cambio).
    const animateVisible = () => {
        if (typeof listRoot.animate !== 'function' || reduceMotion()) return;
        let items = [...listRoot.querySelectorAll(cfg.itemSel)]
            .filter(el => !el.classList.contains('filtered-out'));
        if (cfg.accordion) {
            items = items.filter(el => {
                const c = el.closest(cfg.catSel);
                return c && c.classList.contains('is-open');
            });
        }
        items.forEach((el, i) => {
            el.animate(
                [
                    { opacity: 0, transform: 'translateY(9px) scale(.985)' },
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
                { duration: 320, delay: Math.min(i * 22, 240), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }
            );
        });
    };

    const apply = (animate) => {
        const q = normalizeText(query);
        const pred = (ANTOJOS.find(a => a.key === antojo) || ANTOJOS[0]).match;
        let anyVisible = false;
        listRoot.querySelectorAll(cfg.catSel).forEach(catEl => {
            let catVisible = false;
            catEl.querySelectorAll(cfg.itemSel).forEach(itemEl => {
                const okQ = !q || (itemEl.dataset.search || '').includes(q);
                const okA = pred(itemEl.dataset);
                const show = okQ && okA;
                itemEl.classList.toggle('filtered-out', !show);
                if (show) { catVisible = true; anyVisible = true; }
            });
            catEl.classList.toggle('filtered-out', !catVisible);
        });
        // En modo acordeón: al buscar/filtrar, abre las categorías con resultados
        // para que se vean; al limpiar el filtro, vuelve a colapsarlas.
        if (cfg.accordion) {
            const filtering = q !== '' || antojo !== ANTOJOS[0].key;
            listRoot.querySelectorAll(cfg.catSel).forEach(catEl => {
                const abrir = filtering && !catEl.classList.contains('filtered-out');
                catEl.classList.toggle('is-open', abrir);
                const accBtn = catEl.querySelector('[data-acc-toggle]');
                if (accBtn) accBtn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
            });
        }
        noResults.hidden = anyVisible;
        clearBtn.hidden = !query;
        if (animate) animateVisible();
    };

    input.addEventListener('input', () => { query = input.value.trim(); apply(false); });
    clearBtn.addEventListener('click', () => { input.value = ''; query = ''; input.focus(); apply(false); });
    chipsWrap.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-antojo]');
        if (!chip) return;
        antojo = chip.getAttribute('data-antojo');
        chipsWrap.querySelectorAll('.antojo-chip').forEach(c => c.classList.toggle('active', c === chip));
        // Rebote sutil del chip al seleccionarlo
        if (typeof chip.animate === 'function' && !reduceMotion()) {
            chip.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }],
                { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1.4)' });
        }
        apply(true);
    });
}

function renderMenu() {
    if (!dom.menu) return;
    const cats = orderedCategories();
    const categories = cats.map(cat => `
        <div class="menu-category" id="dcat-${cat.id}" data-cat="${cat.id}">
            <h3><i class="fa-solid ${cat.icon} menu-cat-emoji" aria-hidden="true"></i> ${cat.name}</h3>
            <div class="menu-cat-items">
                ${cat.items.map(item => {
                    const pop = POPULAR.has(item.id);
                    return `
                    <div class="menu-item${pop ? ' is-popular' : ''}" data-item-id="${item.id}" data-cat="${cat.id}" data-price="${item.price}" data-popular="${pop ? '1' : '0'}" data-search="${normalizeText(item.name + ' ' + cat.name)}">
                        ${itemThumb({ ...item, icon: iconFor(item, cat) }, 'menu-item-thumb')}
                        <div class="menu-item-info">
                            <h4>${item.name}</h4>
                            <span class="menu-item-price">${formatCOP(item.price)}</span>
                        </div>
                        <div class="menu-item-add" data-add-slot="${item.id}"></div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `).join('');
    dom.menu.innerHTML = categories;
    setupMenuFilter({
        listRootId: 'deliveryMenu',
        barId: 'deliveryFilter',
        barClass: 'in-delivery',
        catSel: '.menu-category',
        itemSel: '.menu-item',
        mount: (bar, noResults, listRoot) => {
            listRoot.insertBefore(bar, listRoot.firstChild);
            listRoot.appendChild(noResults);
        },
    });
    refreshAddButtons();
}

// Sección "Menú" de la landing: ya no pinta la carta completa. La estrategia es
// antojar con la vitrina de "más pedidos" e invitar a abrir la carta dentro del
// flujo de pedido (modal de domicilios), donde además se puede agregar al carrito.
function renderFullMenu() {
    const invite = document.getElementById('menuInvite');
    if (!invite) return;
    const oldStrip = document.getElementById('fullMenuPopular');
    if (oldStrip) oldStrip.remove();
    invite.insertAdjacentHTML('beforebegin', popularStripHTML());
}

// HTML de la vitrina "Los más pedidos del Mico": tarjetas horizontales con los
// platos estrella (POPULAR). Cada tarjeta tiene un hueco de foto: si el item trae
// `img` se muestra la foto; si no, un marcador ("Foto") a la espera de las imágenes.
// Al tocar una tarjeta se abre el domicilio (el enlace [data-open-delivery] global).
function popularStripHTML() {
    const items = [...POPULAR].map(id => MENU_INDEX.get(id)).filter(Boolean);
    const cards = items.map(it => `
        <button type="button" class="fmp-card" data-open-delivery aria-label="Pedir ${it.name}">
            <span class="fmp-photo">
                <span class="fmp-flame"><i class="fa-solid fa-fire" aria-hidden="true"></i></span>
                ${it.img
                    ? `<img src="${it.img}" alt="${it.name}" loading="lazy">`
                    : `<i class="fa-solid fa-image fmp-ph-ic" aria-hidden="true"></i><span class="fmp-ph-txt">Foto</span>`}
            </span>
            <span class="fmp-body">
                <span class="fmp-name">${it.name}</span>
                <span class="fmp-price">${formatCOP(it.price)}</span>
            </span>
        </button>`).join('');
    return `
        <div class="fmp-band" id="fullMenuPopular">
            <div class="fmp-lead">
                <h3>Los más pedidos del Mico</h3>
                <span class="fmp-hint">desliza <i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i></span>
            </div>
            <div class="fmp-rail">${cards}</div>
        </div>`;
}

function refreshAddButtons() {
    document.querySelectorAll('[data-add-slot]').forEach(slot => {
        const id = slot.getAttribute('data-add-slot');
        const entry = cart.get(id);
        if (!entry) {
            slot.innerHTML = `<button class="menu-add-btn" data-add="${id}" aria-label="Agregar"><i class="fa-solid fa-plus"></i></button>`;
        } else {
            slot.innerHTML = `
                <div class="menu-qty">
                    <button data-dec="${id}">−</button>
                    <span>${entry.qty}</span>
                    <button data-inc="${id}">+</button>
                </div>
            `;
        }
    });
}

function getItemById(id) {
    return MENU_INDEX.get(id) || null;
}

// Avatar del plato: la carta no tiene foto por plato, así que usamos un icono
// de Font Awesome según el tipo de plato. Si en el futuro trae `img`, va la foto.
function itemThumb(item, cls) {
    if (item.img) {
        return `<img src="${item.img}" alt="${item.name}" class="${cls}" loading="lazy">`;
    }
    return `<span class="${cls} thumb-icon" aria-hidden="true"><i class="fa-solid ${item.icon || 'fa-utensils'}"></i></span>`;
}

function changeQty(id, delta) {
    const entry = cart.get(id);
    if (entry) {
        entry.qty += delta;
        if (entry.qty <= 0) cart.delete(id);
    } else if (delta > 0) {
        const item = getItemById(id);
        if (item) cart.set(id, { item, qty: 1 });
    }
    refreshAddButtons();
    renderCart();
    updateFab();
}

function renderCart() {
    const totalQty = [...cart.values()].reduce((s, e) => s + e.qty, 0);
    const subtotal = [...cart.values()].reduce((s, { item, qty }) => s + item.price * qty, 0);
    const total = subtotal; // El domicilio se coordina con la sede segun distancia

    if (cart.size === 0) {
        dom.items.innerHTML = `
            <div class="cart-empty">
                <i class="fa-solid fa-utensils"></i>
                <p>Tu pedido está vacío</p>
                <small>Selecciona platos del menú para empezar</small>
            </div>`;
        dom.totals.hidden = true;
    } else {
        dom.totals.hidden = false;
        dom.items.innerHTML = [...cart.values()].map(({ item, qty }) => `
            <div class="cart-item">
                ${itemThumb(item, 'cart-item-img')}
                <div class="cart-item-body">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatCOP(item.price)} <span>c/u</span></div>
                    <div class="cart-item-actions">
                        <button class="cart-qty-btn" data-dec="${item.id}" aria-label="Quitar"><i class="fa-solid fa-minus"></i></button>
                        <span class="cart-item-qty">${qty}</span>
                        <button class="cart-qty-btn" data-inc="${item.id}" aria-label="Agregar"><i class="fa-solid fa-plus"></i></button>
                        <span class="cart-item-subtotal">${formatCOP(item.price * qty)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        dom.subtotal.textContent = formatCOP(subtotal);
        dom.delivery.textContent = orderType === 'pickup' ? 'Gratis (recoger)' : 'Se cuadra con el domiciliario';
        dom.delivery.parentElement.querySelector('span').textContent = orderType === 'pickup' ? 'Recoger en sede' : 'Domicilio';
        dom.total.textContent = formatCOP(total);
    }

    // Barra sticky mobile
    if (totalQty > 0 && dom.modal.classList.contains('open')) {
        dom.mobileBar.hidden = false;
        dom.mobileBar.classList.add('show');
        dom.barCount.textContent = totalQty;
        dom.barTotal.textContent = formatCOP(total);
    } else {
        dom.mobileBar.classList.remove('show');
        dom.mobileBar.hidden = true;
        if (totalQty === 0) closeCartMobile();
    }
}

function updateFab() {
    const totalQty = [...cart.values()].reduce((s, e) => s + e.qty, 0);
    if (totalQty > 0) {
        dom.fabCount.hidden = false;
        dom.fabCount.textContent = totalQty;
    } else {
        dom.fabCount.hidden = true;
    }
}

// ============= MICRO-ANIMACION "AGREGAR AL CARRITO" =============
// Al sumar un plato, un clon de su icono "vuela" en arco hasta el carrito y el
// contador rebota. El destino depende del contexto: en mobile la barra sticky
// inferior, en PC el encabezado del carrito lateral.
function cartAnchors() {
    if (isMobile()) {
        if (dom.mobileBar && dom.mobileBar.classList.contains('show')) {
            const r = dom.mobileBar.getBoundingClientRect();
            const h = r.height || 52;
            // Punto de reposo de la barra (fixed bottom:16px), estable aunque
            // esté animando su entrada (slideUpBar) en el primer plato.
            return {
                point: { x: window.innerWidth / 2, y: window.innerHeight - 16 - h / 2 },
                pulse: dom.mobileBar.querySelector('.bar-count') || dom.mobileBar,
            };
        }
        return null; // aún no hay nada visible a donde volar
    }
    const head = document.querySelector('#deliveryCart .cart-header');
    if (head) return { fly: head, pulse: head.querySelector('i') || head };
    return { fly: dom.fab, pulse: dom.fabCount || dom.fab };
}

function pulseEl(el) {
    if (!el) return;
    el.classList.remove('cart-bump');
    void el.offsetWidth; // reinicia la animacion
    el.classList.add('cart-bump');
    el.addEventListener('animationend', () => el.classList.remove('cart-bump'), { once: true });
}

function flyToCart(sourceEl, dest, onArrive) {
    const s = sourceEl.getBoundingClientRect();
    if (!s.width || !dest) { if (onArrive) onArrive(); return; }
    const clone = sourceEl.cloneNode(true);
    clone.classList.add('fly-clone');
    Object.assign(clone.style, {
        position: 'fixed', left: s.left + 'px', top: s.top + 'px',
        width: s.width + 'px', height: s.height + 'px', margin: '0',
        borderRadius: '50%', zIndex: '99999', pointerEvents: 'none',
        transition: 'transform 0.6s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.55s ease-in',
        willChange: 'transform, opacity',
    });
    document.body.appendChild(clone);
    const dx = dest.x - (s.left + s.width / 2);
    const dy = dest.y - (s.top + s.height / 2);
    requestAnimationFrame(() => {
        clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
        clone.style.opacity = '0.2';
    });
    let done = false;
    const finish = () => { if (done) return; done = true; clone.remove(); if (onArrive) onArrive(); };
    clone.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 780); // failsafe por si no dispara transitionend
}

// Dispara la animacion de agregado desde la tarjeta del plato (itemEl) al carrito.
function animateAdd(itemEl) {
    const anchors = cartAnchors();
    if (!anchors) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const thumb = itemEl ? itemEl.querySelector('.menu-item-thumb, .thumb-icon') : null;
    if (thumb && !reduce) {
        const dest = anchors.point || (() => {
            const r = anchors.fly.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })();
        flyToCart(thumb, dest, () => pulseEl(anchors.pulse));
    } else {
        pulseEl(anchors.pulse);
    }
}

function openDelivery() {
    dom.modal.classList.add('open');
    dom.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderCart();
}
function closeDelivery() {
    dom.modal.classList.remove('open');
    dom.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    showMenuView();
    closeCartMobile();
    dom.mobileBar.classList.remove('show');
    dom.mobileBar.hidden = true;
}
function showCheckoutView() {
    if (cart.size === 0) return;
    dom.body.style.display = 'none';
    dom.checkout.hidden = false;
    closeCartMobile();
    dom.mobileBar.classList.remove('show');
    renderCheckoutSummary();
    applyOrderTypeToCheckout();
    updateConfirmButton();
    if (orderType === 'delivery') initMapPicker();
}

function applyOrderTypeToCheckout() {
    const addressInput = document.getElementById('addressInput');
    if (orderType === 'pickup') {
        dom.deliveryOnlyFields.hidden = true;
        dom.pickupInfo.hidden = false;
        if (addressInput) addressInput.required = false;
    } else {
        dom.deliveryOnlyFields.hidden = false;
        dom.pickupInfo.hidden = true;
        if (addressInput) addressInput.required = true;
    }
}

function setOrderType(type) {
    orderType = type;
    document.querySelectorAll('.order-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-order-type') === type);
    });
    renderCart();
    applyOrderTypeToCheckout();
}

// ============= MAP PICKER (Leaflet + Nominatim) =============
let leafletMap = null;
let mapMarker = null;
let accuracyCircle = null;
let addressDebounce = null;
let leafletPromise = null;
const VILLAVO_CENTER = [4.142, -73.626];

// Carga Leaflet on-demand (solo cuando se abre el checkout)
// Ahorra ~40KB en el initial load del sitio
function loadLeaflet() {
    if (typeof L !== 'undefined') return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return leafletPromise;
}

// Dibuja un círculo con el margen de error del GPS, para que el cliente vea
// qué tan precisa es su ubicación y ajuste el pin si hace falta.
function drawAccuracy(lat, lng, accuracy) {
    if (!leafletMap || !accuracy) return;
    if (accuracyCircle) leafletMap.removeLayer(accuracyCircle);
    accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#FFFFFF',
        fillOpacity: 0.15,
    }).addTo(leafletMap);
}

async function initMapPicker() {
    try { await loadLeaflet(); } catch (e) { console.warn('Leaflet no cargo', e); return; }
    if (typeof L === 'undefined') return;
    const container = document.getElementById('mapContainer');
    if (!container) return;

    if (!leafletMap) {
        leafletMap = L.map(container, {
            center: VILLAVO_CENTER,
            zoom: 13,
            scrollWheelZoom: false,
        });
        // Capa base: imágenes satelitales de Esri (sin API key).
        // maxNativeZoom evita los recuadros grises "Map data not yet available":
        // si no hay foto a ese zoom, Leaflet escala la última disponible en vez de pedir tiles vacíos.
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            maxNativeZoom: 17,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        }).addTo(leafletMap);
        // Capas de referencia transparentes encima del satélite: calles y lugares.
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            maxNativeZoom: 18,
        }).addTo(leafletMap);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            maxNativeZoom: 18,
        }).addTo(leafletMap);

        const DefaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        leafletMap.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng, true));

        const locateBtn = document.getElementById('btnLocate');
        if (locateBtn) locateBtn.addEventListener('click', useMyLocation);

        // Forward geocoding: al escribir la direccion, buscar en mapa
        const input = document.getElementById('addressInput');
        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(addressDebounce);
                const val = input.value.trim();
                if (val.length < 5) return;
                addressDebounce = setTimeout(() => forwardLookup(val), 700);
            });
            input.addEventListener('blur', () => {
                const val = input.value.trim();
                if (val.length >= 5 && !pickedLocation) forwardLookup(val);
            });
        }
    }

    setTimeout(() => leafletMap.invalidateSize(), 100);
}

function setMarker(lat, lng, reverseGeocode = false) {
    pickedLocation = { lat, lng };
    // Si el cliente movió el pin a mano, el círculo de precisión del GPS deja de aplicar.
    if (reverseGeocode && accuracyCircle) {
        leafletMap.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
    if (!mapMarker) {
        mapMarker = L.marker([lat, lng], { draggable: true }).addTo(leafletMap);
        mapMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            setMarker(pos.lat, pos.lng, true);
        });
    } else {
        mapMarker.setLatLng([lat, lng]);
    }
    leafletMap.setView([lat, lng], Math.max(leafletMap.getZoom(), 15));
    updateCoordsDisplay();
    if (reverseGeocode) reverseLookup(lat, lng);
}

function updateCoordsDisplay(status = null, pinned = false) {
    const el = document.getElementById('mapCoords');
    if (!el) return;
    if (status) {
        el.textContent = status;
        el.classList.toggle('has-pin', pinned);
        return;
    }
    if (!pickedLocation) return;
    el.textContent = `Ubicación marcada: ${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)}`;
    el.classList.add('has-pin');
}

async function reverseLookup(lat, lng) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es&zoom=18`);
        const data = await r.json();
        const input = document.getElementById('addressInput');
        if (input && data.display_name && !input.value.trim()) {
            input.value = data.display_name;
        }
    } catch (err) {
        console.warn('Reverse geocoding falló', err);
    }
}

async function forwardLookup(address) {
    updateCoordsDisplay('Buscando dirección en el mapa...');
    try {
        const q = encodeURIComponent(address + ', Villavicencio, Meta, Colombia');
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=co&limit=1&addressdetails=1`);
        const data = await r.json();
        if (!data || data.length === 0) {
            updateCoordsDisplay('No se encontró la dirección. Toca el mapa para fijar tu ubicación.');
            return;
        }
        const place = data[0];
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        setMarker(lat, lng, false);
    } catch (err) {
        console.warn('Forward geocoding falló', err);
        updateCoordsDisplay('No se pudo buscar la dirección. Toca el mapa para fijar tu ubicación.');
    }
}

function useMyLocation() {
    const btn = document.getElementById('btnLocate');
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización.');
        return;
    }
    const resetBtn = () => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Usar mi ubicación';
    };
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detectando...';
    updateCoordsDisplay('Buscando tu ubicación… espera unos segundos sin cerrar.');

    // El GPS del celular empieza con una lectura tosca (basada en red) y se va
    // afinando. En vez de tomar la primera, OBSERVAMOS hasta 9 s y nos quedamos
    // con la lectura más precisa (la de menor margen de error).
    let best = null;          // { lat, lng, acc }
    let watchId = null;
    let done = false;

    const finish = () => {
        if (done) return;
        done = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(maxWait);
        resetBtn();
        if (!best) {
            updateCoordsDisplay('No pudimos obtener tu ubicación. Tócala manualmente en el mapa.');
            return;
        }
        // Una sola búsqueda de dirección, con la mejor lectura conseguida.
        reverseLookup(best.lat, best.lng);
        if (best.acc > 150) {
            // Precisión pobre: típico de computador sin GPS. Pedimos ajuste manual.
            updateCoordsDisplay(`Ubicación aproximada (±${Math.round(best.acc)} m). Arrastra el pin hasta tu casa, o usa el celular con el GPS activado para más precisión.`, true);
        } else {
            updateCoordsDisplay(`Ubicación detectada (±${Math.round(best.acc)} m). Si no quedó exacta, arrastra el pin.`, true);
        }
    };

    const maxWait = setTimeout(finish, 9000);

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
            if (!best || acc < best.acc) {
                best = { lat, lng, acc };
                setMarker(lat, lng, false);   // sin reverse-geocoding en cada paso
                drawAccuracy(lat, lng, acc);
                const zoom = acc <= 50 ? 18 : acc <= 200 ? 16 : 15;
                leafletMap.setView([lat, lng], zoom);
                updateCoordsDisplay(`Afinando ubicación… ±${Math.round(acc)} m`);
            }
            // Ya es suficientemente precisa: terminamos antes de los 9 s.
            if (acc <= 30) finish();
        },
        (err) => {
            if (done) return;
            done = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            clearTimeout(maxWait);
            resetBtn();
            const msg = err.code === err.PERMISSION_DENIED
                ? '¿Diste permiso? Activa la ubicación en tu navegador.'
                : 'No pudimos obtener tu ubicación. Tócala manualmente en el mapa.';
            alert(msg);
            updateCoordsDisplay('No pudimos obtener tu ubicación. Tócala manualmente en el mapa.');
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
}
function showMenuView() {
    dom.body.style.display = '';
    dom.checkout.hidden = true;
    if (dom.success) dom.success.hidden = true;
    renderCart();
}

function renderCheckoutSummary() {
    const itemLines = [...cart.values()].map(({ item, qty }) => `
        <div class="summary-item">
            ${itemThumb(item, 'summary-thumb')}
            <div class="summary-item-info">
                <div class="summary-item-name">${item.name}</div>
                <div class="summary-item-meta">${qty} × ${formatCOP(item.price)}</div>
            </div>
            <strong class="summary-item-price">${formatCOP(item.price * qty)}</strong>
        </div>
    `).join('');
    const subtotal = [...cart.values()].reduce((s, { item, qty }) => s + item.price * qty, 0);
    const total = subtotal;
    const feeLine = orderType === 'pickup'
        ? `<div class="summary-line"><span><i class="fa-solid fa-store"></i> Recoger en sede</span><strong style="color: var(--color-green);">Gratis</strong></div>`
        : `<div class="summary-line"><span><i class="fa-solid fa-motorcycle"></i> Costo de domicilio</span><strong class="fee-coord">Se cuadra con el domiciliario</strong></div>`;
    const totalNote = orderType === 'pickup'
        ? '<p class="total-note">Precio final. No hay costo de domicilio.</p>'
        : '<p class="total-note"><i class="fa-solid fa-circle-info"></i> El total corresponde solo a los productos. Nosotros te gestionamos el domiciliario y el valor del domicilio lo cuadras con él, por aparte, cuando te lleve el pedido.</p>';
    dom.checkoutSummary.innerHTML = `
        <div class="summary-items">${itemLines}</div>
        <div class="summary-totals">
            <div class="summary-line"><span>Subtotal productos</span><strong>${formatCOP(subtotal)}</strong></div>
            ${feeLine}
        </div>
        ${totalNote}
    `;
    dom.checkoutTotal.textContent = formatCOP(total);
}

function buildWhatsappMessage(data) {
    const lines = [...cart.values()].map(({ item, qty }) =>
        `• ${qty}× ${item.name} — ${formatCOP(item.price * qty)}`
    ).join('\n');
    const subtotal = [...cart.values()].reduce((s, { item, qty }) => s + item.price * qty, 0);
    const total = subtotal;

    const isPickup = orderType === 'pickup';
    const mapsLink = pickedLocation
        ? `https://www.google.com/maps?q=${pickedLocation.lat},${pickedLocation.lng}`
        : null;

    const header = isPickup
        ? `*🏪 Nuevo pedido para RECOGER — ${DELIVERY_CONFIG.branchName}*`
        : `*🛵 Nuevo pedido a DOMICILIO — ${DELIVERY_CONFIG.branchName}*`;

    const feeLine = isPickup
        ? `*Domicilio:* No aplica (recoge en sede)`
        : `*Domicilio:* Por coordinar según ubicación`;

    const customerInfo = isPickup
        ? [
            '*Datos del cliente:*',
            `👤 ${data.nombre}`,
            `📞 ${data.telefono}`,
            `🏪 Recoge en: Sede Vanguardia (Km 1 vía aeropuerto)`,
          ]
        : [
            '*Datos de entrega:*',
            `👤 ${data.nombre}`,
            `📞 ${data.telefono}`,
            `📍 ${data.direccion}`,
            mapsLink ? `🗺️ Ubicación en mapa: ${mapsLink}` : null,
          ];

    const totalLabel = isPickup ? '*Total a pagar:*' : '*Subtotal productos:*';

    const paymentMethod = data.metodo_pago === 'pse' ? 'Wompi (PSE, tarjeta o Nequi)' : 'Efectivo';
    const paymentLines = ['', '*Método de pago:*', `💳 ${paymentMethod}`];
    if (data.metodo_pago === 'efectivo' && data.paga_con && data.paga_con.trim()) {
        paymentLines.push(`💵 Paga con: ${data.paga_con.trim()}`);
    }
    if (data.metodo_pago === 'pse') {
        paymentLines.push('🏦 _(pagado en línea por Wompi)_');
    }

    return [
        header,
        '',
        '*Pedido:*',
        lines,
        '',
        feeLine,
        `${totalLabel} ${formatCOP(total)}`,
        isPickup ? null : '_(el total es solo de los productos; el valor del domicilio se cuadra por aparte con el domiciliario en la entrega)_',
        '',
        ...customerInfo,
        data.notas ? `📝 ${data.notas}` : null,
        ...paymentLines,
    ].filter(Boolean).join('\n');
}

// Envia el pedido al backend (Django) para que la mesera lo vea en el panel.
// Devuelve SIEMPRE un objeto: { ok, id, wompi_checkout_url?, status?, error? }.
//   ok=true  -> el pedido quedo registrado en el panel (id disponible).
//   ok=false -> fallo de red o el backend lo rechazo (4xx/5xx); WhatsApp sigue de respaldo.
function savePedido(data) {
    const items = [...cart.values()].map(({ item, qty }) => ({
        id: item.id,
        name: item.name,
        qty,
        price: item.price,
    }));
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);

    const payload = {
        nombre: data.nombre || '',
        telefono: data.telefono || '',
        tipo: orderType, // 'delivery' | 'pickup'
        direccion: data.direccion || '',
        notas: data.notas || '',
        lat: pickedLocation ? pickedLocation.lat : null,
        lng: pickedLocation ? pickedLocation.lng : null,
        items,
        subtotal,
        metodo_pago: data.metodo_pago || 'efectivo',
        paga_con: data.paga_con || '',
    };

    // keepalive permite que el envio termine aunque la pestaña navegue a WhatsApp.
    return fetch('/api/pedidos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
    })
    .then(async (r) => {
        let json = null;
        try { json = await r.json(); } catch (_) { json = null; }
        if (!r.ok) {
            console.warn('El backend rechazo el pedido:', r.status, json);
            return { ok: false, status: r.status, error: (json && json.error) || `http_${r.status}` };
        }
        // El backend responde { ok: true, id, wompi_checkout_url? }.
        return { ok: true, ...(json || {}) };
    })
    .catch((err) => {
        console.warn('No se pudo registrar el pedido en el panel:', err);
        return { ok: false, error: 'network' };
    });
}

// Activa/desactiva el estado "enviando" del boton de confirmar (bloquea el doble envio).
function setConfirmLoading(on) {
    if (!dom.confirmBtn) return;
    dom.confirmBtn.disabled = on;
    dom.confirmBtn.classList.toggle('loading', on);
    const spinner = dom.confirmBtn.querySelector('.confirm-spinner');
    const arrow = dom.confirmBtn.querySelector('.confirm-arrow');
    if (spinner) spinner.hidden = !on;
    if (arrow) arrow.hidden = on;
}

// Muestra la pantalla de exito tras enviar el pedido.
function showSuccessView({ waUrl, orderId, popupBlocked }) {
    if (!dom.success) return;
    dom.body.style.display = 'none';
    dom.checkout.hidden = true;
    dom.success.hidden = false;

    if (dom.successOrder && dom.successOrderNum) {
        if (orderId) {
            dom.successOrderNum.textContent = `#${orderId}`;
            dom.successOrder.hidden = false;
        } else {
            dom.successOrder.hidden = true; // fallo el guardado: WhatsApp sigue siendo el respaldo
        }
    }
    if (dom.successWa && waUrl) dom.successWa.href = waUrl;
    if (dom.successText) {
        dom.successText.innerHTML = popupBlocked
            ? 'Tu pedido está listo. Toca <strong>Abrir WhatsApp</strong> para enviarlo a la sede y confirmarlo.'
            : 'Terminamos de confirmar tu pedido por <strong>WhatsApp</strong> con la sede. Si no se abrió solo, toca el botón de abajo.';
    }
    dom.success.scrollTop = 0;

    // El pedido ya se envió: vaciamos el carrito para no reenviarlo si el cliente
    // cierra el modal con la X en vez de tocar "Hacer otro pedido".
    cart.clear();
    refreshAddButtons();
    updateFab();
}

// Reinicia el flujo para un nuevo pedido (carrito ya vaciado; limpia formulario y ubicación).
function resetOrderFlow() {
    cart.clear();
    if (dom.form) dom.form.reset();
    pickedLocation = null;
    setConfirmLoading(false);
    refreshAddButtons();
    renderCart();
    updateFab();
    showMenuView(); // oculta la pantalla de exito y vuelve al menu
}

// ----- EVENTS -----
if (dom.fab) {
    renderMenu();
    dom.fab.addEventListener('click', openDelivery);
    document.querySelectorAll('[data-close-delivery]').forEach(el =>
        el.addEventListener('click', closeDelivery)
    );

    // Delegacion de eventos para botones +/-
    // El itemEl se captura ANTES de changeQty porque refreshAddButtons reemplaza
    // el boton "+" y lo desprende del DOM (perderíamos la tarjeta de origen).
    dom.modal.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        const inc = e.target.closest('[data-inc]');
        const dec = e.target.closest('[data-dec]');
        if (add) {
            const itemEl = add.closest('.menu-item');
            changeQty(add.getAttribute('data-add'), 1);
            animateAdd(itemEl);
        }
        if (inc) {
            const itemEl = inc.closest('.menu-item');
            changeQty(inc.getAttribute('data-inc'), 1);
            animateAdd(itemEl);
        }
        if (dec) changeQty(dec.getAttribute('data-dec'), -1);
    });

    dom.checkoutBtn.addEventListener('click', showCheckoutView);
    dom.checkoutBack.addEventListener('click', showMenuView);

    // Mobile: abrir/cerrar carrito bottom sheet
    dom.mobileBar.addEventListener('click', openCartMobile);
    dom.cartBackdrop.addEventListener('click', closeCartMobile);
    dom.cartCloseMobile.addEventListener('click', closeCartMobile);

    // Toggle tipo de pedido (domicilio / recoger)
    if (dom.orderTypeToggle) {
        dom.orderTypeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-order-type]');
            if (btn) setOrderType(btn.getAttribute('data-order-type'));
        });
    }

    // Metodo de pago: estado visual + mostrar campo "paga con" solo en efectivo
    if (dom.paymentOptions) {
        const paymentInfo = document.getElementById('paymentInfo');
        const paymentInfoText = document.getElementById('paymentInfoText');
        const updatePaymentVisuals = () => {
            const checked = dom.paymentOptions.querySelector('input[name="metodo_pago"]:checked');
            const value = checked ? checked.value : 'efectivo';
            dom.paymentOptions.querySelectorAll('.payment-option').forEach(opt => {
                opt.classList.toggle('active', opt.querySelector('input').value === value);
            });
            if (dom.paymentExtra) dom.paymentExtra.style.display = value === 'efectivo' ? '' : 'none';
            if (paymentInfo && paymentInfoText) {
                if (value === 'pse') {
                    paymentInfoText.textContent = 'Te redirigiremos al portal seguro de Wompi para que pagues con tu banco favorito.';
                    paymentInfo.hidden = false;
                } else {
                    paymentInfoText.textContent = 'Paga al repartidor cuando llegue tu pedido.';
                    paymentInfo.hidden = false;
                }
            }
            updateConfirmButton();
        };
        dom.paymentOptions.addEventListener('change', updatePaymentVisuals);
        // Llamar una vez al cargar el checkout para mostrar el info correcto
        updatePaymentVisuals();
    }

    dom.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;          // ya hay un envio en curso -> evita duplicados
        isSubmitting = true;
        setConfirmLoading(true);

        const data = Object.fromEntries(new FormData(dom.form));

        // 1) Guardar el pedido en el backend (para que aparezca en el panel de la mesera).
        //    savePedido nunca lanza: devuelve { ok:false } si falla la red o el backend.
        const resp = await savePedido(data);

        // 2a) Pago PSE con Wompi configurado -> redirigir al portal (la pagina navega fuera).
        if (data.metodo_pago === 'pse' && resp && resp.ok && resp.wompi_checkout_url) {
            window.location.href = resp.wompi_checkout_url;
            return; // dejamos el boton en "enviando": la pagina esta navegando a Wompi
        }

        // 2b) Resto de casos -> WhatsApp como canal de confirmacion (respaldo de siempre).
        //     Se abre aunque el guardado en BD falle: el pedido igual llega por WhatsApp.
        const msg = buildWhatsappMessage(data);
        const waUrl = `https://wa.me/${DELIVERY_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
        const win = window.open(waUrl, '_blank'); // null si el navegador bloqueo el popup

        const orderId = resp && resp.ok ? resp.id : null;
        showSuccessView({ waUrl, orderId, popupBlocked: !win });

        setConfirmLoading(false);
        isSubmitting = false;
    });

    // "Hacer otro pedido" desde la pantalla de exito
    if (dom.successAgain) {
        dom.successAgain.addEventListener('click', resetOrderFlow);
    }

    // ESC cierra modal (salvo que el modal legal esté abierto encima)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.querySelector('.legal-modal.open')) return;
        if (dom.modal.classList.contains('open')) closeDelivery();
    });
}

// Carta publica de la landing (seccion "Menu") + botones que abren el domicilio.
// Fuera del guard del FAB para que la seccion se pinte siempre.
renderFullMenu();
document.querySelectorAll('[data-open-delivery]').forEach(btn =>
    btn.addEventListener('click', openDelivery)
);

// ============= MODAL LEGAL (Términos, Condiciones y Privacidad) =============
// Se abre desde el footer, el checkout y la nota de privacidad del mapa.
// Puede abrirse ENCIMA del modal de domicilios, por eso guarda y restaura
// el overflow previo del body en vez de limpiarlo siempre.
const legalModal = document.getElementById('legalModal');
const legalBody = document.getElementById('legalBody');
let legalPrevOverflow = '';

function openLegal(sectionId) {
    if (!legalModal) return;
    legalPrevOverflow = document.body.style.overflow;
    legalModal.classList.add('open');
    legalModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (legalBody) legalBody.scrollTop = 0;
    if (sectionId) {
        const target = document.getElementById(sectionId);
        if (target) {
            requestAnimationFrame(() => {
                target.scrollIntoView({ block: 'start' });
                target.classList.remove('highlight');
                void target.offsetWidth; // reinicia la animación de resaltado
                target.classList.add('highlight');
            });
        }
    }
}
function closeLegal() {
    if (!legalModal) return;
    legalModal.classList.remove('open');
    legalModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = legalPrevOverflow;
}

document.querySelectorAll('[data-open-legal]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        openLegal(el.getAttribute('data-open-legal') || null);
    });
});
document.querySelectorAll('[data-close-legal]').forEach(el =>
    el.addEventListener('click', closeLegal)
);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && legalModal && legalModal.classList.contains('open')) closeLegal();
});

// ============= SCROLL PROGRESS BAR =============
const scrollProgress = document.getElementById('scrollProgress');
let ticking = false;
const updateScrollProgress = () => {
    const h = document.documentElement;
    const scrollTop = h.scrollTop || document.body.scrollTop;
    const scrollHeight = h.scrollHeight - h.clientHeight;
    const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    if (scrollProgress) scrollProgress.style.width = pct + '%';
    ticking = false;
};
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
    }
}, { passive: true });

// ============= HERO PARALLAX =============
const heroSection = document.querySelector('.hero');
const heroVideoEl = document.querySelector('.hero-video');
const heroContent = document.querySelector('.hero-content');
let heroTicking = false;
const updateHeroParallax = () => {
    const scrollY = window.scrollY;
    if (heroSection && scrollY < window.innerHeight) {
        if (heroVideoEl) heroVideoEl.style.transform = `translateY(${scrollY * 0.35}px)`;
        if (heroContent) {
            heroContent.style.transform = `translateY(${scrollY * 0.5}px)`;
            heroContent.style.opacity = Math.max(0, 1 - scrollY / (window.innerHeight * 0.7));
        }
    }
    heroTicking = false;
};
window.addEventListener('scroll', () => {
    if (!heroTicking) {
        requestAnimationFrame(updateHeroParallax);
        heroTicking = true;
    }
}, { passive: true });

// ============= SCROLL REVEAL =============
const revealSelectors = [
    { sel: '.historia-img', cls: 'from-left' },
    { sel: '.historia-text', cls: 'from-right' },
    { sel: '.exp-img', cls: 'from-left' },
    { sel: '.exp-text', cls: 'from-right' },
    { sel: '.carta-header', cls: 'fade-only' },
    { sel: '.sedes-header', cls: 'fade-only' },
    { sel: '.noticias-header', cls: 'fade-only' },
    { sel: '.sede-map-text', cls: 'from-left' },
    { sel: '.sede-map-frame', cls: 'from-right' },
    { sel: '.cta-content', cls: 'scale-up' },
];
revealSelectors.forEach(({ sel, cls }) => {
    document.querySelectorAll(sel).forEach(el => {
        el.classList.add('reveal', cls);
    });
});

// Grids con stagger (cards aparecen una despues de otra)
const staggerGrids = [
    { sel: '.dish', step: 80, max: 5 },
    { sel: '.sede-card', step: 150, max: 3 },
    { sel: '.news-card', step: 130, max: 3 },
    { sel: '.exp-list li', step: 100, max: 4 },
    { sel: '.strip-item', step: 100, max: 4 },
];
staggerGrids.forEach(({ sel, step, max }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
        el.classList.add('reveal');
        el.setAttribute('data-delay', Math.min(i, max) * step);
    });
});

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ============= NAVBAR ACTIVE LINK ON SCROLL =============
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + id);
            });
        }
    });
}, { threshold: 0.4, rootMargin: '-80px 0px -50% 0px' });
sections.forEach(s => sectionObserver.observe(s));
