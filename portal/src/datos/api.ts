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

export interface DocumentoExpediente {
  codigo: string;
  titulo: string;
  version: number;
  orden: number;
  hash_archivo: string;
  hash_cadena: string;
  estado: string;
  firmado: boolean;
}

export interface ListaDocumentos {
  ok: true;
  proyecto_id: string | null;
  proyecto: { nombre: string; estado: string } | null;
  documentos: DocumentoExpediente[];
}

export interface PagoVista {
  id: string;
  periodo: string;
  monto: number;
  moneda: string;
  tasa_bcv: number | null;
  referencia: string;
  fecha: string;
}

export interface SuscripcionCliente {
  id: string;
  estado: "al_dia" | "mora" | "suspendida" | "terminada";
  estado_calculado: "al_dia" | "mora" | "suspendida" | "terminada";
  monto_usd: number;
  moneda: "USD" | "VES";
  dia_cobro: number;
  proximo_vencimiento: string;
  dias_gracia: number;
  dias_para_vencer: number;
  licencia: string | null;
  bloqueada: boolean;
}

export interface VistaSuscripcionCliente {
  ok: true;
  hoy: string;
  proyecto: { id: string; nombre: string } | null;
  suscripcion: SuscripcionCliente | null;
  pagos: PagoVista[];
}

export interface VerificacionDocumento {
  codigo: string;
  orden: number;
  sello: string;
  hash_archivo: string;
  hash_anterior: string;
  hash_cadena: string;
  estado: string;
  tamano: number;
  plantilla_ok: boolean;
  sello_ok: boolean;
  archivo_ok: boolean;
  cadena_ok: boolean;
  actos: {
    representante: { hecho: boolean; utc: string | null };
    cliente: { hecho: boolean; utc: string | null };
  };
}

export interface Verificacion {
  ok: boolean;
  proyecto_id: string;
  integro: boolean;
  completo: boolean;
  cadena_ok: boolean;
  documentos: VerificacionDocumento[];
}

export interface EnvioExpediente {
  ok: true;
  reutilizado: boolean;
  enviados: number;
  mensaje_id: string | null;
  proveedor?: string;
  hash_final?: string;
  documentos?: string[];
}

export interface RepresentanteVista {
  id: string;
  nombre: string;
  documento: string;
  domicilio: string | null;
  correo: string | null;
  sha256: string;
  utc: string | null;
  png?: string | null;
}

export interface ClienteAdmin {
  id: string;
  razon_social: string;
  documento_tipo: string;
  documento_numero: string;
  domicilio: string;
  telefono: string;
  correo_factura: string;
  nombre: string;
  correo: string;
  verificado: boolean;
  bloqueado: boolean;
  tiene_firma: boolean;
  firmas: number;
  creado: string | null;
}

export interface ProyectoAdmin {
  id: string;
  cliente_id: string;
  nombre: string;
  estado: string;
  dominio: string;
  plan_clave: string;
  plan_nivel: string;
  documentos: number;
  actos_representante: number;
  actos_cliente: number;
  envios: number;
  ultimo_envio: string | null;
  creado: string | null;
  enviado: string | null;
}

export interface SuscripcionAdmin {
  id: string;
  proyecto_id: string;
  estado: "al_dia" | "mora" | "suspendida" | "terminada";
  estado_calculado: "al_dia" | "mora" | "suspendida" | "terminada";
  monto_usd: number;
  moneda: "USD" | "VES";
  dia_cobro: number;
  proximo_vencimiento: string;
  dias_gracia: number;
  dias_para_vencer: number;
  licencia: string | null;
  pagos: number;
  ultimo_periodo: string | null;
  creada: string | null;
  actualizada: string | null;
}

export interface PagoAdmin extends PagoVista {
  suscripcion_id: string;
  estado: string;
  anulacion_de: string | null;
  motivo: string | null;
  anulado: boolean;
  vigente: boolean;
  creado: string | null;
}

export interface PlantillaAdmin {
  codigo: string;
  version: number;
  titulo: string;
  sha256: string;
  activa: boolean;
  publicada: string | null;
}

export interface PanelAdmin {
  ok: true;
  hoy: string;
  clientes: ClienteAdmin[];
  proyectos: ProyectoAdmin[];
  suscripciones: SuscripcionAdmin[];
  pagos: PagoAdmin[];
  plantillas: PlantillaAdmin[];
  representante: RepresentanteVista | null;
}

export interface Descarga {
  blob: Blob;
  nombre: string;
  hash: string | null;
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

  ingreso(correo: string, clave: string): Promise<{ ok: true; expira: string; rol: "cliente" | "admin" }> {
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

  documentosCliente(): Promise<ListaDocumentos> {
    return pedir("/api/cliente/documentos");
  },

  suscripcionCliente(): Promise<VistaSuscripcionCliente> {
    return pedir("/api/cliente/suscripcion");
  },

  firmarExpediente(): Promise<{ ok: true; actos: number; documentos: number }> {
    return pedir("/api/documentos/firmar", { metodo: "POST", cuerpo: {} });
  },

  async descargar(codigo: string, proyectoId?: string): Promise<Descarga> {
    const consulta = new URLSearchParams({ codigo });
    if (proyectoId) consulta.set("proyecto_id", proyectoId);
    const respuesta = await fetch(`/api/documentos/descargar?${consulta.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!respuesta.ok) {
      const crudo = await respuesta.text();
      let datos: { error?: string; codigo?: string | null } | null = null;
      try {
        datos = JSON.parse(crudo) as { error?: string; codigo?: string | null };
      } catch {
        datos = null;
      }
      throw new FalloApi(
        respuesta.status,
        datos?.error ?? "No pudimos descargar el documento.",
        datos?.codigo ?? null,
      );
    }
    const disposicion = respuesta.headers.get("content-disposition") ?? "";
    const nombre = /filename="([^"]+)"/.exec(disposicion)?.[1] ?? `${codigo}.pdf`;
    return {
      blob: await respuesta.blob(),
      nombre,
      hash: respuesta.headers.get("x-bws-sha256"),
    };
  },

  panelAdmin(): Promise<PanelAdmin> {
    return pedir("/api/admin/panel");
  },

  representante(): Promise<{ representante: RepresentanteVista | null }> {
    return pedir("/api/admin/representante");
  },

  capturarRepresentante(datos: {
    nombre: string;
    documento: string;
    domicilio: string;
    correo: string;
    png: string;
  }): Promise<{ ok: true; representante: RepresentanteVista }> {
    return pedir("/api/admin/representante", { metodo: "POST", cuerpo: datos });
  },

  generarExpediente(proyectoId: string): Promise<{
    ok: true;
    reutilizado: boolean;
    documentos: { codigo: string; orden: number; sello: string; hash_archivo: string }[];
  }> {
    return pedir("/api/documentos/generar", {
      metodo: "POST",
      cuerpo: { proyecto_id: proyectoId },
    });
  },

  verificarExpediente(proyectoId?: string): Promise<Verificacion> {
    return pedir(
      `/api/documentos/verificar${proyectoId ? `?proyecto_id=${encodeURIComponent(proyectoId)}` : ""}`,
    );
  },

  enviarExpediente(proyectoId: string): Promise<EnvioExpediente> {
    return pedir("/api/documentos/enviar", {
      metodo: "POST",
      cuerpo: { proyecto_id: proyectoId },
    });
  },

  crearSuscripcion(datos: {
    proyecto_id: string;
    dia_cobro: number;
    monto_usd?: number;
    dias_gracia?: number;
    moneda?: "USD" | "VES";
    proximo_vencimiento?: string;
  }): Promise<{
    ok: true;
    suscripcion: {
      id: string;
      proyecto_id: string;
      estado: string;
      monto_usd: number;
      moneda: "USD" | "VES";
      dia_cobro: number;
      dias_gracia: number;
      proximo_vencimiento: string;
    } | null;
  }> {
    return pedir("/api/suscripciones/crear", { metodo: "POST", cuerpo: datos });
  },

  registrarPago(datos: {
    suscripcion_id: string;
    periodo: string;
    monto: number;
    moneda: "USD" | "VES";
    tasa_bcv?: number;
    referencia: string;
    fecha?: string;
  }): Promise<{
    ok: true;
    anterior: string;
    pago: PagoAdmin | null;
    suscripcion: { estado: string; proximo_vencimiento: string };
  }> {
    return pedir("/api/suscripciones/pago", { metodo: "POST", cuerpo: datos });
  },

  anularPago(pagoId: string, motivo: string): Promise<{
    ok: true;
    pago_id: string;
    periodo: string;
    suscripcion: { estado: string; proximo_vencimiento: string };
  }> {
    return pedir("/api/suscripciones/anular", {
      metodo: "POST",
      cuerpo: { pago_id: pagoId, motivo },
    });
  },

  recalcularSuscripciones(proyectoId?: string): Promise<{
    ok: true;
    hoy: string;
    cambiadas: number;
    cambios: { suscripcion_id: string; anterior: string; nuevo: string; proximo_vencimiento: string }[];
  }> {
    return pedir("/api/suscripciones/recalcular", {
      metodo: "POST",
      cuerpo: proyectoId ? { proyecto_id: proyectoId } : {},
    });
  },

  suspenderSuscripcion(suscripcionId: string, motivo: string): Promise<{
    ok: true;
    cambiado: boolean;
    estado: string;
    anterior?: string;
  }> {
    return pedir("/api/suscripciones/suspender", {
      metodo: "POST",
      cuerpo: { suscripcion_id: suscripcionId, motivo },
    });
  },

  reactivarSuscripcion(suscripcionId: string, motivo?: string): Promise<{
    ok: true;
    cambiado: boolean;
    estado: string;
    anterior?: string;
    aviso?: string | null;
  }> {
    return pedir("/api/suscripciones/reactivar", {
      metodo: "POST",
      cuerpo: { suscripcion_id: suscripcionId, motivo },
    });
  },
};

/** Dispara la descarga de un archivo ya autenticado, sin guardarlo en el navegador. */
export function guardarDescarga(descarga: Descarga): void {
  const url = URL.createObjectURL(descarga.blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = descarga.nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Parámetro de la ruta (`/verificar?token=...`). */
export function parametro(nombre: string): string {
  return new URLSearchParams(window.location.search).get(nombre) ?? "";
}
