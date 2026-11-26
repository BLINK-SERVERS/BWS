import { createHash } from "node:crypto";
import {
  type Usuario,
  abrirSesion,
  cerrarSesion,
  clienteDe,
  consultarCredencial,
  consultarLimite,
  consultarSesion,
  crearCuentaConSesion,
} from "./db";
import { hashearClave, verificarClave } from "./clave";
import { ErrorHttp, agenteDe, codigoPostgres, cookiesDe, exigirOrigen, hashLimite, ipDe, json, leerJson } from "./http";
import { cookieSesion, cookieSesionVacia, crearSesion, nombreCookie } from "./sesion";

interface Entrada {
  nombre?: unknown;
  correo?: unknown;
  ciudad?: unknown;
  clave?: unknown;
}

function textoDe(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

function correoValido(valor: string): boolean {
  return valor.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function claveValida(valor: string): boolean {
  return valor.length >= 10 && valor.length <= 128;
}

function normalizarRegistro(entrada: unknown): { nombre: string; correo: string; ciudad: string; clave: string } {
  const objeto = typeof entrada === "object" && entrada !== null && !Array.isArray(entrada) ? entrada as Entrada : {};
  const nombre = (textoDe(objeto.nombre) ?? "").trim().replace(/\s+/g, " ");
  const correo = (textoDe(objeto.correo) ?? "").trim().toLowerCase();
  const ciudad = textoDe(objeto.ciudad);
  const clave = textoDe(objeto.clave) ?? "";

  if (nombre.length < 2 || nombre.length > 80) {
    throw new ErrorHttp(400, "Escribe un nombre de 2 a 80 caracteres.", "nombre");
  }
  if (!correoValido(correo)) {
    throw new ErrorHttp(400, "Escribe un correo válido.", "correo");
  }
  if (ciudad !== "Maracaibo" && ciudad !== "San Francisco") {
    throw new ErrorHttp(400, "Selecciona Maracaibo o San Francisco.", "ciudad");
  }
  if (!claveValida(clave)) {
    throw new ErrorHttp(400, "La contraseña debe tener entre 10 y 128 caracteres.", "clave");
  }
  return { nombre, correo, ciudad, clave };
}

function normalizarIngreso(entrada: unknown): { correo: string; clave: string } {
  const objeto = typeof entrada === "object" && entrada !== null && !Array.isArray(entrada) ? entrada as Entrada : {};
  const correo = (textoDe(objeto.correo) ?? "").trim().toLowerCase();
  const clave = textoDe(objeto.clave) ?? "";
  if (!correoValido(correo) || !claveValida(clave)) {
    throw new ErrorHttp(400, "Revisa el correo y la contraseña.", "credenciales");
  }
  return { correo, clave };
}

async function limitar(
  cliente: ReturnType<typeof clienteDe>,
  accion: string,
  ip: string | null,
  correo: string,
  maximo: number,
  ventana: number,
): Promise<void> {
  const ipHash = hashLimite(`${accion}:ip:${ip ?? "sin-ip"}`);
  const limiteIp = await consultarLimite(cliente, ipHash, maximo, ventana);
  if (!limiteIp.permitido) throw demorar(limiteIp.expira);

  const correoHash = hashLimite(`${accion}:correo:${correo}`);
  const limiteCorreo = await consultarLimite(cliente, correoHash, Math.max(3, Math.floor(maximo / 2)), ventana);
  if (!limiteCorreo.permitido) throw demorar(limiteCorreo.expira);
}

function demorar(expira: string): ErrorHttp {
  const segundos = Math.max(1, Math.ceil((new Date(expira).getTime() - Date.now()) / 1_000));
  return new ErrorHttp(429, "Demasiados intentos. Espera un momento antes de volver a intentarlo.", "limite", { "retry-after": String(segundos) });
}

function respuestaSesion(usuario: Usuario, token: string, sesion: ReturnType<typeof crearSesion>, env: Env, estado: number): Response {
  return json({ usuario }, estado, { "set-cookie": cookieSesion(env.ENTORNO === "local", token, sesion.expira) });
}

export async function registrar(peticion: Request, env: Env): Promise<Response> {
  exigirOrigen(peticion, env.ENTORNO, env.APP_ORIGEN);
  const datos = normalizarRegistro(await leerJson(peticion));
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  const cliente = clienteDe(env);
  try {
    await cliente.connect();
    await limitar(cliente, "registro", ip, datos.correo, 10, 15 * 60);
    const claveHash = await hashearClave(env, datos.clave);
    const sesion = crearSesion();
    const usuario = await crearCuentaConSesion(cliente, { ...sesion, ...datos, claveHash, ip, agente });
    return respuestaSesion(usuario, sesion.token, sesion, env, 201);
  } catch (error) {
    if (codigoPostgres(error) === "23505") {
      throw new ErrorHttp(409, "Ya existe una cuenta con ese correo.", "correo");
    }
    throw error;
  } finally {
    await cliente.end();
  }
}

export async function ingresar(peticion: Request, env: Env): Promise<Response> {
  exigirOrigen(peticion, env.ENTORNO, env.APP_ORIGEN);
  const datos = normalizarIngreso(await leerJson(peticion));
  const ip = ipDe(peticion);
  const agente = agenteDe(peticion);
  const cliente = clienteDe(env);
  try {
    await cliente.connect();
    await limitar(cliente, "ingreso", ip, datos.correo, 20, 15 * 60);
    const credencial = await consultarCredencial(cliente, datos.correo);
    const coincide = await verificarClave(env, datos.clave, credencial?.clave_hash ?? null);
    if (!credencial || !credencial.activo || !coincide) {
      throw new ErrorHttp(401, "Correo o contraseña incorrectos.", "credenciales");
    }
    const sesion = crearSesion();
    await abrirSesion(cliente, credencial, { ...sesion, ip, agente });
    return respuestaSesion({ id: credencial.id, nombre: credencial.nombre, correo: credencial.correo, ciudad: credencial.ciudad, rol: credencial.rol }, sesion.token, sesion, env, 200);
  } finally {
    await cliente.end();
  }
}

function tokenSesion(peticion: Request, env: Env): string | null {
  const token = cookiesDe(peticion)[nombreCookie(env.ENTORNO === "local")];
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function sesion(peticion: Request, env: Env): Promise<Response> {
  const token = tokenSesion(peticion, env);
  if (!token) return json({ usuario: null });
  const cliente = clienteDe(env);
  try {
    await cliente.connect();
    const usuario = await consultarSesion(cliente, createHash("sha256").update(token).digest("hex"));
    if (!usuario) return json({ usuario: null }, 200, { "set-cookie": cookieSesionVacia(env.ENTORNO === "local") });
    return json({ usuario });
  } finally {
    await cliente.end();
  }
}

export async function salir(peticion: Request, env: Env): Promise<Response> {
  exigirOrigen(peticion, env.ENTORNO, env.APP_ORIGEN);
  const token = tokenSesion(peticion, env);
  const limpiar = { "set-cookie": cookieSesionVacia(env.ENTORNO === "local") };
  if (!token) return json({ ok: true }, 200, limpiar);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const cliente = clienteDe(env);
  try {
    await cliente.connect();
    const usuario = await consultarSesion(cliente, tokenHash);
    if (usuario) await cerrarSesion(cliente, usuario, tokenHash, { ip: ipDe(peticion), agente: agenteDe(peticion) });
    return json({ ok: true }, 200, limpiar);
  } finally {
    await cliente.end();
  }
}
