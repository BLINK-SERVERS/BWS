/* ============================================================
   Validación del trazo de la firma
   ------------------------------------------------------------
   Se acepta solo un PNG real, con cabecera IHDR legible, dentro
   de un tamaño razonable. El límite evita que una petición suba
   decenas de megas y que un archivo que no es un trazo termine en
   la columna `bytea`.
   ============================================================ */

import { createHash } from "node:crypto";
import { ErrorHttp } from "./respuestas";

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MINIMO = 500;
const MAXIMO = 300 * 1024;
const ANCHO_MIN = 200;
const ANCHO_MAX = 4000;
const ALTO_MIN = 60;
const ALTO_MAX = 2000;

export interface FirmaValidada {
  png: Buffer;
  sha256: string;
  ancho: number;
  alto: number;
}

function rechazar(mensaje: string, codigo = "firma"): never {
  throw new ErrorHttp(400, mensaje, codigo);
}

/** Acepta un data URL o base64 pelado; devuelve el PNG verificado. */
export function validarFirmaPNG(entrada: unknown): FirmaValidada {
  if (typeof entrada !== "string" || !entrada.trim()) {
    rechazar("Falta el trazo de la firma.");
  }

  const limpio = entrada.replace(/^data:image\/png;base64,/i, "").replace(/\s+/g, "");
  if (!limpio || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpio)) {
    rechazar("El trazo no llegó como una imagen PNG.");
  }

  const png = Buffer.from(limpio, "base64");
  if (png.length < MINIMO) rechazar("El trazo está vacío o es demasiado pequeño.");
  if (png.length > MAXIMO) rechazar("El trazo supera el tamaño máximo permitido.");

  if (!png.subarray(0, 8).equals(FIRMA_PNG)) {
    rechazar("El archivo no es un PNG válido.");
  }
  if (png.length < 33 || png.subarray(12, 16).toString("latin1") !== "IHDR") {
    rechazar("Al PNG le falta la cabecera de imagen.");
  }

  const ancho = png.readUInt32BE(16);
  const alto = png.readUInt32BE(20);
  if (ancho < ANCHO_MIN || ancho > ANCHO_MAX || alto < ALTO_MIN || alto > ALTO_MAX) {
    rechazar("Las dimensiones del trazo no son las esperadas.");
  }

  return {
    png,
    sha256: createHash("sha256").update(png).digest("hex"),
    ancho,
    alto,
  };
}
