/* ============================================================
   Envío de correo
   ------------------------------------------------------------
   Tres modos: `archivo` (pruebas, escribe el mensaje y sus
   adjuntos en `portal/tmp/correo/`), `resend` (HTTP) y `smtp`
   (nodemailer). El modo `archivo` nunca se permite en producción.
   Los tokens viajan en el texto del mensaje, no en los registros
   de la consola, y los adjuntos se escriben como archivos aparte
   para no duplicar los PDF dentro del JSON.
   ============================================================ */

import { createHash, randomBytes } from "node:crypto";

export interface Adjunto {
  nombre: string;
  contenido: Uint8Array;
}

export interface Mensaje {
  para: string;
  asunto: string;
  texto: string;
  /** Copia explícita; si no se indica, se usa `CORREO_COPIA`. */
  copia?: string[];
  adjuntos?: Adjunto[];
}

export interface Envio {
  proveedor: "archivo" | "resend" | "smtp";
  id: string;
}

function copias(mensaje: Mensaje): string[] {
  if (mensaje.copia) return mensaje.copia.filter(Boolean);
  return (process.env.CORREO_COPIA ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
}

/** Evita que un nombre de adjunto salga de la carpeta de pruebas. */
function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

async function porArchivo(mensaje: Mensaje): Promise<Envio> {
  // Solo para pruebas y desarrollo local: se importa aquí para que el
  // paquete del Worker nunca cargue el sistema de archivos.
  const [{ mkdir, writeFile }, { join }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const carpeta = process.env.CORREO_ARCHIVO_DIR ?? join(process.cwd(), "tmp", "correo");
  await mkdir(carpeta, { recursive: true });
  const marca = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const adjuntos = [];
  for (const [indice, adjunto] of (mensaje.adjuntos ?? []).entries()) {
    const archivo = `${marca}-${indice + 1}-${nombreSeguro(adjunto.nombre)}`;
    await writeFile(join(carpeta, archivo), adjunto.contenido);
    adjuntos.push({
      nombre: adjunto.nombre,
      archivo,
      bytes: adjunto.contenido.length,
      sha256: createHash("sha256").update(adjunto.contenido).digest("hex"),
    });
  }
  await writeFile(
    join(carpeta, `${marca}.json`),
    JSON.stringify(
      {
        para: mensaje.para,
        copia: copias(mensaje),
        asunto: mensaje.asunto,
        texto: mensaje.texto,
        adjuntos,
        creado: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return { proveedor: "archivo", id: marca };
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
      cc: copias(mensaje),
      subject: mensaje.asunto,
      text: mensaje.texto,
      attachments: (mensaje.adjuntos ?? []).map((adjunto) => ({
        filename: adjunto.nombre,
        content: Buffer.from(adjunto.contenido).toString("base64"),
      })),
    }),
  });
  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 300);
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle}`);
  }
  const datos = (await respuesta.json()) as { id?: string };
  return { proveedor: "resend", id: datos.id ?? "sin-id" };
}

async function porSmtp(mensaje: Mensaje): Promise<Envio> {
  const host = process.env.SMTP_HOST;
  const desde = process.env.CORREO_DESDE;
  if (!host || !desde) {
    throw new Error("Faltan SMTP_HOST o CORREO_DESDE para enviar por SMTP.");
  }
  const puerto = Number(process.env.SMTP_PORT ?? 587);
  const { default: nodemailer } = await import("nodemailer");
  const transporte = nodemailer.createTransport({
    host,
    port: puerto,
    secure: process.env.SMTP_SEGURO === "si" || puerto === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  try {
    const info = await transporte.sendMail({
      from: desde,
      to: mensaje.para,
      cc: copias(mensaje),
      subject: mensaje.asunto,
      text: mensaje.texto,
      attachments: (mensaje.adjuntos ?? []).map((adjunto) => ({
        filename: adjunto.nombre,
        content: Buffer.from(adjunto.contenido),
      })),
    });
    return { proveedor: "smtp", id: info.messageId ?? "sin-id" };
  } finally {
    transporte.close();
  }
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
  if (modo === "smtp") return porSmtp(mensaje);
  throw new Error("CORREO_MODO no está configurado.");
}
