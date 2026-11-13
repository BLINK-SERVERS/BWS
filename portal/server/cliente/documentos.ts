/* ============================================================
   GET /api/cliente/documentos
   ------------------------------------------------------------
   Lista los documentos del expediente del proyecto más reciente
   del cliente en sesión: código, título, versión, orden, hash y
   si su acto de firma ya quedó registrado. La descarga va por
   `/api/documentos/descargar`, que audita cada acceso.

   Cada documento dice si Blink lo ajustó a mano: el cliente sabe
   que el PDF que baja no es el renderizado automático y ve el
   hash del archivo que recibe.

   El cliente no recibe PDF en esta respuesta: solo el resumen.
   ============================================================ */

import { json } from "../_lib/http";
import { enTransaccion } from "../_lib/db";
import { proyectoOpcionalDeExpediente } from "../_lib/expediente";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

function instante(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

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
               a.sha256_ajustado, a.nota, a.utc as ajuste_utc,
               exists (
                 select 1 from actos_firma af
                 where af.documento_id = d.id and af.firmante = 'cliente'
               ) as firmado
        from documentos d
        join plantillas p
          on p.codigo = d.plantilla_codigo and p.version = d.plantilla_version
        left join lateral (
          select aj.sha256_ajustado, aj.nota, aj.utc
          from documentos_ajustados aj
          where aj.documento_id = d.id
          order by aj.utc desc, aj.id
          limit 1
        ) a on true
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
    ajustado: {
      sha256: fila.sha256_ajustado ? String(fila.sha256_ajustado) : null,
      nota: fila.nota ? String(fila.nota) : null,
      utc: fila.ajuste_utc ? instante(fila.ajuste_utc).toISOString() : null,
    },
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
