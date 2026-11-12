/* ============================================================
   POST /api/auth/salir
   ------------------------------------------------------------
   Marca la sesión como revocada y borra la cookie. Si la cookie
   ya no servía, igual se borra: salir nunca falla.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { cookieBorrada, leerSesion, revocarSesion } from "../_lib/sesion";
import { json } from "../_lib/http";
import { manejar } from "../_lib/manejador";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);
  const sesion = await leerSesion(peticion);
  if (sesion) await revocarSesion(peticion, sesion);
  return json({ ok: true }, 200, { "set-cookie": cookieBorrada() });
});
