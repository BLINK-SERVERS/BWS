import { Client } from "pg";

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  ciudad: string;
  rol: string;
}

interface CredencialRow extends Usuario {
  clave_hash: string;
  activo: boolean;
}

interface LimiteRow {
  permitido: boolean;
  restantes: number;
  expira: string;
}

export interface DatosSesion {
  tokenHash: string;
  expira: Date;
  ip: string | null;
  agente: string | null;
}

export interface DatosCuenta extends DatosSesion {
  correo: string;
  nombre: string;
  claveHash: string;
  ciudad: string;
}

export function clienteDe(env: Env): Client {
  return new Client({
    connectionString: env.HYPERDRIVE.connectionString,
    connectionTimeoutMillis: 5_000,
    application_name: "ruta_app",
  });
}

async function ponerIdentidad(cliente: Client, usuarioId: string, rol: string): Promise<void> {
  await cliente.query("select set_config('app.usuario_id', $1, true), set_config('app.rol', $2, true)", [usuarioId, rol]);
}

async function insertarEvento(
  cliente: Client,
  accion: string,
  entidad: string,
  entidadId: string | null,
  detalle: Record<string, unknown>,
  datos: Pick<DatosSesion, "ip" | "agente">,
): Promise<void> {
  await cliente.query(
    `insert into ruta.eventos (actor, accion, entidad, entidad_id, detalle, ip, agente)
     values (current_setting('app.usuario_id', true)::uuid, $1, $2, $3, $4::jsonb, $5::inet, $6)`,
    [accion, entidad, entidadId, JSON.stringify(detalle), datos.ip, datos.agente],
  );
}

async function revertir(cliente: Client): Promise<void> {
  try {
    await cliente.query("rollback");
  } catch {
    return;
  }
}

export async function consultarLimite(cliente: Client, clave: string, maximo: number, ventana: number): Promise<LimiteRow> {
  const resultado = await cliente.query<LimiteRow>(
    "select permitido, restantes, expira from ruta.consumir_limite($1, $2, $3)",
    [clave, maximo, ventana],
  );
  return resultado.rows[0];
}

export async function consultarCredencial(cliente: Client, correo: string): Promise<CredencialRow | null> {
  const resultado = await cliente.query<CredencialRow>("select * from ruta.credenciales($1)", [correo]);
  return resultado.rows[0] ?? null;
}

export async function consultarSesion(cliente: Client, tokenHash: string): Promise<Usuario | null> {
  const resultado = await cliente.query<Usuario>("select * from ruta.sesion_valida($1)", [tokenHash]);
  return resultado.rows[0] ?? null;
}

export async function crearCuentaConSesion(cliente: Client, datos: DatosCuenta): Promise<Usuario> {
  await cliente.query("begin");
  try {
    const resultado = await cliente.query<{ id: string }>(
      "select ruta.registrar($1, $2, $3, $4) as id",
      [datos.correo, datos.claveHash, datos.nombre, datos.ciudad],
    );
    const usuarioId = resultado.rows[0].id;
    await ponerIdentidad(cliente, usuarioId, "particular");
    await cliente.query(
      `insert into ruta.sesiones (token_hash, usuario_id, expira, ip, agente)
       values ($1, $2, $3, $4::inet, $5)`,
      [datos.tokenHash, usuarioId, datos.expira, datos.ip, datos.agente],
    );
    await insertarEvento(cliente, "cuenta.creada", "usuario", usuarioId, { rol: "particular" }, datos);
    await insertarEvento(cliente, "sesion.iniciada", "sesion", null, { medio: "contrasena" }, datos);
    await cliente.query("commit");
    return { id: usuarioId, nombre: datos.nombre, correo: datos.correo, ciudad: datos.ciudad, rol: "particular" };
  } catch (error) {
    await revertir(cliente);
    throw error;
  }
}

export async function abrirSesion(cliente: Client, usuario: Pick<Usuario, "id" | "rol">, datos: DatosSesion): Promise<void> {
  await cliente.query("begin");
  try {
    await ponerIdentidad(cliente, usuario.id, usuario.rol);
    await cliente.query(
      `insert into ruta.sesiones (token_hash, usuario_id, expira, ip, agente)
       values ($1, $2, $3, $4::inet, $5)`,
      [datos.tokenHash, usuario.id, datos.expira, datos.ip, datos.agente],
    );
    await insertarEvento(cliente, "sesion.iniciada", "sesion", null, { medio: "contrasena" }, datos);
    await cliente.query("commit");
  } catch (error) {
    await revertir(cliente);
    throw error;
  }
}

export async function cerrarSesion(cliente: Client, usuario: Usuario, tokenHash: string, datos: Pick<DatosSesion, "ip" | "agente">): Promise<void> {
  await cliente.query("begin");
  try {
    await ponerIdentidad(cliente, usuario.id, usuario.rol);
    await cliente.query("update ruta.sesiones set revocada = true where token_hash = $1 and usuario_id = $2", [tokenHash, usuario.id]);
    await insertarEvento(cliente, "sesion.cerrada", "sesion", null, {}, datos);
    await cliente.query("commit");
  } catch (error) {
    await revertir(cliente);
    throw error;
  }
}
