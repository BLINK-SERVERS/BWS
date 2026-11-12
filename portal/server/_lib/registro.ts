/* ============================================================
   Datos del registro y consentimiento
   ------------------------------------------------------------
   El cliente ve los cinco documentos resueltos con sus datos y los
   datos del prestador. La huella que se guarda es la del texto que
   se mostró, no la de la plantilla: si cambia un dato, cambia la
   huella y el registro rechaza un consentimiento viejo.
   ============================================================ */

import { DOCUMENTO_POR_CODIGO } from "../../legal";
import { fechaLarga } from "../../legal/fechas";
import {
  correoNormalizado,
  domicilioValido,
  mensajeClave,
  mensajeDocumento,
  nombreValido,
  normalizarDocumento,
  razonSocialValida,
  telefonoNormalizado,
  type TipoDocumento,
} from "../../legal/identidad";
import type { Bloque, DocumentoResuelto } from "../../legal/tipos";
import { resolver } from "../../legal/validar";
import { hashConsentimiento, hashPlantilla } from "../../render/hash";
import { objeto, texto } from "./http";
import { identidadPrestador, variablesComerciales, type Prestador } from "./prestador";
import { ErrorHttp } from "./respuestas";

export const DOCUMENTOS_REGISTRO = [
  "BWS-REG-001",
  "BWS-LEG-002",
  "BWS-LEG-003",
  "BWS-PRI-005",
  "BWS-WEB-006",
];

export interface ClienteRegistro {
  razon_social: string;
  documento_tipo: TipoDocumento;
  documento_numero: string;
  domicilio: string;
  telefono: string;
  correo: string;
  correo_factura: string;
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
  if (!nombreValido(nombre)) datoInvalido("Escribe el nombre de la persona que firma.");

  return { correo, clave, nombre };
}

export function leerCliente(fuente: unknown, correoCuenta?: string): ClienteRegistro {
  const datos = objeto(fuente);
  if (!datos) datoInvalido("Faltan los datos de identidad.");

  const razon = texto(datos.razon_social);
  if (!razonSocialValida(razon)) datoInvalido("Escribe la razón social o el nombre del cliente.");

  const tipoCrudo = texto(datos.documento_tipo);
  if (tipoCrudo !== "RIF" && tipoCrudo !== "cedula" && tipoCrudo !== "pasaporte") {
    datoInvalido("Elige el tipo de documento.");
  }
  const numero = normalizarDocumento(tipoCrudo, datos.documento_numero);
  if (!numero) datoInvalido(mensajeDocumento(tipoCrudo, datos.documento_numero) ?? "Documento inválido.");

  const domicilio = texto(datos.domicilio);
  if (!domicilioValido(domicilio)) datoInvalido("Escribe el domicilio fiscal completo.");

  const telefono = telefonoNormalizado(datos.telefono);
  if (!telefono) datoInvalido("Escribe un teléfono con al menos siete dígitos.");

  const correoFactura = correoNormalizado(datos.correo_factura);
  if (!correoFactura) datoInvalido("El correo de facturación no tiene un formato válido.");

  const correo = correoCuenta ? correoNormalizado(correoCuenta) : correoNormalizado(datos.correo);
  if (!correo) datoInvalido("Falta el correo principal del cliente.");

  return {
    razon_social: razon,
    documento_tipo: tipoCrudo,
    documento_numero: numero,
    domicilio,
    telefono,
    correo,
    correo_factura: correoFactura,
  };
}

function etiquetaDocumento(tipo: TipoDocumento): string {
  if (tipo === "RIF") return "RIF";
  if (tipo === "cedula") return "Cédula";
  return "Pasaporte";
}

export function variablesDeRegistro(
  cliente: ClienteRegistro,
  prestador: Prestador,
): Record<string, string> {
  return {
    fecha_documento: fechaLarga(),
    bws_razon_social: prestador.razon_social,
    bws_rif: prestador.rif,
    bws_domicilio: prestador.domicilio,
    bws_correo: prestador.correo,
    bws_telefono: prestador.telefono,
    cliente_razon_social: cliente.razon_social,
    cliente_documento_tipo: etiquetaDocumento(cliente.documento_tipo),
    cliente_documento_numero: cliente.documento_numero,
    cliente_domicilio: cliente.domicilio,
    cliente_telefono: cliente.telefono,
    cliente_correo: cliente.correo,
    cliente_correo_factura: cliente.correo_factura,
    ...variablesComerciales(),
  };
}

function resolverRegistro(cliente: ClienteRegistro): {
  prestador: Prestador;
  documentos: DocumentoPrevia[];
  resueltos: Map<string, DocumentoResuelto>;
} {
  const prestador = identidadPrestador();
  const variables = variablesDeRegistro(cliente, prestador);
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

export function previaDeRegistro(cliente: ClienteRegistro): PreviaRegistro {
  const { prestador, documentos } = resolverRegistro(cliente);
  return { documentos, prestador };
}

/** BWS-LEG-002 resuelto, para leerlo antes de capturar el trazo. */
export function documentoDeConsentimiento(cliente: ClienteRegistro): DocumentoPrevia {
  const { documentos } = resolverRegistro(cliente);
  const leg002 = documentos.find((d) => d.codigo === "BWS-LEG-002");
  if (!leg002) throw new Error("No se pudo resolver BWS-LEG-002.");
  return leg002;
}

export function huellaDelConsentimiento(cliente: ClienteRegistro): string {
  const { documentos } = resolverRegistro(cliente);
  const leg002 = documentos.find((d) => d.codigo === "BWS-LEG-002");
  if (!leg002) throw new Error("No se pudo resolver BWS-LEG-002.");
  return leg002.hash;
}

/** Huellas que quedan en el evento de registro, para el expediente. */
export function huellasDeRegistro(cliente: ClienteRegistro): Record<string, string> {
  const { documentos } = resolverRegistro(cliente);
  return Object.fromEntries(documentos.map((d) => [d.codigo, d.hash]));
}
