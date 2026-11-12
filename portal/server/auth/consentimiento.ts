/* ============================================================
   POST /api/auth/consentimiento
   ------------------------------------------------------------
   Resuelve los cuatro documentos del registro con el nombre, el
   teléfono y el correo que escribió la persona, y devuelve su
   texto y su huella. Esa huella es la que se exige de vuelta al
   crear la cuenta: si un dato o un texto cambia entre la lectura y
   el alta, el registro no se completa.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { ipDe, json, leerJson, objeto } from "../_lib/http";
import { consumirLimite } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { leerPersona, previaDeRegistro } from "../_lib/registro";
import { ErrorHttp } from "../_lib/respuestas";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const limite = await consumirLimite(
    `consentimiento:ip:${ipDe(peticion) ?? "desconocida"}`,
    60,
    600,
  );
  if (!limite.permitido) {
    throw new ErrorHttp(
      429,
      "Demasiadas solicitudes seguidas. Espera unos minutos y vuelve a intentarlo.",
      "limite",
    );
  }

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  if (!cuerpo) throw new ErrorHttp(400, "Faltan los datos personales.", "datos");

  const persona = leerPersona(cuerpo);
  return json(previaDeRegistro(persona));
});
