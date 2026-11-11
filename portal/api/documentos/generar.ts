/* ============================================================
   POST /api/documentos/generar
   ------------------------------------------------------------
   La administración genera el expediente de un proyecto enviado.
   Los ocho documentos se sellan y se encadenan en el orden de
   firma; cada PDF lleva las dos firmas estampadas y una página de
   evidencia con su sello, su hash y su eslabón de cadena.

   El sello se calcula sobre los datos y las firmas, no sobre los
   bytes del PDF: el hash del archivo se guarda aparte. Generar dos
   veces el mismo expediente no lo duplica: si ya existe, se
   devuelve el resumen guardado.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { DOCUMENTOS } from "../../legal";
import type { DocumentoLegal } from "../../legal/tipos";
import { resolver } from "../../legal/validar";
import { hashCadena, hashPlantilla, selloDeContenido, sha256Hex } from "../../render/hash";
import { generarPDF } from "../../render/pdf";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import {
  clienteDeExpediente,
  datosDeExpediente,
  firmaDeExpediente,
  firmasDeExpediente,
  proyectoDeExpediente,
  representanteDeExpediente,
} from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion, type Sesion } from "../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DocumentoGuardado {
  codigo: string;
  orden: number;
  sello: string;
  hash_archivo: string;
  hash_anterior: string;
  hash_cadena: string;
  estado: string;
}

async function resumenGuardado(sesion: Sesion, proyectoId: string): Promise<DocumentoGuardado[]> {
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select plantilla_codigo, orden, sello, hash_archivo, hash_anterior, hash_cadena, estado
        from documentos
        where proyecto_id = ${proyectoId}
        order by orden`,
  ]);
  return ((filas ?? []) as Record<string, unknown>[]).map((fila) => ({
    codigo: String(fila.plantilla_codigo),
    orden: Number(fila.orden),
    sello: String(fila.sello),
    hash_archivo: String(fila.hash_archivo),
    hash_anterior: String(fila.hash_anterior),
    hash_cadena: String(fila.hash_cadena),
    estado: String(fila.estado),
  }));
}

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const proyectoId = texto(cuerpo?.proyecto_id);
  if (!UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "Falta el proyecto del expediente.", "proyecto");
  }

  const proyecto = await proyectoDeExpediente(sesion, proyectoId);

  const [estados] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select
          (select estado from suscripciones where proyecto_id = ${proyectoId}) as suscripcion,
          (select estado from licencias
            where proyecto_id = ${proyectoId} and tipo = 'uso'
            order by creado desc limit 1) as licencia`,
  ]);
  const estado = ((estados ?? [])[0] ?? {}) as Record<string, unknown>;
  const sinServicio = ["suspendida", "terminada"];
  if (
    sinServicio.includes(String(estado.suscripcion ?? "")) ||
    sinServicio.includes(String(estado.licencia ?? ""))
  ) {
    throw new ErrorHttp(
      403,
      "La licencia del proyecto está suspendida. Regulariza la suscripción antes de generar el expediente.",
      "licencia_suspendida",
    );
  }

  const existentes = await resumenGuardado(sesion, proyectoId);
  if (existentes.length) {
    return json({ ok: true, reutilizado: true, documentos: existentes });
  }

  if (proyecto.vista.estado !== "enviado") {
    throw new ErrorHttp(
      409,
      "El proyecto todavía no fue enviado por el cliente. El expediente se genera sobre el alcance congelado.",
      "proyecto_no_enviado",
    );
  }

  const clienteId = String(proyecto.fila.cliente_id);
  const cliente = await clienteDeExpediente(sesion, clienteId);
  if (!cliente.verificado) {
    throw new ErrorHttp(
      409,
      "El correo del cliente no está confirmado. No se genera un contrato con una cuenta sin verificar.",
      "sin_verificar",
    );
  }

  const firma = await firmaDeExpediente(sesion, clienteId);
  const representante = await representanteDeExpediente(sesion);

  const [plantillas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select codigo, version, sha256 from plantillas where activa`,
  ]);
  const publicadas = new Map(
    ((plantillas ?? []) as Record<string, unknown>[]).map((fila) => [
      String(fila.codigo),
      { version: Number(fila.version), sha256: String(fila.sha256) },
    ]),
  );

  const desactualizadas = DOCUMENTOS.filter((doc: DocumentoLegal) => {
    const fila = publicadas.get(doc.codigo);
    return !fila || fila.version !== Number.parseInt(doc.version, 10) ||
      fila.sha256 !== hashPlantilla(doc);
  });
  if (desactualizadas.length) {
    throw new ErrorHttp(
      503,
      "Las plantillas publicadas no coinciden con el código. Un administrador debe publicarlas antes de generar.",
      "plantillas",
    );
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  const utc = new Date().toISOString();
  const fecha = new Date(utc);
  const datos = datosDeExpediente({ cliente, representante, proyecto, fecha });
  const firmas = firmasDeExpediente({ cliente, firma, representante, ip, agente });

  const generados: {
    id: string;
    doc: DocumentoLegal;
    version: number;
    orden: number;
    pdf: Uint8Array;
    sello: string;
    hashArchivo: string;
    hashAnterior: string;
    hashCadena: string;
  }[] = [];

  let hashAnterior = "GENESIS";
  for (const doc of DOCUMENTOS) {
    const orden = generados.length + 1;
    const resuelto = resolver(doc, datos);
    const sello = selloDeContenido({
      doc,
      datos,
      firmas: [firmas.representante, firmas.cliente],
      utc,
    });
    const eslabon = hashCadena(hashAnterior, sello, orden);
    const pdf = await generarPDF({
      doc: resuelto,
      datos,
      firmas,
      evidencia: {
        sello,
        hashPlantilla: hashPlantilla(doc),
        hashCadena: eslabon,
        hashAnterior,
        orden,
        utc,
        ip: ip ?? undefined,
        agente: agente ?? undefined,
      },
      fechaCreacion: fecha,
    });
    generados.push({
      id: randomUUID(),
      doc,
      version: Number.parseInt(doc.version, 10),
      orden,
      pdf,
      sello,
      hashArchivo: sha256Hex(pdf),
      hashAnterior,
      hashCadena: eslabon,
    });
    hashAnterior = eslabon;
  }

  // El cliente aún no confirmó: el PDF ya es final y el acto del
  // representante se registra aquí. El acto del cliente lo agrega
  // `firmar.ts` cuando confirma el expediente.
  try {
    await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
      ...generados.map((g) =>
        txn`insert into documentos
              (id, proyecto_id, plantilla_codigo, plantilla_version, orden, pdf, sello,
               hash_archivo, hash_anterior, hash_cadena, estado, firmado, utc_sello)
            values (${g.id}::uuid, ${proyectoId}::uuid, ${g.doc.codigo}, ${g.version},
                    ${g.orden}, ${g.pdf}, ${g.sello}, ${g.hashArchivo}, ${g.hashAnterior},
                    ${g.hashCadena}, 'firmado', ${utc}::timestamptz, ${utc}::timestamptz)`,
      ),
      ...generados.map((g) =>
        txn`insert into actos_firma
              (documento_id, firmante, representante_id, sello, ip, agente, utc)
            values (${g.id}::uuid, 'representante', ${representante.id}::uuid,
                    ${g.sello}, ${ip}, ${agente}, ${utc}::timestamptz)`,
      ),
      txn`update proyectos set estado = 'en_revision'
          where id = ${proyectoId} and estado = 'enviado'`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${sesion.usuarioId}, 'admin', 'expediente.generado', 'proyectos',
                  ${proyectoId},
                  ${JSON.stringify({ documentos: generados.length, utc, hash_final: hashAnterior })}::jsonb,
                  ${ip}, ${agente})`,
    ]);
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      throw new ErrorHttp(
        409,
        "El expediente ya fue generado. Recarga la página para verlo.",
        "expediente_existente",
      );
    }
    throw error;
  }

  return json(
    {
      ok: true,
      reutilizado: false,
      utc,
      documentos: generados.map((g) => ({
        codigo: g.doc.codigo,
        orden: g.orden,
        sello: g.sello,
        hash_archivo: g.hashArchivo,
        hash_anterior: g.hashAnterior,
        hash_cadena: g.hashCadena,
        estado: "firmado",
      })),
    },
    201,
  );
});
