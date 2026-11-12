/* ============================================================
   POST /api/suscripciones/reactivar
   ------------------------------------------------------------
   Devuelve la suscripción a `al_dia` y la licencia a `activa`.
   No mueve el vencimiento: si sigue vencido, el siguiente
   recálculo la suspendería otra vez, así que la respuesta lo
   advierte y el panel lo muestra antes de confirmar.

   El motivo es opcional, pero queda en el evento junto al estado
   anterior. La reactivación siempre deja rastro.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import { estadoPorFecha, fechaTexto } from "../_lib/suscripcion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const suscripcionId = texto(cuerpo?.suscripcion_id);
  if (!UUID.test(suscripcionId)) {
    throw new ErrorHttp(400, "Indica la suscripción que quieres reactivar.", "suscripcion");
  }

  const motivo = texto(cuerpo?.motivo).slice(0, 300) || null;

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select s.id, s.proyecto_id, s.estado, s.proximo_vencimiento, s.dias_gracia,
               (select l.estado from licencias l
                 where l.proyecto_id = s.proyecto_id and l.tipo = 'uso'
                 order by l.creado desc limit 1) as licencia
        from suscripciones s
        where s.id = ${suscripcionId}`,
  ]);
  const suscripcion = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!suscripcion) {
    throw new ErrorHttp(404, "Esa suscripción no existe.", "suscripcion");
  }
  if (String(suscripcion.estado) === "terminada") {
    throw new ErrorHttp(409, "La suscripción está terminada: no se reactiva.", "terminada");
  }

  const anterior = String(suscripcion.estado);
  const licencia = String(suscripcion.licencia ?? "");
  if (anterior === "al_dia" && licencia === "activa") {
    return json({ ok: true, cambiado: false, estado: "al_dia" });
  }

  const vencimiento = fechaTexto(suscripcion.proximo_vencimiento);
  const calculado = estadoPorFecha(vencimiento, Number(suscripcion.dias_gracia));
  const aviso = calculado === "suspendida"
    ? "El vencimiento sigue vencido: registra el pago antes del próximo recálculo o volverá a suspenderse."
    : null;

  const proyectoId = String(suscripcion.proyecto_id);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`update suscripciones
        set estado = 'al_dia', actualizada = now()
        where id = ${suscripcionId}`,
    txn`update licencias
        set estado = 'activa'
        where proyecto_id = ${proyectoId}::uuid and estado = 'suspendida'`,
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
        values (${sesion.usuarioId}, 'admin', 'suscripcion.reactivada', 'suscripciones',
                ${suscripcionId},
                ${JSON.stringify({ motivo, estado_anterior: anterior, aviso })}::jsonb,
                ${ip}, ${agente})`,
  ]);

  return json({ ok: true, cambiado: true, estado: "al_dia", anterior, aviso });
});
