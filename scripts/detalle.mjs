/* ============================================================
   detalle.mjs — lupa de las piezas que no se juzgan en la página entera
   ------------------------------------------------------------
   La captura completa dice el ritmo; no dice si cinco logos de pesos
   distintos pesan igual, si un trazo de 32 px se lee a 100 %, o si el
   foco del acordeón está donde debe. Eso se ve recortando el bloque a
   escala 2 sobre el propio DOM, no haciendo zoom sobre un PNG.

   Se le pasa el ancho que se quiere y cae a `.capturas/<ancho>-<bloque>.png`.

   CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ \
     node scripts/detalle.mjs 1440
   ============================================================ */
import { chromium } from "playwright-core";

const DESTINO = process.env.CAPTURAS_URL ?? "http://127.0.0.1:4176/";
const ANCHO = Number(process.argv[2] ?? 1440);
const SALIDA = new URL("../.capturas/", import.meta.url);

const BLOQUES = [
  ["aliados", ".lp-socios"],
  ["aliados-titulo", "#aliados .lp-contenido"],
  ["servicios", ".lp-servicios__rejilla"],
  ["pasos", ".lp-pasos--tres"],
  ["beneficios", ".lp-beneficios__rejilla"],
  ["faq", "#preguntas .lp-contenido"],
  ["cierre", "#hablemos .lp-contenido"],
  ["pie", ".lp-pie"],
  ["notas", ".lp-notas"],
];

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
});
const pagina = await navegador.newPage({
  viewport: { width: ANCHO, height: 900 },
  deviceScaleFactor: 2,
});
await pagina.setDefaultTimeout(300_000);
await pagina.goto(DESTINO, { waitUntil: "domcontentloaded", timeout: 300_000 });
await pagina.evaluate(() => document.fonts.ready);
await pagina.waitForTimeout(900);

/* La primera pregunta abierta: la bandeja cerrada no informa nada. */
const boton = pagina.locator(".lp-acordeon__boton").first();
if (await boton.count()) {
  await boton.click();
  await pagina.waitForTimeout(600);
}

/* La barra es `sticky`: al recortar un bloque del centro de la página,
   Chromium hace scroll y la barra cae encima del recorte (así salió el
   primer intento: la banda de aliados capturó la barra). Se fija a
   `static` solo en esta pasada de lupa; la captura completa se hace sin
   este retoque y sigue validando la barra pegajosa. */
await pagina.addStyleTag({ content: ".lp-nav { position: static !important; }" });
await pagina.waitForTimeout(200);

for (const [nombre, selector] of BLOQUES) {
  const blanco = pagina.locator(selector).first();
  if (!(await blanco.count())) {
    console.log(`${nombre}: sin nodo para «${selector}»`);
    continue;
  }
  const caja = await blanco.boundingBox();
  await blanco.screenshot({ path: new URL(`${ANCHO}-${nombre}.png`, SALIDA).pathname });
  console.log(
    `${nombre}: ${Math.round(caja.width)}×${Math.round(caja.height)} css px`,
  );
}

/* Y una medida que solo da el DOM: el alto renderizado de cada marca.
   Como el viewBox está recortado a la caja de tinta, el rectángulo del
   SVG ES la tinta: si los cinco altos caen en un margen estrecho, la
   banda pesa parejo de verdad y no por apariencia. */
const tintas = await pagina.evaluate(() => {
  return [...document.querySelectorAll(".lp-socio")].map((el) => {
    const svg = el.querySelector("svg");
    const caja = (svg ?? el).getBoundingClientRect();
    return {
      marca: el.getAttribute("aria-label"),
      alto: Math.round(caja.height * 10) / 10,
      ancho: Math.round(caja.width * 10) / 10,
    };
  });
});
console.log("\ntintas de la banda:", JSON.stringify(tintas));

await navegador.close();
