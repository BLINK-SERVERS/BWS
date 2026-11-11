/* ============================================================
   Carga mínima de `.env.local` para los scripts de base de datos.
   No imprime valores: solo devuelve el mapa de variables.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

export function cargarEnv(archivo = new URL("../.env.local", import.meta.url)) {
  if (!existsSync(archivo)) return {};
  const variables = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte < 1) continue;
    variables[limpia.slice(0, corte)] = limpia.slice(corte + 1);
  }
  return variables;
}

export function exigir(variables, nombre) {
  const valor = process.env[nombre] ?? variables[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre}. Defínela en portal/.env.local o en el entorno.`);
  }
  return valor;
}
