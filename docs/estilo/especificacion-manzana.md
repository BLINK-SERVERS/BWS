# Especificación manzana — BWS landing

Documento de decisiones y lotes de ejecución. Autora: Marta (análisis), 2026-11-25.
Destinatarios: Pedro (estilos), Lucía (redacción), Carlos (componentes).

Insumos leídos completos antes de escribir: `docs/estilo/medicion-landing-antes.md`,
`docs/estilo/tokens-actuales.md`, `docs/estilo/evidencia-manzana.md` (Juan) y las notas del
repo (`README.md`, contrato de íconos en `src/styles/base.css`, encabezado de
`scripts/preparar-sf-pro.mjs`).

## 0. De dónde salió cada número (declaración obligatoria)

**Lo que NO vino de REA:** ninguna medición de Apple salió de las herramientas REA de
navegador. Quedó documentado en `evidencia-manzana.md` §"Origen y método": REA estuvo
conectado (rea-agents 6.10.1, 263 herramientas), pero `inspect_web_page`,
`capture_web_screenshot` y `analyze_web_bundle` fallaron con `target_not_allowed` por el
proxy autenticado de salida; el CDP loopback que Juan dejó abierto (puerto 9333) murió a los
minutos y mis dos sesiones contra él terminaron en `Connection refused`. Verifiqué además
por mi cuenta que playwright-core sin proxy authenticated devuelve
`net::ERR_INVALID_AUTH_CREDENTIALS` en las cuatro páginas.

**Fuente primaria real (método de Juan, citada como «Evid»):** el CSS estático descargado
con curl + UA Safari (`main.built.css`, `overview.built.css`, `globalheader.css`,
`ac-localnav.built.css`, `ac-globalfooter.built.css`) y el HTML literal de
`https://www.apple.com/apple-cash/`. Todos los valores marcados **Evid** son literales de
esos archivos.

**Fuente secundaria mía (marcada «Mía»):** mediciones propias con
playwright-core + Chromium 156 (viewport 1440×900, saliendo por el proxy autenticado con
credenciales correctas) sobre `apple-cash`, `iphone`, `macbook-pro` y
`shop/buy-airpods/airpods-pro-3`, vía `getComputedStyle` en vivo (crudos en
`/tmp/manzana-medicion.json` y `/tmp/manzana-medicion2.json`), más lectura directa del HIG
(`developer.apple.com/design/human-interface-guidelines/typography` e `icons`, vía
WebFetch/curl). El HIG confirma la estructura de estilos iOS (Large Title 34 pt Bold en XL,
Headline Semibold, Body 17 pt) y que el tracking se ajusta por tamaño óptico. La carpeta
`docs/estilo/evidencia/` conserva los registros de intentos fallidos de REA como prueba del
bloqueo; no es evidencia de valores.

Donde Evid y Mía discrepan, manda Evid (CSS fuente) y lo anoto.

## 1. Tabla de tokens

Regla: una fila por rol. «alcanzable hoy» = se puede declarar sin tocar el binario de
fuente ni librerías nuevas.

| Rol | Apple (valor y de dónde salió) | BWS actual (token, archivo:línea) | Valor propuesto | ¿Alcanzable hoy? | Por qué |
|---|---|---|---|---|---|
| Relleno de acción (claro) | `#0071e3` (Evid: `.button{background:#0071e3}` main.built.css; Mía confirmado en vivo: `rgb(0,113,227)` en iPhone/MacBook Pro) | `--color-action-fill` #0066cc (tokens.css:92; ya migrado a #0071e3 en el working tree de Pedro) | `#0071e3` | Sí | Es EL azul del botón de marketing; `#0066cc` es el enlace, no la acción. |
| Hover de acción | `#0077ed` (Evid: `.button:hover`; local nav hover `#0076DF`, active `#006EDB`) | sin token propio; `filter: brightness(1.08)` (landing.css:238) | `--color-action-fill-hover: #0077ed`, quitar el filter | Sí | El brightness() clonado no reproduce el escalón exacto de Apple. |
| Enlace sobre claro | `#06c` / `#0066cc` (Evid: "Learn more" claro; Mía: `rgb(0,102,204)` en buy-flow) | `--lp-enlace` #0066cc (landing.css:44); `--color-accent-text` #0066cc (tokens.css:106) | `#0066cc` (no cambia) | Sí | Ya coincide con Apple; el error era usarlo también de relleno. |
| Enlace sobre oscuro | `#2997ff` (Evid ×4 apariciones; Mía: `rgb(41,151,255)` en CTAs de sección oscura) | `--lp-enlace` #8cc7ff (landing.css:85) | `#2997ff` | Sí | 8cc7ff es un pastelillo; Apple usa un azul saturado legible. AA sobre negro: 5,9:1. |
| Acento decorativo (checks, íconos, gradiente hero) | `#0071e3` en marketing; el sistema iOS usa `#0A84FF` oscuro (HIG color, no recuperado en CSS de página → **hueco** para la variante oscura de marketing) | `--lp-acento` #007aff (landing.css:45) / #0091ff (landing.css:86) | claro `#0071e3`, oscuro `#2997ff` | Sí | Un solo azul por tema; ver decisión D1. |
| Anillo de foco | `box-shadow: 0 0 0 4px rgba(0,125,250,.6)` (Evid: `.button:focus`) | `--focus-ring` ya declarado por Pedro (tokens.css:307) | mantener | Sí | Literal copiado. |
| Tinta principal | `#1d1d1f` (Evid ×10; Mía en vivo `rgb(29,29,31)`) | `--lp-texto` #1d1d1f (landing.css:41) | no cambia | Sí | Ya coincide. |
| Fondo gris de sección | `#f5f5f7` (Evid; Mía midió `rgb(245,245,247)` y `rgb(250,250,252)` como segundo tono) | `--lp-fondo-alt` #f2f2f7 (landing.css:40) | `#f5f5f7` | Sí | 1 nivel de diferencia; #f2f2f7 es el sistema iOS, #f5f5f7 el de marketing. |
| Fondo oscuro de sección | `#000` hero (Evid+Mía); cuerpo `#1d1d1f`; FAQ `#161617` | `--lp-fondo` #000 (landing.css:80) | #000 en bloques protagonistas, `#1d1d1f` en secundarios oscuros | Sí | Apple alterna negro puro y casi-negro; nosotros usamos #000 plano en los tres bloques oscuros. |
| Nav translúcida (fondo) | `rgba(250,250,252,.8)` claro / `rgba(22,22,23,.8)` oscuro (Evid: globalheader.css `--globalnav-background`) | `rgba(255,255,255,.72)` (medición-antes §Nav) | `rgba(250,250,252,.8)` claro / `rgba(22,22,23,.8)` oscuro | Sí | El alpha .8 es el literal; .72 fue aproximación nuestra. |
| Nav blur | `saturate(180%) blur(20px)` (Evid: globalheader.css) | `saturate(1.8) blur(30px)` (medición-antes) | `saturate(180%) blur(20px)` | Sí | 30px es el material iOS grande; la barra de Apple usa el pequeño. |
| Altura de barra | globalnav 44 px (Mía en vivo ×4 páginas; Evid: `max-height:44px`) | `--topbar-h` 56px (tokens.css:338) | 52px para la lp-nav propia (no es la globalnav de Apple; ver nota) | Sí | Nuestra barra lleva logo + 5 enlaces + CTA; 44px es para wordmarks. Reducir a 52 acerca sin partir el layout. |
| Titular hero | 96px / **600** / lh 1.0417 / ls **−0.015em** (Evid: `.typography-headline-standalone`; Mía en vivo: 96/600/−1.44px "Send it. Spend it. Stash it.") | `--lp-fs-hero` clamp→76px, peso 700, ls −0.028em (landing.css:58, :531-538) | `clamp(2.125rem, 6.6vw, 5.5rem)` (88px tope), 600, lh 1.04, ls −0.015em | Sí (peso 600 dentro del subset) | El aire de Apple es 600 + tracking abierto, no 700 apretado. |
| Título de sección | 56–64px / 600 / ls −0.009em (Evid: router-section-headline 64/1.0625/600/−0.009; Mía: 56/600 en iPhone) | `--lp-fs-seccion` clamp→56px, 700, ls −0.022em (landing.css:59, :124-126) | 56px, **600**, lh 1.07, ls −0.009em | Sí | Idem hero. |
| Headline super-bold | 80px / **700** / lh 1.05 / ls 0em (Evid: `.typography-headline-super-bold`; Mía: "It's ready. Already in Wallet." 80/700) | no existe este nivel | opcional para PROMESA: 64px/700 (dentro de techo) | Sí | Apple sí usa 700, pero con ls 0; nunca 700 + −0.028. |
| Peso 800+ | **hueco**: ningún peso >700 apareció en Evid ni en Mía; los display de Apple paran en 700 | n/a | no se pide | — | Si el dueño quisiera 800: rehacer subset (decisión, no tarea; §3). |
| Eyebrow / antetítulo | 21px (Evid: `.typography-router-eyebrow`) | 21px / 500 (medición-antes) | 21px / 600 | Sí | 600 es el peso de énfasis de Apple; 500 queda tibio. |
| Cuerpo | 17px / 400 / lh 1.2354 (Evid: `.typography-tile-backface-copy`; Mía body 17px/400) | `--lp-fs-cuerpo` 17px (landing.css:62) | 17px, lh 1.24 | Sí | Ya coincide en tamaño; falta el interlineado literal. |
| Párrafo de sección (intro) | 32px / 600 / lh 1.125 (Evid: `.typography-paragraph`; Mía en vivo: 32/600 párrafo hero de apple-cash) | `--lp-fs-parrafo` clamp→21px, lh 1.45 (landing.css:61) | mantener 21px para bajadas; el bloque PROMESA sube a 28px/600 | Sí | Nuestra PROMESA es el equivalente al intro grande de Apple. |
| Nota legal / caption | 12px (Evid: `.button-reduced` 12px; footer 12px) | `--lp-fs-nota` 12px (landing.css:63) | no cambia | Sí | Coincide. |
| Botón: radio | `border-radius: 980px` (Evid literal; Mía en vivo `980px`) | `--radius-pill` 50px (tokens.css:243, usado en landing.css:211) | `980px` en `.lp-boton` | Sí | 50px ya se ve píldora en alturas ≤48px, pero el valor literal elimina dudas con botones grandes. |
| Botón: padding | `8px 16px` base; `18px 31px` `.button-super` (Evid; Mía en vivo: `11px 21px`, h 44px) | revisar `.lp-boton` (landing.css:~205-215) | base `8px 16px`, hero `12px 22px` (≈ medido 44px alto) | Sí | Mía muestra el render final (11/21); Evid la clase base. Para altura 44px servida, usar la variante elevada. |
| Botón: tipografía | 17px / 400 / ls −0.022em (Evid `.button` literal; Mía: 17px/400) | hereda; peso sin fijar | 17px, 400, ls −0.022em | Sí | Apple NO engorda el botón; el color hace el trabajo. |
| Contenedor | 980px → 692px ≤1068 → 87.5% ≤734 (Evid `.section-content`; Mía breakpoint funcional igual) | `--lp-ancho` 980px (landing.css:65) | 980px no cambia; adoptar quiebres 1068/734 | Sí | Nuestro clamp parte en otros valores; alinear los dos breakpoints. |
| Ritmo protagonista | 152px / 155px top, 179px bottom (Evid `.section-spend-it`, `.section-tiles-grid`) | `padding-block: clamp(3.5rem,8vw,6.5rem)` → 104px parejos (landing.css:108) | ver D2: tres niveles | Sí | 104 flat es el problema central del ritmo. |
| Ritmo medio | 144px (Mía en vivo ×6 secciones de iphone/macbook; Evid no lo lista — discrepancia menor: Apple usa 144 en las páginas nuevas) | idem | 144px fijo en desktop | Sí | |
| Ritmo compacto | 79px top / 100px bottom (Evid `.section-routers`) | idem | ~80px | Sí | Los routers/ecosistema nuestros (SOCIOS, PROMESA corta) van aquí. |
| Tile: radio | 40px → 30px ≤1068 → 20px ≤734 (Evid `.tile`) | sin superficie (medición-antes §tarjetas) | ver D4 | Sí | |
| Tile: gap | 24px × 24px, max-width 1069px (Evid `.tiles-container`) | `gap: clamp(...)×clamp(...)` → 56×86px (medición-antes) | mantener el nuestro | Sí | Nuestra parrilla es texto, no fichas; ver D4. |
| Sombra difusa | `4px 12px 40px 6px rgba(0,0,0,.09)` (Evid, única sombra de la página) | `--shadow-card` 0 1px 2px… (tokens.css:252) | nueva `--lp-sombra-tile` con el literal | Sí | Solo si algún bloque recibe superficie (D4). |
| Familia | `SF Pro Display / SF Pro Text` como dos familias (Evid; Mía en vivo: Display ≥28px, Text debajo) | una cara variable con eje `opsz` 17–28 conservado (fonts.css:77-79, preparar-sf-pro.mjs) | no cambia | Sí | Nuestro truco óptico ya reproduce el efecto sin dos familias. |
| Curva de movimiento | local nav stuck: `cubic-bezier(.28,.11,.32,1)` 240ms (Evid globalheader/localnav) | `--lp-curva` cubic-bezier(.32,.72,0,1) (landing.css:66) | no cambia | Sí | Nuestra curva ya es de desaceleración agresiva tipo Apple; cambiarla es cosmética sin ganancia medible. |

**Huecos declarados** (qué haría falta cerrarlos): (a) peso/trazo de los símbolos SF Symbols
servidos por Apple — exigiría la webfont `/wss/fonts`, que dio 404 desde esta red; (b) el
`@font-face` exacto de SF Pro de Apple (mismo 404); (c) colores de sistema iOS en modo
oscuro para acento de marketing (`#0A84FF` es del HIG/sistema, no verificado en las cuatro
páginas medidas porque todas se midieron en tema claro — serviría medir apple.com con
`prefers-color-scheme: dark`, que la mayoría de sus páginas ignora de todos modos).

## 2. Las cuatro decisiones

### D1 — Unificar los azules: tres roles, dos temas, cinco valores

Apple no funde acción y enlace: **el botón es `#0071e3` y el enlace es `#0066cc`** (ambos
Evid, ambos confirmados por mí en vivo en la misma pantalla de iphone: el CTA "Learn more"
relleno sale `rgb(0,113,227)` y el enlace de texto sale `rgb(0,102,204)`). Lo que sí sobra
en BWS es un cuarto azul decorativo (`#007AFF`/`#0091ff`) que no existe en el vocabulario de
Apple Cash.

Sistema propuesto:

| Rol | Claro | Oscuro | Token destino |
|---|---|---|---|
| Acción (relleno de botón) | `#0071e3` | `#0071e3` | `--color-action-fill` (Pedro ya lo migró, tokens.css:96) |
| Enlace de texto | `#0066cc` | `#2997ff` | `--lp-enlace` (landing.css:44 cambia 0→igual; :85 pasa de #8cc7ff a #2997ff) y `--color-accent-text` espejo |
| Acento decorativo (checks, íconos, glow del hero) | `#0071e3` | `#2997ff` | `--lp-acento` (landing.css:45: #007aff→#0071e3; :86: #0091ff→#2997ff) |

Es decir: **dos azules en claro (acción/enlace, que difieren apenas y Apple los mantiene
separados), uno en oscuro**. `#007AFF` y `#0091ff` quedan reservos al portal de la app
(`--blink-blue-*`, tokens.css:209-210), donde sí son el sistema iOS correcto; la landing no
los usa. Consecuencia AA verificable: blanco sobre `#0071e3` da 4,02:1 (pass AA grande y
normal justo); sobre el `#007AFF` anterior daba 3,36:1 (por eso el comentario defensivo en
landing.css:681) — el cambio arregla ese reproche sin trampa. Chequear con el script de
contraste o DevTools; criterio de aceptación abajo.

Tokens que se cambian: `--color-action-fill` (ya), `--color-accent-text` (tokens.css:106-107
añade variante oscura #2997ff), `--lp-enlace` (landing.css:85), `--lp-acento`
(landing.css:45 y :86). No se introduce token nuevo de acento.

### D2 — Jerarquía de ritmo: tres niveles, no ocho 104px

Apple alterna la respiración según el papel del bloque (todo Evid/Mía, filas de ritmo arriba):
152–155 px abren los bloques protagonistas, 144 px sostienen los estándar, 79–100 px cierran
los de tránsito, y el fondo cambia a sangre completa entre ellos (negro `#000`/`#1d1d1f` ↔
blanco/gris `#f5f5f7`). Ocho bloques con el mismo padding son un metrónomo: la decisión es
**tres niveles**:

| Nivel | Valor desktop (≤1068 → ≤734) | Bloques BWS |
|---|---|---|
| Protagonista | `padding-block: 152px 160px` (→ 100px → 70px) | HERO, BENEFICIOS, SERVICIOS, PROCESO |
| Estándar | `padding-block: 144px` (→ 96px → 68px) | PREGUNTAS, CIERRE |
| Compacto | `padding-block: 80px 100px` (→ 56px → 44px) | PROMESA, SOCIOS |

Implementación: reemplazar el único `clamp(3.5rem, 8vw, 6.5rem)` de `.lp-seccion`
(landing.css:108) por tres clases `lp-seccion--h1/h2/h3` que `<Seccion>` reciba por prop
`respiracion` (componente de Carlos, no de estilos: la prop vive en `Landing.tsx`). Los
valores móvil/tablet salen de los breakpoints literales de Apple (1068/734, Evid). Medible
con `getComputedStyle().paddingTop` en el script de capturas. Además: el hero de Apple mide
`calc(100svh − nav)` con mínimo 751px (Evid `.section-hero`); el nuestro es de 562px. Se
propone `min-height: min(88svh, 820px)` para el hero — alcanzable hoy, verificable en
captura.

Patrón de fondos: mantener la alternancia existente (clara/oscura ya es negro↔blanco), pero
los bloques oscuros secundarios (PROMESA, SOCIOS si queda oscura) pasan de `#000` a
`#1d1d1f` y la FAQ-equivalente (PREGUNTAS) puede usar `#161617`, literales Evid de la
escalera oscura de Apple Cash.

### D3 — El envoltorio del documento

Fórmula de Apple observada (Mía, cuatro páginas en vivo): título `Producto - Compañía` con
guion corto rodeado de espacios, **sin frase completa ni broma**: `Apple Cash - Apple` (17
caracteres), `iPhone - Apple` (12), `MacBook Pro - Apple` (16), `Buy AirPods Pro 3 - Apple`
(23). Descripción al hecho, 101–156 caracteres, tercera persona nominal o imperativo neutro:
`Designed for Apple Intelligence. Discover iPhone Duo…` (107), `Compare MacBook Pro and…`
(101). Ninguna meta description de las páginas de producto medidas es una ocurrencia.

Propuesta BWS (respetando la marca ajena — solo se nombra Blink, no hay trademark de nadie
más — y la voz del dueño, que no se toca en el `<title>` si el dueño la quiere):

- `<title>`: `Blink Web Services - Páginas web, apps y portafolios en Maracaibo` (66 car.
  — largo; alternativa de 47: `Blink Web Services - Diseño web en Maracaibo`). La forma
  canónica estricta sería `Servicios web Blink - Blink Web Services`; **queda como
  decisión del dueño cuál bajada**, porque el título actual contiene su frase
  («Solo traes dos cosas…») quemada además en `og.png`.
- `meta description`: ya la corrigió Lucía a 141 caracteres de hecho
  («Páginas web, web apps y portafolios hechos en Maracaibo. Tramitamos el nombre…») —
  aprobada, cumple la forma Apple. Falta sincronizar `twitter:description`, que sigue
  agregando la frase de remate («Del trámite y la publicación nos ocupamos nosotros.»);
  que quede solo el hecho, distinto del og para no triplicar (defecto 6 de la medición).
- `og:image:alt` (index.html:21): hoy repite el título con punto final. Apple describe la
  imagen, no re-titula. Cambiar a descripción literal del arte: `Logotipo de Blink Web
  Services sobre fondo oscuro con el texto «Solo traes dos cosas»` — ajustarlo al arte real
  de `public/og.png` cuando se regenere con `npm run og`. Mismo tratamiento en
  `twitter:image:alt` (:25).
- Regla de acoplamiento: si el dueño cambia el título, hay que regenerar `og.png`
  (`npm run og` renderiza el texto quemado) y actualizar `og:title`, `twitter:title` y los
  dos `image:alt` en la misma tanda; dejar el título viejo hasta esa decisión es lo que ya
  dictaminó el documento de jefe de diseño §10, y lo sostengo.

### D4 — Superficies de tarjeta: cero tarjetas nuevas

Lo que resuelve Apple es **aire + cambio de fondo**, no material: la parrilla de tiles de
Apple Cash (radio 40px) son fichas *interactivas* que giran (flip) hacia una cara trasera con
el párrafo completo — son el contenedor de la interacción, no decoración de texto (Evid
`.tiles-container`, HTML con backfaces; Mía midió `tile radius 0px` en reposo porque el
selector `[class*="tile"]` cayó sobre el contenedor y no sobre la ficha — discrepancia
menor, manda Evid).
Nuestros BENEFICIOS (check + título + cuerpo) y SERVICIOS (ícono + título + cuerpo) son
texto estático sin interacción: ponerles caja sería imitar el envoltorio sin la función, y la
medición-antes ya registró que la ausencia de superficies es deliberada. Decisión: **cero
tarjetas nuevas**; los radios 40/30/20px de tile quedan declarados por si el portal de login
los necesita.

La única excepción condicionada, **no documentada como tarea de esta tanda**: si el dueño
vuelve clicables las piezas de SERVICIOS, entonces reciben `border-radius: 40px` +
`background: var(--lp-fondo-alt)` sin sombra (el tile de Apple en reposo no proyecta sombra;
la única sombra difusa de la página es `4px 12px 40px 6px rgba(0,0,0,.09)` de los modales,
Evid). Hasta entonces: no.

## 3. Tipografía dentro del techo real (400–700, opsz 17–28)

Toda la tabla §1 vive entre los pesos servidos: 400 (cuerpo, botones), 500 (si queda algo),
600 (display, eyebrow, párrafo-intro), 650 (títulos de beneficio, ya interpolado real), 700
(headline super-bold opcional y estado actual). **Ninguna propuesta de esta especificación
necesita 800.** Apple tampoco lo usa: el máximo hallado en Evid y en Mía es 700.

Marcado como **decisión para el dueño** (no tarea del ejecutor): si en el futuro se quisiera
un Black 800/900 para un titular campaña, exige descargar el maestro `SF-Pro.ttf` (inexistente
en esta máquina, verificación de la medición-antes), montar el venv `fonttools` y rehacer el
binario versionado en `src/assets/fonts/` vía `npm run sf-pro` — cambia el artifact cacheado
en CDN. Nadie del equipo de lotes toca eso.

Verificaciones de conservación del eje óptico: el titular de 88px propuesto sigue recibiendo
geometría Display vía `opsz` automático (el recorte conserva 17–28 y `font-optical-sizing:
auto`); nada de esto requiere cambiar fonts.css.

## 4. Iconografía

Licencia: no se sirven SF Symbols ni la webfont `\uf30x` de Apple (Evid §Iconografía lo
prohíbe expresamente; Juan verificó que Apple recrea los glifos con su propia webfont —
copiamos el patrón SVG inline, no el archivo). Todo se dibuja en `src/components/Icono.tsx`,
retícula 24, trazo 1,75, extremos redondos, `currentColor`, `fill:none` salvo marcas de
terceros. Referencia visual (nombre SF Symbols = inspiración, jamás archivo):

| Sección | Ícono necesario | Ref. visual SF Symbols | Geometría a dibujar (24, trazo 1,75) |
|---|---|---|---|
| NAV/hero | (ninguno nuevo) | — | — |
| BENEFICIOS[0] trámite | `globo` | `globe` | círculo r=8 + meridiano elipse + ecuador arco |
| BENEFICIOS[1] publicado | `reloj-check` o reutilizar `check` | `checkmark.circle` | ya cubierto: check actual sirve |
| BENEFICIOS[2] papeleo | `documento-tildado` | `doc.badge.checkmark` | rect redondeado 6×14 pliegue sup. der + check chico abajo izq |
| BENEFICIOS[3] domingo | `escudo` | `checkmark.shield` | escudo simétrico ápice abajo + check interior |
| SERVICIOS | pagina/app/portafolio | — | existen, no tocar |
| PROCESO paso 1 | `boceto` | `pencil.and.outline` | lápiz 45° línea simple (ya casi es `flecha` rotada; dibujar nuevo) |
| PROCESO paso 2 | `tarjeta` | `creditcard` | rect 20×14 radio 3 + banda horizontal y=8 |
| PROCESO paso 3 | `radios` (publicado) | `dot.radiowaves.up-right` | punto + dos arcos concéntricos 45° |
| PROMESA | `engranaje-base` o ninguno (es bloque de texto centrado) | `gearshape` | hexágono interno simplificado: círculo r=5 + 6 dientes rectangulares — caro; propongo **ninguno**, el bloque vive del tipógrafo 28/600 |
| SOCIOS | (logos de terceros, `Socios.tsx`) | — | no aplica |
| PREGUNTAS | chevron (existe, giro 90°) | `chevron.down` | ya resuelto |
| CIERRE | telefono/correo/whatsapp | — | existen |
| Global | `mas` (para "ver todo") | `plus` | dos barras 12px — solo si aparece UI de expandir |

Total nuevos: **5 geometrías** (`globo`, `documento-tildado`, `escudo`, `boceto`,
`radios`; la de PROMESA se descarta). Carlos decide `boceto` vs reutilizar `flecha`. Cada
una entra al union `NombreIcono` y al contrato de `base.css` (stroke, currentColor, sin
relleno).

## 5. Plan en tres lotes (sin solapamiento de archivos)

Orden: Lote 1 (Lucía) ya corre → Lote 2 (Carlos) puede correr en paralelo con textos ya
fusionados → Lote 3 (Pedro) aplica tokens a lo ya montado. Los tres tocan árboles distintos.

### Lote redacción — Lucía — `src/lib/contenido.ts` + meta de `index.html`

Lo que FALTA después de sus seis defectos (no repetir lo ya hecho):

1. Sincronizar `twitter:description` (index.html:23): quitarle el remate duplicado, dejar el
   hecho, redacción distinta de `og:description` (defecto 6 pendiente en el lado twitter).
2. `og:image:alt` y `twitter:image:alt` (index.html:21, :25): describir la imagen, no repetir
   el título (D3).
3. Titulares de sección a patrón único afirmativo ≤4 palabras: verificar que los seis quedan
   así tras su ronda (beneficios 5 palabras «Lo que dejas de cargar.» → aceptada como patrón
   afirmativo; si quiere podar a 4: «Lo que dejas de cargar» sin punto no — el punto es la
   forma Apple: frases cortas sentenciosas, Evid pattern `Send it. Spend it.`).
4. Revisar que ningún titular nuevo pase de 2 frases y que no aparezca signo de exclamación
   (Apple Cash: 0 en todo el copy visible, Evid) ni mayúsculas sostenidas.
5. NO: plantillas SaaS. Marcadas como no explícitamente: «Potencia tu negocio», «Soluciones a
   medida», «De principio a fin», cualquier «impulsamos/transformamos». La voz del dueño va
   intacta: «Un audio, un correo, un boceto en una servilleta. Como te salga.», «Nada, para
   eso estamos nosotros.», «Cero papeleo. Cero contraseñas raras.» son intocables.

Criterios de aceptación: `npm run verificar` verde (gate de tecnicismos); grep de
«¡», `[A-ZÁÉÍÓÚÑ]{4,}` y las plantillas listadas devuelve vacío en contenido.ts; longitud
`<title>` ≤66, description ≤160, titulares ≤4 palabras cada uno.

### Lote componentes — Carlos — `src/components/*.tsx`, `src/pages/Landing.tsx`, SVG nuevos

1. `<Seccion>` recibe prop `respiracion?: "protagonista" | "estandar" | "compacto"` que
   pinta `lp-seccion--ritmo-a/b/c`; asignar según tabla D2 en Landing.tsx (líneas 125-196).
2. Hero: envolver en contenedor con `min-height` svh (regla nueva en landing.css es del lote
   de Pedro; Carlos solo pone la clase `lp-hero--alto`).
3. Dibujar las 5 geometrías nuevas en `Icono.tsx` (§4) respetando retícula 24/trazo 1,75;
   extender `NombreIcono`; asignarlas a las piezas correspondientes vía `contenido.ts`…
   **no**: el campo `icono` vive en contenido.ts (archivo de Lucía) — Carlos deja los íconos
   registrados y la wiring de nombres se hace en una tanda secuencial posterior, o Lucía usa
   los nombres ya acordados. Coordinación: los nombres finales son los de §4, pactados aquí.
4. Patrón "Learn more ›": enlace `.lp-mas` con `chevron` pegado (ya existe el giro), aplicar
   en SERVICIOS si falta.
5. No introducir tarjetas (D4).

Criterios: `npm run typecheck` sin errores (unión `NombreIcono`); `npm run build` ok;
`node scripts/capturas.mjs` sin desborde en 390/768/1440 y `culpables: []`; captura nueva
muestra el hero ≥751px de alto a 1440×900.

### Lote estilos — Pedro — `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/landing.css`

1. Azules D1: `--lp-acento` :45→#0071e3, :86→#2997ff; `--lp-enlace` :85→#2997ff;
   `--color-accent-text` variante oscura #2997ff; eliminar el fallback `filter:brightness`
   del hover primario (landing.css:238) por `--color-action-fill-hover`.
2. Ritmo D2: quitar el clamp único de `.lp-seccion` (:108), declarar las tres clases de
   respiración con los valores de la tabla y sus dos breakpoints (1068/734).
3. Tipografía §1: hero 88px/600/lh1.04/ls−0.015em (:531-538), sección 56px/600/−0.009em
   (:124-126), eyebrow 600, párrafo lh 1.24, botón 17/400/−0.022em/radio 980px.
4. Nav: blur 20px, fondos rgba literales D-table, `--lp-fondo-alt` → #f5f5f7, escalera
   oscura #1d1d1f/#161617 para las secciones temáticas.
5. `scroll-margin-top` coherente con la altura de barra elegida.

Criterios (todos medibles con el script de medición ya escrito, `/tmp/medir-landing.mjs`):
computed style del hero = 88px/600/−1.32px; sección = 56px/600; padding-block de los tres
grupos = 152/144/80±1px a 1440px; nav backdrop `blur(20px) saturate(1.8)`; los únicos azules
presentes en `getComputedStyle` de la landing son #0071e3, #0066cc, #2997ff (grep del CSS
compilado: cero coincidencias de `007AFF|0091ff|8cc7ff|0066cc` fuera de los roles enlace);
contraste texto/blanco sobre acción ≥4,0:1 verificado. Gate común a los tres lotes:
`npm run verificar && npm run typecheck && npm run build && node scripts/capturas.mjs`, y
comparación visual contra las 42 capturas de `.capturas-antes/`.
