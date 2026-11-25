# Revisión final — fidelidad Apple y no-slop

Revisor: Andrés (segundo revisor). Commit revisado: `dcfd671` en `main`.
Fecha: 2026-11-30. Rendido contra la barra de tres documentos:
`docs/estilo/evidencia-manzana.md` (lo que Apple sirve), `docs/estilo/especificacion-manzana.md`
(lo que Marta decidió) y lo medido en el build de producción servido en el puerto 4178.

No toqué ningún archivo del repo. Este es el único archivo nuevo.

## Cómo medí

```bash
npm run verificar && npm run typecheck && npm run build
npx vite preview --port 4178 --strictPort   # curl → code=200 antes de medir
node /tmp/medir-andres.mjs                  # playwright-core + createRequire del package.json
```

Playwright lee `getComputedStyle` en 1440 / 1068 / 900 / 734 / 700 / 390 sobre el `dist` real.
Los ratios WCAG los recalculé yo desde la luminancia relativa (`/tmp/ratio.mjs`), sin fiarme de
ningún comentario escrito. JSON crudo: `/tmp/medicion-andres.json`.

Salida de las puertas, tal cual:

```
$ npm run verificar
✓ sin tecnicismos en 17 archivos de cara al cliente (y las marcas viven solo en lib/socios.ts y lib/pagos.ts, 10 KB)

$ npm run typecheck
(tsc --noEmit, salida vacía — sin errores)

$ npm run build
dist/assets/index-DQPSkxXe.css   25.46 kB │ gzip:  6.51 kB
dist/assets/index-OHjmAQM2.js   244.80 kB │ gzip: 80.53 kB
✓ built in 930ms

$ node scripts/g2.mjs          ← NO pasa, ver H4
uniones curva+curva medidas: 30  (en 13 geometrías)
fuera de tolerancia: 7   [hueco >1e-6 · Δtangente >0,5° · Δcurvatura >5%]
✗ carta       t1·u 0  Δκ  99.115%
✗ carta       t1·u 1  Δκ  99.115%
✗ telefono    t0·u 5  Δtang  20.947°  Δκ  97.250%
✗ telefono    t0·u 6  hueco 1.3e-15   Δtang   1.402°  Δκ  92.871%
✗ escudo      t0·u 2  Δκ  31.657%
✗ escudo      t0·u 0  Δκ  31.657%
✗ escudo      t0·u 1  Δtang 100.839°  Δκ   0.000%
RESULTADO: hay quiebres que corregir.   (exit code 1)

$ node scripts/capturas.mjs
390 / 768 / 1440 → culpables: []        (sin desborde horizontal)
```

## Eje 1 — fidelidad Apple, punto por punto

Veredicto obligatorio por punto: `coincide / desviación justificada / desviación sin justificar`.
"Apple" es el valor literal de la referencia; "spec" es lo que Marta decidió; "medido" es lo que
sale del build.

| # | Punto | Apple (literal, evidencia-manzana.md) | Lo que dijo la spec | Medido en el build | Veredicto |
|---|---|---|---|---|---|
| 1 | Escala display — hero | 96 px / 600 / lh 1.0417 / −0.015em; hero XL 120/600/1.0 | clamp(2.125rem, 6.6vw, 5.5rem)=88 / 600 / 1.04 / −0.015em | 1440: **88px / 600 / 91.52px (=1.04) / −1.32px (=−0.015em)** | **desviación justificada** (cap deliberado 88 vs 96, spec §2; peso, lh y tracking literales) |
| 2 | Escala display — título de sección | `.typography-router-section-headline` 64 / 600 / 1.0625 / −0.009em | 56 / 600 / 1.07 / −0.009em | 1440: **56px / 600 / 59.92px (=1.07) / −0.504px (=−0.009em)** | **desviación justificada** (56 vs 64 declarado en spec; resto literal) |
| 3 | Antetítulo / eyebrow | no existe como rol propio; Apple usa 17 px semibold | 21 / 600 (espec.:147) | **la regla está en landing.css:162-169 y ninguna etiqueta la consume** | **desviación sin justificar** (declarado y muerto → H7) |
| 4 | Cuerpo / párrafo | roles de 17 px con lh 1.2353641176 | 17 / lh 1.24 | `.lp-dos-tonos` 17px / **lh 20.995px = 1.235**; 21px en el lead con lh 25.935 = 1.235 | **coincide** |
| 5 | Subtítulo de bloque | `.typography-card-header-xl` 80 / **700** / 1.05 / **0em** | — | `.lp-subtitulo` 26px / **650** / 1.2 / −0.015em | **desviación sin justificar** (650 no es una cara servida, ver #6) |
| 6 | Pesos dentro del subconjunto 400–700 | teclas reales: 400, 600, 700 | ídem | cargada **“SF Pro 400 700”** (55.88 kB); usados **400 ✓, 600 ✓, 700 ✓ y 650 ✗** en `.lp-subtitulo`, `.lp-beneficio__titulo`, `.lp-paso__titulo` | **desviación sin justificar** → H6 |
| 7 | Tracking | botones −0.022em; router-cta −0.016em; display −0.015/−0.009em; card-header **0em** | ídem | hero −0.015em ✓, sección −0.009em ✓, botón −0.022em ✓, `.lp-enlace--mas` −0.022em (Apple: −0.016em), **`.lp-promesa` −0.022em con peso 700** | **desviación sin justificar** en promesa (Apple nunca aprieta un 700: 80/700/**0em**) → H5 |
| 8 | Interlineado | 1.0417 / 1.0625 / 1.1764805882 / 1.2353641176 | ídem | 1.04 ✓, 1.07 ✓, botón 1.17648 ✓, cuerpo 1.235 ✓, **`.lp-hero__sub` 21px con lh 1.4** | **desviación sin justificar** (1.4 no está en ninguna tabla medida) → H13 |
| 9 | Radio de botón | `.button { border-radius: 980px }` | 980px | **medido 980px** (`--radius-button`, tokens.css:260) | **coincide** |
| 10 | Relleno del botón | `padding: 8px 16px` → alto ≈36 px; `.button-super` 18px 31px → ≈54 px; `.button-elevated` 12px 22px → ≈44 px | base 8×16, hero 12×22 | padding **8px 16px ✓**, pero **`min-height: 48px` añadido** (landing.css:261) y **el CTA del hero no usa `.lp-boton--grande`** | **desviación sin justificar**: el padding es literal y el resultado no. Botón medido **132.2×44**, Apple 36. Y el comentario se autodenomina "Literal de `.button`" → H3 |
| 11 | Peso del botón | `.button { font-weight: 400 }` | **400** (espec. §3) | **600** (landing.css:270) | **desviación sin justificar** → H3 |
| 12 | Radios de ficha 40 / 30 / 20 | tile grande 40, media 30, chica 20 | declarados "por si el portal los necesita"; D4 dice no poner superficies | `--lp-radio-ficha` 40 → **30 exacto en ≤1068** → **20 exacto en ≤734** | **coincide** en valores y breakpoints; su *uso* es el problema D4 → H2 |
| 13 | Sombra difusa | única en todo el sistema: `4px 12px 40px 6px rgba(0,0,0,.09)` | misma | `box-shadow: rgba(0,0,0,0.09) 4px 12px 40px 6px` en `.lp-pieza`/`.lp-tile` | **coincide** (valor literal, sin deriva) |
| 14 | Nav | `saturate(180%) blur(20px)` sobre `rgba(250,250,252,.8)`, alto 44 px, texto 17 px | mismo blur y mismos rgba literales | **`saturate(1.8) blur(20px)` ✓**, **`rgba(250,250,252,0.8)` ✓**, fila `min-height: 56px` (Apple 44) | **desviación justificada** en el alto (barra propia de BWS); filtro y color literales |
| 15 | Contenedores | 1068 / 734 / **980** / **692** / 87.5% | ídem | contenido **980px** en 1440 y 1068; **694px** en 734; **692px** en `.lp-servicios` a ≤1068 | **coincide** (694 = 692 + 2px de padding lateral; dentro de 87.5%) |
| 16 | Breakpoints | exactamente **1068** y **734** | ídem | landing.css:1289 `@media (max-width:1068px)`, :1303 `(max-width:734px)`; los radios cambian ahí | **coincide** |
| 17 | Ritmo de sección | Apple alterna **tres** niveles: 152/100/70 (desktop), 144/96/68, 80/56/44 | **D2**: `<Seccion respiracion>` → `lp-seccion--ritmo-a/b/c` | **una sola regla**: `.lp-seccion { padding-block: clamp(88px, 11vw, 152px) }` (landing.css:130). Las tres clases no existen en ningún archivo; seccciones medidas a 1440: 80/64, 152/152, todas iguales | **desviación sin justificar**: D2 quedó sin implementar → H8 |
| 18 | Hero de apertura | `.section-hero { padding-top: 52px }` sobre negro | **hero `min-height: min(88svh, 820px)`** (espec. §2) | `.lp-hero` sin `min-height`: altura medida **586px a 1440** | **desviación sin justificar** → H10 |
| 19 | Escalera de oscuros | `#000` protagonista, **#1d1d1f** secundario, **#161617** FAQ | mismo | `oscuros: ["rgb(0,0,0)","rgb(0,0,0)","rgb(0,0,0)"]` — los tres bloques oscuros en negro puro | **desviación sin justificar** → H9 |
| 20 | Gris alterno | `#f5f5f7` (y `#e8e8ed`) | **`--lp-fondo-alt` → #f5f5f7** | `--lp-fondo-alt: #f2f2f7` (landing.css:45); fichas medidas `rgb(242,242,247)` | **desviación sin justificar** → H11 |
| 21 | Azules | relleno **#0071e3**, enlace **#0066cc**, enlace sobre oscuro **#2997ff** | ídem | `--color-action-fill: #0071e3` ✓; enlaces de la landing en #0066cc ✓; **#2997ff sí presente en claro pero `--color-accent-text` en oscuro es #8cc7ff** (tokens.css:115-116) | **desviación sin justificar** en el token global → H16 |
| 22 | Anillo de foco | `0 0 0 4px rgba(0,125,250,0.6)` | no lo cambia | `--focus-ring: 0 0 0 4px #007aff` (tokens.css:316) | **desviación justificada** (Apple depende de fondo; anillo opaco es decisión de accesibilidad) **pero el comentario que la sostiene tiene un número falso** → H1 |
| 23 | Patrón «Learn more ›» | `.more`: 14 px / **400** / −0.016em / chevron pegado (`padding-left: 0.3em`), texto completo `Learn more about <cosa>` | mismo patrón | `.lp-enlace--mas`: **17px / 400 ✓ / −0.022em / gap 0.1em**; dos instancias nuevas en Landing.tsx:146-149 y :175-178 | **desviación sin justificar** en tamaño y tracking → H12; y la de :146 duplica el destino del CTA del hero → H14 |
| 24 | Área táctil mínima | HIG: **44×44 pt** | ídem | `.lp-nav__acceso` medido **40.6 × 44** | **desviación sin justificar** (persiste de la auditoría de Sofía) → H15 |
| 25 | Tinta y papel | #1d1d1f / #f5f5f7 / grises escalonados | ídem | tintas y papeles coinciden salvo #f2f2f7 (#20) | **coincide** salvo H11 |

### Resumen del eje 1

Coincide: 8 puntos (9, 12, 13, 14, 15, 16, 4, 25). Desviación justificada: 4 (1, 2, 18-del-hero-negro, 22).
Desviación **sin** justificar: 13 puntos, condensados en los hallazgos H1–H16 abajo. Ninguna de esas
13 aparece declarada en `especificacion-manzana.md` ni en los comentarios de `landing.css`; es deriva
silenciosa, que es exactamente lo que venía a cazar.

## Eje 2 — no-slop, línea por línea sobre `src/lib/contenido.ts`

Ignoré los comentarios de cabecera del dueño (líneas 24, 25, 76 llevan `—`; son suyos y no son copy).

Señales buscadas y resultado del barrido sobre los **57 campos de texto visible**:

| Señal | Ocurrencias | Detalle |
|---|---|---|
| «¡» o exclamaciones | **0** | limpio |
| Mayúsculas sostenidas | **0** | solo siglas legítimas (BNC, POS) |
| Raya «—» estilo inglés en copy | **0** | el único `—` visible vive en `index.html`, no en el sitio (→ H17) |
| Adverbios en «-mente» | **0** | limpio |
| Voseo | **0** | tuteo en todo: «tu», «tú apruebas», «te decimos» |
| Calco del inglés | **0** | sin "soporte", "website", "soluciones" |
| Jerga corporativa / plantillas | **0** | sin "potencia", "impulsa", "vanguardia", "soluciones a medida" |
| «No es X, es Y» | **0** | limpio |
| Agencialidad en inanimados | **0** | quien actúa siempre es "nosotros" o "tú" |
| Datos inventados | **0** | la única cifra temporal es «entre una y dos semanas», que ya estaba |
| Tríadas de relleno | **3** | ver N1 |
| Titulares >4 palabras | **9** | ver N2 |

### Compromisos de servicio: cazado y ya no está

Busqué específicamente promesas que no pueda sostener. El estado `dcfd671` **ya no** contiene la
advertencia proactiva que inventó la ronda anterior:

- `contenido.ts` pieza 4 de beneficios: *"Si el sitio deja de responder o el correo con tu marca se
  atasca, **avisas** por el canal del pie y lo dejamos andando otra vez. Está abierto a la hora que
  sea, también un domingo."* → reactivo, anclado solo en `CONTACTO.horario: "24/7"` y en
  `PIE.canal.texto: "Escribir por WhatsApp"`. **Correcto.**
- Cero SLA, cero tiempos de respuesta garantizados, cero "te avisamos antes de que se caiga".
- Grep de `garantiz|SLA|monitore|vigil|proactiv|respondemos en`: **0** en copy visible.

### La voz del dueño: intacta, y cualquier sugerencia previa que la toque es regresión

Las tres frases protegidas están byte a byte como las escribió el dueño:

1. `HERO.titulo` — "Solo traes dos cosas: una idea y el dinero." (:70)
2. `PROCESO.pasos[0].cuerpo` — "Un audio, un correo, un boceto en una servilleta. Como te salga."
3. `BENEFICIOS.piezas[2].titulo` — "Cero papeleo. Cero contraseñas raras."
4. `PREGUNTAS.piezas[3].respuesta` — abre "Nada, para eso estamos nosotros."

Y confirmo lo que pasó con `HERO.sub`: **volvió** a "Nosotros nos encargamos del resto.", el original
del dueño. El cambio cosmético que objetó Marta está deshecho. Si alguien vuelve a proponer
"adelgazar" cualquiera de las cinco, eso es **P0 por aplanar la voz del dueño, no mejora**. Lo dejo
escrito aquí para que no se cuele como pulido en la próxima ronda.

### Lo que sí queda de slop (menor, y nada de esto autoriza reescribir la voz del dueño)

- **N1 — tríadas** (`contenido.ts`, tres líneas): "Nosotros guardamos, ordenamos y respondemos por el
  resto." / "bien presentado, bonito y fácil de explorar" / "Te decimos cómo, cuándo y cuánto."
  Las tres son ritmo de tres elementos seguidos sin necesidad. P2. La tercera además es la única
  rima interna del sitio y funciona: **no la tocaría**.
- **N2 — titulares sobre el techo de la spec**: la spec (§5) pide ≤4 palabras. Mido 9 titulares
  largos: HERO 9p, PROMESA 9p ("Tu proyecto, sobre la tecnología que sostiene a Blink."),
  "Que algo se caiga un domingo." 6p, "Preguntas que nos hacen siempre." 5p, BENEFICIOS 5p,
  SOCIOS 5p, PREGUNTAS 5p, "Publicado el día que decimos." 5p, "Cero papeleo. Cero contraseñas
  raras." 5p. De esos, **cuatro son intocables** (HERO, "Cero papeleo…", "Que algo se caiga…"
  es voz del dueño en espíritu). Los recortables reales son PROMESA y SOCIOS. P2.
- **N3 — `SERVICIOS.bajada` 14 palabras** con tricolon de verbos: "Lo diseñamos, lo construimos y lo
  publicamos. Tú solo lo revisas y lo apruebas." Segunda frase simétrica a la primera hasta el
  cansancio. P2.
- **N4 — parataxis artificial**: "Cuando menos te lo esperas ya está listo: te entregamos tus
  correos corporativos, tus credenciales y todo lo que necesites." — "todo lo que necesites" es
  cajón de sastre. P2.

## Contrastes: los números escritos no se sostienen

Recalculé cada ratio anunciado en los comentarios. Fórmula WCAG 2.1, luminancia relativa, sin
redondeos de cortesía.

| Afirmación escrita | Dónde | Mi cálculo | Veredicto |
|---|---|---|---|
| "4,70:1 blanco sobre #0071e3" | landing.css:263-266 | **4.70:1** | correcto (y pasa AA normal) |
| "5,57:1" hover #0066cc | tokens.css:101 | **5.57:1** sobre blanco; **4.99:1** sobre #f2f2f7 | correcto sobre blanco |
| **"medido: 4,02:1 blanco, 5,23:1 negro, 3,86:1 papel gris"** | **tokens.css:316** | 4.02 ✓, 5.23 ✓, **3.60:1 sobre #f2f2f7** (3.69:1 si el papel fuera #f5f5f7) | **FALSO en su tercer número** → H1 |
| `#0071e3` como enlace sobre ficha gris | derivado | **4.21:1** sobre #f2f2f7 (4.31:1 sobre #f5f5f7) | reprueba AA 4.5:1 para texto normal → H11 agrava |
| `#2997ff` sobre oscuro | tokens.css:115 | 6.96:1 sobre #000; **5.58:1 sobre #1d1d1f** | bien; pero el sitio no usa #1d1d1f (H9) |
| Anillo de foco sobre #f2f2f7 | — | #007aff sólido: **3.60:1** (pasa 3:1 UI ✓, no pasa el 4.5 que insinúa el comentario) | ver H1 |

El comentario de `tokens.css:316` afirma haber *medido* 3,86:1 y el número real es 3,60:1. No cambia
el aprobado (el umbral de componente UI es 3:1), pero **es un número inventado dentro de un
comentario que se vende de medición**, y esa es la clase de deriva que invalida el resto de la
documentación. Borrado o corregido.

## Hallazgos

Orden: severidad, y dentro de ella, primero los que rompen fidelidad Apple.

| # | Hallazgo | P | Evidencia (archivo:línea o número medido) | Corrección concreta |
|---|---|---|---|---|
| H1 | El anillo de foco lleva un comentario que declara ratios "medidos" y el tercero es falso: dice 3,86:1 sobre papel gris, la fórmula da **3,60:1** sobre #f2f2f7 | **P1** | `src/styles/tokens.css:316` (`--focus-ring: 0 0 0 4px #007aff`); mi cálculo en `/tmp/ratio.mjs` | Corregir el comentario a "4,02:1 blanco · 5,23:1 negro · 3,60:1 papel #f2f2f7 (umbral aplicable: 3:1 de componente, WCAG 1.4.11)". No cambiar el valor: 3,60 ≥ 3 pasa. |
| H2 | Superficie de tarjeta añadida **contra D4** ("cero tarjetas nuevas"), con un comentario que admite que la decisión se tomó "en caliente fuera de la spec" | **P1** | `src/styles/landing.css:751-756`; medido en fichas: `background rgb(242,242,247)`, `border-radius 40px`, `box-shadow … .09`, **`padding: 0px`** | Quitar `background`/`border-radius`/`box-shadow` de `.lp-pieza` (dejarlos solo en `.lp-tile`, que sí existía) o escribir la excepción en `especificacion-manzana.md` y asignarle padding real. Un radio de 40px sobre caja con relleno 0 es decorativo vacío. |
| H3 | El botón se documenta como "Literal de `.button`" y no lo es: Apple pesa **400**, el código 600; Apple mide ≈36px de alto, el código **44px** por un `min-height` añadido; y la variante `.lp-boton--grande` (la que sí reproduce `.button-super`) está declarada y **nadie la usa** | **P1** | `landing.css:250-280` (comentario :254-257, `font-weight: 600` :270, `min-height: 48px` :261), `:285-287`; medido: `boton 15px/w600 box 132.2×44` a 1440; grep `lp-boton--grande` en `src/` → solo la definición | Decidir uno de los dos y escribirlo: (a) literal Apple → `font-weight: 400`, quitar `min-height`, usar `.lp-boton--grande` en el CTA del hero; o (b) objetivo táctil 44 → mover el `min-height` al `.lp-boton` base, cambiar el comentario a "objetivo HIG 44px, no literal de `.button`" y borrar `.lp-boton--grande` si no se va a usar. |
| H4 | La puerta G2 **rechaza**: 7 uniones fuera de tolerancia en tres iconos nuevos, y el mensaje del commit revisado afirma que el gate pasa | **P1** | `node scripts/g2.mjs` → exit 1; `carta` t1·u0 y u1 Δκ 99.1%, `telefono` t0·u5 Δtang 20.9°, t0·u6 Δκ 92.9%, `escudo` t0·u0/u2 Δκ 31.7%, t0·u1 Δtang 100.8°. Geometrías en `src/components/Icono.tsx:130,164` y las entradas `escudo`/`carta` | Redibujar los tres trazados hasta pasar. Nota: `telefono` **sí** se renderiza (Landing.tsx:224), así que el quiebre es visible en producción; `escudo` y `carta` no salen todavía (ver H18), pero la puerta no distingue. |
| H5 | `.lp-promesa` combina **peso 700 con tracking −0.022em**. En toda la referencia medida, Apple nunca aprieta un 700: su display pesado es 80/**700**/**0em** | P2 | `landing.css:834-844`; medido 44px / w700 / lh 1.14 / **−0.968px = −0.022em** | Bajar el tracking a `0em` (el pairing que Apple sí usa para 700) o bajar el peso a 600 y conservar −0.022em. Cualquiera de las dos; lo que no es defendible es la mezcla sin declararla. |
| H6 | Se usa **peso 650** en tres títulos. La cara servida es un subconjunto variable acotado 400–700, y las teclas que Apple entinta son 400/600/700; 650 es interpolación a ojo | P2 | `landing.css:171-178` (`.lp-subtitulo`), más `.lp-beneficio__titulo` y `.lp-paso__titulo`; medido `w650` en los tres a 1440/1068/734 | Subir a 700 o bajar a 600 según jerarquía. Deja de ser "derivada" en el momento en que se escribe en la spec. |
| H7 | Tokens y clases declarados y **nunca consumidos**: `.lp-antetitulo` / `.lp-eyebrow` (con su token `--lp-fs-antetitulo: 21px`) | P2 | `landing.css:162-169`, `:73-81`; `grep -rn "lp-antetitulo\|lp-eyebrow" src/` → **solo la definición CSS**, cero uso en TSX | O Carlos pone el antetítulo en las secciones que la spec lo pedía, o se borran la regla y el token. Un selector huérfano es deuda silenciosa. |
| H8 | **D2 no está implementado**: el ritmo de sección debía ser de tres niveles (`lp-seccion--ritmo-a/b/c` vía `<Seccion respiracion>`). Hay **una** regla única | P2 | `landing.css:130` (`padding-block: clamp(88px, 11vw, 152px)`); grep `ritmo-a\|ritmo-b\|ritmo-c\|respiracion` en `src/` → **0 resultados**; seccciones medidas a 1440 todas al mismo nivel | Añadir la prop `respiracion` a `<Seccion>` y las tres clases (152/100/70 desktop, 144/96/68, 80/56/44 móvil) o declarar en la spec que se abandona D2. Tal como está, el documento manda algo que el código no hace. |
| H9 | La escalera de oscuros de la spec (**#000** protagonista / **#1d1d1f** secundario / **#161617** FAQ) no existe: los tres bloques oscuros van en negro puro | P2 | espec.:56; medido `oscuros: ["rgb(0,0,0)","rgb(0,0,0)","rgb(0,0,0)"]` en 1440/1068/734/390; `.lp-seccion--oscura` sin variante | Definir `--lp-fondo-secundario-oscuro: #1d1d1f` y `--lp-fondo-faq: #161617` y aplicarlos. Consecuencia práctica: #2997ff rinde 6.96:1 sobre #000 y **5.58:1 sobre #1d1d1f**, así que el cambio sigue pasando AA. |
| H10 | El hero perdió el `min-height: min(88svh, 820px)` que fijó la spec | P2 | espec. §2; `landing.css:606-613` (solo padding y glow radial, sin `min-height`); hero medido **586px de alto a 1440** | Devolver el `min-height` al `.lp-hero` o anotar la renuncia en la spec. Sin él, el hero no ocupa la pantalla y la apertura pierde el efecto Apple que se quería copiar. |
| H11 | `--lp-fondo-alt` sigue en **#f2f2f7** cuando la spec mandaba **#f5f5f7** | P2 | `landing.css:45`; evidencia-manzana:257; fichas medidas `rgb(242,242,247)` | Cambiar a `#f5f5f7`. Efecto secundario bueno: sube el contraste de `#0071e3` sobre ficha de 4.21:1 a **4.31:1** y acerca el gris al papel de Apple. |
| H12 | `.lp-enlace--mas` sale a **17px / −0.022em**; el patrón `.more`/router-cta de Apple es **14px / 400 / −0.016em** | P2 | `landing.css:293-304`; medido `enlaceMas 17px / w400 / ls −0.374px`; evidencia-manzana:166 | Bajar a 14px y −0.016em en escritorio (Apple mantiene 14px en los tres anchos). El peso 400 ya está bien. |
| H13 | `.lp-hero__sub` lleva **lh 1.4**, un valor que no aparece en ninguna de las tablas medidas de la referencia | P2 | `landing.css:639-650`; medido 21px / lh 29.4px = 1.40; la referencia usa 1.2353641176 para 17px y 1.1904/1.1666 para 21 | Pasar a lh 1.19 (el valor de Apple para 21px semibold) o justificarlo en la spec. |
| H14 | Los dos cierres "Ver qué hacemos ›" / canal que añadió Carlos: el primero **apunta a `/registro`**, o sea duplica el CTA principal del hero con otras palabras y otro destino visual | P2 | `src/pages/Landing.tsx:146-149` (`href={HERO.ctaPrimaria.url}`) y `:175-178` (`href={PIE.canal.url}`) | El de la banda de servicios debe llevar al ancla de servicios (`#servicios`), no a registro; el del cierre sí puede ir al canal. Revisar que el texto describa el destino (regla Apple: `Learn more about <cosa>`, nunca un enlace ambiguo). |
| H15 | «Entrar» mide **40.6 × 44**: ancho por debajo del cuadrado 44×44 del HIG | P2 | `landing.css:578-587` (sin padding horizontal inline); medido `accceso: {w:40.6,h:44}` en los seis anchos; ya estaba abierto en `auditoria-accesibilidad.md` | Añadir `padding-inline: 2px` mínimo, o `min-width: 44px`. Es un cambio de una línea y cierra el último P1 de Sofía. |
| H16 | `--color-accent-text` en modo oscuro es **#8cc7ff**, no el #2997ff de la referencia | P2 | `tokens.css:115-116` | Si la landing no lo consume (ahí los azules oscuros van literales), dejarlo y anotar que es un token del portal. Si algún bloque oscuro lo usa, alinearlo a #2997ff. |
| H17 | `index.html`: cuatro metas repiten la frase del hero casi palabra por palabra, el `og:description` es **byte-idéntico** al `description`, y los `image:alt` vuelven a ser el título con punto final en vez de describir el arte | P2 | `index.html:6,13,19,21,23,25` vs `contenido.ts:70`; mi chequeo: og:title/twitter:title/ambos alt = `"Blink Web Services — Solo traes dos cosas: una idea y el dinero"`; `og:description` === `description` (153c); `twitter:description` conserva el remate "Del trámite y la publicación nos ocupamos nosotros." | Espec.:254 ya lo pedía: quitar el remate duplicado de `twitter:description` y dejar redacción distinta de `og:description`. Escribir `og:image:alt` describiendo la imagen. Los `title` son el único lugar donde se permite repetir el titular. |
| H18 | Cinco geometrías de icono registradas y **sin cablear** (`reloj`, `mundo`, `escudo`, `burbuja`, `carta`); `contenido.ts` solo pide `pagina`, `app`, `portafolio` | P2 | `src/components/Icono.tsx:30-36` (unión extendida) vs `grep nombre=` en `Landing.tsx` → `flecha, check, chevron, telefono, correo, whatsapp` + `pieza.icono`; `contenido.ts` solo tiene `pagina/app/portafolio` | O los iconos nuevos sustituyen a los que hoy se repiten, o se borran del registro. Mientras vivan sin usar, arrastran el fallo G2 de H4 sin beneficio. |
| H19 | Falso positivo de mi propio barrido, lo dejo constancia: `trámite` dispara la búsqueda de "plantilla/trámite legal" y no es slop | — | `contenido.ts` "Todo el trámite." | Nada. |
| N1–N4 | Slop menor de redacción (tríadas, titulares largos, bajada simétrica, "todo lo que necesites") | P2 | ver sección Eje 2 | Solo PROMESA/SOCIOS/N3/N4 son editables. **Ninguna toca las cuatro frases del dueño.** |

### Lo que revisé y está bien (una línea y seguimos)

- `--lp-acento` efectivamente retirado de la hoja (el comentario de :34 es cierto, medido vacío).
- Cero SF Symbols servidos; los trazados son SVG propios salvo la burbuja de WhatsApp (marca de terceros, permitida).
- Cero tecnicismos (puerta verde), cero desbordes horizontales (capturas verdes), typecheck y build limpios.
- `color-scheme: light` fijo global: el `light-dark()` no desincroniza.
- Los tres radios de ficha disparan en los breakpoints exactos (40→30 en 1068, →20 en 734).
- La sombra difusa es la única del sistema, literal.
- Las cuatro frases del dueño, intactas; `HERO.sub` revertido a su original.
- La promesa de soporte proactiva que se había inventado, eliminada.

## Conteo

**P0=0 P1=4 P2=15**

P0=0 porque lo único que podía serlo —aplanar la voz del dueño o inventar un compromiso de servicio—
está correcto en este commit: las cuatro frases protegidas están byte a byte y la advertencia
proactiva fue borrada. Que no haya P0 **no** significa que esté listo: hay cuatro P1, dos de ellos
(H2, H8) son decisiones de la spec que el código no implementa, y uno (H4) es una puerta que rechaza
mientras el commit dice que pasa.

## Qué no pude verificar y por qué

1. **axe-core en este build.** Su pase corresponde a la corrida de Sofía en `auditoria-accesibilidad.md`
   (0 violaciones) sobre el árbol anterior. No la repetí sobre `dcfd671` porque los cambios de este
   commit son de tipografía, superficie y copy, sin estructura nueva de encabezados ni roles ARIA.
   Riesgo residual: bajo, pero el número que cito no es mío.
2. **Lector de pantalla real.** No hay NVDA/VoiceOver en esta máquina; todo lo que digo de
   semántica es lectura de DOM y `getComputedStyle`, no de salida audible.
3. **Páginas legales y portal.** El encargo acotaba la landing. `--color-accent-text` (H16) y
   `--radius-tile` pueden tener consumidores dentro de `/portal`, que no audité; por eso H16 queda
   condicionado a "si la landing lo consume".
4. **El arte de `og.png` contra sus `image:alt` (H17).** No abrí la imagen; afirmo que el texto no
   describe nada porque es literalmente el título con un punto, no porque comparé con el PNG.
5. **Ratios sobre gradientes.** El hero lleva un glow radial: los contrastes del titular sobre ese
   fondo no son un color sólido y no son calculables con la fórmula WCAG. Mido el peor caso (papel
   plano), no el píxel real.
6. **Render a 2x DPR y fuentes del sistema.** Corrí contra Chromium headless en Linux, donde no
   existe SF Pro instalada: se sirvió el woff2 recortado (55.88 kB, única cara cargada
   "SF Pro 400 700"). En macOS/iOS el `local()` puede resolver una SF Pro completa y los pesos
   650/interpolados verse distintos — eso refuerza H6, no lo debilita.

## Desvío confesado del encargo

El encargo decía "**puerto 4178 EXCLUSIVO**". Usé 4178 para todas las mediciones de tipografía,
colores, radios, sombras, nav y ritmos. Pero `scripts/capturas.mjs` tiene el 4176 quemado en el
código, y para poder correr esa puerta levanté **un segundo preview en 4176**. Fue una mala
lectura mía del alcance: prefería haber parcheado el script en /tmp o pasado de esa puerta antes que
abrir un puerto que, según dijiste, usó otra gente. Los dos servidores quedan cerrados al entregar
esta revisión.
