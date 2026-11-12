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
logos de la cinta de aliados, y salen sin una línea de explicación. La
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
(SF Pro con `local()` delante y el recorte del repo detrás, Inter variable
como respaldo servido), `tokens.css` (escala de radios y tipografía),
`base.css` (foco visible, `.visualmente-oculto`) y `landing.css` podado
para BWS. El tema lo fija
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
npm run sf-pro         # fabrica el recorte servido de SF Pro
npm run logos          # clavea y recorta los lockups de la cinta
npm run deploy         # build + gh-pages
npm run vivo           # comprueba el dominio ya publicado
```

`capturas`, `detalle`, `og` y las tres mediciones necesitan Chromium. En
esta máquina los MCP de navegador no arrancan, así que los scripts manejan
`playwright-core` contra `/usr/bin/chromium`:

```
CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ npm run capturas
```

`npm run deploy` commitea en `gh-pages` con git, y en esta máquina no hay
`user.name` ni `user.email` globales — ni se van a escribir. La identidad
se pasa por el entorno del comando:

```
GIT_AUTHOR_NAME=BLINK GIT_AUTHOR_EMAIL=blink@local \
GIT_COMMITTER_NAME=BLINK GIT_COMMITTER_EMAIL=blink@local npm run deploy
```

Sin eso `gh-pages` aborta con `Identidad del autor desconocido` después de
la construcción: el `dist` queda hecho, pero nada publicado.

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

## La tipografía: SF Pro servida

Desde el 2026-11-10 la landing usa SF Pro **en todos los equipos**, no
solo en los que la tienen instalada. El sitio se ve igual en un iPhone
que en un Windows porque el `src` de la familia pone `local()` **antes**
del `url()`: quien ya la tiene no baja ni un byte, y quien no, descarga
`src/assets/fonts/sf-pro-latin.woff2` — 54,6 KB.

Es un solo fichero variable, no ocho caras:

| qué | valor | por qué |
|---|---|---|
| eje `wght` | 400–700 | son los pesos que usa BWS (400 heredado, 500, 600, 650, 700). Con rango declarado, 650 es 650 en el eje: con caras estáticas el CSS habría saltado de 600 a un Bold prestado |
| eje `opsz` | 17–28 | el corte óptico. `font-optical-sizing: auto` (ya estaba en `base.css`) hace que el titular de 76 px salga con geometría Display y el cuerpo de 16 px con la Text, sin declarar dos familias |
| eje `wdth` | fijado en 100 | no hay condensados; es el eje que más pesa: con él el fichero pasa de ~250 KB a ~56 KB |
| glifos | el mismo `unicode-range` que Inter | si un carácter está en Inter, está en SF Pro |
| rasgos | `kern,liga,calt,ccmp,mark,mkmk` | caen las numéricas (`tnum/onum/lnum/frac/sups`): no hay ningún `font-variant-numeric` en la página y son 8 KB que nadie llama |

Lo fabrica `npm run sf-pro` (`scripts/preparar-sf-pro.mjs`) a partir del
`SF-Pro.ttf` variable de Apple, en tres pasos: recorte de glifos →
`varLib.instancer` con los ejes → segundo recorte y woff2. El script sale
con error si el resultado pasa de 72 KB, que es la forma de detectar que
la receta se rompió. Necesita `fontTools` + `brotli` en un venv
(`python3 -m venv /tmp/venv-fonts && /tmp/venv-fonts/bin/pip install
fonttools brotli`) y la ruta del `.ttf` original, que **no** entra en el
repo: entra el recorte, que es lo que se sirve.

**Licencia.** San Francisco es material de Apple y `fonts.css` documentaba
una decisión explícita de no distribuirla (retirada de ficheros en la
v1.5.0). Esa decisión se revierte **aquí y solo aquí**, por autorización
expresa del dueño del proyecto, que tiene la licencia. `Pay` y `POS`
conservan su `local()` puro: cada sitio responde por su propia licencia,
y cambiar BWS no cambia los otros dos.

**Lo que hay que recalibrar cuando cambie la cara servida**, porque la
métrica manda: la mayúscula de SF Pro vale 0,72 em contra los 0,75 de
Inter, así que el descriptor del lockup pasó de `1em` a `1,027em` para
mantener la razón 0,62 (medido: 0,620 en los tres anchos) y el
`padding-top` de la barra de `0,225rem` a `0,19375rem` para que la tinta
vuelva al eje (`desvioConEnlaces: 0`, `desvioConBoton: 0`). Los dos
números los devuelven `npm run detalle` y `node scripts/medir-lockup.mjs`;
`medir-lockup.mjs` además imprime `sfProCargada` y la lista de woff2 que
bajó de verdad, que es la prueba de que no se está colando Inter.

## La cinta de aliados

El 2026-11-10 el dueño del proyecto entregó las capturas de los lockups
oficiales a color de las marcas (ocho distintas: la de Qoder venía
repetida, md5 en mano). Esas capturas están archivadas sin tocar en
`src/assets/logos/origen/*.jpg` — son la procedencia de lo que se
publica — y `npm run logos` (`scripts/preparar-logos.py`) fabrica con
ellas los `src/assets/logos/*.png` que se sirven: 126 KB entre ocho.

Un JPG no se puede colgar de una página: no tiene alfa y el fondo viene
cocido en la foto (negro en cinco, blanco en dos, `#f3f5f4` en GitHub).
El script hace cuatro cosas y nada más: mide el fondo como la mediana de
los píxeles del borde, clava la luminancia con firma (`d = (luma − luma
del fondo) × señal`, +1 si el fondo es oscuro y −1 si es claro) con una
rampa `a`/`b` por marca leída del histograma de colores dominantes,
**desmezcla** el píxel de borde (`tinta = (observado − (1−α)·fondo)/α`)
para que el trazo no salga con un halo gris sobre el blanco de la
sección, y recorta a la caja de tinta antes de exportar a 3× del alto
que va a ocupar en pantalla.

Lo que no hace: no redibuja, no recolorea, no vectoriza. Las zonas
encerradas que coinciden con el fondo (el gato blanco dentro del círculo
de GitHub, el interior del sobre de Zoho) quedan transparentes y muestran
el blanco de la sección, que es el color que ya tenían. Si la cinta se
mueve alguna vez a un fondo que no sea blanco, hay que cambiar el clavado
por un flood-fill desde el borde.

**Es una cinta, no una rejilla.** Dos pistas de lockups corren en
sentidos opuestos sobre el blanco de la sección, sangradas a la ventana y
con las puntas desvanecidas por una `mask-image` (una máscara deja ver el
papel; un degradado pintaría una franja gris). Cada pista son cuatro
juegos idénticos y el keyframe desplaza `-25%`, o sea un juego exacto: la
separación es `margin-inline-end` de cada `<li>` y no un `gap` del
contenedor, porque con `gap` sobraría medio espacio justo en la junta y
el bucle bailaría. `npm run detalle` mide la costura (`costura: 0`) y la
velocidad de cada fila.

**El orden del array sigue siendo la jerarquía**, pero ahora son dos
filas, no una matriz de tres por tres: `FILA_1 = 3` parte la lista, la
fila de arriba son las tres que hacen que el proyecto exista (34 px de
tinta) y la de abajo las seis que lo hacen andar (24 px). Encima de eso
cada marca trae un `alto` de ajuste óptico —un lockup apilado como
Cloudflare o un disco como nic.ve necesitan más altura que una palabra
para pesar igual— y **ese número lo lee también `preparar-logos.py`**:
exportar a otra altura con otro `alto` es la forma exacta de que la cinta
salga borrosa, así que el valor vive una sola vez, en el almacén.

Se pausa al pasar el puntero o el foco (un logo que se mueve no se
puede leer, y esta banda existe para que se lea), y con
`prefers-reduced-motion: reduce` la traslación se apaga, los tres juegos
de copia se ocultan y el juego que queda se envuelve centrado: la misma
información, quieta. Los nombres van en el `alt` de cada lockup; las
copias van en `aria-hidden` para que un lector de pantalla no diga
«GitHub» cuatro veces.

Resend es la única que sigue compuesta —su lockup no llegó entre las
capturas—: glifo oficial de simpleicons vendorizado en el repo más el
nombre en la pila de la familia, pintados con la tinta de la sección
(`#1d1d1f`) y no con el gris del texto de apoyo, porque al lado de ocho
marcas a color un gris pálido lee como marcador de posición. Su caja de
`viewBox` la mide `scripts/medir-socios.mjs`, que desde la cinta solo
sirve para estas marcas compuestas.

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

- **SF Pro se sirve, así que las capturas ya salen en SF Pro.** Antes
  esta máquina no tenía la fuente instalada y todo se validaba con Inter.
  Desde que el recorte vive en `src/assets/fonts/`, el Chromium de las
  capturas renderiza la cara real —`medir-lockup.mjs` lo comprueba
  reportando `sfProCargada: true` y `interCargada: false`—, y el layout,
  la métrica y el contraste quedan validados sobre la tipografía que ve
  el visitante. Lo que sigue sin comprobarse aquí es la ruta `local()` de
  un dispositivo Apple: ahí no se descarga nada y se usa la del sistema,
  que es la misma variable de Apple, así que el riesgo es bajo pero no es
  cero.
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

## Portal de clientes

`portal/` es una aplicación **independiente**: su propio `package.json`,
`vite.config.ts`, `src/`, `server/`, `api/`, `worker.ts` y `wrangler.jsonc`.
No comparte build con la landing, pero sí el dominio: el cliente se
registra en `bws.blink.com.ve/registro` y usa `/ingreso`, `/panel`,
`/proyecto`, `/admin`, `/verificar` y `/recuperar`, con los archivos del
portal bajo `/portal/assets/`. La landing la sigue sirviendo GitHub Pages;
un Worker de Cloudflare se engancha solo a esas rutas y a `/api/*`, así
que el visitante no cambia de sitio para registrarse. El navegador habla
solo con su propio origen y los proveedores viven en el servidor.

| ruta | quién responde | origen |
|---|---|---|
| `/`, `/*.js`, `/*.css`, imágenes | GitHub Pages | `dist/` de la raíz |
| `/registro`, `/ingreso`, `/panel`, `/proyecto`, `/admin`, `/verificar`, `/recuperar` | Worker `bws-portal` | `portal/dist/index.html` |
| `/portal/assets/*` | Worker `bws-portal` | `portal/dist/portal/assets/*` |
| `/api`, `/api/*` | Worker `bws-portal` | `portal/api/[...ruta].ts` |

Los enlaces del portal son rutas limpias (`/panel`, no `#/panel`) y el
Worker ejecuta primero en esas rutas (`assets.run_worker_first`) para
fijar CSP, HSTS y el resto de cabeceras: Workers sí lee `_headers` para
sus assets, pero no lo aplica a lo que genera el propio Worker (`/api`),
así que `worker.ts` fija las mismas cabeceras en código. La caché
inmutable de `/portal/assets/*` también vive solo en `worker.ts`, porque
`_headers` la estamparía en el respaldo `index.html` de un asset
inexistente. La barra de la landing enlaza «Entrar» a `/ingreso` y el
pie a «Portal de clientes», ambos locales; si el Worker no está
desplegado, esos enlaces caen en el `404.html` de Pages.

El sistema visual vive en `portal/sistema/`, una copia de `src/styles` que
mantiene `npm run sistema`; el Worker sube solo la carpeta del portal y no
puede leer `../src`, y una prueba unitaria falla si la copia se desvía. El
portal usa SF Pro para la interfaz, pero **los PDF usan Liberation
Serif/Sans/Mono** (SIL OFL 1.1, vendorizadas en `portal/render/fuentes/`).
SF Pro es de Apple y no se incrusta en documentos que se entregan.

```
cd portal
npm install
npm run dev            # 5177, solo interfaz
npm run typecheck
npm run sistema        # sincroniza tokens y fuentes desde src/
npm run build          # portal/dist/
npm run pdf            # los ocho PDF de muestra en portal/tmp/pdf/
npm run afirmaciones   # falla si un texto promete lo que no se puede probar
npm run db:migrar      # aplica portal/db/migrations como dueño
npm run admin:alta     # crea o actualiza la cuenta de administración (pide --confirmar)
npm run db:pruebas     # RLS, solo agregar, cadena y doble firma en la rama de pruebas
npm run api:pruebas    # registro, sesión, firma, proyecto, expediente, pagos y mora
npm run pruebas        # unitarias: validadores, canónica, scrypt, tokens, PNG y suscripción
npm run portal         # dist + API en http://127.0.0.1:4178 (base de pruebas)
npm run portal:pruebas # flujo completo en Chromium, axe y desborde en 390 y 1440
npm run worker:dev     # build + Worker y assets locales en workerd
npm run worker:seco    # empaqueta el Worker sin desplegar
npm run desplegar      # build + wrangler deploy
```

`npm run portal` sirve `dist/` y despacha las rutas de `server/` como lo hará
el Worker. Por defecto usa `DATABASE_URL_PRUEBAS_APP` (`PORTAL_DB=pruebas`) y se
niega a arrancar si esa cadena comparte host con la principal; `PORTAL_DB=main`
solo se usa a mano. El correo sale en modo archivo a `portal/tmp/correo-portal/`.

La base es un proyecto Neon separado (`bws-contratos`), nunca el de Pay ni
el de POS. `portal/.env.local` (ignorado por git) guarda las cadenas del
dueño y del rol de aplicación, en `main` y en la rama `pruebas`; ningún
script imprime esos valores. Las pruebas corren contra la rama `pruebas` y
abortan si `DATABASE_URL_PRUEBAS` coincide con la base de `DATABASE_URL`.

Los ocho documentos (`portal/legal/textos/`) se firman en este orden:
registro (REG-001, LEG-002, LEG-003, PRI-005, WEB-006), proyecto
(CON-004 con anexos A–F), entrega (LIC-007) y confidencialidad (NDA-008).
La regla es una: no se imprime una afirmación que no se pueda demostrar.
La firma se llama «electrónica simple, no certificada, con evidencia
reforzada»; los PDF se declaran PDF 1.7 con sello de contenido SHA-256, no
PDF/A; el registro es «no modificable dentro del sistema, con alteración
detectable», no inmutable. `npm run afirmaciones` recorre los textos y
falla si alguna de esas frases aparece sin negar o sin calificar. Lo que un
abogado debería confirmar, y el riesgo aceptado al no tenerlo todavía,
está en [`docs/legal/revision.md`](docs/legal/revision.md).

El sello se calcula sobre un JSON canónico —código, versión, hash de la
plantilla, campos usados, firmas y UTC—, nunca sobre los bytes del PDF:
un archivo no puede contener el hash de sí mismo sin invalidarse. El hash
del archivo se guarda aparte y se informa en el correo. Los documentos se
encadenan con `sha256(hash_anterior || sello || orden)` desde `GENESIS`
(ver `portal/render/hash.ts`).

Estado de la entrega M0: `typecheck` y `build` en verde; los ocho PDF se
generan en A4, PDF 1.7, con todas las fuentes incrustadas, sin marcadores
`{{` residuales, con página de firmas doble y página de evidencia; dos
pasadas idénticas producen el mismo archivo. La reproducibilidad obligó a
incrustar las fuentes **en serie**: pdf-lib numera los objetos al
registrarlos y con `Promise.all` el orden dependía de qué fuente
terminara antes.

Estado de la entrega M1: el esquema tiene diecisiete tablas —más la bitácora
de migraciones—, con triggers que abortan `UPDATE` y `DELETE` en firmas,
actos, documentos, envíos, eventos, representantes y pagos; plantillas que
solo se apagan; alcance congelado tras enviar un proyecto; RLS por fila con
`app.usuario_id` y `app.rol`; y presets de `planes_infra` idénticos a
`portal/legal/planes.ts`. El rol `bws_app` escribe filas pero no crea
objetos, no es superusuario y no toca lo inmutable. `npm run db:pruebas`
verifica las dieciséis condiciones contra la rama `pruebas`, incluida la
cadena desde `GENESIS`, la doble firma rechazada y el aislamiento entre dos
clientes; las migraciones se reejecutan sin efecto.

Estado de la entrega M2: el alta es en dos pasos. Primero se validan la
cuenta y la ficha fiscal con las mismas reglas en el navegador y en la API;
después se muestran los cinco documentos resueltos con esos datos, cada uno
con su huella SHA-256, y el alta se niega si la huella devuelta no coincide
con la que el servidor acaba de calcular. La sesión es opaca, de doce horas,
en cookie `__Host-` fuera de local; la firma se captura una sola vez, con
consentimiento previo del texto de BWS-LEG-002, y el segundo intento
devuelve 409 tanto si llega por la interfaz como si se fuerza la petición.
El correo de verificación y el de recuperación son de un solo uso y se
guardan como hash. Las pruebas cierran en 34 unitarias, 18 de API y 30 de
navegador: axe sin violaciones y cero desborde en 390 y 1440, sin peticiones
a terceros, con el flujo completo de registro, verificación, ingreso y firma.

Estado de la entrega M3: el cliente describe su proyecto —nombre, categoría,
dominio, hasta cinco buzones y alcance— y elige el plan de infraestructura.
Los buzones deben pertenecer al dominio elegido y `no-reply@` es obligatorio;
seis buzones, un dominio ajeno o un alcance de menos de cuarenta caracteres
se rechazan con el mismo criterio en el navegador y en la API. El anexo B se
arma desde `planes_infra` (dos presets, cuatro niveles, versión, fuente y
fecha) y cambia de precio al cambiar de plan; el costo y el margen internos
no salen de la base. Guardar crea o actualiza un borrador; enviar exige
correo confirmado y firma, congela el alcance con el disparador
`bws_congelar_proyecto` y deja evento de auditoría. Un proyecto enviado no se
edita ni se duplica: 409 en ambos casos. En esta etapa cada cliente tiene un
solo proyecto. Las pruebas cierran en 44 unitarias, 26 de API y 42 de
navegador, con axe sin violaciones y cero desborde en 390 y 1440.

Estado de la entrega M4: el expediente se genera sobre un proyecto enviado y
conserva las dos firmas. La administración captura la firma y el domicilio del
representante legal de Blink; sin domicilio la generación se detiene. Al
generar, los ocho documentos se resuelven con las plantillas publicadas —la
API se niega si la versión activa no coincide con el código—, se sellan con un
único instante UTC y se encadenan desde `GENESIS`; cada PDF lleva la firma del
representante y la del cliente, el sello de contenido y el eslabón de cadena.
El cliente confirma una sola vez y el segundo intento devuelve 409. La
verificación recalcula desde la base el hash de cada archivo, el sello, la
cadena y los dos actos, sin confiar en el PDF; alterar un byte del archivo deja
de coincidir con el hash guardado. Generar dos veces reutiliza lo guardado y el
proyecto pasa a `en_revision`. El sello es determinista: la fecha comercial y
el `utc_sello` se reconstruyen desde el instante guardado —con milisegundos—,
no desde la fecha del día de la verificación. Las pruebas de esa etapa
cerraron en 50 unitarias, 36 de API y 16 de base de datos.

Estado de la entrega M5: la administración entra con su propio rol y ve el
resumen —clientes, proyectos y suscripciones—, captura la firma y el domicilio
del representante, genera el expediente, lo verifica, lo descarga y lo envía.
El envío es idempotente: la clave sale del hash de lo que se manda, así que
un reintento responde que el correo ya había salido y no produce un segundo
mensaje; el correo lleva los ocho PDF adjuntos, la huella de cada uno y una
copia a la dirección de Blink. Cada descarga exige sesión, se sirve como
adjunto con su SHA-256 en la cabecera y deja un evento con actor, IP y agente
en la misma transacción que la lectura. La suscripción nace del plan con su
precio, día de cobro y días de gracia; un periodo admite un solo pago efectivo
—lo impone un disparador—, y un cobro equivocado se anula con una fila nueva
que conserva el original y el motivo. Los plazos son los del contrato: `al_dia`
hasta el vencimiento; `mora` con la gracia y diez días más; `suspendida` a los
diez días de mora, cuando el servicio y la licencia se suspenden y la
generación del expediente se niega; `terminada` a los treinta, sin vuelta. En
todos los casos los datos y el dominio siguen siendo del cliente. Reactivar
devuelve la licencia a `activa`, avisa si el vencimiento sigue vencido y deja
el estado anterior en `eventos`. Las pruebas cierran en 67 unitarias, 46 de
API, 64 de navegador y 16 de base de datos.

Estado de la entrega M6: la entrega queda endurecida y documentada.
`portal/public/_headers` aplica a los assets y `portal/worker.ts` fija las
mismas cabeceras a la API: CSP sin `'unsafe-inline'` (`script-src 'self'`,
`style-src 'self'`, `frame-ancestors 'none'`), HSTS de dos años, `nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: same-origin` y una
`Permissions-Policy` que apaga cámara, micrófono, geolocalización, pago y
USB. El servidor local lee `_headers` y aplica esas cabeceras, y la API
marca `Cache-Control: no-store`, así que la prueba de navegador las
comprueba en cada respuesta y falla si alguien mete un script o un estilo en
línea: el lienzo de firma dejó de llevar `style` y su alto vive en el CSS.
La revisión de afirmaciones suma cinco reglas —disponibilidad total,
borrado definitivo, respaldo permanente, acceso inviolable y promesa de
seguridad absoluta— y sigue en verde sobre los ocho textos. La cuenta de
administración se crea con `npm run admin:alta`, sin registro público: sin
`--confirmar` solo valida, nunca promueve un correo que ya sea cliente y no
imprime la clave. La operación (procesadores, países, retención, respaldo,
revisión de correo, incidentes) está en
[`docs/legal/operacion.md`](docs/legal/operacion.md), y el costo, margen y
suelo de cada plan en [`docs/legal/economia.md`](docs/legal/economia.md),
interno y no se entrega al cliente. Las pruebas cierran en 73 unitarias, 47
de API, 66 de navegador y 16 de base de datos.

Las variables de entorno (solo nombres, nunca valores en el repo):
`DATABASE_URL`, `DATABASE_URL_APP`, `DATABASE_URL_PRUEBAS`,
`DATABASE_URL_PRUEBAS_APP`, `APP_ORIGEN`, `CORREO_MODO`,
`CORREO_API_KEY`, `CORREO_DESDE`, `CORREO_COPIA`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SEGURO`, `SMTP_USER`, `SMTP_PASS`,
`BWS_RAZON_SOCIAL`, `BWS_RIF`, `BWS_DOMICILIO`, `BWS_CORREO`,
`BWS_TELEFONO`, `TARIFA_DESARROLLO`, `TARIFA_INFRA_PRO`,
`CORREO_PROVEEDOR_NOMBRE`, `ADMIN_CORREO`, `ADMIN_CLAVE`, `ENTORNO`.
`npm run vars` en `portal/` comprueba la producción sin imprimir valores
y `npm run vars:subir` los carga en Cloudflare.

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

**Estado de la tanda del 2026-11-10: publicado y comprobado contra el
dominio.** Lo que salió fue la marca sin isotipo, «Hablemos» a WhatsApp,
los beneficios, servicios, proceso y FAQ nuevos, la promesa sin
subtítulo, la banda de nueve, la `og.png` negra y **SF Pro servida**
(`src/assets/fonts/sf-pro-latin.woff2`, con el descriptor del lockup
recalibrado a `1,027em` y el `padding-top` de la barra a `0,19375rem`).
En local: typecheck y build limpios, `npm run verificar` en 13 archivos,
0 violaciones de axe en 390 y 1440, 0 px de desborde en los tres anchos y
`desvioConEnlaces: 0` en la barra. Después, `npm run deploy` y `npm run
vivo` sobre `bws.blink.com.ve`: las once rutas del `dist` responden `200`
incluido el woff2 de SF Pro (55.888 bytes) y el de Inter, el `http://`
sigue dando `301` con TLS verificado, el `og.png` publicado mide
1200×630, y el render real en 1440 sale **en SF Pro con una sola
descarga de fuente** (`sf-pro-latin-*.woff2`; Inter no se pide porque la
cara servida cubre el mismo `unicode-range`), con la copy nueva, el
acordeón abriéndose, 0 px de desborde y 0 errores de consola.

Dos falsos positivos del propio `en-vivo.mjs` se corrigieron en la
pasada: el `RegExp` construido desde cadena con `[^")]` dentro del grupo
dejaba el grupo sin cerrar y reventaba en tiempo de ejecución —
`node --check` no lo ve, porque un literal inválido se detecta al parsear
y uno construido desde cadena no—, y la comprobación de WhatsApp tomaba
todos los enlaces de los contenedores del hero y del cierre, incluyendo
el «Ver qué hacemos» (ancla interna) y el teléfono y el correo, que no
tienen por qué llevar a `wa.me`. Ahora solo se juzgan los que prometen la
conversación.

Un detalle del despliegue que conviene conocer: en los ~25 s que tarda
Pages en reconstruir, el edge puede servir el HTML viejo con los `assets`
ya sustituidos, y `npm run vivo` contesta `404` en los `index-*.js` y
`index-*.css`. No es un despliegue roto; es la ventana de la
reconstrucción. Se repite el chequeo y pasa.

**Estado de la cinta del 2026-11-10: publicado y comprobado contra el
dominio.** La rejilla de nueve glifos monocromos pasó a dos pistas de
lockups oficiales a color que corren en sentidos opuestos. En local:
typecheck y build limpios, `npm run verificar` en 13 archivos, 0
violaciones de axe en 390 y 1440, 0 px de desborde en los tres anchos,
`costura: 0` y 24,4 y 24,1 px/s en las dos filas de 1440, pausa real con
el puntero (`running` → `paused` en las dos pistas, 37 px de desplazamiento
en 1,5 s) y la variante `prefers-reduced-motion` medida en 390 y 1440
(animación `none`, las copias sin pintar, los nueve nombres presentes,
sin desborde). Después vino el despliegue y `npm run vivo` sobre
`bws.blink.com.ve`: `aliados 9`, los 32 `<img>` de la cinta cargados y
ninguno roto, `fila 1: lp-cinta 24 px/s · juego 636 px · pista 2543 px`
y `fila 2: … 892 px · 3569 px` — la pista de cada fila es exactamente
cuatro veces su juego, que es lo que hace que el bucle no se vea —, las
once rutas del `dist` en `200` incluidos los ocho PNG con hash, el `301`
de `http://` con TLS verificado en `0`, `og.png` de 1200×630, el render
en SF Pro, 0 px de desborde y 0 errores de consola. La cinta publicada
también se fotografió desde el dominio (`.capturas/1440-cinta-vivo.png`
y `.capturas/390-cinta-vivo.png`, locales): los lockups a color sobre el
blanco, 0 imágenes rotas y ni una sola petición fuera de `blink.com.ve`.

El primer `npm run vivo` después del push dijo `aliados 0`: era la ventana
de reconstrucción de arriba, el edge todavía servía `index-M7VEzz5M.js`
con la rejilla vieja. Se repitió y pasó con el bundle nuevo
(`index-CxKUOIDB.js`, `index-C7Hncrdl.css`).

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

**Estado de la tanda del 2026-11-11: el portal en `bws`, aún sin
desplegar.** El registro dejó de vivir en un subdominio aparte: ahora es
`bws.blink.com.ve/registro`, con las otras seis rutas del portal y la API
en el mismo nombre, y la landing sigue en GitHub Pages. La landing suma
«Entrar» en la barra y «Portal de clientes» en el pie, ambos a
`/ingreso`. En local quedó así: typecheck y build de la landing limpios,
`npm run verificar` en 13 archivos, 0 violaciones de axe y 0 px de
desborde en 390 y 1440 con los dos enlaces nuevos; portal con 73
unitarias, 66/66 comprobaciones de navegador y `afirmaciones` en verde;
`wrangler deploy --dry-run` empaqueta sin errores y `wrangler dev` sirve
`/registro`…`/recuperar` con `index.html`, CSP y HSTS, y `/portal/assets/`
con caché inmutable. Falta lo que depende de la cuenta del dueño: iniciar
sesión en Wrangler (`npx wrangler login` una vez, o
`CLOUDFLARE_API_TOKEN` en `portal/.env.local`), poner el `CNAME` de `bws`
en proxied y cargar secretos y variables; después `npm run desplegar`
dentro de `portal/`. Mientras el Worker no esté publicado, «Entrar» y
«Portal de clientes» responden el `404.html` de Pages.
