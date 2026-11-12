/* ============================================================
   POST /api/suscripciones/anular
   ------------------------------------------------------------
   Anular no borra: agrega una fila `anulado` que referencia al
   pago original y guarda el motivo. El original sigue visible en
   el historial, que es exactamente lo que se quiere auditar.

   Después de anular se corrige el vencimiento con los pagos que
   siguen vigentes: el último periodo pagado, o el propio periodo
   anulado si no queda ninguno. El estado solo puede escalar
   (al_dia → mora → suspendida); reactivar es una acción aparte.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import {
  estadoPorFecha,
  fechaTexto,
  vencimientoDelPeriodo,
  vencimientoTrasPeriodo,
} from "../_lib/suscripcion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const pagoId = texto(cuerpo?.pago_id);
  if (!UUID.test(pagoId)) {
    throw new ErrorHttp(400, "Indica el pago que quieres anular.", "pago");
  }

  const motivo = texto(cuerpo?.motivo);
  if (motivo.length < 5 || motivo.length > 300) {
    throw new ErrorHttp(400, "Escribe el motivo de la anulación (5 a 300 caracteres).", "motivo");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select p.id, p.suscripcion_id, p.periodo, p.monto, p.moneda, p.tasa_bcv,
               p.referencia, p.fecha, p.estado, p.comprobante,
               exists (select 1 from pagos a where a.anulacion_de = p.id) as anulado,
               s.proyecto_id, s.dia_cobro, s.dias_gracia,
               s.estado as suscripcion_estado
        from pagos p
        join suscripciones s on s.id = p.suscripcion_id
        where p.id = ${pagoId}`,
  ]);

  const pago = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!pago) {
    throw new ErrorHttp(404, "Ese pago no existe.", "pago");
  }
  if (pago.anulado) {
    throw new ErrorHttp(409, "Ese pago ya fue anulado.", "ya_anulado");
  }
  if (String(pago.estado) !== "registrado") {
    throw new ErrorHttp(409, "Solo se anula un pago registrado.", "estado_pago");
  }
  if (String(pago.suscripcion_estado) === "terminada") {
    throw new ErrorHttp(409, "La suscripción está terminada: no admite anulaciones.", "terminada");
  }

  const suscripcionId = String(pago.suscripcion_id);
  const proyectoId = String(pago.proyecto_id);
  const diaCobro = Number(pago.dia_cobro);
  const gracia = Number(pago.dias_gracia);
  const periodo = String(pago.periodo);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  try {
    const [, vigentes] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`insert into pagos
            (suscripcion_id, periodo, monto, moneda, tasa_bcv, referencia, fecha,
             estado, comprobante, anulacion_de, motivo)
          values (${suscripcionId}::uuid, ${periodo}, ${Number(pago.monto).toFixed(2)},
                  ${String(pago.moneda)}, ${pago.tasa_bcv === null ? null : Number(pago.tasa_bcv)},
                  ${String(pago.referencia)}, ${fechaTexto(pago.fecha)}::date,
                  'anulado', ${pago.comprobante}, ${pagoId}::uuid, ${motivo})`,
      txn`select max(p.periodo) as ultimo
          from pagos p
          where p.suscripcion_id = ${suscripcionId}
            and p.estado = 'registrado'
            and not exists (select 1 from pagos a where a.anulacion_de = p.id)`,
    ]);

    const ultimo = ((vigentes ?? [])[0] as Record<string, unknown> | undefined)?.ultimo;
    const vencimiento = ultimo
      ? vencimientoTrasPeriodo(String(ultimo), diaCobro)
      : vencimientoDelPeriodo(periodo, diaCobro);
    const calculado = estadoPorFecha(vencimiento, gracia);
    const actual = String(pago.suscripcion_estado);
    const escalado = calculado === "suspendida" ||
      (calculado === "mora" && actual === "al_dia")
      ? calculado
      : actual;

    const [, estado] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`update suscripciones
          set proximo_vencimiento = ${vencimiento}::date,
              estado = ${escalado},
              actualizada = now()
          where id = ${suscripcionId}`,
      txn`update licencias
          set estado = 'suspendida'
          where proyecto_id = ${proyectoId}::uuid and estado = 'activa'
            and ${escalado === "suspendida"}`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${sesion.usuarioId}, 'admin', 'pago.anulado', 'pagos', ${pagoId},
                  ${JSON.stringify({
                    suscripcion_id: suscripcionId,
                    periodo,
                    motivo,
                    monto: Number(pago.monto),
                    moneda: String(pago.moneda),
                    vencimiento,
                    estado_anterior: actual,
                    estado_nuevo: escalado,
                  })}::jsonb,
                  ${ip}, ${agente})`,
      txn`select estado, proximo_vencimiento from suscripciones where id = ${suscripcionId}`,
    ]);

    const fila = (estado ?? [])[0] as Record<string, unknown> | undefined;
    return json({
      ok: true,
      pago_id: pagoId,
      periodo,
      suscripcion: {
        estado: fila ? String(fila.estado) : escalado,
        proximo_vencimiento: fila
          ? fechaTexto(fila.proximo_vencimiento)
          : vencimiento,
      },
    });
  } catch (error) {
    const codigo = codigoPostgres(error);
    if (codigo === "23505") {
      throw new ErrorHttp(409, "Ese pago ya fue anulado.", "ya_anulado");
    }
    throw error;
  }
});
