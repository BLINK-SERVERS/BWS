/* ============================================================
   Entrada del Worker de Cloudflare
   ------------------------------------------------------------
   `run_worker_first: ["/api/*"]` manda la API aquí; el resto de
   rutas las sirve la capa de assets, con `index.html` como
   respaldo. Las cabeceras de la API se fijan en este archivo
   porque `_headers` solo aplica a respuestas de assets.
   ============================================================ */

import despachar from "./api/[...ruta]";
import { configurarFuentes } from "./render/fuentes";
import { lectorWorker } from "./render/fuentes-worker";

interface Entorno {
  ASSETS: { fetch(peticion: Request): Promise<Response> };
}

configurarFuentes(lectorWorker);

const SEGURIDAD: Record<string, string> = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};

function conCabeceras(respuesta: Response, api: boolean): Response {
  const cabeceras = new Headers(respuesta.headers);
  for (const [nombre, valor] of Object.entries(SEGURIDAD)) cabeceras.set(nombre, valor);
  if (api) cabeceras.set("cache-control", "no-store");
  if (respuesta.status === 204 || respuesta.status === 304) {
    return new Response(null, { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras });
  }
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

export default {
  async fetch(peticion: Request, entorno: Entorno): Promise<Response> {
    const { pathname } = new URL(peticion.url);
    const api = pathname === "/api" || pathname.startsWith("/api/");
    try {
      const respuesta = api ? await despachar(peticion) : await entorno.ASSETS.fetch(peticion);
      return conCabeceras(respuesta, api);
    } catch (error) {
      console.error("Error en el Worker:", error instanceof Error ? error.message : error);
      return conCabeceras(
        new Response(JSON.stringify({ error: "Error interno." }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
        api,
      );
    }
  },
};
