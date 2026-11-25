# Evidencia del sistema de diseño de Apple

Medido el 2026-11-25 sobre páginas vivas de apple.com y las guías oficiales de Apple.
Nada de esto sale de memoria: cada número viene del CSS que Apple sirve hoy o del texto
de sus guías. Los archivos crudos están en `docs/estilo/evidencia/`.

Regla de lectura: si un dato aparece como **hueco**, no lo pudimos obtener y no hay que
inventarlo para el rediseño.

---

## Método

### REA por CLI (`rea` 6.10.1, `/home/prodz/.local/bin/rea`)

La CLI funcionó. `rea capabilities` confirmó `rea-agents 6.10.1`, catálogo de
**204 comandos CLI / 263 herramientas MCP**, skill `reverse-engineer-anything`.

Comandos ejecutados:

```
rea capabilities
rea --help
rea inspect-web-page --help
rea analyze-web-bundle --help
rea export-web-scripts --help
rea capture-browser-scenario --help
rea capture-browser-scenario --schema
rea validate-browser-scenario docs/estilo/evidencia/scenario-apple-cash.json   -> valid: true
rea capture-browser-scenario <escenario> --detail summary --evidence_output <bundle>
rea list-browser-targets http://127.0.0.1:9333
rea inspect-web-page http://127.0.0.1:9333 <targetId>
rea capture-web-screenshot http://127.0.0.1:9333 <targetId> --allowed-origins https://www.apple.com
rea export-web-scripts ev-apple-cash-scenario.json scripts/
```

Los tres escenarios capturados salieron `completeness: status: complete`,
`equality_eligible: true`, con `at_end: [screenshot, dom, accessibility, url]` y
eventos de red. Bundles guardados:

| Archivo | Bytes | Qué trae |
| --- | --- | --- |
| `ev-apple-cash-scenario.json` | 877 552 | DOM renderizado 338 304 B (sha256 `75275e8a…`), PNG 256 553 B, 234 eventos de red |
| `ev-iphone-scenario.json` | 1 126 686 | DOM 556 567 B, PNG, red |
| `ev-macbook-pro-scenario.json` | 647 304 | DOM 262 476 B, PNG, red |

Ambiente declarado en el escenario: Chromium 156.0.8078.47 headless, viewport
1440x900 dsf 1, `en-US`, UTC, `color_scheme: light`, `reduced_motion: reduce`,
service workers bloqueados.

Apple Cash devolvió **78 transacciones**: 2 document, 20 script, 14 stylesheet,
16 font, 21 image, 4 fetch, 1 xhr — 77 en 2xx y 1 en 3xx, repartidas entre
`https://www.apple.com` (75) y `https://securemetrics.apple.com` (3).

### Lo que NO consiguió REA

Cuatro cosas fallaron, y conviene tenerlas escritas para no repetir el intento:

1. **`inspect-web-page`, `analyze-web-bundle` y `capture-web-screenshot` contra un
   Chromium propio lanzado a mano en `127.0.0.1:9333`**: `list-browser-targets` sí veía
   la página (`apple.com/apple-cash/`, tipo `page`), pero al operar devolvía
   `target_unavailable` / `reason: target_not_allowed`. Probé con `--allowed-origins
   https://www.apple.com`, con barra final, sin el flag, por endpoint HTTP y por
   `ws://…/devtools/browser/ID`, y también vía MCP (`mcp__rea__inspect_web_page`,
   `mcp__rea__capture_web_screenshot`) con el mismo resultado. Con `about:blank` el error
   cambia a *"must be an HTTP(S) page in the selected origin scope"*, así que el filtro de
   origen funciona; con la página de Apple dice *"The current document is outside the
   permitted HTTP(S) origin scope"*. No lo resolvimos.
2. **Ese Chromium tampoco pudo navegar a internet.** El entorno tiene proxy obligatorio
   (`HTTPS_PROXY=http://qoder:…@127.0.0.1:42025`). Chromium lo usa pero no tiene
   credenciales: `Page.navigate` → `net::ERR_INVALID_AUTH_CREDENTIALS`, evento CDP
   `Network.responseReceived status 407`. Playwright, que hereda las credenciales, sí navega.
3. **`export-web-scripts`**: rechaza el bundle con `capturePath: invalid_format`
   ("Expected a valid … capture, with retained script sources or response bytes"). El
   escenario se corrió con `response_body: false`, así que no hay cuerpos de script retenidos
   que exportar. Sin intentos adicionales.
4. **No hay números de `getComputedStyle`.** Las acciones de `capture_browser_scenario` son
   sólo `goto`, `click`, `fill`, `press`, `select_option`, `check/uncheck`, `wait_for`,
   `request`, `wait_for_timeout`: no existe acción de evaluar JavaScript. Y el `dom` que
   captura es el HTML serializado, no los estilos resueltos. Todo lo tipográfico de abajo
   sale del **CSS fuente que Apple sirve**, no del navegador.

### La vía que sí dio los números

Del `url` de cada stylesheet observado en la red capturada por REA, descargué los cinco
archivos reales (`curl` con User-Agent de Chrome):

```
css/main.built.css              178 451 B   (200)
css/overview.built.css          119 975 B   (200)
css/ac-localnav.built.css        81 358 B   (200)
css/globalheader.css            170 263 B   (200)
css/ac-globalfooter.built.css    63 918 B   (200)
css/iphone-overview.built.css   597 005 B   (200)  ← /v/iphone/home/cl/built/styles/
css/wss-fonts.css                17 016 B   (200)  ← /wss/fonts?families=SF+Pro,v3|SF+Pro+Icons,v3
```

Las guías de Apple se piden como Markdown: cada página HIG expone
`<link rel="alternate" type="text/markdown" href="…/<tema>.md">`. Descargadas 12 en
`hig/` (typography 75 371 B, color 41 938 B, sf-symbols 33 380 B, icons 27 019 B,
accessibility 26 384 B, materials 21 581 B, buttons, writing 11 757 B, dark-mode 11 779 B,
motion, foundations). La URL sin `.md` responde un caparazón de 18 KB con
*"This page requires JavaScript"*.

---

## Escala tipográfica de Apple

### Familia y pesos servidos

Apple **sí sirve SF Pro como webfont**, desde su propio dominio. Los 8 archivos que pidió
la página de Apple Cash:

```
/wss/fonts/SF-Pro-Display/v3/sf-pro-display_semibold.woff2   (peso 600)
/wss/fonts/SF-Pro-Display/v3/sf-pro-display_bold.woff2       (peso 700)
/wss/fonts/SF-Pro-Text/v3/sf-pro-text_regular.woff2          (peso 400)
/wss/fonts/SF-Pro-Text/v3/sf-pro-text_medium.woff2           (peso 500)
/wss/fonts/SF-Pro-Text/v3/sf-pro-text_semibold.woff2         (peso 600)
/wss/fonts/SF-Pro-Text/v3/sf-pro-text_regular-italic.woff2
/wss/fonts/SF-Pro-Icons/v3/sf-pro-icons_regular.woff2        (peso 400)
/wss/fonts/SF-Pro-Icons/v3/sf-pro-icons_medium.woff2         (peso 500)
```

iPhone usa Display regular + semibold. La hoja `/wss/fonts?families=SF+Pro,v3|SF+Pro+Icons,v3`
define **45 bloques `@font-face`**: SF Pro Display y SF Pro Text en pesos 100·200·300·400·500·600·700·800·900
(ultralight→black), cada uno con su itálica; SF Pro Icons en los mismos 9 pesos sin itálica.
Es decir: la paleta de pesos disponible es completa, pero la landing de Apple Cash consume
sólo 400/500/600/700.

El `font-family` que declara el CSS, tal cual:

```css
/* titulares */  SF Pro KR, SF Pro Display, SF Pro Icons, Apple Gothic, HY Gulim,
                 MalgunGothic, HY Dotum, Lexi Gulim, Helvetica Neue, Helvetica, Arial, sans-serif
/* cuerpo */     SF Pro HK, SF Pro TC, SF Pro Text, SF Pro Icons, PingFang HK,
                 Helvetica Neue, Helvetica, Arial, sans-serif
```

O sea: fallbacks por escritura (KR/JP/TC/HK/SC) delante de la latín, y `Helvetica Neue`
como último recurso antes de `sans-serif`.

### Roles medidos (Apple Cash, `overview.built.css` + `main.built.css`)

Apple no usa `rem` en estas hojas: **cero declaraciones `rem`** en padding/margin y tamaños
en `px` planos, con saltos de breakpoint en `max-width: 1068px` y `max-width: 734px`
(y `min-width: 1800px` para el hero XL). Columna "≥1069" = escritorio grande.

| Rol | Escritorio | Tablet (≤1068) | Móvil (≤734) | Peso | line-height | letter-spacing |
| --- | --- | --- | --- | --- | --- | --- |
| `.typography-headline-standalone-xl-hero` (y `.section-hero .typography-headline-standalone`) | **120 px** | 120 px | — | 600 | **1** | 0em |
| `.typography-headline-standalone` | **96 px** | 80 px | 48 px | 600 | 1.0416666667 / 1.05 / 1.0834933333 | −0.015em / −0.015em / −0.003em |
| `.typography-card-header-large` | **90 px** | 64 px | 64 px | 700 | 1.0888888889 / 1.03125 / 1.0625 | 0em |
| `.typography-card-header-xl` | **80 px** | 56 px | 48 px | 700 | 1.05 / 1.0714285714 / 1.0834933333 | 0em |
| `.typography-headline-super-bold` | **80 px** | 56 px | 56 px | 700 | 1.05 / 1.0714285714 / 1.1428571429 | 0em |
| `.typography-modal-headline` | 64 px | 48 px | 40 px | 600 | **1** | 0em |
| `.typography-router-section-headline` | 64 px | 48 px | 32 px | 600 | 1.0625 / 1.0834933333 / 1.125 | −0.009em / −0.003em / 0em |
| `.typography-card-header-small` | 56 px | 40 px | — | 700 | 1.0714285714 / 1.1 | 0em |
| `.typography-card-header-small-xtra-mobile` | — | — | 48 px | 700 | 1.0834933333 | 0em |
| `.typography-card-header-medium` | 56 px | 42 px | 40 px | 700 | 1.0714285714 / 1.4286314286 / 1.3 | 0em |
| `.typography-paragraph` (bajada del hero, párrafo destacado) | **32 px** | 28 px | 21 px | **600** | 1.125 / 1.1428571429 / 1.2380952381 | 0em |
| `.typography-tile-backface-headline` | 24 px | 21 px | — | 600 | 1.1666666667 / 1.1904761905 | 0em |
| `.typography-body-tight-semibold` | 17 px | 14 px | — | 600 | 1.2353641176 / 1.3571828571 | 0em / −0.037em |
| `.typography-message-box` | 17 px | 15 px | 14 px | 500 | 1.2941176471 / 1.2666666667 / 1.2857742857 | **−0.02em** |
| `.typography-tile-backface-copy` (párrafo de tarjeta) | 17 px | 14 px | — | 400 | 1.2353641176 / 1.2857742857 | 0em |
| `.typography-router-cta` (texto del botón secundario) | 14 px | 14 px | — | 400 | 1.2857742857 | −0.016em |

Lectura de lo que importa:

- **El titular grande pesa 600, no 700.** 700 es para las cabezas de tarjeta
  (`card-header-*`) y para `headline-super-bold`. Dos registros de grosor, no uno.
- **El interlineado del display es casi 1.** 1.05 en 80 px, 1.0416 en 96 px, 1.0 en 120 px.
  En móvil sube a ~1.08. Nunca llega a 1.4 en un titular.
- **El tracking se aprieta en los titulares grandes y se deja en 0 en las tarjetas.**
  −0.015em en 96/80 px, −0.009em en 64 px, −0.003em en 48 px, 0em en 120 px.
  En textos de 14-17 px también aparece negativo: −0.016em, −0.02em, hasta −0.037em.
- **La bajada del hero va en 600 y a 32 px**, no en 400 ni en 18 px. Es un segundo titular,
  no un párrafo.
- La escala base de cuerpo es **17 px** (el estándar de Apple en web), con 14 px como
  variante compacta y 21 px como párrafo corto de impacto.

### Página de producto canónica (`/v/iphone/home/cl/built/styles/overview.built.css`)

| Rol | Escritorio | ≤1068 | ≤734 | Peso | line-height | letter-spacing |
| --- | --- | --- | --- | --- | --- | --- |
| `.typography-page-header-title` | 80 px | 64 px | 48 px | 600 | 1.05 / 1.0625 / 1.0834933333 | −0.015em / −0.009em / −0.003em |
| `.typography-priority-router-card-headline` | 56 px | 48 px | 32 px | 600 | 1.0714285714 / 1.0834933333 / 1.125 | −0.005em / −0.003em / +0.004em |
| `.typography-section-header-headline` | 48 px | 40 px | 32 px | 600 | 1.0834933333 / 1.1 / 1.125 | −0.003em / 0em / +0.004em |
| `.typography-banner-card-headline` | 28 px | 24 px | 21 px | 600 | 1.1428571429 / 1.1666666667 / 1.1904761905 | +0.007em / +0.009em / +0.011em |
| `.typography-feature-card-label` | 17 px | 14 px | — | 600 | 1.2353641176 / 1.2857742857 | −0.022em / −0.016em |

Nota útil: en iPhone el título de la página mide 80 px y **al bajar de 734 px sube a 48 px
por otra ruta** (los breakpoints están anidados); el patrón estable en todo el sistema es
que al achicar el ancho el tamaño cae y el interlineado sube, porque hay menos caracteres
por línea.

### Cuántas palabras tienen los titulares (del DOM real)

Apple Cash (`apple-cash-dom.html`), todos en `<h2>` dentro de `<main>`:

- `Send it. Spend it. Stash it.` — rol `typography-headline-standalone typography-hero-headline`
- `It's ready. Already in Wallet.` — `typography-card-header-xl`
- `Send cash with a tap.` / `Send cash with a text.` — `typography-card-header-small`
- `Built into the Wallet App` — `typography-tile-backface-headline`
- `Fraud is no match for your face (or finger).` — `typography-card-header-small`
- `Apple Cash Family. Get the kids in on this.` — `typography-card-header-xl`
- `Hey Siri, send $35 to Sarah` — `typography-card-header-small`
- `Send. Reload. Repeat.` — `typography-card-header-small`
- Preguntas del acordeón en `<h3 class="accordion-title">`: `What is Apple Cash?`,
  `How do I send money with Apple Cash?`, `Can I send Apple Cash to my kids?`

iPhone (`iphone-dom.html`):

- `<h1 class="page-header-title typography-page-header-title">iPhone</h1>` — una palabra
- `Explore the lineup.` · `Upgrade to iPhone.` · `iPhone essentials.` · `Significant others.`
  — `section-header-headline`
- `Why Apple is the best place to shop iPhone.` — `section-header-headline` (dos veces)
- `Discover how easy it is to switch.` — `banner-card-headline`
- Tarjetas: `iPhone Duo`, `iPhone 18 Pro` con prefijo `New`; etiquetas `Apple Upgrade`,
  `Carrier Deals`, `Apple Trade In` en `feature-card-label`

MacBook Pro (`macbook-pro-dom.html`): `<h1>` está marcado `visuallyhidden` (el logo visual
hace de título) y los nombres viven en `product-tile-product-id` con el badge `New` delante.

Patrones confirmables:

1. **Titulares de 2 a 4 palabras**, con punto final. `Send it. Spend it. Stash it.` son tres
   frases de tres palabras separadas por punto, no una oración larga.
2. **Ritmo tricolon y rima interna** (`Send. Reload. Repeat.`, `Send cash with a tap.` /
   `Send cash with a text.`): la misma estructura repetida con una palabra cambiada.
3. **El `<h1>` real es el nombre del producto, invisible cuando el logo ya lo dibuja.**
   Sirve para accesibilidad y SEO; lo visible es imagen.
4. **Cadena titular → liga de texto**, no titular → botón gigante. En `<main>` de Apple Cash
   las ligas son `Learn more about Apple Pay`, `Learn how to send money with Tap to Cash`,
   `Learn more about Savings`, y los botones del router dicen exactamente `Learn more`
   (clase `router-cta typography-router-cta`). La fórmula es *Learn more about <cosa>*,
   nunca "Click here".
5. **Bandas alternadas a sangre completa**: `section section-hero` lleva
   `background-color:#000`, `section-spend-it` y `section-routers` llevan `#1d1d1f`,
   y `section-faq` añade la clase `theme-dark`. El alterne blanco/negro es literalmente
   cambio de `background-color` en la sección, sin márgenes laterales.

---

## Color y superficies

Tokens que aparecen en el CSS de Apple Cash, con cuántas veces se usan:

| Uso | Valor | Ocurrencias |
| --- | --- | --- |
| Fondo oscuro de banda | `#1d1d1f` | 8 (main+overview) |
| Fondo negro (hero, bandas) | `#000` | 9 |
| Fondo claro Apple | `#f5f5f7` | 6 |
| Fondo gris claro | `#e8e8ed` | 2 |
| Fondo oscuro profundo | `#121212` | 2 |
| Gris medio (borde/secundario oscuro) | `#333336` | 2 |
| Tinta principal sobre claro | `#1d1d1f` | — |
| Tinta secundaria claro | `#6e6e73` | 2 (+`rgba(110,110,115,.8)`) |
| Tinta terciaria | `#86868b` | 2 (+`rgba(134,134,139,.8)`) |
| Gris claro sobre oscuro | `#a1a1a6` | 1 |
| Gris medio sobre oscuro | `#515154` | 1 |
| Azul CTA primario | `#0071e3` | 7 |
| Azul hover | `#0077ed` | 2 |
| Azul activo/pulsado | `#006edb` | 2 |
| Liga azul sobre fondo oscuro | `#2997ff` | 5 |
| Liga azul estilo iOS | `#007aff` | 1 |
| Liga azul institucional | `#06c` | 2 |
| Scrim modal | `rgba(0,0,0,.48)` | 2 |
| Sombra suave | `rgba(0,0,0,.08)` | 2 |
| Beige (testimonio) | `#d9d6cc` | 1 |
| Vidrio claro | `rgb(29,29,31,.80)` | 1 |

iPhone añade los mismos en notación `rgb()`: `rgb(232,232,237)`, `rgb(245,245,247)`,
`rgb(29,29,31)`, `rgb(0,113,227)` (= `#0071e3`), `rgb(51,51,54)`, más veladuras
`rgba(210,210,215,0.64)`, `rgba(66,66,69,0.72)`, `rgba(0,0,0,0.42)`, `rgba(0,0,0,0.48)`,
`rgba(255,255,255,0.36)`, `rgba(255,255,255,0.4)` y un acento amarillo `#ffe045`.

**Modo oscuro.** No es inversión: los tokens cambian de familia. En `globalheader.css`:

```css
/* claro */ #globalnav{--r-globalnav-color: rgba(0,0,0,.8);
             --r-globalnav-color-secondary:#333336; --r-globalnav-color-hover:#000000}
/* oscuro */ #globalnav.globalnav-dark,.theme-dark #globalnav{
             --r-globalnav-color: rgba(255,255,255,.8);
             --r-globalnav-color-secondary:#E8E8ED; --r-globalnav-color-hover:#FFFFFF}
```

Y en los botones, `.theme-dark` invierte la jerarquía del neutro:
`.button-neutral` pasa de `#1d1d1f`/blanco a `#f5f5f7`/negro (hover `#fff`, activo `#ededf2`),
`.button-secondary` de `#e8e8ed`/negro a `#333336`/blanco (hover `#353538`, activo `#303033`),
`.button-secondary-alpha` de `rgba(0,0,0,.08)` a `rgba(255,255,255,.2)`.
El azul primario **no cambia** entre modos: `#0071e3` en los dos.

Tinte de tinta al 80% y 88-92% de opacidad en lugar de blanco/negro puros: ésa es la firma.

**Radios observados:** `980px` (pastilla del botón), `40px`, `30px`, `23px`, `20px`, `18px`,
`12px`, `10px`, `8px`, `6px`, `5px`. Para tarjetas grandes 18-23 px y 20-40 px; los radios
chicos (5-12 px) aparecen en variantes `button-block`, no en el botón pastilla.

**Sombras:** casi no hay. Tres instancias de `box-shadow: 4px 12px 40px 6px rgba(0,0,0,.09)`
y un anillo de foco `0 0 0 4px rgba(0,125,250,0.6)`. La profundidad se hace con color plano
de banda, no con sombra.

**Desenfoque/translucidez:** ver Navegación.

**Hueco:** no obtuve valores de `--sk-focus-*` globales ni una tabla formal de tokens
de color de apple.com (Apple no publica tokens nombrados en el web; lo anterior son
literales del CSS).

---

## Ritmo y layout

**Anchos de contenedor.** El sistema trabaja sobre tres anchos de contenido, no sobre uno:

- `max-width: 1068px` — columna del contenido en escritorio (154 ocurrencias en
  overview de Apple Cash, 93 en main; 154 en iPhone)
- `max-width: 734px` — tableta (97 en main, 51 en overview, 195 en iPhone)
- `min-width: 320px` — piso del layout; `480px` aparece como variante angosta
- Los media queries del sistema cortan exactamente en **734 px y 1068 px**
  (y 480 px en iPhone); `1800px`/`min-width:1800px` activa el hero de 120 px.

Las imágenes responsivas confirman los mismos cortes con `srcset`:
`media="(max-width:734px)"` → `_small`, `(max-width:1068px)` → `_medium`,
`(max-width:1799px)` → `_large`, `(min-width:0px)` → `_xlarge`.

**Padding vertical de secciones** (Apple Cash, `overview.built.css`):

| Sección | Escritorio | ≤1068 | ≤734 |
| --- | --- | --- | --- |
| `.section-hero` | `padding-top: 52px` sobre `background-color:#000` | — | — |
| `.section-spend-it` (`#1d1d1f`) | `152px 0 0` | `100px 0 0` | `70px 0 0` (`70px 10px 0`) |
| `.section-routers` (`#1d1d1f`) | `79px 0 100px` | `70px 0` | `54px 0 60px` |
| `.section-faq .section-headline` | `padding-top: 165px` | 112 px | 90 px |
| `.section-tiles-grid` (`main.built.css`) | `155px 0 179px` | `101px 0 122px` | `71px 0 102px` |
| `.section-tiles-grid .section-content` | — | — | `0 10px` |

iPhone define los mismos ritmos como variables, y ahí se ve la intención del sistema:

```css
--global-section-padding: 144px | 120px | 112px
--global-section-aap-padding: 224px | 176px | 144px
--global-section-padding-top-reduced: 120px | 80px | 56px
--global-page-header-top-offset: 96px | 72px | 40px
--global-page-header-bottom-offset: 56px | 40px | 32px
--global-page-header-col-gap: 80px | 64px
.content-container { height: auto; padding: 92px 0 }
--content-container-v-padding: 48px | 56px | 40px | 32px | 28px
--content-container-sosumi-v-margin: 16px | 8px      /* notas al pie */
```

**Patrón de bloque a sangre completo.** Cada banda es `<section class="section section-xxx">`
con `background-color` propio y `width:100%`, y adentro un `.section-content` que limita a
1068 px. La banda negra o blanca toca los bordes de la ventana; el texto no. Los grises
`#f5f5f7` / `rgb(245,245,247)` hacen de banda clara neutra entre negras.

**Retícula.** Ancho fijo en píxeles, sin `rem`: los múltiplos frecuentes son 4, 8, 10, 12,
16, 18, 20, 22, 24, 28, 32, 40, 48, 56, 60, 64, 70, 72, 80, 96, 100, 112, 120, 144, 152,
155, 165, 176, 179, 205, 224. Base 8 px para espaciado estructural, 4 px para ajustes finos,
más una capa fluida (`calc(... * var(--r-*-text-zoom-factor))`) para zoom de texto.

**Proporciones internas:** `--accordion-title-max-width: 83.3333333333%` y
`--accordion-content-paragraph-max-width: 83.3333333333%` (5/6 del contenedor), con la
columna en grillas de porcentajes `8.3333333333%` → `91.6666666667%`, es decir
**retícula de 12 columnas**.

**Hueco:** no medí el alto real renderizado de ninguna sección (haría falta
`getComputedStyle`/`getBoundingClientRect`, que REA no expone en este camino). Los números
de arriba son los declarados en CSS.

---

## Navegación y CTA

### Barra global (`globalheader.css`)

```css
#globalnav{position:absolute;top:0;right:0;left:0;z-index:9999;width:100%;
           min-width:320px;height:48px;max-height:44px;font-size:17px;
           backdrop-filter:var(--globalnav-backdrop-filter)}
#globalnav{--globalnav-backdrop-filter: saturate(180%) blur(20px);
           --globalnav-background: rgba(250,250,252,.8)}
#globalnav{--r-globalnav-height: 44px; ...}      /* y 48px en la variante alta */
```

- **Altura: 44 px** (`--r-globalnav-height: 44px`, `max-height:44px`, `.globalnav-item{height:44px}`)
  con **48 px** en la variante moderna (`height:48px`, `--r-globalnav-height: 48px`).
- **Translucidez: `saturate(180%) blur(20px)`** sobre fondo `rgba(250,250,252,.8)` en claro.
  Con scrim abierto: `rgba(250,250,252,.92)`. En oscuro: `rgba(22,22,23,.88)` y `rgba(22,22,23,.8)`.
  Con `prefers-reduced-transparency` (o equivalentes) el filtro se apaga:
  `--globalnav-backdrop-filter: initial`.
- **Tinta de los enlaces: `rgba(0,0,0,.8)`** en claro, `rgba(255,255,255,.8)` en oscuro;
  hover a `#000000` / `#FFFFFF`; secundario `#333336` / `#E8E8ED`.
- **Tipografía de la barra: `font-size:17px`** en el nivel 1, `12px` en submenús,
  `19px`/`24px`/`28px` en los flyouts.
- Telón trasero de flyout: `background:rgba(0,0,0,.4)`. Separador del mensaje superior:
  `--globalmessage-segment-scrim-background: rgba(0,0,0,.04)`.
- `--r-globalnav-flyout-spacing: 88px`.

### Sub-navegación de producto (`ac-localnav.built.css`)

```css
--r-localnav-height: calc(52px * var(--r-localnav-text-zoom-factor))   /* y calc(48px * …) */
--r-localnav-min-width: 1024px;  /* 320px en responsive */
--r-localnav-content-padding: 22px;  /* 16px en estrecho */
--r-localnav-gn-height: var(--r-globalnav-height, 44px);
--r-localnav-actions-button-space-before: 24px;
--r-localnav-actions-button-space-between: 10px;
--r-localnav-actions-menucta-space-after: 16px;
--r-localnav-actions-padding-end: max(16px, var(--r-localnav-safe-area-inset-end));
--r-localnav-margin-bottom: calc(-1 * var(--r-localnav-height));   /* el contenido sube bajo la barra */
```

Colores: `rgb(250,250,252)` sólido, `rgba(250,250,252,0.92)`, `rgba(250,250,252,0.8)`,
`rgba(232,232,237,0.4)`, `rgb(22,22,23)`, `rgba(22,22,23,0.88)`, `rgba(51,51,54,0.4)`.
Título con opacidad 0.88/0.92 y subhead con 0.56/0.61/0.64 — jerarquía por transparencia,
no por color distinto. Foco: `--localnav-focus-color: var(--sk-focus-color,#0071e3)`,
offset 1 px (3 px dentro de contenedor). Tipografía 14 px (5 usos), 12 px, 17 px, 19 px, 21 px.

En iPhone la barra de modelos es `chapternav`: iconos de **66 px de alto**
(`--chapternav-icon-height:66px`), `--chapternav-item-inline-padding:20px`,
`--chapternav-icon-margin-bottom:10px`, etiqueta **14 px / line-height 1.2857742857**,
borde `rgb(210,210,215)` claro y `rgb(66,66,69)` oscuro, badge "New" en `rgb(182,68,0)`
claro / `rgb(255,121,27)` oscuro, hover del icono `scale 1.04`.

### Botones (`main.built.css`)

| Variante | font-size | line-height | peso | padding | radius | fondo / texto |
| --- | --- | --- | --- | --- | --- | --- |
| `.button` (primario) | **17 px** | 1.1764805882 | 400 | **8px 16px** | **980px** | `#0071e3` / `#fff` |
| `.button:hover` | | | | | | `#0077ed` |
| `.button:active` | | | | | | `#006edb` |
| `.button-super` | 17 px | 1.1764805882 | 400 | **18px 31px** | 980px | igual |
| `.button-elevated` | 17 px | 1.1764805882 | 400 | **12px 22px** | 980px | igual |
| `.button-reduced` | 12 px | 1.3333733333 | 400 | **4px 11px** | 980px | igual |
| `.button-neutral` | 17 px | idem | 400 | 8px 16px | 980px | `#1d1d1f` / `#fff` (hover `#272729`, activo `#18181a`) |
| `.button-secondary` | 17 px | idem | 400 | 8px 16px | 980px | `#e8e8ed` / `#000` (hover `#ebebf0`, activo `#e6e6eb`) |
| `.button-secondary-alpha` | 17 px | idem | 400 | 8px 16px | 980px | `rgba(0,0,0,.08)` / `#000` (hover `.07`, activo `.09`) |
| `.button-block` | — | — | — | — | **8px** (super 12, elevated 10, reduced 5) | ocupa el ancho |

Alturas resultantes del primario: 17×1.176 ≈ 20 px de texto + 16 px de padding vertical
≈ **36 px**; `.button-super` ≈ **54 px**; `.button-elevated` ≈ **44 px**.
`min-width` declarado: 28 px (base), 26 px (elevated), 23 px (reduced). iPhone lo expresa
como kit: `--sk-button-min-width-basis: 45px | 60px | 70px | 90px`,
`--sk-button-padding-horizontal: 11px | 16px | 22px | 31px`,
`--sk-button-padding-vertical: 4px | 9px | 12px | 18px`,
`--sk-button-border-radius: 5px | 8px | 10px | 12px | 980px`,
y **`--sk-button-backdrop-filter: blur(20px)`** en las variantes de vidrio.

Jerarquía observada en el DOM: el par canónico es
`Learn more` (`.button.product-tile-button`, primario azul) + `Buy`
(`.icon-wrapper.product-tile-link`) + `Learn more` secundario
(`.button.product-tile-cta-secondary`). Sobre banda oscura, el primario sigue siendo
azul `#0071e3` y la liga de texto pasa a `#2997ff`.

Chevron de las ligas: se dibuja con glifos privados de **SF Pro Icons** vía pseudo-elemento
— `content:"\uea07" "\uea08" "\uea09" "\uea14" "\uea15" "\uea16" "\uea1d" "\uea1e"` y
`\uf300`–`\uf305` — con `.icon-after:after, .more:after { padding-left: 0.3em; top: 0 }`.
O sea: la flechita es un carácter de la webfont de iconos, no un SVG ni un SF Symbol incrustado.

### Lo que dice la HIG sobre objetivos táctiles y botones

- **Un botón necesita un área táctil de al menos 44x44 pt** (60x60 pt en visionOS).
  Texto literal: *"a button needs a hit region of at least 44x44 pt — in visionOS, 60x60 pt —
  to ensure that people can select it easily"* — `hig/buttons.md`.
- Tamaño de control recomendado: **iOS/iPadOS 44x44 pt por defecto, mínimo 28x28 pt**;
  watchOS igual. Tabla en `hig/accessibility.md`.
-visionOS: alturas de botón Mini 28 pt, Small 32 pt, Regular 44 pt, Large 52 pt, Extra large 64 pt;
  separar centros de botones **al menos 60 pt**.
- *"Prefer capsule-shape buttons"* y *"the more rounded a button's shape, the easier it is for
  people to look steadily at it"* — justificación formal de `border-radius: 980px`.
- *"Prefer buttons that span the width of the screen for primary actions"*; si dos botones
  comparten fila, **misma altura para ambos**.
- Imagen dentro de botón: **~10 px de padding** entre el borde de la imagen y el del botón.

**Hueco:** no obtuve el tamaño de objetivo táctil específico de los enlaces de la barra
global de apple.com (sería `44x44 px` por `height:44px` del item, pero el ancho no está
declarado explícito).

---

## Contraste y modo oscuro según la HIG

De `hig/accessibility.md` (WCAG nivel AA, citado textual):

| Tamaño de texto | Peso | Ratio mínimo de contraste |
| --- | --- | --- |
| Hasta 17 pt | Todos | **4.5:1** |
| 18 pt | Todos | **3:1** |
| Todos | Bold | **3:1** |

De `hig/dark-mode.md`:

- *"At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1.
  For custom foreground and background colors, strive for a contrast ratio of **7:1**,
  especially in small text."*
- *"The color palette in Dark Mode includes dimmer background colors and brighter foreground
  colors. It's important to realize that these colors aren't necessarily inversions of their
  light counterparts."*
- *"Soften the color of white backgrounds"* — oscurecer ligeramente una imagen con fondo blanco
  para que no brille dentro del contexto oscuro. Esto explica `#f5f5f7` en vez de `#fff`.
- Verificar el contraste **en ambos modos**, y probar con Increase Contrast y Reduce Transparency
  activados por separado y juntos.

Tamaños legibles de la HIG (`hig/typography.md`): iOS/iPadOS **17 pt por defecto, 11 pt mínimo**;
macOS 13/10; tvOS 29/23; visionOS 17/12; watchOS 16/12. Y una restricción de peso que
conviene respetar: *"In general, avoid light font weights… prefer Regular, Medium, Semibold,
or Bold… avoid Ultralight, Thin, and Light, which can be difficult to see, especially when
text is small."*

Guía de leading/tracking de la HIG: *loose leading* para columnas anchas o pasajes largos,
*tight leading* cuando la altura está restringida, y **"if you need to display three or more
lines of text, avoid tight leading"**. El tracking del SF Pro se ajusta dinamicamente por
tamaño; la tabla iOS da, por ejemplo, −26/1000 em a 17 pt, −20 a 16 pt, −11 a 14 pt, 0 a 12 pt,
+6 a 11 pt, +14 a 29-30 pt. Ojo: eso es *tracking de app nativa*; la landing debe guiarse por
los valores del CSS de apple.com de la tabla de arriba, que son los de web.

Materiales (`hig/materials.md`): Liquid Glass sólo para elementos interactivos, **nunca en la
capa de contenido**; variante *regular* "blurs and adjusts the luminosity of background content";
variante *clear* es "highly translucent" y se reserva para componentes que flotan sobre medios;
sobre contenido brillante, *"consider adding a dark dimming layer of 35% opacity"*.

---

## Redacción

Reglas textuales de Apple, de `hig/writing.md` (descargado como Markdown oficial,
`https://developer.apple.com/design/human-interface-guidelines/writing`):

- **Voz propia y deliberada.** *"Determine your app's voice. Think about who you're talking to,
  so you can figure out the type of vocabulary you'll use… Create a list of common terms, and
  reference that list to keep your language consistent."*
- **Tono según contexto.** *"Once you've established your app's voice, vary your tone based on
  the situation."* Ejemplos citados: el mensaje de Fall Detection (directo y serio) contra el de
  Move streak (ligero y felicitador).
- **Claridad y brevedad.** *"Be clear. Choose words that are easily understood and convey the
  right thing. Check each word to be sure it needs to be there. If you can use fewer words, do so.
  When in doubt, read your writing out loud."*
- **Sin jerga.** *"Choose simple, plain language and write with accessibility and localization in
  mind, avoiding jargon and gendered terminology."*
- **Voz activa y verbos en los labels.** *"Be action oriented. Active voice and clear labels help
  people navigate… When labeling buttons and links, it's almost always best to use a verb.
  Prioritize clarity and avoid the temptation to be too cute or clever with your labels. For
  example, just saying 'Send' often works better than 'Let's do it!'"*
- **Nada de "Click here".** *"For links, avoid using 'Click here' in favor of more descriptive
  words or phrases, such as 'Learn more about UX Writing.' This is especially important for
  people using screen readers."* — esto es lo que valida el patrón real de Apple Cash:
  `Learn more about Apple Pay`, `Learn more about Savings`.
- **Importante primero.** *"Pay attention to the order of elements on a screen, and put the most
  important information first."*
- **Patrones de lenguaje.** *"Build language patterns. Consistency builds familiarity, helping your
  app feel cohesive, intuitive, and thoughtfully designed."*
- **Mayúsculas: elegir y sostener.** *"Title case is generally considered formal, while sentence
  case is more casual. Choose a style for each UI element type and use it consistently throughout
  your app — for example, title case for all alerts or sentence case for all headlines."*
  (Coherente con lo observado: los titulares de Apple Cash van en sentence case con punto final.)
- **Flujos multi-paso.** *"Begin with language like 'Get Started'… You can use the button label to
  hint at the next step, or use terms like 'Continue' or 'Next,' but be consistent… Make it clear
  when a flow is complete by using language like 'Done.'"*
- **Pronombres posesivos con moderación, y nunca "we".** *"Possessive pronouns like my and your are
  often unnecessary… 'Favorites' conveys the same message as 'Your Favorites,' and is more succinct…
  Avoid using we altogether because it may be unclear who the 'we' in question refers to. This is
  particularly problematic in error messages like 'We're having trouble loading this content.'
  Something like 'Unable to load content' is much clearer."*
- **Sin "click" en táctil.** *"Make sure you describe gestures correctly on each device — for example,
  not saying 'click' for a touch device like iPhone or iPad where you mean 'tap.'"*
- **Brevidad obligada en pantalla grande.** *"Bigger screens also require brevity, as the text must be
  large for people to see it from a distance."*
- **Estados vacíos con siguiente paso.** *"An empty state… can provide a good opportunity to make people
  feel welcome… guide people on actions they can take, and give them a button or link to do so if possible…
  empty states are usually temporary, so don't show crucial information that could then disappear."*
- **Errores sin culpa y accionables.** *"display it as close to the problem as possible, avoid blame, and
  be clear about what someone can do to fix it. For example, 'That password is too short' isn't as helpful
  as 'Choose a password with at least 8 characters.'… Interjections like 'oops!' or 'uh-oh' are typically
  unnecessary and can sound insincere."*
- **Campos de texto.** *"Use only letters for your name" is better than "Don't use numbers or symbols."
  Avoid robotic error messages with no helpful information, like "Invalid name."*

Recurso canónico de referencia, listado en la propia página: **Apple Style Guide**,
`https://help.apple.com/applestyleguide/#/` y su sección *Writing inclusively*,
`https://help.apple.com/applestyleguide/#/apdcb2a65d68`.

**Hueco:** no bajé el Apple Style Guide completo (es un Help Book de varias secciones);
para reglas de ortotipografía específica (coma Oxford, cifras, símbolos de moneda) haría
falta esa fuente y no la tengo extraída aquí.

---

## Iconografía y licencia de SF Symbols

Qué dice Apple de SF Symbols, textual de `hig/sf-symbols.md` y de
`https://developer.apple.com/design/resources/`:

- *"SF Symbols is a library of over 7,000 symbols designed to integrate seamlessly with San
  Francisco, the system font for Apple platforms."*
- *"Each of the nine symbol weights — from ultralight to black — corresponds to a weight of the
  San Francisco system font, helping you achieve precise weight matching between symbols and
  adjacent text."*
- *"Each symbol is also available in three scales: small, medium (the default), and large. The scales
  are defined relative to the cap height of the San Francisco system font."*
- *"Symbols come in nine weights and three scales, automatically align with text, and can be exported
  and edited using vector graphics tools to create custom symbols."*
- Símbolos personalizados: *"first export the template for a symbol that's similar to the design you
  want, then use a vector-editing tool to modify it."*
- Íconos de interfaz propios: *"If you create a custom interface icon, use a vector format like PDF or
  SVG"* (`hig/icons.md`).

### La restricción de licencia

Dos hechos documentados, y hay que decirlos con precisión porque el equipo ya los conoce:

1. **La licencia de la fuente San Francisco limita el uso a plataformas Apple.**
   `https://developer.apple.com/fonts/`, encabezado de la sección de licencia:
   > **"LICENSE AGREEMENT FOR THE APPLE SAN FRANCISCO FONT — For iOS, OS X and tvOS application uses only"**
   >
   > *"IMPORTANT NOTE: THE APPLE SAN FRANCISCO FONT IS TO BE USED SOLELY FOR CREATING MOCK-UPS OF USER
   > INTERFACES TO BE USED IN SOFTWARE PRODUCTS RUNNING ON APPLE'S iOS, OS X OR tvOS OPERATING SYSTEMS,
   > AS APPLICABLE."*
   >
   > *"…are licensed, not sold, to you by Apple Inc… Apple and/or Apple's licensors retain ownership of the
   > Apple Font itself and reserve all rights not expressly granted to you."*

2. **SF Symbols tiene prohibido el uso como marca.** `hig/sf-symbols.md`:
   > *"Be sure to understand the terms and conditions for using SF Symbols, including the prohibition
   > against using symbols — or images that are confusingly similar — in app icons, logos, or any other
   > trademarked use."*

   Y el enlace de descarga de la hoja de recursos apunta a
   `https://devimages-cdn.apple.com/design/resources/download/SF-Symbols-27.dmg`, con la nota
   *"Requires macOS Sonoma or later"* — es una app de escritorio de macOS, no un paquete de assets web.

Dato de campo que matiza el punto 1 y conviene tener en cuenta: **Apple sí sirve SF Pro como
webfont desde apple.com** (`/wss/fonts/SF-Pro-{Display,Text,Icons}/v3/*.woff2`, 45 `@font-face`).
O sea, la restricción escrita de la licencia habla de apps de iOS/OS X/tvOS y mockups, pero el
propio sitio de Apple usa los archivos en la web. No es una autorización para nosotros: lo
defensible para BLINK es **usar la pila tipográfica del sistema del visitante**
(`-apple-system`, `BlinkMacSystemFont`, `system-ui`) para conseguir el gesto de SF Pro sin
servir los archivos, y dibujar los iconos nosotros mismos en SVG siguiendo la geometría de la
HIG (nueve pesos, tres escalas, cap height) sin copiar ningún símbolo de SF Symbols.

Confirmación adicional: en el DOM de Apple Cash no hay SVG de iconos de interfaz — 8 `<svg>`
contra 68 `<img>`/`<picture>` (PNG/JPG con sufijos `_small/_medium/_large/_xlarge` y variante
`_2x`), y los chevrones salen de glifos privados de la webfont SF Pro Icons
(`\uea07`–`\uea1e`, `\uf300`–`\uf305`). La iconografía de marketing son imágenes rasterizadas,
no symbols.

**Hueco:** no localicé un texto de licencia de Apple que diga literalmente "los SF Symbols no
pueden servirse en un sitio web". Lo que existe y cité es (a) la restricción de la fuente a
plataformas Apple y (b) la prohibición de uso como marca/logotipo, más el hecho de que el
recurso se entrega como app de macOS. Si el equipo necesita la frase exacta, hay que leer los
términos del DMG de SF Symbols, que no vienen en la página.

---

## URLs consultadas

Página de marketing (capturadas con REA y descargadas directamente):

- `https://www.apple.com/apple-cash/`
- `https://www.apple.com/iphone/`
- `https://www.apple.com/macbook-pro/`

CSS servido por Apple (los seis primeros listados por REA en la red capturada):

- `https://www.apple.com/v/apple-cash/g/built/styles/main.built.css`
- `https://www.apple.com/v/apple-cash/g/built/styles/overview.built.css`
- `https://www.apple.com/ac/localnav/9/styles/ac-localnav.built.css`
- `https://www.apple.com/api-www/global-elements/global-header/v1/assets/globalheader.css`
- `https://www.apple.com/ac/globalfooter/8/en_US/styles/ac-globalfooter.built.css`
- `https://www.apple.com/ac/ac-films/7.5.1/styles/modal.css` *(listado, no descargado)*
- `https://www.apple.com/v/iphone/home/cl/built/styles/overview.built.css`
- `https://www.apple.com/wss/fonts?families=SF+Pro,v3|SF+Pro+Icons,v3`

Guías de Apple (Markdown oficial vía `<link rel="alternate" type="text/markdown">`):

- `https://developer.apple.com/design/human-interface-guidelines/typography.md`
- `https://developer.apple.com/design/human-interface-guidelines/color.md`
- `https://developer.apple.com/design/human-interface-guidelines/dark-mode.md`
- `https://developer.apple.com/design/human-interface-guidelines/materials.md`
- `https://developer.apple.com/design/human-interface-guidelines/icons.md`
- `https://developer.apple.com/design/human-interface-guidelines/buttons.md`
- `https://developer.apple.com/design/human-interface-guidelines/sf-symbols.md`
- `https://developer.apple.com/design/human-interface-guidelines/accessibility.md`
- `https://developer.apple.com/design/human-interface-guidelines/writing.md`
- `https://developer.apple.com/design/human-interface-guidelines/motion.md`
- `https://developer.apple.com/design/human-interface-guidelines/foundations.md`
- `https://developer.apple.com/design/resources/`
- `https://developer.apple.com/fonts/`
- `https://developer.apple.com/sf-symbols/` *(caparazón JS, sin texto de licencia)*
- `https://help.apple.com/applestyleguide/#/` *(referenciada por la HIG, no descargada)*

Archivos de evidencia en este directorio: `ev-apple-cash-scenario.json`,
`ev-iphone-scenario.json`, `ev-macbook-pro-scenario.json`, `apple-cash-dom.html`,
`iphone-dom.html`, `macbook-pro-dom.html`, `tokens-tipografia.json`, `css/`, `hig/`,
`scenario-*.json`, `log-*.txt`.
