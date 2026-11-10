/* ============================================================
   detalle.mjs — lupa de las piezas que no se juzgan en la página entera
   ------------------------------------------------------------
   La captura completa dice el ritmo; no dice si nueve logos de pesos
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

/* Y dos medidas que solo da el DOM.

   1. El alto de TINTA de cada marca. Como el viewBox está recortado a la
      caja medida, el rectángulo del SVG ES la tinta: si los dos escalones
      caen parejos dentro de su fila, la banda pesa lo que debe pesar y
      no por apariencia.
   2. El centrado de la barra. «Muy arriba» no es un criterio: se mide el
      centro vertical del ink del wordmark contra el centro del renglón
      y contra el centro de los enlaces y del botón. Con `align-items:
      baseline` en un ancla de 44 px el desvío era de varios píxeles. */
const medidas = await pagina.evaluate(() => {
  const centro = (r) => Math.round((r.top + r.bottom) * 10) / 10;
  const nombre = (el) => el.querySelector(".lp-socio__nombre")?.textContent ?? "?";

  const banda = [...document.querySelectorAll(".lp-socio")].map((el) => {
    const svg = el.querySelector("svg");
    const caja = (svg ?? el).getBoundingClientRect();
    return {
      marca: nombre(el),
      alto: Math.round(caja.height * 10) / 10,
      ancho: Math.round(caja.width * 10) / 10,
      escalon: getComputedStyle(el.parentElement).getPropertyValue("--glifo").trim(),
    };
  });

  const ink = document.querySelector(".lp-nav__marca svg")?.getBoundingClientRect();
  const caja = document.querySelector(".lp-nav__marca")?.getBoundingClientRect();
  /* En móvil los enlaces están en `display: none`: su rectángulo es todo
     ceros y restarlo daría un desvío absurdo (-7578 px). Se mide solo lo
     que hay, y lo que no hay se reporta como null. */
  const visible = (r) => (r && r.width > 0 ? r : null);
  const enlace = visible(document.querySelector(".lp-nav__enlaces a")?.getBoundingClientRect());
  const boton = visible(document.querySelector(".lp-nav__cta")?.getBoundingClientRect());
  const fila = document.querySelector(".lp-nav__fila")?.getBoundingClientRect();

  return {
    banda,
    barra: ink
      ? {
          altoCaja: Math.round(caja.height * 10) / 10,
          altoInk: Math.round(ink.height * 10) / 10,
          centroInk: centro(ink),
          centroEnlaces: enlace ? centro(enlace) : null,
          centroBoton: boton ? centro(boton) : null,
          centroFila: centro(fila),
          desvioConEnlaces: enlace ? Math.round((centro(ink) - centro(enlace)) * 10) / 10 : null,
          desvioConBoton: boton ? Math.round((centro(ink) - centro(boton)) * 10) / 10 : null,
        }
      : null,
  };
});
console.log("\ntintas de la banda:", JSON.stringify(medidas.banda, null, 1));
console.log("centrado de la barra:", JSON.stringify(medidas.barra));

await navegador.close();
