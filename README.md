# Blink Web Services — bws.blink.com.ve

La landing de la división de Blink que pone proyectos en Internet. El
cliente trae dos cosas: una idea y el dinero para pagarla. Del resto —
el nombre, el correo, el diseño, la publicación — se encarga BWS, y esa
es la única promesa que el sitio hace en voz alta.

**Regla de oro del copy:** aquí no se dice `base de datos`, `hosting`,
`servidor`, `API`, `DNS`, `CDN`, `repositorio` ni `deploy`, y no se
nombra a Supabase, GitHub, Cloudflare, Neon, AWS, Zoho, Resend, Qoder ni
nic.ve. Son las tecnologías que usamos, no parte de lo que el cliente
tiene que entender. Los únicos nombres de terceros que se ven son los
logos de la banda de aliados, y salen sin una línea de explicación. La
regla es comprobable: `npm run verificar` (`scripts/sin-tecnicismos.mjs`)
recorre el copy, los componentes y lo que se sirve desde `public/`,
quita los comentarios y falla si encuentra una sola aparición visible.
Las nueve marcas viven en `src/lib/socios.ts`, que es el único archivo
eximido del segundo grep: fuera de ese almacén, cualquier mención a un
vendor en el copy es un fallo.

## Stack

React 19 + Vite 8 + TypeScript estricto. Sin router, sin service worker,
sin manifiesto de PWA: es una página informativa y un service worker
solo complicaría el cacheo en la CDN.

El sistema visual es el de la familia Blink, copiado de `Pay`: `fonts.css`
(SF Pro pedido con `local()`, Inter variable como respaldo servido),
`tokens.css` (escala de radios y tipografía), `base.css` (foco visible,
`.visualmente-oculto`) y `landing.css` podado para BWS. El tema lo fija
**la sección** (`.lp-seccion--clara` / `--oscura` / `--gris` redefinen los
`--lp-*`), no el sistema operativo, así que el sitio se ve igual en un
iPhone con modo oscuro que en un Windows con tema claro.

## Comandos

```
npm install
npm run dev            # 5176
npm run typecheck
npm run build          # dist/
npm run preview        # 4176, sobre dist/
npm run verificar      # el grep de tecnicismos
npm run capturas       # 390 / 768 / 1440 a .capturas/
npm run detalle        # lupa de bloques sueltos sobre el DOM
npm run og             # regenera public/og.png (1200×630)
npm run deploy         # build + gh-pages
npm run vivo           # comprueba el dominio ya publicado
```

`capturas`, `detalle`, `og` y las tres mediciones necesitan Chromium. En
esta máquina los MCP de navegador no arrancan, así que los scripts manejan
`playwright-core` contra `/usr/bin/chromium`:

```
CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ npm run capturas
```

Cada Chromium tarda decenas de segundos en levantar aquí; los scripts
presupuestan 300 s por render y esperan `document.fonts.ready` antes de
capturar, porque sin eso la primera salida trae la métrica de respaldo y
el lockup se ve desplazado — que es justamente el detalle que hay que
comprobar.

## La marca, y por qué el lockup es mixto

`src/assets/marca-blink.svg` es el maestro aprobado, con la geometría
intocable: ni un número de los `d=` se reinterpreta. El sitio no lo usa
tal cual: usa `src/assets/marca-blink-texto.svg`, la misma silueta
recortada a la tinta del wordmark y **sin el isotipo**, que genera
`scripts/generar-marca-texto.mjs`. El script extrae el grupo
`#wordmark`, mide su caja de tinta transformando `getBBox()` por
`getCTM()` y, antes de escribir nada, verifica que los cinco trazos
aparezcan byte a byte en la salida — si uno cambiara, el script falla en
vez de producir una marca nueva. El maestro queda intacto como
referencia.

`MarcaBWS.tsx` pinta ese wordmark inline (sanitizando `id` y atributos de
Inkscape para no colisionar en el DOM) y le añade «Web Services» **como
texto**, no como trazos, al mismo peso Medium 500 con el que
`blink-pay.svg` declara su «Pay». No existe geometría aprobada para esas
letras y en esta máquina no se puede generar sin SF Pro instalado.

La proporción del lockup no está a ojo, está medida:

- `scripts/medir-pay.mjs` lee el lockup maestro y saca que «Pay» ocupa
  176 unidades de mayúscula contra 176 de «Blink» (razón 1,00) y las
  separa 31,5 unidades sobre 582 de ancho.
- Razón 1,00 no es trasladable: «Web Services» son doce letras y a ese
  tamaño se convertiría en la protagonista. BWS fija 0,62.
- `scripts/medir-lockup.mjs` mide la caja del wordmark (179 unidades de
  mayúscula sobre una caja de tinta de 193,14) y la mayúscula real de la
  pila que se sirve, y comprueba que el lockup completo cabe en el
  contenedor en los tres anchos. Con `font-size: 1em` en el descriptor la
  razón sale 0,629.
- Al recortar la caja de 869 a 592,12 unidades de ancho el `em` del
  wordmark baja con ella: `3,943 = 5,79 × (592,12/869) × (194/193,14)`.
  Sin esa compensación la marca habría crecido un 47 % y el descriptor
  habría perdido la razón 0,62.
- El CSS dimensiona todo en `em` desde **un solo mando** (`font-size` del
  contenedor). Antes cada pieza tenía su propio `clamp()` y el descriptor
  se quedó a 0,27 de la mayúscula del wordmark en la captura de 1440.
- `scripts/medir-titular.mjs` decide el mínimo del `clamp()` del titular:
  con 38 px la frase ancla caía en 3 líneas [249, 272, 190] y partía
  «cosas: una» por la mitad; con 32 px mide 314 + 292 px en los 358
  disponibles y el quiebre cae después de los dos puntos.

En pantallas de menos de 421 px el descriptor pasa a la sigla «BWS»; el
HTML lleva los dos textos y solo cambia la visibilidad.

En la barra la marca se centra a mano, no por accidente: el ancla es
`inline-flex` con `align-items: center` (con `baseline` dentro de una caja
de 44 px el contenido quedaba pegado arriba, que era el «muy arriba» de la
captura) y encima lleva `padding-top: 0.225rem`, calibrado con
`scripts/detalle.mjs` — el descriptor aporta su descendente a la altura de
línea y la tinta queda 3,6 px por encima del eje. Con 7,2 px de padding el
desvío pasó de −3,6 a +3,6; con 3,6 px `barra.desvioConEnlaces` y
`desvioConBoton` salen en `0`.

## Los logos de aliados

`src/lib/socios.ts` guarda nueve marcas. Cinco con trazado oficial
vendorizado en el repo (bajados de `cdn.simpleicons.org`, no se pide nada
a un tercero al cargar la página): GitHub, Cloudflare, Supabase, Neon y
Zoho Mail. Cuatro sin vector disponible —AWS, Qoder y `nic.ve` dan 404 o
403 en simpleicons y en devicon— se componen como texto-marca: el nombre,
que es lo único reproducible sin licencia, en la pila de la familia.

**El orden del array es la jerarquía**, y la jerarquía es una matriz de
tres por tres: `landing.css` agranda por posición (`:nth-child(-n + 3)`
32 px de tinta, `n + 4`–`n + 6` 26 px, el resto 22 px), así que mover una
marca en el almacén le cambia el tamaño solo. Cada nombre se pinta al
lado de su logo, como es su marca, y la banda no explica qué hace cada
cual: es prueba social, no documentación.

Cada `viewBox` está recortado a su **caja de tinta medida** —no a la caja
cuadrada de 24×24— con `scripts/medir-socios.mjs`, que lee este mismo
archivo: así lo que se publica es exactamente lo que se midió. Sin el
recorte, la nube de Cloudflare ocuparía la mitad del cuadro y se vería la
mitad de grande que el rayo de Supabase. Sobre eso cada marca trae un
`alto` de ajuste óptico (las tiras anchas pesan más que los cuadrados a
igual altura) calibrado mirando la captura, no la cabeza.

## La tarjeta de enlace

`npm run og` (`scripts/og.mjs`) escribe `public/og.png`, 1200×630 exactos
con la misma pila y el mismo wordmark del sitio. Es negra y vacía a
propósito: la tarjeta se ve a ~280 px dentro de una burbuja de WhatsApp,
y ahí solo se lee UNA frase. Papel `#000`, la firma arriba, el titular en
`#f5f5f7`, la bajada en `#a1a1aa` y el dominio en `#6e6e73` — los tokens
de la tema oscura de `landing.css`, no una paleta nueva — y nada de
degradados, puntos de color ni listas de servicios. Se renderiza a 2× y
se baja a 1× con el propio Chromium, que deja los trazos del wordmark más
nítidos que renderizando directo y pesa la mitad (86 KB).

## Límites de verificación de esta máquina

- **No hay SF Pro instalada.** Las capturas salen con Inter, que es el
  respaldo declarado en `fonts.css` y comparte eje de peso y proporción,
  así que el layout, la métrica y el contraste quedan validados. La
  comprobación tipográfica final en SF Pro tiene que hacerse en un
  dispositivo Apple y es un hito aparte, no un detalle olvidado.
- **El FAQ necesita JavaScript.** Es una SPA: las respuestas se montan
  con React y `aria-expanded`, así que con JS desactivado el bloque de
  preguntas no se despliega. El resto de la página —titular, servicios,
  proceso, promesa, contacto— vive en el HTML y en el bundle inicial, y
  el acordeón es el único sitio que depende de hidratación.
- **Contraste.** Comprobado sobre los tokens heredados: `#1d1d1f` sobre
  blanco 16,1:1 · `#424242` sobre `#f2f2f7` 8,4:1 · `#6e6e6e` sobre
  blanco 5,1:1 (el suelo de la banda de aliados, no se baja de ahí) ·
  `#a1a1aa` sobre negro 8,9:1. Los dígitos del proceso van sobre
  `#0066cc` (5,6:1 con blanco) y no sobre `#007AFF` (3,36:1, reprobado).

## Publicar

Estado a 2026-11-09, de noche. El sitio **está sirviendo** en
`https://bws.blink.com.ve/` con certificado propio válido, y el `http://`
redirige a `https://` — igual que `pay` y `pos`.

Hecho y comprobado contra el dominio (no contra `npm run preview`):

1. Repo `BLINK-SERVERS/BWS` (público, como `Pay` y `POS`), rama `main`
   con las fuentes.
2. `npm run deploy` publica `dist/` en la rama `gh-pages`. Pages la toma
   como origen (`status: built`), leyó `public/CNAME` y registró el
   dominio personalizado con `404.html` propio. `.nojekyll` viaja desde
   `public/` para que Pages no pase el `dist/` por Jekyll.
3. El `CNAME` de `bws` a `blink-servers.github.io` existe en la zona, sin
   proxy, igual que `pay` y `pos`. Responde en 1.1.1.1 y en 8.8.8.8; el
   router de esta casa todavía tiene cacheada la respuesta negativa de
   antes (mínimo de la zona: 1800 s), así que las comprobaciones
   inyectan la IP con `--resolve` en `curl` y con
   `--host-resolver-rules` en Chromium. El export de la zona del
   2026-11-09 lo confirma: `bws`, `pay` y `pos` salen con
   `cf-proxied:false`, y el raíz y `www` con `true`. Como los dos
   subdominios sin proxy tienen certificado propio de GitHub, al de
   `bws` le falta solo emisión — no es un problema de Cloudflare.
4. Rutas: `/`, `/404.html`, `/robots.txt`, `/sitemap.xml`,
   `/favicon.svg`, `/favicon.png`, `/og.png`, el JS y el CSS con hash y
   el `inter-latin.woff2` que referencia el CSS — todas 200. El HTML
   servido lleva la frase ancla nueva en los cinco `meta` y cero
   apariciones de la palabra vieja. Render real en 1440: 4 beneficios,
   3 servicios, 3 pasos, 9 aliados, la promesa literal, los tres
   enlaces de contacto, el acordeón abriéndose, 0 px de overflow y 0
   errores de consola.

Se comprueba con `npm run vivo` (`scripts/en-vivo.mjs`), que sale con
código distinto de cero si algo de lo anterior falla — incluidas las
cabeceras de la sección 3, que exigen el `301` de `http://` y que seguirlo
aterrice en `200` con la verificación TLS en `0`. Si alguien vuelve a
apagar *Enforce HTTPS*, el chequeo lo detecta solo.

**Estado del último cambio de copy (2026-11-10): verificado en local, no
publicado.** La tanda nueva —marca sin isotipo, «Hablemos» a WhatsApp,
beneficios, servicios, proceso, promesa sin subtítulo, banda de nueve,
FAQ con la pregunta de las tarifas y la `og.png` negra— está construida,
capturada y comprobada contra `npm run preview`: typecheck limpio, build
limpio, `npm run verificar` en 13 archivos, 0 violaciones de axe en 390 y
1440, 0 px de desborde en los tres anchos y `desvioConEnlaces: 0` en la
barra. `npm run vivo` todavía fallaría contra el dominio porque ahora
exige esa copy y `gh-pages` sigue sirviendo la versión del 2026-11-09. El
desfase se cierra con `npm run deploy`, que es un pedido explícito y no
una consecuencia automática de este commit.

Las dos cosas que faltaban no se podían hacer desde esta máquina; ya
están ambas:

5. **El certificado propio ya está.** Se emitió el 2026-11-09 a las
   23:17:53 UTC — Let's Encrypt `YR2`, `CN = bws.blink.com.ve`, vigente
   hasta el 2027-02-07 — y se propagó por los cuatro bordes de Pages
   unos minutos después. Un cliente estricto (`curl` sin `-k`) responde
   `200` con `ssl_verify_result = 0`. Antes de eso el edge servía el
   comodín `*.github.io`, que no ampara el nombre, y la casilla de
   *Enforce HTTPS* aparecía deshabilitada: sin certificado no hay botón,
   así que el orden era forzado — primero emitir, después marcar.
6. **HTTPS forzado, activado.** `Pay` y `POS` ya lo tenían; aquí quedó
   marcado a mano en Settings → Pages → *Enforce HTTPS*, porque el token
   de `gh` no trae el scope `pages` y el `PATCH` a `/pages` responde
   `404` incluso con el certificado existente, mientras que
   `POST /pages/builds` sí pasa. Comprobado sobre el dominio: `http://`
   responde `301` con `Location: https://bws.blink.com.ve/` en `/`,
   `/404.html`, `/og.png`, `/favicon.svg` y los `assets` con hash, y
   seguir el salto da `200` con `ssl_verify_result = 0` en un solo
   rebote. `gh api repos/BLINK-SERVERS/BWS/pages` reporta
   `https_enforced: true`. GitHub no envía `Strict-Transport-Security`,
   así que el forzado es solo el `301`: una primera visita escrita sin
   esquema depende de que el navegador pruebe `https://` antes, como
   hacen los actuales.
