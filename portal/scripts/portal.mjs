/* ============================================================
   Verificación del portal en un navegador real
   ------------------------------------------------------------
   Levanta el servidor local contra la rama `pruebas`, recorre el
   alta completa —registro, verificación por archivo, ingreso,
   firma única, proyecto con plan y envío— y la operación de Blink
   —firma del representante, expediente, pagos y mora—, y mide lo
   que el plan exige antes de publicar:

   · axe sin violaciones en 390 y 1440;
   · cero desborde horizontal;
   · cero peticiones a terceros;
   · la firma queda registrada una sola vez y la pantalla deja de
     ofrecer el lienzo;
   · el proyecto guardado se lee de vuelta y el enviado congela el
     alcance sin ofrecer edición;
   · el expediente se genera, verifica, confirma y envía una sola
     vez, con ocho adjuntos y copia a Blink;
   · la licencia se suspende y se reactiva, y el cliente ve el
     bloqueo sin perder sus datos ni su dominio.

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
import { sembrarPlantillas } from "./sembrar-plantillas.mjs";
import { cargarEnv } from "./_env.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PUERTO = Number(process.env.PORTAL_PUERTO ?? 4188);
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const CORREO = join(RAIZ, "tmp", "correo-portal");

const ADMIN = {
  correo: "admin@blink.test",
  clave: "admin-Clave-2026",
  nombre: "Administración Blink",
};

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

async function todosLosCorreos() {
  if (!existsSync(CORREO)) return [];
  const nombres = (await readdir(CORREO)).filter((n) => n.endsWith(".json"));
  const lista = [];
  for (const nombre of nombres) {
    lista.push(JSON.parse(await readFile(join(CORREO, nombre), "utf8")));
  }
  return lista;
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
    let detalle = `sobran ${sobra} px`;
    if (sobra > 1) {
      const culpables = await pagina.evaluate((ancho) => {
        const dentroDeScroll = (el) => {
          for (let padre = el.parentElement; padre; padre = padre.parentElement) {
            if (getComputedStyle(padre).overflowX !== "visible") return true;
          }
          return false;
        };
        const lista = [];
        for (const el of document.body.querySelectorAll("*")) {
          const caja = el.getBoundingClientRect();
          if (caja.width > 0 && caja.right > ancho + 1 && !dentroDeScroll(el)) {
            const clase =
              typeof el.className === "string" && el.className.trim()
                ? `.${el.className.trim().split(/\s+/).join(".")}`
                : "";
            lista.push(`${el.tagName.toLowerCase()}${clase} → ${Math.round(caja.right)} px`);
          }
        }
        return lista.slice(0, 6);
      }, desborde.ancho);
      if (culpables.length) detalle += `\n      ${culpables.join("\n      ")}`;
    }
    comprobar(
      `sin desborde ${etiqueta} @${ancho}`,
      sobra <= 1,
      detalle,
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
  await base.query("truncate usuarios, representantes, limites cascade");
  await sembrarPlantillas(base);

  const { hashearClave } = await import("../api/_lib/clave.ts");
  await base.query(
    `insert into usuarios (correo, clave_hash, nombre, rol, correo_verificado)
     values ($1, $2, $3, 'admin', true)`,
    [ADMIN.correo, await hashearClave(ADMIN.clave), ADMIN.nombre],
  );

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
  const vigilar = (p) => {
    p.on("request", (peticion) => {
      const url = peticion.url();
      if (!url.startsWith(origen) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        terceros.push(url);
      }
    });
    p.on("console", (mensaje) => {
      if (mensaje.type() === "error") erroresConsola.push(mensaje.text());
    });
    p.on("pageerror", (error) => erroresConsola.push(error.message));
    p.on("requestfailed", (peticion) => {
      fallosRed.push(`${peticion.method()} ${peticion.url()} :: ${peticion.failure()?.errorText}`);
    });
  };

  try {
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const pagina = await contexto.newPage();
    pagina.setDefaultTimeout(30_000);
    vigilar(pagina);

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

    // M5: la operación de Blink en su propio contexto.
    const contextoAdmin = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    const admin = await contextoAdmin.newPage();
    admin.setDefaultTimeout(30_000);
    vigilar(admin);

    await admin.goto(`${origen}/#/ingreso`, { waitUntil: "domcontentloaded" });
    await admin.getByLabel("Correo", { exact: true }).fill(ADMIN.correo);
    await admin.getByLabel("Clave", { exact: true }).fill(ADMIN.clave);
    await admin.getByRole("button", { name: "Entrar", exact: true }).click();
    await admin.waitForURL(/#\/admin/);
    await admin.goto(`${origen}/#/admin`, { waitUntil: "domcontentloaded" });
    await admin.getByRole("heading", { name: "Operación de Blink" }).waitFor();
    comprobar(
      "la administración entra y ve el resumen de operación",
      (await admin.getByText("1 clientes · 1 proyectos · 0 suscripciones").count()) === 1,
    );
    await medir(admin, "admin sin representante", 1440);

    // Firma del representante sobre el mismo lienzo del cliente.
    await admin.getByLabel("Nombre completo").fill("Josué Blink");
    await admin.getByLabel("Documento").fill("V-12345678");
    await admin.getByLabel("Domicilio").fill("Av. Principal, Caracas");
    await admin.getByLabel("Correo (opcional)").fill("josue@blink.test");
    await admin.locator("canvas.po-lienzo").scrollIntoViewIfNeeded();
    const lienzoAdmin = await admin.locator("canvas.po-lienzo").boundingBox();
    afirmar(lienzoAdmin, "No se pudo medir el lienzo del representante.");
    await admin.mouse.move(lienzoAdmin.x + 50, lienzoAdmin.y + 90);
    await admin.mouse.down();
    for (let paso = 1; paso <= 14; paso += 1) {
      await admin.mouse.move(
        lienzoAdmin.x + 50 + paso * 16,
        lienzoAdmin.y + 90 + Math.cos(paso / 2) * 24,
      );
    }
    await admin.mouse.up();
    await admin.getByRole("button", { name: "Guardar firma" }).click();
    await admin
      .getByText("Firma del representante capturada. Los expedientes nuevos la usarán.")
      .waitFor();
    comprobar(
      "la firma del representante queda con su huella",
      /^[0-9a-f]{64}$/.test((await admin.locator("code.po-hash").first().textContent()) ?? ""),
    );

    const bloqueExpediente = () =>
      admin.locator(".po-admin-bloque").filter({ hasText: "App de citas" }).first();

    await bloqueExpediente().getByRole("button", { name: "Generar expediente" }).click();
    await bloqueExpediente()
      .getByText("Expediente generado: 8 documentos sellados.")
      .waitFor();
    await bloqueExpediente().getByRole("button", { name: "Verificar cadena" }).click();
    await bloqueExpediente()
      .getByText("Hay comprobaciones en falso: revisa cada fila.")
      .waitFor();
    comprobar(
      "la verificación previa al cliente marca archivo, sello y cadena en OK",
      (await bloqueExpediente().locator("tbody tr").count()) === 8 &&
        (await bloqueExpediente().getByText("FALLA", { exact: true }).count()) === 0,
    );

    const [descargaAdmin] = await Promise.all([
      admin.waitForEvent("download"),
      bloqueExpediente().getByRole("button", { name: "PDF" }).first().click(),
    ]);
    comprobar(
      "la administración descarga un PDF con su nombre",
      /^BWS-[A-Z]{3}-\d{3}-v\d+\.pdf$/.test(descargaAdmin.suggestedFilename()),
      descargaAdmin.suggestedFilename(),
    );

    // Suscripción con el precio del plan Pro y un pago vigente.
    await admin.getByText("Crear una suscripción", { exact: true }).click();
    await admin.getByRole("button", { name: "Crear suscripción" }).click();
    await admin.getByText("USD 30 al mes").waitFor();
    const tarjetaPago = admin.locator(".po-admin-bloque").filter({ hasText: "Registrar un pago" });
    await tarjetaPago.getByText("Registrar un pago", { exact: true }).click();
    await tarjetaPago.getByLabel("Referencia").fill("REF-PRUEBA-01");
    await tarjetaPago.getByRole("button", { name: "Registrar pago" }).click();
    await tarjetaPago.getByText(/Pago registrado\./).waitFor();
    await tarjetaPago.getByText("Registrado", { exact: true }).waitFor();
    comprobar(
      "el pago queda vigente en la tabla de la suscripción",
      (await tarjetaPago.getByText("Registrado", { exact: true }).count()) === 1,
    );

    // El cliente ve su licencia y confirma los ocho documentos.
    await ir("panel");
    await pagina.getByRole("heading", { name: "Licencia de uso" }).waitFor();
    await pagina.getByText("USD 30/mes", { exact: true }).waitFor();
    comprobar(
      "el cliente ve el estado al día y su pago",
      (await pagina.getByText("Al día", { exact: true }).count()) === 1 &&
        (await pagina.getByText("REF-PRUEBA-01").count()) === 1,
    );
    const seccionExpediente = pagina.locator('section[aria-labelledby="po-expediente-titulo"]');
    await seccionExpediente.getByRole("button", { name: "Confirmar el expediente" }).click();
    await pagina.getByText("Confirmaste 8 de 8 documentos.").waitFor();
    await pagina
      .getByText("Confirmaste los 8 documentos. El envío por correo lo hace la administración.")
      .waitFor();
    comprobar(
      "el cliente confirma los ocho documentos",
      (await seccionExpediente.getByText("Confirmado", { exact: true }).count()) === 8,
    );
    const [descargaCliente] = await Promise.all([
      pagina.waitForEvent("download"),
      seccionExpediente.getByRole("button", { name: "PDF" }).first().click(),
    ]);
    comprobar(
      "el cliente descarga su PDF auditado",
      /^BWS-[A-Z]{3}-\d{3}-v\d+\.pdf$/.test(descargaCliente.suggestedFilename()),
      descargaCliente.suggestedFilename(),
    );
    await medir(pagina, "panel con expediente y licencia", 1440);

    // Envío único: el reintento no produce un segundo correo.
    await admin.reload({ waitUntil: "domcontentloaded" });
    await admin.getByRole("heading", { name: "Operación de Blink" }).waitFor();
    const expedienteFinal = admin
      .locator(".po-admin-bloque")
      .filter({ hasText: "App de citas" })
      .first();
    await expedienteFinal.getByRole("button", { name: "Verificar cadena" }).click();
    await expedienteFinal.getByText("Cadena íntegra y expediente completo.").waitFor();
    comprobar(
      "con las dos firmas la cadena queda íntegra y completa",
      (await expedienteFinal.getByText("FALLA", { exact: true }).count()) === 0,
    );
    await expedienteFinal.getByRole("button", { name: "Enviar al cliente" }).click();
    await expedienteFinal
      .getByText("Enviado al cliente con 8 adjuntos y copia a Blink.")
      .waitFor();
    await expedienteFinal.getByRole("button", { name: "Enviar al cliente" }).click();
    await expedienteFinal
      .getByText("El expediente ya había salido: no se envió un segundo correo.")
      .waitFor();
    const envios = (await todosLosCorreos()).filter(
      (enviado) => enviado.asunto === "Expediente firmado — Estudio Prueba, C.A.",
    );
    comprobar(
      "el expediente sale una sola vez con ocho adjuntos y copia a Blink",
      envios.length === 1 &&
        envios[0].adjuntos.length === 8 &&
        envios[0].copia.some((direccion) => direccion.endsWith("blink.com.ve")),
      JSON.stringify({
        envios: envios.length,
        adjuntos: envios[0]?.adjuntos.length,
        copia: envios[0]?.copia,
      }),
    );

    // Suspensión y reactivación con la licencia a la vista del cliente.
    const tarjetaLicencia = admin
      .locator(".po-admin-bloque")
      .filter({ hasText: "USD 30 al mes" });
    await tarjetaLicencia
      .getByLabel("Motivo de la suspensión")
      .fill("Prueba de suspensión en el navegador");
    await tarjetaLicencia.getByRole("button", { name: "Suspender" }).click();
    await tarjetaLicencia
      .getByText("Suscripción suspendida y licencia bloqueada.")
      .waitFor();

    await pagina.reload({ waitUntil: "domcontentloaded" });
    await pagina.getByText(/La licencia está suspendida/).waitFor();
    comprobar(
      "la suspensión bloquea sin quitar datos ni dominio",
      (await pagina.getByText(/Tus datos siguen disponibles/).count()) === 1 &&
        (await pagina.getByText(/el dominio sigue a tu nombre/).count()) === 1,
    );
    await medir(pagina, "panel suspendido", 1440);

    await admin.reload({ waitUntil: "domcontentloaded" });
    await admin.getByRole("heading", { name: "Operación de Blink" }).waitFor();
    const tarjetaSuspendida = admin
      .locator(".po-admin-bloque")
      .filter({ hasText: "USD 30 al mes" });
    await tarjetaSuspendida.getByRole("button", { name: "Reactivar" }).click();
    await tarjetaSuspendida.getByText(/Suscripción reactivada/).waitFor();

    await pagina.reload({ waitUntil: "domcontentloaded" });
    await pagina.getByRole("heading", { name: "Licencia de uso" }).waitFor();
    comprobar(
      "la reactivación devuelve la licencia a activa",
      (await pagina.getByText("Al día", { exact: true }).count()) === 1 &&
        (await pagina.getByText("Activa", { exact: true }).count()) === 1,
    );

    await medir(admin, "admin con expediente y pagos", 1440);
    await admin.setViewportSize({ width: 390, height: 844 });
    await medir(admin, "admin con expediente y pagos", 390);
    await contextoAdmin.close();

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
      if (ruta === "panel") {
        await pagina.getByRole("heading", { name: "Licencia de uso" }).waitFor();
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
    await base.query("truncate usuarios, representantes, limites cascade").catch(() => {});
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
