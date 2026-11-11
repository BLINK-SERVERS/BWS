/* ============================================================
   Forma canónica de una plantilla
   ------------------------------------------------------------
   La misma plantilla debe producir exactamente el mismo texto
   antes de hashearse, sin importar el orden en que el motor o el
   navegador recorran las claves. Aquí no se usa `node:crypto`:
   el cliente puede calcular la misma huella con SubtleCrypto y
   compararla con la que devuelve el servidor.
   ============================================================ */

import type { DocumentoLegal } from "./tipos";

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

/** Texto exacto que se hashea para identificar una versión publicada. */
export function contenidoPlantilla(doc: DocumentoLegal): string {
  return canonica({
    codigo: doc.codigo,
    titulo: doc.titulo,
    version: doc.version,
    fecha: doc.fecha,
    firma: doc.firma,
    campos: doc.campos,
    bloques: doc.bloques,
  });
}
