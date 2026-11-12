/* ============================================================
   POST /api/auth/reenviar-verificacion
   ------------------------------------------------------------
   Emite un enlace de verificación nuevo para la cuenta que tiene
   sesión abierta. El enlace del correo vence a las 24 horas y se
   consume una sola vez; sin esta salida, una cuenta sin confirmar
   quedaba sin forma de pedir otro desde el portal.

   Solo responde a una cuenta sin verificar. Si el envío falla, la
   respuesta lo dice y la acción puede repetirse.
   ============================================================ */

import { emitirToken, enviarVerificacion } from "../_lib/cuenta";
import { exigirOrigen } from "../_lib/csrf";
import { enTransaccion } from "../_lib/db";
import { agenteDe, ipDe, json } from "../_lib/http";
import { consumirDoble } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";
import { leerSesion } from "../_lib/sesion";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const sesion = await leerSesion(peticion);
  if (!sesion) throw new ErrorHttp(401, "Tu sesión venció. Vuelve a entrar.", "sesion");

  const limite = await consumirDoble(
    "reenviar",
    ipDe(peticion),
    sesion.usuarioId,
    10,
    4,
    3600,
  );
  if (!limite.permitido) {
    throw new ErrorHttp(
      429,
      "Pediste varios enlaces seguidos. Espera una hora o escribe a business@blink.com.ve.",
      "limite",
    );
  }

  if (sesion.verificado) {
    throw new ErrorHttp(409, "Tu correo ya está confirmado.", "verificado");
  }

  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  const token = await emitirToken(sesion.usuarioId, "verificacion");

  await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, ip, agente)
        values (${sesion.usuarioId}, ${sesion.rol}, 'verificacion.reenviada', 'usuarios',
                ${sesion.usuarioId}, ${ip}, ${agente})`,
  ]);

  let enviado = true;
  try {
    await enviarVerificacion(sesion.correo, sesion.nombre, token);
  } catch (error) {
    enviado = false;
    console.error(
      "No se pudo reenviar el correo de verificación:",
      error instanceof Error ? error.message : error,
    );
  }

  return json({ ok: true, enviado }, 202);
});
