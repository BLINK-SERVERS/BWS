import { createHash } from "node:crypto";

export class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly codigo?: string,
    readonly cabeceras?: Record<string, string>,
  ) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

export function json(datos: unknown, estado = 200, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cabeceras,
    },
  });
}

export async function leerJson(peticion: Request): Promise<unknown> {
  const tipo = peticion.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().includes("application/json")) {
    throw new ErrorHttp(415, "La petición debe usar JSON.", "formato");
  }
  const declarado = Number(peticion.headers.get("content-length") ?? "0");
  if (declarado > 16_384) throw new ErrorHttp(413, "La petición es demasiado grande.", "tamano");

  const lector = peticion.body?.getReader();
  if (!lector) throw new ErrorHttp(400, "No recibimos datos.", "vacio");

  const decodificador = new TextDecoder();
  let texto = "";
  let largo = 0;
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      largo += value.byteLength;
      if (largo > 16_384) throw new ErrorHttp(413, "La petición es demasiado grande.", "tamano");
      texto += decodificador.decode(value, { stream: true });
    }
    texto += decodificador.decode();
  } finally {
    lector.releaseLock();
  }

  try {
    return JSON.parse(texto) as unknown;
  } catch {
    throw new ErrorHttp(400, "No pudimos leer los datos enviados.", "json");
  }
}

export function cookiesDe(peticion: Request): Record<string, string> {
  const crudo = peticion.headers.get("cookie");
  if (!crudo) return {};
  const salida: Record<string, string> = {};
  for (const trozo of crudo.split(";")) {
    const corte = trozo.indexOf("=");
    if (corte < 1) continue;
    const nombre = trozo.slice(0, corte).trim();
    const valor = trozo.slice(corte + 1).trim();
    if (nombre) salida[nombre] = valor;
  }
  return salida;
}

export function hashLimite(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function ipDe(peticion: Request): string | null {
  const solicitud = peticion as Request & { cf?: { clientIp?: string } };
  const ip = solicitud.cf?.clientIp ?? peticion.headers.get("cf-connecting-ip");
  if (!ip) return null;
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

export function agenteDe(peticion: Request): string | null {
  return peticion.headers.get("user-agent")?.slice(0, 240) ?? null;
}

export function exigirOrigen(peticion: Request, entorno: string, origenConfigurado: string): void {
  const origen = peticion.headers.get("origin");
  const url = new URL(peticion.url);
  const permitidos = entorno === "local"
    ? [url.origin, `http://localhost:${url.port}`, `http://127.0.0.1:${url.port}`, origenConfigurado]
    : [origenConfigurado];
  if (!origen || !permitidos.includes(origen)) {
    throw new ErrorHttp(403, "El origen de la petición no está permitido.", "origen");
  }
}

export function codigoPostgres(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const codigo = error.code;
  return typeof codigo === "string" ? codigo : null;
}
