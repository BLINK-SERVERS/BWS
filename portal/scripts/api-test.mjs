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
