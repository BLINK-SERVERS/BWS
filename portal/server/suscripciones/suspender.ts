/* ============================================================
   POST /api/suscripciones/suspender
   ------------------------------------------------------------
   Suspensión manual: mora acordada, incumplimiento o cualquier
   causa que la administración decida. Deja la suscripción y su
   licencia de uso en `suspendida` y registra el motivo.

   No toca el vencimiento: si el pago estaba pendiente, sigue
   pendiente, y la reactivación avisará de ello.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const suscripcionId = texto(cuerpo?.suscripcion_id);
  if (!UUID.test(suscripcionId)) {
    throw new ErrorHttp(400, "Indica la suscripción que quieres suspender.", "suscripcion");
  }

  const motivo = texto(cuerpo?.motivo);
  if (motivo.length < 5 || motivo.length > 300) {
    throw new ErrorHttp(400, "Escribe el motivo de la suspensión (5 a 300 caracteres).", "motivo");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select id, proyecto_id, estado from suscripciones where id = ${suscripcionId}`,
  ]);
  const suscripcion = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!suscripcion) {
    throw new ErrorHttp(404, "Esa suscripción no existe.", "suscripcion");
  }
  if (String(suscripcion.estado) === "terminada") {
    throw new ErrorHttp(409, "La suscripción está terminada.", "terminada");
  }
  if (String(suscripcion.estado) === "suspendida") {
    return json({ ok: true, cambiado: false, estado: "suspendida" });
  }

  const anterior = String(suscripcion.estado);
  const proyectoId = String(suscripcion.proyecto_id);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`update suscripciones
        set estado = 'suspendida', actualizada = now()
        where id = ${suscripcionId}`,
    txn`update licencias
        set estado = 'suspendida'
        where proyecto_id = ${proyectoId}::uuid and estado = 'activa'`,
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
        values (${sesion.usuarioId}, 'admin', 'suscripcion.suspendida', 'suscripciones',
                ${suscripcionId},
                ${JSON.stringify({ motivo, estado_anterior: anterior })}::jsonb,
                ${ip}, ${agente})`,
  ]);

  return json({ ok: true, cambiado: true, estado: "suspendida", anterior });
});
