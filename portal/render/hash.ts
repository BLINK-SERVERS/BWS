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
import { canonica, contenidoPlantilla } from "../legal/canonica";
import type {
  DatosExpediente,
  DocumentoLegal,
  DocumentoResuelto,
  FirmaCapturada,
} from "../legal/tipos";

export { canonica } from "../legal/canonica";

export function sha256Hex(datos: string | Uint8Array): string {
  return createHash("sha256").update(datos).digest("hex");
}

/** Huella de la plantilla tal como está publicada, sin datos resueltos. */
export function hashPlantilla(doc: DocumentoLegal): string {
  return sha256Hex(contenidoPlantilla(doc));
}

/**
 * Huella del consentimiento tal como se mostró: el texto resuelto, no
 * solo la plantilla. Si cambia un dato del cliente, cambia la huella y
 * el registro se niega a aceptar un consentimiento viejo.
 */
export function hashConsentimiento(doc: DocumentoResuelto): string {
  return sha256Hex(
    canonica({
      codigo: doc.codigo,
      version: doc.version,
      fecha: doc.fecha,
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
