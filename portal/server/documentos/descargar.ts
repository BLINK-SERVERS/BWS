/* ============================================================
   GET /api/documentos/descargar?codigo=BWS-XXX-000[&proyecto_id=]
   ------------------------------------------------------------
   Entrega el PDF de un documento del expediente. El cliente solo
   alcanza el proyecto del que es dueño; la administración indica
   el proyecto. Cada descarga deja un evento con actor, IP y agente:
   el expediente se puede leer, y queda registrado quién lo hizo.

   Si Blink ajustó el documento a mano, se sirven esos bytes y no
   los generados: la tabla de ajustes es de solo agregar y su fila
   más reciente es la vigente. La respuesta no se cachea y declara
   el SHA-256 del archivo que sale en `x-bws-sha256`; cuando hay
   ajuste, `x-bws-ajuste` lleva el hash del archivo generado que
   ese PDF reemplaza, para poder comparar los dos.
   ============================================================ */

import { agenteDe, ipDe } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { proyectoDeExpediente } from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

const CODIGO = /^BWS-[A-Z]{3}-\d{3}$/;

export default manejar(["GET"], async (peticion) => {
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");

  const url = new URL(peticion.url);
  const codigo = (url.searchParams.get("codigo") ?? "").trim();
  if (!CODIGO.test(codigo)) {
    throw new ErrorHttp(400, "Indica un documento válido.", "documento");
  }

  const pedido = url.searchParams.get("proyecto_id") ?? undefined;
  if (sesion.rol === "admin" && !pedido) {
    throw new ErrorHttp(400, "Indica el proyecto del documento.", "proyecto");
  }

  const proyecto = await proyectoDeExpediente(sesion, sesion.rol === "admin" ? pedido : undefined);
  const proyectoId = String(proyecto.fila.id);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  // El evento se inserta en la misma transacción que la lectura:
  // si la auditoría falla, la descarga no sale.
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`with doc as (
          select d.id, d.plantilla_version, d.hash_archivo,
                 coalesce(a.pdf, d.pdf) as pdf,
                 coalesce(a.sha256_ajustado, d.hash_archivo) as hash_servido,
                 a.sha256_ajustado is not null as ajustado
          from documentos d
          left join lateral (
            select aj.pdf, aj.sha256_ajustado
            from documentos_ajustados aj
            where aj.documento_id = d.id
            order by aj.utc desc, aj.id
            limit 1
          ) a on true
          where d.proyecto_id = ${proyectoId} and d.plantilla_codigo = ${codigo}
        ), evento as (
          insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          select ${sesion.usuarioId}::uuid, ${sesion.rol}::text,
                 'documento.descargado', 'documentos',
                 id::text,
                 jsonb_build_object('codigo', ${codigo}::text,
                                    'proyecto_id', ${proyectoId}::text,
                                    'hash_archivo', hash_archivo,
                                    'hash_servido', hash_servido,
                                    'ajustado', ajustado),
                 ${ip}::inet, ${agente}::text
          from doc
          returning 1
        )
        select id, pdf, hash_archivo, hash_servido, ajustado, plantilla_version from doc`,
  ]);

  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(404, "Ese documento no está en el expediente.", "sin_documento");
  }

  const pdf = new Uint8Array(fila.pdf as Uint8Array);
  const version = Number(fila.plantilla_version);
  const ajustado = Boolean(fila.ajustado);
  const nombre = `${codigo}-v${version}${ajustado ? "-ajustado" : ""}.pdf`;
  const cabeceras: Record<string, string> = {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${nombre}"`,
    "content-length": String(pdf.length),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-bws-sha256": String(fila.hash_servido),
  };
  if (ajustado) cabeceras["x-bws-ajuste"] = String(fila.hash_archivo ?? "");

  return new Response(pdf, { headers: cabeceras });
});
