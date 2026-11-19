/* La comparación de archivos se realiza únicamente en el navegador. */

export interface DocumentoPublico {
  id: string;
  titular: string;
  titulo: string;
  estado: "pendiente" | "confirmado" | "anulado";
  hash_archivo: string;
  hash_ajustado: string | null;
}

export type ResultadoPdf = "original" | "ajustado" | "distinto" | "no-pdf";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

export function uuidValido(id: string): boolean {
  return UUID.test(id);
}

/** No se presenta como válido un registro incompleto o de otro documento. */
export function esDocumentoPublico(valor: unknown, id: string): valor is DocumentoPublico {
  if (!valor || typeof valor !== "object") return false;
  const documento = valor as Record<string, unknown>;
  return (
    typeof documento.id === "string" &&
    documento.id.toLowerCase() === id.toLowerCase() &&
    typeof documento.titular === "string" && documento.titular.trim().length > 0 &&
    typeof documento.titulo === "string" && documento.titulo.trim().length > 0 &&
    (documento.estado === "pendiente" || documento.estado === "confirmado" || documento.estado === "anulado") &&
    typeof documento.hash_archivo === "string" && SHA256.test(documento.hash_archivo) &&
    (documento.hash_ajustado === null ||
      (typeof documento.hash_ajustado === "string" && SHA256.test(documento.hash_ajustado)))
  );
}

export function compararHuellas(
  calculado: string,
  original: string,
  ajustado: string | null,
): Exclude<ResultadoPdf, "no-pdf"> {
  const huella = calculado.toLowerCase();
  // Ante huellas idénticas, no atribuir la firma al posible ajuste.
  if (ajustado && huella === ajustado.toLowerCase()) return "ajustado";
  if (huella === original.toLowerCase()) return "original";
  return "distinto";
}

export async function compararPdf(archivo: Blob, documento: DocumentoPublico): Promise<ResultadoPdf> {
  const contenido = await archivo.arrayBuffer();
  // El encabezado puede estar en los primeros 1024 bytes de un PDF.
  const inicio = new Uint8Array(contenido, 0, Math.min(contenido.byteLength, 1024));
  if (!new TextDecoder("ascii").decode(inicio).includes("%PDF-")) return "no-pdf";
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto no está disponible.");
  const resumen = await globalThis.crypto.subtle.digest("SHA-256", contenido);
  const huella = Array.from(new Uint8Array(resumen), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return compararHuellas(huella, documento.hash_archivo, documento.hash_ajustado);
}
