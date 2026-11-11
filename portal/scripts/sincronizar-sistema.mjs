/* ============================================================
   Copia el sistema visual de la landing al portal
   ------------------------------------------------------------
   El portal se despliega solo con su carpeta, así que no puede
   resolver `../src/styles` en Vercel. Aquí se mantiene una copia
   fiel de los tokens y la tipografía dentro de `portal/sistema/`;
   la landing sigue siendo la fuente única.

   · `fonts.css` se copia con la ruta de las fuentes ajustada a
     `./fuentes/`, que es donde viajan los woff2.
   · `--verificar` no escribe: falla si la copia se desvió.
   · La prueba unitaria usa la misma comparación.

   node portal/scripts/sincronizar-sistema.mjs [--verificar]
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ORIGEN = new URL("../../src/", import.meta.url);
const DESTINO = new URL("../sistema/", import.meta.url);
const verificar = process.argv.includes("--verificar");

const CSS = [
  { archivo: "styles/tokens.css", ajustar: false },
  { archivo: "styles/fonts.css", ajustar: true },
];

const FUENTES = [
  "assets/fonts/sf-pro-latin.woff2",
  "assets/fonts/inter-latin.woff2",
  "assets/fonts/LICENSE-Inter.txt",
];

export function contenidoEsperado(archivo, ajustar) {
  const texto = readFileSync(new URL(archivo, ORIGEN), "utf8");
  if (!ajustar) return texto;
  if (!texto.includes("../assets/fonts/")) {
    throw new Error(`${archivo}: no se encontró la ruta de las fuentes que hay que ajustar.`);
  }
  const ajustado = texto.split("../assets/fonts/").join("./fuentes/");
  if (ajustado.includes("../assets/")) {
    throw new Error(`${archivo}: quedó una ruta fuera de la carpeta del portal.`);
  }
  return ajustado;
}

function archivoDestino(archivo) {
  const relativo = archivo.startsWith("assets/fonts/") ? `fuentes/${archivo.slice(13)}` : archivo.replace(/^styles\//, "");
  return new URL(relativo, DESTINO);
}

const problemas = [];
let escritos = 0;

mkdirSync(new URL("fuentes/", DESTINO), { recursive: true });

for (const { archivo, ajustar } of CSS) {
  const esperado = contenidoEsperado(archivo, ajustar);
  const destino = archivoDestino(archivo);
  const actual = existsSync(destino) ? readFileSync(destino, "utf8") : "";
  if (actual !== esperado) {
    if (verificar) problemas.push(archivo);
    else {
      writeFileSync(destino, esperado, "utf8");
      escritos += 1;
      console.log(`  · actualizado ${archivo} (${Buffer.byteLength(esperado)} bytes)`);
    }
  }
}

for (const archivo of FUENTES) {
  const destino = archivoDestino(archivo);
  const esperado = readFileSync(new URL(archivo, ORIGEN));
  const actual = existsSync(destino) ? readFileSync(destino) : null;
  if (!actual || !actual.equals(esperado)) {
    if (verificar) problemas.push(archivo);
    else {
      copyFileSync(new URL(archivo, ORIGEN), destino);
      escritos += 1;
      console.log(`  · copiado ${archivo} (${esperado.length} bytes)`);
    }
  }
}

if (verificar) {
  if (problemas.length) {
    console.error(`✗ Copia desviada: ${problemas.join(", ")}. Ejecuta npm run sistema.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Sistema visual al día: ${CSS.length} hojas y ${FUENTES.length} archivos de fuentes.`);
  }
} else {
  console.log(`✓ Sistema visual sincronizado: ${escritos} archivo(s) actualizado(s).`);
}
