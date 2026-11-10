/* ============================================================
   og.mjs — publica public/og.png (1200×630)
   ------------------------------------------------------------
   La imagen que se ve cuando alguien pega el enlace en WhatsApp o en
   X no la diseña un ilustrador: la diseña el propio sitio. Se monta
   con los mismos ingredientes que la landing —el wordmark aprobado
   inline, la pila tipográfica con SF Pro recortado desde `src/assets`,
   los mismos `--lp-*`— para que la tarjeta del enlace no se parezca a
   una página distinta.

   Por qué es negra y vacía. La primera versión era la página clonada:
   fondo con el velo azul del hero, el lockup en azul de acento, el
   titular, un punto de color y una lista de servicios. Diez días
   después sigue siendo cierto que eso "es el sitio", pero una tarjeta
   de enlace no es una página: se ve a 280 px de ancho dentro de una
   burbuja de chat, y ahí lo que se lee es UNA frase. La referencia de
   Apple (apple.com/iphone, apple.com/apple-pay) resuelve lo mismo hace
   años de la misma manera: papel negro plano, producto nombrado en
   grande, cero ornamentos. Así que la tarjeta se quedó con tres cosas
   —la marca, la frase y el dominio— y todo lo demás salió: el degradado
   (en negro plano no hay de qué salir), el punto azul, el subtítulo de
   servicios y el azul del wordmark, que sobre negro pide blanco y
   discutir con él es peor. Los tokens de tinta son los de la tema
   oscuro de `landing.css` (#f5f5f7 / #a1a1aa / #6e6e73 sobre #000), así
   que no hay una paleta nueva en la tarjeta: hay la misma de siempre
   sobre el otro papel.

   Se renderiza a escala 2 y se recorta a 1200×630 exactos: los
   1200×630 son los que piden las guías de Open Graph y WhatsApp, y un
   PNG más grande solo pesa.

   CHROMIUM_PATH=/usr/bin/chromium node scripts/og.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);
const MARCA = readFileSync(new URL("src/assets/marca-blink-texto.svg", RAIZ), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/\sid="[^"]*"/g, "")
  .replace(/\s(?:xmlns:|inkscape:)[a-z-]+="[^"]*"/g, "");
const FUENTE = readFileSync(new URL("src/assets/fonts/sf-pro-latin.woff2", RAIZ));
const RESPALDO = readFileSync(new URL("src/assets/fonts/inter-latin.woff2", RAIZ));
const urlFuente = `data:font/woff2;base64,${FUENTE.toString("base64")}`;
const urlRespaldo = `data:font/woff2;base64,${RESPALDO.toString("base64")}`;

const ANCHO = 1200;
const ALTO = 630;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  /* La MISMA cara que se sirve en la landing: el recorte variable de
     SF Pro del repo, embebido como data URL para que la tarjeta no
     dependa de que en esta máquina haya SF Pro instalada. Inter va
     detrás, como en fonts.css, solo por si un glifo se salió del
     recorte. */
  @font-face {
    font-family: "SF Pro";
    src: url("${urlFuente}") format("woff2");
    font-weight: 400 700;
    font-style: normal;
    font-display: block;
  }
  @font-face {
    font-family: "Inter";
    src: url("${urlRespaldo}") format("woff2");
    font-weight: 100 900;
    font-style: normal;
    font-display: block;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden;
    background: #000000;
    font-family: "SF Pro", Inter, -apple-system, system-ui, sans-serif;
    font-optical-sizing: auto;
    color: #f5f5f7;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 0 96px 64px;
  }
  /* El mismo mando único del hero: wordmark en 3,943em —la caja de tinta
     sin el isotipo— y descriptor a 1,027em, que es lo que da razón 0,62
     con la mayúscula de SF Pro. Con el mando en 40 px el lockup mide
     ~206 px y queda claro que es la firma, no el asunto. */
  .marca { display: flex; align-items: baseline; gap: 0.3em;
           font-size: 40px; color: #f5f5f7; margin-bottom: 52px; }
  .marca svg { width: 3.943em; height: auto; display: block; flex: none; }
  .marca span { font-size: 1.027em; font-weight: 500; line-height: 1.1;
                letter-spacing: -0.01em; color: #86868b; white-space: nowrap; }
  h1 { margin: 0; font-size: 80px; font-weight: 700; line-height: 1.05;
       letter-spacing: -0.032em; text-wrap: balance; max-width: 22ch;
       color: #f5f5f7; }
  .sub { margin: 26px 0 0; font-size: 34px; font-weight: 500;
         letter-spacing: -0.015em; line-height: 1.25; color: #a1a1aa; }
  .dominio { position: absolute; bottom: 46px; left: 0; right: 0;
             font-size: 22px; font-weight: 500; letter-spacing: 0.01em;
             color: #6e6e73; }
</style></head>
<body>
  <p class="marca">${MARCA}<span>Web Services</span></p>
  <h1>Solo traes dos cosas: una idea y el dinero.</h1>
  <p class="sub">Nosotros nos encargamos del resto.</p>
  <p class="dominio">bws.blink.com.ve</p>
</body></html>`;

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
});
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 2,
});
await pagina.setDefaultTimeout(300_000);
await pagina.setContent(html, { waitUntil: "load", timeout: 300_000 });
await pagina.evaluate(() => document.fonts.ready);
await pagina.waitForTimeout(600);

const png2x = await pagina.screenshot({ clip: { x: 0, y: 0, width: ANCHO, height: ALTO } });

/* El meta declara 1200×630 y WhatsApp recorta lo que sobre, así que el
   archivo tiene que medir EXACTAMENTE eso. Se renderiza al doble y se
   baja con el propio Chromium (`imageSmoothingQuality: high`): el
   resultado es más nítido en los trazos del wordmark que renderizando a
   1× directo, y pesa la mitad que dejar el PNG de 2400 px. */
const reductor = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO } });
await reductor.setContent(
  `<!doctype html><meta charset="utf-8"><body style="margin:0">
   <canvas id="c" width="${ANCHO}" height="${ALTO}"></canvas>`,
);
const png = Buffer.from(
  await reductor.evaluate(async ({ datos, ancho, alto }) => {
    const img = new Image();
    img.src = datos;
    await img.decode();
    const lienzo = document.querySelector("canvas");
    const ctx = lienzo.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, ancho, alto);
    return lienzo.toDataURL("image/png").split(",")[1];
  }, {
    datos: `data:image/png;base64,${png2x.toString("base64")}`,
    ancho: ANCHO,
    alto: ALTO,
  }),
  "base64",
);

writeFileSync(new URL("public/og.png", RAIZ), png);
await navegador.close();
console.log(
  `public/og.png · ${ANCHO}×${ALTO} px exactos (render a 2× y bajada) · ${(png.length / 1024).toFixed(0)} KB`,
);
