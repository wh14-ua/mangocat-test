# Shang Hai — fotografías de platos (opcionales, ilustrativas)

Capa opcional de presentación del catálogo: las tres propuestas (Ink House, Wok After Dark,
Bento Club) pueden mostrarse **sin fotos** (diseño aprobado, por defecto) o **con fotos** de
los platos. Es la misma web, el mismo carrito y el mismo checkout: solo cambia la presentación.

| Cómo verlo | Qué hace |
|---|---|
| `…/<propuesta>/?fotos=1` | Activa las fotos (se recuerda durante la pestaña) |
| `…/<propuesta>/?fotos=0` | Las desactiva |
| `NEXT_PUBLIC_SHANG_HAI_DISH_PHOTOS=on` al compilar | Fotos activadas por defecto en todo el sitio |
| Comparador (`/showcase/shang-hai/`) | Cada propuesta tiene «Ver con fotos» / «Ver sin fotos» |

Los platos sin foto se muestran exactamente igual que antes. Precios, carrito y checkout no
dependen de las fotos.

## Estado: 20 imágenes generadas con IA (2026-11-05)

- Herramienta: ElevenLabs Creative (conector de la cuenta), modelo **Seedream 5 Pro**
  (`bytedance-seedream-5-pro`), 2048×1152, una generación por plato (sin rehacer ninguna:
  las 20 pasaron la revisión). Coste aproximado: 818 créditos ≈ 0,16 USD por imagen.
- Procesado: recorte central 4:3 → WebP 800×600 (≈ 22 KB) y 400×300 (≈ 10 KB), metadatos
  eliminados; `loading="lazy"` y `srcset` en `DishPhoto`.
- **No son fotos del restaurante.** Cada imagen lleva visible la etiqueta «Imagen
  ilustrativa» / «Illustrative image», y el `alt` describe solo lo que se ve.

### Criterio de los prompts (no inventar)

Cada prompt describe únicamente:
1. lo que dice la carta publicada (nombre, descripción, número de piezas), y
2. el aspecto que define al plato (p. ej. el pato laqueado se sirve en lonchas con tortitas;
   el xiaolongbao lleva pliegues arriba).

Todo lo demás se excluyó de forma explícita en el prompt: sin guarniciones, salsas para mojar,
wasabi, jengibre, sésamo, hierbas ni verduras que la carta no menciona; sin personas, manos,
textos ni logotipos. Mismo estilo para los 20: luz natural lateral, mesa de piedra gris cálida,
vajilla blanca o gris lisa, ángulo de 40°, para que funcionen en las tres identidades.

### Los 20 platos

| Plato (id) | Lo que sabemos (carta) | Lo que muestra la imagen | Revisión |
|---|---|---|---|
| Pato a la Pekinesa (`pato-a-la-pekinesa`) | EN publicado: «Peking duck with pancake» | Lonchas de pato con piel crujiente y tortitas finas; sin salsas ni verduras | OK |
| Rollo de Primavera (`rollo-de-primavera`) | Solo el nombre | Un rollo frito entero (no se corta: el relleno no consta) | OK |
| Arroz Frito con Tres Delicias (`arroz-frito-con-tres-delicias`) | Nombre | Arroz frito con huevo, jamón, guisantes y zanahoria (composición habitual del «tres delicias» en España, **pendiente de confirmar**) | OK |
| Tallarines Fritos con Tres Delicias (`tallarines-fritos-con-tres-delicias`) | Nombre | Tallarines con huevo, jamón, guisantes y zanahoria (misma salvedad) | OK |
| Pollo con Almendras (`pollo-con-almendras`) | Nombre | Pollo en dados y almendras, sin verduras (la carta no las menciona) | OK |
| Cerdo con Salsa Agridulce (`cerdo-con-salsa-agridulce`) | Nombre | Cerdo rebozado en salsa agridulce, sin piña ni pimiento | OK |
| Ternera con Pimientos Verdes (`ternera-con-pimientos-verdes`) | Nombre | Ternera y pimiento verde en salsa, sin cebolla | OK |
| Gambas con Ajo a la Plancha (`gambas-con-ajo-a-la-plancha`) | EN publicado: «Sizzling prawns with garlic» | Gambas con ajo en plancha de hierro | OK |
| Sopa Agripicante (`sopa-agripicante`) | Nombre | Sopa espesa ámbar con hebras de huevo (rasgo definitorio) | OK |
| Costillas con Salsa BBQ (`costillas-con-salsa-bbq`) | Nombre | Costillas glaseadas, sin sésamo ni hierbas | OK |
| Gyozas de Pollo a la Plancha (`gyozas-de-pollo-a-la-plancha`) | 6 piezas | 6 gyozas doradas (recuento comprobado) | OK |
| Siau Long Pao (`siau-long-pao`) | 4 piezas | 4 xiaolongbao en vaporera (recuento comprobado) | OK |
| Sau Mai (`sau-mai`) | 4 piezas | 4 siu mai en vaporera (recuento comprobado); el relleno visible es genérico | OK |
| Pan de Gambas (`pan-de-gambas`) | EN publicado: «Prawn cracker» | Cuenco de pan de gambas | OK |
| Gambas en Tempura (`gambas-en-tempura`) | Nombre | Gambas rebozadas en tempura, sin salsa (la carta no da el número de piezas: la imagen no lo afirma) | OK |
| Maki Salmón (`maki-salmon`) | 8 piezas | 8 makis de salmón (recuento comprobado) | OK |
| Picante Atún (`picante-atun`) | 8 piezas; «Aguacate, atún y chili» | 8 uramakis de atún y aguacate | OK |
| Nigiri Mixto (`nigiri-mixto`) | 8 piezas; «2 atún, 2 salmón, 2 gambas y 2 anguila» | Exactamente esa composición, por parejas | OK |
| Sashimi Variado (`sashimi-variado`) | 12 piezas; «6 salmón, 6 atún» | Lonchas de salmón y atún, sin guarnición | OK |
| Temaki Salmón (`temaki-salmon`) | Nombre | Un cono de nori con arroz y salmón | OK |

## Sustituir por fotos reales del restaurante

1. Fotografía el plato real y expórtalo en WebP 4:3: `<id>-800.webp` (800×600) y
   `<id>-400.webp` (400×300) en `public/images/shang-hai/dishes/` (mismo nombre: sobrescribe).
2. En `src/data/shang-hai/dish-photos.ts` cambia esa entrada a
   `dish("<id>", { es: "…", en: "…" }, { kind: "restaurant" })` (sin `generator`) y describe la
   foto real en el `alt`. La etiqueta «Imagen ilustrativa» desaparece sola para `kind: "restaurant"`.
3. `npm test` (comprueba tamaños, pesos y textos) y vuelve a publicar.

## Ampliar el catálogo (las 204 referencias)

Mismo proceso, por lotes de 20: elegir platos, escribir el prompt con el criterio de arriba
(copiar la plantilla de cualquiera de las filas), generar 1 imagen por plato, revisar recuentos
y que no aparezcan ingredientes no mencionados, recortar a 4:3 con
`convert entrada.png -gravity center -crop 1536x1152+0+0 +repage -resize 800x600 -strip -quality 78 salida-800.webp`
(y `400x300`), registrar en `dish-photos.ts` y pasar `npm test`. El test fija 20 entradas a
propósito: al añadir un lote, actualiza ese número.

Antes de publicar fotos con IA de forma definitiva conviene que el restaurante las vea:
algunas composiciones (tres delicias, rellenos) son las habituales del plato, no las suyas.
