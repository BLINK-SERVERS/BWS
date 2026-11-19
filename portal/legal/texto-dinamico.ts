import type { DatosExpediente, DocumentoLegal, FirmaCapturada } from "./tipos";

const SIGNOS_PROHIBIDOS = /[;«»•]|\*\*/;
// Las fechas, la IP y el agente son datos de evidencia, no texto libre a validar.
const DATO_DE_EVIDENCIA = /(?:^|_)(?:fecha|utc|ip|agente)(?:_|$)/;

/**
 * Identificadores de texto dinámico problemático, sin modificar los datos.
 * Las variables usan su clave; las tablas, su índice y propiedad; la firma,
 * `firmas.cliente.documento` o `firmas.cliente.correo`.
 * También se revisan el nombre y el correo alternativo de `variables` cuando
 * son visibles en la hoja de firmas.
 */
export function validarTextoDinamico(
  documentos: readonly DocumentoLegal[],
  datos: DatosExpediente,
  firmaCliente: FirmaCapturada,
): string[] {
  const problemas = new Set<string>();
  const revisar = (clave: string, valor: unknown) => {
    if (typeof valor === "string" && SIGNOS_PROHIBIDOS.test(valor)) problemas.add(clave);
  };

  for (const doc of documentos) {
    for (const clave of doc.campos) {
      if (!DATO_DE_EVIDENCIA.test(clave)) revisar(clave, datos.variables[clave]);
    }
  }

  if (documentos.some((doc) => doc.bloques.some((bloque) => bloque.tipo === "buzones"))) {
    datos.buzones.forEach((buzon, indice) => {
      revisar(`buzones[${indice}].correo`, buzon.correo);
      revisar(`buzones[${indice}].uso`, buzon.uso);
    });
  }
  if (documentos.some((doc) => doc.bloques.some((bloque) => bloque.tipo === "limites"))) {
    datos.limites.forEach((limite, indice) => {
      revisar(`limites[${indice}].concepto`, limite.concepto);
      revisar(`limites[${indice}].valor`, limite.valor);
    });
  }

  if (documentos.length) {
    revisar("cliente_razon_social", datos.variables.cliente_razon_social);
    revisar("firmas.cliente.documento", firmaCliente.documento);
    const correo = firmaCliente.correo;
    if (correo) revisar("firmas.cliente.correo", correo);
    else revisar("cliente_correo", datos.variables.cliente_correo);
  }

  return [...problemas];
}
