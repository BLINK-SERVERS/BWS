/* ============================================================
   Datos del registro y consentimiento
   ------------------------------------------------------------
   La cuenta se crea con nombre, teléfono y correo. La ficha fiscal
   se completa al contratar el proyecto, así que los cuatro
   documentos del registro identifican a la persona por su nombre y
   su correo, no por un documento que todavía no se pidió.

   El cliente ve los documentos resueltos y la huella que se guarda
   es la del texto que se mostró, no la de la plantilla: si cambia
   un dato, cambia la huella y el registro rechaza un consentimiento
   viejo.
   ============================================================ */

import { DOCUMENTO_POR_CODIGO } from "../../legal";
import { fechaLarga } from "../../legal/fechas";
import {
  correoNormalizado,
  mensajeClave,
  nombreValido,
  telefonoNormalizado,
} from "../../legal/identidad";
import type { Bloque, DocumentoResuelto } from "../../legal/tipos";
import { resolver } from "../../legal/validar";
import { hashConsentimiento, hashPlantilla } from "../../render/hash";
import { objeto, texto } from "./http";
import { identidadPrestador, variablesComerciales, type Prestador } from "./prestador";
import { ErrorHttp } from "./respuestas";

export const DOCUMENTOS_REGISTRO = [
  "BWS-LEG-002",
  "BWS-LEG-003",
  "BWS-PRI-005",
  "BWS-WEB-006",
];

export interface PersonaRegistro {
  nombre: string;
  telefono: string;
  correo: string;
}

export interface CuentaRegistro {
  correo: string;
  clave: string;
  nombre: string;
}

export interface DocumentoPrevia {
  codigo: string;
  titulo: string;
  version: string;
  resumen: string;
  bloques: Bloque[];
  hash: string;
  hash_plantilla: string;
}

export interface PreviaRegistro {
  documentos: DocumentoPrevia[];
  prestador: Prestador;
}

function datoInvalido(mensaje: string, codigo = "datos"): never {
  throw new ErrorHttp(400, mensaje, codigo);
}

export function leerCuenta(fuente: unknown): CuentaRegistro {
  const datos = objeto(fuente);
  if (!datos) datoInvalido("Faltan los datos de la cuenta.");

  const correo = correoNormalizado(datos.correo);
  if (!correo) datoInvalido("El correo no tiene un formato válido.");

  const clave = typeof datos.clave === "string" ? datos.clave : "";
  const problema = mensajeClave(clave);
  if (problema) datoInvalido(problema);

  const nombre = texto(datos.nombre);
  if (!nombreValido(nombre)) datoInvalido("Escribe tu nombre completo.");

  return { correo, clave, nombre };
}

export function leerPersona(fuente: unknown, correoCuenta?: string): PersonaRegistro {
  const datos = objeto(fuente);
  if (!datos) datoInvalido("Faltan los datos personales.");

  const nombre = texto(datos.nombre);
  if (!nombreValido(nombre)) datoInvalido("Escribe tu nombre completo.");

  const telefono = telefonoNormalizado(datos.telefono);
  if (!telefono) datoInvalido("Escribe un teléfono con al menos siete dígitos.");

  const correo = correoCuenta
    ? correoNormalizado(correoCuenta)
    : correoNormalizado(datos.correo);
  if (!correo) datoInvalido("El correo no tiene un formato válido.");

  return { nombre, telefono, correo };
}

export function variablesDeRegistro(
  persona: PersonaRegistro,
  prestador: Prestador,
): Record<string, string> {
  return {
    fecha_documento: fechaLarga(),
    bws_razon_social: prestador.razon_social,
    bws_documento: prestador.documento,
    bws_domicilio: prestador.domicilio,
    bws_correo: prestador.correo,
    bws_telefono: prestador.telefono,
    cliente_razon_social: persona.nombre,
    cliente_telefono: persona.telefono,
    cliente_correo: persona.correo,
    ...variablesComerciales(),
  };
}

function resolverRegistro(persona: PersonaRegistro): {
  prestador: Prestador;
  documentos: DocumentoPrevia[];
  resueltos: Map<string, DocumentoResuelto>;
} {
  const prestador = identidadPrestador();
  const variables = variablesDeRegistro(persona, prestador);
  const documentos: DocumentoPrevia[] = [];
  const resueltos = new Map<string, DocumentoResuelto>();

  for (const codigo of DOCUMENTOS_REGISTRO) {
    const plantilla = DOCUMENTO_POR_CODIGO.get(codigo);
    if (!plantilla) throw new Error(`Falta la plantilla ${codigo}.`);
    const resuelto = resolver(plantilla, { variables, buzones: [], limites: [] });
    resueltos.set(codigo, resuelto);
    documentos.push({
      codigo,
      titulo: resuelto.titulo,
      version: resuelto.version,
      resumen: resuelto.resumen,
      bloques: resuelto.bloques,
      hash: hashConsentimiento(resuelto),
      hash_plantilla: hashPlantilla(plantilla),
    });
  }

  return { prestador, documentos, resueltos };
}

export function previaDeRegistro(persona: PersonaRegistro): PreviaRegistro {
  const { prestador, documentos } = resolverRegistro(persona);
  return { documentos, prestador };
}

/** BWS-LEG-002 resuelto, para leerlo antes de capturar el trazo. */
export function documentoDeConsentimiento(persona: PersonaRegistro): DocumentoPrevia {
  const { documentos } = resolverRegistro(persona);
  const leg002 = documentos.find((d) => d.codigo === "BWS-LEG-002");
  if (!leg002) throw new Error("No se pudo resolver BWS-LEG-002.");
  return leg002;
}

export function huellaDelConsentimiento(persona: PersonaRegistro): string {
  const { documentos } = resolverRegistro(persona);
  const leg002 = documentos.find((d) => d.codigo === "BWS-LEG-002");
  if (!leg002) throw new Error("No se pudo resolver BWS-LEG-002.");
  return leg002.hash;
}

/** Huellas que quedan en el evento de registro, para el expediente. */
export function huellasDeRegistro(persona: PersonaRegistro): Record<string, string> {
  const { documentos } = resolverRegistro(persona);
  return Object.fromEntries(documentos.map((d) => [d.codigo, d.hash]));
}
