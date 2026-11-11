/* ============================================================
   POST /api/auth/verificar
   ------------------------------------------------------------
   Consume el token del correo y marca la cuenta como verificada.
   Sin correo verificado se puede entrar al portal, pero no firmar.
   ============================================================ */

import { exigirOrigen } from "../_lib/csrf";
import { consumirLimite } from "../_lib/limite";
import { db } from "../_lib/db";
import { ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { hashToken } from "../_lib/sesion";
import { manejar } from "../_lib/manejador";
import { ErrorHttp } from "../_lib/respuestas";

const FORMATO = /^[A-Za-z0-9_-]{40,64}$/;

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const limite = await consumirLimite(
    `verificar:ip:${ipDe(peticion) ?? "desconocida"}`,
    30,
    900,
  );
  if (!limite.permitido) {
    throw new ErrorHttp(429, "Demasiados intentos. Espera unos minutos.", "limite");
  }

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  const token = texto(cuerpo?.token);
  if (!FORMATO.test(token)) {
    throw new ErrorHttp(400, "El enlace de verificación no es válido.", "token");
  }

  const filas = await db()`select bws_verificar_correo(${hashToken(token)}) as usuario`;
  const usuario = filas[0]?.usuario;
  if (!usuario) {
    throw new ErrorHttp(
      400,
      "El enlace no es válido, ya se usó o venció. Pide uno nuevo desde el portal.",
      "token",
    );
  }

  return json({ ok: true });
});
