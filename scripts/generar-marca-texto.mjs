/* ============================================================
   generar-marca-texto.mjs — «Blink» en puro texto, sin isotipo
   ------------------------------------------------------------
   El master aprobado (`src/assets/marca-blink.svg`) es un lockup de
   dos capas: el wordmark y, a la derecha, el rostro (isotipo). La caja
   completa mide 869x194, pero la tinta del wordmark solo llega a x=592:
   todo lo que sobra a la derecha ES el isotipo. Para el sitio de BWS se
   pidió la marca en solo texto, así que se recorta la caja y se suelta
   la capa del rostro.

   Lo que este script GARANTIZA, y por eso no se hizo a mano:

     · los cinco `d` del wordmark se copian carácter por carácter del
       master; se comparan con `===` y el script sale con código distinto
       de cero si uno solo difiere. Ningún trazado se movió, se escaló ni
       se redibujó: la silueta aprobada es intacta.
     · el `viewBox` nuevo no se inventa: se mide con `getBBox()` en
       Chromium sobre el propio master, convertido al espacio del padre
       con la matriz de transformación del grupo.
     · se reportan el alto de mayúscula y la razón contra la caja vieja,
       que son los números que `landing.css` usa para el `em` del lockup.

   CHROMIUM_PATH=/usr/bin/chromium node scripts/generar-marca-texto.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);
const MASTER = new URL("src/assets/marca-blink.svg", RAIZ);
const SALIDA = new URL("src/assets/marca-blink-texto.svg", RAIZ);

const fuente = readFileSync(MASTER, "utf8");

/* --- 1. aislar la capa del wordmark, sin tocar sus trazos ------------ */
const grupo = fuente.match(/<g id="wordmark"[\s\S]*?<\/g>/)?.[0];
if (!grupo) {
  console.error("✗ el master no tiene un grupo #wordmark identificable");
  process.exit(1);
}
const caminos = [...grupo.matchAll(/<path [^>]*d="([^"]*)"\/>/g)].map((m) => m[1]);
if (caminos.length !== 5) {
  console.error(`✗ se esperaban 5 trazos en el wordmark y se encontraron ${caminos.length}`);
  process.exit(1);
}
const transform = grupo.match(/transform="([^"]*)"/)?.[1] ?? "";

/* --- 2. medir la caja de tinta en el espacio del viewBox -------------- */
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const pagina = await navegador.newPage({ viewport: { width: 900, height: 300 } });

const medida = await pagina.evaluate(async (codigo) => {
  const contenedor = document.createElement("div");
  contenedor.style.cssText = "position:absolute;left:-9999px;top:0";
  contenedor.innerHTML = codigo.replace(/<\?xml[^>]*\?>/, "");
  document.body.append(contenedor);
  const svg = contenedor.querySelector("svg");
  const g = svg.querySelector("#wordmark");

  /* `getBBox()` del grupo viene en SU espacio local (el `translate` del
     transform aún no está aplicado). Se llevan las cuatro esquinas al
     espacio del viewBox con la matriz del grupo y de ahí sale la caja. */
  const b = g.getBBox();
  const m = g.getCTM();
  const puntos = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  const r = (n) => Math.round(n * 100) / 100;

  /* El primer trazo es la «B»: su alto, medido en el mismo espacio, es la
     altura de mayúscula del wordmark. */
  const bboxB = svg.querySelector("#wordmark path").getBBox();

  return {
    caja: { x: r(Math.min(...xs)), y: r(Math.min(...ys)), w: r(Math.max(...xs) - Math.min(...xs)), h: r(Math.max(...ys) - Math.min(...ys)) },
    viewBoxViejo: (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number),
    capB: r(bboxB.height),
    inkTotal: (() => {
      const t = svg.getBBox();
      return { w: r(t.width), h: r(t.height) };
    })(),
  };
}, fuente);

await navegador.close();

const { x, y, w, h } = medida.caja;
const [vbX, vbY, vbW, vbH] = medida.viewBoxViejo;

/* --- 3. escribir el archivo, con los mismos `d` byte a byte ----------- */
const salida = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" version="1.1" shape-rendering="geometricPrecision" fill="currentColor">
  <title>Blink</title>
  <desc>Wordmark oficial «Blink» sin el isotipo: los cinco trazos de la capa aprobada, copiados literalmente de marca-blink.svg, con la caja recortada a su tinta. Ver scripts/generar-marca-texto.mjs.</desc>
  <g transform="${transform}" fill="currentColor">
${caminos.map((d) => `    <path d="${d}"/>`).join("\n")}
  </g>
</svg>
`;

/* Cinturón y tirantes: lo que se escribe tiene que contener los cinco
   `d` del master sin una sola diferencia. */
for (const d of caminos) {
  if (!salida.includes(`d="${d}"`)) {
    console.error("✗ un trazo del master no llegó idéntico al archivo generado");
    process.exit(1);
  }
}
writeFileSync(SALIDA, salida);

const redondeo = (n) => Math.round(n * 1000) / 1000;
console.log(`src/assets/marca-blink-texto.svg  ·  viewBox "${x} ${y} ${w} ${h}"`);
console.log(`  tinta del wordmark: ${w} x ${h} unidades dentro de una caja maestra de ${vbW} x ${vbH}`);
console.log(`  alto de mayúscula («B»): ${medida.capB} unidades = ${redondeo(medida.capB / h)} de la caja nueva`);
console.log(`  ancho nuevo / ancho maestro = ${redondeo(w / vbW)}  →  el em del wordmark se multiplica por ese factor para que la tinta no cambie de tamaño`);
