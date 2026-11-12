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
               (select l.estado from licencias l
                 where l.proyecto_id = s.proyecto_id and l.tipo = 'uso'
                 order by l.creado desc limit 1) as licencia
        from suscripciones s
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
    const vencimiento = fechaTexto(fila.proximo_vencimiento);
    const gracia = Number(fila.dias_gracia);
    const estado = String(fila.estado);
    const licencia = fila.licencia ? String(fila.licencia) : null;
    suscripcion = {
      id: String(fila.id),
      estado,
      estado_calculado: estadoPorFecha(vencimiento, gracia, hoy),
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
