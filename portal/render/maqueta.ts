/* ============================================================
   Maqueta del PDF
   ------------------------------------------------------------
   A4, márgenes fijos, medición real con la fuente embebida y
   saltos de página. Nada de coordenadas mágicas repartidas por el
   código: la geometría vive aquí y el renderizador solo dibuja.
   ============================================================ */

import fontkit from "@pdf-lib/fontkit";
import { rgb, type PDFDocument, type PDFFont, type RGB } from "pdf-lib";
import type { LectorFuentes } from "./fuentes";
import { partirRuns } from "./runs";

export { partirRuns } from "./runs";

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

async function incrustar(
  pdf: PDFDocument,
  leer: LectorFuentes,
  archivo: string,
  nombre: string,
): Promise<PDFFont> {
  const bytes = await leer(archivo);
  // `subset: true` incrusta solo los glifos usados. `customName` fija el
  // prefijo del subconjunto: sin él pdf-lib añade un sufijo aleatorio y el
  // mismo expediente produciría archivos distintos en cada pasada.
  // Las fuentes de Liberation son SIL OFL 1.1: se pueden incrustar.
  return pdf.embedFont(bytes, { subset: true, customName: nombre });
}

export async function cargarFuentes(
  pdf: PDFDocument,
  leer: LectorFuentes,
  opciones?: { inter?: boolean },
): Promise<Fuentes> {
  pdf.registerFontkit(fontkit);
  // En serie, no en paralelo: pdf-lib numera los objetos al registrarlos y
  // con Promise.all el orden depende de qué fuente termine antes. Eso cambia
  // los bytes del PDF entre dos pasadas idénticas. Aquí el orden es fijo.
  if (opciones?.inter) {
    // Estilo clásico: todo el documento va en Inter (SIL OFL 1.1). Solo se
    // conserva el mono de Liberation para los hashes de la evidencia.
    const inter = await incrustar(pdf, leer, "Inter-Regular.ttf", "BWSINT+Inter");
    const interBold = await incrustar(pdf, leer, "Inter-Bold.ttf", "BWSINB+Inter-Bold");
    const mono = await incrustar(pdf, leer, "LiberationMono-Regular.ttf", "BWSMON+LiberationMono");
    return { serif: inter, serifBold: interBold, serifItalic: inter, sans: inter, sansBold: interBold, mono };
  }
  const serif = await incrustar(pdf, leer, "LiberationSerif-Regular.ttf", "BWSSER+LiberationSerif");
  const serifBold = await incrustar(pdf, leer, "LiberationSerif-Bold.ttf", "BWSSBD+LiberationSerif-Bold");
  const serifItalic = await incrustar(pdf, leer, "LiberationSerif-Italic.ttf", "BWSSIT+LiberationSerif-Italic");
  const sans = await incrustar(pdf, leer, "LiberationSans-Regular.ttf", "BWSSAN+LiberationSans");
  const sansBold = await incrustar(pdf, leer, "LiberationSans-Bold.ttf", "BWSSAB+LiberationSans-Bold");
  const mono = await incrustar(pdf, leer, "LiberationMono-Regular.ttf", "BWSMON+LiberationMono");
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

/** Tamaños del estilo clásico: Inter 16/14/12 con interlineado 1.5. */
export const CLASICO = {
  titulo: 16,
  interlineadoTitulo: 24,
  capitulo: 14,
  interlineadoCapitulo: 21,
  cuerpo: 12,
  interlineadoCuerpo: 18,
  celda: 10,
  interlineadoCelda: 14,
};

export interface PalabraMedida {
  texto: string;
  negrita: boolean;
  ancho: number;
}

export interface LineaRuns {
  palabras: PalabraMedida[];
  /** Suma de anchos de palabra, sin los espacios entre ellas. */
  anchoTexto: number;
  /** Última línea de su párrafo: no se justifica. */
  final: boolean;
}

/**
 * Envuelve un texto con negritas inline (`**…**`) midiendo cada palabra
 * con su fuente real. Devuelve líneas listas para justificar: el sobrante
 * se reparte entre los huecos de palabra salvo en la línea final.
 */
export function envolverRuns(
  texto: string,
  regular: PDFFont,
  bold: PDFFont,
  tamano: number,
  ancho: number,
): LineaRuns[] {
  const parrafos: { texto: string; negrita: boolean }[][] = [[]];
  let separado = true;
  for (const run of partirRuns(texto)) {
    run.texto.split("\n").forEach((segmento, indice) => {
      if (indice > 0) {
        parrafos.push([]);
        separado = true;
      }
      if (!segmento.trim()) {
        if (segmento.length) separado = true;
        return;
      }
      const palabras = segmento.split(/\s+/).filter(Boolean);
      const inicial = /^\s/.test(segmento) || separado;
      const actual = parrafos[parrafos.length - 1];
      palabras.forEach((palabra, i) => {
        if (i > 0 || inicial || !actual.length) {
          actual.push({ texto: palabra, negrita: run.negrita });
        } else {
          // Negrita que parte una palabra por la mitad: se une al tramo anterior.
          const ultima = actual[actual.length - 1];
          actual[actual.length - 1] = { texto: ultima.texto + palabra, negrita: ultima.negrita };
        }
      });
      separado = /\s$/.test(segmento);
    });
  }

  const espacio = regular.widthOfTextAtSize(" ", tamano);
  const lineas: LineaRuns[] = [];
  for (const parrafo of parrafos) {
    if (!parrafo.length) {
      lineas.push({ palabras: [], anchoTexto: 0, final: true });
      continue;
    }
    let actual: PalabraMedida[] = [];
    let anchoActual = 0;
    for (const palabra of parrafo) {
      const fuente = palabra.negrita ? bold : regular;
      const anchoPalabra = fuente.widthOfTextAtSize(palabra.texto, tamano);
      const prueba = actual.length ? anchoActual + espacio + anchoPalabra : anchoPalabra;
      if (prueba <= ancho) {
        actual.push({ ...palabra, ancho: anchoPalabra });
        anchoActual = prueba;
        continue;
      }
      if (actual.length) {
        lineas.push({ palabras: actual, anchoTexto: anchoActual, final: false });
        actual = [];
        anchoActual = 0;
      }
      if (anchoPalabra > ancho) {
        const trozos = envolverCaracteres(palabra.texto, fuente, tamano, ancho);
        for (const trozo of trozos.slice(0, -1)) {
          const anchoTrozo = fuente.widthOfTextAtSize(trozo, tamano);
          lineas.push({
            palabras: [{ texto: trozo, negrita: palabra.negrita, ancho: anchoTrozo }],
            anchoTexto: anchoTrozo,
            final: false,
          });
        }
        const resto = trozos[trozos.length - 1] ?? "";
        actual = [{ texto: resto, negrita: palabra.negrita, ancho: fuente.widthOfTextAtSize(resto, tamano) }];
        anchoActual = actual[0].ancho;
      } else {
        actual = [{ ...palabra, ancho: anchoPalabra }];
        anchoActual = anchoPalabra;
      }
    }
    if (actual.length) lineas.push({ palabras: actual, anchoTexto: anchoActual, final: true });
  }
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
