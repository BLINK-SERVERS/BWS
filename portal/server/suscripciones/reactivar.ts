/* ============================================================
   POST /api/suscripciones/reactivar
   ------------------------------------------------------------
   El régimen histórico conserva su reactivación manual y aviso.
   En el nuevo, un vencimiento inicial desconocido se acredita primero
   con fundamento; luego se registran intereses debidos y pagados, con
   su soporte. Solo se abre sin cuotas omitidas ni intereses pendientes.
   Ambas operaciones nuevas dejan rastro y no inventan una tasa.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import { estadoPorFecha, fechaISO, fechaTexto, hoyUTC, interesesValidos, numero } from "../_lib/suscripcion";

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
               s.vencimiento_inicial_mora, bws_contrato_mora_nuevo(s.proyecto_id) as regimen_nuevo,
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

  if (suscripcion.regimen_nuevo) {
    const fundamento = texto(cuerpo?.fundamento_intereses) || texto(cuerpo?.motivo);
    if (fundamento.length < 5 || fundamento.length > 500) {
      throw new ErrorHttp(400, "Indica el fundamento documental de la regularización (5 a 500 caracteres).", "fundamento");
    }
    const inicio = cuerpo?.vencimiento_inicial === undefined ? null : fechaISO(texto(cuerpo.vencimiento_inicial));
    if (!suscripcion.vencimiento_inicial_mora && (!inicio || inicio < "2020-01-01" || inicio > "2100-12-31")) {
      throw new ErrorHttp(400, "Indica el primer vencimiento acreditado (2020 a 2100).", "inicio_mora");
    }
    const debidos = cuerpo?.intereses_debidos_usd === undefined ? null : numero(cuerpo.intereses_debidos_usd);
    const pagados = cuerpo?.intereses_pagados_usd === undefined ? null : numero(cuerpo.intereses_pagados_usd);
    if (suscripcion.vencimiento_inicial_mora && !interesesValidos(debidos, pagados)) {
      throw new ErrorHttp(400, "Indica los intereses debidos y pagados en USD, con hasta dos decimales; no se presume una tasa.", "intereses");
    }
    try {
      const [filasRegularizacion] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
        txn`select * from bws_regularizar_mora(${suscripcionId}::uuid, ${inicio}::date,
              ${debidos}::numeric, ${pagados}::numeric, ${fundamento}, ${hoyUTC()}::date,
              ${ipDe(peticion)}::inet, ${agenteDe(peticion)})`,
      ]);
      const resultado = filasRegularizacion[0];
      return json({
        ok: true, cambiado: Boolean(resultado.reactivada), inicio_registrado: Boolean(resultado.inicio_registrado),
        estado: String(resultado.estado_actual),
        proximo_vencimiento: resultado.proximo ? fechaTexto(resultado.proximo) : null,
        mensualidades_pendientes: Number(resultado.pendientes), irregularidades: Number(resultado.irregularidades),
        principal_usd: Number(resultado.principal_usd),
        intereses_debidos_usd: resultado.intereses_debidos_usd === null ? null : Number(resultado.intereses_debidos_usd),
        intereses_pagados_usd: resultado.intereses_pagados_usd === null ? null : Number(resultado.intereses_pagados_usd),
        aviso: resultado.inicio_registrado
          ? "Inicio registrado; registra los pagos y revisa los intereses antes de reactivar."
          : resultado.reactivada ? null : "La revisión quedó registrada; hay mensualidades o intereses pendientes.",
      });
    } catch (error) {
      if (codigoPostgres(error) === "P0001") {
        throw new ErrorHttp(409, "No se pudo regularizar: verifica el estado y los antecedentes del primer vencimiento.", "regularizacion_mora");
      }
      throw error;
    }
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

  const [, cambio] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select id from suscripciones where id = ${suscripcionId} for update`,
    txn`update suscripciones
        set estado = 'al_dia', actualizada = now()
        where id = ${suscripcionId} and estado <> 'terminada'
          and not bws_contrato_mora_nuevo(proyecto_id) returning id`,
    txn`update licencias
        set estado = 'activa'
        where proyecto_id = ${proyectoId}::uuid and estado = 'suspendida'
          and exists (select 1 from suscripciones s where s.id = ${suscripcionId}::uuid
                      and s.estado = 'al_dia' and not bws_contrato_mora_nuevo(s.proyecto_id))`,
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
        select ${sesion.usuarioId}::uuid, 'admin', 'suscripcion.reactivada', 'suscripciones',
                ${suscripcionId},
                ${JSON.stringify({ motivo, estado_anterior: anterior, aviso })}::jsonb,
                ${ip}::inet, ${agente}::text
        where exists (select 1 from suscripciones s where s.id = ${suscripcionId}::uuid
                      and s.estado = 'al_dia' and not bws_contrato_mora_nuevo(s.proyecto_id))`,
  ]);
  if (!cambio.length) throw new ErrorHttp(409, "La suscripción cambió; vuelve a intentar la reactivación.", "suscripcion_cambiada");

  return json({ ok: true, cambiado: true, estado: "al_dia", anterior, aviso });
});
