/* ============================================================
   Origen de las fuentes del PDF
   ------------------------------------------------------------
   El motor no sabe de dónde salen los TTF: recibe un lector.
   Node los lee del disco (pruebas, scripts y servidor local) y
   el Worker los lleva incrustados, porque en el borde no hay
   sistema de archivos.
   ============================================================ */

export type LectorFuentes = (archivo: string) => Promise<Uint8Array>;

let lector: LectorFuentes | null = null;

/** Fija el lector una sola vez, al arrancar cada entrada. */
export function configurarFuentes(nuevo: LectorFuentes): void {
  lector = nuevo;
}

export function lectorDeFuentes(): LectorFuentes {
  if (!lector) {
    throw new Error("Las fuentes del PDF no están configuradas: falta `configurarFuentes` en la entrada.");
  }
  return lector;
}
