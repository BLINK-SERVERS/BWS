/* ============================================================
   Variables del Worker
   ------------------------------------------------------------
   Comprueba que la producción tiene todo lo que el portal lee de
   `process.env` y, si se pide, sube los valores a Cloudflare como
   secretos del Worker. Nunca imprime valores: solo nombres y el
   motivo cuando algo falta o no cuadra.

   · `ENTORNO=produccion` y `APP_ORIGEN=https://bws.blink.com.ve`
     viven en `wrangler.jsonc`; aquí solo se comprueban.
   · El resto sale del entorno, de `.env.produccion` o, al final,
     de `.env.local`. `.dev.vars` no se lee: apunta a la rama de
     pruebas y a un origen local.
   · `DATABASE_URL_APP` debe usar el rol `bws_app` de la rama
     principal. Una cadena igual a la de pruebas se rechaza.
   · Produce un JSON temporal en `tmp/` con permisos 600 y lo
     borra después de subirlo.

   node scripts/variables.mjs           # solo comprueba
   node scripts/variables.mjs --subir   # comprueba y sube secretos
   ============================================================ */

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCCION = join(RAIZ, ".env.produccion");
const LOCAL = join(RAIZ, ".env.local");
const WRANGLER = join(RAIZ, "wrangler.jsonc");
const TEMPORAL = join(RAIZ, "tmp", "secretos-worker.json");

const ORIGEN = "https://bws.blink.com.ve";

const IDENTIDAD = ["BWS_RAZON_SOCIAL", "BWS_RIF", "BWS_DOMICILIO", "BWS_CORREO", "BWS_TELEFONO"];
const OPCIONALES = ["TARIFA_DESARROLLO", "TARIFA_INFRA_PRO", "CORREO_PROVEEDOR_NOMBRE", "CORREO_COPIA"];

function leer(archivo) {
  if (!existsSync(archivo)) return {};
  const variables = {};
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte < 1) continue;
    const nombre = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    )
      valor = valor.slice(1, -1);
    variables[nombre] = valor;
  }
  return variables;
}

function cargar() {
  const variables = {};
  for (const archivo of [LOCAL, PRODUCCION]) {
    for (const [nombre, valor] of Object.entries(leer(archivo))) {
      if (valor) variables[nombre] = valor;
    }
  }
  for (const [nombre, valor] of Object.entries(process.env)) {
    if (valor) variables[nombre] = valor;
  }
  return variables;
}

function vacio(valor) {
  if (!valor) return true;
  return (
    valor === "[SENSITIVE]" ||
    valor === "..." ||
    valor === "J-00000000-0" ||
    /^<.*>$/.test(valor) ||
    /^(TODO|CAMBIAR|x+)$/i.test(valor)
  );
}

function correo(valor) {
  const dentro = valor.match(/<([^>]+)>/)?.[1] ?? valor;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dentro.trim());
}

function destino(cadena) {
  try {
    const url = new URL(cadena);
    return `${url.hostname}/${url.pathname.replace(/^\/+/, "")}/${url.username}`;
  } catch {
    return null;
  }
}

function revisarBase(valor, variables) {
  const url = destino(valor);
  if (!url) return "no es una URL válida";
  if (!/^postgres(ql)?:\/\//.test(valor)) return "no es una cadena de PostgreSQL";
  const pruebas = [variables.DATABASE_URL_PRUEBAS_APP, variables.DATABASE_URL_PRUEBAS]
    .filter(Boolean)
    .map(destino);
  if (pruebas.includes(url)) return "apunta a la rama de pruebas";
  if (!url.includes("bws_app")) return "el rol no es bws_app";
  return null;
}

function revisarConfig() {
  const problemas = [];
  const config = readFileSync(WRANGLER, "utf8");
  if (!/"ENTORNO"\s*:\s*"produccion"/.test(config))
    problemas.push("wrangler.jsonc: falta ENTORNO=produccion en vars");
  if (!new RegExp(`"APP_ORIGEN"\\s*:\\s*"${ORIGEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(config))
    problemas.push(`wrangler.jsonc: falta APP_ORIGEN=${ORIGEN} en vars`);
  return problemas;
}

function requeridas(variables) {
  const nombres = ["DATABASE_URL_APP"];
  const problemas = [];
  const modo = (variables.CORREO_MODO ?? "").trim();

  if (!modo) {
    problemas.push("CORREO_MODO no está definido");
  } else if (modo === "archivo") {
    problemas.push("CORREO_MODO=archivo no se permite en producción");
  } else if (modo === "resend") {
    nombres.push("CORREO_MODO", "CORREO_API_KEY", "CORREO_DESDE");
  } else if (modo === "smtp") {
    nombres.push("CORREO_MODO", "CORREO_DESDE", "SMTP_HOST", "SMTP_USER", "SMTP_PASS");
  } else {
    problemas.push("CORREO_MODO no reconocido: usa resend o smtp");
  }

  return { nombres, problemas };
}

function revisar(nombre, valor, variables) {
  if (vacio(valor)) return "falta";
  if (nombre === "DATABASE_URL_APP") return revisarBase(valor, variables);
  if (nombre === "BWS_RIF") return /^[JVEPG]-\d{8,9}-\d$/i.test(valor) ? null : "no tiene forma de RIF";
  if (nombre === "CORREO_DESDE" || nombre === "BWS_CORREO")
    return correo(valor) ? null : "no es un correo válido";
  if (nombre === "CORREO_API_KEY" && !valor.startsWith("re_"))
    return "una clave de Resend empieza por re_";
  if (nombre === "BWS_RAZON_SOCIAL" && valor.length < 3) return "es demasiado corta";
  if (nombre === "BWS_DOMICILIO" && valor.length < 5) return "es demasiado corto";
  if (nombre === "BWS_TELEFONO" && !/^[+()\d\s.-]{7,}$/.test(valor)) return "no tiene forma de teléfono";
  if (nombre === "SMTP_PORT" && !/^\d{2,5}$/.test(valor)) return "no es un puerto";
  return null;
}

function subir(variables, nombres) {
  const quien = spawnSync("npx", ["wrangler", "whoami"], { cwd: RAIZ, encoding: "utf8" });
  const salida = `${quien.stdout ?? ""}${quien.stderr ?? ""}`;
  if (quien.status !== 0 || /not authenticated/i.test(salida))
    throw new Error("Wrangler no está autenticado: ejecuta `npx wrangler login` antes de subir.");

  const pares = {};
  for (const nombre of nombres) {
    const valor = variables[nombre];
    if (valor && !vacio(valor)) pares[nombre] = valor;
  }
  mkdirSync(dirname(TEMPORAL), { recursive: true });
  writeFileSync(TEMPORAL, JSON.stringify(pares, null, 2), { mode: 0o600 });
  chmodSync(TEMPORAL, 0o600);
  try {
    const resultado = spawnSync("npx", ["wrangler", "secret", "bulk", TEMPORAL], {
      cwd: RAIZ,
      stdio: "inherit",
    });
    if (resultado.status !== 0) throw new Error("`wrangler secret bulk` falló.");
  } finally {
    rmSync(TEMPORAL, { force: true });
  }
}

function principal() {
  const variables = cargar();
  const { nombres, problemas } = requeridas(variables);

  const faltas = [...problemas];
  for (const nombre of [...nombres, ...IDENTIDAD]) {
    const motivo = revisar(nombre, variables[nombre], variables);
    if (motivo) faltas.push(`${nombre}: ${motivo}`);
    else console.log(`  ✓ ${nombre}`);
  }

  for (const nombre of OPCIONALES) {
    if (!vacio(variables[nombre])) console.log(`  ✓ ${nombre} (opcional)`);
  }

  faltas.push(...revisarConfig());

  if (faltas.length) {
    console.error("\nFaltan o no cuadran variables de producción:");
    for (const falta of faltas) console.error(`  ✗ ${falta}`);
    console.error(
      `\nComplétalas en ${PRODUCCION.replace(RAIZ, "portal")} —parte de ejemplo.env.produccion— y repite.`,
    );
    process.exit(1);
  }

  const subirTodo = process.argv.includes("--subir");
  if (!subirTodo) {
    console.log("\nTodo listo. Para cargarlas en Cloudflare: npm run vars:subir");
    return;
  }

  const subibles = [...nombres, ...IDENTIDAD, ...OPCIONALES];
  subir(variables, subibles);
  console.log("\nSecretos cargados. `ENTORNO` y `APP_ORIGEN` viajan con `npm run desplegar`.");
}

try {
  principal();
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
