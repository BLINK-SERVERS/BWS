/* ============================================================
   Sesiones opacas
   ------------------------------------------------------------
   El navegador guarda 32 bytes aleatorios; la base guarda solo su
   SHA-256. La cookie es `__Host-` (Secure, Path=/, sin Domain) en
   todo entorno que no sea local. No hay sesión deslizante: a las
   doce horas se vuelve a entrar.
   ============================================================ */

import { createHash, randomBytes } from "node:crypto";
import { db, enTransaccion } from "./db";
import { cookiesDe, ipDe } from "./http";

const HORAS = 12;

export function nombreCookie(): string {
  return process.env.ENTORNO === "local" ? "bws_sesion" : "__Host-bws_sesion";
}

export function tokenNuevo(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface Sesion {
  usuarioId: string;
  rol: "cliente" | "admin";
  nombre: string;
  correo: string;
  verificado: boolean;
  expira: Date;
}

export async function leerSesion(peticion: Request): Promise<Sesion | null> {
  const token = cookiesDe(peticion)[nombreCookie()];
  if (!token || token.length < 40 || token.length > 64) return null;

  const filas = await db()`select * from bws_sesion_valida(${hashToken(token)})`;
  if (!filas.length) return null;
  const fila = filas[0];
  return {
    usuarioId: fila.usuario_id as string,
    rol: fila.rol as "cliente" | "admin",
    nombre: fila.nombre as string,
    correo: fila.correo as string,
    verificado: Boolean(fila.verificado),
    expira: new Date(fila.expira as string),
  };
}

export async function crearSesion(
  usuarioId: string,
  rol: "cliente" | "admin",
  ip: string | null,
  agente: string | null,
): Promise<{ token: string; expira: Date }> {
  const token = tokenNuevo();
  const expira = new Date(Date.now() + HORAS * 60 * 60 * 1000);
  await enTransaccion(usuarioId, rol, (txn) => [
    txn`insert into sesiones (usuario_id, token_hash, expira, ip, agente)
        values (${usuarioId}, ${hashToken(token)}, ${expira.toISOString()}, ${ip}, ${agente})`,
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, ip, agente)
        values (${usuarioId}, ${rol}, 'sesion.iniciada', 'usuarios', ${usuarioId}, ${ip}, ${agente})`,
  ]);
  return { token, expira };
}

export function cookieDeSesion(token: string, expira: Date): string {
  const partes = [
    `${nombreCookie()}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expira.toUTCString()}`,
  ];
  if (process.env.ENTORNO !== "local") partes.push("Secure");
  return partes.join("; ");
}

export function cookieBorrada(): string {
  const partes = [
    `${nombreCookie()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    `Expires=${new Date(0).toUTCString()}`,
  ];
  if (process.env.ENTORNO !== "local") partes.push("Secure");
  return partes.join("; ");
}

export async function revocarSesion(peticion: Request, sesion: Sesion): Promise<void> {
  const token = cookiesDe(peticion)[nombreCookie()];
  if (!token) return;
  const ip = ipDe(peticion);
  await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`update sesiones set revocada = true
        where token_hash = ${hashToken(token)} and usuario_id = ${sesion.usuarioId}`,
    txn`insert into eventos (actor, rol, accion, entidad, entidad_id, ip)
        values (${sesion.usuarioId}, ${sesion.rol}, 'sesion.cerrada', 'usuarios',
                ${sesion.usuarioId}, ${ip})`,
  ]);
}
