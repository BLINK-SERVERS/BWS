/* ============================================================
   POST /api/auth/consentimiento
   ------------------------------------------------------------
   Resuelve los cinco documentos del registro con los datos que
   escribió el cliente y devuelve su texto y su huella. Esa huella
   es la que se exige de vuelta al crear la cuenta: si un dato o
   un texto cambia entre la lectura y el alta, el registro no se
   completa.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { correoNormalizado } from "../../legal/identidad";
import { ipDe, json, leerJson, objeto } from "../_lib/http";
import { consumirLimite } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { leerCliente, previaDeRegistro } from "../_lib/registro";
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
  if (!cuerpo) throw new ErrorHttp(400, "Faltan los datos del cliente.", "datos");

  const correo = correoNormalizado(cuerpo.correo);
  if (!correo) throw new ErrorHttp(400, "El correo no tiene un formato válido.", "datos");

  const cliente = leerCliente(cuerpo.cliente, correo);
  return json(previaDeRegistro(cliente));
});
