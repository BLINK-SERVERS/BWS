/* ============================================================
   Entrada del Worker de Cloudflare
   ------------------------------------------------------------
   El Worker se engancha solo a las rutas del portal y a `/api`
   en `bws.blink.com.ve` (ver `wrangler.jsonc`); el resto de la
   landing lo sigue sirviendo GitHub Pages a través del proxy.
   Las páginas del portal (`/registro`, `/ingreso`, …) y sus
   archivos bajo `/portal/assets/` los sirve la capa de assets
   con `index.html` como respaldo, pero este Worker se ejecuta
   primero (ver `run_worker_first`) para fijar las cabeceras.
   La regla de caché inmutable no vive en `_headers`: esa capa
   también la aplica al respaldo HTML de un asset inexistente.

   El plan gratuito corta a 10 ms de CPU por solicitud: scrypt
   (0,5–1,4 s) y los ocho PDF (unos 12 s) no caben ahí. Esas rutas
   pasan por un Durable Object, que tiene 30 s de CPU por invocación
   sin cambiar de plan. `auth` y `expediente` son dos instancias
   distintas: un expediente largo no bloquea los ingresos.
   ============================================================ */

import despachar from "./api/[...ruta]";
import { configurarFuentes } from "./render/fuentes";
import { lectorWorker } from "./render/fuentes-worker";

interface EspacioDO {
  idFromName(nombre: string): unknown;
  get(id: unknown): { fetch(peticion: Request): Promise<Response> };
}

interface Entorno {
  ASSETS: { fetch(peticion: Request): Promise<Response> };
  CARGA: EspacioDO;
}

configurarFuentes(lectorWorker);

const PESADAS: Record<string, string> = {
  "/api/auth/registro": "auth",
  "/api/auth/ingreso": "auth",
  "/api/auth/restablecer": "auth",
  "/api/documentos/generar": "expediente",
};

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

function conCabeceras(respuesta: Response, api: boolean, ruta: string): Response {
  const cabeceras = new Headers(respuesta.headers);
  for (const [nombre, valor] of Object.entries(SEGURIDAD)) cabeceras.set(nombre, valor);
  if (api) cabeceras.set("cache-control", "no-store");
  else {
    // Nunca cachear como inmutable el respaldo SPA con forma de asset:
    // un archivo que no existe no debe quedar fijado con HTML.
    const tipo = respuesta.headers.get("content-type") ?? "";
    if (ruta.startsWith("/portal/assets/") && respuesta.ok && !tipo.startsWith("text/html"))
      cabeceras.set("cache-control", "public, max-age=31536000, immutable");
  }
  if (respuesta.status === 204 || respuesta.status === 304) {
    return new Response(null, { status: respuesta.status, statusText: respuesta.statusText, headers: cabeceras });
  }
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

export class Carga {
  async fetch(peticion: Request): Promise<Response> {
    return despachar(peticion);
  }
}

export default {
  async fetch(peticion: Request, entorno: Entorno): Promise<Response> {
    const { pathname } = new URL(peticion.url);
    const api = pathname === "/api" || pathname.startsWith("/api/");
    try {
      const pesada = PESADAS[pathname];
      if (pesada) {
        const id = entorno.CARGA.idFromName(pesada);
        return conCabeceras(await entorno.CARGA.get(id).fetch(peticion), true, pathname);
      }
      const respuesta = api ? await despachar(peticion) : await entorno.ASSETS.fetch(peticion);
      return conCabeceras(respuesta, api, pathname);
    } catch (error) {
      console.error("Error en el Worker:", error instanceof Error ? error.message : error);
      return conCabeceras(
        new Response(JSON.stringify({ error: "Error interno." }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
        api,
        pathname,
      );
    }
  },
};
