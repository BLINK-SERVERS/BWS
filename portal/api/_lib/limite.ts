/* ============================================================
   Límites de intentos
   ------------------------------------------------------------
   La fila de `limites` se crea o se reinicia en la misma sentencia
   que la incrementa, así dos peticiones simultáneas no pueden
   saltarse el límite. La clave incluye la acción y, según el caso,
   la IP o el correo normalizado.
   ============================================================ */

import { db } from "./db";

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  expira: Date;
}

export async function consumirLimite(
  clave: string,
  maximo: number,
  ventanaSegundos: number,
): Promise<ResultadoLimite> {
  const filas = await db()`
    insert into limites (clave, intentos, ventana_inicio, expira)
    values (${clave}, 1, now(), now() + make_interval(secs => ${ventanaSegundos}))
    on conflict (clave) do update set
      intentos = case when limites.expira <= now() then 1 else limites.intentos + 1 end,
      ventana_inicio = case when limites.expira <= now() then now() else limites.ventana_inicio end,
      expira = case when limites.expira <= now()
        then now() + make_interval(secs => ${ventanaSegundos})
        else limites.expira end
    returning intentos, expira
  `;
  const fila = filas[0];
  const intentos = Number(fila.intentos);
  return {
    permitido: intentos <= maximo,
    restantes: Math.max(0, maximo - intentos),
    expira: new Date(fila.expira as string),
  };
}

/** Limita por IP y por identificador (correo) con dos ventanas distintas. */
export async function consumirDoble(
  prefijo: string,
  ip: string | null,
  identificador: string | null,
  maximoIp: number,
  maximoCuenta: number,
  ventanaSegundos: number,
): Promise<ResultadoLimite> {
  const porIp = await consumirLimite(
    `${prefijo}:ip:${ip ?? "desconocida"}`,
    maximoIp,
    ventanaSegundos,
  );
  if (!porIp.permitido) return porIp;

  if (!identificador) return porIp;
  const porCuenta = await consumirLimite(
    `${prefijo}:cuenta:${identificador}`,
    maximoCuenta,
    ventanaSegundos,
  );
  return porCuenta.permitido ? porIp : porCuenta;
}
