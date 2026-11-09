# Blink Web Services — bws.blink.com.ve

La landing de la división de Blink que pone proyectos en Internet. El
cliente trae dos cosas: una idea y el dinero para pagarla. Del resto —
el nombre, el correo, el diseño, la publicación — se encarga BWS, y esa
es la única promesa que el sitio hace en voz alta.

**Regla de oro del copy:** aquí no se dice `base de datos`, `hosting`,
`servidor`, `API`, `DNS`, `CDN`, `repositorio` ni `deploy`, y no se
nombra a Supabase, GitHub, Cloudflare, Zoho ni nic.ve. Son las
tecnologías que usamos, no parte de lo que el cliente tiene que
entender. Los únicos nombres de terceros que se ven son los logos de la
banda de aliados, y salen sin una línea de explicación. La regla es
comprobable: `npm run verificar` recorre el copy, los componentes y lo
que se sirve desde `public/`, quita los comentarios y falla si encuentra
una sola aparición visible.

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

`src/assets/marca-blink.svg` es el wordmark aprobado, con la geometría
intocable: ni un número de los `d=` se reinterpreta. `MarcaBWS.tsx` lo
pinta inline (sanitizando `id` y atributos de Inkscape para no colisionar
en el DOM) y le añade «Web Services» **como texto**, no como trazos, al
mismo peso Medium 500 con el que `blink-pay.svg` declara su «Pay». No
existe geometría aprobada para esas letras y en esta máquina no se puede
generar sin SF Pro instalado.

La proporción del lockup no está a ojo, está medida:

- `scripts/medir-pay.mjs` lee el lockup maestro y saca que «Pay» ocupa
  176 unidades de mayúscula contra 176 de «Blink» (razón 1,00) y las
  separa 31,5 unidades sobre 582 de ancho.
- Razón 1,00 no es trasladable: «Web Services» son doce letras y a ese
  tamaño se convertiría en la protagonista. BWS fija 0,62.
- `scripts/medir-lockup.mjs` mide la caja del wordmark (179 unidades de
  mayúscula sobre una caja de 194) y la mayúscula real de la pila que se
  sirve, y comprueba que el lockup completo cabe en el contenedor en los
  tres anchos. Con `font-size: 1em` en el descriptor la razón sale 0,629.
- El CSS dimensiona todo en `em` desde **un solo mando** (`font-size` del
  contenedor). Antes cada pieza tenía su propio `clamp()` y el descriptor
  se quedó a 0,27 de la mayúscula del wordmark en la captura de 1440.
- `scripts/medir-titular.mjs` decide el mínimo del `clamp()` del titular:
  con 38 px la frase ancla caía en 3 líneas [249, 272, 190] y partía
  «cosas: una» por la mitad; con 32 px mide 314 + 292 px en los 358
  disponibles y el quiebre cae después de los dos puntos.

En pantallas de menos de 421 px el descriptor pasa a la sigla «BWS»; el
HTML lleva los dos textos y solo cambia la visibilidad.

## Los logos de aliados

`src/lib/socios.ts` guarda los trazados oficiales de Supabase, GitHub,
Cloudflare y Zoho vendorizados en el repo (bajados de
`cdn.simpleicons.org`, no se pide nada a un tercero al cargar la página).
Cada `viewBox` está recortado a su **caja de tinta medida** —no a la caja
cuadrada de 24×24— con `scripts/medir-socios.mjs`, que lee este mismo
archivo: así lo que se publica es exactamente lo que se midió. Sin el
recorte, la nube de Cloudflare ocuparía la mitad del cuadro y se vería la
mitad de grande que el rayo de Supabase.

`nic.ve` no tiene marca vectorial oficial (simpleicons responde 404), así
que se compone como texto-marca con el mismo peso y el mismo alto de
tinta que el resto de la fila.

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

Nada de esto se ejecuta solo; hace falta pedirlo.

1. `bws.blink.com.ve` sigue siendo NXDOMAIN. Hay que añadir un CNAME en
   la zona de `blink.com.ve` (Cloudflare) apuntando al host de GitHub
   Pages.
2. Repo nuevo en la organización `BLINK-SERVERS` (o una rama del
   existente) y `npm run deploy`, que construye y publica `dist/` con
   `gh-pages`. `public/CNAME` ya lleva el dominio para que Pages lo
   sirva como dominio personalizado.
3. Con el certificado de Cloudflare por delante, comprobar que
   `https://bws.blink.com.ve/` y `/404.html` responden y que el enlace
   de WhatsApp (`wa.me/16318211938`) y el `mailto:` salen como se
   escribieron.
