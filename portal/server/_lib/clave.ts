/* ============================================================
   Claves con scrypt
   ------------------------------------------------------------
   Se usa `node:crypto`, sin dependencias nativas. El formato
   guardado incluye los parámetros para poder subirlos más adelante
   sin invalidar las claves existentes:

     scrypt$N$r$p$sal$derivada     (sal y derivada en base64url)

   La comparación es de tiempo constante. Cuando el correo no
   existe se verifica igual contra un hash de relleno, para que el
   tiempo de respuesta no revele si la cuenta existe.
   ============================================================ */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  clave: string | Buffer,
  sal: string | Buffer,
  largo: number,
  opciones: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 32768;
const R = 8;
const P = 1;
const LARGO = 64;
const MAXMEM = 96 * 1024 * 1024;

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = await scrypt(clave, sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64url")}$${derivada.toString("base64url")}`;
}

export async function verificarClave(clave: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const n = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (
    !Number.isInteger(n) || n < 2 || n > 2 ** 20 ||
    !Number.isInteger(r) || r < 1 || r > 32 ||
    !Number.isInteger(p) || p < 1 || p > 8
  ) {
    return false;
  }

  const sal = Buffer.from(partes[4], "base64url");
  const esperada = Buffer.from(partes[5], "base64url");
  if (!sal.length || esperada.length !== LARGO) return false;

  const derivada = await scrypt(clave, sal, esperada.length, {
    N: n,
    r,
    p,
    maxmem: 128 * n * r + 1024 * 1024,
  });
  return derivada.length === esperada.length && timingSafeEqual(derivada, esperada);
}

let relleno: Promise<string> | null = null;

/** Verifica; si no hay hash (cuenta inexistente) gasta el mismo trabajo. */
export async function verificarConRelleno(clave: string, almacenado: string | null): Promise<boolean> {
  if (!almacenado) {
    relleno ??= hashearClave(randomBytes(18).toString("base64url"));
    await verificarClave(clave, await relleno);
    return false;
  }
  return verificarClave(clave, almacenado);
}
