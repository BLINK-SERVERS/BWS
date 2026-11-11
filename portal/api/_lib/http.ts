/* ============================================================
   Utilidades HTTP de las funciones
   ------------------------------------------------------------
   Las respuestas nunca se cachean: aquí viajan firmas, sesiones y
   datos fiscales. El cuerpo de error es siempre el mismo formato
   (`{ error, codigo? }`) para que la interfaz lo muestre tal cual.
   ============================================================ */

const CABECERAS_BASE = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(
  cuerpo: unknown,
  estado = 200,
  cabeceras: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS_BASE, ...cabeceras },
  });
}

export async function leerJson<T>(peticion: Request): Promise<T | null> {
  const tipo = peticion.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().includes("application/json")) return null;
  try {
    return (await peticion.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Primer salto de `x-forwarded-for`; en Vercel es la IP del cliente.
 * Solo se acepta una forma de IPv4 o IPv6: la columna es `inet` y un
 * valor inventado en la cabecera no debe romper la petición.
 */
export function ipDe(peticion: Request): string | null {
  const reenviada = peticion.headers.get("x-forwarded-for");
  const ip = reenviada?.split(",")[0]?.trim() || peticion.headers.get("x-real-ip")?.trim();
  if (!ip || ip.length > 45) return null;
  const sinCorchetes = ip.replace(/^\[|\]$/g, "");
  const sinPuerto = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(sinCorchetes)
    ? sinCorchetes.replace(/:\d+$/, "")
    : sinCorchetes;
  return /^[0-9a-fA-F:.]+$/.test(sinPuerto) ? sinPuerto : null;
}

export function agenteDe(peticion: Request): string | null {
  const agente = peticion.headers.get("user-agent");
  return agente ? agente.slice(0, 300) : null;
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

export function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}
