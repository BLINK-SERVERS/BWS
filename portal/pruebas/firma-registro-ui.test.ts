import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page, type Route } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";

const raiz = fileURLToPath(new URL("../", import.meta.url));
const hashAnterior = "a".repeat(64);
const hashNuevo = "b".repeat(64);
const huellaFirma = "f".repeat(64);
const codigo = "BWS-LEG-002";
const datosCaptura = "Se guardan el trazo, la fecha UTC, la IP, el agente del navegador y el hash SHA-256.";
const documento = (hash: string, texto: string) => ({
  codigo,
  titulo: "Consentimiento de firma",
  version: "9.8.7",
  resumen: "Consentimiento",
  hash,
  hash_plantilla: "c".repeat(64),
  bloques: [{ tipo: "parrafo", texto }],
});
const estado = (hash: string, texto: string) => ({
  verificado: true,
  consentimiento_hash: hash,
  consentimiento: documento(hash, texto),
  firma: null,
});
const sesion = {
  usuario: { nombre: "Ana Prueba", correo: "ana@ejemplo.test", rol: "cliente", verificado: true },
  cliente: null,
  firma: null,
};

let servidor: ViteDevServer;
let navegador: Browser;
let origen: string;
let cache: string;

before(async () => {
  cache = await mkdtemp(join(tmpdir(), "bws-ui-pruebas-"));
  servidor = await createServer({
    configFile: false,
    root: raiz,
    cacheDir: cache,
    envFile: false,
    plugins: [react()],
    resolve: {
      alias: {
        "@fonts": join(raiz, "sistema/fonts.css"),
        "@tokens": join(raiz, "sistema/tokens.css"),
      },
    },
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  await servidor.listen();
  origen = servidor.resolvedUrls!.local[0];
  navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
});

after(async () => {
  await navegador?.close();
  await servidor?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

function pendiente() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

async function paginaConApi(atender: (ruta: Route) => Promise<void>): Promise<Page> {
  const pagina = await navegador.newPage();
  pagina.setDefaultTimeout(10_000);
  await pagina.route("**/*", async (ruta) => {
    const url = new URL(ruta.request().url());
    if (url.origin !== new URL(origen).origin) {
      await ruta.abort();
    } else if (url.pathname.startsWith("/api/")) {
      await atender(ruta);
    } else {
      await ruta.continue();
    }
  });
  return pagina;
}

async function apiPanel(ruta: Route) {
  if (new URL(ruta.request().url()).pathname === "/api/auth/sesion") {
    await ruta.fulfill({ json: { sesion } });
  } else {
    await ruta.fulfill({ status: 404, json: { error: "No disponible" } });
  }
}

async function dibujar(pagina: Page) {
  const caja = await pagina.locator("canvas.po-lienzo").boundingBox();
  assert.ok(caja);
  await pagina.mouse.move(caja.x + 30, caja.y + 30);
  await pagina.mouse.down();
  await pagina.mouse.move(caja.x + 100, caja.y + 60);
  await pagina.mouse.up();
}

/**
 * Píxeles del trazo (#111). La guía gris (#c3c7cd) y la etiqueta (#8b9199)
 * siempre están en el lienzo, así que el bytes-del-PNG no sirve para saber si
 * quedó tinta del cliente: se cuenta lo oscuro.
 */
function pixelesDelTrazo(canvas: HTMLCanvasElement) {
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("El lienzo no tiene contexto 2d.");
  const { data } = contexto.getImageData(0, 0, canvas.width, canvas.height);
  let oscuros = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i] < 100) oscuros += 1;
  }
  return oscuros;
}

for (const cambio of [false, true]) {
  test(`firma fallida con consentimiento ${cambio ? "cambiado" : "sin cambios"} exige aceptar y dibujar de nuevo`, async (t) => {
    const enviar = pendiente();
    const recibioEnvio = pendiente();
    const recargar = pendiente();
    const recibioRecarga = pendiente();
    const envios: { png: string; consentimiento_hash: string }[] = [];
    const hashFinal = cambio ? hashNuevo : hashAnterior;
    const textoFinal = cambio ? "Texto de consentimiento actualizado" : datosCaptura;
    const pagina = await paginaConApi(async (ruta) => {
      if (new URL(ruta.request().url()).pathname !== "/api/cliente/firma") return apiPanel(ruta);
      if (ruta.request().method() === "POST") {
        envios.push(ruta.request().postDataJSON());
        if (envios.length === 1) {
          recibioEnvio.resolver();
          await enviar.promesa;
          await ruta.fulfill({ status: 409, json: { error: "No se pudo registrar la firma." } });
        } else {
          await ruta.fulfill({ json: { ok: true, firma: {
            id: "firma", sha256: huellaFirma, utc: "2026-01-01T00:00:00Z",
            metodo: "simple", version: 1, hash_consentimiento: hashFinal, png: envios[1].png,
          } } });
        }
      } else if (envios.length === 0) {
        await ruta.fulfill({ json: estado(hashAnterior, datosCaptura) });
      } else {
        recibioRecarga.resolver();
        await recargar.promesa;
        await ruta.fulfill({ json: estado(hashFinal, textoFinal) });
      }
    });
    t.after(async () => { enviar.resolver(); recargar.resolver(); await pagina.close(); });
    await pagina.goto(`${origen}panel`);
    const seccion = pagina.locator("section.po-tarjeta").filter({ has: pagina.locator("#po-firma-titulo") });
    await seccion.getByText(datosCaptura).waitFor();
    const contenido = await seccion.innerText();
    assert.ok(contenido.includes(datosCaptura));
    assert.ok(!contenido.includes(codigo));
    assert.ok(!contenido.includes(hashAnterior));
    const casilla = seccion.getByRole("checkbox");
    const lienzo = seccion.locator("canvas");
    const firmar = seccion.getByRole("button", { name: "Firmar", exact: true });
    await casilla.check();
    await dibujar(pagina);
    assert.ok(await lienzo.evaluate(pixelesDelTrazo));
    assert.equal(await firmar.isEnabled(), true);
    await firmar.click();
    await recibioEnvio.promesa;
    assert.equal(await casilla.isDisabled(), true);
    assert.equal(await lienzo.getAttribute("aria-disabled"), "true");
    enviar.resolver();
    await recibioRecarga.promesa;
    await seccion.getByRole("alert").getByText("No se pudo registrar la firma.").waitFor();
    assert.equal(await casilla.isChecked(), false);
    assert.equal(await casilla.isDisabled(), true);
    assert.equal(await lienzo.evaluate(pixelesDelTrazo), 0);
    recargar.resolver();
    await seccion.getByText(textoFinal).waitFor();
    await pagina.waitForFunction(() => {
      const entrada = document.querySelector<HTMLInputElement>("#po-firma-titulo ~ .po-casilla input");
      return entrada && !entrada.disabled;
    });
    assert.equal(await casilla.isChecked(), false);
    assert.equal(await firmar.isDisabled(), true);
    assert.equal(await seccion.getByRole("alert").innerText(), "No se pudo registrar la firma.");
    await casilla.check();
    assert.equal(await firmar.isDisabled(), true);
    await dibujar(pagina);
    await firmar.click();
    await seccion.getByRole("heading", { name: "Tu firma" }).waitFor();
    assert.equal(envios.length, 2);
    assert.equal(envios[0].consentimiento_hash, hashAnterior);
    assert.equal(envios[1].consentimiento_hash, hashFinal);
    assert.match(envios[0].png, /^data:image\/png;base64,/);
    assert.match(envios[1].png, /^data:image\/png;base64,/);
    const firmaVisible = await seccion.innerText();
    assert.ok(!firmaVisible.includes(huellaFirma));
    assert.ok(!firmaVisible.includes("Huella del trazo"));
  });
}

test("una recarga fallida conserva ambos errores y no permite firmar hasta recuperar el texto", async (t) => {
  let envios = 0;
  let falloRecarga = true;
  const pagina = await paginaConApi(async (ruta) => {
    if (new URL(ruta.request().url()).pathname !== "/api/cliente/firma") return apiPanel(ruta);
    if (ruta.request().method() === "POST") {
      envios += 1;
      await ruta.fulfill({ status: 409, json: { error: "Falló el envío." } });
    } else if (envios && falloRecarga) {
      await ruta.fulfill({ status: 503, json: { error: "Falló la carga." } });
    } else {
      await ruta.fulfill({ json: estado(envios ? hashNuevo : hashAnterior, envios ? "Texto recuperado" : datosCaptura) });
    }
  });
  t.after(() => pagina.close());
  await pagina.goto(`${origen}panel`);
  await pagina.getByText(datosCaptura).waitFor();
  await pagina.getByRole("checkbox").check();
  await dibujar(pagina);
  await pagina.getByRole("button", { name: "Firmar", exact: true }).click();
  await pagina.getByText("Falló la carga.").waitFor();
  assert.equal(await pagina.getByText("Falló el envío.").isVisible(), true);
  assert.equal(await pagina.locator("canvas.po-lienzo").count(), 0);
  falloRecarga = false;
  await pagina.getByRole("button", { name: "Intentar de nuevo" }).click();
  await pagina.getByText("Texto recuperado").waitFor();
  assert.equal(await pagina.getByText("Falló el envío.").isVisible(), true);
  assert.equal(await pagina.getByRole("checkbox").isChecked(), false);
  assert.equal(await pagina.getByRole("button", { name: "Firmar", exact: true }).isDisabled(), true);
});

test("registro muestra textos legales, no metadatos, y transmite los hashes originales", async (t) => {
  const documentos = [
    documento(hashAnterior, datosCaptura),
    { ...documento(hashNuevo, "Privacidad: se conservan la IP y la imagen de la firma."),
      codigo: "BWS-PRI-005", titulo: "Privacidad" },
  ];
  let registro: Record<string, unknown> = {};
  const pagina = await paginaConApi(async (ruta) => {
    const rutaApi = new URL(ruta.request().url()).pathname;
    if (rutaApi === "/api/auth/consentimiento") {
      await ruta.fulfill({ json: { documentos, prestador: {} } });
    } else if (rutaApi === "/api/auth/registro") {
      registro = ruta.request().postDataJSON();
      await ruta.fulfill({ json: { ok: true, correo: "ana@ejemplo.test", verificacion_enviada: true } });
    } else {
      await ruta.fulfill({ json: { sesion: null } });
    }
  });
  t.after(() => pagina.close());
  await pagina.goto(`${origen}registro`);
  await pagina.locator("#registro-nombre").fill("Ana");
  await pagina.locator("#registro-apellidos").fill("Prueba");
  await pagina.locator("#registro-telefono").fill("04121234567");
  await pagina.locator("#registro-correo").fill("ana@ejemplo.test");
  await pagina.locator("#registro-clave").fill("claveSegura123");
  await pagina.getByRole("button", { name: "Continuar" }).click();
  await pagina.getByRole("heading", { name: "Documentos de la cuenta." }).waitFor();
  const casilla = pagina.getByRole("checkbox");
  await pagina.locator("details").nth(0).locator("summary").click();
  await pagina.locator("details").nth(1).locator("summary").click();
  assert.equal(await casilla.isChecked(), false);
  assert.deepEqual(registro, {});
  const texto = await pagina.locator(".po-documentos").innerText();
  assert.ok(texto.includes(datosCaptura));
  assert.ok(texto.includes("Privacidad: se conservan la IP y la imagen de la firma."));
  for (const valor of [codigo, "BWS-PRI-005", "9.8.7", hashAnterior, hashNuevo, "Huella:"]) {
    assert.ok(!texto.includes(valor), `No debe mostrarse ${valor}`);
  }
  await casilla.check();
  await pagina.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await pagina.getByRole("heading", { name: "Cuenta creada." }).waitFor();
  assert.deepEqual(registro.hashes, { [codigo]: hashAnterior, "BWS-PRI-005": hashNuevo });
});
