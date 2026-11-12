/* ============================================================
   Fuentes del PDF en Workerd
   ------------------------------------------------------------
   Wrangler empaqueta los TTF como módulos `Data` (ver `rules`
   en wrangler.jsonc), así que viajan con el Worker. Son las
   mismas Liberation SIL OFL 1.1 que usa Node.
   ============================================================ */

import type { LectorFuentes } from "./fuentes";
import mono from "./fuentes/LiberationMono-Regular.ttf";
import sansBold from "./fuentes/LiberationSans-Bold.ttf";
import sans from "./fuentes/LiberationSans-Regular.ttf";
import serifBold from "./fuentes/LiberationSerif-Bold.ttf";
import serifItalic from "./fuentes/LiberationSerif-Italic.ttf";
import serif from "./fuentes/LiberationSerif-Regular.ttf";

const ARCHIVOS: Record<string, Uint8Array> = {
  "LiberationMono-Regular.ttf": mono,
  "LiberationSans-Bold.ttf": sansBold,
  "LiberationSans-Regular.ttf": sans,
  "LiberationSerif-Bold.ttf": serifBold,
  "LiberationSerif-Italic.ttf": serifItalic,
  "LiberationSerif-Regular.ttf": serif,
};

export const lectorWorker: LectorFuentes = async (archivo) => {
  const bytes = ARCHIVOS[archivo];
  if (!bytes) throw new Error(`Fuente desconocida: ${archivo}`);
  return new Uint8Array(bytes);
};
