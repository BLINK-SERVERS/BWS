/* ============================================================
   POST /api/auth/ingreso
   ------------------------------------------------------------
   Correo y clave. La respuesta es siempre la misma cuando falla,
   y el trabajo de scrypt se gasta también con una cuenta que no
   existe, para no delatar cuáles correos están registrados.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { correoNormalizado } from "../../legal/identidad";
import { consumirDoble } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { verificarConRelleno } from "../_lib/clave";
import { db } from "../_lib/db";
import { cookieDeSesion, crearSesion } from "../_lib/sesion";
import { ErrorHttp } from "../_lib/respuestas";

const FALLO = "El correo o la clave no coinciden.";

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  if (!cuerpo) throw new ErrorHttp(400, "Faltan el correo y la clave.", "datos");

  const correo = correoNormalizado(cuerpo.correo);
  const clave = texto(cuerpo.clave);

  const limite = await consumirDoble("ingreso", ipDe(peticion), correo, 20, 8, 900);
  if (!limite.permitido) {
    throw new ErrorHttp(
      429,
      "Demasiados intentos. Espera quince minutos o restablece la clave.",
      "limite",
    );
  }

  if (!correo || !clave) {
    throw new ErrorHttp(401, FALLO, "credenciales");
  }

  const filas = await db()`select * from bws_credenciales(${correo})`;
  const fila = filas[0] as
    | {
        id: string;
        clave_hash: string;
        rol: "cliente" | "admin";
        correo_verificado: boolean;
        bloqueado: boolean;
      }
    | undefined;

  const correcta = await verificarConRelleno(clave, fila?.clave_hash ?? null);
  if (!fila || fila.bloqueado || !correcta) {
    throw new ErrorHttp(401, FALLO, "credenciales");
  }

  const { token, expira } = await crearSesion(
    fila.id,
    fila.rol,
    ipDe(peticion),
    agenteDe(peticion),
  );

  return json(
    { ok: true, expira: expira.toISOString() },
    200,
    { "set-cookie": cookieDeSesion(token, expira) },
  );
});
