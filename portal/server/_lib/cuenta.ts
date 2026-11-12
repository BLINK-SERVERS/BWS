/* ============================================================
   Cuenta, estado y enlaces por correo
   ------------------------------------------------------------
   Todo lo que el portal sabe de una persona con sesión: su rol,
   si confirmó el correo, su ficha fiscal y si ya firmó. La firma
   se captura una sola vez en `firmas_cliente`; aquí solo se lee.
   ============================================================ */

import { randomBytes } from "node:crypto";
import { enTransaccion } from "./db";
import { enviarCorreo, type Envio } from "./correo";
import { hashToken, type Sesion } from "./sesion";

const HORAS = { verificacion: 24, recuperacion: 1 } as const;

export function horasDeToken(tipo: "verificacion" | "recuperacion"): number {
  return HORAS[tipo];
}

export function sitio(): string {
  const configurado = (process.env.APP_ORIGEN ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean)[0];
  if (configurado) return configurado.replace(/\/+$/, "");
  return process.env.ENTORNO === "produccion"
    ? "https://bws.blink.com.ve"
    : "http://localhost:5177";
}

export function enlace(ruta: string, token: string): string {
  return `${sitio()}/${ruta}?token=${encodeURIComponent(token)}`;
}

/** Token de un solo uso. Se guarda su hash, nunca el valor. */
export async function emitirToken(
  usuarioId: string,
  tipo: "verificacion" | "recuperacion",
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const horas = horasDeToken(tipo);
  await enTransaccion(null, "cliente", (txn) => [
    txn`insert into tokens_correo (usuario_id, tipo, token_hash, expira)
        values (${usuarioId}, ${tipo}, ${hashToken(token)},
                ${new Date(Date.now() + horas * 3600_000).toISOString()})`,
  ]);
  return token;
}

export async function enviarVerificacion(
  correo: string,
  nombre: string,
  token: string,
): Promise<Envio> {
  return enviarCorreo({
    para: correo,
    asunto: "Confirma tu correo en el portal de Blink Web Services",
    texto: [
      `Hola, ${nombre}.`,
      "",
      "Tu cuenta en el portal de Blink Web Services quedó creada. Para firmar documentos necesitas confirmar este correo:",
      "",
      enlace("verificar", token),
      "",
      "El enlace vence en 24 horas y solo se puede usar una vez.",
      "Si no creaste esta cuenta, ignora este mensaje: sin confirmar el correo no se puede firmar.",
      "",
      "Blink Web Services",
    ].join("\n"),
  });
}

export async function enviarRecuperacion(correo: string, token: string): Promise<Envio> {
  return enviarCorreo({
    para: correo,
    asunto: "Restablecer la clave del portal de Blink Web Services",
    texto: [
      "Hola.",
      "",
      "Pediste restablecer la clave del portal. Abre este enlace y elige una nueva:",
      "",
      enlace("recuperar", token),
      "",
      "El enlace vence en una hora y solo se puede usar una vez. Al cambiar la clave se cierran todas las sesiones abiertas.",
      "Si no lo pediste, no hagas nada: tu clave actual sigue funcionando.",
      "",
      "Blink Web Services",
    ].join("\n"),
  });
}

export interface ClienteCuenta {
  id: string;
  razon_social: string;
  documento_tipo: string;
  documento_numero: string;
  domicilio_fiscal: string;
  telefono: string;
  correo_factura: string;
}

export interface FirmaCuenta {
  id: string;
  sha256: string;
  utc: string;
  metodo: string;
  version: number;
  hash_consentimiento: string;
}

export interface EstadoCuenta {
  usuario: {
    nombre: string;
    correo: string;
    rol: "cliente" | "admin";
    verificado: boolean;
  };
  cliente: ClienteCuenta | null;
  firma: FirmaCuenta | null;
}

export async function estadoDe(sesion: Sesion): Promise<EstadoCuenta> {
  const [clientes, firmas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select c.id, c.razon_social, c.documento_tipo, c.documento_numero,
               c.domicilio_fiscal, c.telefono, c.correo_factura
        from clientes c where c.usuario_id = ${sesion.usuarioId}`,
    txn`select f.id, f.sha256, f.utc, f.metodo, f.version, f.hash_consentimiento
        from firmas_cliente f
        join clientes c on c.firma_actual = f.id
        where c.usuario_id = ${sesion.usuarioId}`,
  ]);

  const cliente = clientes[0] as Record<string, unknown> | undefined;
  const firma = firmas[0] as Record<string, unknown> | undefined;

  return {
    usuario: {
      nombre: sesion.nombre,
      correo: sesion.correo,
      rol: sesion.rol,
      verificado: sesion.verificado,
    },
    cliente: cliente
      ? {
          id: cliente.id as string,
          razon_social: cliente.razon_social as string,
          documento_tipo: cliente.documento_tipo as string,
          documento_numero: cliente.documento_numero as string,
          domicilio_fiscal: cliente.domicilio_fiscal as string,
          telefono: cliente.telefono as string,
          correo_factura: cliente.correo_factura as string,
        }
      : null,
    firma: firma
      ? {
          id: firma.id as string,
          sha256: firma.sha256 as string,
          utc: new Date(firma.utc as string).toISOString(),
          metodo: firma.metodo as string,
          version: Number(firma.version),
          hash_consentimiento: firma.hash_consentimiento as string,
        }
      : null,
  };
}
