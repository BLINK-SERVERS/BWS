/* ============================================================
   Frontera única con la API
   ------------------------------------------------------------
   El navegador no habla con Neon, con Resend ni con nadie más:
   solo con `/api` del mismo origen. La cookie de sesión viaja
   sola; ninguna petición guarda tokens en `localStorage`.
   ============================================================ */

import type { Bloque } from "../../legal/tipos";

export type TipoDocumento = "RIF" | "cedula" | "pasaporte";

export interface DocumentoPrevia {
  codigo: string;
  titulo: string;
  version: string;
  resumen: string;
  bloques: Bloque[];
  hash: string;
  hash_plantilla: string;
}

export interface PrestadorPortal {
  razon_social: string;
  rif: string;
  domicilio: string;
  correo: string;
  telefono: string;
  provisional: boolean;
}

export interface PreviaRegistro {
  documentos: DocumentoPrevia[];
  prestador: PrestadorPortal;
}

export interface ClienteDatos {
  razon_social: string;
  documento_tipo: TipoDocumento;
  documento_numero: string;
  domicilio: string;
  telefono: string;
  correo_factura: string;
}

export interface CuentaDatos {
  correo: string;
  clave: string;
  nombre: string;
}

export interface ClienteCuenta {
  id: string;
  razon_social: string;
  documento_tipo: string;
  documento_numero: string;
  domicilio_fiscal: string;
  telefono: string;
  correo_factura: string;
}

export interface FirmaCuenta {
  id: string;
  sha256: string;
  utc: string;
  metodo: string;
  version: number;
  hash_consentimiento: string;
  png?: string | null;
}

export interface SesionPortal {
  usuario: {
    nombre: string;
    correo: string;
    rol: "cliente" | "admin";
    verificado: boolean;
  };
  cliente: ClienteCuenta | null;
  firma: FirmaCuenta | null;
}

export interface EstadoFirma {
  verificado: boolean;
  consentimiento_hash: string;
  consentimiento: DocumentoPrevia;
  firma: FirmaCuenta | null;
}

export interface RespuestaRegistro {
  ok: true;
  correo: string;
  verificacion_enviada: boolean;
}

export interface LimitePlan {
  concepto: string;
  valor: string;
}

export interface PlanVista {
  clave: string;
  nivel: string;
  version: number;
  nombre: string;
  precio_usd: number;
  limites: LimitePlan[];
  fuente: string;
  fecha: string;
  fecha_larga: string;
}

export interface PresetPlan {
  clave: string;
  nombre: string;
  niveles: PlanVista[];
}

export type Complejidad = "simple" | "media" | "alta";

export interface ProyectoDatos {
  nombre: string;
  categoria: string;
  dominio: string;
  buzones: string[];
  alcance: string;
  complejidad: Complejidad;
  plan_clave: string;
  plan_nivel: string;
}

export interface ProyectoVista extends ProyectoDatos {
  id: string;
  estado: string;
  creado: string;
  enviado: string | null;
  plan: PlanVista;
}

export interface Condiciones {
  tarifa_desarrollo: string;
  tarifa_infra_pro: string;
  demo_plazo: string;
  dominio_costo_eur: string;
  licencia_duracion: string;
  credito_meses: string;
}

export interface DatosProyecto {
  planes: PresetPlan[];
  proyecto: ProyectoVista | null;
  condiciones: Condiciones;
  categorias: string[];
  complejidades: { valor: Complejidad; etiqueta: string }[];
}

export class FalloApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly codigo: string | null = null,
  ) {
    super(mensaje);
    this.name = "FalloApi";
  }
}

async function pedir<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {},
): Promise<T> {
  const respuesta = await fetch(ruta, {
    method: opciones.metodo ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      opciones.cuerpo === undefined ? undefined : { "content-type": "application/json" },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });

  const crudo = await respuesta.text();
  let datos: unknown = null;
  if (crudo) {
    try {
      datos = JSON.parse(crudo);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    const error = (datos as { error?: string } | null)?.error;
    const codigo = (datos as { codigo?: string | null } | null)?.codigo ?? null;
    throw new FalloApi(
      respuesta.status,
      error ?? "No pudimos completar la operación. Inténtalo de nuevo.",
      codigo,
    );
  }

  return datos as T;
}

export const api = {
  consentimiento(correo: string, cliente: ClienteDatos): Promise<PreviaRegistro> {
    return pedir("/api/auth/consentimiento", { metodo: "POST", cuerpo: { correo, cliente } });
  },

  registro(payload: {
    cuenta: CuentaDatos;
    cliente: ClienteDatos;
    hashes: Record<string, string>;
  }): Promise<RespuestaRegistro> {
    return pedir("/api/auth/registro", { metodo: "POST", cuerpo: payload });
  },

  ingreso(correo: string, clave: string): Promise<{ ok: true; expira: string }> {
    return pedir("/api/auth/ingreso", { metodo: "POST", cuerpo: { correo, clave } });
  },

  sesion(): Promise<{ sesion: SesionPortal | null }> {
    return pedir("/api/auth/sesion");
  },

  salir(): Promise<{ ok: true }> {
    return pedir("/api/auth/salir", { metodo: "POST", cuerpo: {} });
  },

  verificar(token: string): Promise<{ ok: true }> {
    return pedir("/api/auth/verificar", { metodo: "POST", cuerpo: { token } });
  },

  recuperar(correo: string): Promise<{ ok: true; mensaje: string }> {
    return pedir("/api/auth/recuperar", { metodo: "POST", cuerpo: { correo } });
  },

  restablecer(token: string, clave: string): Promise<{ ok: true }> {
    return pedir("/api/auth/restablecer", { metodo: "POST", cuerpo: { token, clave } });
  },

  estadoFirma(): Promise<EstadoFirma> {
    return pedir("/api/cliente/firma");
  },

  firmar(png: string, consentimientoHash: string): Promise<{ ok: true; firma: FirmaCuenta }> {
    return pedir("/api/cliente/firma", {
      metodo: "POST",
      cuerpo: { png, consentimiento_hash: consentimientoHash },
    });
  },

  proyecto(): Promise<DatosProyecto> {
    return pedir("/api/cliente/proyecto");
  },

  guardarProyecto(datos: ProyectoDatos): Promise<{ ok: true; proyecto: ProyectoVista }> {
    return pedir("/api/cliente/proyecto", { metodo: "POST", cuerpo: datos });
  },

  enviarProyecto(): Promise<{ ok: true; proyecto: ProyectoVista }> {
    return pedir("/api/cliente/proyecto/enviar", { metodo: "POST", cuerpo: {} });
  },
};

/** Parámetro de la ruta hash (`#/verificar?token=...`). */
export function parametro(nombre: string): string {
  const consulta = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(consulta).get(nombre) ?? "";
}
