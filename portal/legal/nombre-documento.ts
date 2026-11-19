import type { PersonaContrato } from "./textos/con-servicios";

function componente(valor: string, maximo: number): string {
  const limpio = valor.normalize("NFC").toUpperCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  const codificador = new TextEncoder();
  let resultado = "";
  for (const caracter of limpio) {
    if (codificador.encode(resultado + caracter).length > maximo) break;
    resultado += caracter;
  }
  return resultado.replace(/_+$/g, "");
}

export function nombreDocumento(titulo: string, persona: PersonaContrato, categoria: string, cliente: string): string {
  return [
    componente(titulo, 96),
    "BWS",
    "PERSONA",
    persona.toUpperCase(),
    componente(categoria, 36),
    componente(cliente, 64),
  ].join("_");
}
