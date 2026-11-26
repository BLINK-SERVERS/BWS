import { DurableObject } from "cloudflare:workers";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { ingresar, registrar, salir, sesion } from "./server/auth";
import { ErrorHttp, json } from "./server/http";

const LARGO_CLAVE = 64;

function validarClave(clave: unknown): asserts clave is string {
  if (typeof clave !== "string" || clave.length < 10 || clave.length > 128) {
    throw new Error("La contraseña no tiene un formato válido.");
  }
}

async function derivar(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(clave, sal, LARGO_CLAVE, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 96 * 1024 * 1024,
    }, (error, derivada) => {
      if (error) reject(error);
      else resolve(derivada);
    });
  });
}

function decodificarBase64(valor: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) return null;
  try {
    return Buffer.from(valor, "base64url");
  } catch {
    return null;
  }
}

export class Clave extends DurableObject<Env> {
  async hashear(clave: string): Promise<string> {
    validarClave(clave);
    const sal = randomBytes(16);
    const derivada = await derivar(clave, sal);
    return `scrypt$32768$8$1$${sal.toString("base64url")}$${derivada.toString("base64url")}`;
  }

  async verificar(clave: string, almacenado: string | null): Promise<boolean> {
    validarClave(clave);
    if (!almacenado) {
      await derivar(clave, randomBytes(16));
      return false;
    }

    const partes = almacenado.split("$");
    if (partes.length !== 6 || partes[0] !== "scrypt" || partes[1] !== "32768" || partes[2] !== "8" || partes[3] !== "1") {
      return false;
    }
    const sal = decodificarBase64(partes[4]);
    const esperada = decodificarBase64(partes[5]);
    if (!sal || sal.length !== 16 || !esperada || esperada.length !== LARGO_CLAVE) return false;

    const calculada = await derivar(clave, sal);
    return timingSafeEqual(calculada, esperada);
  }
}

function metodoNoPermitido(permitido: string): Response {
  return json({ error: "Método no permitido.", codigo: "metodo" }, 405, { allow: permitido });
}

async function api(peticion: Request, env: Env): Promise<Response> {
  const ruta = new URL(peticion.url).pathname;
  if (ruta === "/api/auth/registro") return peticion.method === "POST" ? registrar(peticion, env) : metodoNoPermitido("POST");
  if (ruta === "/api/auth/ingreso") return peticion.method === "POST" ? ingresar(peticion, env) : metodoNoPermitido("POST");
  if (ruta === "/api/auth/salir") return peticion.method === "POST" ? salir(peticion, env) : metodoNoPermitido("POST");
  if (ruta === "/api/auth/sesion") return peticion.method === "GET" ? sesion(peticion, env) : metodoNoPermitido("GET");
  return json({ error: "No encontramos ese recurso.", codigo: "no_encontrado" }, 404);
}

function activos(peticion: Request, env: Env): Promise<Response> {
  const url = new URL(peticion.url);
  if (url.pathname === "/" || url.pathname === "/cars") return Promise.resolve(new Response(null, { status: 308, headers: { location: "/cars/" } }));
  url.pathname = url.pathname.replace(/^\/cars(?=\/|$)/, "") || "/";
  return env.ASSETS.fetch(new Request(url, peticion));
}

function asegurar(respuesta: Response, entorno: string): Response {
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set("x-content-type-options", "nosniff");
  cabeceras.set("referrer-policy", "strict-origin-when-cross-origin");
  cabeceras.set("x-frame-options", "DENY");
  cabeceras.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  cabeceras.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  if (entorno !== "local") cabeceras.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras });
}

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    try {
      const ruta = new URL(peticion.url).pathname;
      const respuesta = ruta === "/api" || ruta.startsWith("/api/") ? await api(peticion, env) : await activos(peticion, env);
      return asegurar(respuesta, env.ENTORNO);
    } catch (error) {
      if (error instanceof ErrorHttp) {
        return asegurar(json({ error: error.message, codigo: error.codigo }, error.estado, error.cabeceras), env.ENTORNO);
      }
      console.error(JSON.stringify({ nivel: "error", evento: "ruta.error", mensaje: error instanceof Error ? error.message : "Error desconocido" }));
      return asegurar(json({ error: "No pudimos completar la operación. Inténtalo de nuevo.", codigo: "interno" }, 500), env.ENTORNO);
    }
  },
};
