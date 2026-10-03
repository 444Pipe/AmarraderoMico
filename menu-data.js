// Carta oficial de El Amarradero del Mico (menú 2026, Sede Vanguardia).
// FUENTE ÚNICA DE LA CARTA: la leen el frontend (script.js, que pinta la
// sección "Menú" de la landing y el menú del domicilio) y el backend
// (orders/catalogo.py, que resuelve los PRECIOS en el servidor: el precio
// que envía el navegador nunca se usa para cobrar).
//
// ⚠️ El contenido después del signo = de la asignación debe ser JSON ESTRICTO
// (comillas dobles, sin comentarios, sin coma final): el backend lo parsea
// con json.loads. Si se rompe el formato, la app deja de aceptar pedidos.
//
// Cada categoría: { id, name, icon (Font Awesome), items }.
// Cada plato: { id, name, price }. Opcional `img` (ruta a una foto), que hoy
// solo usa la vitrina "Los más pedidos" de la carta.
// El ORDEN base de las categorías es el de este arreglo; orderedCategories()
// (script.js) lo reordena según la hora (desayunos en la mañana, etc.).
window.MENU_DATA = [
    {"id":"pa-empezar","name":"Pa' Empezar","icon":"fa-plate-wheat", "items": [
            {"id":"chicharrones","name":"Chicharrones Carnudos","price":25000,"img":"statics/platos/chicharrones.jpg"},
            {"id":"arepa-casa","name":"Arepa de la Casa","price":5000,"img":"statics/platos/arepa-casa.jpg"},
            {"id":"rellena","name":"Rellena","price":15000,"img":"statics/platos/rellena.jpg"},
            {"id":"patacones-hogao","name":"Patacones con Hogao","price":14000},
            {"id":"chunchullitas","name":"Chunchullitas","price":25000},
            {"id":"empanaditas-mamona","name":"Empanaditas de Mamona","price":19000},
            {"id":"chorizo-santarrosano","name":"Chorizo Santarrosano","price":12000},
            {"id":"platano-queso","name":"Plátano con Queso y Bocadillo","price":12000,"img":"statics/platos/platano-queso.jpg"}
    ]},
    {"id":"lo-tipico","name":"Lo Típico","icon":"fa-fire", "items": [
            {"id":"plato-mamona","name":"Plato de Mamona","price":38000,"img":"statics/platos/plato-mamona.jpg"},
            {"id":"carne-cerdo","name":"Carne de Cerdo","price":38000},
            {"id":"carne-mixta","name":"Carne Mixta","price":38000},
            {"id":"chuleta-res","name":"Chuleta de Res","price":45000},
            {"id":"costilla-cerdo-tulio","name":"Costilla de Cerdo — Tulio","price":55000},
            {"id":"palo-costilla-mixto","name":"Palo de Costilla Mixto","price":50000,"img":"statics/platos/palo-costilla-mixto.jpg"},
            {"id":"costilla-res","name":"Costilla de Res","price":65000}
    ]},
    {"id":"pa-compartir","name":"Pa' Compartir","icon":"fa-users", "items": [
            {"id":"picada-3","name":"Picada del Mico (3 pax aprox)","price":90000,"img":"statics/platos/picada-3.jpg"},
            {"id":"picada-4","name":"Picada del Mico (4 pax aprox)","price":110000,"img":"statics/platos/picada-4.jpg"}
    ]},
    {"id":"otras-opciones","name":"Otras Opciones","icon":"fa-utensils", "items": [
            {"id":"hamburguesa-mamona","name":"Hamburguesa de Mamona","price":32000,"img":"statics/platos/hamburguesa-mamona.jpg"},
            {"id":"arroz-vegetariano","name":"Arroz Vegetariano","price":32000},
            {"id":"sudado-cola","name":"Sudado de Cola","price":40000},
            {"id":"arroz-mico","name":"Arroz del Mico","price":40000,"img":"statics/platos/arroz-mico.jpg"},
            {"id":"lengua-salsa","name":"Lengua en Salsa","price":42000},
            {"id":"costillas-bbq","name":"Costillas BBQ","price":35000},
            {"id":"salchipapa","name":"Salchipapa","price":20000}
    ]},
    {"id":"parrilla","name":"Parrilla","icon":"fa-drumstick-bite", "items": [
            {"id":"sobrebarriga","name":"Sobrebarriga a la Parrilla","price":45000},
            {"id":"pechuga-plancha","name":"Pechuga a la Plancha","price":40000},
            {"id":"pechuga-champinones","name":"Pechuga en Salsa de Champiñones","price":50000},
            {"id":"pechuga-hawaiana","name":"Pechuga Hawaiana","price":48000},
            {"id":"lomo-cerdo","name":"Lomo de Cerdo a la Parrilla","price":40000},
            {"id":"punta-anca","name":"Punta de Anca","price":55000,"img":"statics/platos/punta-anca.jpg"},
            {"id":"churrasco","name":"Churrasco","price":48000},
            {"id":"baby-beef","name":"Baby Beef","price":52000}
    ]},
    {"id":"pescados","name":"Pescados","icon":"fa-fish", "items": [
            {"id":"mojarra","name":"Mojarra Frita o en Salsa","price":50000},
            {"id":"trucha-ajillo","name":"Trucha al Ajillo","price":50000},
            {"id":"bagre","name":"Bagre Frito o en Salsa","price":50000},
            {"id":"amarillo-monsenor","name":"Amarillo a la Monseñor","price":60000},
            {"id":"cachama","name":"Cachama de Río","price":55000},
            {"id":"salmon-parrilla","name":"Salmón a la Parrilla","price":55000},
            {"id":"salmon-camaron","name":"Salmón con Camarón","price":65000},
            {"id":"cazuela-mariscos","name":"Cazuela de Mariscos","price":60000}
    ]},
    {"id":"sopitas","name":"Sopitas","icon":"fa-bowl-food", "items": [
            {"id":"sancocho-res","name":"Sancocho de Res Especial","price":20000,"img":"statics/platos/sancocho-res.jpg"},
            {"id":"mondongo","name":"Mondongo","price":25000},
            {"id":"sancocho-gallina","name":"Sancocho de Gallina","price":40000}
    ]},
    {"id":"desayunos","name":"Desayunos","icon":"fa-egg", "items": [
            {"id":"caldo-hueso","name":"Caldo de Hueso","price":15000},
            {"id":"caldo-picado","name":"Caldo de Picado","price":20000},
            {"id":"caldo-pez","name":"Caldo de Pez","price":24000},
            {"id":"huevos-arroz","name":"Huevos con Arroz","price":15000},
            {"id":"huevos-gusto","name":"Huevos al Gusto","price":11000},
            {"id":"huevos-rancheros","name":"Huevos Rancheros","price":15000},
            {"id":"hayaca","name":"Hayaca","price":19000},
            {"id":"omelette","name":"Omelette","price":16000},
            {"id":"calentao-paisa","name":"Calentao Paisa","price":26000},
            {"id":"higado-plancha","name":"Hígado a la Plancha","price":23000},
            {"id":"carne-bisteck","name":"Carne en Bisteck","price":25000},
            {"id":"bisteck-caballo","name":"Bisteck a Caballo","price":28000},
            {"id":"carne-plancha-des","name":"Carne a la Plancha","price":23000}
    ]},
    {"id":"porciones","name":"Porciones","icon":"fa-plate-wheat", "items": [
            {"id":"papa-criolla","name":"Papa Criolla","price":10000},
            {"id":"papa-salada","name":"Papa Salada","price":5000},
            {"id":"papa-francesa","name":"Papa a la Francesa","price":6000},
            {"id":"yuca","name":"Yuca","price":5000},
            {"id":"guacamole","name":"Guacamole","price":6000},
            {"id":"platano-maduro","name":"Plátano Maduro","price":5000}
    ]},
    {"id":"postres","name":"Postres","icon":"fa-ice-cream", "items": [
            {"id":"merengon","name":"Merengón","price":14000},
            {"id":"postre-casa","name":"Postre de la Casa","price":12000},
            {"id":"arroz-leche","name":"Arroz con Leche","price":10000},
            {"id":"paletas-amarelo","name":"Paletas de Amarelo","price":8000},
            {"id":"alfajores","name":"Alfajores (caja x8 und)","price":20000}
    ]},
    {"id":"bebidas","name":"Bebidas","icon":"fa-glass-water", "items": [
            {"id":"sodas","name":"Sodas","price":13000},
            {"id":"jarra-panela","name":"Jarra de Panela y Limón","price":15000},
            {"id":"jarra-citrica","name":"Jarra de Cítrica","price":26000},
            {"id":"citrica-personal","name":"Cítrica Personal","price":9000},
            {"id":"jugos-naturales","name":"Jugos Naturales","price":9000},
            {"id":"jugo-naranja","name":"Jugo de Naranja","price":7000},
            {"id":"limonada-coco","name":"Limonada de Coco","price":14000},
            {"id":"gatorade","name":"Gatorade","price":6000},
            {"id":"agua-botella","name":"Agua en Botella","price":5000},
            {"id":"gaseosa","name":"Gaseosa","price":5000},
            {"id":"gaseosa-15","name":"Gaseosa (1.5 Lt)","price":10000},
            {"id":"jugos-hit","name":"Jugos Hit","price":5000},
            {"id":"agua-h2o","name":"Agua H2O","price":5000}
    ]},
    {"id":"bebidas-calientes","name":"Bebidas Calientes","icon":"fa-mug-hot", "items": [
            {"id":"tinto","name":"Tinto","price":4000},
            {"id":"americano","name":"Americano","price":4000},
            {"id":"capuchino","name":"Capuchino","price":5000},
            {"id":"chocolate","name":"Chocolate","price":5000}
    ]},
    {"id":"cervezas-licores","name":"Cervezas & Licores","icon":"fa-beer-mug-empty", "items": [
            {"id":"cerveza-corona","name":"Cerveza Corona","price":10000},
            {"id":"cerveza-coronita","name":"Cerveza Coronita","price":6000},
            {"id":"cerveza-llanera","name":"Cerveza Llanera","price":11000},
            {"id":"cerveza-aguila","name":"Cerveza Águila / Poker / Light","price":6000},
            {"id":"club-colombia","name":"Club Colombia","price":9000},
            {"id":"cerveza-stella","name":"Cerveza Stella Artois","price":6000},
            {"id":"aguardiente-botella","name":"Aguardiente (Botella)","price":120000},
            {"id":"aguardiente-media","name":"Aguardiente (Media)","price":70000}
    ]}
];
