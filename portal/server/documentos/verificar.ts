/* ============================================================
   GET /api/documentos/verificar
   ------------------------------------------------------------
   Recalcula, desde la base, lo que el expediente afirma: el hash
   de cada archivo, el sello de contenido, la cadena entre
   documentos y la presencia de los dos actos de firma. No lee
   ningún valor de confianza del PDF: compara contra lo guardado.

   Un solo resultado falso no se oculta: la respuesta marca cada
   comprobación por documento y resume con `integro` (archivos y
   sellos) y `completo` (los dos actos). El cliente ve su propio
   expediente; la administración indica el proyecto.

   Si el documento fue ajustado a mano se informa el ajuste con sus
   dos hashes y se comprueba aparte: la cadena sigue siendo la del
   archivo generado.
   ============================================================ */

import { DOCUMENTO_POR_CODIGO } from "../../legal";
import type { DocumentoLegal } from "../../legal/tipos";
import { hashCadena, hashPlantilla, selloDeContenido, sha256Hex } from "../../render/hash";
import { json } from "../_lib/http";
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
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

/** El driver devuelve `timestamptz` como Date; pasarlo por String perdería los milisegundos del sello. */
function instante(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

function documentoDeContenido(codigo: string, contenido: unknown): DocumentoLegal | null {
  let datos = contenido;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch {
      return null;
    }
  }
  if (!datos || typeof datos !== "object") return null;
  const objeto = datos as Record<string, unknown>;
  if (typeof objeto.titulo !== "string" || typeof objeto.version !== "string") return null;
  return {
    codigo,
    titulo: objeto.titulo,
    version: objeto.version,
    fecha: String(objeto.fecha ?? ""),
    firma: (objeto.firma ?? "registro") as DocumentoLegal["firma"],
    resumen: "",
    campos: Array.isArray(objeto.campos) ? objeto.campos.map(String) : [],
    bloques: Array.isArray(objeto.bloques) ? (objeto.bloques as DocumentoLegal["bloques"]) : [],
  };
}

export default manejar(["GET"], async (peticion) => {
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");

  const url = new URL(peticion.url);
  const pedido = url.searchParams.get("proyecto_id") ?? undefined;
  if (sesion.rol === "admin" && !pedido) {
    throw new ErrorHttp(400, "Indica el proyecto que quieres verificar.", "proyecto");
  }

  const proyecto = await proyectoDeExpediente(sesion, sesion.rol === "admin" ? pedido : undefined);
  const proyectoId = String(proyecto.fila.id);

  const [documentos, actos] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select d.id, d.plantilla_codigo, d.plantilla_version, d.orden, d.pdf, d.sello,
               d.hash_archivo, d.hash_anterior, d.hash_cadena, d.estado, d.utc_sello,
               p.sha256 as plantilla_sha, p.contenido as plantilla_contenido,
               aj.id as ajuste_id, aj.sha256_original, aj.sha256_ajustado,
               aj.pdf as pdf_ajustado, aj.nota, aj.utc as ajuste_utc
        from documentos d
        join plantillas p on p.codigo = d.plantilla_codigo and p.version = d.plantilla_version
        left join lateral (
          select a.id, a.sha256_original, a.sha256_ajustado, a.pdf, a.nota, a.utc
          from documentos_ajustados a
          where a.documento_id = d.id
          order by a.utc desc, a.id
          limit 1
        ) aj on true
        where d.proyecto_id = ${proyectoId}
        order by d.orden`,
    txn`select a.documento_id, a.firmante, a.firma_id, a.representante_id, a.utc
        from actos_firma a
        join documentos d on d.id = a.documento_id
        where d.proyecto_id = ${proyectoId}`,
  ]);

  const filas = (documentos ?? []) as Record<string, unknown>[];
  if (!filas.length) {
    throw new ErrorHttp(404, "Todavía no hay un expediente generado para este proyecto.", "sin_expediente");
  }

  const actosPorDocumento = new Map<string, Record<string, unknown>[]>();
  for (const acto of (actos ?? []) as Record<string, unknown>[]) {
    const id = String(acto.documento_id);
    const lista = actosPorDocumento.get(id) ?? [];
    lista.push(acto);
    actosPorDocumento.set(id, lista);
  }

  const cliente = await clienteDeExpediente(sesion, String(proyecto.fila.cliente_id));
  const primerActoCliente = (actos ?? []).find((a) => a.firmante === "cliente");
  const primerActoRepresentante = (actos ?? []).find((a) => a.firmante === "representante");
  const firma = await firmaDeExpediente(
    sesion,
    cliente.id,
    primerActoCliente ? String(primerActoCliente.firma_id) : undefined,
  );
  const representante = await representanteDeExpediente(
    sesion,
    primerActoRepresentante ? String(primerActoRepresentante.representante_id) : undefined,
  );
  const firmas = firmasDeExpediente({ cliente, firma, representante, ip: null, agente: null });

  let anterior = "GENESIS";
  let integro = true;
  let cadenaOk = true;
  let completo = true;

  const salida = filas.map((fila) => {
    const id = String(fila.id);
    const codigo = String(fila.plantilla_codigo);
    const orden = Number(fila.orden);
    const guardado = {
      sello: String(fila.sello),
      archivo: String(fila.hash_archivo),
      anteriorGuardado: String(fila.hash_anterior),
      cadena: String(fila.hash_cadena),
    };

    const utc = fila.utc_sello ? instante(fila.utc_sello) : null;
    const docLegal = documentoDeContenido(codigo, fila.plantilla_contenido)
      ?? DOCUMENTO_POR_CODIGO.get(codigo)
      ?? null;

    let plantillaOk = false;
    let selloOk = false;
    if (docLegal && utc && !Number.isNaN(utc.getTime())) {
      plantillaOk = hashPlantilla(docLegal) === String(fila.plantilla_sha);
      const datos = datosDeExpediente({ cliente, representante, proyecto, fecha: utc });
      const esperado = selloDeContenido({
        doc: docLegal,
        datos,
        firmas: [firmas.representante, firmas.cliente],
        utc: utc.toISOString(),
      });
      selloOk = esperado === guardado.sello;
    }

    const pdf = fila.pdf as Uint8Array;
    const archivoOk = sha256Hex(pdf) === guardado.archivo;
    const eslabon = hashCadena(anterior, guardado.sello, orden);
    const eslabonOk = guardado.anteriorGuardado === anterior && guardado.cadena === eslabon;
    anterior = guardado.cadena;

    // El ajuste a mano no entra en la cadena: se comprueba por su
    // cuenta, que los bytes guardados sigan dando el hash registrado
    // y que el hash original sea el del documento que dice ajustar.
    const pdfAjustado = fila.pdf_ajustado ? (fila.pdf_ajustado as Uint8Array) : null;
    const ajuste = pdfAjustado
      ? {
          id: String(fila.ajuste_id),
          sha256_original: String(fila.sha256_original),
          sha256_ajustado: String(fila.sha256_ajustado),
          tamano: pdfAjustado.length,
          nota: fila.nota ? String(fila.nota) : null,
          utc: instante(fila.ajuste_utc).toISOString(),
        }
      : null;
    const ajusteOk = ajuste
      ? ajuste.sha256_original === guardado.archivo &&
        sha256Hex(pdfAjustado as Uint8Array) === ajuste.sha256_ajustado
      : true;

    const propios = actosPorDocumento.get(id) ?? [];
    const actoRepresentante = propios.find((a) => a.firmante === "representante");
    const actoCliente = propios.find((a) => a.firmante === "cliente");
    const documentoCompleto = Boolean(actoRepresentante && actoCliente);

    if (!plantillaOk || !selloOk || !archivoOk || !eslabonOk || !ajusteOk) integro = false;
    if (!eslabonOk) cadenaOk = false;
    if (!documentoCompleto) completo = false;

    return {
      codigo,
      orden,
      sello: guardado.sello,
      hash_archivo: guardado.archivo,
      hash_anterior: guardado.anteriorGuardado,
      hash_cadena: guardado.cadena,
      estado: String(fila.estado),
      tamano: pdf.length,
      plantilla_ok: plantillaOk,
      sello_ok: selloOk,
      archivo_ok: archivoOk,
      cadena_ok: eslabonOk,
      ajuste,
      ajuste_ok: ajusteOk,
      actos: {
        representante: actoRepresentante
          ? { hecho: true, utc: instante(actoRepresentante.utc).toISOString() }
          : { hecho: false, utc: null },
        cliente: actoCliente
          ? { hecho: true, utc: instante(actoCliente.utc).toISOString() }
          : { hecho: false, utc: null },
      },
    };
  });

  return json({
    ok: integro && completo,
    proyecto_id: proyectoId,
    integro,
    completo,
    cadena_ok: cadenaOk,
    documentos: salida,
  });
});
