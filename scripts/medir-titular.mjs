/* ============================================================
   medir-titular.mjs — en cuántas líneas cae el titular del hero
   ------------------------------------------------------------
   El titular es la frase ancla y su corte importa: «Solo traes dos
   cosas: / una idea y el dinero.» es el corte que se quiere, y para
   eso la primera línea tiene que caber entera. `text-wrap: balance`
   reparte las líneas a ojo de la máquina y en móvil terminaba partiendo
   «cosas: una» en medio, así que el tamaño mínimo del `clamp()` se
   decide midiendo cuántas líneas produce, no por gusto.

   Se prueba el titular real sobre el `--lp-fs-hero` publicado y sobre
   dos candidatos más, en los tres anchos.

   CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ \
     node scripts/medir-titular.mjs
   ============================================================ */
import { chromium } from "playwright-core";

const DESTINO = process.env.CAPTURAS_URL ?? "http://127.0.0.1:4176/";
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const CANDIDATOS = ["var(--lp-fs-hero)", "2.375rem", "2.25rem", "2rem", "1.875rem"];

for (const ancho of [390, 430, 768, 1024, 1440]) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
  await pagina.goto(DESTINO, { waitUntil: "domcontentloaded", timeout: 300_000 });
  await pagina.evaluate(() => document.fonts.ready);

  const informe = await pagina.evaluate((candidatos) => {
    const h1 = document.querySelector(".lp-hero__titular");
    /* Solo el nodo de texto de la frase: el `<span class="visualmente-oculto">`
       del principio está fuera de flujo y sus rectángulos no cuentan. */
    const nodo = [...h1.childNodes].find(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 10,
    );
    const original = h1.getAttribute("style");
    const lineas = [];
    for (const tam of candidatos) {
      h1.style.fontSize = tam;
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      const cajas = [...rango.getClientRects()].filter((c) => c.width > 1);
      lineas.push({
        tam,
        px: Math.round(parseFloat(getComputedStyle(h1).fontSize) * 10) / 10,
        n: cajas.length,
        cortes: cajas.map((c) => Math.round(c.width)),
      });
    }
    if (original === null) h1.removeAttribute("style");
    else h1.setAttribute("style", original);
    return {
      texto: h1.textContent.trim().slice(0, 60),
      disponible: Math.round(document.querySelector(".lp-contenido").getBoundingClientRect().width),
      lineas,
    };
  }, CANDIDATOS);

  console.log(`\n${ancho}px  (contenedor ${informe.disponible}px)`);
  for (const l of informe.lineas) {
    console.log(
      `  ${l.tam.padEnd(17)} → ${l.px}px · ${l.n} líneas · anchos [${l.cortes.join(", ")}]`,
    );
  }
  await pagina.close();
}

await navegador.close();
