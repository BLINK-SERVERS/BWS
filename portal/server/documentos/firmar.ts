/* ============================================================
   POST /api/documentos/firmar
   ------------------------------------------------------------
   El cliente confirma el expediente generado. Su trazo se capturó
   una sola vez en el registro y sigue bloqueado; lo que se agrega
   aquí es el acto de firma de cada documento, con su sello, la IP
   y el instante UTC. Un documento ya firmado por el cliente no se
   vuelve a firmar: el segundo intento devuelve 409.

   El expediente debe estar completo del lado de Blink. Si algún
   ajuste tiene un hash distinto del original, no se confirma: el
   acto apunta al sello del original, no al archivo ajustado.

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

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  let resultado: Record<string, unknown> | undefined;
  try {
    // El bloqueo es sobre proyectos: bws_app no puede actualizar documentos.
    // Ajustar toma el mismo bloqueo. La segunda consulta, en READ COMMITTED,
    // ve lo confirmado mientras esperaba, antes de insertar cualquier acto.
    const [, bloqueo, filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`select set_config('app.expediente_bloqueado', '', true)`,
      txn`with bloqueado as materialized (
            select p.id from proyectos p
            where p.id = ${proyectoId}::uuid
            for no key update of p
          )
          select id, set_config('app.expediente_bloqueado', id::text, true) from bloqueado`,
      txn`with docs as materialized (
            select d.id, d.sello,
                   exists (select 1 from actos_firma a
                           where a.documento_id = d.id and a.firmante = 'representante') as representante,
                   exists (select 1 from actos_firma a
                           where a.documento_id = d.id and a.firmante = 'cliente') as cliente
            from documentos d
            join proyectos p on p.id = d.proyecto_id
            where p.id = ${proyectoId}::uuid
              and current_setting('app.expediente_bloqueado', true) = p.id::text
          ), estado as (
            select count(*)::int as documentos,
                   count(*) filter (where representante)::int as representantes,
                   count(*) filter (where cliente)::int as clientes,
                   exists (
                     select 1 from documentos_ajustados aj
                     join documentos d on d.id = aj.documento_id
                     where d.proyecto_id = ${proyectoId}::uuid
                       and aj.sha256_ajustado is distinct from d.hash_archivo
                   ) as ajuste_distinto,
                   current_setting('transaction_isolation') = 'read committed' as aislamiento_seguro
            from docs
          ), nuevos as (
            insert into actos_firma (documento_id, firmante, firma_id, sello, ip, agente, utc)
            select d.id, 'cliente', ${firma.id}::uuid, d.sello, ${ip}::inet, ${agente}::text, now()
            from docs d cross join estado e
            where e.aislamiento_seguro and not e.ajuste_distinto
              and e.documentos > 0 and e.representantes = e.documentos
              and not d.cliente
            returning documento_id
          ), evento as (
            insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
            select ${sesion.usuarioId}::uuid, 'cliente', 'expediente.firmado', 'proyectos',
                   ${proyectoId}::text, jsonb_build_object('actos', count(*)), ${ip}::inet, ${agente}::text
            from nuevos
            having count(*) > 0
            returning 1
          ), aprobado as (
            update proyectos p set estado = 'aprobado'
            from estado e
            where p.id = ${proyectoId}::uuid
              and p.estado in ('enviado', 'en_revision')
              and (select count(*) from nuevos) > 0
              and e.clientes + (select count(*) from nuevos) = e.documentos
            returning p.id
          )
          select e.*, (select count(*)::int from nuevos) as actos from estado e`,
    ]);
    if (!(bloqueo ?? []).length) {
      throw new ErrorHttp(404, "No se encontró el proyecto del expediente.", "sin_proyecto");
    }
    resultado = (filas ?? [])[0];
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

  if (!resultado?.aislamiento_seguro) {
    throw new ErrorHttp(503, "No se pudo comprobar el expediente de forma segura. Inténtalo de nuevo.", "aislamiento");
  }
  const documentos = Number(resultado.documentos);
  const cliente = Number(resultado.clientes);
  const firmados = Number(resultado.actos);
  if (!documentos) {
    throw new ErrorHttp(
      409,
      "Todavía no hay un expediente asignado. Blink lo prepara al revisar el proyecto.",
      "sin_expediente",
    );
  }
  if (resultado.ajuste_distinto) {
    throw new ErrorHttp(
      409,
      "El expediente contiene un PDF ajustado distinto del original. No se puede confirmar: contacta a Blink para revisar el expediente.",
      "expediente_ajustado",
    );
  }
  if (Number(resultado.representantes) < documentos) {
    throw new ErrorHttp(
      409,
      "El expediente todavía no está firmado por el representante de Blink.",
      "expediente_incompleto",
    );
  }
  if (!firmados) {
    throw new ErrorHttp(
      409,
      "Ya firmaste este expediente. Los actos de firma no se repiten.",
      "expediente_firmado",
    );
  }

  let envio: "enviado" | "pendiente" = "pendiente";
  if (cliente + firmados >= documentos) {
    try {
      const resultado = await enviarExpediente(sesion, proyectoId, ip, agente);
      envio = resultado.ok ? "enviado" : "pendiente";
    } catch {
      // La confirmación ya quedó asentada: el reenvío es del panel de administración.
    }
  }

  return json({ ok: true, actos: firmados, documentos, envio });
});
