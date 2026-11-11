/* ============================================================
   Validación y resolución de plantillas
   ------------------------------------------------------------
   Dos garantías antes de generar un expediente:

     1. La plantilla no usa una variable que no esté declarada en
        `campos.ts`, y no declara una que no aparezca en el texto.
     2. Al resolver, toda variable exigida llega con valor y no
        queda ningún `{{...}}` en el resultado.

   Las tablas dinámicas (`buzones`, `limites`) no llevan marcadores:
   se construyen con los datos del proyecto y del plan elegido.
   ============================================================ */

import { CAMPO_POR_CLAVE } from "./campos";
import type {
  Bloque,
  DatosExpediente,
  DocumentoLegal,
  DocumentoResuelto,
} from "./tipos";

const MARCADOR = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/**
 * Campos que no viven en el cuerpo: la fecha de suscripción la imprime
 * la página de firmas y el motor la exige al resolver. No son un hueco
 * de la plantilla.
 */
const CAMPOS_DE_RENDER = new Set(["fecha_documento"]);

function textosDe(bloques: Bloque[]): string[] {
  const salida: string[] = [];
  const visitar = (valor: unknown) => {
    if (typeof valor === "string") salida.push(valor);
    else if (Array.isArray(valor)) valor.forEach(visitar);
    else if (valor && typeof valor === "object") Object.values(valor).forEach(visitar);
  };
  visitar(bloques);
  return salida;
}

/** Variables presentes en el texto, sin repetir y en orden de aparición. */
export function variablesUsadas(doc: DocumentoLegal): string[] {
  const vistas = new Set<string>();
  for (const texto of textosDe(doc.bloques)) {
    for (const match of texto.matchAll(MARCADOR)) vistas.add(match[1]);
  }
  return [...vistas];
}

export interface ProblemaPlantilla {
  documento: string;
  mensaje: string;
}

/** Revisión estática: se corre en las pruebas y antes de publicar una versión. */
export function validarPlantilla(doc: DocumentoLegal): ProblemaPlantilla[] {
  const problemas: ProblemaPlantilla[] = [];
  const usadas = new Set(variablesUsadas(doc));

  for (const clave of usadas) {
    if (!CAMPO_POR_CLAVE.has(clave)) {
      problemas.push({ documento: doc.codigo, mensaje: `variable no declarada en campos.ts: ${clave}` });
    }
  }
  for (const clave of doc.campos) {
    if (!CAMPO_POR_CLAVE.has(clave)) {
      problemas.push({ documento: doc.codigo, mensaje: `campo exigido inexistente en campos.ts: ${clave}` });
    }
    if (!usadas.has(clave)) {
      if (!CAMPOS_DE_RENDER.has(clave)) {
        problemas.push({ documento: doc.codigo, mensaje: `campo exigido pero ausente del texto: ${clave}` });
      }
    }
  }
  for (const clave of usadas) {
    if (!doc.campos.includes(clave)) {
      problemas.push({ documento: doc.codigo, mensaje: `variable usada pero no exigida: ${clave}` });
    }
  }
  if (!/^BWS-[A-Z]{3}-\d{3}$/.test(doc.codigo)) {
    problemas.push({ documento: doc.codigo, mensaje: "código con formato inesperado" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.fecha)) {
    problemas.push({ documento: doc.codigo, mensaje: "fecha de versión con formato inesperado" });
  }
  return problemas;
}

function resolverTexto(texto: string, variables: Record<string, string>, documento: string): string {
  return texto.replace(MARCADOR, (_todo, clave: string) => {
    const valor = variables[clave];
    if (typeof valor !== "string" || valor.trim() === "") {
      throw new Error(`${documento}: falta la variable «${clave}»`);
    }
    return valor.trim();
  });
}

function resolverValor<T>(valor: T, variables: Record<string, string>, documento: string): T {
  if (typeof valor === "string") return resolverTexto(valor, variables, documento) as T;
  if (Array.isArray(valor)) return valor.map((v) => resolverValor(v, variables, documento)) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, resolverValor(v, variables, documento)]),
    ) as T;
  }
  return valor;
}

/**
 * Resuelve la plantilla con los datos del expediente.
 * Lanza si falta una variable o si queda un marcador sin resolver.
 */
export function resolver(doc: DocumentoLegal, datos: DatosExpediente): DocumentoResuelto {
  for (const clave of doc.campos) {
    if (!CAMPO_POR_CLAVE.has(clave)) {
      throw new Error(`${doc.codigo}: campo no declarado «${clave}»`);
    }
    if (datos.variables[clave] === undefined || String(datos.variables[clave]).trim() === "") {
      throw new Error(`${doc.codigo}: falta la variable «${clave}»`);
    }
  }

  const bloques = doc.bloques.map((bloque) => {
    if (bloque.tipo === "buzones" || bloque.tipo === "limites") return bloque;
    return resolverValor(bloque, datos.variables, doc.codigo);
  });

  const resto = textosDe(bloques).flatMap((t) => [...t.matchAll(MARCADOR)].map((m) => m[0]));
  if (resto.length) {
    throw new Error(`${doc.codigo}: quedaron marcadores sin resolver: ${resto.join(", ")}`);
  }

  return { ...doc, bloques, usadas: variablesUsadas(doc) };
}
