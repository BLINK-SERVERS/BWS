import { createHash, randomBytes } from "node:crypto";

export const DURACION_SESION = 12 * 60 * 60;

export interface SesionCreada {
  token: string;
  tokenHash: string;
  expira: Date;
}

export function crearSesion(): SesionCreada {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expira: new Date(Date.now() + DURACION_SESION * 1_000),
  };
}

export function nombreCookie(local: boolean): string {
  return local ? "ruta_sesion" : "__Host-ruta_sesion";
}

export function cookieSesion(local: boolean, token: string, expira: Date): string {
  const nombre = nombreCookie(local);
  const partes = [
    `${nombre}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${DURACION_SESION}`,
    `Expires=${expira.toUTCString()}`,
  ];
  if (!local) partes.push("Secure");
  return partes.join("; ");
}

export function cookieSesionVacia(local: boolean): string {
  const partes = [`${nombreCookie(local)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (!local) partes.push("Secure");
  return partes.join("; ");
}
