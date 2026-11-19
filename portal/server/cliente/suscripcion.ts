/* ============================================================
   GET /api/cliente/suscripcion
   ------------------------------------------------------------
   Lo que el cliente necesita saber de su infraestructura: estado,
   próximo pago, días que faltan, licencia y pagos vigentes. No ve
   pagos anulados ni notas internas; el historial completo es de la
   administración.

   `bloqueada` resume si la licencia está suspendida o terminada:
   con ella activa se puede generar el expediente, sin ella no.
   ============================================================ */

import { json } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { proyectoOpcionalDeExpediente } from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";
import { diasEntre, estadoPorFecha, fechaTexto, hoyUTC } from "../_lib/suscripcion";

export default manejar(["GET"], async (peticion) => {
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");
  if (sesion.rol !== "cliente") {
    throw new ErrorHttp(403, "Esta sección es de los clientes del portal.", "rol");
  }

  const hoy = hoyUTC();
  const proyecto = await proyectoOpcionalDeExpediente(sesion);
  if (!proyecto) {
    return json({ ok: true, hoy, proyecto: null, suscripcion: null, pagos: [] });
  }
  const proyectoId = String(proyecto.fila.id);

  const [suscripciones, pagos] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select s.id, s.estado, s.monto_usd, s.moneda, s.dia_cobro,
               s.proximo_vencimiento, s.dias_gracia, s.creada,
               bws_contrato_mora_nuevo(s.proyecto_id) as regimen_nuevo,
               d.inicio_conocido, d.proximo, d.vencidas, d.exigibles, d.pendientes, d.irregularidades, d.principal_usd,
               d.intereses_debidos_usd, d.intereses_pagados_usd, d.intereses_regularizados,
               (select l.estado from licencias l
                 where l.proyecto_id = s.proyecto_id and l.tipo = 'uso'
                 order by l.creado desc limit 1) as licencia
        from suscripciones s
        left join lateral bws_deuda_mora(s.id, ${hoy}::date) d
          on bws_contrato_mora_nuevo(s.proyecto_id)
        where s.proyecto_id = ${proyectoId}`,
    txn`select p.id, p.periodo, p.monto, p.moneda, p.tasa_bcv, p.referencia, p.fecha
        from pagos p
        join suscripciones s on s.id = p.suscripcion_id
        where s.proyecto_id = ${proyectoId}
          and p.estado = 'registrado'
          and not exists (select 1 from pagos a where a.anulacion_de = p.id)
        order by p.fecha desc, p.creado desc`,
  ]);

  const fila = (suscripciones ?? [])[0] as Record<string, unknown> | undefined;

  let suscripcion = null;
  if (fila) {
    const nuevo = Boolean(fila.regimen_nuevo);
    const inicioConocido = nuevo && Boolean(fila.inicio_conocido);
    const vencimiento = fechaTexto(inicioConocido && fila.proximo ? fila.proximo : fila.proximo_vencimiento);
    const gracia = nuevo ? 0 : Number(fila.dias_gracia);
    const estado = String(fila.estado);
    const licencia = fila.licencia ? String(fila.licencia) : null;
    const fechaCalculada = estadoPorFecha(vencimiento, gracia, hoy, nuevo ? "nuevo" : "legacy");
    const estadoCalculado = nuevo && inicioConocido &&
      (!fila.intereses_regularizados || Number(fila.irregularidades) > 0)
      ? "mora" : fechaCalculada;
    suscripcion = {
      id: String(fila.id),
      estado,
      estado_calculado: estadoCalculado,
      regimen_mora: nuevo ? "nuevo" : "legacy",
      deuda: nuevo ? {
        inicio_conocido: inicioConocido,
        mensualidades_pendientes: inicioConocido ? Number(fila.pendientes) : null,
        mensualidades_vencidas: inicioConocido ? Number(fila.vencidas) : null,
        mensualidades_exigibles: inicioConocido ? Number(fila.exigibles) : null,
        irregularidades: inicioConocido ? Number(fila.irregularidades) : null,
        principal_usd: inicioConocido ? Number(fila.principal_usd) : null,
        intereses_debidos_usd: fila.intereses_debidos_usd === null ? null : Number(fila.intereses_debidos_usd),
        intereses_pagados_usd: fila.intereses_pagados_usd === null ? null : Number(fila.intereses_pagados_usd),
        intereses_regularizados: inicioConocido ? Boolean(fila.intereses_regularizados) : null,
        saldada: inicioConocido ? Number(fila.pendientes) === 0 && Number(fila.irregularidades) === 0 && Boolean(fila.intereses_regularizados) : null,
      } : null,
      monto_usd: Number(fila.monto_usd),
      moneda: String(fila.moneda),
      dia_cobro: Number(fila.dia_cobro),
      proximo_vencimiento: vencimiento,
      dias_gracia: gracia,
      dias_para_vencer: diasEntre(hoy, vencimiento),
      licencia,
      bloqueada: estado === "suspendida" || estado === "terminada" ||
        licencia === "suspendida" || licencia === "terminada",
    };
  }

  return json({
    ok: true,
    hoy,
    proyecto: { id: proyectoId, nombre: proyecto.vista.nombre },
    suscripcion,
    pagos: ((pagos ?? []) as Record<string, unknown>[]).map((pago) => ({
      id: String(pago.id),
      periodo: String(pago.periodo),
      monto: Number(pago.monto),
      moneda: String(pago.moneda),
      tasa_bcv: pago.tasa_bcv === null ? null : Number(pago.tasa_bcv),
      referencia: String(pago.referencia),
      fecha: fechaTexto(pago.fecha),
    })),
  });
});
