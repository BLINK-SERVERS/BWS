/* ============================================================
   Fuentes del PDF en Node
   ------------------------------------------------------------
   Lee los TTF de `render/fuentes/`. Si el módulo se compila
   fuera de su carpeta, cae a la ruta del proyecto en ejecución.
   ============================================================ */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LectorFuentes } from "./fuentes";

const RUTA = (() => {
  const junto = fileURLToPath(new URL("./fuentes/", import.meta.url));
  return existsSync(junto) ? junto : join(process.cwd(), "render", "fuentes");
})();

export const lectorNodo: LectorFuentes = (archivo) => readFile(join(RUTA, archivo));
