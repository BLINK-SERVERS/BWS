/* GET /api/documentos/verificacion-publica?id=UUID
   La respuesta resume los actos del documento original. El hash de un
   ajuste, si lo hay, identifica otro archivo y no implica su aceptación. */

import { db } from "../_lib/db";
import { json } from "../_lib/http";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["GET"], async (peticion) => {
  const ids = new URL(peticion.url).searchParams.getAll("id");
  if (ids.length !== 1 || ids[0].length !== 36 || !UUID.test(ids[0])) {
    throw new ErrorHttp(400, "Indica un UUID de documento válido.", "documento");
  }

  const filas = await db()`select id, titular, titulo, estado, hash_archivo, hash_ajustado
                          from public.bws_verificacion_publica(${ids[0]}::uuid)`;
  const fila = filas[0];
  if (!fila) throw new ErrorHttp(404, "No se encontró el documento.", "sin_documento");

  return json({
    id: fila.id,
    titular: fila.titular,
    titulo: fila.titulo,
    estado: fila.estado,
    hash_archivo: fila.hash_archivo,
    hash_ajustado: fila.hash_ajustado,
  });
});
