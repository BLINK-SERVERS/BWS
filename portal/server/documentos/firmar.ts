/* ============================================================
   POST /api/documentos/firmar
   ------------------------------------------------------------
   El cliente confirma el expediente generado. Su trazo se capturó
   una sola vez en el registro y sigue bloqueado; lo que se agrega
   aquí es el acto de firma de cada documento, con su sello, la IP
   y el instante UTC. Un documento ya firmado por el cliente no se
   vuelve a firmar: el segundo intento devuelve 409.

   El expediente debe estar completo del lado de Blink: sin los
   actos del representante no hay nada que el cliente pueda
   aceptar.
   ============================================================ */

import { agenteDe, ipDe, json } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import {
  firmaDeExpediente,
  proyectoDeExpediente,
} from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");
  if (sesion.rol !== "cliente") {
    throw new ErrorHttp(403, "Esta sección es para clientes.", "rol");
  }
  if (!sesion.verificado) {
    throw new ErrorHttp(403, "Confirma tu correo antes de firmar el expediente.", "verificar_correo");
  }

  const proyecto = await proyectoDeExpediente(sesion);
  const proyectoId = String(proyecto.fila.id);
  const clienteId = String(proyecto.fila.cliente_id);
  const firma = await firmaDeExpediente(sesion, clienteId);

  const [documentos, actos] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select d.id, d.sello
        from documentos d
        join proyectos p on p.id = d.proyecto_id
        join clientes c on c.id = p.cliente_id
        where c.usuario_id = ${sesion.usuarioId}
        order by d.orden`,
    txn`select a.documento_id, a.firmante
        from actos_firma a
        join documentos d on d.id = a.documento_id
        join proyectos p on p.id = d.proyecto_id
        join clientes c on c.id = p.cliente_id
        where c.usuario_id = ${sesion.usuarioId}`,
  ]);

  const docs = (documentos ?? []) as Record<string, unknown>[];
  if (!docs.length) {
    throw new ErrorHttp(
      409,
      "Todavía no hay un expediente generado. La administración lo genera cuando revisa el proyecto.",
      "sin_expediente",
    );
  }

  const filasActos = (actos ?? []) as Record<string, unknown>[];
  const representante = filasActos.filter((a) => a.firmante === "representante").length;
  const cliente = filasActos.filter((a) => a.firmante === "cliente").length;

  if (representante < docs.length) {
    throw new ErrorHttp(
      409,
      "El expediente todavía no está firmado por el representante de Blink.",
      "expediente_incompleto",
    );
  }
  if (cliente >= docs.length) {
    throw new ErrorHttp(
      409,
      "Ya firmaste este expediente. Los actos de firma no se repiten.",
      "expediente_firmado",
    );
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  let firmados = 0;
  try {
    const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`with nuevos as (
            insert into actos_firma (documento_id, firmante, firma_id, sello, ip, agente, utc)
            select d.id, 'cliente', ${firma.id}::uuid, d.sello, ${ip}, ${agente}, now()
            from documentos d
            join proyectos p on p.id = d.proyecto_id
            join clientes c on c.id = p.cliente_id
            where c.usuario_id = ${sesion.usuarioId}
              and not exists (
                select 1 from actos_firma a
                where a.documento_id = d.id and a.firmante = 'cliente'
              )
            returning documento_id
          ), evento as (
            insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
            select ${sesion.usuarioId}, 'cliente', 'expediente.firmado', 'proyectos',
                   ${proyectoId},
                   jsonb_build_object('actos', count(*)),
                   ${ip}, ${agente}
            from nuevos
            returning 1
          )
          select count(*)::int as actos from nuevos`,
    ]);
    firmados = Number((filas ?? [])[0]?.actos ?? 0);
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      throw new ErrorHttp(
        409,
        "Ya firmaste este expediente. Los actos de firma no se repiten.",
        "expediente_firmado",
      );
    }
    throw error;
  }

  if (!firmados) {
    throw new ErrorHttp(
      409,
      "Ya firmaste este expediente. Los actos de firma no se repiten.",
      "expediente_firmado",
    );
  }

  return json({ ok: true, actos: firmados, documentos: docs.length });
});
