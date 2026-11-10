/* ============================================================
   medir-lockup.mjs — los números con los que se calibra MarcaBWS
   ------------------------------------------------------------
   Tres cosas que no se pueden inventar:

   1. Qué fracción de la caja de `marca-blink-texto.svg` es altura de
      mayúscula. Desde que la caja se recortó a la tinta del wordmark
      (592,12×193,14, sin las 277 unidades de aire del isotipo) el
      `height` del SVG casi ES la cap: la «B» mide 179 de 193,14. Se
      sigue midiendo en lugar de asumirlo, porque el número manda sobre
      el `em` del wordmark en `landing.css`.
   2. Cuánto mide realmente la mayúscula de la pila que se sirve para un
      `font-size` dado, y cuánto pesa «Web Services» / «BWS» en ancho. La
      pila resuelve SF Pro: primero la del sistema si está instalada,
      si no el fichero recortado del repo (`npm run sf-pro`), y solo por
      detrás Inter — el JSON dice cuál está cargando de verdad.
      Se saca con `measureText().actualBoundingBoxAscent`, que es el
      borde de tinta del glifo: el recuadro de un `<span>` daría la
      altura de la línea de la fuente, y con eso la razón saldría
      inflada ~1,2× — justo el error que hay que evitar aquí.
   3. Si el lockup completo cabe en el contenedor en los tres anchos.

   Con 1 y 2 se despeja el `font-size` del subword para que su mayúscula
   sea la fracción objetivo de la del wordmark.

   CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ \
     node scripts/medir-lockup.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const DESTINO = process.env.CAPTURAS_URL ?? "http://127.0.0.1:4176/";
const MARCA = new URL("../src/assets/marca-blink-texto.svg", import.meta.url);

/* Los tres números que fija landing.css: la razón del descriptor,
   cuántos em de mando mide el wordmark y cuántos em pide el subword.
   3,943 = 5,79 x (592,12/869) x
   (194/193,14): el recorte de la caja sin el isotipo, compensado para
   que la tinta renderizada no cambie de tamaño. */
const RATIO = 0.62;
const K_WORDMARK = 3.943;
const K_SUBWORD = 1.027;
const MANDO = { base: 19.2, pendiente: 0.03, min: 28, max: 55.4 };

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
await pagina.goto(DESTINO, { waitUntil: "domcontentloaded", timeout: 300_000 });
await pagina.evaluate(() => document.fonts.ready);

const datos = await pagina.evaluate(async (codigo) => {
  const r = (n) => Math.round(n * 1000) / 1000;

  /* --- 1. el wordmark vectorizado, en unidades de su propia caja --- */
  const contenedor = document.createElement("div");
  contenedor.style.cssText = "position:absolute;left:-9999px;top:0";
  contenedor.innerHTML = codigo.replace(/<\?xml[^>]*\?>/, "");
  document.body.append(contenedor);
  const svg = contenedor.querySelector("svg");
  if (!svg) throw new Error("no se encontró el SVG de la marca");
  const caja = svg.getBoundingClientRect();
  const viewBox = (svg.getAttribute("viewBox") || "0 0 1 1").split(/[\s,]+/).map(Number);
  const marca = {
    viewBox,
    altoCajaPx: r(caja.height),
    anchoCajaPx: r(caja.width),
    /* la primera ruta es la «B»: su alto es la mayúscula del wordmark */
    capUnidades: r(svg.querySelector("path").getBBox().height),
    inkAncho: r(svg.getBBox().width),
    inkAlto: r(svg.getBBox().height),
  };
  marca.capSobreCaja = r(marca.capUnidades / viewBox[3]);
  contenedor.remove();

  /* --- 2. la métrica tipográfica, medida sobre la pila real del sitio --- */
  const pila = getComputedStyle(document.body).fontFamily;
  const contexto = document.createElement("canvas").getContext("2d");
  contexto.font = `500 100px ${pila}`;
  const medir = (texto) => {
    const m = contexto.measureText(texto);
    return {
      capPorEm: r(m.actualBoundingBoxAscent / 100),
      ancho: r(m.width / 100),
    };
  };
  const subword = {
    pila,
    /* Qué cara está usando el navegador de verdad: `SF Pro` resuelve
       por `local()` en un dispositivo Apple y por el fichero del repo en
       cualquier otro; si Inter descargara, la pila habría fallado dos
       veces. */
    sfProCargada: document.fonts.check("500 100px SF Pro"),
    interCargada: document.fonts.check("500 100px Inter"),
    woff2Descargados: performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => n.includes(".woff2"))
      .map((n) => n.split("/").pop()),
    largo: medir("Web Services"),
    corto: medir("BWS"),
    /* «H» suelta, para separar la métrica del glifo del espaciado del par */
    h: medir("H"),
  };
  return { marca, subword };
}, readFileSync(MARCA, "utf8"));

console.log(JSON.stringify(datos, null, 2));

/* --- 3. el lockup completo en los tres anchos ---
   Se calcula con los `em` que están escritos en el CSS, no con los que
   la razón pediría: lo que importa es si LO QUE SE PUBLICA cabe y a qué
   razón queda realmente. */
const { viewBox, capSobreCaja } = datos.marca;
const capPorEm = datos.subword.largo.capPorEm;

for (const { nombre, ancho } of [
  { nombre: "movil-390", ancho: 390 },
  { nombre: "tablet-768", ancho: 768 },
  { nombre: "escritorio-1440", ancho: 1440 },
]) {
  const F = Math.min(MANDO.max, Math.max(MANDO.min, MANDO.base + ancho * MANDO.pendiente));
  const anchoWordmark = K_WORDMARK * F;
  const capWordmark = capSobreCaja * anchoWordmark * (viewBox[3] / viewBox[2]);
  const fontSubword = K_SUBWORD * F;
  const capSubword = capPorEm * fontSubword;
  const variante = ancho < 421 ? "corto" : "largo";
  const anchoSubword = fontSubword * datos.subword[variante].ancho;
  /* El `gap: 0.3em` se mide sobre el mando del contenedor, no sobre el
     tamaño del descriptor. */
  const total = anchoWordmark + 0.3 * F + anchoSubword;
  const disponible = Math.min(980, ancho - (ancho < 421 ? 32 : 40));
  console.log(
    `${nombre}: mando ${F.toFixed(1)}px · wordmark ${anchoWordmark.toFixed(0)}px ` +
      `(cap ${capWordmark.toFixed(1)}) · subword ${fontSubword.toFixed(1)}px ` +
      `(cap ${capSubword.toFixed(1)}, razón ${(capSubword / capWordmark).toFixed(3)}, ` +
      `${variante} ${anchoSubword.toFixed(0)}px) ` +
      `· lockup ${total.toFixed(0)}px de ${disponible}px ${total <= disponible ? "✓" : "✗"}`,
  );
}

/* El CSS deja el descriptor en `1,027em`. Esta línea dice qué razón
   resulta de ese factor con la métrica de la cara que se está sirviendo
   y cuánto valdría el mando para la razón 0,62 exacta: si el número no
   cuadra, la cara servida cambió (SF Pro por `local()`, el fichero del
   repo, o Inter) y hay que volver a calibrar el `em`. */
const F = MANDO.max;
const capW = capSobreCaja * K_WORDMARK * F * (viewBox[3] / viewBox[2]);
console.log(
  `\nrazón real con «font-size: ${K_SUBWORD}em» = ${((capPorEm * F * K_SUBWORD) / capW).toFixed(3)}  ` +
    `(para 0,62 el descriptor pediría ${((RATIO * capW) / capPorEm).toFixed(1)}px ` +
    `= ${(((RATIO * capW) / capPorEm) / F).toFixed(3)}em)`,
);

await navegador.close();
