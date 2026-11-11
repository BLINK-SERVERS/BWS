/* ============================================================
   POST /api/auth/recuperar
   ------------------------------------------------------------
   Pide un enlace de recuperación. La respuesta es siempre la
   misma exista o no la cuenta, y el envío se intenta solo si
   existe: así este punto no sirve para averiguar correos.
   ============================================================ */

import { correoNormalizado } from "../../legal/identidad";
import { emitirToken, enviarRecuperacion } from "../_lib/cuenta";
import { exigirOrigen } from "../_lib/csrf";
import { db } from "../_lib/db";
import { ipDe, json, leerJson, objeto } from "../_lib/http";
import { consumirDoble } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";

const RESPUESTA =
  "Si ese correo tiene una cuenta, enviamos un enlace para restablecer la clave.";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const correo = correoNormalizado(cuerpo?.correo);

  const limite = await consumirDoble("recuperar", ipDe(peticion), correo, 10, 4, 3600);
  if (!limite.permitido) {
    throw new ErrorHttp(429, "Demasiadas solicitudes. Espera una hora.", "limite");
  }

  if (correo) {
    const filas = await db()`select id, bloqueado from bws_credenciales(${correo})`;
    const fila = filas[0] as { id: string; bloqueado: boolean } | undefined;
    if (fila && !fila.bloqueado) {
      try {
        const token = await emitirToken(fila.id, "recuperacion");
        await enviarRecuperacion(correo, token);
      } catch (error) {
        console.error(
          "No se pudo enviar el correo de recuperación:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return json({ ok: true, mensaje: RESPUESTA }, 202);
});
