import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseURL = (process.env.RUTA_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const origen = new URL(baseURL).origin;
const produccion = process.env.RUTA_ENTORNO === "produccion";
const cookieNombre = produccion ? "__Host-ruta_sesion" : "ruta_sesion";
const correo = `prueba-${randomUUID()}@example.com`;
const clave = "PruebaSegura2026!";
const cuenta = { nombre: "Cuenta de Prueba", correo, ciudad: "Maracaibo", clave };
const clavesUsuario = ["id", "nombre", "correo", "ciudad", "rol"].sort();

async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${baseURL}${ruta}`, {
    redirect: "manual",
    ...opciones,
    headers: {
      ...(opciones.body ? { "content-type": "application/json" } : {}),
      ...opciones.headers,
    },
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  return { respuesta, datos };
}

function jsonPost(cuerpo, origenPeticion = origen, cookie = "") {
  return {
    method: "POST",
    body: JSON.stringify(cuerpo),
    headers: {
      origin: origenPeticion,
      ...(cookie ? { cookie } : {}),
    },
  };
}

let cookie = "";
try {
  const portada = await pedir("/cars/");
  assert.equal(portada.respuesta.status, 200);
  assert.match(portada.respuesta.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(portada.respuesta.headers.get("x-content-type-options"), "nosniff");

  for (const ruta of ["/", "/cars"]) {
    const redireccion = await pedir(ruta);
    assert.equal(redireccion.respuesta.status, 308);
    assert.equal(redireccion.respuesta.headers.get("location"), "/cars/");
  }

  const metodo = await pedir("/api/auth/registro");
  assert.equal(metodo.respuesta.status, 405);
  assert.equal(metodo.respuesta.headers.get("allow"), "POST");

  const origenInvalido = await pedir("/api/auth/registro", jsonPost(cuenta, "https://origen-no-permitido.example"));
  assert.equal(origenInvalido.respuesta.status, 403);
  assert.equal(origenInvalido.datos.codigo, "origen");

  const registroInvalido = await pedir("/api/auth/registro", jsonPost({ ...cuenta, ciudad: "Caracas" }));
  assert.equal(registroInvalido.respuesta.status, 400);
  assert.equal(registroInvalido.datos.codigo, "ciudad");

  const registro = await pedir("/api/auth/registro", jsonPost(cuenta));
  assert.equal(registro.respuesta.status, 201, JSON.stringify(registro.datos));
  assert.deepEqual(Object.keys(registro.datos.usuario).sort(), clavesUsuario);
  assert.equal(registro.datos.usuario.correo, correo);
  assert.equal(registro.datos.usuario.rol, "particular");

  const cabeceraCookie = registro.respuesta.headers.get("set-cookie");
  assert.ok(cabeceraCookie?.startsWith(`${cookieNombre}=`));
  assert.match(cabeceraCookie, /HttpOnly/i);
  assert.match(cabeceraCookie, /SameSite=Lax/i);
  assert.match(cabeceraCookie, /Path=\//i);
  if (produccion) assert.match(cabeceraCookie, /Secure/i);
  else assert.doesNotMatch(cabeceraCookie, /Secure/i);
  cookie = cabeceraCookie.split(";")[0];

  const duplicado = await pedir("/api/auth/registro", jsonPost(cuenta));
  assert.equal(duplicado.respuesta.status, 409);
  assert.equal(duplicado.datos.codigo, "correo");

  const claveIncorrecta = await pedir("/api/auth/ingreso", jsonPost({ correo, clave: "ClaveIncorrecta2026!" }));
  assert.equal(claveIncorrecta.respuesta.status, 401);
  assert.deepEqual(claveIncorrecta.datos, { error: "Correo o contraseña incorrectos.", codigo: "credenciales" });

  const sesion = await pedir("/api/auth/sesion", { headers: { cookie } });
  assert.equal(sesion.respuesta.status, 200);
  assert.deepEqual(Object.keys(sesion.datos.usuario).sort(), clavesUsuario);
  assert.equal(sesion.datos.usuario.id, registro.datos.usuario.id);

  const ingreso = await pedir("/api/auth/ingreso", jsonPost({ correo, clave }));
  assert.equal(ingreso.respuesta.status, 200, JSON.stringify(ingreso.datos));
  assert.deepEqual(Object.keys(ingreso.datos.usuario).sort(), clavesUsuario);
  assert.equal("clave_hash" in ingreso.datos.usuario, false);
  assert.equal("activo" in ingreso.datos.usuario, false);

  const salir = await pedir("/api/auth/salir", { method: "POST", headers: { origin: origen, cookie } });
  assert.equal(salir.respuesta.status, 200);
  assert.deepEqual(salir.datos, { ok: true });

  const sesionCerrada = await pedir("/api/auth/sesion", { headers: { cookie } });
  assert.equal(sesionCerrada.respuesta.status, 200);
  assert.deepEqual(sesionCerrada.datos, { usuario: null });
  assert.match(sesionCerrada.respuesta.headers.get("set-cookie") ?? "", /Max-Age=0/i);

  console.log(`AUTH API: PASS · ${baseURL} · ${correo}`);
} finally {
  if (cookie) await pedir("/api/auth/salir", { method: "POST", headers: { origin: origen, cookie } }).catch(() => undefined);
}
