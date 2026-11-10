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
  ["aliados", ".lp-cinta"],
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

/* Dos medidas que solo da el DOM, y las dos mandan en la cinta.

   1. EL ANCHO DEL JUEGO y su velocidad. El bucle desplaza -25% de la
      pista, o sea un juego, así que `anchoJuego / duración` son los px
      por segundo que ve el usuario. Si las dos filas no van pareadas
      en velocidad aparente, la cinta lee como un error; si un juego
      quedara más corto que la ventana menos un juego, se vería el hueco
      en la junta. Estos dos números son los que calibran las
      `animation-duration` de `landing.css`.
   2. LA COSTURA: la pista tiene que medir EXACTAMENTE `replicas` juegos.
      Si no, el -25% no aterriza en el mismo píxel y el bucle baila.

   Y la tercera, la de siempre: el alto de tinta de cada lockup. Con el
   PNG ya recortado a la tinta, el rectángulo del <img> ES la marca, así
   que los escalones se comprueban literalmente. */
const medidas = await pagina.evaluate(() => {
  const px = (v) => Math.round(v * 10) / 10;

  const pistas = [...document.querySelectorAll(".lp-cinta__pista")].map((pista) => {
    const juegos = [...pista.querySelectorAll(":scope > .lp-cinta__fila")];
    const anchoJuego = juegos[0].getBoundingClientRect().width;
    const duracion = parseFloat(getComputedStyle(pista).animationDuration);
    return {
      escalon: pista.dataset.escalon,
      replicas: juegos.length,
      anchoJuego: px(anchoJuego),
      anchoPista: px(pista.getBoundingClientRect().width),
      costura: px(pista.getBoundingClientRect().width - anchoJuego * juegos.length),
      sentido: getComputedStyle(pista).animationDirection,
      duracion,
      pxPorSegundo: px(anchoJuego / duracion),
    };
  });

  const logos = [...document.querySelectorAll('.lp-cinta__fila:not([aria-hidden="true"]) li')]
    .map((li) => {
      const el = li.querySelector("img, .lp-cinta__compuesta");
      const caja = el.getBoundingClientRect();
      return {
        marca: el.alt ?? el.textContent?.trim() ?? "?",
        alto: px(caja.height),
        ancho: px(caja.width),
        escalon: getComputedStyle(el.closest(".lp-cinta__pista")).getPropertyValue("--glifo").trim(),
      };
    });

  const ink = document.querySelector(".lp-nav__marca svg")?.getBoundingClientRect();
  const caja = document.querySelector(".lp-nav__marca")?.getBoundingClientRect();
  /* En móvil los enlaces están en `display: none`: su rectángulo es todo
     ceros y restarlo daría un desvío absurdo (-7578 px). Se mide solo lo
     que hay, y lo que no hay se reporta como null. */
  const visible = (r) => (r && r.width > 0 ? r : null);
  const enlace = visible(document.querySelector(".lp-nav__enlaces a")?.getBoundingClientRect());
  const cta = visible(document.querySelector(".lp-nav__cta")?.getBoundingClientRect());
  const fila = document.querySelector(".lp-nav__fila")?.getBoundingClientRect();

  return {
    cinta: { pistas, logos },
    barra: ink
      ? {
          altoCaja: px(caja.height),
          altoInk: px(ink.height),
          centroInk: px((ink.top + ink.bottom) / 2),
          centroEnlaces: enlace ? px((enlace.top + enlace.bottom) / 2) : null,
          centroBoton: cta ? px((cta.top + cta.bottom) / 2) : null,
          centroFila: px((fila.top + fila.bottom) / 2),
          desvioConEnlaces: enlace
            ? px((ink.top + ink.bottom) / 2 - (enlace.top + enlace.bottom) / 2)
            : null,
          desvioConBoton: cta ? px((ink.top + ink.bottom) / 2 - (cta.top + cta.bottom) / 2) : null,
        }
      : null,
  };
});
console.log("\ncinta:", JSON.stringify(medidas.cinta.pistas, null, 1));
console.log("tintas de la cinta:", JSON.stringify(medidas.cinta.logos));
console.log("centrado de la barra:", JSON.stringify(medidas.barra));

await navegador.close();
