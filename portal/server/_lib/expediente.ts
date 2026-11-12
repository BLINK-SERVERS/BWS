/* ============================================================
   Contexto del expediente
   ------------------------------------------------------------
   Un expediente reúne cuatro fuentes que no se mezclan: la
   identidad fiscal de Blink (entorno), la del cliente (registro),
   el proyecto congelado y el plan que se firmó. Aquí se leen y se
   convierten en las variables que consumen las plantillas.

   La firma del cliente se capturó una sola vez y se guarda
   bloqueada; el representante de Blink se captura en la
   administración. Ninguna de las dos se escribe en el repositorio.
   ============================================================ */

import { fechaLarga } from "../../legal/fechas";
import type { DatosExpediente, FirmaCapturada } from "../../legal/tipos";
import { enTransaccion } from "./db";
import { planExacto, type PlanVista } from "./planes";
import { identidadPrestador, variablesComerciales } from "./prestador";
import { variablesDeProyecto, vistaDeProyecto, type ProyectoVista } from "./proyecto";
import { ErrorHttp } from "./respuestas";
import type { Sesion } from "./sesion";

export interface ProyectoExpediente {
  fila: Record<string, unknown>;
  vista: ProyectoVista;
  plan: PlanVista;
}

export interface ClienteExpediente {
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
}

export interface FirmaExpediente {
  id: string;
  png: Uint8Array;
  sha256: string;
  utc: Date;
  metodo: "simple_reforzada" | "papel";
  ip: string | null;
  agente: string | null;
}

export interface RepresentanteExpediente {
  id: string;
  nombre: string;
  documento: string;
  domicilio: string;
  correo: string | null;
  png: Uint8Array;
  sha256: string;
  utc: Date;
}

const TIPOS: Record<string, string> = {
  RIF: "RIF",
  cedula: "Cédula",
  pasaporte: "Pasaporte",
};

function fecha(valor: unknown): Date {
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorHttp(500, "El expediente tiene una fecha ilegible.", "expediente");
  }
  return fecha;
}

/** Proyecto del cliente en sesión (el más reciente) o uno concreto para la administración. */
async function leerProyecto(
  sesion: Sesion,
  proyectoId?: string,
): Promise<ProyectoExpediente | null> {
  if (proyectoId && sesion.rol !== "admin") {
    throw new ErrorHttp(403, "Solo la administración elige un proyecto ajeno.", "rol");
  }

  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    proyectoId
      ? txn`select p.id, p.nombre, p.categoria, p.dominio, p.buzones, p.alcance,
                   p.complejidad, p.plan_clave, p.plan_nivel, p.plan_version,
                   p.estado, p.creado, p.enviado, p.cliente_id
            from proyectos p
            where p.id = ${proyectoId}`
      : txn`select p.id, p.nombre, p.categoria, p.dominio, p.buzones, p.alcance,
                   p.complejidad, p.plan_clave, p.plan_nivel, p.plan_version,
                   p.estado, p.creado, p.enviado, p.cliente_id
            from proyectos p
            join clientes c on c.id = p.cliente_id
            where c.usuario_id = ${sesion.usuarioId}
            order by p.creado desc
            limit 1`,
  ]);

  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) return null;

  const plan = await planExacto(
    String(fila.plan_clave),
    String(fila.plan_nivel),
    Number(fila.plan_version),
  );
  if (!plan) {
    throw new ErrorHttp(500, "El plan del proyecto no está en el catálogo.", "plan_integridad");
  }

  return { fila, vista: vistaDeProyecto(fila, plan), plan };
}

export async function proyectoDeExpediente(
  sesion: Sesion,
  proyectoId?: string,
): Promise<ProyectoExpediente> {
  const proyecto = await leerProyecto(sesion, proyectoId);
  if (!proyecto) {
    throw new ErrorHttp(404, "Todavía no hay un proyecto para este expediente.", "sin_proyecto");
  }
  return proyecto;
}

/** Igual que `proyectoDeExpediente`, pero null mientras el cliente no tenga proyecto. */
export async function proyectoOpcionalDeExpediente(
  sesion: Sesion,
): Promise<ProyectoExpediente | null> {
  return leerProyecto(sesion);
}

export async function clienteDeExpediente(
  sesion: Sesion,
  clienteId: string,
): Promise<ClienteExpediente> {
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select c.id, c.razon_social, c.documento_tipo, c.documento_numero,
               c.domicilio_fiscal, c.telefono, c.correo_factura,
               u.nombre, u.correo, u.correo_verificado
        from clientes c
        join usuarios u on u.id = c.usuario_id
        where c.id = ${clienteId}`,
  ]);
  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(404, "La ficha del cliente no existe.", "sin_cliente");
  }
  const razon_social = cadena(fila.razon_social);
  const documento_tipo = cadena(fila.documento_tipo);
  const documento_numero = cadena(fila.documento_numero);
  const domicilio = cadena(fila.domicilio_fiscal);
  const correo_factura = cadena(fila.correo_factura);
  if (
    !razon_social || !documento_tipo || !documento_numero || !domicilio ||
    !correo_factura
  ) {
    throw new ErrorHttp(
      409,
      "El cliente no completó los datos para el contrato. El expediente se genera con la ficha fiscal completa.",
      "ficha_incompleta",
    );
  }
  return {
    id: String(fila.id),
    razon_social,
    documento_tipo,
    documento_numero,
    domicilio,
    telefono: String(fila.telefono),
    correo_factura,
    nombre: String(fila.nombre),
    correo: String(fila.correo),
    verificado: Boolean(fila.correo_verificado),
  };
}

function cadena(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto || null;
}

/** Firma original del cliente (o una concreta, cuando la fijó un acto anterior). */
export async function firmaDeExpediente(
  sesion: Sesion,
  clienteId: string,
  firmaId?: string,
): Promise<FirmaExpediente> {
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    firmaId
      ? txn`select id, png, sha256, utc, metodo, ip, agente
            from firmas_cliente
            where id = ${firmaId} and cliente_id = ${clienteId}`
      : txn`select f.id, f.png, f.sha256, f.utc, f.metodo, f.ip, f.agente
            from firmas_cliente f
            join clientes c on c.firma_actual = f.id
            where c.id = ${clienteId}`,
  ]);
  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(409, "Falta la firma del cliente para armar el expediente.", "firma");
  }
  const metodo = String(fila.metodo);
  return {
    id: String(fila.id),
    png: fila.png as Uint8Array,
    sha256: String(fila.sha256),
    utc: fecha(fila.utc),
    metodo: metodo === "papel" ? "papel" : "simple_reforzada",
    ip: fila.ip ? String(fila.ip) : null,
    agente: fila.agente ? String(fila.agente) : null,
  };
}

/** Representante de Blink: el último capturado o el que firmó un documento. */
export async function representanteDeExpediente(
  sesion: Sesion,
  representanteId?: string,
): Promise<RepresentanteExpediente> {
  const [filas] = await enTransaccion(sesion.usuarioId, sesion.rol, (txn) => [
    txn`select id, nombre, documento, domicilio, correo, png, sha256, utc
        from bws_representante(${representanteId ?? null}::uuid)`,
  ]);
  const fila = (filas ?? [])[0] as Record<string, unknown> | undefined;
  if (!fila) {
    throw new ErrorHttp(
      409,
      "Falta la firma del representante legal. La administración debe capturarla antes de generar el expediente.",
      "sin_representante",
    );
  }
  const domicilio = fila.domicilio ? String(fila.domicilio).trim() : "";
  if (!domicilio) {
    throw new ErrorHttp(
      409,
      "La firma del representante no tiene domicilio. Vuelve a capturarla con el domicilio completo.",
      "sin_representante",
    );
  }
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    documento: String(fila.documento),
    domicilio,
    correo: fila.correo ? String(fila.correo) : null,
    png: fila.png as Uint8Array,
    sha256: String(fila.sha256),
    utc: fecha(fila.utc),
  };
}

function usoDeBuzon(correo: string): string {
  return correo.startsWith("no-reply@")
    ? "Notificaciones automáticas (obligatorio)"
    : "Correo operativo del proyecto";
}

/** Las variables resueltas que consumen las ocho plantillas. */
export function datosDeExpediente(args: {
  cliente: ClienteExpediente;
  representante: RepresentanteExpediente;
  proyecto: ProyectoExpediente;
  fecha: Date;
}): DatosExpediente {
  const { cliente, representante, proyecto, fecha: fechaDocumento } = args;
  const prestador = identidadPrestador();
  return {
    variables: {
      fecha_documento: fechaLarga(fechaDocumento),
      bws_razon_social: prestador.razon_social,
      bws_documento: prestador.documento,
      bws_domicilio: prestador.domicilio,
      bws_correo: prestador.correo,
      bws_telefono: prestador.telefono,
      representante_nombre: representante.nombre,
      representante_documento: representante.documento,
      representante_domicilio: representante.domicilio,
      cliente_razon_social: cliente.razon_social,
      cliente_documento_tipo: TIPOS[cliente.documento_tipo] ?? cliente.documento_tipo,
      cliente_documento_numero: cliente.documento_numero,
      cliente_domicilio: cliente.domicilio,
      cliente_telefono: cliente.telefono,
      cliente_correo: cliente.correo,
      cliente_correo_factura: cliente.correo_factura,
      ...variablesDeProyecto(proyecto.vista),
      // La fecha comercial se fija con el sello: verificarlo otro día
      // debe reconstruir exactamente las mismas variables.
      ...variablesComerciales(fechaDocumento),
    },
    buzones: proyecto.vista.buzones.map((correo) => ({ correo, uso: usoDeBuzon(correo) })),
    limites: proyecto.plan.limites.map((limite) => ({ ...limite })),
  };
}

/** Las dos firmas que se estampan en cada documento. */
export function firmasDeExpediente(args: {
  cliente: ClienteExpediente;
  firma: FirmaExpediente;
  representante: RepresentanteExpediente;
  ip: string | null;
  agente: string | null;
}): { representante: FirmaCapturada; cliente: FirmaCapturada } {
  const { cliente, firma, representante, ip, agente } = args;
  return {
    representante: {
      png: representante.png,
      nombre: representante.nombre,
      documento: representante.documento,
      correo: representante.correo ?? undefined,
      utc: representante.utc.toISOString(),
      ip: ip ?? undefined,
      agente: agente ?? undefined,
      metodo: "simple_reforzada",
    },
    cliente: {
      png: firma.png,
      nombre: cliente.nombre,
      documento: cliente.documento_numero,
      correo: cliente.correo,
      utc: firma.utc.toISOString(),
      ip: firma.ip ?? undefined,
      agente: firma.agente ?? undefined,
      metodo: firma.metodo,
    },
  };
}
