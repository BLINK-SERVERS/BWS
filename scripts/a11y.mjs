/* ============================================================
   a11y.mjs — auditoría real, no estimación
   ------------------------------------------------------------
   El plan pedía «Lighthouse accesibilidad ≥95». Lighthouse no corre en
   esta máquina sin red garantizada para su dependencias, y su pila de
   accesibilidad es axe-core por debajo: se inyecta axe directamente, que
   es la misma batería de reglas WCAG 2.1 AA sobre el DOM real del sitio.

   A eso se le suma lo que axe no puede ver:
     · el barrido de teclado, elemento por elemento, comprobando que
       cada foco tiene un indicador dibujado (`outline` distinto de 0),
       porque el `:focus-visible` de base.css es la única señal que tiene
       quien navega sin ratón;
     · el orden de encabezados, que en una landing con H1 oculto se rompe
       con una facilidad que no se ve en pantalla;
     · que ningún enlace de contacto salga sin nombre accesible.

   CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ \
     node scripts/a11y.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const DESTINO = process.env.CAPTURAS_URL ?? "http://127.0.0.1:4176/";
const AXE = fileURLToPath(new URL("../node_modules/axe-core/axe.min.js", import.meta.url));

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

let totalViolaciones = 0;

for (const ancho of [1440, 390]) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
  await pagina.setDefaultTimeout(300_000);
  await pagina.goto(DESTINO, { waitUntil: "domcontentloaded", timeout: 300_000 });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(500);
  await pagina.addScriptTag({ path: AXE });

  const axe = await pagina.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      resultType: "violations",
    });
    return r.violations.map((v) => ({
      id: v.id,
      impacto: v.impact,
      n: v.nodes.length,
      donde: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      /* El resumen de fallo y el HTML exacto: sin esto se diagnostica
         adivinando, y «label-content-name-mismatch» tiene tres motivos
         distintos que se reportan igual de lejos. */
      porque: v.nodes.slice(0, 2).map((n) => `${n.failureSummary} :: ${n.html.slice(0, 190)}`),
    }));
  });

  const teclado = await pagina.evaluate(async () => {
    const salidas = [];
    const vistos = new Set();
    /* El foco se mueve de verdad: `focus()` en el elemento siguiente de
       la secuencia del documento, que es lo que hace Tab sin tener que
       pulsar teclas desde Node. */
    const encadenable = [...document.querySelectorAll(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.offsetParent !== null || el.getClientRects().length);

    for (const el of encadenable) {
      el.focus();
      const cs = getComputedStyle(el);
      const contorno = cs.outlineWidth === "0px" ? null : `${cs.outlineWidth} ${cs.outlineColor}`;
      const nombre = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 42);
      const clave = `${el.tagName}|${nombre}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salidas.push({
        etiqueta: `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}`,
        nombre,
        contorno,
        alto: Math.round(el.getBoundingClientRect().height),
      });
    }
    return { total: encadenable.length, salidas };
  });

  const estructura = await pagina.evaluate(async () => ({
    encabezados: [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => ({
      nivel: Number(h.tagName[1]),
      texto: h.textContent.trim().slice(0, 46),
      oculto: h.classList.contains("visualmente-oculto") ||
        !!h.querySelector(":scope > .visualmente-oculto"),
    })),
    regiones: [...document.querySelectorAll("main,header,footer,nav,aside")].map(
      (e) => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : ""),
    ),
    enlacesContacto: [...document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')]
      .map((a) => ({ href: a.getAttribute("href").slice(0, 40), nombre: a.textContent.trim() })),
    /* El nombre que el lockup expone, calculado como lo calcula el
       navegador: el `<title>` del SVG aprobado + el subword que está a
       la vista (el otro está en `display: none` y se cae del árbol).
       `axe.utils.getAccessibleName` no viene en el bundle mínimo, así
       que la aproximación se lee aquí y la norma la comprueba la propia
       regla `label-content-name-mismatch` de arriba: si pasa, el nombre
       contiene lo visible. */
    nombres: (() => {
      const nombreDe = (el) => {
        if (!el) return null;
        const titulo = el.querySelector("svg > title")?.textContent?.trim() ?? "";
        const sub = [...el.querySelectorAll(".lp-marca-bws__sub")]
          .filter((s) => s.offsetParent !== null)
          .map((s) => s.textContent.trim());
        return [titulo, ...sub].filter(Boolean).join(" ");
      };
      return {
        barra: nombreDe(document.querySelector(".lp-nav__marca")),
        hero: nombreDe(document.querySelector(".lp-hero__marca")),
        visibleBarra: document
          .querySelector(".lp-nav__marca")
          .innerText.replace(/\s+/g, " ")
          .trim(),
      };
    })(),
  }));

  totalViolaciones += axe.length;
  console.log(`\n########## ${ancho}px ##########`);
  console.log(`axe: ${axe.length} violaciones`);
  axe.forEach((v) => {
    console.log(`  · ${v.id} (${v.impacto}) ×${v.n} → ${v.donde.join(" | ")}`);
    v.porque.forEach((p) => console.log(`      ${p}`));
  });

  console.log(`\nfoco: ${teclado.total} elementos encadenables, ${teclado.salidas.length} nombres únicos`);
  const sinContorno = teclado.salidas.filter((s) => !s.contorno);
  console.log(`  sin indicador dibujado: ${sinContorno.length}`);
  sinContorno.forEach((s) => console.log(`    ! ${s.etiqueta} «${s.nombre}»`));
  const pequenos = teclado.salidas.filter((s) => s.alto > 0 && s.alto < 44);
  console.log(`  blancos de toque bajo 44 px: ${pequenos.length}`);
  pequenos.forEach((s) => console.log(`    · ${s.etiqueta} «${s.nombre}» → ${s.alto}px`));
  console.log(`  muestra: ${JSON.stringify(teclado.salidas[0])}`);

  console.log("\nencabezados:", JSON.stringify(estructura.encabezados, null, 1));
  console.log("regiones:", estructura.regiones.join(", "));
  console.log("contacto:", JSON.stringify(estructura.enlacesContacto));
  console.log(
    `lockup · barra «${estructura.nombres.barra}» · visible «${estructura.nombres.visibleBarra}» · ` +
      `hero «${estructura.nombres.hero}»`,
  );

  await pagina.close();
}

await navegador.close();
console.log(`\n=== total de violaciones axe en ambos anchos: ${totalViolaciones} ===`);
