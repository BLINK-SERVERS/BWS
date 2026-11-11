/* ============================================================
   Pruebas de la API contra la rama `pruebas`
   ------------------------------------------------------------
   Llama a las funciones reales (misma entrada que recibe Vercel)
   con un `Request` web y comprueba el flujo completo del alta:

   · consentimiento resuelto y huellas estables;
   · registro, correo duplicado y documento duplicado;
   · ingreso, cookie de sesión, sesión vencida y salida;
   · verificación del correo en modo archivo;
   · firma única (la segunda devuelve 409) y consentimiento viejo;
   · recuperación y restablecimiento con cierre de sesiones.

   Nunca corre contra `main`: exige que las variables de pruebas
   apunten a otro host que la base principal.

   node portal/scripts/api-test.mjs
   ============================================================ */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { cargarEnv, exigir } from "./_env.mjs";
import { firmaPNG } from "./firma-png.mjs";

const variables = cargarEnv();
const ORIGEN = "http://localhost:5177";
const CORREO_DIR = new URL("../tmp/correo-pruebas/", import.meta.url);

const urlDueno = exigir(variables, "DATABASE_URL_PRUEBAS");
const urlApp = exigir(variables, "DATABASE_URL_PRUEBAS_APP");

if (new URL(urlDueno).hostname === new URL(exigir(variables, "DATABASE_URL")).hostname) {
  throw new Error("DATABASE_URL_PRUEBAS apunta a la base principal. Aborto.");
}

process.env.DATABASE_URL_APP = urlApp;
process.env.ENTORNO = "local";
process.env.APP_ORIGEN = ORIGEN;
process.env.CORREO_MODO = "archivo";
process.env.CORREO_ARCHIVO_DIR = CORREO_DIR.pathname;

await rm(CORREO_DIR, { recursive: true, force: true });
await mkdir(CORREO_DIR, { recursive: true });

const cliente = new pg.Client({ connectionString: urlDueno, application_name: "bws-api-pruebas" });
await cliente.connect();
await cliente.query("truncate usuarios, representantes, plantillas, limites cascade");

const { default: consentimiento } = await import("../api/auth/consentimiento.ts");
const { default: registro } = await import("../api/auth/registro.ts");
const { default: ingreso } = await import("../api/auth/ingreso.ts");
const { default: sesionActual } = await import("../api/auth/sesion.ts");
const { default: salir } = await import("../api/auth/salir.ts");
const { default: verificar } = await import("../api/auth/verificar.ts");
const { default: recuperar } = await import("../api/auth/recuperar.ts");
const { default: restablecer } = await import("../api/auth/restablecer.ts");
const { default: firma } = await import("../api/cliente/firma.ts");
const { default: proyecto } = await import("../api/cliente/proyecto.ts");
const { default: enviarProyecto } = await import("../api/cliente/proyecto/enviar.ts");
const { default: representante } = await import("../api/admin/representante.ts");
const { default: generarExpediente } = await import("../api/documentos/generar.ts");
const { default: firmarExpediente } = await import("../api/documentos/firmar.ts");
const { default: verificarExpediente } = await import("../api/documentos/verificar.ts");
const { hashearClave } = await import("../api/_lib/clave.ts");
const { hashCadena, sha256Hex } = await import("../render/hash.ts");
const { sembrarPlantillas } = await import("./sembrar-plantillas.mjs");

await sembrarPlantillas(cliente);

const ADMIN = {
  correo: "admin@blink.test",
  clave: "admin-Clave-2026",
  nombre: "Administración Blink",
};
await cliente.query(
  `insert into usuarios (correo, clave_hash, nombre, rol, correo_verificado)
   values ($1, $2, $3, 'admin', true)`,
  [ADMIN.correo, await hashearClave(ADMIN.clave), ADMIN.nombre],
);

const pruebas = [];
function probar(nombre, fn) {
  pruebas.push({ nombre, fn });
}

let ok = 0;
function pasar(mensaje) {
  ok += 1;
  console.log(`  ✓ ${mensaje}`);
}

function pedir(ruta, opciones = {}) {
  const {
    metodo = "GET",
    cuerpo,
    cookie,
    origen = ORIGEN,
  } = opciones;
  const headers = {
    "user-agent": "pruebas-api/1.0",
    "x-forwarded-for": "127.0.0.1",
  };
  if (origen) headers.origin = origen;
  if (cookie) headers.cookie = `bws_sesion=${cookie}`;
  if (cuerpo !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGEN}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function invocar(handler, ruta, opciones) {
  const respuesta = await handler(pedir(ruta, opciones));
  const texto = await respuesta.text();
  let cuerpo = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = { crudo: texto };
  }
  return { estado: respuesta.status, cuerpo, cabeceras: respuesta.headers };
}

function galleta(respuesta) {
  const crudo = respuesta.cabeceras.get("set-cookie") ?? "";
  const par = crudo.split(";")[0] ?? "";
  const valor = par.includes("=") ? par.slice(par.indexOf("=") + 1) : "";
  return valor || null;
}

async function correoMasReciente() {
  const archivos = (await readdir(CORREO_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (!archivos.length) return null;
  return JSON.parse(await readFile(join(CORREO_DIR.pathname, archivos.at(-1)), "utf8"));
}

function tokenDe(texto, ruta) {
  const coincidencia = texto.match(new RegExp(`#/${ruta}\\?token=([A-Za-z0-9_-]{40,64})`));
  return coincidencia ? coincidencia[1] : null;
}

const CUENTA = {
  correo: "ana@ejemplo.com",
  clave: "clave-De-Prueba-1",
  nombre: "Ana Pérez",
};

const IDENTIDAD = {
  razon_social: "Ana Pérez Diseño, C.A.",
  documento_tipo: "RIF",
  documento_numero: "J-12345678-9",
  domicilio: "Av. Libertador, Caracas, Distrito Capital, Venezuela",
  telefono: "+58 412 123 4567",
  correo_factura: "facturas@anaejemplo.com",
};

let huellas = null;
let cookie = null;

probar("origen ajeno rechazado", async () => {
  const r = await invocar(consentimiento, "/api/auth/consentimiento", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, cliente: IDENTIDAD },
    origen: "https://sitio-ajeno.example",
  });
  assert.equal(r.estado, 403);
  assert.equal(r.cuerpo.codigo, "origen");
  pasar("403 con código origen");
});

probar("método no permitido", async () => {
  const r = await invocar(consentimiento, "/api/auth/consentimiento", { metodo: "GET" });
  assert.equal(r.estado, 405);
  assert.equal(r.cabeceras.get("allow"), "POST");
  pasar("405 y cabecera allow");
});

probar("consentimiento resuelto", async () => {
  const r = await invocar(consentimiento, "/api/auth/consentimiento", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, cliente: IDENTIDAD },
  });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.documentos.length, 5);
  assert.deepEqual(
    r.cuerpo.documentos.map((d) => d.codigo),
    ["BWS-REG-001", "BWS-LEG-002", "BWS-LEG-003", "BWS-PRI-005", "BWS-WEB-006"],
  );
  const texto = JSON.stringify(r.cuerpo.documentos);
  huellas = Object.fromEntries(r.cuerpo.documentos.map((d) => [d.codigo, d.hash]));
  assert.ok(!texto.includes("{{"), "quedaron marcadores");
  assert.ok(texto.includes("Ana Pérez Diseño, C.A."));
  assert.ok(texto.includes("No es una firma electrónica certificada."));
  assert.ok(texto.includes("No es equivalente a una firma autógrafa"));
  pasar("5 documentos, sin marcadores y con los datos del cliente");
});

probar("registro con consentimiento viejo", async () => {
  const r = await invocar(registro, "/api/auth/registro", {
    metodo: "POST",
    cuerpo: {
      cuenta: CUENTA,
      cliente: IDENTIDAD,
      hashes: { ...huellas, "BWS-LEG-002": "0".repeat(64) },
    },
  });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.codigo, "consentimiento");
  pasar("409 consentimiento");
});

probar("registro válido", async () => {
  const r = await invocar(registro, "/api/auth/registro", {
    metodo: "POST",
    cuerpo: { cuenta: CUENTA, cliente: IDENTIDAD, hashes: huellas },
  });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.verificacion_enviada, true);
  pasar("201 y correo de verificación emitido");
});

probar("correo duplicado", async () => {
  const r = await invocar(registro, "/api/auth/registro", {
    metodo: "POST",
    cuerpo: { cuenta: CUENTA, cliente: IDENTIDAD, hashes: huellas },
  });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.codigo, "correo");
  pasar("409 correo");
});

probar("documento duplicado", async () => {
  const cuenta = { ...CUENTA, correo: "otra@ejemplo.com" };
  const previa = await invocar(consentimiento, "/api/auth/consentimiento", {
    metodo: "POST",
    cuerpo: { correo: cuenta.correo, cliente: IDENTIDAD },
  });
  const propios = Object.fromEntries(previa.cuerpo.documentos.map((d) => [d.codigo, d.hash]));
  const r = await invocar(registro, "/api/auth/registro", {
    metodo: "POST",
    cuerpo: { cuenta, cliente: IDENTIDAD, hashes: propios },
  });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.codigo, "documento");
  pasar("409 documento");
});

probar("ingreso con clave incorrecta", async () => {
  const r = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, clave: "clave-Incorrecta-1" },
  });
  assert.equal(r.estado, 401);
  assert.equal(r.cuerpo.codigo, "credenciales");
  pasar("401 credenciales");
});

probar("ingreso correcto", async () => {
  const r = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, clave: CUENTA.clave },
  });
  assert.equal(r.estado, 200);
  cookie = galleta(r);
  assert.ok(cookie && cookie.length >= 40);
  assert.match(r.cabeceras.get("set-cookie") ?? "", /HttpOnly/);
  assert.doesNotMatch(r.cabeceras.get("set-cookie") ?? "", /Secure/);
  pasar("200, cookie opaca y HttpOnly");
});

probar("sesión con cliente y sin firma", async () => {
  const r = await invocar(sesionActual, "/api/auth/sesion", { cookie });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.sesion.usuario.correo, CUENTA.correo);
  assert.equal(r.cuerpo.sesion.usuario.verificado, false);
  assert.equal(r.cuerpo.sesion.cliente.razon_social, IDENTIDAD.razon_social);
  assert.equal(r.cuerpo.sesion.firma, null);
  pasar("sesión con ficha y sin firma");
});

probar("firma sin correo verificado", async () => {
  const estado = await invocar(firma, "/api/cliente/firma", { cookie });
  const r = await invocar(firma, "/api/cliente/firma", {
    metodo: "POST",
    cookie,
    cuerpo: {
      png: `data:image/png;base64,${firmaPNG().toString("base64")}`,
      consentimiento_hash: estado.cuerpo.consentimiento_hash,
    },
  });
  assert.equal(r.estado, 403);
  assert.equal(r.cuerpo.codigo, "verificar_correo");
  pasar("403 verificar_correo");
});

probar("correo de verificación usable", async () => {
  const mensaje = await correoMasReciente();
  assert.ok(mensaje, "no se escribió el correo");
  assert.equal(mensaje.para, CUENTA.correo);
  const token = tokenDe(mensaje.texto, "verificar");
  assert.ok(token, "el correo no trae enlace");
  const r = await invocar(verificar, "/api/auth/verificar", {
    metodo: "POST",
    cuerpo: { token },
  });
  assert.equal(r.estado, 200);
  const repetido = await invocar(verificar, "/api/auth/verificar", {
    metodo: "POST",
    cuerpo: { token },
  });
  assert.equal(repetido.estado, 400);
  pasar("verifica una vez y rechaza el segundo uso");
});

probar("firma única", async () => {
  const estado = await invocar(firma, "/api/cliente/firma", { cookie });
  assert.equal(estado.estado, 200);
  assert.equal(estado.cuerpo.verificado, true);
  assert.match(estado.cuerpo.consentimiento_hash, /^[0-9a-f]{64}$/);

  const png = firmaPNG().toString("base64");
  const primera = await invocar(firma, "/api/cliente/firma", {
    metodo: "POST",
    cookie,
    cuerpo: { png: `data:image/png;base64,${png}`, consentimiento_hash: estado.cuerpo.consentimiento_hash },
  });
  assert.equal(primera.estado, 201);
  assert.equal(primera.cuerpo.firma.metodo, "simple_reforzada");

  const segunda = await invocar(firma, "/api/cliente/firma", {
    metodo: "POST",
    cookie,
    cuerpo: { png: `data:image/png;base64,${png}`, consentimiento_hash: estado.cuerpo.consentimiento_hash },
  });
  assert.equal(segunda.estado, 409);
  assert.equal(segunda.cuerpo.codigo, "firma_existente");

  const despues = await invocar(firma, "/api/cliente/firma", { cookie });
  assert.equal(despues.cuerpo.firma.sha256, primera.cuerpo.firma.sha256);
  assert.ok(despues.cuerpo.firma.png.startsWith("data:image/png;base64,"));
  pasar("201 la primera, 409 la segunda, y la original no cambia");
});

probar("consentimiento alterado", async () => {
  const estado = await invocar(firma, "/api/cliente/firma", { cookie });
  void estado;
  // El cliente ya firmó: el consentimiento se comprueba antes de la
  // unicidad, así que un hash viejo debe dar 409 consentimiento.
  const r = await invocar(firma, "/api/cliente/firma", {
    metodo: "POST",
    cookie,
    cuerpo: { png: `data:image/png;base64,${firmaPNG().toString("base64")}`, consentimiento_hash: "f".repeat(64) },
  });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.codigo, "consentimiento");
  pasar("409 consentimiento antes de la unicidad");
});

const PROYECTO = {
  nombre: "Estudio Ana",
  categoria: "Aplicación web",
  dominio: "estudio-ana.com.ve",
  buzones: ["contacto@estudio-ana.com.ve", "no-reply@estudio-ana.com.ve"],
  alcance:
    "Aplicación para agendar citas, cobrar anticipos y enviar recordatorios por correo a cada clienta.",
  complejidad: "media",
  plan_clave: "supabase",
  plan_nivel: "inicial",
};

let proyectoGuardado = null;

probar("proyecto sin sesión cuesta 401", async () => {
  const r = await invocar(proyecto, "/api/cliente/proyecto");
  assert.equal(r.estado, 401);
  pasar("401 sin cookie");
});

probar("proyecto: catálogo de planes desde la base", async () => {
  const r = await invocar(proyecto, "/api/cliente/proyecto", { cookie });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.proyecto, null);
  assert.equal(r.cuerpo.planes.length, 2);
  const niveles = r.cuerpo.planes.flatMap((p) => p.niveles);
  assert.equal(niveles.length, 4);
  const texto = JSON.stringify(r.cuerpo);
  assert.ok(!texto.includes("costo_estimado"), "se filtró el costo interno");
  assert.ok(!texto.includes("margen"), "se filtró el margen interno");
  assert.ok(niveles.every((n) => Number.isInteger(n.version) && n.version >= 1));
  assert.ok(niveles.every((n) => n.fecha_larga.length > 0 && n.fuente.length > 0));
  assert.ok(r.cuerpo.categorias.includes("Aplicación web"));

  const filas = await cliente.query(
    "select clave, nivel, version, precio_usd::float8 as precio from planes_infra where estado = 'vigente'",
  );
  for (const fila of filas.rows) {
    const enApi = niveles.find((n) => n.clave === fila.clave && n.nivel === fila.nivel);
    assert.ok(enApi, `falta ${fila.clave}/${fila.nivel}`);
    assert.equal(enApi.version, fila.version);
    assert.equal(enApi.precio_usd, fila.precio);
  }
  pasar("4 niveles vigentes y precios idénticos a planes_infra");
});

probar("proyecto: seis buzones rechazados", async () => {
  const r = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: {
      ...PROYECTO,
      buzones: [
        "no-reply@estudio-ana.com.ve",
        "a@estudio-ana.com.ve",
        "b@estudio-ana.com.ve",
        "c@estudio-ana.com.ve",
        "d@estudio-ana.com.ve",
        "e@estudio-ana.com.ve",
      ],
    },
  });
  assert.equal(r.estado, 400);
  assert.equal(r.cuerpo.codigo, "buzon");
  pasar("400 buzon");
});

probar("proyecto: sin no-reply y dominio ajeno rechazados", async () => {
  const sinNoReply = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: { ...PROYECTO, buzones: ["contacto@estudio-ana.com.ve"] },
  });
  assert.equal(sinNoReply.estado, 400);
  assert.equal(sinNoReply.cuerpo.codigo, "buzon");

  const otroDominio = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: {
      ...PROYECTO,
      buzones: ["no-reply@estudio-ana.com.ve", "hola@otro-dominio.com"],
    },
  });
  assert.equal(otroDominio.estado, 400);
  assert.equal(otroDominio.cuerpo.codigo, "buzon");
  pasar("400 sin no-reply y 400 con dominio ajeno");
});

probar("proyecto: borrador guardado", async () => {
  const r = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: PROYECTO,
  });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.proyecto.estado, "borrador");
  assert.equal(r.cuerpo.proyecto.plan.clave, "supabase");
  assert.equal(r.cuerpo.proyecto.plan.nivel, "inicial");
  assert.equal(r.cuerpo.proyecto.plan.precio_usd, 0);
  assert.equal(r.cuerpo.proyecto.buzones[0], "no-reply@estudio-ana.com.ve");
  assert.equal(r.cuerpo.proyecto.buzones.length, 2);
  proyectoGuardado = r.cuerpo.proyecto;
  pasar("201, plan Inicial sin costo y no-reply primero");
});

probar("proyecto: cambiar preset recalcula precio y versión", async () => {
  const r = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: { ...PROYECTO, plan_clave: "neon-vercel", plan_nivel: "pro" },
  });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.proyecto.id, proyectoGuardado.id, "creó otro proyecto");
  assert.equal(r.cuerpo.proyecto.plan.clave, "neon-vercel");
  assert.equal(r.cuerpo.proyecto.plan.nivel, "pro");
  assert.equal(r.cuerpo.proyecto.plan.precio_usd, 30);
  assert.ok(r.cuerpo.proyecto.plan.version >= 1);

  const leido = await invocar(proyecto, "/api/cliente/proyecto", { cookie });
  assert.equal(leido.cuerpo.proyecto.plan.clave, "neon-vercel");
  assert.equal(leido.cuerpo.proyecto.plan.precio_usd, 30);
  pasar("mismo proyecto, precio 30 y plan leído de vuelta");
});

probar("proyecto: enviar congela el alcance", async () => {
  const r = await invocar(enviarProyecto, "/api/cliente/proyecto/enviar", {
    metodo: "POST",
    cookie,
  });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.proyecto.estado, "enviado");
  assert.ok(r.cuerpo.proyecto.enviado);
  assert.equal(r.cuerpo.proyecto.alcance, PROYECTO.alcance);

  const evento = await cliente.query(
    "select accion from eventos where accion = 'proyecto.enviado'",
  );
  assert.equal(evento.rows.length, 1);
  pasar("200 enviado, fecha de envío y evento de auditoría");
});

probar("proyecto: un enviado no se edita ni se duplica", async () => {
  const otraVez = await invocar(enviarProyecto, "/api/cliente/proyecto/enviar", {
    metodo: "POST",
    cookie,
  });
  assert.equal(otraVez.estado, 409);
  assert.equal(otraVez.cuerpo.codigo, "sin_borrador");

  const cambio = await invocar(proyecto, "/api/cliente/proyecto", {
    metodo: "POST",
    cookie,
    cuerpo: { ...PROYECTO, nombre: "Otro nombre", alcance: "x".repeat(60) },
  });
  assert.equal(cambio.estado, 409);
  assert.equal(cambio.cuerpo.codigo, "proyecto_enviado");

  const filas = await cliente.query(
    "select nombre, alcance, estado from proyectos",
  );
  assert.equal(filas.rows.length, 1, "se creó un segundo proyecto");
  assert.equal(filas.rows[0].nombre, PROYECTO.nombre);
  assert.equal(filas.rows[0].alcance, PROYECTO.alcance);
  assert.equal(filas.rows[0].estado, "enviado");

  const leido = await invocar(proyecto, "/api/cliente/proyecto", { cookie });
  assert.equal(leido.cuerpo.proyecto.estado, "enviado");
  assert.equal(leido.cuerpo.proyecto.nombre, PROYECTO.nombre);
  pasar("409 sin_borrador, 409 proyecto_enviado y una sola fila intacta");
});

const REPRESENTANTE = {
  nombre: "José Blink",
  documento: "V-12345678",
  domicilio: "Av. Francisco de Miranda, Caracas, Distrito Capital, Venezuela",
  correo: "representante@blink.com.ve",
};

let cookieAdmin = null;
let expediente = null;

probar("administración: la captura del representante exige rol admin", async () => {
  const anonima = await invocar(representante, "/api/admin/representante");
  assert.equal(anonima.estado, 401);

  const deCliente = await invocar(representante, "/api/admin/representante", { cookie });
  assert.equal(deCliente.estado, 403);
  assert.equal(deCliente.cuerpo.codigo, "rol");

  const alta = await invocar(representante, "/api/admin/representante", {
    metodo: "POST",
    cookie,
    cuerpo: { ...REPRESENTANTE, png: `data:image/png;base64,${firmaPNG().toString("base64")}` },
  });
  assert.equal(alta.estado, 403);
  pasar("401 sin sesión y 403 para el cliente");
});

probar("administración: ingreso del representante de Blink", async () => {
  const r = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: ADMIN.correo, clave: ADMIN.clave },
  });
  assert.equal(r.estado, 200);
  cookieAdmin = galleta(r);
  assert.ok(cookieAdmin && cookieAdmin.length >= 40);
  pasar("200 y cookie de administración");
});

probar("representante: domicilio obligatorio y captura firmada", async () => {
  const png = `data:image/png;base64,${firmaPNG("representante").toString("base64")}`;

  const sinDomicilio = await invocar(representante, "/api/admin/representante", {
    metodo: "POST",
    cookie: cookieAdmin,
    cuerpo: { ...REPRESENTANTE, domicilio: "", png },
  });
  assert.equal(sinDomicilio.estado, 400);
  assert.equal(sinDomicilio.cuerpo.codigo, "domicilio");

  const r = await invocar(representante, "/api/admin/representante", {
    metodo: "POST",
    cookie: cookieAdmin,
    cuerpo: { ...REPRESENTANTE, png },
  });
  assert.equal(r.estado, 201);
  assert.match(r.cuerpo.representante.sha256, /^[0-9a-f]{64}$/);

  const leido = await invocar(representante, "/api/admin/representante", { cookie: cookieAdmin });
  assert.equal(leido.estado, 200);
  assert.equal(leido.cuerpo.representante.nombre, REPRESENTANTE.nombre);
  assert.equal(leido.cuerpo.representante.documento, REPRESENTANTE.documento);
  assert.equal(leido.cuerpo.representante.domicilio, REPRESENTANTE.domicilio);
  assert.ok(leido.cuerpo.representante.png.startsWith("data:image/png;base64,"));
  pasar("400 sin domicilio, 201 con la captura y lectura de vuelta");
});

probar("expediente: el cliente no genera; la administración sí", async () => {
  const deCliente = await invocar(generarExpediente, "/api/documentos/generar", {
    metodo: "POST",
    cookie,
    cuerpo: { proyecto_id: proyectoGuardado.id },
  });
  assert.equal(deCliente.estado, 403);
  assert.equal(deCliente.cuerpo.codigo, "rol");

  const r = await invocar(generarExpediente, "/api/documentos/generar", {
    metodo: "POST",
    cookie: cookieAdmin,
    cuerpo: { proyecto_id: proyectoGuardado.id },
  });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.reutilizado, false);
  assert.deepEqual(
    r.cuerpo.documentos.map((d) => d.codigo),
    [
      "BWS-REG-001",
      "BWS-LEG-002",
      "BWS-LEG-003",
      "BWS-CON-004",
      "BWS-PRI-005",
      "BWS-WEB-006",
      "BWS-LIC-007",
      "BWS-NDA-008",
    ],
  );
  let anterior = "GENESIS";
  for (const [indice, doc] of r.cuerpo.documentos.entries()) {
    assert.equal(doc.orden, indice + 1);
    assert.equal(doc.hash_anterior, anterior);
    assert.equal(doc.estado, "firmado");
    assert.match(doc.sello, /^[0-9a-f]{64}$/);
    assert.match(doc.hash_archivo, /^[0-9a-f]{64}$/);
    assert.equal(doc.hash_cadena, hashCadena(anterior, doc.sello, doc.orden));
    anterior = doc.hash_cadena;
  }
  expediente = r.cuerpo;
  pasar("8 documentos sellados y encadenados desde GENESIS");
});

probar("expediente: generar dos veces reutiliza lo guardado", async () => {
  const r = await invocar(generarExpediente, "/api/documentos/generar", {
    metodo: "POST",
    cookie: cookieAdmin,
    cuerpo: { proyecto_id: proyectoGuardado.id },
  });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.reutilizado, true);
  assert.deepEqual(
    r.cuerpo.documentos.map((d) => d.hash_cadena),
    expediente.documentos.map((d) => d.hash_cadena),
  );

  const filas = await cliente.query(
    `select
       (select count(*)::int from documentos where proyecto_id = $1) as documentos,
       (select count(*)::int from actos_firma a
          join documentos d on d.id = a.documento_id
         where d.proyecto_id = $1 and a.firmante = 'representante') as representante,
       (select estado from proyectos where id = $1) as estado`,
    [proyectoGuardado.id],
  );
  assert.equal(filas.rows[0].documentos, 8);
  assert.equal(filas.rows[0].representante, 8);
  assert.equal(filas.rows[0].estado, "en_revision");
  pasar("200 reutilizado, 8 documentos, 8 actos del representante y proyecto en revisión");
});

probar("expediente: el PDF trae las dos firmas y el sello", async () => {
  const fila = await cliente.query(
    "select pdf, hash_archivo from documentos where proyecto_id = $1 order by orden limit 1",
    [proyectoGuardado.id],
  );
  const pdf = fila.rows[0].pdf;
  assert.equal(sha256Hex(pdf), fila.rows[0].hash_archivo);

  const alterado = Buffer.from(pdf);
  alterado[alterado.length - 1] ^= 0x01;
  assert.notEqual(sha256Hex(alterado), fila.rows[0].hash_archivo, "alterar un byte no cambió el hash");

  const texto = execFileSync("pdftotext", ["-", "-"], {
    input: pdf,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  for (const esperado of [
    REPRESENTANTE.nombre,
    REPRESENTANTE.documento,
    CUENTA.nombre,
    "Representante legal de Blink",
    "Cliente",
    "Firma electrónica simple (no certificada)",
    "Sello de contenido (SHA-256)",
    "Hash de cadena",
  ]) {
    assert.ok(texto.includes(esperado), `el PDF no imprime «${esperado}»`);
  }
  pasar("hash idéntico, un byte alterado lo cambia y el texto trae firmas, sello y cadena");
});

probar("expediente: antes de confirmar está íntegro pero incompleto", async () => {
  const r = await invocar(
    verificarExpediente,
    `/api/documentos/verificar?proyecto_id=${proyectoGuardado.id}`,
    { cookie: cookieAdmin },
  );
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.integro, true);
  assert.equal(r.cuerpo.completo, false);
  assert.equal(r.cuerpo.ok, false);
  assert.equal(r.cuerpo.cadena_ok, true);
  assert.ok(r.cuerpo.documentos.every((d) => d.actos.representante.hecho && !d.actos.cliente.hecho));
  pasar("integro sin actos del cliente: completo en falso");
});

probar("expediente: el cliente confirma una sola vez", async () => {
  const primera = await invocar(firmarExpediente, "/api/documentos/firmar", {
    metodo: "POST",
    cookie,
  });
  assert.equal(primera.estado, 200);
  assert.equal(primera.cuerpo.actos, 8);
  assert.equal(primera.cuerpo.documentos, 8);

  const segunda = await invocar(firmarExpediente, "/api/documentos/firmar", {
    metodo: "POST",
    cookie,
  });
  assert.equal(segunda.estado, 409);
  assert.equal(segunda.cuerpo.codigo, "expediente_firmado");

  const actos = await cliente.query(
    `select count(*)::int as total,
            count(*) filter (where firmante = 'cliente')::int as cliente
     from actos_firma a join documentos d on d.id = a.documento_id
     where d.proyecto_id = $1`,
    [proyectoGuardado.id],
  );
  assert.equal(actos.rows[0].total, 16);
  assert.equal(actos.rows[0].cliente, 8);
  pasar("200 con 8 actos, 409 la segunda vez y 16 actos en total");
});

probar("expediente: la verificación cuadra para las dos partes", async () => {
  const admin = await invocar(
    verificarExpediente,
    `/api/documentos/verificar?proyecto_id=${proyectoGuardado.id}`,
    { cookie: cookieAdmin },
  );
  assert.equal(admin.estado, 200);
  assert.equal(admin.cuerpo.integro, true);
  assert.equal(admin.cuerpo.completo, true);
  assert.equal(admin.cuerpo.cadena_ok, true);
  assert.equal(admin.cuerpo.documentos.length, 8);
  for (const doc of admin.cuerpo.documentos) {
    assert.equal(doc.plantilla_ok, true, `${doc.codigo}: plantilla`);
    assert.equal(doc.sello_ok, true, `${doc.codigo}: sello`);
    assert.equal(doc.archivo_ok, true, `${doc.codigo}: archivo`);
    assert.equal(doc.cadena_ok, true, `${doc.codigo}: cadena`);
    assert.ok(doc.actos.representante.hecho, `${doc.codigo}: falta el representante`);
    assert.ok(doc.actos.cliente.hecho, `${doc.codigo}: falta el cliente`);
  }

  const propio = await invocar(verificarExpediente, "/api/documentos/verificar", { cookie });
  assert.equal(propio.estado, 200);
  assert.equal(propio.cuerpo.integro, true);
  assert.equal(propio.cuerpo.completo, true);
  assert.equal(propio.cuerpo.proyecto_id, proyectoGuardado.id);

  const sinProyecto = await invocar(verificarExpediente, "/api/documentos/verificar", {
    cookie: cookieAdmin,
  });
  assert.equal(sinProyecto.estado, 400);
  pasar("íntegro, completo y cadena ok; el cliente ve el mismo expediente");
});

probar("expediente: documentos y actos no se editan ni se borran", async () => {
  const cambios = [
    ["update documentos set sello = $2 where proyecto_id = $1", [proyectoGuardado.id, "0".repeat(64)]],
    ["delete from actos_firma where documento_id in (select id from documentos where proyecto_id = $1)", [proyectoGuardado.id]],
    ["update representantes set nombre = 'Otro' where documento is not null", []],
  ];
  for (const [sql, parametros] of cambios) {
    let rechazo = null;
    try {
      await cliente.query(sql, parametros);
    } catch (error) {
      rechazo = error;
    }
    assert.equal(rechazo?.code, "42501", `no se rechazó: ${sql}`);
  }

  const eventos = await cliente.query(
    "select accion from eventos where accion in ('representante.capturado','expediente.generado','expediente.firmado')",
  );
  const acciones = new Set(eventos.rows.map((f) => f.accion));
  for (const esperada of ["representante.capturado", "expediente.generado", "expediente.firmado"]) {
    assert.ok(acciones.has(esperada), `falta el evento ${esperada}`);
  }
  pasar("42501 en documentos, actos y representantes; los tres eventos quedaron");
});

probar("sesión vencida", async () => {
  await cliente.query("update sesiones set expira = now() - interval '1 minute'");
  const r = await invocar(sesionActual, "/api/auth/sesion", { cookie });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.sesion, null);
  assert.match(r.cabeceras.get("set-cookie") ?? "", /Max-Age=0/);
  pasar("sesión vencida devuelve null y borra la cookie");
});

probar("salida revoca la sesión", async () => {
  const entrada = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, clave: CUENTA.clave },
  });
  const nueva = galleta(entrada);
  const antes = await invocar(sesionActual, "/api/auth/sesion", { cookie: nueva });
  assert.ok(antes.cuerpo.sesion);
  const r = await invocar(salir, "/api/auth/salir", { metodo: "POST", cookie: nueva });
  assert.equal(r.estado, 200);
  const despues = await invocar(sesionActual, "/api/auth/sesion", { cookie: nueva });
  assert.equal(despues.cuerpo.sesion, null);
  pasar("salir revoca y la cookie deja de valer");
});

probar("recuperación y restablecimiento", async () => {
  const pedido = await invocar(recuperar, "/api/auth/recuperar", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo },
  });
  assert.equal(pedido.estado, 202);
  assert.match(pedido.cuerpo.mensaje, /Si ese correo tiene una cuenta/);

  const mensaje = await correoMasReciente();
  const token = tokenDe(mensaje.texto, "recuperar");
  assert.ok(token);

  const debil = await invocar(restablecer, "/api/auth/restablecer", {
    metodo: "POST",
    cuerpo: { token, clave: "corta" },
  });
  assert.equal(debil.estado, 400);
  assert.equal(debil.cuerpo.codigo, "clave");

  const nuevaClave = "otra-Clave-2026";
  const cambio = await invocar(restablecer, "/api/auth/restablecer", {
    metodo: "POST",
    cuerpo: { token, clave: nuevaClave },
  });
  assert.equal(cambio.estado, 200);

  const otraVez = await invocar(restablecer, "/api/auth/restablecer", {
    metodo: "POST",
    cuerpo: { token, clave: nuevaClave },
  });
  assert.equal(otraVez.estado, 400);

  const vieja = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, clave: CUENTA.clave },
  });
  assert.equal(vieja.estado, 401);

  const nueva = await invocar(ingreso, "/api/auth/ingreso", {
    metodo: "POST",
    cuerpo: { correo: CUENTA.correo, clave: nuevaClave },
  });
  assert.equal(nueva.estado, 200);
  pasar("token de un solo uso, clave nueva y clave vieja rechazada");
});

probar("tokens en base, nunca en claro", async () => {
  const filas = await cliente.query("select token_hash, usado from tokens_correo");
  assert.ok(filas.rows.length >= 2);
  for (const fila of filas.rows) {
    assert.match(fila.token_hash, /^[0-9a-f]{64}$/);
  }
  const eventos = await cliente.query(
    "select accion from eventos where accion in ('cuenta.creada','correo.verificado','clave.restablecida','firma.capturada')",
  );
  const acciones = new Set(eventos.rows.map((f) => f.accion));
  for (const esperada of ["cuenta.creada", "correo.verificado", "clave.restablecida", "firma.capturada"]) {
    assert.ok(acciones.has(esperada), `falta el evento ${esperada}`);
  }
  pasar("hashes de 64 caracteres y auditoría completa");
});

let fallos = 0;
for (const prueba of pruebas) {
  try {
    await prueba.fn();
  } catch (error) {
    fallos += 1;
    console.error(`  ✗ ${prueba.nombre}: ${error.message}`);
  }
}

await cliente.query("truncate usuarios, representantes, plantillas, limites cascade");
await cliente.end();
await rm(CORREO_DIR, { recursive: true, force: true });

console.log(`\n${ok}/${pruebas.length} comprobaciones en verde.`);
if (fallos || ok !== pruebas.length) process.exit(1);
