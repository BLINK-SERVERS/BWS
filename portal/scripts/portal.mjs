/* ============================================================
   Verificación del portal en un navegador real
   ------------------------------------------------------------
   Levanta el servidor local contra la rama `pruebas`, recorre el
   alta completa —registro, verificación por archivo, ingreso,
   firma única y proyecto con plan, anexo B y envío— y mide lo
   que el plan exige antes de publicar:

   · axe sin violaciones en 390 y 1440;
   · cero desborde horizontal;
   · cero peticiones a terceros;
   · la firma queda registrada una sola vez y la pantalla deja de
     ofrecer el lienzo;
   · el proyecto guardado se lee de vuelta y el enviado congela el
     alcance sin ofrecer edición.

   Uso:
     npm run portal:pruebas
   ============================================================ */

import { createRequire } from "node:module";
import { readFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright-core";
import { crearServidor } from "./servidor.mjs";
import { cargarEnv } from "./_env.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PUERTO = Number(process.env.PORTAL_PUERTO ?? 4188);
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const CORREO = join(RAIZ, "tmp", "correo-portal");

const resultados = [];
function comprobar(nombre, condicion, detalle = "") {
  resultados.push({ nombre, ok: Boolean(condicion), detalle });
  console.log(`${condicion ? "  ✓" : "  ✗"} ${nombre}${condicion || !detalle ? "" : `\n      ${detalle}`}`);
}

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function esperar(condicion, mensaje, limite = 15_000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    if (await condicion()) return;
    await new Promise((listo) => setTimeout(listo, 150));
  }
  throw new Error(mensaje);
}

async function correoDe(destinatario) {
  let archivo = null;
  await esperar(async () => {
    if (!existsSync(CORREO)) return false;
    const nombres = (await readdir(CORREO)).filter((n) => n.endsWith(".json")).sort().reverse();
    for (const nombre of nombres) {
      const datos = JSON.parse(await readFile(join(CORREO, nombre), "utf8"));
      if (datos.para === destinatario && /token=/.test(datos.texto)) {
        archivo = datos;
        return true;
      }
    }
    return false;
  }, "No llegó el correo de verificación al modo archivo.");
  const token = archivo.texto.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  afirmar(token, "El correo de verificación no trae un token legible.");
  return token;
}

function revisarAxe() {
  return async (pagina, etiqueta, ancho) => {
    await pagina.evaluate(() => document.fonts.ready);
    if (!(await pagina.evaluate(() => Boolean(window.axe)))) {
      await pagina.addScriptTag({ path: AXE });
    }
    const infraccion = await pagina.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
        resultType: "violations",
      });
      return r.violations.map((v) => ({
        id: v.id,
        impacto: v.impact,
        n: v.nodes.length,
        donde: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        porque: v.nodes.slice(0, 2).map((n) => {
          const datos = n.any.find((c) => c.data)?.data;
          return `${n.failureSummary ?? ""}${datos ? ` ${JSON.stringify(datos)}` : ""} :: ${n.html.slice(0, 160)}`;
        }),
      }));
    });
    comprobar(
      `axe ${etiqueta} @${ancho}`,
      infraccion.length === 0,
      infraccion
        .map((v) => `${v.id} (${v.impacto}) ×${v.n}: ${v.donde.join(", ")}${v.porque.length ? `\n        ${v.porque.join("\n        ")}` : ""}`)
        .join("\n      "),
    );

    const desborde = await pagina.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      cuerpo: document.body.scrollWidth,
      ancho: window.innerWidth,
    }));
    const sobra = Math.max(desborde.documento, desborde.cuerpo) - desborde.ancho;
    comprobar(
      `sin desborde ${etiqueta} @${ancho}`,
      sobra <= 1,
      `sobran ${sobra} px`,
    );
  };
}

async function principal() {
  const variables = cargarEnv();
  Object.assign(process.env, variablesSinPisar(variables));
  process.env.PORTAL_DB = "pruebas";
  process.env.ENTORNO = "local";
  process.env.CORREO_MODO = "archivo";
  process.env.CORREO_ARCHIVO_DIR = CORREO;
  process.env.PORTAL_PUERTO = String(PUERTO);

  if (!existsSync(join(RAIZ, "dist", "index.html"))) {
    throw new Error("Falta `dist/`. Ejecuta `npm run build` antes de esta prueba.");
  }
  await rm(CORREO, { recursive: true, force: true });

  const urlDueno = process.env.DATABASE_URL_PRUEBAS;
  afirmar(urlDueno, "Falta DATABASE_URL_PRUEBAS para limpiar la base de pruebas.");
  const base = new pg.Client({ connectionString: urlDueno, application_name: "bws-portal-pruebas" });
  await base.connect();
  await base.query("truncate usuarios, limites cascade");

  const { origen, cerrar } = await crearServidor({ puerto: PUERTO });
  const navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const marca = Date.now().toString(36);
  const correo = `cliente-${marca}@ejemplo.com`;
  const clave = "claveSegura123";
  const terceros = [];
  const erroresConsola = [];
  const fallosRed = [];

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const pagina = await contexto.newPage();
    pagina.setDefaultTimeout(30_000);
    pagina.on("request", (peticion) => {
      const url = peticion.url();
      if (!url.startsWith(origen) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        terceros.push(url);
      }
    });
    pagina.on("console", (mensaje) => {
      if (mensaje.type() === "error") erroresConsola.push(mensaje.text());
    });
    pagina.on("pageerror", (error) => erroresConsola.push(error.message));
    pagina.on("requestfailed", (peticion) => {
      fallosRed.push(`${peticion.method()} ${peticion.url()} :: ${peticion.failure()?.errorText}`);
    });

    const medir = revisarAxe();
    const ir = async (ruta) => {
      await pagina.goto(`${origen}/#/${ruta}`, { waitUntil: "domcontentloaded" });
      await pagina.waitForSelector("main");
    };

    await ir("");
    await medir(pagina, "portada", 1440);

    await ir("registro");
    await pagina.getByLabel("Nombre de la persona que firma").fill("Ana Pérez");
    await pagina.getByLabel("Correo", { exact: true }).fill(correo);
    await pagina.getByLabel("Clave", { exact: true }).fill(clave);
    await pagina.getByLabel("Razón social o nombre").fill("Estudio Prueba, C.A.");
    await pagina.getByLabel("Número").fill("J-12345678-9");
    await pagina.getByLabel("Domicilio fiscal").fill("Av. Principal, Caracas");
    await pagina.getByLabel("Teléfono").fill("+58 412 1234567");
    await pagina.getByLabel("Correo de facturación").fill(`factura-${marca}@ejemplo.com`);
    await medir(pagina, "registro", 1440);

    await pagina.getByRole("button", { name: "Revisar documentos" }).click();
    await pagina.getByRole("heading", { name: "Lee y acepta los documentos." }).waitFor();
    comprobar("el registro muestra cinco documentos", (await pagina.locator(".po-documento").count()) === 5);
    await medir(pagina, "consentimiento", 1440);

    await pagina.locator(".po-casilla input[type=checkbox]").check();
    await pagina.getByRole("button", { name: "Crear cuenta" }).click();
    await pagina.getByRole("heading", { name: "Cuenta creada." }).waitFor();

    const token = await correoDe(correo);
    comprobar("el correo de verificación llega al modo archivo", /^[A-Za-z0-9_-]{40,64}$/.test(token));

    await pagina.goto(`${origen}/#/verificar?token=${encodeURIComponent(token)}`, {
      waitUntil: "domcontentloaded",
    });
    await pagina.getByRole("heading", { name: "Correo confirmado." }).waitFor();

    await ir("ingreso");
    await medir(pagina, "ingreso", 1440);
    await pagina.getByLabel("Correo", { exact: true }).fill(correo);
    await pagina.getByLabel("Clave", { exact: true }).fill(clave);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL(/#\/panel/);
    await pagina.getByRole("heading", { name: "Ana Pérez" }).waitFor();
    await pagina.getByText("Firmar el consentimiento").waitFor();
    await medir(pagina, "panel sin firma", 1440);

    await pagina.locator(".po-tarjeta .po-casilla input[type=checkbox]").check();
    const caja = await pagina.locator("canvas.po-lienzo").boundingBox();
    afirmar(caja, "No se pudo medir el lienzo de firma.");
    await pagina.mouse.move(caja.x + 60, caja.y + 100);
    await pagina.mouse.down();
    for (let paso = 1; paso <= 16; paso += 1) {
      await pagina.mouse.move(
        caja.x + 60 + paso * 14,
        caja.y + 100 + Math.sin(paso / 2) * 28,
      );
    }
    await pagina.mouse.up();
    await pagina.getByRole("button", { name: "Firmar", exact: true }).click();
    await pagina.getByText("Firma registrada. No se puede reemplazar desde el portal.").waitFor();
    await pagina.locator("img.po-firma-imagen").waitFor();
    comprobar(
      "tras firmar ya no se ofrece el lienzo",
      (await pagina.locator("canvas.po-lienzo").count()) === 0,
    );
    await medir(pagina, "panel firmado", 1440);

    // Alta del proyecto: plan, anexo B y congelado al enviar.
    const dominio = `estudio-${marca}.com.ve`;
    await ir("proyecto");
    await pagina.getByRole("heading", { name: "Describe tu proyecto." }).waitFor();
    await pagina.getByLabel("Nombre del proyecto").fill("App de citas");
    await pagina.getByLabel("Categoría").selectOption("Aplicación web");
    await pagina.getByLabel("Dominio").fill(dominio);
    await pagina.getByRole("button", { name: "Añadir buzón" }).click();
    await pagina.getByLabel("Buzón adicional 1").fill(`contacto@${dominio}`);
    await pagina
      .getByLabel("Qué incluye el proyecto")
      .fill("Agenda de citas con recordatorios por correo, cobros anticipados y un panel para el equipo.");
    await pagina.getByText("Plan Inicial · sin costo mensual").waitFor();
    await pagina.locator('input[name="plan"][value="neon-vercel|pro"]').check();
    await pagina.getByText("Plan Pro · USD 30 al mes").waitFor();
    comprobar(
      "cambiar de plan recalcula el anexo B",
      (await pagina.getByText("Plan Pro · USD 30 al mes").count()) === 1,
    );
    await medir(pagina, "proyecto borrador", 1440);

    await pagina.getByRole("button", { name: "Guardar borrador" }).click();
    await pagina.getByText("Borrador guardado.").waitFor();
    await pagina.reload({ waitUntil: "domcontentloaded" });
    await pagina.getByRole("heading", { name: "Describe tu proyecto." }).waitFor();
    comprobar(
      "el borrador se lee de vuelta",
      (await pagina.getByLabel("Nombre del proyecto").inputValue()) === "App de citas",
    );
    comprobar(
      "el plan guardado conserva el precio",
      (await pagina.getByText("Plan Pro · USD 30 al mes").count()) === 1,
    );

    await pagina.setViewportSize({ width: 390, height: 844 });
    await medir(pagina, "proyecto borrador", 390);
    await pagina.setViewportSize({ width: 1440, height: 900 });

    await pagina.getByRole("button", { name: "Revisar y enviar" }).click();
    await pagina.getByRole("button", { name: "Confirmar envío" }).waitFor();
    await pagina.getByRole("button", { name: "Confirmar envío" }).click();
    await pagina.getByText("Proyecto enviado. El alcance quedó congelado.").waitFor();
    await pagina.getByRole("heading", { name: "App de citas" }).waitFor();
    comprobar(
      "el proyecto enviado no ofrece edición",
      (await pagina.getByRole("button", { name: "Guardar borrador" }).count()) === 0,
    );
    await medir(pagina, "proyecto enviado", 1440);

    // 390: las mismas pantallas con la sesión abierta.
    await pagina.setViewportSize({ width: 390, height: 844 });
    for (const [ruta, etiqueta] of [
      ["", "portada"],
      ["registro", "registro"],
      ["ingreso", "ingreso con sesión"],
      ["verificar", "verificar sin token"],
      ["recuperar", "recuperar"],
      ["panel", "panel firmado"],
      ["proyecto", "proyecto enviado"],
    ]) {
      await ir(ruta);
      if (ruta === "proyecto") {
        await pagina.getByRole("heading", { name: "App de citas" }).waitFor();
      }
      await pagina.waitForTimeout(150);
      await medir(pagina, etiqueta, 390);
    }

    comprobar("cero peticiones a terceros", terceros.length === 0, terceros.slice(0, 5).join(" | "));
    comprobar("cero errores de consola", erroresConsola.length === 0, erroresConsola.slice(0, 5).join(" | "));
    comprobar("cero fallos de red", fallosRed.length === 0, fallosRed.slice(0, 5).join(" | "));

    await contexto.close();
  } finally {
    await navegador.close().catch(() => {});
    await cerrar();
    await base.query("truncate usuarios, limites cascade").catch(() => {});
    await base.end().catch(() => {});
  }

  const fallidas = resultados.filter((r) => !r.ok);
  console.log(
    `\n${fallidas.length ? "✗" : "✓"} ${resultados.length - fallidas.length}/${resultados.length} comprobaciones del navegador en verde.`,
  );
  if (fallidas.length) process.exitCode = 1;
}

/** Copia las variables sin pisar las que ya vengan del entorno. */
function variablesSinPisar(variables) {
  const salida = {};
  for (const [nombre, valor] of Object.entries(variables)) {
    if (!process.env[nombre]) salida[nombre] = valor;
  }
  return salida;
}

principal().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
