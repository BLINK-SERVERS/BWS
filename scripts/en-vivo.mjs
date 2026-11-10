/* ============================================================
   en-vivo.mjs — la página publicada, no la de `npm run preview`
   ------------------------------------------------------------
   Comprueba de arriba abajo lo que contesta `https://bws.blink.com.ve`:
   el registro, el certificado, cada ruta del `dist/` y, al final, un
   render real en Chromium sobre el dominio. Es el paso 3 del checklist
   de `README.md`, que hasta ahora había que hacer a mano.

   Dos detalles que explican las banderas:

   · Se resuelve con `dig @1.1.1.1` y luego se fuerza la IP con
     `--resolve` en curl y con `--host-resolver-rules` en el navegador.
     El resolver del router de esta casa se quedó con la respuesta
     negativa de antes del registro (TTL mínimo 1800 s en la zona), así
     que mirar por la caché local diría «no existe» sobre un sitio que
     sí está sirviendo.
   · `ignoreHTTPSErrors` en el render: hasta que GitHub emite el
     certificado propio del dominio, el edge contesta el comodín
     `*.github.io`, que no ampara a `bws.blink.com.ve`. Se comprueba el
     certificado por separado y se reporta; no se finge que pasó.

     VIVO_HOST=bws.blink.com.ve CHROMIUM_PATH=/usr/bin/chromium node scripts/en-vivo.mjs
   ============================================================ */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright-core";

const promesa = promisify(execFile);
const HOST = process.env.VIVO_HOST ?? "bws.blink.com.ve";
const LARGO = `https://${HOST}/`;
const fallos = [];
const dice = (etiqueta, valor) =>
  console.log(`  ${etiqueta.padEnd(26)} ${valor}`);

/** `dig` sin depender de la caché del equipo. */
async function dns(resolver, tipo) {
  try {
    const { stdout } = await promesa("dig", [`+short`, `@${resolver}`, HOST, tipo], {
      timeout: 20_000,
    });
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** El certificado que presenta el edge para este nombre. */
async function certificado(ip) {
  try {
    const { stdout } = await promesa(
      "sh",
      ["-c", `echo | openssl s_client -connect ${ip}:443 -servername ${HOST} 2>/dev/null | openssl x509 -noout -subject -issuer -enddate -ext subjectAltName`],
      { timeout: 30_000 },
    );
    const san = (stdout.match(/DNS:[^\n]*/)?.[0] ?? "").replace("DNS:", "");
    const ampara = san
      .split(",")
      .map((s) => s.trim())
      .some((entrada) =>
        entrada.startsWith("*.")
          ? HOST.endsWith(entrada.slice(1)) && HOST.split(".").length === entrada.split(".").length
          : entrada === HOST,
      );
    return {
      sujeto: stdout.match(/subject=\s*(.+)/)?.[1] ?? "?",
      emisor: stdout.match(/issuer=\s*(.+)/)?.[1] ?? "?",
      vence: stdout.match(/notAfter=\s*(.+)/)?.[1] ?? "?",
      ampara,
    };
  } catch {
    return null;
  }
}

/** `curl` con la IP inyectada, para no pelear con la caché local. El
    `-k` es obligatorio mientras el edge sirve el comodín `*.github.io`:
    el estado real del certificado lo reporta la sección de arriba, no
    tiene por qué aparecer aquí como un error de transporte. */
async function http(ip, ruta) {
  const args = ["-sk", "-o", "/dev/null", "-w", "%{http_code} %{size_download}"];
  args.push("--resolve", `${HOST}:443:${ip}`, `https://${HOST}${ruta}`);
  try {
    const { stdout } = await promesa("curl", args, { timeout: 60_000 });
    return stdout.trim();
  } catch (e) {
    return `error ${e.code ?? "?"}`;
  }
}

/** Pedido `http://` (puerto 80) con la IP inyectada. Devuelve el código,
    la cabecera `Location` y la IP que contestó, para poder comprobar el
    forzado de HTTPS sin depender de la caché del resolver de esta casa. */
async function salto(ip, ruta) {
  const args = ["-s", "-o", "/dev/null", "-D", "-", "-w", "%{http_code} %{remote_ip}",
                "--resolve", `${HOST}:80:${ip}`, `http://${HOST}${ruta}`];
  try {
    const { stdout } = await promesa("curl", args, { timeout: 60_000 });
    const lineas = stdout.trim().split(/\r?\n/);
    const cola = lineas[lineas.length - 1].split(" ");
    return {
      code: Number(cola[0]),
      location: lineas.find((l) => /^location:/i.test(l))?.replace(/^location:\s*/i, "").trim(),
      ip: cola[1] ?? ip,
    };
  } catch {
    return { code: 0, location: undefined, ip };
  }
}

async function cuerpo(ip, ruta) {
  const args = ["-sk", "--resolve", `${HOST}:443:${ip}`, `https://${HOST}${ruta}`];
  try {
    const { stdout } = await promesa("curl", args, { timeout: 60_000 });
    return stdout;
  } catch {
    return "";
  }
}

/* --- 1. el registro -------------------------------------------------- */
console.log(`\n=== DNS de ${HOST} ===`);
const [cname11, cname88] = [await dns("1.1.1.1", "CNAME"), await dns("8.8.8.8", "CNAME")];
/* `dig +short ... A` devuelve primero el alias y luego las direcciones:
   si se toma el primer elemento se acaba pasando el nombre como IP y
   curl responde 49 («invalid IP address» en `--resolve`). Solo IPv4. */
const ips = (await dns("1.1.1.1", "A")).filter((c) => /^\d+\.\d+\.\d+\.\d+$/.test(c));
dice("CNAME @1.1.1.1", cname11.join(" ") || "NO HAY REGISTRO");
dice("CNAME @8.8.8.8", cname88.join(" ") || "NO HAY REGISTRO");
dice("A", ips.join(" ") || "sin dirección");
if (!cname11.length) fallos.push("el CNAME no resuelve en 1.1.1.1");
if (cname11[0] !== "blink-servers.github.io.")
  fallos.push(`el CNAME apunta a ${cname11[0] ?? "?"}, se esperaba blink-servers.github.io.`);
const IP = ips[0] ?? "185.199.108.153";

/* --- 2. el certificado ----------------------------------------------- */
console.log("\n=== TLS ===");
const cert = await certificado(IP);
if (cert) {
  dice("sujeto", cert.sujeto);
  dice("emisor", cert.emisor.replace(/^.*CN = /, ""));
  dice("vence", cert.vence);
  dice("ampara el nombre", cert.ampara ? "sí" : "NO — sirve el comodín de github.io");
  if (!cert.ampara) fallos.push("el certificado aún no cubre el dominio (emisión en curso)");
} else {
  dice("sujeto", "no se pudo leer");
  fallos.push("no se pudo leer el certificado");
}

/* --- 3. el forzado --------------------------------------------------- */
/* Con *Enforce HTTPS* apagado el edge contesta `200` por `http://` en
   lugar de redirigir; con él encendido, `/` debe dar `301` y una sola
   vez. Se pide con la IP inyectada para no depender de la caché local. */
console.log(`\n=== http:// → https:// ===`);
const red = await salto(IP, "/");
dice("301 esperado", `${red.code} → ${red.location || "(sin Location)"}`);
if (red.code !== 301) fallos.push(`http:// responde ${red.code}, se esperaba 301 (forzado apagado)`);
else if (red.location !== `https://${HOST}/`) fallos.push(`el 301 lleva a ${red.location}, se esperaba https://${HOST}/`);
const salto2 = await promesa(
  "curl",
  ["-s", "-o", "/dev/null", "-w", "%{http_code} %{num_redirects} %{ssl_verify_result} %{url_effective}",
   "-L", "--resolve", `${HOST}:80:${IP}`, "--resolve", `${HOST}:443:${IP}`, `http://${HOST}/`],
  { timeout: 60_000 },
).then(({ stdout }) => stdout.trim()).catch(() => "error");
dice("siguiendo el salto", salto2);
if (!/^200 1 0 /.test(salto2)) fallos.push("seguir el 301 no aterriza en 200 con TLS verificado");

/* --- 4. las rutas ---------------------------------------------------- */
console.log("\n=== rutas del dist publicado ===");
const pagina = await cuerpo(IP, "/");
const A = pagina.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? "";
const C = pagina.match(/assets\/index-[A-Za-z0-9_-]+\.css/)?.[0] ?? "";
/* La fuente no la referencia `index.html` sino el CSS, con una ruta
   relativa al directorio de `assets/`. */
const RUTAS = ["/", "/404.html", "/robots.txt", "/sitemap.xml", "/favicon.svg", "/favicon.png", "/og.png", `/${A}`, `/${C}`];
const respuestas = new Map();
for (const r of RUTAS) {
  const c = await http(IP, r);
  respuestas.set(r, c);
  dice(r, c);
}
const ausentes = RUTAS.filter((r) => !respuestas.get(r).startsWith("200"));
if (ausentes.length) fallos.push(`no responden 200: ${ausentes.join(", ")}`);

const css = await cuerpo(IP, `/${C}`);
/* Las fuentes no las referencia `index.html` sino el CSS, con rutas
   relativas al directorio de `assets/`. Se comprueban las dos: la cara
   servida de SF Pro (el recorte del repo, `npm run sf-pro`) y el
   respaldo de Inter. */
for (const nombre of ["sf-pro-latin", "inter-latin"]) {
  /* El grupo captura DENTRO de `url(...)` y cierra antes del `)` final:
     la primera versión llevaba `[^")]` dentro del grupo, el paréntesis
     de la clase no cerraba el grupo y `new RegExp` reventaba en tiempo
     de ejecución — un literal inválido se detecta al parsear el
     fichero, uno construido desde cadena no, así que `node --check` lo
     daba por bueno. */
  const W = (
    css.match(new RegExp(`url\\(\\s*["']?([^"')]*${nombre}[^"')]*\\.woff2)`))?.[1] ?? ""
  ).replace(/^\.\.\//, "/");
  if (!W) {
    fallos.push(`el CSS publicado no referencia ${nombre}.woff2`);
    continue;
  }
  const ruta = W.startsWith("/") ? W : `/assets/${W}`;
  const c = await http(IP, ruta);
  dice(`/…${nombre}.woff2`, `${c}  (${ruta})`);
  if (!c.startsWith("200")) fallos.push(`no responde ${nombre}.woff2`);
}

/* --- 5. lo que dice el HTML servido ---------------------------------- */
console.log("\n=== copy servido ===");
const titulo = pagina.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
dice("<title>", titulo);
dice("«dos cosas» / «planes»", `${(pagina.match(/dos cosas/g) ?? []).length} / ${(pagina.match(/planes/g) ?? []).length}`);
dice("og:image", pagina.match(/property="og:image" content="([^"]*)"/)?.[1] ?? "?");
dice("canonical", pagina.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? "?");
if (!titulo.includes("dos cosas")) fallos.push("el title servido no trae la frase ancla nueva");
if (/planes/.test(pagina)) fallos.push("el HTML servido todavía dice «planes»");
const og = await promesa("sh", ["-c", `curl -sk --resolve ${HOST}:443:${IP} https://${HOST}/og.png | identify -format "%wx%h" -`]).catch(() => null);
dice("og.png", og ? `${og.stdout.trim()} px` : "sin medir");

/* --- 6. render real sobre el dominio --------------------------------- */
console.log("\n=== render en Chromium ===");
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--host-resolver-rules=MAP ${HOST} ${IP}`,
  ],
});
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const lienzo = await contexto.newPage();
const errores = [];
lienzo.on("console", (m) => m.type() === "error" && errores.push(m.text()));
lienzo.on("pageerror", (e) => errores.push(String(e)));
await lienzo.goto(LARGO, { waitUntil: "domcontentloaded", timeout: 300_000 });
await lienzo.evaluate(() => document.fonts.ready);

const visto = await lienzo.evaluate(() => {
  const texto = (s) => document.querySelector(s)?.textContent?.trim() ?? null;
  /* El `<h1>` del hero arrastra un `<span class="visualmente-oculto">`
     con el nombre largo de la marca, que está fuera de flujo pero sí
     cuenta en `textContent`. Para comparar con la frase ancla se toman
     solo los nodos de texto sueltos. */
  const h1 = document.querySelector(".lp-hero__titular");
  const ancla = [...(h1?.childNodes ?? [])]
    .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 10)
    .map((n) => n.textContent.trim())
    .join(" ");
  const visible = (s) => {
    const n = document.querySelector(s);
    if (!n) return false;
    const c = getComputedStyle(n);
    return c.display !== "none" && c.visibility !== "hidden" && n.getBoundingClientRect().width > 0;
  };
  return {
    ancla,
    oculto: h1?.querySelector(".visualmente-oculto")?.textContent?.trim() ?? null,
    sub: texto(".lp-hero__sub"),
    wordmark: visible(".lp-marca-bws__blink svg"),
    descriptor: texto(".lp-marca-bws__sub--largo"),
    socios: document.querySelectorAll('.lp-cinta__fila:not([aria-hidden="true"]) > li').length,
    /* La cinta pinta cuatro juegos por fila: uno accesible y tres
       copias en `aria-hidden`. El recuento de los `<img>` de la cinta
       dice si las copias están, y `logosRotos` es la única prueba de
       que los PNG con nombre hasheado salieron del despliegue. */
    logos: document.querySelectorAll(".lp-cinta img").length,
    logosRotos: [...document.querySelectorAll(".lp-cinta img")]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.alt),
    cinta: [...document.querySelectorAll(".lp-cinta__pista")].map((pista) => {
      const juego = pista.querySelector(":scope > .lp-cinta__fila");
      const dur = parseFloat(getComputedStyle(pista).animationDuration);
      return {
        escalon: pista.dataset.escalon,
        nombre: getComputedStyle(pista).animationName,
        juego: Math.round(juego.getBoundingClientRect().width),
        pista: Math.round(pista.getBoundingClientRect().width),
        pxs: Math.round(juego.getBoundingClientRect().width / dur),
      };
    }),
    pasos: document.querySelectorAll(".lp-paso__titulo").length,
    beneficios: document.querySelectorAll(".lp-beneficio").length,
    servicios: document.querySelectorAll(".lp-pieza").length,
    promesa: texto(".lp-promesa"),
    /* La promesa se quedó sin subtítulo: si vuelve a aparecer un hijo
       dentro de su sección, alguien reinsertó la línea que se borró. */
    promesaHijos: document.querySelectorAll(".lp-promesa > *").length,
    /* Los tres botones «Hablemos» (barra, hero y cierre) tienen que
       salir hacia WhatsApp, no al formulario de antes. */
    hablemos: [...document.querySelectorAll(".lp-nav__cta, .lp-hero__cta a, .lp-cierre__cta a")]
      .map((a) => `${a.textContent.trim().slice(0, 14)} → ${a.getAttribute("href")}`),
    contacto: [...document.querySelectorAll(".lp-cierre a")].map((a) => a.getAttribute("href")),
    desborda: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    /* Qué voz está usando el dominio de verdad. `fonts.check` vale true
       tanto si la cara viene del sistema (`local()` en un dispositivo
       Apple) como si se bajó el recorte del repo; lo que no puede pasar
       es que la página se publique en Segoe UI o en la pila del sistema. */
    sfPro: document.fonts.check('500 16px "SF Pro"'),
    woff2: performance
      .getEntriesByType("resource")
      .map((e) => e.name.split("/").pop())
      .filter((n) => n.endsWith(".woff2")),
  };
});

/* el acordeón: se abre de verdad, en el dominio, no en local */
const boton = await lienzo.$(".lp-acordeon__boton");
await boton?.click();
await lienzo.waitForTimeout(600);
const bandeja = await lienzo.evaluate(() => {
  const b = document.querySelector(".lp-acordeon__boton");
  const r = document.querySelector(".lp-acordeon__respuesta");
  return { expandido: b?.getAttribute("aria-expanded"), alto: Math.round(r?.getBoundingClientRect().height ?? 0) };
});

dice("frase ancla", visto.ancla ?? "?");
dice("prefijo oculto", visto.oculto ?? "?");
dice("bajada del hero", visto.sub ?? "?");
dice("lockup", `${visto.wordmark ? "wordmark pintado" : "SIN wordmark"} + «${visto.descriptor ?? "?"}»`);
dice(
  "piezas",
  `beneficios ${visto.beneficios} · servicios ${visto.servicios} · pasos ${visto.pasos} · aliados ${visto.socios}`,
);
dice(
  "cinta",
  visto.cinta
    .map((c) => `fila ${c.escalon}: ${c.nombre} ${c.pxs} px/s · juego ${c.juego} px · pista ${c.pista} px`)
    .join("   |   ") + ` · ${visto.logos} lockups pintados`,
);
dice("promesa", visto.promesa ?? "?");
dice("botones", visto.hablemos.join("   |   "));
dice("contacto", visto.contacto.join("  "));
dice("acordeón", `aria-expanded=${bandeja.expandido} · respuesta ${bandeja.alto} px alta`);
dice("overflow horizontal", `${visto.desborda} px`);
dice("tipografía", `${visto.sfPro ? "SF Pro" : "SIN SF Pro"} · descargas ${visto.woff2.join(", ") || "ninguna (local)"}`);
dice("errores de consola", errores.length ? errores.join(" | ") : "0");
await lienzo.screenshot({ path: ".capturas/vivo-1440.png", fullPage: true });
/* El HTML ya renderizado, capturado ANTES de cerrar el navegador: las
   frases borradas solo se comprueban sobre lo que de verdad se pintó
   (el `index.html` servido es un envoltorio vacío). */
const render = await lienzo.content();
await navegador.close();

if (visto.ancla !== "Solo traes dos cosas: una idea y el dinero.")
  fallos.push(`la frase ancla renderizada es «${visto.ancla}»`);
if (visto.sub !== "Nosotros nos encargamos del resto.")
  fallos.push(`la bajada del hero es «${visto.sub}»`);
if (!/Blink Web Services/.test(visto.oculto ?? ""))
  fallos.push("el h1 no lleva el nombre largo de la marca");
if (visto.beneficios !== 4 || visto.servicios !== 3 || visto.pasos !== 3)
  fallos.push(`el recuento de piezas cambió: ${visto.beneficios}/${visto.servicios}/${visto.pasos}`);
if (visto.socios !== 9) fallos.push(`la cinta de aliados tiene ${visto.socios} marcas`);
if (visto.logosRotos.length) fallos.push(`lockups que no cargan: ${visto.logosRotos.join(", ")}`);
/* Cuatro juegos por fila y el keyframe en -25%: si la pista no mide
   cuatro veces el juego, la costura baila en cada vuelta. */
for (const c of visto.cinta) {
  if (Math.abs(c.pista - c.juego * 4) > 1)
    fallos.push(`la pista ${c.escalon} no es cuatro juegos exactos (${c.pista} vs ${c.juego * 4})`);
  if (c.nombre !== "lp-cinta") fallos.push(`la pista ${c.escalon} no se anima (${c.nombre})`);
}
if (!/misma tecnolog/.test(visto.promesa ?? ""))
  fallos.push("la promesa literal no está en el DOM publicado");
if (visto.promesaHijos > 0) fallos.push("la promesa volvió a llevar subtítulo");
/* De la lista solo se juzgan los enlaces que PROMETEN la conversación:
   los tres «Hablemos» y el botón de WhatsApp del cierre. Del mismo
   contenedor cuelgan el «Ver qué hacemos» del hero (ancla interna) y el
   teléfono y el correo del cierre, y exigirles `wa.me` era un falso
   positivo del selector, no un fallo del sitio. */
const prometeCharla = (l) => /^(Hablemos|Escribir por WhatsApp)/.test(l.split("→")[0].trim());
const sinWhatsapp = visto.hablemos.filter(
  (l) => prometeCharla(l) && !/wa\.me\/16318211938/.test(l.split("→")[1] ?? ""),
);
if (sinWhatsapp.length) fallos.push(`botones que no llevan a WhatsApp: ${sinWhatsapp.join(" | ")}`);
const prohibidas = [["división de Blink", /divisi[oó]n de Blink/i], ["Cuatro cosas", /Cuatro cosas/]];
for (const [nombre, re] of prohibidas) {
  if (re.test(render)) fallos.push(`el sitio publicado todavía menciona «${nombre}»`);
}
if (bandeja.expandido !== "true" || bandeja.alto < 20) fallos.push("el acordeón no se abrió en el dominio");
if (!visto.sfPro) fallos.push("el dominio no está renderizando con SF Pro");
if (visto.desborda > 0) fallos.push(`el documento desborda ${visto.desborda} px`);
if (errores.length) fallos.push(`${errores.length} errores de consola`);

console.log(
  fallos.length
    ? `\n=== ${fallos.length} pendiente(s) ===\n- ${fallos.join("\n- ")}\n`
    : "\n=== publicado y sirviendo: todo en orden ===\n",
);
process.exit(fallos.length ? 1 : 0);
