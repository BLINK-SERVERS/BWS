/* ============================================================
   POST /api/suscripciones/crear
   ------------------------------------------------------------
   La administración abre la suscripción de infraestructura de un
   proyecto ya contratado. Toma el plan congelado del proyecto y,
   por defecto, su precio publicado; el monto y el día de cobro se
   pueden ajustar. Junto con la suscripción nace la licencia de uso
   no exclusiva, que es lo que se suspende si se deja de pagar.

   Una suscripción por proyecto. Si ya existe, responde 409.
   ============================================================ */

import { json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";
import {
  fechaISO,
  fechaTexto,
  hoyUTC,
  numero,
  siguienteVencimiento,
} from "../_lib/suscripcion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const proyectoId = texto(cuerpo?.proyecto_id);
  if (!UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "Indica el proyecto de la suscripción.", "proyecto");
  }

  const diaCobro = numero(cuerpo?.dia_cobro);
  if (diaCobro === null || !Number.isInteger(diaCobro) || diaCobro < 1 || diaCobro > 28) {
    throw new ErrorHttp(400, "El día de cobro debe ser un entero entre 1 y 28.", "dia_cobro");
  }

  const diasGracia = cuerpo?.dias_gracia === undefined ? 5 : numero(cuerpo?.dias_gracia);
  if (diasGracia === null || !Number.isInteger(diasGracia) || diasGracia < 0 || diasGracia > 60) {
    throw new ErrorHttp(400, "Los días de gracia deben estar entre 0 y 60.", "gracia");
  }

  const moneda = texto(cuerpo?.moneda) || "USD";
  if (moneda !== "USD" && moneda !== "VES") {
    throw new ErrorHttp(400, "La moneda solo puede ser USD o VES.", "moneda");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select p.id, p.nombre, p.plan_clave, p.plan_nivel, p.plan_version,
               pi.precio_usd,
               (select s.id from suscripciones s where s.proyecto_id = p.id) as suscripcion_id,
               (select l.id from licencias l
                 where l.proyecto_id = p.id and l.tipo = 'uso'
                 order by l.creado desc limit 1) as licencia_id
        from proyectos p
        join planes_infra pi
          on pi.clave = p.plan_clave and pi.nivel = p.plan_nivel
         and pi.version = p.plan_version
        where p.id = ${proyectoId}`,
  ]);

  const proyecto = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!proyecto) {
    throw new ErrorHttp(404, "Ese proyecto no existe.", "proyecto");
  }
  if (proyecto.suscripcion_id) {
    throw new ErrorHttp(409, "Ese proyecto ya tiene una suscripción.", "suscripcion_existente");
  }

  const monto = cuerpo?.monto_usd === undefined
    ? Number(proyecto.precio_usd)
    : numero(cuerpo?.monto_usd);
  if (monto === null || !Number.isFinite(monto) || monto < 0) {
    throw new ErrorHttp(400, "El monto de la suscripción no es válido.", "monto");
  }

  const vencimiento = cuerpo?.proximo_vencimiento === undefined
    ? siguienteVencimiento(diaCobro)
    : fechaISO(texto(cuerpo?.proximo_vencimiento));
  if (!vencimiento) {
    throw new ErrorHttp(400, "El vencimiento debe ser una fecha real (AAAA-MM-DD).", "vencimiento");
  }

  const nombre = String(proyecto.nombre);
  const inicio = hoyUTC();

  try {
    const [, , , creada] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`insert into suscripciones
            (proyecto_id, plan_clave, plan_nivel, plan_version, monto_usd,
             moneda, dia_cobro, proximo_vencimiento, dias_gracia)
          values (${proyectoId}::uuid, ${String(proyecto.plan_clave)},
                  ${String(proyecto.plan_nivel)}, ${Number(proyecto.plan_version)},
                  ${monto.toFixed(2)}, ${moneda}, ${diaCobro},
                  ${vencimiento}::date, ${diasGracia})
          returning id, estado, proximo_vencimiento, dias_gracia, monto_usd, moneda`,
      txn`insert into licencias (proyecto_id, tipo, alcance, inicio, estado, condiciones)
          select ${proyectoId}::uuid, 'uso', ${`Licencia de uso no exclusiva del proyecto «${nombre}»`},
                 ${inicio}::date, 'activa',
                 ${"Sujeta al pago de la suscripción: la mora suspende el servicio y la licencia, nunca el acceso del cliente a sus datos."}
          where not exists (
            select 1 from licencias where proyecto_id = ${proyectoId}::uuid and tipo = 'uso'
          )`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle)
          select ${sesion.usuarioId}, 'admin', 'suscripcion.creada', 'suscripciones', id::text,
                 ${JSON.stringify({
                   monto_usd: monto,
                   moneda,
                   dia_cobro: diaCobro,
                   proximo_vencimiento: vencimiento,
                   plan: `${String(proyecto.plan_clave)}/${String(proyecto.plan_nivel)}/v${Number(proyecto.plan_version)}`,
                 })}::jsonb
          from suscripciones where proyecto_id = ${proyectoId}::uuid`,
      txn`select id, proyecto_id, estado, proximo_vencimiento, dias_gracia,
                 monto_usd, moneda, dia_cobro
          from suscripciones where proyecto_id = ${proyectoId}::uuid`,
    ]);

    const fila = (creada ?? [])[0] as Record<string, unknown> | undefined;
    return json(
      {
        ok: true,
        suscripcion: fila
          ? {
              id: String(fila.id),
              proyecto_id: String(fila.proyecto_id),
              estado: String(fila.estado),
              monto_usd: Number(fila.monto_usd),
              moneda: String(fila.moneda),
              dia_cobro: Number(fila.dia_cobro),
              dias_gracia: Number(fila.dias_gracia),
              proximo_vencimiento: fechaTexto(fila.proximo_vencimiento),
            }
          : null,
      },
      201,
    );
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      throw new ErrorHttp(409, "Ese proyecto ya tiene una suscripción.", "suscripcion_existente");
    }
    throw error;
  }
});
