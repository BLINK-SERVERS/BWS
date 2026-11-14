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
 * IP real del cliente. En producción el Worker la pone en
 * `cf-connecting-ip` leyéndola de `request.cf`, que es lo único que el
 * cliente no puede fingir; la cabecera viaja hasta el Durable Object.
 * El respaldo es el último salto de `x-forwarded-for`, que lo añade el
 * servidor local desde el socket.
 *
 * Se valida la forma exacta: la columna es `inet`, y un valor inventado
 * rompería la petición con un error de Postgres.
 */
const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEX = /^[0-9a-fA-F]{1,4}$/;

/** Cuántos grupos de 16 bits ocupa ese trozo; `null` si está mal formado. */
function contarGrupos(trozo: string): number | null {
  if (trozo === "") return 0;
  const partes = trozo.split(":");
  let n = 0;
  for (const [indice, parte] of partes.entries()) {
    if (parte.includes(".")) {
      // Un IPv4 incrustado solo vale al final y ocupa dos grupos.
      if (indice !== partes.length - 1 || !IPV4.test(parte)) return null;
      n += 2;
    } else if (parte === "" || !HEX.test(parte)) return null;
    else n += 1;
  }
  return n;
}

function esIPv6(valor: string): boolean {
  if (valor.length > 45 || valor.includes("%")) return false;
  const doble = valor.indexOf("::");
  if (doble !== -1 && valor.indexOf("::", doble + 1) !== -1) return false;
  if (doble === -1) {
    // Sin `::` los ocho grupos tienen que estar todos, sin huecos.
    if (valor.startsWith(":") || valor.endsWith(":")) return false;
    return contarGrupos(valor) === 8;
  }
  const izq = contarGrupos(valor.slice(0, doble));
  const der = contarGrupos(valor.slice(doble + 2));
  // El `::` guarda al menos un grupo de ceros, así que nunca llega a ocho.
  return izq !== null && der !== null && izq + der <= 7;
}

function formaDeIP(cruda: string | null): string | null {
  const bruto = (cruda ?? "").trim();
  const ip = bruto.startsWith("[") && bruto.endsWith("]") ? bruto.slice(1, -1) : bruto;
  if (!ip) return null;
  return IPV4.test(ip) || esIPv6(ip) ? ip : null;
}

export function ipDe(peticion: Request): string | null {
  const reenviada = peticion.headers.get("x-forwarded-for")?.split(",").at(-1) ?? null;
  return formaDeIP(peticion.headers.get("cf-connecting-ip")) ?? formaDeIP(reenviada);
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
