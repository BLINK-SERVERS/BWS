/* ============================================================
   Envío del expediente por correo
   ------------------------------------------------------------
   Lo dispara la confirmación del cliente en `/api/documentos/firmar`
   y, como reintento, la administración desde `/api/documentos/enviar`.
   Solo sale cuando las dos firmas están en los ocho documentos.

   Cada documento lleva su clave de idempotencia con el hash del
   archivo que se adjunta: reintentar el envío no duplica correos ni
   filas, y un documento ajustado a mano después de un envío sale en
   un correo nuevo porque su hash cambió. El evento queda con el
   mensaje del proveedor y el hash final de la cadena.

   Cuando Blink ajustó algún PDF a mano, el correo lo dice y adjunta
   el archivo ajustado: el sello y la cadena siguen siendo los del
   generado, que es el que se verificó.
   ============================================================ */

import { correoNormalizado } from "../../legal/identidad";
import { enTransaccion } from "./db";
import { enviarCorreo } from "./correo";
import { sitio } from "./cuenta";
import { ErrorHttp } from "./respuestas";
import type { Sesion } from "./sesion";

interface DocumentoEnvio {
  id: string;
  codigo: string;
  version: number;
  orden: number;
  titulo: string;
  pdf: Uint8Array;
  hash_archivo: string;
  hash_cadena: string;
  ajustado: boolean;
}

export interface ResultadoEnvio {
  ok: true;
  reutilizado: boolean;
  enviados: number;
  mensaje_id: string | null;
  proveedor?: string;
  hash_final?: string;
  documentos?: string[];
}

function copiaDeNegocio(): string[] {
  const crudo = process.env.CORREO_COPIA ?? "business@blink.com.ve";
  return crudo
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
}

function claveDeEnvio(proyectoId: string, doc: DocumentoEnvio): string {
  return `expediente/${proyectoId}/${doc.codigo}/v${doc.version}/${doc.hash_archivo}`;
}

export async function enviarExpediente(
  sesion: Sesion,
  proyectoId: string,
  ip: string | null,
  agente: string | null,
): Promise<ResultadoEnvio> {
  const [proyecto, documentos, actos, envios, licencia] = await enTransaccion(
    sesion.usuarioId,
    sesion.rol,
    (txn) => [
      txn`select p.id, p.nombre, p.estado, c.razon_social, u.correo, u.nombre as contacto
          from proyectos p
          join clientes c on c.id = p.cliente_id
          join usuarios u on u.id = c.usuario_id
          where p.id = ${proyectoId}`,
      txn`select d.id, d.plantilla_codigo, d.plantilla_version, d.orden, d.hash_archivo,
                 d.hash_cadena, p.contenido->>'titulo' as titulo,
                 coalesce(a.pdf, d.pdf) as pdf,
                 coalesce(a.sha256_ajustado, d.hash_archivo) as hash_servido,
                 a.sha256_ajustado is not null as ajustado
          from documentos d
          join plantillas p on p.codigo = d.plantilla_codigo and p.version = d.plantilla_version
          left join lateral (
            select aj.pdf, aj.sha256_ajustado
            from documentos_ajustados aj
            where aj.documento_id = d.id
            order by aj.utc desc, aj.id
            limit 1
          ) a on true
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
    hash_archivo: String(fila.hash_servido),
    hash_cadena: String(fila.hash_cadena),
    ajustado: Boolean(fila.ajustado),
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

  // Se compara el archivo que saldría hoy, no solo cuántos salieron:
  // un ajuste posterior cambia el hash y merece un correo nuevo.
  const salidas = new Set(
    ((envios ?? []) as Record<string, unknown>[]).map((fila) => String(fila.clave_idempotencia)),
  );
  if (docs.every((doc) => salidas.has(claveDeEnvio(proyectoId, doc)))) {
    // Las filas de `envios` prueban que el correo salió: se pone al día la
    // etapa por si el envío es anterior a este control.
    await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      txn`update proyectos
              set estado = 'entregado'
            where id = ${proyectoId}::uuid
              and estado in ('enviado', 'en_revision', 'aprobado')`,
    ]);
    return {
      ok: true,
      reutilizado: true,
      enviados: docs.length,
      mensaje_id: (envios?.[0]?.mensaje_id as string | undefined) ?? null,
    };
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
  const enlacePortal = `${sitio()}/panel`;
  const ajustados = docs.filter((doc) => doc.ajustado);
  const adjuntos = docs.map((doc) => ({
    nombre: `${doc.codigo}-v${doc.version}${doc.ajustado ? "-ajustado" : ""}.pdf`,
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
          (doc) =>
            `· ${doc.codigo} — ${doc.titulo} (v${doc.version}) · ${doc.hash_archivo.slice(0, 16)}…${
              doc.ajustado ? " · ajustado a mano por Blink" : ""
            }`,
        ),
        "",
        `Hash final de la cadena: ${final}`,
        "",
        "La firma es electrónica simple, no certificada, con evidencia reforzada: trazo, fecha y hora en UTC, IP, agente y sello de contenido SHA-256. El PDF no es modificable dentro del sistema y cualquier alteración del archivo se detecta al compararlo con el hash guardado.",
        ...(ajustados.length
          ? [
              "",
              `${ajustados.length} de los ${docs.length} documentos fueron revisados y ajustados a mano por Blink antes de este envío; el adjunto marcado «ajustado» es el archivo que recibes. Su sello de contenido y su eslabón de cadena son los del documento generado, que es el que aparece en la verificación del portal; el hash informado arriba corresponde al adjunto.`,
            ]
          : []),
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

  try {
    await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      ...docs.map(
        (doc) =>
          txn`insert into envios
                (documento_id, proveedor, mensaje_id, clave_idempotencia, estado, utc)
              values (${doc.id}::uuid, ${envio.proveedor}, ${envio.id},
                      ${claveDeEnvio(proyectoId, doc)},
                      'enviado', now())
              on conflict (clave_idempotencia) do nothing`,
      ),
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${sesion.usuarioId}, ${sesion.rol}, 'expediente.enviado', 'proyectos',
                  ${proyectoId},
                  ${JSON.stringify({
                    documentos: docs.length,
                    ajustados: ajustados.length,
                    correo: correoDestino,
                    copia: copiaDeNegocio(),
                    mensaje_id: envio.id,
                    proveedor: envio.proveedor,
                    hash_final: final,
                  })}::jsonb,
                  ${ip}, ${agente})`,
      // El correo salió: el expediente queda entregado. El disparador de
      // congelamiento solo prohíbe volver a borrador, así que avanzar la
      // etapa está permitido.
      txn`update proyectos
              set estado = 'entregado'
            where id = ${proyectoId}::uuid
              and estado in ('enviado', 'en_revision', 'aprobado')`,
    ]);
  } catch (error) {
    throw new ErrorHttp(
      502,
      `El correo salió, pero no pudimos registrar el envío: ${error instanceof Error ? error.message : "error desconocido"}`,
      "envio",
    );
  }

  return {
    ok: true,
    reutilizado: false,
    enviados: docs.length,
    mensaje_id: envio.id,
    proveedor: envio.proveedor,
    hash_final: final,
    documentos: docs.map((doc) => doc.codigo),
  };
}
