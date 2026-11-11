/* ============================================================
   Maqueta del PDF
   ------------------------------------------------------------
   A4, márgenes fijos, medición real con la fuente embebida y
   saltos de página. Nada de coordenadas mágicas repartidas por el
   código: la geometría vive aquí y el renderizador solo dibuja.
   ============================================================ */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { rgb, type PDFDocument, type PDFFont, type RGB } from "pdf-lib";

export const A4 = { ancho: 595.28, alto: 841.89 };
export const MARGEN = { sup: 68, inf: 62, izq: 56, der: 56 };
export const ANCHO_CONTENIDO = A4.ancho - MARGEN.izq - MARGEN.der;

export const COLORES = {
  tinta: rgb(0.113, 0.113, 0.122),
  secundario: rgb(0.259, 0.259, 0.259),
  terciario: rgb(0.431, 0.431, 0.431),
  acento: rgb(0, 0.478, 1),
  borde: rgb(0.82, 0.82, 0.84),
  bordeSuave: rgb(0.9, 0.9, 0.92),
  relleno: rgb(0.949, 0.949, 0.969),
  blanco: rgb(1, 1, 1),
};

export interface Fuentes {
  serif: PDFFont;
  serifBold: PDFFont;
  serifItalic: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
  mono: PDFFont;
}

// En Vercel las fuentes viajan con la función (ver `includeFiles` en
// vercel.json) y quedan en `render/fuentes` bajo el cwd, no junto al
// módulo compilado.
const RUTA_FUENTES = (() => {
  const junto = fileURLToPath(new URL("./fuentes/", import.meta.url));
  return existsSync(junto) ? junto : join(process.cwd(), "render", "fuentes");
})();

async function incrustar(pdf: PDFDocument, archivo: string, nombre: string): Promise<PDFFont> {
  const bytes = await readFile(join(RUTA_FUENTES, archivo));
  // `subset: true` incrusta solo los glifos usados. `customName` fija el
  // prefijo del subconjunto: sin él pdf-lib añade un sufijo aleatorio y el
  // mismo expediente produciría archivos distintos en cada pasada.
  // Las fuentes de Liberation son SIL OFL 1.1: se pueden incrustar.
  return pdf.embedFont(bytes, { subset: true, customName: nombre });
}

export async function cargarFuentes(pdf: PDFDocument): Promise<Fuentes> {
  pdf.registerFontkit(fontkit);
  // En serie, no en paralelo: pdf-lib numera los objetos al registrarlos y
  // con Promise.all el orden depende de qué fuente termine antes. Eso cambia
  // los bytes del PDF entre dos pasadas idénticas. Aquí el orden es fijo.
  const serif = await incrustar(pdf, "LiberationSerif-Regular.ttf", "BWSSER+LiberationSerif");
  const serifBold = await incrustar(pdf, "LiberationSerif-Bold.ttf", "BWSSBD+LiberationSerif-Bold");
  const serifItalic = await incrustar(pdf, "LiberationSerif-Italic.ttf", "BWSSIT+LiberationSerif-Italic");
  const sans = await incrustar(pdf, "LiberationSans-Regular.ttf", "BWSSAN+LiberationSans");
  const sansBold = await incrustar(pdf, "LiberationSans-Bold.ttf", "BWSSAB+LiberationSans-Bold");
  const mono = await incrustar(pdf, "LiberationMono-Regular.ttf", "BWSMON+LiberationMono");
  return { serif, serifBold, serifItalic, sans, sansBold, mono };
}

/** Parte un texto por palabras para que quepa en `ancho`. */
export function envolver(
  texto: string,
  fuente: PDFFont,
  tamano: number,
  ancho: number,
): string[] {
  const lineas: string[] = [];
  const parrafos = String(texto).split(/\n/);
  for (const parrafo of parrafos) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho) {
        actual = prueba;
      } else {
        if (actual) lineas.push(actual);
        // Una palabra más ancha que la línea (hash, URL) se corta por caracteres.
        if (fuente.widthOfTextAtSize(palabra, tamano) > ancho) {
          const trozos = envolverCaracteres(palabra, fuente, tamano, ancho);
          lineas.push(...trozos.slice(0, -1));
          actual = trozos[trozos.length - 1] ?? "";
        } else {
          actual = palabra;
        }
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/** Corte por caracteres, para hashes y cadenas sin espacios. */
export function envolverCaracteres(
  texto: string,
  fuente: PDFFont,
  tamano: number,
  ancho: number,
): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const caracter of texto) {
    const prueba = actual + caracter;
    if (fuente.widthOfTextAtSize(prueba, tamano) > ancho && actual) {
      lineas.push(actual);
      actual = caracter;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export function formatearUTC(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ${dos(
    fecha.getUTCHours(),
  )}:${dos(fecha.getUTCMinutes())} UTC`;
}

export function colorHex(hex: string): RGB {
  const limpio = hex.replace("#", "");
  const n = Number.parseInt(limpio, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
