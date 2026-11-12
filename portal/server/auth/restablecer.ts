/* ============================================================
   POST /api/auth/restablecer
   ------------------------------------------------------------
   Consume el token de recuperación, guarda la clave nueva y
   cierra todas las sesiones del usuario. El token es de un solo
   uso y vence en una hora.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { db } from "../_lib/db";
import { hashearClave } from "../_lib/clave";
import { mensajeClave } from "../../legal/identidad";
import { consumirLimite } from "../_lib/limite";
import { ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { hashToken } from "../_lib/sesion";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";

const FORMATO = /^[A-Za-z0-9_-]{40,64}$/;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const limite = await consumirLimite(
    `restablecer:ip:${ipDe(peticion) ?? "desconocida"}`,
    20,
    900,
  );
  if (!limite.permitido) {
    throw new ErrorHttp(429, "Demasiados intentos. Espera unos minutos.", "limite");
  }

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const token = texto(cuerpo?.token);
  const problema = mensajeClave(cuerpo?.clave);

  if (!FORMATO.test(token)) {
    throw new ErrorHttp(400, "El enlace de recuperación no es válido.", "token");
  }
  if (problema) throw new ErrorHttp(400, problema, "clave");

  const claveHash = await hashearClave(String((cuerpo as { clave: string }).clave));
  const filas = await db()`select bws_restablecer_clave(${hashToken(token)}, ${claveHash}) as usuario`;
  if (!filas[0]?.usuario) {
    throw new ErrorHttp(
      400,
      "El enlace no es válido, ya se usó o venció. Pide uno nuevo desde el portal.",
      "token",
    );
  }

  return json({ ok: true });
});
