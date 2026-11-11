/* ============================================================
   Servidor local del portal
   ------------------------------------------------------------
   Sirve `dist/` y ejecuta las funciones de `api/` con el mismo
   contrato que Vercel (`Request` → `Response`). No es el
   servidor de producción: es la forma de probar el flujo
   completo en un navegador sin desplegar.

   · `PORTAL_DB=pruebas` (por defecto) usa `DATABASE_URL_PRUEBAS_APP`
     y se niega a arrancar si apunta al mismo host que `DATABASE_URL`.
   · `PORTAL_DB=main` solo se usa a mano y nunca en las pruebas.
   · `CORREO_MODO=archivo` escribe los mensajes en `tmp/correo-portal/`.

   Uso:
     PORTAL_DB=pruebas PORT=4178 npm run portal
   ============================================================ */

import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cargarEnv } from "./_env.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const API = resolve(RAIZ, "api");
const DIST = resolve(RAIZ, "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** Carga `.env.local` sin imprimir valores y fija la base de pruebas. */
export function prepararEntorno(puerto) {
  const variables = cargarEnv();
  for (const [nombre, valor] of Object.entries(variables)) {
    if (!process.env[nombre]) process.env[nombre] = valor;
  }

  const cual = process.env.PORTAL_DB ?? "pruebas";
  if (cual === "pruebas") {
    const pruebas = process.env.DATABASE_URL_PRUEBAS_APP;
    if (!pruebas) {
      throw new Error("Falta DATABASE_URL_PRUEBAS_APP para el servidor de pruebas.");
    }
    const principal = process.env.DATABASE_URL;
    if (principal) {
      const host = (url) => new URL(url).hostname;
      if (host(pruebas) === host(principal)) {
        throw new Error("La base de pruebas y la principal comparten host: se cancela.");
      }
    }
    process.env.DATABASE_URL_APP = pruebas;
  } else if (cual !== "main") {
    throw new Error("PORTAL_DB solo acepta `pruebas` o `main`.");
  }

  process.env.ENTORNO ??= "local";
  process.env.APP_ORIGEN ??= `http://127.0.0.1:${puerto}`;
  if (process.env.ENTORNO === "local") process.env.CORREO_MODO ??= "archivo";
  process.env.CORREO_ARCHIVO_DIR ??= join(RAIZ, "tmp", "correo-portal");
}

async function leerCuerpo(req) {
  const partes = [];
  for await (const parte of req) partes.push(parte);
  return partes.length ? Buffer.concat(partes) : undefined;
}

/** Importa `api/<ruta>.ts` y devuelve su `default`, o null si no existe. */
async function buscarManejador(ruta) {
  const limpia = ruta.replace(/^\/api\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(limpia)) return null;
  const archivo = resolve(API, `${limpia}.ts`);
  if (!archivo.startsWith(API + sep) || !existsSync(archivo)) return null;
  const modulo = await import(pathToFileURL(archivo).href);
  return typeof modulo.default === "function" ? modulo.default : null;
}

async function atenderApi(req, res, url) {
  const manejador = await buscarManejador(url.pathname);
  if (!manejador) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "No existe esa ruta de la API." }));
    return;
  }

  const headers = new Headers();
  for (const [nombre, valor] of Object.entries(req.headers)) {
    if (Array.isArray(valor)) valor.forEach((v) => headers.append(nombre, v));
    else if (valor !== undefined) headers.set(nombre, valor);
  }
  if (!headers.has("x-forwarded-for") && req.socket.remoteAddress) {
    headers.set("x-forwarded-for", req.socket.remoteAddress.replace(/^::ffff:/, ""));
  }

  const cuerpo = req.method === "GET" || req.method === "HEAD" ? undefined : await leerCuerpo(req);
  const peticion = new Request(`http://${headers.get("host") ?? "127.0.0.1"}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: cuerpo,
  });

  const respuesta = await manejador(peticion);
  const cabeceras = {};
  respuesta.headers.forEach((valor, nombre) => {
    if (nombre.toLowerCase() === "set-cookie") return;
    cabeceras[nombre] = valor;
  });
  const cookies = typeof respuesta.headers.getSetCookie === "function"
    ? respuesta.headers.getSetCookie()
    : [];
  if (cookies.length) cabeceras["set-cookie"] = cookies;
  cabeceras["cache-control"] ??= "no-store";

  const bytes = Buffer.from(await respuesta.arrayBuffer());
  res.writeHead(respuesta.status, cabeceras);
  res.end(req.method === "HEAD" ? undefined : bytes);
}

async function atenderEstatico(req, res, url) {
  let ruta = decodeURIComponent(url.pathname);
  if (ruta.endsWith("/")) ruta += "index.html";
  let archivo = resolve(DIST, `.${ruta}`);
  if (!archivo.startsWith(DIST + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(archivo);
    if (info.isDirectory()) archivo = join(archivo, "index.html");
  } catch {
    // Sin extensión se devuelve la app; con extensión es un 404 real.
    if (extname(ruta)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("No encontrado");
      return;
    }
    archivo = join(DIST, "index.html");
  }
  if (!existsSync(archivo)) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    res.end("Falta `dist/`: ejecuta `npm run build` antes de servir.");
    return;
  }
  const bytes = await readFile(archivo);
  const tipo = TIPOS[extname(archivo)] ?? "application/octet-stream";
  res.writeHead(200, {
    "content-type": tipo,
    "cache-control": archivo.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : bytes);
}

export async function crearServidor({ puerto = 4178 } = {}) {
  prepararEntorno(puerto);
  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
      if (url.pathname.startsWith("/api/")) await atenderApi(req, res, url);
      else await atenderEstatico(req, res, url);
    } catch (error) {
      console.error("Error en el servidor local:", error instanceof Error ? error.message : error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Error interno");
    }
  });
  await new Promise((listo, fallo) => {
    servidor.once("error", fallo);
    servidor.listen(puerto, "127.0.0.1", listo);
  });
  return {
    servidor,
    origen: `http://127.0.0.1:${puerto}`,
    cerrar: () =>
      new Promise((listo) => {
        servidor.close(() => listo());
        servidor.closeAllConnections?.();
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puerto = Number(process.env.PORT ?? 4178);
  const { origen } = await crearServidor({ puerto });
  console.log(`Portal en ${origen} (base de pruebas, correo en archivo)`);
}
