/* ============================================================
   Errores de la API
   ------------------------------------------------------------
   Un `ErrorHttp` se muestra al cliente con su mensaje y su estado.
   Cualquier otra excepción se convierte en un 500 genérico: no se
   filtra el mensaje de Postgres, que puede incluir nombres de
   columnas o valores de otra fila.
   ============================================================ */

import { json } from "./http";

export class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

export function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorHttp) {
    return json(
      { error: error.message, codigo: error.codigo ?? null },
      error.estado,
    );
  }
  console.error("Error no controlado en la API:", error instanceof Error ? error.message : error);
  return json(
    { error: "No pudimos completar la operación. Inténtalo de nuevo en unos minutos." },
    500,
  );
}

/** Código de PostgreSQL cuando el error viene del driver de Neon o de `pg`. */
export function codigoPostgres(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const codigo = (error as { code?: unknown }).code;
  return typeof codigo === "string" ? codigo : null;
}
