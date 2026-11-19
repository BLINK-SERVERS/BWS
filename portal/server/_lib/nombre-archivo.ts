/* Nombre persistido del PDF y compatibilidad con expedientes anteriores. */

/** El nombre persistido procede de nombreDocumento; se acepta con o sin extensión. */
export function nombreArchivoPdf(
  nombreGuardado: unknown,
  codigo: string,
  version: number,
  ajustado: boolean,
): string {
  const guardado = typeof nombreGuardado === "string" ? nombreGuardado : "";
  const base = guardado.replace(/\.pdf$/i, "");
  const valido = base.length > 0 && !/[^\p{L}\p{N}_]/u.test(base)
    && new TextEncoder().encode(base).length <= 230;
  const codigoSeguro = codigo.length === 11 && /^BWS-[A-Z]{3}-\d{3}$/.test(codigo)
    ? codigo : "documento";
  const versionSegura = Number.isSafeInteger(version) && version >= 0 ? version : 0;
  const nombre = valido ? base : `${codigoSeguro}-v${versionSegura}`;
  return `${nombre}${ajustado ? "-ajustado" : ""}.pdf`;
}

/** RFC 6266/8187: cabecera ASCII con alternativa UTF-8, sin rutas ni controles. */
export function disposicionPdf(nombre: string): string {
  const base = nombre.slice(0, -4);
  const seguro = nombre.endsWith(".pdf") && base.length > 0 && !/[^\p{L}\p{N}_-]/u.test(base)
    ? nombre : "documento.pdf";
  const ascii = seguro.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]/g, "_");
  const utf8 = encodeURIComponent(seguro).replace(/[!'()*]/g, (caracter) =>
    `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
