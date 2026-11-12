/* ============================================================
   POST /api/documentos/enviar
   ------------------------------------------------------------
   Reintento manual del envío del expediente desde la
   administración. El correo sale solo cuando el cliente confirma
   los ocho documentos; este botón sirve si aquel intento falló.
   La lógica y la idempotencia viven en `_lib/envio-expediente.ts`.
   ============================================================ */

import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { exigirOrigen } from "../_lib/csrf";
import { enviarExpediente } from "../_lib/envio-expediente";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { exigirAdmin, leerSesion } from "../_lib/sesion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = exigirAdmin(await leerSesion(peticion));

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const proyectoId = texto(cuerpo?.proyecto_id);
  if (!UUID.test(proyectoId)) {
    throw new ErrorHttp(400, "Falta el proyecto del expediente.", "proyecto");
  }

  return json(await enviarExpediente(sesion, proyectoId, ipDe(peticion), agenteDe(peticion)));
});
