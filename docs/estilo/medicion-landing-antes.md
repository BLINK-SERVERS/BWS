# Medición de la landing actual (estado «antes»)

Medida el 2026-11-25 sobre el build de producción servido en `127.0.0.1:4177`
(`npm run build` + `vite preview`), con Chromium vía `playwright-core`.
Script: `/tmp/medir-landing.mjs`. Datos crudos: `/tmp/landing-antes.json`.
No es opinión: cada número sale de `getComputedStyle`.

## Tipografía (escritorio 1440)

| Elemento | Tamaño | Peso | Interlineado | Tracking | Ancho |
| --- | --- | --- | --- | --- | --- |
| Titular del hero (`.lp-hero__titular`) | 76 px | 700 | 79,8 px (1,05) | −2,128 px (−0,028 em) | 980 px, 2 líneas, `text-wrap: balance` |
| Antetítulo del hero (`.lp-hero__sub`) | 21 px | 500 | 29,4 px (1,4) | −0,252 px | 617 px, `text-wrap: pretty` |
| Título de sección (`.lp-titulo-seccion`) | 56 px | 700 | 60,48 px (1,08) | −1,232 px (−0,022 em) | — |
| Barra de navegación | 16 px | 400 | 24 px | normal | — |

Escala responsive medida: a 768 px el hero baja a 47,6 px y el título de sección a
36,9 px; a 390 px ambos quedan en 32 px. El botón del hero mide 44 px de alto en
móvil (el de escritorio, 48 px).

## Titulares existentes y su longitud

| Sección | Titular | Palabras |
| --- | --- | --- |
| Beneficios | Cosas por las que dejas de preocuparte. | 7 |
| Qué hacemos | Qué hacemos | 2 |
| Proceso | ¿Cómo trabajamos? | 2 |
| Aliados | Trabajamos con los mejores en esto. | 6 |
| Preguntas | Preguntas que nos hacen siempre. | 5 |
| Cierre | Hablemos. | 1 |

Cuatro de los seis superan las 4 palabras; Apple rara vez pasa de 3 en un titular de
sección. La forma interrogativa en «¿Cómo trabajamos?» convive con la afirmativa en el
resto: no hay un patrón único.

## Color y superficies

- Fuente cargada realmente en el navegador: **una sola cara variable `SF Pro 400 700`**;
  el resto de la pila (`Inter`, `-apple-system`, `system-ui`…) queda como respaldo.
- Relleno de los botones primarios: `rgb(0, 102, 204)` = **#0066cc**. El token de marca del
  sistema (`tokens.css`) declara **#007AFF**; el azul que se ve en pantalla no es el azul
  del sistema, y tampoco es el `#0071e3` del botón de marketing de Apple.
- Fondo del hero y de las secciones claras: `rgb(255, 255, 255)`; secciones oscuras:
  `rgb(0, 0, 0)`; secciones grises: `rgb(242, 242, 247)`.
- Tinta: `rgb(29, 29, 31)` (Apple `#1d1d1f`), antetítulo `rgb(66, 66, 66)`.

## Barra de navegación

`position: sticky`, fondo `rgba(255,255,255,0.72)`,
`backdrop-filter: saturate(1.8) blur(30px)`, separador inferior `1px solid rgba(66,66,66,0.16)`.
Este tratamiento ya es el de Apple; no hay que rehacerlo, solo sostenerlo en scroll.

## Ritmo de secciones

Ocho bloques, todos con `padding-block: 104 px` (el techo del `clamp(3.5rem, 8vw, 6.5rem)`),
alternando blanco → negro → blanco → gris → negro → blanco → gris → negro.
Alturas: 562, 741, 623, 690, 358, 426, 642, 447 px. Contenedor `--lp-ancho: 980 px`
dentro de un `--page-max: 1320 px`; curva de movimiento `cubic-bezier(.32,.72,0,1)`.

## Cuerpo de texto y tarjetas (resuelto el 2026-11-25)

El hueco que quedó abierto se cerró leyendo la hoja de estilos: **no hay tarjetas**.
`.lp-beneficio` es un ítem de lista (check + título + explicación) dentro de una
parrilla de 2 columnas, y los servicios son piezas de 3 columnas con ícono; ninguno de
los dos tiene fondo, radio ni sombra, por eso el `border-radius: 0px` de la primera
medición. Lo que hay que decidir no es el radio de una tarjeta, sino si la landing
necesita superficies tipo *card* (Apple las usa poco en marketing: prefiere bloques de
texto separados por aire y por cambio de fondo).

Tipografía real de los componentes de contenido, del `clamp` evaluado a 1440 px:

| Elemento | Regla | Valor a 1440 |
| --- | --- | --- |
| `.lp-beneficio__titulo` | `--lp-fs-beneficio: clamp(1.375rem, 2.5vw, 2rem)`, peso 650, lh 1,16, ls −0,018 em | 32 px / 37,1 px / −0,576 px |
| `.lp-dos-tonos` (explicación) | `--lp-fs-parrafo: clamp(1.0625rem, 1.55vw, 1.3125rem)`, lh 1,45, ls −0,005 em | 21 px / 30,5 px |
| Ícono del check | `.lp-beneficio__check .icon` | 28 × 28 px, color `--lp-acento` |
| Separación de la parrilla | `gap: clamp(2.25rem, 5vw, 3.5rem) clamp(2rem, 6vw, 5rem)` | 56 px vertical × 86 px horizontal |

Escala completa del sitio declarada en landing.css:58-63 — hero
`clamp(2rem, 6.2vw, 4.75rem)`, sección `clamp(2rem, 4.8vw, 3.5rem)`, beneficio 2rem,
párrafo 1,3125rem, cuerpo 17 px, nota 12 px.

**Queda pendiente**: en `landing.css` no aparece una regla `.lp-pieza__titulo`, así que
el título de las piezas de «Qué hacemos» hereda de otra clase y no está medido.


## Techo tipográfico real (decisión documentada, no descuido)

`fonts.css:77-79` sirve **una sola cara variable de SF Pro con eje de peso 400–700**; las
declaraciones de 100–900 (`fonts.css:97`, `:112`, `:126`, `:141`) son alias que resuelven
por `local()`, es decir solo existen en máquinas de Apple. Lo confirmó el navegador:
`document.fonts` devolvió exactamente `SF Pro 400 700 normal` cargado, 55.888 bytes.

El recorte es deliberado y está explicado en el encabezado de
`scripts/preparar-sf-pro.mjs`: el eje `wght` se cerró a 400–700 porque son los pesos que
usa BWS (400, 500, 600, 650 y 700), **conservando el eje `opsz` 17–28** —con
`font-optical-sizing: auto` el titular de 76 px sale con la geometría Display y el cuerpo de
16 px con la Text sin declarar dos familias— y fijando `wdth` en 100 para bajar el fichero
de ~250 KB a ~56 KB. Es decir: 650 ya es un Semibold real interpolado, no un Bold falso, y
el comportamiento óptico de Apple ya está conseguido.

Consecuencia honesta para el rediseño: **ningún peso por encima de 700 es posible hoy sin
rehacer el subconjunto**, y esto último no se puede ejecutar en esta máquina ahora mismo:
el maestro `SF-Pro.ttf` no aparece en el árbol del usuario (`find` hasta 4 niveles) y el
entorno `fonttools` que pide el script (`/tmp/venv-fonts/bin/pyftsubset`) tampoco existe.
Abrir el eje a 800 exige descargar la fuente de Apple y montar el venv, lo que además
cambia el binario versionado en `src/assets/fonts/`. Si la especificación pide 800, se
reporta al dueño como decisión, no se improvisa.

## Estado del `<title>` y el meta

`index.html:6-21`: título de 56 caracteres con guion largo y frase completa
(«Blink Web Services — Solo traes dos cosas: una idea y el dinero»), descripción de 214
caracteres, `og:locale es_VE`, `og:image` apuntando a `/og.png` de 1200×630 y un
`og:image:alt` que repite el título con punto final. Apple no escribe así: sus títulos son
`Producto - Compañía` y sus descripciones van al hecho, no al chiste.

## Inventario de íconos propios

`src/components/Icono.tsx` (118 líneas) declara exactamente **nueve geometrías** en una
retícula de 24 con trazo 1,75 y extremos redondos, todas entintadas con `currentColor` y
`fill: none` salvo `whatsapp`, que va relleno por ser marca de terceros:

`check` · `chevron` · `flecha` · `pagina` · `app` · `portafolio` · `whatsapp` ·
`telefono` · `correo`

El `chevron` apunta a la derecha cerrado y `landing.css` lo gira 90° al abrir, que ya es el
gesto del acordeón de Apple. No hay ícono de globe, escudo, tarjeta, reloj, taller ni
grafico: si la especificación pide acompañar los ocho bloques con símbolo propio, hay que
**dibujar geometrías nuevas en ese mismo sistema**, no descargar SF Symbols (la licencia de
Apple no permite servirlos en la web).

## Estructura de componentes

Solo existen seis componentes en `src/components/`: `Acordeon`, `Icono`, `MarcaBWS`,
`Pagos`, `Seccion`, `Socios`. `src/pages/Landing.tsx` (275 líneas) escribe el hero en línea
y llama a `<Seccion>` siete veces con la prop `tema` (`clara` / `gris` / `oscura`), que es lo
que produce la alternancia blanco → negro → blanco → gris medida arriba. Casi no quema
texto: el copy vive en `src/lib/contenido.ts`, así que la redacción y la estructura pueden
cambiarse en paralelo sin chocar entre archivos.

## Voz actual del copy (leída completa el 2026-11-25)

`src/lib/contenido.ts` abre con un bloque de regla que el dueño escribió a propósito: no se
dicen tecnicismos, no se nombran las herramientas, frases cortas y afirmativas, y todo lo que
el cliente no preguntó se va. El gate `npm run verificar` lo sostiene.

Esa voz **no es slop**. «Un audio, un correo, un boceto en una servilleta. Como te salga.»,
«Nada, para eso estamos nosotros.» y «Cero papeleo. Cero contraseñas raras.» son exactamente
lo que la skill no-slop pide: concreto, con fricción, en segunda persona, sin adjetivos de
folleto. El objetivo Apple no puede borrarlo: hay que conservar el carácter y tocar solo la
estructura y los defectos reales.

Defectos concretos que sí se encontraron leyendo el archivo entero:

1. **Trato roto.** `SERVICIOS.piezas[0].cuerpo` dice «Su negocio, bien presentado» de usted,
   mientras el resto del sitio tutea. Es el único caso en las 225 líneas.
2. **Beneficio centrado en Blink, no en el cliente.** `BENEFICIOS.piezas[3]` se titula
   «Atado a la tecnología que sostiene a Blink» y su cuerpo es «No es un experimento: es la
   forma en que ya trabajamos todos los días»: la única de las cuatro piezas que no nombra
   algo de lo que el cliente deja de preocuparse, y usa el patrón «No es X, es Y» que la
   skill prohíbe.
3. **Titulares sin patrón.** 7 palabras («Cosas por las que dejas de preocuparte.»), 2
   («Qué hacemos»), 2 interrogativas («¿Cómo trabajamos?»), 6, 5 y 1 («Hablemos.»). Mezcla
   interrogativas y afirmativas sin criterio, y Apple sostiene una forma única.
4. **Adverbio de relleno.** `PROCESO.bajada` es «Es muy sencillo.»
5. **Promesa larga y redundante.** `PROMESA.titulo` tiene 12 palabras y repite la raíz:
   «…la misma tecnología que hace funcionar a Blink».
6. **Frase clonada entre páginas.** `HERO.sub` («Nosotros nos encargamos del resto.») y la
   `og:description` de `index.html:16` («Del resto nos encargamos nosotros.») dicen lo mismo
   con distinto orden; además `PREGUNTAS` responde «…del resto nos ocupamos nosotros» usando
   otra variante y repitiendo «nosotros» dos veces en la misma respuesta.

## Los dos azules (causa raíz de la medición del botón)

El inventario de `docs/estilo/tokens-actuales.md` (256 declaraciones extraídas de
tokens.css y landing.css) muestra que conviven dos azules distintos y ninguno es el de
Apple:

| Token | Valor | Dónde |
| --- | --- | --- |
| `--color-action-fill` | **#0066cc** | tokens.css:92 — el relleno real de los botones primarios |
| `--color-accent-text` | #0066cc, y `light-dark(#0066cc, #8cc7ff)` | tokens.css:106-107 |
| `--lp-enlace` | #0066cc | landing.css:44 |
| `--lp-acento` (claro) | **#007AFF** | landing.css:45 — el que pinta los checks y los íconos |
| `--lp-acento` (oscuro) | #0091ff | landing.css:86 |

Por eso el botón sale `rgb(0,102,204)` y el ícono de al lado sale `#007AFF`: **la landing
usa un azul para acciones y otro para acentos**, sin que ninguno sea el `#0071e3` del botón
de marketing de Apple ni el `#0A84FF` del sistema. Unificar esto es una decisión de la
especificación, no un arreglo de un ejecutor de estilos.

## Revisión del diff de redacción (Lucía, 2026-11-25 15:26)

Revisado en curso con `git diff`. Resuelve bien los defectos 1, 3, 4 y 5: `Su negocio` →
`Tu negocio`, los seis titulares pasan a forma afirmativa corta («Lo que dejas de cargar.»,
«Así trabajamos», «Ya está en Internet», «Los que ya lo hacen.»), `Es muy sencillo.` se volvió
`Tres pasos.` y la promesa de 12 palabras se acortó. La frase protegida «Nada, para eso
estamos nosotros.» sigue intacta.

Tres cosas que hay que corregir antes de dar por buena la ronda:

1. **Compromiso inventado (bloqueo).** `BENEFICIOS.piezas[3].cuerpo` nuevo afirma
   «lo arreglamos y te avisamos antes de que alguien tenga que llamarte para contártelo», y la
   respuesta de `PREGUNTAS` sobre saber de tecnología añade «si algo se cae después, lo
   levantamos sin que tengas que describirnos el daño». Ninguna fuente del repo documenta
   monitoreo proactivo ni aviso antes del reporte del cliente: lo que existe es el canal
   abierto 24/7 (`CONTACTO.horario`). Hay que reescribir las dos líneas para prometer solo lo
   que ya está escrito, o preguntar al dueño si quiere asumir esa promesa.
2. **El clon se movió, no se resolvió.** `og:description` nueva empieza «Tú traes la idea y el
   dinero para pagarla», que repite literalmente el titular del hero («Solo traes dos cosas: una
   idea y el dinero»). El defecto 6 pedía que las tres variantes dijeran cosas distintas.
3. **`PROMESA.titulo` quedó críptica.** «Blink corre sobre esto.» pierde el referente: fuera de
   contexto no se sabe qué es «esto». La idea que hay que sostener es que el proyecto del
   cliente corre sobre la misma tecnología con la que Blink opera lo suyo, en menos palabras y
   sin repetir la raíz «funcionar».

Además, `HERO.sub` cambió de «Nosotros nos encargamos del resto.» a «El resto lo hacemos
nosotros.» sin ganancia: era un cambio cosmético y el original ya era la voz del dueño.

## Verificaciones ejecutadas hoy

- `npm run typecheck` → sin errores.
- `npm run verificar` → «sin tecnicismos en 17 archivos de cara al cliente».
- `npm run build` → correcto.
- `node scripts/capturas.mjs` → sin desborde horizontal a 390, 768 y 1440
  (`culpables: []` en los tres anchos); 12 capturas nuevas archivadas en
  `.capturas-antes/` (42 archivos) para comparar contra el después.
