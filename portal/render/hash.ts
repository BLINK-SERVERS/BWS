/* ============================================================
   Sellos del expediente
   ------------------------------------------------------------
   El sello de contenido se calcula sobre una representación
   canónica de los datos (documento, versión, hash de plantilla,
   campos, firmas y UTC), NO sobre los bytes del PDF. Un archivo no
   puede contener el hash de sí mismo: al insertarlo cambiaría.

   El hash del archivo se guarda aparte, se informa en el correo y
   se usa para detectar alteraciones posteriores. La cadena de
   documentos usa: sha256(hash_anterior || sello || orden).
   ============================================================ */

import { createHash } from "node:crypto";
import type { DatosExpediente, DocumentoLegal, FirmaCapturada } from "../legal/tipos";

/** JSON con las claves ordenadas: la misma entrada produce el mismo texto. */
export function canonica(valor: unknown): string {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === "object") {
      const objeto = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(objeto)
          .sort()
          .map((k) => [k, ordenar(objeto[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(ordenar(valor));
}

export function sha256Hex(datos: string | Uint8Array): string {
  return createHash("sha256").update(datos).digest("hex");
}

/** Huella de la plantilla tal como está publicada, sin datos resueltos. */
export function hashPlantilla(doc: DocumentoLegal): string {
  return sha256Hex(
    canonica({
      codigo: doc.codigo,
      titulo: doc.titulo,
      version: doc.version,
      fecha: doc.fecha,
      firma: doc.firma,
      campos: doc.campos,
      bloques: doc.bloques,
    }),
  );
}

export function huellaFirma(firma: FirmaCapturada): string {
  return firma.png ? sha256Hex(firma.png) : "papel";
}

/**
 * Sello de contenido. Incluye la identidad de la plantilla, los datos
 * resueltos, las firmas (por su huella) y el instante UTC.
 */
export function selloDeContenido(args: {
  doc: DocumentoLegal;
  datos: DatosExpediente;
  firmas: FirmaCapturada[];
  utc: string;
}): string {
  const { doc, datos, firmas, utc } = args;
  // Solo entran las variables que este documento usa: los documentos del
  // registro se sellan antes de que exista un proyecto y no deben cargar
  // campos que todavía no tienen valor.
  const variables = Object.fromEntries(doc.campos.map((clave) => [clave, datos.variables[clave] ?? null]));
  const usaBuzones = doc.bloques.some((b) => b.tipo === "buzones");
  const usaLimites = doc.bloques.some((b) => b.tipo === "limites");
  return sha256Hex(
    canonica({
      codigo: doc.codigo,
      version: doc.version,
      plantilla: hashPlantilla(doc),
      campos: variables,
      buzones: usaBuzones ? datos.buzones : null,
      limites: usaLimites ? datos.limites : null,
      firmas: firmas.map((f) => ({
        nombre: f.nombre,
        documento: f.documento,
        correo: f.correo ?? null,
        utc: f.utc,
        metodo: f.metodo,
        huella: huellaFirma(f),
      })),
      utc,
    }),
  );
}

/** Eslabón de la cadena de documentos. */
export function hashCadena(hashAnterior: string, sello: string, orden: number): string {
  return sha256Hex(`${hashAnterior}||${sello}||${orden}`);
}
