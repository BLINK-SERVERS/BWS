/* ============================================================
   medir-socios.mjs
   ------------------------------------------------------------
   Mide la caja de TINTA real (getBBox) de cada path vendorizado, en
   unidades del viewBox "0 0 24 24" de simpleicons.

   Lee `src/lib/socios.ts` en vez de copiar los `d` aqui: asi lo que se
   mide es EXACTAMENTE lo que se publica. Si manana se actualiza un logo
   y varia la caja, este script lo detecta solo.

   Para que sirve la medida: si los cinco logos compartieran la caja
   cuadrada de 24x24, Cloudflare — que es una tira ancha y baja — se
   veria la mitad de grande que Supabase. Recortando el viewBox a la
   caja de tinta y dibujando todos a la misma ALTURA, la fila pesa igual.

   Salida: el objeto `caja` listo para pegar en socios.ts.

     CHROMIUM_PATH=/usr/bin/chromium node scripts/medir-socios.mjs
   ============================================================ */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const FUENTE = new URL("../src/lib/socios.ts", import.meta.url);

/* Recorta el texto de cada entrada del array SOCIOS a partir de las
   posiciones de `nombre:` y saca de ahí la `ruta`. Los `d` de simpleicons
   no llevan comillas ni escapes, así que un recorte sobre el texto basta
   y no hace falta levantar un parser de TypeScript. */
function leerSocios(codigo) {
  const aperturas = [...codigo.matchAll(/nombre:\s*"/g)].map((m) => m.index);
  const socios = [];
  aperturas.forEach((inicio, i) => {
    const trozo = codigo.slice(inicio, aperturas[i + 1] ?? codigo.length);
    const nombre = /^nombre:\s*"([^"]+)"/.exec(trozo)?.[1];
    const ruta = /ruta:\s*"([^"]*)"/.exec(trozo)?.[1];
    // nic.ve se declara con ruta vacia: se compone con tipografia.
    if (nombre && ruta && ruta.length > 40) socios.push({ nombre, ruta });
  });
  return socios;
}

const socios = leerSocios(await readFile(FUENTE, "utf8"));
if (socios.length === 0) {
  console.error("No se encontro ninguna ruta en socios.ts — revisar el parseo.");
  process.exit(1);
}

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const pagina = await navegador.newPage();
await pagina.setContent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="p"/></svg>`,
);

const dos = (n) => Math.round(n * 100) / 100;

for (const { nombre, ruta } of socios) {
  const caja = await pagina.evaluate((d) => {
    const p = document.getElementById("p");
    p.setAttribute("d", d);
    const b = p.getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, ruta);
  console.log(
    `${nombre.padEnd(12)} caja: { x: ${dos(caja.x)}, y: ${dos(caja.y)}, w: ${dos(caja.w)}, h: ${dos(caja.h)} }` +
      `   // relacion ${(caja.w / caja.h).toFixed(3)}`,
  );
}

await navegador.close();
