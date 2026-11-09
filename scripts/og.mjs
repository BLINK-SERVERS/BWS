/* ============================================================
   og.mjs — publica public/og.png (1200×630)
   ------------------------------------------------------------
   La imagen que se ve cuando alguien pega el enlace en WhatsApp o en
   X no la diseña un ilustrador: la diseña el propio sitio. Se monta
   con los mismos ingredientes que la landing —el wordmark aprobado
   inline, la pila tipográfica con Inter servida desde `src/assets`,
   los mismos `--lp-*`— para que la tarjeta del enlace no se parezca a
   una página distinta.

   Se renderiza a escala 2 y se recorta a 1200×630 exactos: los
   1200×630 son los que piden las guías de Open Graph y WhatsApp, y un
   PNG más grande solo pesa.

   CHROMIUM_PATH=/usr/bin/chromium node scripts/og.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);
const MARCA = readFileSync(new URL("src/assets/marca-blink.svg", RAIZ), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/\sid="[^"]*"/g, "")
  .replace(/\s(?:xmlns:|inkscape:)[a-z-]+="[^"]*"/g, "");
const FUENTE = readFileSync(new URL("src/assets/fonts/inter-latin.woff2", RAIZ));
const urlFuente = `data:font/woff2;base64,${FUENTE.toString("base64")}`;

const ANCHO = 1200;
const ALTO = 630;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  @font-face {
    font-family: "Inter";
    src: url("${urlFuente}") format("woff2");
    font-weight: 100 900;
    font-style: normal;
    font-display: block;
  }
  :root {
    --tinta: #1d1d1f; --tinta-2: #6e6e6e; --azul: #007AFF; --azul-hondo: #0066cc;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden;
    background: radial-gradient(120% 140% at 50% -20%, #ffffff 0%, #f2f2f7 62%, #e8e8ef 100%);
    font-family: "SF Pro Display", "SF Pro Text", Inter, -apple-system, system-ui, sans-serif;
    color: var(--tinta);
    display: flex; flex-direction: column; justify-content: center;
    padding: 64px 88px;
  }
  .marca { display: flex; align-items: baseline; gap: 0.3em;
           font-size: 46px; color: var(--azul); margin-bottom: 40px; }
  .marca svg { width: 5.79em; height: auto; display: block; flex: none; }
  .marca span { font-size: 1em; font-weight: 500; line-height: 1.1;
                letter-spacing: -0.01em; color: var(--tinta-2); white-space: nowrap; }
  h1 { margin: 0; font-size: 76px; font-weight: 700; line-height: 1.04;
       letter-spacing: -0.03em; text-wrap: balance; max-width: 20ch; }
  .pie { margin-top: 34px; display: flex; align-items: center; gap: 14px;
         font-size: 25px; font-weight: 600; color: var(--azul-hondo); }
  .punto { width: 9px; height: 9px; border-radius: 50%; background: var(--azul-hondo); }
  .dominio { color: var(--tinta-2); font-weight: 500; }
</style></head>
<body>
  <p class="marca">${MARCA}<span>Web Services</span></p>
  <h1>Solo traes dos planes: una idea y el dinero.</h1>
  <p class="pie"><span class="punto"></span>bws.blink.com.ve
     <span class="dominio">· Páginas, web apps y portafolios</span></p>
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
