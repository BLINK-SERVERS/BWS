/* ============================================================
   Frontera con Neon
   ------------------------------------------------------------
   La API usa el rol `bws_app`, nunca el dueño. Como ese rol está
   sujeto a RLS, cada operación con identidad va dentro de una
   transacción que fija `app.usuario_id` y `app.rol` con `SET LOCAL`.
   El driver HTTP no permite transacciones interactivas, así que la
   lista de consultas se construye antes de enviarla.
   ============================================================ */

import {
  neon,
  type NeonQueryFunction,
  type NeonQueryFunctionInTransaction,
  type NeonQueryInTransaction,
} from "@neondatabase/serverless";

let cache: NeonQueryFunction<false, false> | null = null;

/**
 * Solo `DATABASE_URL_APP`, el rol `bws_app` sujeto a RLS. Caer a
 * `DATABASE_URL` sería abrir la puerta: el dueño ve todas las filas y
 * los filtros por cliente dejarían de significar nada.
 */
function cadena(): string {
  const url = process.env.DATABASE_URL_APP;
  if (!url) throw new Error("Falta DATABASE_URL_APP: la API no tiene base.");
  return url;
}

export function db(): NeonQueryFunction<false, false> {
  return (cache ??= neon(cadena()));
}

export type Consulta = NeonQueryFunctionInTransaction<false, false>;

/**
 * Ejecuta consultas en una transacción con identidad de aplicación.
 * Devuelve los resultados de las consultas construidas, sin el
 * `set_config` inicial.
 */
export async function enTransaccion(
  usuarioId: string | null,
  rol: "cliente" | "admin",
  construir: (txn: Consulta) => NeonQueryInTransaction[],
): Promise<Record<string, unknown>[][]> {
  const resultados = await db().transaction((txn) => [
    txn`select set_config('app.usuario_id', ${usuarioId ?? ""}, true),
               set_config('app.rol', ${rol}, true)`,
    ...construir(txn),
  ]);
  return resultados.slice(1);
}
