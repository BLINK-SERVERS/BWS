export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  ciudad: string;
  rol: string;
}

export interface Credenciales {
  correo: string;
  clave: string;
}

export interface Registro extends Credenciales {
  nombre: string;
  ciudad: string;
}

export class ErrorCuenta extends Error {
  constructor(mensaje: string, readonly estado: number, readonly codigo?: string) {
    super(mensaje);
    this.name = "ErrorCuenta";
  }
}

async function pedir(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      credentials: "same-origin",
      cache: "no-store",
      ...opciones,
      headers: {
        ...(opciones.body ? { "content-type": "application/json" } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new ErrorCuenta("No pudimos conectar con Car Market. Revisa tu conexión e inténtalo de nuevo.", 0, "red");
  }

  let datos: unknown;
  try {
    datos = await respuesta.json() as unknown;
  } catch {
    throw new ErrorCuenta("Car Market respondió de forma inesperada. Inténtalo de nuevo.", respuesta.status, "respuesta");
  }

  if (!respuesta.ok) {
    const error = typeof datos === "object" && datos !== null && "error" in datos && typeof datos.error === "string"
      ? datos.error
      : "No pudimos completar la operación. Inténtalo de nuevo.";
    throw new ErrorCuenta(error, respuesta.status);
  }
  return datos;
}

function usuarioDe(datos: unknown): Usuario {
  if (typeof datos !== "object" || datos === null || !("usuario" in datos)) {
    throw new ErrorCuenta("No recibimos los datos de la cuenta.", 500, "respuesta");
  }
  const usuario = datos.usuario;
  if (
    typeof usuario !== "object" || usuario === null
    || !("id" in usuario) || typeof usuario.id !== "string"
    || !("nombre" in usuario) || typeof usuario.nombre !== "string"
    || !("correo" in usuario) || typeof usuario.correo !== "string"
    || !("ciudad" in usuario) || typeof usuario.ciudad !== "string"
    || !("rol" in usuario) || typeof usuario.rol !== "string"
  ) {
    throw new ErrorCuenta("Los datos de la cuenta no son válidos.", 500, "respuesta");
  }
  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, ciudad: usuario.ciudad, rol: usuario.rol };
}

export async function consultarSesion(): Promise<Usuario | null> {
  const datos = await pedir("/api/auth/sesion");
  if (typeof datos === "object" && datos !== null && "usuario" in datos && datos.usuario === null) return null;
  return usuarioDe(datos);
}

export async function crearCuenta(datos: Registro): Promise<Usuario> {
  return usuarioDe(await pedir("/api/auth/registro", { method: "POST", body: JSON.stringify(datos) }));
}

export async function entrarEnCuenta(datos: Credenciales): Promise<Usuario> {
  return usuarioDe(await pedir("/api/auth/ingreso", { method: "POST", body: JSON.stringify(datos) }));
}

export async function cerrarSesion(): Promise<void> {
  await pedir("/api/auth/salir", { method: "POST", body: "{}" });
}

export function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "TÚ";
}
