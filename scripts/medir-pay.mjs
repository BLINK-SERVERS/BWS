/* ============================================================
   medir-pay.mjs — cuánto pesa «Pay» junto a «Blink» en el lockup maestro
   ------------------------------------------------------------
   La proporción entre el wordmark y el subword de BWS no se puede
   inventar: hay que sacarla del lockup aprobado. `blink-pay.svg` trae
   «Blink» y «Pay» como trazos en el mismo sistema de coordenadas, así
   que basta con medir el bbox de cada trazo y separarlos por la X.

   CHROMIUM_PATH=/usr/bin/chromium node scripts/medir-pay.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const ORIGEN =
  "/home/prodz/Documents/Qoder/2026-10-31/88381b6f/Pay/marca/blink-pay.svg";
const codigo = readFileSync(ORIGEN, "utf8");

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const pagina = await navegador.newPage();
await pagina.setContent(
  `<body style="margin:0;width:1200px">${codigo.replace(/^<\?xml[^>]*\?>/, "")}</body>`,
);

const trazos = await pagina.evaluate(() => {
  const capa = document.querySelector("#wordmark");
  return [...capa.querySelectorAll("path")].map((p) => {
    const c = p.getBBox();
    return {
      x: Math.round(c.x * 100) / 100,
      tope: Math.round(c.y * 100) / 100,
      fin: Math.round((c.x + c.width) * 100) / 100,
      alto: Math.round(c.height * 100) / 100,
    };
  });
});

await navegador.close();

/* El wordmark es itálico heavy: la «k» eleva el ascendente y separa las
   dos palabras por un salto de X visible, no por un espacio. */
console.log("trazos:", trazos.length);
trazos.forEach((t, i) => console.log(String(i).padStart(2), JSON.stringify(t)));

const blinea = Math.max(...trazos.map((t) => t.tope + t.alto));
console.log("línea base aproximada:", Math.round(blinea * 100) / 100);
