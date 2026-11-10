/* ============================================================
   preparar-sf-pro.mjs
   ------------------------------------------------------------
   Fabrica `src/assets/fonts/sf-pro-latin.woff2`, la única cara de
   SF Pro que se sirve en BWS.

   Parte del `SF-Pro.ttf` VARIABLE que Apple distribuye para
   desarrolladores (el mismo enlace de la HIG que ya usan Pay y POS
   para pedir la fuente por `local()`). De ahí salen tres decisiones
   que hacen que un solo fichero valga para toda la página:

   · Eje `wght` recortado a 400–700: son los pesos que usa BWS
     (400 heredado, 500, 600, 650 y 700). El navegador interpola, así
     que 650 es un Semibold real y no un Bold falso.
   · Eje `opsz` conservado en 17–28: es el tamaño óptico. Con
     `font-optical-sizing: auto` —el valor por dentro del navegador—
     el titular de 76 px sale con la geometría Display y el cuerpo de
     16 px con la Text, sin declarar dos familias.
   · Eje `wdth` fijado en 100: BWS no usa condensados ni anchos, y
     ese eje es el que más pesa (el fichero pasa de ~250 KB a ~56 KB).

   El juego de caracteres es EXACTAMENTE el de Inter, para que la red
   de seguridad cubra lo mismo: si un glifo está en Inter, está en SF
   Pro. Las tablas de maquetación asiática (`MERG`, `meta`, `trak`) se
   descartan: en español no intervienen.

   Uso:

     SF_PRO_TTF=/ruta/SF-Pro.ttf FONTTOOLS_DIR=/tmp/venv-fonts/bin \
       npm run sf-pro

   `FONTTOOLS_DIR` es el directorio donde están `pyftsubset` y
   `fonttools` (fontTools + brotli). En esta máquina se montan con:

     python3 -m venv /tmp/venv-fonts
     /tmp/venv-fonts/bin/pip install fonttools brotli

   El binario de Apple NO vive en el repo: lo que se versiona es el
   recorte, que es lo que se sirve.
   ============================================================ */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* El mismo listado que declara `unicode-range` en fonts.css. */
const UNICODIOS =
  "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-206F,U+20AC,U+20BF,U+2190-2193,U+2212";

/* Funciones tipográficas que se conservan. Sin las numéricas
   (tnum/onum/lnum/frac/sups): en la página no hay ningún
   `font-variant-numeric`, así que son 8 KB de datos que nadie llama. */
const RASGOS = "kern,liga,calt,ccmp,mark,mkmk";

const ORIGEN =
  process.env.SF_PRO_TTF ??
  "/home/prodz/.cache/blink-marca/payload/Library/Fonts/SF-Pro.ttf";
const HERRAMIENTAS = process.env.FONTTOOLS_DIR ?? "/tmp/venv-fonts/bin";
const SALIDA = new URL("../src/assets/fonts/sf-pro-latin.woff2", import.meta.url);

/* Presupuesto declarado: si el recorte se pasa, algo se ha roto en la
   receta (un eje sin recortar, glifos de más) y es mejor saberlo aquí
   que en la CDN. */
const LIMITE_KB = 72;

const err = (mensaje) => {
  console.error(`\n${mensaje}\n`);
  process.exit(1);
};

if (!existsSync(ORIGEN)) {
  err(
    `No encuentro SF-Pro.ttf en ${ORIGEN}.\n` +
      "Descárgalo de developer.apple.com/fonts y señala la ruta con SF_PRO_TTF.",
  );
}
if (!existsSync(join(HERRAMIENTAS, "pyftsubset"))) {
  err(
    `No encuentro pyftsubset en ${HERRAMIENTAS}.\n` +
      "python3 -m venv /tmp/venv-fonts && /tmp/venv-fonts/bin/pip install fonttools brotli\n" +
      "y repite con FONTTOOLS_DIR=/tmp/venv-fonts/bin.",
  );
}

const ejecutar = (bin, args) =>
  execFileSync(join(HERRAMIENTAS, bin), args, { stdio: ["ignore", "ignore", "pipe"] });

const temporal = (nombre) => join(tmpdir(), `bws-sf-pro-${nombre}`);

/* 1 · Recorte de glifos y rasgos, TODOS los ejes intactos. Hacerlo antes
       de instanciar es lo que hace que el instancer trabaje sobre 900 KB
       en vez de sobre 21 MB. */
const conGlifos = temporal("glifos.ttf");
ejecutar("pyftsubset", [
  ORIGEN,
  `--unicodes=${UNICODIOS}`,
  `--layout-features=${RASGOS}`,
  "--drop-tables+=MERG,meta,trak",
  `--output-file=${conGlifos}`,
]);

/* 2 · Recorte de ejes. `wdth=100` FIJA el eje (desaparece de fvar);
       `wght=400:700` y `opsz=17:28` lo LIMITAN: siguen variables. */
const conEjes = temporal("ejes.ttf");
ejecutar("fonttools", [
  "varLib.instancer",
  conGlifos,
  "wdth=100",
  "wght=400:700",
  "opsz=17:28",
  "-o",
  conEjes,
]);

/* 3 · Segunda pasada de recorte: el instancer puede dejar glifos que ya
       no aportan, y aquí se comprime a woff2. */
const destino = SALIDA.pathname;
const provisional = `${destino}.tmp.woff2`;
ejecutar("pyftsubset", [
  conEjes,
  `--unicodes=${UNICODIOS}`,
  `--layout-features=${RASGOS}`,
  "--drop-tables+=MERG,meta,trak",
  "--flavor=woff2",
  `--output-file=${provisional}`,
]);

if (!existsSync(provisional)) err("El subconjunto no se escribió.");
const bytes = statSync(provisional).size;
const kb = bytes / 1024;
if (kb > LIMITE_KB) {
  err(
    `El recorte pesa ${kb.toFixed(1)} KB y el presupuesto era ${LIMITE_KB} KB.\n` +
      "Revisa la receta: probablemente se ha colado un eje o un bloque de glifos.",
  );
}
await mkdir(join(destino, ".."), { recursive: true });
await rename(provisional, destino);

console.log(
  `sf-pro-latin.woff2  ${kb.toFixed(1)} KB\n` +
    `  origen   ${ORIGEN}\n` +
    `  ejes     wght 400-700 · opsz 17-28 · wdth fijado en 100\n` +
    `  glifos   ${UNICODIOS}\n` +
    `  rasgos   ${RASGOS}\n`,
);
