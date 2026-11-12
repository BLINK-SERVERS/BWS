/* ============================================================
   POST /api/suscripciones/recalcular
   ------------------------------------------------------------
   Revisa las suscripciones contra la fecha y escala las que se
   quedaron atrás con los plazos del contrato: al_dia → mora al
   vencer, suspendida a los diez días de mora y terminada a los
   treinta. Al suspender, la licencia de uso también se suspende; al
   terminar, la licencia termina.

   Solo escala. Una suspensión no se levanta sola: pagar la levanta
   (`pago.ts`) o la administración la reactiva a mano. Una
   terminación no se levanta: el pago y la reactivación la rechazan.
   Si el vencimiento sigue vencido, una reactivación manual avisa.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import { fechaTexto, hoyUTC, DIAS_MORA_SUSPENSION, DIAS_MORA_TERMINACION } from "../_lib/suscripcion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const suscripcionId = texto(cuerpo?.suscripcion_id) || null;
  const proyectoId = texto(cuerpo?.proyecto_id) || null;
  if (suscripcionId && !UUID.test(suscripcionId)) {
    throw new ErrorHttp(400, "La suscripción indicada no es válida.", "suscripcion");
  }
  if (proyectoId && !UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "El proyecto indicado no es válido.", "proyecto");
  }

  const hoy = hoyUTC();
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`with calc as (
          select s.id, s.proyecto_id, s.estado as anterior,
                 case
                   when s.proximo_vencimiento >= ${hoy}::date then 'al_dia'
                   when ${hoy}::date <= s.proximo_vencimiento + s.dias_gracia + ${DIAS_MORA_SUSPENSION}::int then 'mora'
                   when ${hoy}::date <= s.proximo_vencimiento + s.dias_gracia + ${DIAS_MORA_TERMINACION}::int then 'suspendida'
                   else 'terminada'
                 end as calculado,
                 s.proximo_vencimiento
          from suscripciones s
          where s.estado <> 'terminada'
            and (${suscripcionId}::uuid is null or s.id = ${suscripcionId}::uuid)
            and (${proyectoId}::uuid is null or s.proyecto_id = ${proyectoId}::uuid)
        ), cambios as (
          update suscripciones s
          set estado = c.calculado, actualizada = now()
          from calc c
          where s.id = c.id
            and (case c.calculado when 'terminada' then 3 when 'suspendida' then 2
                                  when 'mora' then 1 else 0 end)
              > (case c.anterior when 'terminada' then 3 when 'suspendida' then 2
                                 when 'mora' then 1 else 0 end)
          returning s.id, s.proyecto_id, s.estado
        ), lic as (
          update licencias l
          set estado = case when k.estado = 'terminada' then 'terminada' else 'suspendida' end
          from cambios k
          where l.proyecto_id = k.proyecto_id
            and ((k.estado = 'suspendida' and l.estado = 'activa')
              or (k.estado = 'terminada' and l.estado in ('activa', 'suspendida')))
          returning 1
        ), evento as (
          insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}::uuid, 'admin', 'suscripcion.recalculada',
                 'suscripciones', k.id::text,
                 jsonb_build_object('anterior', c.anterior, 'nuevo', c.calculado,
                                    'proximo_vencimiento', c.proximo_vencimiento),
                 ${ip}::inet, ${agente}::text
          from cambios k
          join calc c on c.id = k.id
          returning 1
        )
        select c.id, c.anterior, c.calculado as nuevo, c.proximo_vencimiento,
               (select count(*)::int from calc) as revisadas
        from calc c
        join cambios k on k.id = c.id`,
  ]);

  const cambios = ((filas ?? []) as Record<string, unknown>[]).map((fila) => ({
    suscripcion_id: String(fila.id),
    anterior: String(fila.anterior),
    nuevo: String(fila.nuevo),
    proximo_vencimiento: fechaTexto(fila.proximo_vencimiento),
  }));

  return json({
    ok: true,
    hoy,
    cambiadas: cambios.length,
    cambios,
  });
});
