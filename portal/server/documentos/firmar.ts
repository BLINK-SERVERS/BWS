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

   Cuando la confirmación completa las dos firmas, el correo con
   los ocho PDF sale de aquí mismo. Si ese envío falla, la
   confirmación ya quedó registrada y la administración puede
   reintentarlo desde `/api/documentos/enviar`.
   ============================================================ */

import { agenteDe, ipDe, json } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { enviarExpediente } from "../_lib/envio-expediente";
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

  // Todo se acota al proyecto que se está confirmando: una cuenta puede
  // tener más de un proyecto, y firmar el de al lado no vale.
  const [documentos, actos] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select d.id, d.sello
        from documentos d
        where d.proyecto_id = ${proyectoId}::uuid
        order by d.orden`,
    txn`select a.documento_id, a.firmante
        from actos_firma a
        join documentos d on d.id = a.documento_id
        where d.proyecto_id = ${proyectoId}::uuid`,
  ]);

  const docs = (documentos ?? []) as Record<string, unknown>[];
  if (!docs.length) {
    throw new ErrorHttp(
      409,
      "Todavía no hay un expediente asignado. Blink lo prepara al revisar el proyecto.",
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
            where d.proyecto_id = ${proyectoId}::uuid
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
            having count(*) > 0
            returning 1
          )
          select count(*)::int as actos from nuevos`,
      // Confirmados todos los documentos, el expediente queda aprobado
      // aunque el correo falle: ahí está la diferencia entre «el cliente
      // dijo sí» y «Blink ya lo envió».
      txn`update proyectos p
              set estado = 'aprobado'
            where p.id = ${proyectoId}::uuid
              and p.estado in ('enviado', 'en_revision')
              and exists (select 1 from documentos d where d.proyecto_id = p.id)
              and not exists (
                select 1 from documentos d
                where d.proyecto_id = p.id
                  and not exists (
                    select 1 from actos_firma a
                    where a.documento_id = d.id and a.firmante = 'cliente'
                  )
              )`,
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

  let envio: "enviado" | "pendiente" = "pendiente";
  if (cliente + firmados >= docs.length) {
    try {
      const resultado = await enviarExpediente(sesion, proyectoId, ip, agente);
      envio = resultado.ok ? "enviado" : "pendiente";
    } catch {
      // La confirmación ya quedó asentada: el reenvío es del panel de administración.
    }
  }

  return json({ ok: true, actos: firmados, documentos: docs.length, envio });
});
