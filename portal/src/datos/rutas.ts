/* ============================================================
   Rutas del portal
   ------------------------------------------------------------
   Rutas reales, no hash: `/registro`, `/ingreso`, `/panel`. La
   landing vive en `/` y la sirve GitHub Pages; el Worker de
   Cloudflare intercepta solo estas rutas y `/api`.
   ============================================================ */

export const RUTAS = [
  "/ingreso",
  "/registro",
  "/panel",
  "/proyecto",
  "/admin",
  "/verificar",
  "/recuperar",
] as const;

export type Ruta = (typeof RUTAS)[number] | "/";

/** Ruta del portal para un `pathname`; lo desconocido cae en la portada. */
export function rutaDe(pathname: string): Ruta {
  const ruta = pathname.replace(/\/+$/, "") || "/";
  return (RUTAS as readonly string[]).includes(ruta) ? (ruta as Ruta) : "/";
}

export function rutaActual(): Ruta {
  return rutaDe(window.location.pathname);
}

export function navegar(destino: string): void {
  const ruta = destino.startsWith("/") ? destino : `/${destino}`;
  if (window.location.pathname + window.location.search === ruta) return;
  window.history.pushState(null, "", ruta);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
