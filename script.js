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

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// ============= SISTEMA DE DOMICILIOS =============
const DELIVERY_CONFIG = {
    whatsapp: '573208583991',
    branchName: 'Sede Vanguardia',
    // El costo de domicilio se coordina con la sede segun distancia
    // (no se cobra fijo en linea, solo se muestra el subtotal de productos)
    // Menu de muestra. Reemplazar/ampliar con el menu real.
    categories: [
        {
            name: 'Platos Fuertes',
            items: [
                { id: 'mamona', name: 'Mamona al Palo', desc: 'Porción de ternero asado al palo (300g).', price: 42000, img: 'statics/img/comida.jpg' },
                { id: 'bandeja', name: 'Bandeja Llanera', desc: 'Carne, longaniza, yuca, plátano y arepa.', price: 38000, img: 'statics/img/comida2.jpg' },
                { id: 'carne-perra', name: 'Carne a la Perra', desc: 'Asada y enterrada al estilo tradicional.', price: 40000, img: 'statics/img/comida3.jpg' },
            ]
        },
        {
            name: 'Para Compartir',
            items: [
                { id: 'picada', name: 'Picada del Mico (2 personas)', desc: 'Variedad de carnes, longaniza, yuca, plátano y arepa.', price: 75000, img: 'statics/img/comida6.jpg' },
                { id: 'hayacas', name: 'Hayacas Llaneras (unidad)', desc: 'Tradicional masa envuelta en hoja de plátano.', price: 12000, img: 'statics/img/comida5.jpg' },
            ]
        },
        {
            name: 'Bebidas',
            items: [
                { id: 'limonada', name: 'Limonada de panela', desc: 'Jarra (1 litro).', price: 9000, img: 'statics/img/DDD.jpg' },
                { id: 'jugo', name: 'Jugo natural en agua', desc: 'Mora, lulo, mango o maracuyá.', price: 7000, img: 'statics/img/dos.jpg' },
            ]
        },
    ]
};

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
    cartDeliveryRow: null, // se setea dinamicamente
};

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

function renderMenu() {
    if (!dom.menu) return;
    dom.menu.innerHTML = DELIVERY_CONFIG.categories.map(cat => `
        <div class="menu-category">
            <h3>${cat.name}</h3>
            ${cat.items.map(item => `
                <div class="menu-item" data-item-id="${item.id}">
                    <img src="${item.img}" alt="${item.name}" loading="lazy">
                    <div class="menu-item-info">
                        <h4>${item.name}</h4>
                        <p>${item.desc}</p>
                        <span class="menu-item-price">${formatCOP(item.price)}</span>
                    </div>
                    <div class="menu-item-add" data-add-slot="${item.id}"></div>
                </div>
            `).join('')}
        </div>
    `).join('');
    refreshAddButtons();
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
    for (const cat of DELIVERY_CONFIG.categories) {
        const found = cat.items.find(i => i.id === id);
        if (found) return found;
    }
    return null;
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
                <img src="${item.img}" alt="${item.name}" class="cart-item-img" loading="lazy">
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
        dom.delivery.textContent = orderType === 'pickup' ? 'Gratis (recoger)' : 'Según ubicación';
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
const VILLAVO_CENTER = [4.142, -73.626];

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

function initMapPicker() {
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
    renderCart();
}

function renderCheckoutSummary() {
    const itemLines = [...cart.values()].map(({ item, qty }) => `
        <div class="summary-item">
            <img src="${item.img}" alt="${item.name}" class="summary-thumb" loading="lazy">
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
        : `<div class="summary-line"><span><i class="fa-solid fa-motorcycle"></i> Costo de domicilio</span><strong class="fee-coord">Según ubicación</strong></div>`;
    const totalNote = orderType === 'pickup'
        ? '<p class="total-note">Precio final. No hay costo de domicilio.</p>'
        : '<p class="total-note"><i class="fa-solid fa-circle-info"></i> El costo del domicilio se confirma con la sede según tu ubicación.</p>';
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

    const paymentMethod = data.metodo_pago === 'bold' ? 'BOLD (tarjeta / PSE / Nequi)' : 'Efectivo';
    const paymentLines = ['', '*Método de pago:*', `💳 ${paymentMethod}`];
    if (data.metodo_pago === 'efectivo' && data.paga_con && data.paga_con.trim()) {
        paymentLines.push(`💵 Paga con: ${data.paga_con.trim()}`);
    }
    if (data.metodo_pago === 'bold') {
        paymentLines.push('_(la sede te enviará el link de pago)_');
    }

    return [
        header,
        '',
        '*Pedido:*',
        lines,
        '',
        feeLine,
        `${totalLabel} ${formatCOP(total)}`,
        isPickup ? null : '_(el costo del domicilio se suma al total según distancia)_',
        '',
        ...customerInfo,
        data.notas ? `📝 ${data.notas}` : null,
        ...paymentLines,
    ].filter(Boolean).join('\n');
}

// Envia el pedido al backend (Django) para que la mesera lo vea en el panel.
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
    fetch('/api/pedidos/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
    }).catch((err) => console.warn('No se pudo registrar el pedido en el panel:', err));
}

// ----- EVENTS -----
if (dom.fab) {
    renderMenu();
    dom.fab.addEventListener('click', openDelivery);
    document.querySelectorAll('[data-close-delivery]').forEach(el =>
        el.addEventListener('click', closeDelivery)
    );

    // Delegacion de eventos para botones +/-
    dom.modal.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        const inc = e.target.closest('[data-inc]');
        const dec = e.target.closest('[data-dec]');
        if (add) changeQty(add.getAttribute('data-add'), 1);
        if (inc) changeQty(inc.getAttribute('data-inc'), 1);
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
        dom.paymentOptions.addEventListener('change', () => {
            const checked = dom.paymentOptions.querySelector('input[name="metodo_pago"]:checked');
            const value = checked ? checked.value : 'efectivo';
            dom.paymentOptions.querySelectorAll('.payment-option').forEach(opt => {
                opt.classList.toggle('active', opt.querySelector('input').value === value);
            });
            if (dom.paymentExtra) dom.paymentExtra.style.display = value === 'efectivo' ? '' : 'none';
        });
    }

    dom.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(dom.form));

        // 1) Guardar el pedido en el backend (para que aparezca en el panel de la mesera).
        //    Si falla (sin conexión, etc.), igual continuamos a WhatsApp: no bloquea al cliente.
        savePedido(data);

        // 2) Abrir WhatsApp con el resumen, como siempre.
        const msg = buildWhatsappMessage(data);
        const url = `https://wa.me/${DELIVERY_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });

    // ESC cierra modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dom.modal.classList.contains('open')) closeDelivery();
    });
}

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
