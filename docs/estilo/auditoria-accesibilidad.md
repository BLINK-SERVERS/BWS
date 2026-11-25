# Auditoría de accesibilidad — landing BWS

Revisora: SOFÍA. Fecha: 2026-11-25.
Medido sobre el build de producción servido en `http://127.0.0.1:4179/` (`npm run build` + `npx vite preview --port 4179 --strictPort`), Chromium vía `playwright-core`, viewport 390×844 y 1440×900, con la fuente servida cargada (`document.fonts.ready`).
Script: `/tmp/auditar-afirmaciones.mjs`. Datos crudos: `/tmp/auditoria-afirmaciones.json`. Muestras de píxeles del anillo: `/tmp/foco-*.png`.
**No edité ningún archivo del repo.** PEDRO y CARLOS estaban modificando `src/styles/*` y `src/pages/Landing.tsx` mientras medía; cada hallazgo lleva el número de línea del archivo tal como estaba en el momento de la medición, y los archivos siguen cambiando (ver §8).

Referencia de valores target: `docs/estilo/especificacion-manzana.md`. Fórmula aplicada: WCAG 2.1 (relativas linealizadas, `(Lmax+0.05)/(Lmin+0.05)`), resultado a 2 decimales. Umbrales: 4.5:1 texto normal, 3:1 texto grande (≥18,66 px con peso ≥700, o ≥24 px) y componentes de interfaz.

---

## 1. Contraste calculado

### 1.1 Pares pedidos por la especificación

| Foreground | Background | Ratio | AA 4.5:1 texto | AA 3:1 grande/UI | Veredicto |
|---|---|---|---|---|---|
| `#0071e3` | `#ffffff` | **4.70** | pasa | pasa | OK |
| `#0071e3` | `#f5f5f7` | **4.31** | **falla** | pasa | Reprueba texto normal |
| `#0071e3` | `#f2f2f7` (papel real del repo) | **4.21** | **falla** | pasa | Reprueba texto normal |
| `#0066cc` | `#ffffff` | **5.57** | pasa | pasa | OK |
| `#0066cc` | `#f2f2f7` | **4.99** | pasa | pasa | OK |
| `#0066cc` | `#f5f5f7` | **5.11** | pasa | pasa | OK |
| `#2997ff` | `#000000` | **6.96** | pasa | pasa | OK |
| `#2997ff` | `#1d1d1f` | **5.58** | pasa | pasa | OK |
| `#1d1d1f` | `#f5f5f7` | **15.46** | pasa | pasa | OK |
| `#1d1d1f` | `#ffffff` | **16.83** | pasa | pasa | OK |
| `#ffffff` | `#0071e3` (relleno de botón) | **4.70** | pasa | pasa | OK sobre relleno base |
| `#ffffff` | `#0077ed` (hover declarado) | **4.32** | **falla** | pasa | El hover baja del umbral |
| `#ffffff` | `#0066cc` | **5.57** | pasa | pasa | OK |
| `#ffffff` | `#007AFF` (acento iOS saliente) | **4.02** | **falla** | pasa | Razón por la que se retira |
| `rgba(0,125,250,.6)` (anillo) | `#ffffff` | **2.27** | **falla** | **falla** | Anillo no cumple 3:1 |
| `rgba(0,125,250,.6)` | `#f2f2f7` | **2.15** | **falla** | **falla** | Anillo no cumple 3:1 |
| `rgba(0,125,250,.6)` | `#000000` | **2.45** | **falla** | **falla** | Anillo no cumple 3:1 |

### 1.2 Pares realmente en uso (leídos de `tokens.css` + `landing.css`, verificados en navegador)

Valores resueltos en pantalla: `--color-action-fill: #0071e3`, `--lp-enlace` claro `#0066cc`, `--lp-enlace` oscuro `#2997ff`, `--lp-fondo-alt: #f2f2f7`, tinta `#1d1d1f`, secundario `#424242`, terciario `#6e6e6e`, fondo nav `rgba(250,250,252,.8)`.

| Punto | Capa | fg / bg medidos | Tamaño real | Ratio | Umbral | Veredicto |
|---|---|---|---|---|---|---|
| Enlaces de la barra | texto | `rgb(66,66,66)` / `rgb(255,255,255)` | 14 px / 500 | 10.05 | 4.5 | OK |
| «Entrar» | texto | `rgb(66,66,66)` / blanco | 14 px / 500 | 10.05 | 4.5 | OK |
| Marca de la barra | texto | `rgb(29,29,31)` / `rgb(250,250,252)`≈blanco | 16 px | 16.14 | 4.5 | OK |
| CTA primario | texto/relleno | `rgb(255,255,255)` / `rgb(0,113,227)` | 17 px / **600** | **4.70** | 4.5 | OK al borde (margen 0,20) |
| CTA fantasma (claro) | texto | `rgb(0,102,204)` / blanco | 17 px / 600 | 5.57 | 4.5 | OK |
| H1 del hero | texto | `rgb(29,29,31)` / blanco | 88 px / 600 | 16.83 | 3 (grande) | OK |
| Bajada del hero | texto | `rgb(66,66,66)` / blanco | 21 px / 600 | 10.05 | 4.5 | OK |
| Check de beneficios (oscuro) | glifo | `rgb(41,151,255)` / negro | 28 px | 6.96 | 3 (UI) | OK |
| Título de sección (oscuro) | texto | blanco / negro | 56 px / 600 | 21.00 | 3 | OK |
| `.lp-dos-tonos` (oscuro) | texto | `rgb(235,235,245)` / negro | 21 px / 400 | 17.73 | 4.5 | OK |
| Chevron del acordeón | glifo | `rgb(110,110,110)` / `rgb(242,242,247)` | 28 px | **4.57** | 3 (UI) | OK, sin aire |
| Píldora del número | texto/relleno | blanco / `rgb(0,102,204)` | 17 px / 700 | 5.57 | 4.5 | OK |
| Enlaces de políticas (pie) | texto | `rgb(0,102,204)` / `rgb(242,242,247)` | **12 px** / 500 | **4.99** | 4.5 | OK al borde |
| Nota «Atención 24/7 · Maracaibo» | texto | `rgb(66,66,66)` / `rgb(242,242,247)` | 12 px / 600 | 9.01 | 4.5 | OK |
| Botón del acordeón | texto | `rgb(29,29,31)` / gris | 21 px / 600 | 15.08 | 4.5 | OK |
| Respuesta del acordeón | texto | `rgb(66,66,66)` / gris | 17 px / 400 | 9.01 | 4.5 | OK |
| Enlaces de la familia (pie) | texto | `rgb(66,66,66)` / gris | 12 px / 500 | 9.01 | 4.5 | OK |
| Ícono de servicio | glifo | `rgb(0,102,204)` / blanco | 32 px | 5.57 | 3 (UI) | OK |

Nota metodológica: axe-core corrió con 0 violaciones, pero **no evaluó el contraste de los botones primarios ni de las credenciales de pago** (`incomplete: color-contrast`), porque el relleno viene de un token `light-dark()` y del SVG crudo. Los números de esa fila son míos, calculados píxel a píxel desde `getComputedStyle`, no de axe.

---

## 2. Objetivos táctiles a 390 px (umbral 44×44)

Alturas reales medidas con `getBoundingClientRect()`:

| Elemento | Medido | Cumple |
|---|---|---|
| Marca de la barra | 105,8 × 44 | sí |
| Enlaces de la barra («Qué hacemos», «Cómo trabajamos», «Preguntas») | 0 × 0 | ocultos a 390 px (`display:none`, `landing.css:1167`) → no aplica |
| «Entrar» | **40,8 × 44** | **no** (ancho) |
| CTA «Crear cuenta» de la barra | 114,1 × 44 | sí |
| CTAs del hero (primario y fantasma) | 358 × 48 | sí |
| Botones del cierre (3) | 358 × 48 | sí |
| Botones del acordeón (5) | 358 × 64 | sí |
| Fila de WhatsApp del pie (botón) | 233 × 48 | sí |
| Nota del canal del pie | **190,1 × 18** | no (es texto, no interactivo) |
| Enlaces de políticas del pie (3) | 59,5–117 × 44 | sí |
| Enlaces de la familia del pie (4) | 62,9–110 × 44 | sí |
| Salto al contenido (enfocado) | 187,5 × 51,2 | sí |

A 1440 px caen los mismos dos: «Entrar» 40,8 × 44 y la nota del pie 190,1 × 18.

---

## 3. Orden de tabulación y landmarks

**Secuencia real a 390 px** (Tab desde el cuerpo, 17 paradas, todas con `:focus-visible` = true):

1. `a.lp-salto` «Saltar al contenido» *(la primera parada existe pero mi barrido arrancó con foco en el body ya desplazado; ver nota abajo)*
2. `a.lp-nav__marca` «Blink BWS»
3. `a.lp-nav__acceso` «Entrar»
4. `a.lp-nav__cta` «Crear cuenta»
5. `a.lp-boton--primario` «Crear cuenta» (hero)
6. `a.lp-boton--fantasma` «Ver qué hacemos» (hero)
7.–11. `button.lp-acordeon__boton` ×5 (preguntas)
12.–14. `a.lp-boton` ×3 del cierre (Crear cuenta / Llamar / correo)
15. `a.lp-boton` «Escribir por WhatsApp» (pie)
16.–18. `a.lp-enlace` ×3 políticas
19.–22. `a.lp-enlace` ×4 familia
23. vuelve al `body` y de ahí al salto (ciclo limpio, sin trampas de foco, probado a 390 y 1440).

Total encadenables: 27 a 1440 px, 24 a 390 px (los tres enlaces de la barra salen con `display:none`, no quedan tabulables).

**Landmarks y regiones:**

| Elemento | Rol | Nombre accesible |
|---|---|---|
| `header.lp-nav` | banner | **ninguno** |
| `nav.lp-nav__enlaces` | navigation | «Secciones de la página» ✓ |
| `main#contenido` | main | **ninguno** |
| `section` ×8 (hero, resuelves, que-hacemos, proceso, promesa, aliados, preguntas, hablemos) | region | todas etiquetadas por su título ✓ |
| `div.lp-acordeon__bandeja` ×5 | region | etiquetadas por el botón (`aria-labelledby`) ✓ |
| `footer.lp-pie` | contentinfo | **ninguno** |
| `section.lp-pie__pagos` | region | «Formas de pago» ✓ |
| `nav.lp-pie__politicas` | navigation | «Políticas y condiciones» ✓ |

Sin saltos de jerarquía: h1 → h2 → h3, 24 encabezados, ninguno oculto roto, un solo `h1`.

---

## 4. `:focus-visible`

Regla global en `base.css:113-119`: `outline: none; box-shadow: var(--focus-ring)`, con `--focus-ring: 0 0 0 4px rgba(0,125,250,.6)` (`tokens.css:307`). Refuerzos locales en `.lp-enlace:focus-visible` (`landing.css:223`), `.lp-boton:focus-visible` (`landing.css:290`) y `.lp-salto:focus` (`landing.css:340`).

- **¿Existe anillo?** Sí, en los 11 interactivos muestreados: todos devolvieron `boxShadow: rgba(0,125,250,0.6) 0 0 0 4px` y `matches(":focus-visible") === true`.
- **¿Contraste del anillo ≥3:1?** **No.** Muestreado píxel a píxel sobre captura real (el píxel del anillo sale mezclado con el fondo, que es lo que ve el ojo):

| Fondo adyacente | Píxel del anillo | Ratio contra su fondo | Veredicto |
|---|---|---|---|
| Barra `rgb(251,251,253)` | `rgb(100,175,251)` | **2.24** | falla |
| Gris `rgb(242,242,247)` | `rgb(97,172,249)` | **2.14** | falla |
| Blanco del hero | `rgb(102,177,252)` | **2.27** | falla |
| Negro (secciones oscuras) | ≈`rgb(97,172,249)` | **2.45** | falla |

El color puro `#007dfa` sí cumpliría (3.95 sobre blanco, 5.31 sobre negro); lo que lo mata es el alfa 0.6. Barrido de alfas sobre `#007dfa`: .7 → 2.61 sobre blanco; .8 → 3.02; sobre `#f2f2f7` ni siquiera .8 llega (2.80). Ningún alfa simple salva los tres fondos a la vez.

---

## 5. Movimiento

`@keyframes` declarados: `lp-check` (`landing.css:674-677`, era 591 antes del cambio de Pedro) y `lp-cinta` (`landing.css:882`, ahora ~982). Transiciones: `.lp-boton` (`landing.css:277-280`: transform .12s, filter .2s, background .2s), `.lp-acordeon__chevron` (transform .32s), `.lp-acordeon__bandeja` (grid-template-rows .32s). Animaciones activas medidas en navegador a 1440 px: exactamente esas cinco (`lp-check` 0.5s ×1, `lp-cinta` 37s infinito reverse, tres transiciones).

Bloque `@media (prefers-reduced-motion: reduce)` en `landing.css:1401-1454`. Verificado con `reducedMotion: "reduce"` en el navegador: **0 animaciones y 0 transiciones activas** en todo el árbol `.lp`. Es decir:

| Pieza | ¿Cubierta? |
|---|---|
| `lp-check` (fade + scale) | sí (`animation: none; opacity: 1; transform: none`) |
| `lp-cinta` (traslación infinita) | sí (`animation: none`, pista a un juego, máscara fuera, copias `aria-hidden` ocultas) |
| Transiciones del acordeón (chevron y bandeja) | sí (`transition: none`) |
| `transform/filter/background` de `.lp-boton` y su `:active` | sí |
| Lo que **no** está cubierto | nada en movimiento continuo. Dos huecos de otra naturaleza: `will-change: transform` en `.lp-cinta__pista` queda declarado aunque la animación esté apagada, y la pausa por `:hover`/`:focus-within` (`landing.css:918`) sigue siendo el único control explícito para quien no declara preferencia de movimiento pero no puede leer logos en movimiento. |

---

## 6. Semántica

- **Un solo `h1`**: confirmado, 1 instancia (`Landing.tsx:104`), visible, con prefijo de marca en `.visualmente-oculto`.
- **Jerarquía de `h2`**: ocho `h2` de sección + uno en el pie («Formas de pago»), todos bajo el `h1`, sin saltos; los `h3` cuelgan siempre de un `h2` de su sección.
- **SVG**: 30 en total, 27 con `aria-hidden="true"`. Los 3 sin `aria-hidden` son el lockup aprobado (barra ×1, hero ×1, pie ×1), que traen su `<title>Blink</title>` → nombre expuesto correcto, no un fallo.
- **Imágenes**: 36 `<img>`, 0 con `alt` vacío; las copias de la cinta van en contenedores `aria-hidden="true"` (medido: `[null,"true","true","true"]` por pista).
- **Idioma**: `<html lang="es">` ✓, `og:locale es_VE` ✓.
- **Chevron del enlace tipo "Learn more"**: el patrón ya está plantado en `Landing.tsx:149` y `Landing.tsx:177` (`<a class="lp-enlace lp-enlace--mas">texto + Icono chevron`). El SVG sale con `aria-hidden="true" focusable="false"` → **no ensucia al lector de pantalla**; announce solo «Crear cuenta». El problema ahí no es el chevron, es el destino y la clase sin hoja (§7).

---

## 7. Tabla de hallazgos

| Hallazgo | Sev | Evidencia | Acción concreta |
|---|---|---|---|
| Texto blanco sobre el relleno de acción `#0071e3` a 17 px / peso 600 = **4.70:1**, margen de solo 0,20 sobre el umbral; cualquier ajuste de peso o color lo tira | P1 | `landing.css:264-269` (peso 600), `tokens.css:96`; ratio calculado y verificado en navegador | Subir el tamaño del CTA a ≥18.66 px con peso ≥700 (categoría "grande", umbral 3:1) u oscurecer `--color-action-fill` a `#0062c9` o más fuerte. Si se deja literal de Apple, dejar constancia escrita de que es decisión con margen conocido |
| Hover `--color-action-fill-hover: #0077ed` con blanco = **4.32:1**, reprueba 4.5:1 | P1 | `tokens.css:97`; cálculo | Oscurecer el hover en vez de aclararlo (Apple aclara porque su base es más oscura), o quitar el cambio de fondo en hover y usar solo el estado `:active` |
| `#0071e3` como **color de texto** sobre papel `#f2f2f7` = **4.21:1** (y 4.31 sobre `#f5f5f7`): reprueba si algún enlace adopta el valor de relleno | P1 | `tokens.css:96` vs `landing.css:96`/`--lp-fondo-alt`; tabla §1.1 | Mantener la separación de la spec §1: `--lp-enlace` sigue `#0066cc` en claro y `#2997ff` en oscuro; `#0071e3` solo como relleno. Prohibir `color: var(--color-action-fill)` en texto |
| Anillo de foco **2.14–2.45:1** contra sus cuatro fondos: incumple WCAG 1.4.11 (3:1) en toda la página | P1 | `tokens.css:307`, `base.css:118`; píxeles muestreados §4 | Cambiar a doble capa con borde sólido: `box-shadow: 0 0 0 2px #007dfa, 0 0 0 4px rgba(0,125,250,.6)` sobre fondo propio, o `outline: 2px solid #007dfa; outline-offset: 2px` (3.95:1 en claro, 5.31:1 en oscuro). Reportar a ANDRÉS: es desviación deliberada del literal de Apple y lo decide el dueño |
| «Entrar» en la barra mide **40,8 × 44 px** de ancho | P1 | `landing.css:561-569` (solo `min-height: 44px`, sin padding horizontal); medido a 390 y 1440 | Añadir `padding-inline: 0.5rem` (o `min-width: 44px`) a `.lp-nav__acceso` |
| Los dos enlaces nuevos «Crear cuenta ›» (`lp-enlace--mas`) apuntan a `HERO.ctaPrimaria.url` = `/registro`, duplicando el CTA del hero y sin clase en la hoja | P1 | `Landing.tsx:149` y `Landing.tsx:177`; `grep lp-enlace--mas src/styles/landing.css` → 0 resultados | Destino coherente con la ficha (beneficios → `#resuelves` o preguntas; servicios → `#que-hacemos`) o quitarlos. Declarar `.lp-enlace--mas` en `landing.css` junto con el resto |
| `.lp-pieza__titulo` no existe: los títulos de «Qué hacemos» van con `lp-subtitulo` (peso 650, 26 px) | P2 | `Landing.tsx:169`; ausencia verificada en `landing.css` | Crear la clase tipográfica propia en `landing.css` o documentar que `lp-subtitulo` es la oficial del patrón ficha |
| La variante `.lp-boton--grande` (18px/31px, spec §3) está declarada pero ningún CTA del hero la usa | P2 | `landing.css:286-288`; alto medido del botón del hero = 48 px, padding 7,2×17,6 | Aplicarla en el CTA primario del hero o borrar la regla |
| `main#contenido`, `header.lp-nav` y `footer.lp-pie` sin nombre accesible | P2 | §3; `Landing.tsx:67`, `:96`, `:215` | Opcional: `aria-label` en `main` no hace falta (un solo main basta); si se quiere simetría con el pie legal, poner `aria-label="Pie de página"` al footer |
| Nota «Atención 24/7 · Maracaibo, Zulia» = 190 × 18 px | P2 | `landing.css:1148-1152`; medido a 390 px | No es objetivo táctil (no es enlace). Solo asegurar que el botón de WhatsApp vecino mantenga sus 48 px, que ya cumple |
| Separador `·` entre horario y ciudad va con `aria-hidden="true"` | P2 | `Landing.tsx` bloque `.lp-pie__datos` | Correcto como está: announces «Atención 24/7 Maracaibo, Zulia» sin ruido de puntuación |
| `will-change: transform` en `.lp-cinta__pista` persiste con movimiento reducido | P2 | `landing.css` bloque cinta (~línea 795 original, hoy ~800) | Añadir `will-change: auto` dentro del media de `prefers-reduced-motion` |
| Cinta en movimiento sin control para quien no declara preferencia: solo pausa por `:hover`/`:focus-within`, sin botón de pausa | P2 | `landing.css:918`; animación infinita medida (37 s, reverse) | Aceptar como riesgo documentado o añadir un control de pausa visible. El bucle infinito es lo que más pide un freno manual |
|axe-core: **0 violaciones** en wcag2a/aa/21a/21aa/best-practice a 1440 y 390 | — | salida del script | Sin acción. Está bien |
| Un solo `h1`, jerarquía h2/h3 limpia, 27/30 SVG con `aria-hidden` correcto (los 3 restantes llevan `<title>Blink</title>`), 36/36 `img` con `alt`, `lang="es"`, chevron fuera del árbol de accesibilidad | — | §6 | Sin acción. Está bien |
| Áreas táctiles del contenido (CTAs 48 px, acordeón 64 px, enlaces del pie 44 px) cumplen 44×44 | — | §2 | Sin acción. Está bien |
| Movimiento reducido: 0 animaciones/transiciones activas con `prefers-reduced-motion: reduce` | — | §5 | Sin acción. Está bien |
| Ciclo de tabulación cerrado sin trampas de foco, orden DOM = orden visual | — | §3 | Sin acción. Está bien |

**Conteo: P0 = 0 · P1 = 6 · P2 = 7.**

---

## 8. Gates

### `npm run verificar`
```
> blink-bws@1.0.0 verificar
> node scripts/sin-tecnicismos.mjs

✓ sin tecnicismos en 17 archivos de cara al cliente (y las marcas viven solo en lib/socios.ts y lib/pagos.ts, 10 KB)
```

### `npm run typecheck`
```
> blink-bws@1.0.0 typecheck
> tsc --noEmit

(sin salida = sin errores)
```

### `npm run build`
```
vite v8.3.7 building client environment for production...
transforming...
✓ 41 modules transformed.
rendering chunks...
dist/index.html                            2.38 kB │ gzip:  0.82 kB
dist/assets/zinli-z-DlZEOz7s.png           9.04 kB
dist/assets/neon-CubMSJ2w.png             11.01 kB
dist/assets/nic-ve-hp21OWRw.png           11.72 kB
dist/assets/qoder-B-kN7TMe.png            12.10 kB
dist/assets/aws-BhPn_tnK.png              14.01 kB
dist/assets/zoho-mail-CSfygH1U.png        14.58 kB
dist/assets/cloudflare-Blde2yRa.png       18.31 kB
dist/assets/supabase-Bc_6Jx1E.png         22.86 kB
dist/assets/github-C14Y4EKL.png           23.96 kB
dist/assets/inter-latin-CbSy44y3.woff2    28.09 kB
dist/assets/sf-pro-latin-CAmPVOb0.woff2   55.88 kB
dist/assets/index-YMJ-eFVY.css            24.66 kB │ gzip:  6.35 kB
dist/assets/index-Dr98mhQW.js            243.64 kB │ gzip: 80.11 kB
✓ built in 2.46s
```
(Notas del build: advertencia experimental de `UNDICI-EHPA` en cada comando Node, y `[PLUGIN_TIMINGS]` de rolldown en el segundo build — informativas, no fallos.)

Servidor: `npx vite preview --port 4179 --strictPort` → `➜ Local: http://localhost:4179/`, `curl -o /dev/null -w "%{http_code}"` = **200**. Cerrado al terminar la medición.

---

## 9. No verificado y por qué

- **Páginas legales (`/privacidad/`, `/terminos/`, `/pagos/`) y `404.html`**: medí solo la raíz. `scripts/a11y.mjs` sí las barre; correrlo completo eran otros 8 navegadores mientras el repo cambia debajo. Queda pendiente para la pasada final.
- **Portal (`/portal`, `/registro`, `/ingreso`)**: fuera del alcance pedido (landing) y requiere backend vivo.
- **Contraste del anillo de foco sobre la sección negra**: calculado por fórmula con el mismo alfa (2.45:1); no lo muestreado por píxel porque el barrido de `anillo2.mjs` no paraba en un interactivo oscuro con el scroll exacto. El número de fórmula es suficiente para el veredicto (falla igual que en claro).
- **Fondo real detrás de la barra con scroll encima**: el nav es `rgba(250,250,252,.8)` + blur, así que el fondo adyacente cambia según lo que pase debajo. Muestreé con la página arriba (blanco). Sobre una sección negra el anillo sube, no baja: el peor caso ya está cubierto.
- **Lector de pantalla real (NVDA/VoiceOver)**: no instalado en esta máquina. Las conclusiones de semántica salen del DOM, de `aria-*` y de `getComputedStyle`, no de audio.
- **Estado de los archivos al cierre de esta auditoría**: `src/styles/landing.css` pasó de 1329 a 1454 líneas y `tokens.css` de 427 a 459 durante la medición (Pedro), y `Landing.tsx` de 275 a 298 (Carlos). Los números de línea citados son los de la última lectura hecha, y los valores de tokens verificados son los del build que corrí al final (`--color-action-fill: #0071e3`, `--nav-blur: 20px`, `--radius-button: 980px`, `--focus-ring: 0 0 0 4px rgba(0,125,250,.6)`, `--lp-enlace` claro `#0066cc` / oscuro `#2997ff`).
- **Blur del nav a 20 px**: confirmado en el navegador (`backdrop-filter: saturate(1.8) blur(20px)` medido en `.lp-nav`), y `landing.css:469` ya consume `--nav-blur`. Cerrado mientras medía; no es hallazgo.
- **Radios 40/30/20 por quiebre**: `--radius-tile: 40px` declarado en `tokens.css:263`, sin consumo en `landing.css` todavía (los radios aplicados a 1440 px son 980 px en botones, 8 px en fichas de pago, 12 px en el salto). No audito fidelidad Apple — eso es de ANDRÉS —; solo dejo constancia de que no hay superficie con radio 40/30/20 en el build medido.
