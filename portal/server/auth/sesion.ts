/* ============================================================
   GET /api/auth/sesion
   ------------------------------------------------------------
   Lo que la interfaz necesita al abrir: quién es, si confirmó el
   correo, su ficha fiscal y si ya hay firma. Una sesión vencida
   devuelve `sesion: null` y borra la cookie caduca.
   ============================================================ */

import { estadoDe } from "../_lib/cuenta";
import { cookieBorrada, leerSesion, nombreCookie } from "../_lib/sesion";
import { cookiesDe, json } from "../_lib/http";
import { manejar } from "../_lib/manejador";

export default manejar(["GET"], async (peticion) => {
  const sesion = await leerSesion(peticion);
  if (!sesion) {
    const habiaCookie = Boolean(cookiesDe(peticion)[nombreCookie()]);
    return json(
      { sesion: null },
      200,
      habiaCookie ? { "set-cookie": cookieBorrada() } : {},
    );
  }
  return json({ sesion: await estadoDe(sesion) });
});
