/* ============================================================
   capturas.mjs — la verificación visual del sitio
   ------------------------------------------------------------
   Los MCP de navegador no arrancan en esta máquina, así que el único
   camino que queda es manejar Chromium desde Node con playwright-core
   y el binario del sistema (`/usr/bin/chromium`).

   Tres anchos, a `.capturas/`:
     390x844   iPhone de una mano — donde se rompen los titulares
     768x1024  tablet / móvil grande
     1440x900  escritorio, el ancho de referencia

   Y DOS escalas, porque una sola no sirve:
     · escala 1 para la PÁGINA COMPLETA. Con escala 2 el lienzo de
       escritorio pasa de 2880x14000 px y Chromium revienta el timeout
       por defecto de 30 s (comprobado el 2026-11-09: la captura de
       768 px tardó más de 30 s y abortó el script).
     · escala 2 para el RECORTE del hero y de la barra, que es donde de
       verdad hay que mirar si «Web Services» cabalga la línea base del
       wordmark o sale flotando.

   Se espera `document.fonts.ready`: sin eso la primera captura sale con
   la métrica de respaldo y el lockup se ve desplazado, que es justo el
   detalle que hay que comprobar.

   CHROMIUM_PATH=/usr/bin/chromium CAPTURAS_URL=http://127.0.0.1:4176/ \
     node scripts/capturas.mjs
   ============================================================ */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const DESTINO = process.env.CAPTURAS_URL ?? "http://localhost:4176/";
const SALIDA = new URL("../.capturas/", import.meta.url);

const ANCHOS = [
  { nombre: "movil-390", ancho: 390, alto: 844 },
  { nombre: "tablet-768", ancho: 768, alto: 1024 },
  { nombre: "escritorio-1440", ancho: 1440, alto: 900 },
];

const ESPERA = 300_000;

await mkdir(SALIDA, { recursive: true });

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
});

/** Ruta de salida: `.capturas/movil-390-hero.png`. */
const archivo = (nombre, sufijo) => new URL(`${nombre}-${sufijo}.png`, SALIDA).pathname;

/** Abre la página, espera tipografías y deja el hero listo para medir. */
async function abrir(ancho, alto, escala) {
  const pagina = await navegador.newPage({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: escala,
  });
  pagina.setDefaultTimeout(ESPERA);
  await pagina.goto(DESTINO, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await pagina.evaluate(() => document.fonts.ready).catch(() => undefined);
  await pagina.waitForTimeout(700);
  return pagina;
}

const aviso = (nombre, sufijo) => (e) =>
  console.log(`  ! ${nombre}/${sufijo}: ${String(e.message).split("\n")[0]}`);

for (const { nombre, ancho, alto } of ANCHOS) {
  /* --- escala 2: los dos recortes que se juzgan a ojo --- */
  const lupa = await abrir(ancho, alto, 2);
  await lupa
    .locator(".lp-hero .lp-contenido")
    .screenshot({ path: archivo(nombre, "hero") })
    .catch(aviso(nombre, "hero"));
  await lupa.locator(".lp-nav").screenshot({ path: archivo(nombre, "barra") }).catch(() => {});
  await lupa.close();

  /* --- escala 1: la página entera, el FAQ y el barrido de desbordes --- */
  const pagina = await abrir(ancho, alto, 1);

  await pagina
    .screenshot({ path: archivo(nombre, "completa"), fullPage: true })
    .catch(aviso(nombre, "completa"));

  // El FAQ cerrado no dice nada: se abre la primera pregunta y se capta
  // el bloque entero para ver la bandeja desplegada.
  const boton = pagina.locator(".lp-acordeon__boton").first();
  if (await boton.count()) {
    await boton.click();
    await pagina.waitForTimeout(500);
    await pagina
      .locator("#preguntas")
      .screenshot({ path: archivo(nombre, "faq") })
      .catch(aviso(nombre, "faq"));
  }

  // Desbordes horizontales: la única prueba mecánica de que nada se sale
  // del ancho. Se mide con el acordeón abierto, el estado más alto.
  const desborde = await pagina.evaluate(() => {
    const tope = document.documentElement.clientWidth;
    const culpables = [];
    for (const el of document.querySelectorAll("body *")) {
      const caja = el.getBoundingClientRect();
      if (caja.width > 0 && caja.right > tope + 1) {
        const clases = (el.getAttribute("class") || el.tagName.toLowerCase()).split(" ")[0];
        culpables.push(`${el.tagName.toLowerCase()}.${clases} ${Math.round(caja.right)}px`);
      }
    }
    return {
      documento: document.documentElement.scrollWidth,
      ventana: tope,
      culpables: [...new Set(culpables)].slice(0, 6),
    };
  });
  console.log(nombre, JSON.stringify(desborde));

  await pagina.close();
}

await navegador.close();
console.log(`\nCapturas en ${SALIDA.pathname}`);
