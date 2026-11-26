import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const baseURL = process.env.RUTA_URL ?? "http://127.0.0.1:5177/cars/";
const cookieSesion = new URL(baseURL).protocol === "https:" ? "__Host-ruta_sesion" : "ruta_sesion";
const capturas = process.env.RUTA_CAPTURAS ?? "/tmp/ruta-capturas";
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-VE", bypassCSP: true });
const pagina = await contexto.newPage();
const errores = [];

pagina.on("pageerror", (error) => errores.push(`pageerror: ${error.message}`));
pagina.on("console", (mensaje) => {
  if (mensaje.type() === "error") errores.push(`console: ${mensaje.text()} (${mensaje.location().url})`);
});
pagina.on("response", (respuesta) => {
  if (respuesta.url().startsWith(baseURL) && respuesta.status() >= 400) errores.push(`HTTP ${respuesta.status()}: ${respuesta.url()}`);
});

await mkdir(capturas, { recursive: true });

function ir(ruta = "/") {
  return pagina.goto(`${baseURL}#${ruta}`, { waitUntil: "networkidle" });
}

async function medirDesbordamiento() {
  return pagina.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    contenido: document.documentElement.scrollWidth,
    cuerpo: document.body.scrollWidth,
  }));
}

async function comprobarSinDesbordamiento() {
  const medida = await medirDesbordamiento();
  assert.ok(medida.contenido <= medida.ancho + 1 && medida.cuerpo <= medida.ancho + 1, `Desbordamiento horizontal: ${JSON.stringify(medida)}`);
}

async function auditar(nombre) {
  await pagina.addScriptTag({ path: axePath });
  const resultado = await pagina.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  }));
  if (resultado.violations.length) {
    const detalle = resultado.violations.map((violacion) => ({
      id: violacion.id,
      impacto: violacion.impact,
      ayuda: violacion.help,
      nodos: violacion.nodes.map((nodo) => ({ objetivo: nodo.target, fallo: nodo.failureSummary })),
    }));
    console.error(`Accesibilidad ${nombre}: ${JSON.stringify(detalle, null, 2)}`);
  }
  assert.equal(resultado.violations.length, 0, `axe encontró ${resultado.violations.length} incumplimientos en ${nombre}`);
  console.log(`PASS accesibilidad ${nombre}`);
}

async function comprobarObjetivosTactiles() {
  const pequenos = await pagina.evaluate(() => {
    const selector = "button, a.boton, .nav-inferior__enlace, .nav-inferior__publicar, .marca, .tarjeta-vehiculo a, .pie a";
    return [...document.querySelectorAll(selector)].flatMap((elemento) => {
      const estilo = getComputedStyle(elemento);
      const caja = elemento.getBoundingClientRect();
      if (estilo.display === "none" || estilo.visibility === "hidden" || caja.width === 0 || caja.height === 0) return [];
      return [{ texto: elemento.getAttribute("aria-label") ?? elemento.textContent?.trim() ?? elemento.tagName, ancho: caja.width, alto: caja.height }];
    }).filter((caja) => caja.alto < 44 || caja.ancho < 44);
  });
  assert.deepEqual(pequenos, [], `Objetivos táctiles menores de 44 px: ${JSON.stringify(pequenos)}`);
}

try {
  await ir();
  await pagina.getByRole("heading", { name: "Encuentra tu próximo carro." }).waitFor();
  assert.equal(await pagina.locator(".tarjeta-vehiculo").count(), 8);
  assert.equal(await pagina.title(), "Carros · Car Market");
  assert.doesNotMatch(await pagina.locator("body").innerText(), /Maracaibo y San Francisco/i);
  const identidad = await pagina.evaluate(() => ({
    negro: getComputedStyle(document.documentElement).getPropertyValue("--negro").trim(),
    gris: getComputedStyle(document.documentElement).getPropertyValue("--gris").trim(),
    blanco: getComputedStyle(document.documentElement).getPropertyValue("--blanco").trim(),
    fondo: getComputedStyle(document.body).backgroundColor,
    cuerpo: getComputedStyle(document.body).fontWeight,
    titulo: getComputedStyle(document.querySelector("h1")).fontWeight,
    logo: getComputedStyle(document.querySelector(".marca__texto strong")).fontWeight,
    fuenteLogo: getComputedStyle(document.querySelector(".marca__texto strong")).fontFamily,
  }));
  assert.deepEqual(identidad, {
    negro: "#000",
    gris: "#424242",
    blanco: "#fffefb",
    fondo: "rgb(255, 254, 251)",
    cuerpo: "400",
    titulo: "500",
    logo: "700",
    fuenteLogo: '"Samsung Sharp Sans", Inter, ui-sans-serif, system-ui, sans-serif',
  });
  assert.match(identidad.fuenteLogo, /Samsung Sharp Sans/);
  const publicar = pagina.locator(".catalogo__publicar");
  const fondoEnfasis = await publicar.evaluate((elemento) => getComputedStyle(elemento, "::before").backgroundImage);
  const sombraEnfasis = await publicar.evaluate((elemento) => getComputedStyle(elemento, "::before").boxShadow);
  assert.match(fondoEnfasis, /linear-gradient/);
  assert.match(sombraEnfasis, /inset/);
  assert.equal(await publicar.evaluate((elemento) => getComputedStyle(elemento).borderRadius), "8px");
  await publicar.hover();
  assert.notEqual(await publicar.evaluate((elemento) => getComputedStyle(elemento, "::before").backgroundImage), fondoEnfasis);
  await comprobarSinDesbordamiento();
  await auditar("catálogo");
  await pagina.screenshot({ path: `${capturas}/catalogo-1440.png`, fullPage: true });
  await pagina.getByLabel("Buscar carros").focus();
  assert.equal(await pagina.getByLabel("Buscar carros").evaluate((elemento) => getComputedStyle(elemento).outlineStyle), "solid");

  await pagina.evaluate(() => window.scrollTo(0, 0));
  await pagina.evaluate(() => window.scrollTo(0, 600));
  await pagina.waitForFunction(() => document.querySelector(".barra-superior")?.getAttribute("data-oculta") === "true");
  await pagina.locator(".barra-superior").waitFor({ state: "hidden" });
  await pagina.evaluate(() => window.scrollTo(0, 400));
  await pagina.waitForFunction(() => !document.querySelector(".barra-superior")?.hasAttribute("data-oculta"));
  await pagina.locator(".barra-superior").waitFor({ state: "visible" });
  await pagina.locator(".barra-superior__tema").focus();
  await pagina.evaluate(() => window.scrollTo(0, 800));
  assert.equal(await pagina.locator(".barra-superior").getAttribute("data-oculta"), null);
  assert.equal(await pagina.locator(".barra-superior__tema").evaluate((elemento) => elemento === document.activeElement), true);
  await pagina.evaluate(() => document.activeElement?.blur());
  await ir("/guardados");
  await pagina.evaluate(() => window.scrollTo(0, 600));
  assert.equal(await pagina.locator(".barra-superior").getAttribute("data-oculta"), null);
  console.log("PASS identidad, tipografía y barra superior por scroll");

  await ir();
  const primera = pagina.locator(".tarjeta-vehiculo").first();
  const tituloGuardado = await primera.locator("h3").innerText();
  await primera.getByRole("button", { name: /^Guardar / }).click();
  await ir("/guardados");
  assert.equal(await pagina.locator(".tarjeta-vehiculo h3").filter({ hasText: tituloGuardado }).count(), 1);
  await auditar("guardados");

  await ir();
  await pagina.getByRole("button", { name: "SUV", exact: true }).click();
  assert.equal(await pagina.locator(".tarjeta-vehiculo").count(), 6);
  await pagina.getByLabel("Ordenar por").selectOption("precio-asc");
  assert.match(await pagina.locator(".tarjeta-vehiculo h3").first().innerText(), /Renault Duster/);
  await pagina.getByRole("button", { name: "Todos", exact: true }).click();
  await pagina.getByLabel("Buscar carros").fill("corolla");
  assert.equal(await pagina.locator(".tarjeta-vehiculo").count(), 1);
  await pagina.getByLabel("Buscar carros").fill("modelo-inexistente");
  await pagina.getByRole("heading", { name: "No encontramos carros con esos filtros." }).waitFor();
  await pagina.getByRole("button", { name: "Limpiar búsqueda y filtros" }).click();
  assert.equal(await pagina.locator(".tarjeta-vehiculo").count(), 8);
  console.log("PASS búsqueda, filtros, orden y estado vacío");

  await pagina.getByRole("link", { name: /^Ver / }).first().click();
  await pagina.waitForURL(/#\/auto\//);
  await pagina.locator("#titulo-vehiculo").waitFor();
  await comprobarSinDesbordamiento();
  await auditar("detalle");
  await pagina.screenshot({ path: `${capturas}/detalle-1440.png`, fullPage: true });
  await pagina.getByRole("button", { name: "Foto siguiente" }).click();
  await pagina.getByRole("button", { name: /Ampliar galería/ }).click();
  const zoom = pagina.getByRole("dialog");
  await zoom.waitFor();
  await pagina.keyboard.press("ArrowRight");
  await pagina.keyboard.press("Escape");
  await zoom.waitFor({ state: "hidden" });
  await pagina.getByRole("button", { name: /^Chatear con / }).click();
  await pagina.waitForURL(/#\/chat\?vehiculo=/);
  await pagina.locator(".hilo").waitFor();
  await auditar("chat");
  await pagina.getByLabel("Escribe un mensaje").fill("Mensaje automático de prueba.");
  await pagina.getByLabel("Escribe un mensaje").press("Enter");
  await pagina.locator(".mensaje--yo").filter({ hasText: "Mensaje automático de prueba." }).waitFor();
  console.log("PASS galería, zoom, teclado y chat");

  await ir("/publicar");
  await pagina.locator(".publicar__formulario").getByRole("button", { name: "Continuar" }).click();
  assert.equal(await pagina.locator("[aria-invalid='true']").count(), 10);
  await pagina.getByLabel(/^Marca/).fill("Toyota");
  await pagina.getByLabel(/^Modelo/).fill("Corolla Test");
  await pagina.getByLabel(/^Año/).fill("2022");
  await pagina.getByLabel(/^Kilometraje/).fill("45000");
  await pagina.getByLabel(/^Tipo de carro/).selectOption("Sedán");
  await pagina.getByLabel(/^Condición/).selectOption("Excelente");
  await pagina.getByLabel(/^Combustible/).selectOption("Gasolina");
  await pagina.getByLabel(/^Transmisión/).selectOption("Automática");
  await pagina.getByLabel(/^Ciudad/).selectOption("Maracaibo");
  await pagina.getByLabel(/^Sector o urbanización/).fill("La Lago");
  await pagina.getByLabel("Color", { exact: false }).fill("Blanco");
  await pagina.locator(".publicar__formulario").getByRole("button", { name: "Continuar" }).click();
  await pagina.getByRole("button", { name: "Usar una foto de demostración" }).click();
  await pagina.getByLabel("Precio en dólares").fill("15900");
  await pagina.getByLabel(/^Descripción/).fill("Carro de prueba con mantenimiento al día, documentos completos y equipamiento original.");
  await pagina.locator(".publicar__formulario").getByRole("button", { name: "Revisar" }).click();
  await auditar("publicación");
  await pagina.getByRole("checkbox").check();
  await pagina.locator(".publicar__formulario").getByRole("button", { name: "Publicar carro" }).click();
  await pagina.waitForURL(/#\/auto\/publicacion-/);
  await pagina.getByRole("heading", { name: "Toyota Corolla Test 2022" }).waitFor();
  console.log("PAS publicación validada y detalle creado");

  await ir("/perfil");
  await auditar("perfil");
  await pagina.locator(".barra-superior__tema").click();
  await pagina.locator(".barra-superior__tema").click();
  assert.equal(await pagina.locator("html").getAttribute("data-theme"), "oscuro");
  await pagina.reload({ waitUntil: "networkidle" });
  assert.equal(await pagina.locator("html").getAttribute("data-theme"), "oscuro");
  await ir();
  await auditar("catálogo oscuro");
  await pagina.screenshot({ path: `${capturas}/catalogo-oscuro-1440.png`, fullPage: true });
  await pagina.locator(".barra-superior__tema").click();
  await pagina.locator(".barra-superior__tema").click();
  assert.equal(await pagina.locator("html").getAttribute("data-theme"), "claro");
  console.log("PASS tema y persistencia");

  if (process.env.RUTA_PROBAR_AUTH === "1") {
    const correoPrueba = `navegador-${randomUUID()}@example.com`;
    const nombrePrueba = "Cuenta de Prueba Navegador";
    await ir("/perfil");
    await pagina.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await pagina.getByLabel("Nombre", { exact: true }).fill(nombrePrueba);
    await pagina.getByLabel("Correo", { exact: true }).fill(correoPrueba);
    await pagina.locator("input[name='clave']").fill("PruebaNavegador2026!");
    await pagina.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    await pagina.getByRole("heading", { name: "Tu espacio en Car Market." }).waitFor();
    await pagina.getByRole("heading", { name: nombrePrueba }).waitFor();
    const sesionCookie = await contexto.cookies();
    assert.ok(sesionCookie.some((galleta) => galleta.name === cookieSesion && galleta.httpOnly));
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("heading", { name: nombrePrueba }).waitFor();
    await auditar("perfil autenticado");
    await pagina.screenshot({ path: `${capturas}/perfil-cuenta-1440.png`, fullPage: true });
    await pagina.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await pagina.getByRole("heading", { name: "Qué bueno verte de nuevo." }).waitFor();
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("heading", { name: "Qué bueno verte de nuevo." }).waitFor();
    assert.equal(await pagina.locator(".acceso__aviso").count(), 0);
    await auditar("acceso");

    await pagina.setViewportSize({ width: 390, height: 844 });
    await ir("/perfil");
    await comprobarSinDesbordamiento();
    await comprobarObjetivosTactiles();
    await pagina.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await comprobarSinDesbordamiento();
    await comprobarObjetivosTactiles();
    await auditar("registro móvil");
    await pagina.screenshot({ path: `${capturas}/registro-390.png`, fullPage: true });

    await pagina.setViewportSize({ width: 320, height: 568 });
    await comprobarSinDesbordamiento();
    await comprobarObjetivosTactiles();
    await pagina.screenshot({ path: `${capturas}/registro-320.png`, fullPage: true });
    const estiloTexto = await pagina.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await comprobarSinDesbordamiento();
    await comprobarObjetivosTactiles();
    await pagina.screenshot({ path: `${capturas}/registro-texto-200-320.png`, fullPage: true });
    await estiloTexto.evaluate((elemento) => elemento.remove());
    console.log("PASS registro real, sesión persistente, cierre y acceso responsive");
  }

  for (const [ancho, alto] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 568], [844, 390]]) {
    await pagina.setViewportSize({ width: ancho, height: alto });
    await ir();
    await pagina.locator("#titulo-catalogo").waitFor();
    await comprobarSinDesbordamiento();
    await comprobarObjetivosTactiles();
    await pagina.screenshot({ path: `${capturas}/catalogo-${ancho}.png`, fullPage: true });
    console.log(`PASS responsive ${ancho}x${alto}`);
  }

  await pagina.setViewportSize({ width: 390, height: 844 });
  await ir();
  assert.equal(await pagina.locator(".barra-lateral").isVisible(), false);
  assert.equal(await pagina.locator(".navegacion-inferior").isVisible(), true);
  await pagina.getByRole("button", { name: "Filtros" }).click();
  const filtros = pagina.getByRole("dialog", { name: "Filtrar carros" });
  await filtros.waitFor();
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
  for (let indice = 0; indice < 18; indice += 1) await pagina.keyboard.press("Tab");
  assert.equal(await pagina.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']"))), true);
  await pagina.keyboard.press("Escape");
  await filtros.waitFor({ state: "hidden" });
  await ir("/chat");
  await pagina.locator(".conversacion").first().click();
  await pagina.locator(".hilo").waitFor();
  assert.equal(await pagina.locator(".conversaciones").isVisible(), false);
  await pagina.getByRole("button", { name: "Volver a conversaciones" }).click();
  assert.equal(await pagina.locator(".conversaciones").isVisible(), true);
  await pagina.screenshot({ path: `${capturas}/chat-390.png`, fullPage: true });
  console.log("PASS navegación móvil, foco atrapado y chat");

  await ir();
  await pagina.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await comprobarSinDesbordamiento();
  await comprobarObjetivosTactiles();
  await pagina.screenshot({ path: `${capturas}/catalogo-texto-200-390.png`, fullPage: true });
  await pagina.setViewportSize({ width: 320, height: 568 });
  await comprobarSinDesbordamiento();
  await comprobarObjetivosTactiles();
  await pagina.screenshot({ path: `${capturas}/catalogo-texto-200-320.png`, fullPage: true });
  console.log("PASS texto al 200%");

  const movimientoReducido = await contexto.newPage();
  await movimientoReducido.emulateMedia({ reducedMotion: "reduce" });
  await movimientoReducido.goto(`${baseURL}#/`, { waitUntil: "networkidle" });
  const animaciones = await movimientoReducido.evaluate(() => [...document.querySelectorAll("*")].flatMap((elemento) => {
    const estilo = getComputedStyle(elemento);
    if (estilo.animationName === "none") return [];
    return [{ elemento: elemento.className, duracion: estilo.animationDuration, iteraciones: estilo.animationIterationCount }];
  }));
  assert.ok(animaciones.every((animacion) => Number.parseFloat(animacion.duracion) <= 0.01), `Movimiento no reducido: ${JSON.stringify(animaciones)}`);
  const transiciones = await movimientoReducido.evaluate(() => [...document.querySelectorAll("*")].flatMap((elemento) => {
    const estilo = getComputedStyle(elemento);
    if (estilo.transitionDuration === "0s") return [];
    return { elemento: elemento.className, duracion: estilo.transitionDuration };
  }).filter((transicion) => transicion.duracion.split(",").some((duracion) => Number.parseFloat(duracion) > 0.01)));
  assert.deepEqual(transiciones, [], `Transiciones no reducidas: ${JSON.stringify(transiciones)}`);
  await movimientoReducido.close();
  console.log("PASS movimiento reducido");

  const coloresForzados = await contexto.newPage();
  await coloresForzados.emulateMedia({ forcedColors: "active" });
  await coloresForzados.goto(`${baseURL}#/`, { waitUntil: "networkidle" });
  await coloresForzados.getByRole("heading", { name: "Encuentra tu próximo carro." }).waitFor();
  await coloresForzados.addScriptTag({ path: axePath });
  const auditoriaForzada = await coloresForzados.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  }));
  assert.deepEqual(auditoriaForzada.violations, [], `Accesibilidad con colores forzados: ${JSON.stringify(auditoriaForzada.violations)}`);
  assert.equal(await coloresForzados.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await coloresForzados.screenshot({ path: `${capturas}/catalogo-colores-forzados-390.png`, fullPage: true });
  await coloresForzados.close();
  console.log("PASS colores forzados");

  const pwaActiva = await pagina.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registraciones = await navigator.serviceWorker.getRegistrations();
    if (!registraciones.length) return false;
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  });
  if (pwaActiva) {
    await pagina.reload({ waitUntil: "networkidle" });
    const erroresAntesOffline = errores.length;
    await contexto.setOffline(true);
    try {
      await pagina.reload({ waitUntil: "domcontentloaded" });
      await pagina.getByRole("heading", { name: "Encuentra tu próximo carro." }).waitFor();
      assert.equal(await pagina.locator(".tarjeta-vehiculo").count(), 8);
      assert.equal(await pagina.locator(".tarjeta-vehiculo img").first().evaluate((imagen) => imagen.complete && imagen.naturalWidth > 0), true);
      assert.equal(await pagina.evaluate(() => document.fonts.check("700 16px Inter")), true);
      const urlEnCache = await pagina.evaluate(async () => {
        const nombres = await caches.keys();
        const respuestas = await Promise.all(nombres.map((nombre) => caches.open(nombre).then((cache) => cache.keys())));
        return respuestas.flat().map((respuesta) => respuesta.url);
      });
      assert.ok(urlEnCache.every((url) => !url.includes("/api/") && !url.includes("kyc")), `Datos sensibles en caché: ${urlEnCache.join(", ")}`);
      const erroresOffline = errores.splice(erroresAntesOffline);
      assert.ok(erroresOffline.every((error) =>
        (error.includes("favicon.svg") || error.includes("/api/auth/sesion")) && error.includes("ERR_INTERNET_DISCONNECTED"),
      ), `Errores inesperados sin conexión: ${erroresOffline.join("\n")}`);
      console.log("PASS PWA sin conexión, fotos, fuente y caché sensible");
    } finally {
      await contexto.setOffline(false);
    }
  } else {
    console.log("PWA: service worker no activo en este servidor");
  }

  assert.deepEqual(errores, [], `Errores del navegador: ${errores.join("\n")}`);
  console.log(`NAVEGADOR: PASS · capturas en ${capturas}`);
} finally {
  await navegador.close();
}
