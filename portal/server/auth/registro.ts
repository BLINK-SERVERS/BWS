/* ============================================================
   POST /api/auth/registro
   ------------------------------------------------------------
   Crea la cuenta y la ficha fiscal en una sola transacción. Antes
   exige que el cliente devuelva las huellas de los cinco textos
   que leyó: un consentimiento sobre otro texto no se guarda.

   La firma no se captura aquí. Se captura una sola vez, después
   de confirmar el correo, en `/api/cliente/firma`.
   ============================================================ */

import { randomBytes, randomUUID } from "node:crypto";
import { exigirOrigen } from "../_lib/csrf";
import { agenteDe, ipDe, json, leerJson, objeto, texto } from "../_lib/http";
import { consumirDoble } from "../_lib/limite";
import { manejar } from "../_lib/manejador";
import { hashearClave } from "../_lib/clave";
import { enTransaccion } from "../_lib/db";
import { enviarVerificacion, horasDeToken } from "../_lib/cuenta";
import {
  DOCUMENTOS_REGISTRO,
  huellasDeRegistro,
  leerCliente,
  leerCuenta,
} from "../_lib/registro";
import { hashToken } from "../_lib/sesion";
import { codigoPostgres, ErrorHttp } from "../_lib/respuestas";

function conflicto(error: unknown): never {
  if (codigoPostgres(error) === "23505") {
    const restriccion = (error as { constraint?: string }).constraint ?? "";
    if (restriccion === "usuarios_correo_unico") {
      throw new ErrorHttp(409, "Ya existe una cuenta con ese correo.", "correo");
    }
    if (restriccion.startsWith("clientes_")) {
      throw new ErrorHttp(
        409,
        "Ese documento ya está registrado en otra cuenta.",
        "documento",
      );
    }
  }
  throw error;
}

export default manejar(["POST"], async (peticion) => {
  exigirOrigen(peticion);

  const cuerpo = objeto(await leerJson<unknown>(peticion));
  if (!cuerpo) throw new ErrorHttp(400, "Faltan los datos del registro.", "datos");

  const cuenta = leerCuenta(cuerpo.cuenta);
  const cliente = leerCliente(cuerpo.cliente, cuenta.correo);

  const limite = await consumirDoble("registro", ipDe(peticion), cuenta.correo, 10, 5, 3600);
  if (!limite.permitido) {
    throw new ErrorHttp(
      429,
      "Demasiados intentos de registro. Espera una hora o escribe a business@blink.com.ve.",
      "limite",
    );
  }

  const huellas = huellasDeRegistro(cliente);
  const enviadas = objeto(cuerpo.hashes) ?? {};
  for (const codigo of DOCUMENTOS_REGISTRO) {
    if (texto(enviadas[codigo]) !== huellas[codigo]) {
      throw new ErrorHttp(
        409,
        "El texto legal cambió desde que lo leíste. Vuelve a revisarlo antes de crear la cuenta.",
        "consentimiento",
      );
    }
  }

  const usuarioId = randomUUID();
  const claveHash = await hashearClave(cuenta.clave);
  const token = randomBytes(32).toString("base64url");
  const expiraToken = new Date(Date.now() + horasDeToken("verificacion") * 3600_000);
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);

  try {
    await enTransaccion(usuarioId, "cliente", (txn) => [
      txn`insert into usuarios (id, correo, clave_hash, nombre)
          values (${usuarioId}, ${cuenta.correo}, ${claveHash}, ${cuenta.nombre})`,
      txn`insert into clientes (
            usuario_id, razon_social, documento_tipo, documento_numero,
            domicilio_fiscal, telefono, correo_factura
          ) values (
            ${usuarioId}, ${cliente.razon_social}, ${cliente.documento_tipo},
            ${cliente.documento_numero}, ${cliente.domicilio}, ${cliente.telefono},
            ${cliente.correo_factura}
          )`,
      txn`insert into tokens_correo (usuario_id, tipo, token_hash, expira)
          values (${usuarioId}, 'verificacion', ${hashToken(token)},
                  ${expiraToken.toISOString()})`,
      txn`insert into eventos (actor, rol, accion, entidad, entidad_id, detalle, ip, agente)
          values (${usuarioId}, 'cliente', 'cuenta.creada', 'usuarios', ${usuarioId},
                  ${JSON.stringify({ documentos: huellas })}::jsonb, ${ip}, ${agente})`,
    ]);
  } catch (error) {
    conflicto(error);
  }

  let verificacionEnviada = true;
  try {
    await enviarVerificacion(cuenta.correo, cuenta.nombre, token);
  } catch (error) {
    verificacionEnviada = false;
    console.error(
      "No se pudo enviar el correo de verificación:",
      error instanceof Error ? error.message : error,
    );
  }

  return json(
    {
      ok: true,
      correo: cuenta.correo,
      verificacion_enviada: verificacionEnviada,
    },
    201,
  );
});
