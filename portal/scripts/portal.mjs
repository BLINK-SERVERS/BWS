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
// Se evalúa en el contexto de la página: inyectarlo como <script> choca
// con la CSP de `public/_headers`, que no permite scripts en línea.
const AXE_FUENTE = await readFile(AXE, "utf8");
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

/** Traza una firma de prueba sobre la guía, cruzando un poco por debajo. */
async function trazarFirma(pagina, caja) {
  const y = caja.y + caja.height * 0.6;
  await pagina.mouse.move(caja.x + caja.width * 0.12, y);
  await pagina.mouse.down();
  for (let paso = 1; paso <= 16; paso += 1) {
    await pagina.mouse.move(
      caja.x + caja.width * (0.12 + paso * 0.04),
      y + Math.sin(paso / 2) * caja.height * 0.12,
    );
  }
  await pagina.mouse.up();
}

/** Lee la guía dibujada en el lienzo lógico de 720×200, al 60 % del alto. */
function revisarGuia(pagina) {
  return pagina.evaluate(() => {
    const canvas = document.querySelector("canvas.po-lienzo");
    if (!canvas) return null;
    const renglon = Math.round((120 / 200) * canvas.height);
    const datos = canvas.getContext("2d").getImageData(0, renglon, canvas.width, 1).data;
    let pintados = 0;
    for (let indice = 3; indice < datos.length; indice += 4) {
      if (datos[indice] > 0) pintados += 1;
    }
    return {
      proporcion: canvas.width / canvas.height,
      guia: pintados / (canvas.width || 1),
    };
  });
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
      await pagina.evaluate(AXE_FUENTE);
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

  const { hashearClave } = await import("../server/_lib/clave.ts");
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
      const respuesta = await pagina.goto(`${origen}/${ruta}`, { waitUntil: "domcontentloaded" });
      await pagina.waitForSelector("main");
      return respuesta;
    };

    const inicio = await ir("");
    const cabeceras = inicio?.headers() ?? {};
    const csp = cabeceras["content-security-policy"] ?? "";
    comprobar(
      "CSP sin scripts ni estilos en línea y frame-ancestors 'none'",
      csp.includes("frame-ancestors 'none'") &&
        csp.includes("script-src 'self'") &&
        !csp.includes("'unsafe-inline'"),
      csp,
    );
    comprobar(
      "HSTS y nosniff en la respuesta de la app",
      Boolean(cabeceras["strict-transport-security"]) &&
        cabeceras["x-content-type-options"] === "nosniff",
      JSON.stringify(cabeceras),
    );
    await medir(pagina, "portada", 1440);

    await ir("no-existe");
    comprobar(
      "una ruta desconocida cae en la portada",
      (await pagina.getByRole("heading", { name: /Tu cuenta, tu firma y el expediente/ }).count()) === 1,
    );
    await ir("registro/");
    comprobar(
      "la barra final conserva la ruta",
      (await pagina.getByRole("heading", { name: "Crear cuenta." }).count()) === 1,
    );

    await ir("registro");
    await pagina.getByLabel("Nombre completo").fill("Ana");
    await pagina.getByLabel("Apellidos").fill("Pérez");
    await pagina.getByLabel("Correo", { exact: true }).fill(correo);
    await pagina.getByLabel("Teléfono").fill("+58 412 1234567");
    await pagina.getByLabel("Clave", { exact: true }).fill(clave);
    comprobar(
      "el registro pide solo los datos de la persona",
      (await pagina.getByText(/SENIAT/).count()) === 0 &&
        (await pagina.getByLabel("Nombre completo").count()) === 1 &&
        (await pagina.getByLabel("Apellidos").count()) === 1 &&
        (await pagina.getByLabel("Teléfono").count()) === 1 &&
        (await pagina.getByLabel("Correo", { exact: true }).count()) === 1 &&
        (await pagina.getByLabel("Clave", { exact: true }).count()) === 1,
    );
    await medir(pagina, "registro", 1440);

    await pagina.getByRole("button", { name: "Continuar" }).click();
    await pagina.getByRole("heading", { name: "Documentos de la cuenta." }).waitFor();
    comprobar("el registro muestra cuatro documentos", (await pagina.locator(".po-documento").count()) === 4);
    await medir(pagina, "consentimiento", 1440);

    await pagina.locator(".po-casilla input[type=checkbox]").check();
    await pagina.getByRole("button", { name: "Crear cuenta" }).click();
    await pagina.getByRole("heading", { name: "Cuenta creada." }).waitFor();

    const tokenInicial = await correoDe(correo);
    comprobar("el correo de verificación llega al modo archivo", /^[A-Za-z0-9_-]{40,64}$/.test(tokenInicial));

    // La cuenta entra sin confirmar: el panel debe ofrecer otro enlace
    // cuando el del correo venció o no llegó.
    await ir("ingreso");
    await medir(pagina, "ingreso", 1440);
    await pagina.getByLabel("Correo", { exact: true }).fill(correo);
    await pagina.getByLabel("Clave", { exact: true }).fill(clave);
    await pagina.getByRole("button", { name: "Entrar", exact: true }).click();
    await pagina.waitForURL(/\/panel$/);
    await pagina.getByRole("heading", { name: "Ana Pérez" }).waitFor();
    await pagina.getByText("Sin confirmar").waitFor();
    await medir(pagina, "panel sin confirmar", 1440);

    await pagina.getByRole("button", { name: "Reenviar el correo de verificación" }).click();
    await pagina.getByText(/Te enviamos un enlace nuevo/).waitFor();
    comprobar(
      "el panel sin confirmar reenvía el enlace de verificación",
      (await pagina.getByRole("button", { name: "Enlace enviado" }).count()) === 1,
    );

    const token = await correoDe(correo);
    comprobar("el enlace reenviado es distinto del original", token !== tokenInicial);

    await pagina.goto(`${origen}/verificar?token=${encodeURIComponent(token)}`, {
      waitUntil: "domcontentloaded",
    });
    await pagina.getByRole("heading", { name: "Correo confirmado." }).waitFor();

    await ir("panel");
    await pagina.getByRole("heading", { name: "Ana Pérez" }).waitFor();
    await pagina.getByText("Firmar el consentimiento").waitFor();
    await medir(pagina, "panel sin firma", 1440);

    await pagina.locator(".po-tarjeta .po-casilla input[type=checkbox]").check();
    const caja = await pagina.locator("canvas.po-lienzo").boundingBox();
    afirmar(caja, "No se pudo medir el lienzo de firma.");
    comprobar(
      "el lienzo conserva la proporción de la línea impresa",
      Math.abs(caja.width / caja.height - 720 / 200) < 0.04,
      `${Math.round(caja.width)}×${Math.round(caja.height)}`,
    );
    const guia = await revisarGuia(pagina);
    afirmar(guia, "No se pudo leer el lienzo de firma.");
    comprobar(
      "el lienzo dibuja la línea de guía de la firma",
      guia.guia > 0.5 && Math.abs(guia.proporcion - 720 / 200) < 0.01,
      `cobertura ${guia.guia.toFixed(2)} · proporción ${guia.proporcion.toFixed(2)}`,
    );
    await trazarFirma(pagina, caja);
    await pagina.getByRole("button", { name: "Firmar", exact: true }).click();
    await pagina.getByText("Firma registrada. No se puede reemplazar desde el portal.").waitFor();
    await pagina.locator("img.po-firma-imagen").waitFor();
    const trazo = await pagina.locator("img.po-firma-imagen").evaluate((img) => ({
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
    }));
    comprobar(
      "el trazo se exporta con el lienzo completo, sin cortar la firma",
      Math.abs(trazo.ancho / trazo.alto - 720 / 200) < 0.02,
      `${trazo.ancho}×${trazo.alto}`,
    );
    comprobar(
      "tras firmar ya no se ofrece el lienzo",
      (await pagina.locator("canvas.po-lienzo").count()) === 0,
    );
    await medir(pagina, "panel firmado", 1440);

    const solicitud = pagina.locator('section[aria-labelledby="po-proyecto-titulo"]');
    await solicitud.getByRole("heading", { name: "Solicitar mi proyecto" }).waitFor();
    comprobar(
      "el panel ofrece solicitar el proyecto sobre los datos fiscales",
      (await solicitud
        .getByRole("link", { name: "Solicitar mi proyecto" })
        .getAttribute("href")) === "/proyecto",
    );

    // Alta del proyecto: plan, anexo B y congelado al enviar.
    const dominio = `estudio-${marca}.com.ve`;
    await ir("proyecto");
    await pagina.getByRole("heading", { name: "Describe tu proyecto." }).waitFor();
    await pagina.getByLabel("Razón social o nombre").fill("Estudio Prueba, C.A.");
    await pagina.getByLabel("Número").fill("J-12345678-9");
    await pagina.getByLabel("Domicilio fiscal").fill("Av. Principal, Caracas");
    await pagina.getByLabel("Correo de facturación").fill(`factura-${marca}@ejemplo.com`);
    await pagina.getByLabel("Nombre del proyecto").fill("App de citas");
    await pagina.getByLabel("Categoría").selectOption("Aplicación web");
    await pagina.getByLabel("Dominio").fill(dominio);
    await pagina.getByRole("button", { name: "Añadir buzón" }).click();
    await pagina.getByLabel("Buzón adicional 1").fill(`contacto@${dominio}`);
    await pagina
      .getByLabel("Qué incluye el proyecto")
      .fill("Agenda de citas con recordatorios por correo, cobros anticipados y un panel para el equipo.");
    await pagina.getByText("Plan Inicial · sin costo mensual").waitFor();
    await pagina.locator('input[name="plan"][value="neon-cloudflare|pro"]').check();
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

    await admin.goto(`${origen}/ingreso`, { waitUntil: "domcontentloaded" });
    await admin.getByLabel("Correo", { exact: true }).fill(ADMIN.correo);
    await admin.getByLabel("Clave", { exact: true }).fill(ADMIN.clave);
    await admin.getByRole("button", { name: "Entrar", exact: true }).click();
    await admin.waitForURL(/\/admin$/);
    // El salto de cliente conserva la página: deja terminar el panel que
    // monta la ruta antes de recargar, o la recarga aborta su petición.
    await admin.getByRole("heading", { name: "Operación de Blink" }).waitFor();
    await admin.goto(`${origen}/admin`, { waitUntil: "domcontentloaded" });
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
    await trazarFirma(admin, lienzoAdmin);
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

    await bloqueExpediente().getByRole("button", { name: "Asignar proyecto" }).click();
    // Ocho PDF con las seis fuentes incrustadas: en una máquina cargada
    // pasa de los 30 s del tiempo por omisión.
    await bloqueExpediente()
      .getByText("Proyecto asignado: 8 documentos sellados y disponibles para el cliente.")
      .waitFor({ timeout: 120_000 });
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
    await pagina
      .getByText(
        "Confirmaste los 8 documentos y el expediente salió a tu correo con los PDF adjuntos.",
      )
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

    const automatico = (await todosLosCorreos()).filter(
      (enviado) => enviado.asunto === "Expediente firmado — Estudio Prueba, C.A.",
    );
    comprobar(
      "el correo sale al confirmar el cliente, con ocho adjuntos y copia a Blink",
      automatico.length === 1 &&
        automatico[0].adjuntos.length === 8 &&
        automatico[0].copia.some((direccion) => direccion.endsWith("blink.com.ve")),
      JSON.stringify({
        envios: automatico.length,
        adjuntos: automatico[0]?.adjuntos.length,
      }),
    );

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
    // El correo ya salió al confirmar el cliente: el botón es el reintento.
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
