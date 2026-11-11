/* ============================================================
   Envío de correo
   ------------------------------------------------------------
   Tres modos: `archivo` (pruebas, escribe un JSON en `portal/tmp/
   correo/`), `resend` (HTTP) y `smtp` (se completa en la entrega
   de correo). El modo `archivo` nunca se permite en producción.
   Los tokens viajan en el texto del mensaje, no en los registros
   de la consola.
   ============================================================ */

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Mensaje {
  para: string;
  asunto: string;
  texto: string;
}

export interface Envio {
  proveedor: "archivo" | "resend";
  id: string;
}

function copias(): string[] {
  return (process.env.CORREO_COPIA ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
}

async function porArchivo(mensaje: Mensaje): Promise<Envio> {
  const carpeta = process.env.CORREO_ARCHIVO_DIR ?? join(process.cwd(), "tmp", "correo");
  await mkdir(carpeta, { recursive: true });
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}.json`;
  await writeFile(
    join(carpeta, id),
    JSON.stringify(
      {
        para: mensaje.para,
        copia: copias(),
        asunto: mensaje.asunto,
        texto: mensaje.texto,
        creado: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return { proveedor: "archivo", id };
}

async function porResend(mensaje: Mensaje): Promise<Envio> {
  const clave = process.env.CORREO_API_KEY;
  const desde = process.env.CORREO_DESDE;
  if (!clave || !desde) {
    throw new Error("Faltan CORREO_API_KEY o CORREO_DESDE para enviar con Resend.");
  }
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${clave}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: desde,
      to: [mensaje.para],
      cc: copias(),
      subject: mensaje.asunto,
      text: mensaje.texto,
    }),
  });
  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 300);
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle}`);
  }
  const datos = (await respuesta.json()) as { id?: string };
  return { proveedor: "resend", id: datos.id ?? "sin-id" };
}

export async function enviarCorreo(mensaje: Mensaje): Promise<Envio> {
  const modo =
    process.env.CORREO_MODO ??
    (process.env.ENTORNO === "produccion" ? "" : "archivo");

  if (modo === "archivo") {
    if (process.env.ENTORNO === "produccion") {
      throw new Error("El modo archivo de correo no se permite en producción.");
    }
    return porArchivo(mensaje);
  }
  if (modo === "resend") return porResend(mensaje);
  if (modo === "smtp") {
    throw new Error("El modo SMTP se completa en la entrega de correo.");
  }
  throw new Error("CORREO_MODO no está configurado.");
}
