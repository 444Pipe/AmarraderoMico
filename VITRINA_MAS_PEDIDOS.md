# Vitrina "Los más pedidos del Mico" (en pausa)

Fecha: 2026-10-02

## Qué pasó

La vitrina de la sección Menú mostraba los 9 platos estrella (`POPULAR` en
`script.js`), pero solo 4 tenían foto; los demás salían con el marcador "Foto".
Mientras llegan las fotos que faltan, la vitrina usa una lista temporal
(`VITRINA` en `script.js`) con solo platos que ya tienen foto.

`POPULAR` NO se tocó: sigue marcando el sello 🔥 y el filtro "Más pedidos" de la
carta del domicilio.

## Lista original de la vitrina (la importante)

En este orden:

| # | id | Plato | ¿Tiene foto? |
|---|---|---|---|
| 1 | `picada-3` | Picada del Mico (3 pax aprox) | Sí |
| 2 | `picada-4` | Picada del Mico (4 pax aprox) | Sí (2026-10-02) |
| 3 | `plato-mamona` | Plato de Mamona | Sí |
| 4 | `chicharrones` | Chicharrones Carnudos | Sí |
| 5 | `mojarra` | Mojarra Frita o en Salsa | **Falta** |
| 6 | `sancocho-gallina` | Sancocho de Gallina | **Falta** |
| 7 | `punta-anca` | Punta de Anca | Sí |
| 8 | `carne-cerdo` | Carne de Cerdo | **Falta** |
| 9 | `costilla-cerdo-tulio` | Costilla de Cerdo — Tulio | **Falta** |

## Lista temporal (la que se ve hoy)

`picada-3`, `picada-4`, `plato-mamona`, `chicharrones`, `punta-anca`, `palo-costilla-mixto`,
`hamburguesa-mamona`, `arroz-mico`, `sancocho-res`, `platano-queso`, `rellena`,
`arepa-casa`.

## Cómo restaurarla cuando lleguen las fotos

1. Procesar cada foto a 1080×1080 JPG y guardarla en `statics/platos/<id>.jpg`.
2. En `menu-data.js`, agregar `"img":"statics/platos/<id>.jpg"` al plato.
3. En `script.js`, ir metiendo cada plato en `VITRINA` en su posición original
   (y sacar los de relleno). Cuando estén los 9, dejar `VITRINA` igual a la
   lista original de arriba, o volver a usar `[...POPULAR]` en
   `popularStripHTML()` y borrar `VITRINA`.
