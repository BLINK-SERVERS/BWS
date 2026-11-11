/* ============================================================
   Validación de datos de identidad
   ------------------------------------------------------------
   Las mismas reglas corren en el navegador y en la función de la
   API. Aquí se valida el **formato** del documento; no se consulta
   al SENIAT ni a ningún registro. La pantalla lo dice así: un RIF
   con formato válido no prueba que exista.
   ============================================================ */

export type TipoDocumento = "RIF" | "cedula" | "pasaporte";

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; etiqueta: string; ayuda: string }[] = [
  { valor: "RIF", etiqueta: "RIF", ayuda: "J-12345678-9" },
  { valor: "cedula", etiqueta: "Cédula", ayuda: "V-12345678" },
  { valor: "pasaporte", etiqueta: "Pasaporte", ayuda: "A1234567" },
];

function limpiar(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Devuelve el documento normalizado o `null` si el formato no sirve. */
export function normalizarDocumento(tipo: TipoDocumento, valor: unknown): string | null {
  const texto = limpiar(valor).toUpperCase().replace(/[\s.]/g, "");
  if (!texto) return null;

  if (tipo === "RIF") {
    const partes = texto.match(/^([VEJPG])-?(\d{8})-?(\d)$/);
    return partes ? `${partes[1]}-${partes[2]}-${partes[3]}` : null;
  }
  if (tipo === "cedula") {
    const partes = texto.match(/^([VE])-?(\d{6,9})$/);
    return partes ? `${partes[1]}-${partes[2]}` : null;
  }
  if (tipo === "pasaporte") {
    const partes = texto.match(/^[A-Z0-9]{6,12}$/);
    return partes ? partes[0] : null;
  }
  return null;
}

export function mensajeDocumento(tipo: TipoDocumento, valor: unknown): string | null {
  if (normalizarDocumento(tipo, valor)) return null;
  if (tipo === "RIF") return "Escribe el RIF con el formato J-12345678-9.";
  if (tipo === "cedula") return "Escribe la cédula con el formato V-12345678.";
  return "Escribe el pasaporte con 6 a 12 letras o números.";
}

/** Correo en minúsculas o `null`. No se valida que el buzón exista. */
export function correoNormalizado(valor: unknown): string | null {
  const texto = limpiar(valor).toLowerCase();
  if (!texto || texto.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto) ? texto : null;
}

/** Minúsculas, sin esquema ni ruta. Acepta `https://ejemplo.com.ve/x`. */
export function normalizarDominio(valor: unknown): string | null {
  const crudo = limpiar(valor).toLowerCase();
  if (!crudo || crudo.length > 300) return null;
  const sinEsquema = crudo.replace(/^[a-z]+:\/\//, "").split("/")[0].split("?")[0].split("#")[0];
  const dominio = sinEsquema.replace(/\.$/, "");
  if (dominio.length < 4 || dominio.length > 253) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(dominio)) return null;
  return dominio;
}

/** Dominio de un correo ya normalizado. */
export function dominioDe(correo: string): string {
  return correo.slice(correo.lastIndexOf("@") + 1);
}

export function nombreValido(valor: unknown): boolean {
  const texto = limpiar(valor);
  return texto.length >= 2 && texto.length <= 120 && /\p{L}/u.test(texto);
}

export function razonSocialValida(valor: unknown): boolean {
  const texto = limpiar(valor);
  return texto.length >= 2 && texto.length <= 160 && /[\p{L}\p{N}]/u.test(texto);
}

export function domicilioValido(valor: unknown): boolean {
  const texto = limpiar(valor);
  return texto.length >= 5 && texto.length <= 240;
}

/** Teléfono con formato libre, pero con al menos siete dígitos. */
export function telefonoNormalizado(valor: unknown): string | null {
  const texto = limpiar(valor);
  if (!texto || texto.length > 25) return null;
  if (!/^\+?[\d\s().-]+$/.test(texto)) return null;
  const digitos = texto.replace(/\D/g, "").length;
  return digitos >= 7 ? texto : null;
}

/** Mensaje de error de la clave, o `null` si cumple. */
export function mensajeClave(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor : "";
  if (texto.length < 10) return "La clave debe tener al menos 10 caracteres.";
  if (texto.length > 200) return "La clave no puede pasar de 200 caracteres.";
  if (texto !== texto.trim()) return "La clave no puede empezar ni terminar con espacios.";
  if (!/\p{L}/u.test(texto) || !/\d/.test(texto)) {
    return "La clave debe combinar letras y números.";
  }
  return null;
}
