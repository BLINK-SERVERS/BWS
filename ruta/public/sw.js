const CACHE = "ruta-shell-v4";
const BASE = new URL("./", self.location.href).pathname;
const SHELL = ["manifest.webmanifest", "favicon.svg", "icono-192.png", "icono-512.png"].map((ruta) => BASE + ruta);

async function prepararShell() {
  const cache = await caches.open(CACHE);
  const respuesta = await fetch(BASE, { cache: "no-cache" });
  const html = await respuesta.clone().text();
  await cache.put(BASE, respuesta);
  await cache.addAll(SHELL);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((coincidencia) => coincidencia[1])
    .filter((ruta) => ruta.startsWith(`${BASE}assets/`));
  if (assets.length) await cache.addAll([...new Set(assets)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepararShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith(`${BASE}api/`)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          await cache.put(BASE, copy);
          return response;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  if (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}fotos/`) || url.pathname.startsWith(`${BASE}fonts/`)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (response) => {
            if (response.ok) {
              const copy = response.clone();
              const cache = await caches.open(CACHE);
              await cache.put(request, copy);
            }
            return response;
          }),
      ),
    );
  }
});
