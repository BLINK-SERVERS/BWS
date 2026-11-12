/* ============================================================
   GET /api/cliente/documentos
   ------------------------------------------------------------
   Lista los documentos del expediente del proyecto más reciente
   del cliente en sesión: código, título, versión, orden, hash y
   si su acto de firma ya quedó registrado. La descarga va por
   `/api/documentos/descargar`, que audita cada acceso.

   El cliente no recibe PDF en esta respuesta: solo el resumen.
   ============================================================ */

import { json } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { proyectoOpcionalDeExpediente } from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

export default manejar(["GET"], async (peticion) => {
  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");
  if (sesion.rol !== "cliente") {
    throw new ErrorHttp(403, "Esta sección es de los clientes del portal.", "rol");
  }

  const proyecto = await proyectoOpcionalDeExpediente(sesion);
  if (!proyecto) {
    return json({
      ok: true,
      proyecto_id: null,
      proyecto: null,
      documentos: [],
      envio: { enviado: false, utc: null },
    });
  }
  const proyectoId = String(proyecto.fila.id);

  const [filas, envios] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select d.plantilla_codigo, d.plantilla_version, d.orden,
               d.hash_archivo, d.hash_cadena, d.estado, p.contenido->>'titulo' as titulo,
               exists (
                 select 1 from actos_firma a
                 where a.documento_id = d.id and a.firmante = 'cliente'
               ) as firmado
        from documentos d
        join plantillas p
          on p.codigo = d.plantilla_codigo and p.version = d.plantilla_version
        where d.proyecto_id = ${proyectoId}
        order by d.orden`,
    txn`select count(*)::int as total, max(e.utc) as utc
        from envios e
        join documentos d on d.id = e.documento_id
        where d.proyecto_id = ${proyectoId}
          and e.clave_idempotencia like 'expediente/%'`,
  ]);

  const documentos = ((filas ?? []) as Record<string, unknown>[]).map((fila) => ({
    codigo: String(fila.plantilla_codigo),
    titulo: String(fila.titulo),
    version: Number(fila.plantilla_version),
    orden: Number(fila.orden),
    hash_archivo: String(fila.hash_archivo),
    hash_cadena: String(fila.hash_cadena),
    estado: String(fila.estado),
    firmado: Boolean(fila.firmado),
  }));

  const conteoEnvio = ((envios ?? [])[0] ?? {}) as Record<string, unknown>;
  const enviados = Number(conteoEnvio.total ?? 0);
  const utcEnvio = conteoEnvio.utc ? new Date(String(conteoEnvio.utc)).toISOString() : null;

  return json({
    ok: true,
    proyecto_id: proyectoId,
    proyecto: {
      nombre: proyecto.vista.nombre,
      estado: proyecto.vista.estado,
    },
    documentos,
    envio: {
      enviado: documentos.length > 0 && enviados >= documentos.length,
      utc: utcEnvio,
    },
  });
});
