/* ============================================================
   POST /api/documentos/enviar
   ------------------------------------------------------------
   La administración envía el expediente completo al cliente con
   los ocho PDF adjuntos y una copia a Blink. Solo se envía cuando
   las dos firmas están registradas en los ocho documentos.

   Cada documento lleva su clave de idempotencia con el hash del
   archivo: reintentar el envío no duplica correos ni filas. El
   evento queda con el mensaje del proveedor y el hash final de la
   cadena.
   ============================================================ */

import { correoNormalizado } from "../../legal/identidad";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { enviarCorreo } from "../_lib/correo";
import { sitio } from "../_lib/cuenta";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DocumentoEnvio {
  id: string;
  codigo: string;
  version: number;
  orden: number;
  titulo: string;
  pdf: Uint8Array;
  hash_archivo: string;
  hash_cadena: string;
}

function copiaDeNegocio(): string[] {
  const crudo = process.env.CORREO_COPIA ?? "business@blink.com.ve";
  return crudo
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
}

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const proyectoId = texto(cuerpo?.proyecto_id);
  if (!UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "Falta el proyecto del expediente.", "proyecto");
  }

  const [proyecto, documentos, actos, envios, licencia] = await enTransaccion(
    sesion.usuarioId,
    sesion.rol,
    (txn) => [
      txn`select p.id, p.nombre, p.estado, c.razon_social, u.correo, u.nombre as contacto
          from proyectos p
          join clientes c on c.id = p.cliente_id
          join usuarios u on u.id = c.usuario_id
          where p.id = ${proyectoId}`,
      txn`select d.id, d.plantilla_codigo, d.plantilla_version, d.orden, d.pdf,
                 d.hash_archivo, d.hash_cadena, p.contenido->>'titulo' as titulo
          from documentos d
          join plantillas p on p.codigo = d.plantilla_codigo and p.version = d.plantilla_version
          where d.proyecto_id = ${proyectoId}
          order by d.orden`,
      txn`select count(*)::int as total,
                 count(*) filter (where a.firmante = 'cliente')::int as cliente,
                 count(*) filter (where a.firmante = 'representante')::int as representante
          from actos_firma a
          join documentos d on d.id = a.documento_id
          where d.proyecto_id = ${proyectoId}`,
      txn`select clave_idempotencia, mensaje_id, utc
          from envios
          where clave_idempotencia like ${`expediente/${proyectoId}/%`}
          order by utc`,
      txn`select estado from licencias
          where proyecto_id = ${proyectoId}
          order by creado desc
          limit 1`,
    ],
  );

  const filaProyecto = (proyecto ?? [])[0] as Record<string, unknown> | undefined;
  if (!filaProyecto) {
    throw new ErrorHttp(404, "Ese proyecto no existe.", "proyecto");
  }

  const docs = ((documentos ?? []) as Record<string, unknown>[]).map((fila) => ({
    id: String(fila.id),
    codigo: String(fila.plantilla_codigo),
    version: Number(fila.plantilla_version),
    orden: Number(fila.orden),
    titulo: String(fila.titulo),
    pdf: fila.pdf as Uint8Array,
    hash_archivo: String(fila.hash_archivo),
    hash_cadena: String(fila.hash_cadena),
  })) satisfies DocumentoEnvio[];

  if (!docs.length) {
    throw new ErrorHttp(
      409,
      "Todavía no hay un expediente generado. Genéralo antes de enviarlo.",
      "sin_expediente",
    );
  }

  const conteo = ((actos ?? [])[0] ?? {}) as Record<string, unknown>;
  if (Number(conteo.cliente) !== docs.length || Number(conteo.representante) !== docs.length) {
    throw new ErrorHttp(
      409,
      "El expediente todavía no tiene las dos firmas en todos los documentos.",
      "expediente_incompleto",
    );
  }

  const yaEnviados = ((envios ?? []) as Record<string, unknown>[]).length;
  if (yaEnviados >= docs.length) {
    return json({
      ok: true,
      reutilizado: true,
      enviados: docs.length,
      mensaje_id: envios?.[0]?.mensaje_id ?? null,
    });
  }

  const estadoLicencia = String(
    ((licencia ?? [])[0] as Record<string, unknown> | undefined)?.estado ?? "",
  );
  if (estadoLicencia === "suspendida" || estadoLicencia === "terminada") {
    throw new ErrorHttp(
      409,
      "La licencia del proyecto no está activa. Regulariza la suscripción antes de enviar el expediente.",
      "licencia_suspendida",
    );
  }

  const contacto = String(filaProyecto.contacto || filaProyecto.razon_social);
  const correoDestino = correoNormalizado(filaProyecto.correo);
  if (!correoDestino) {
    throw new ErrorHttp(409, "La cuenta no tiene un correo válido.", "correo");
  }

  const final = docs.at(-1)?.hash_cadena ?? "";
  const enlacePortal = `${sitio()}/#/panel`;
  const adjuntos = docs.map((doc) => ({
    nombre: `${doc.codigo}-v${doc.version}.pdf`,
    contenido: doc.pdf,
  }));

  let envio;
  try {
    envio = await enviarCorreo({
      para: correoDestino,
      copia: copiaDeNegocio(),
      asunto: `Expediente firmado — ${String(filaProyecto.razon_social)}`,
      texto: [
        `Hola, ${contacto}.`,
        "",
        `El expediente del proyecto «${String(filaProyecto.nombre)}» quedó firmado por las dos partes. Adjuntamos los ${docs.length} documentos en PDF:`,
        "",
        ...docs.map(
          (doc) => `· ${doc.codigo} — ${doc.titulo} (v${doc.version}) · ${doc.hash_archivo.slice(0, 16)}…`,
        ),
        "",
        `Hash final de la cadena: ${final}`,
        "",
        "La firma es electrónica simple, no certificada, con evidencia reforzada: trazo, fecha y hora en UTC, IP, agente y sello de contenido SHA-256. El PDF no es modificable dentro del sistema y cualquier alteración del archivo se detecta al compararlo con el hash guardado.",
        "",
        `Puedes descargar el expediente y consultar su verificación desde tu panel: ${enlacePortal}`,
        "",
        "Blink Web Services",
      ].join("\n"),
      adjuntos,
    });
  } catch (error) {
    throw new ErrorHttp(
      502,
      `No pudimos enviar el correo: ${error instanceof Error ? error.message : "error desconocido"}`,
      "correo",
    );
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  try {
    await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      ...docs.map(
        (doc) =>
          txn`insert into envios
                (documento_id, proveedor, mensaje_id, clave_idempotencia, estado, utc)
              values (${doc.id}::uuid, ${envio.proveedor}, ${envio.id},
                      ${`expediente/${proyectoId}/${doc.codigo}/v${doc.version}/${doc.hash_archivo}`},
                      'enviado', now())
              on conflict (clave_idempotencia) do nothing`,
      ),
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${sesion.usuarioId}, 'admin', 'expediente.enviado', 'proyectos',
                  ${proyectoId},
                  ${JSON.stringify({
                    documentos: docs.length,
                    correo: correoDestino,
                    copia: copiaDeNegocio(),
                    mensaje_id: envio.id,
                    proveedor: envio.proveedor,
                    hash_final: final,
                  })}::jsonb,
                  ${ip}, ${agente})`,
    ]);
  } catch (error) {
    throw new ErrorHttp(
      502,
      `El correo salió, pero no pudimos registrar el envío: ${error instanceof Error ? error.message : "error desconocido"}`,
      "envio",
    );
  }

  return json({
    ok: true,
    reutilizado: false,
    enviados: docs.length,
    mensaje_id: envio.id,
    proveedor: envio.proveedor,
    hash_final: final,
    documentos: docs.map((doc) => doc.codigo),
  });
});
