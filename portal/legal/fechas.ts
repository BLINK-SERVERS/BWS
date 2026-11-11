/* ============================================================
   Fechas del expediente
   ------------------------------------------------------------
   La fecha del documento se escribe en la zona de Caracas, no en
   la del servidor: un contrato firmado a las 21:00 en Caracas no
   puede fecharse al día siguiente porque la función corra en UTC.
   ============================================================ */

const FORMATO = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Caracas",
});

export function fechaLarga(fecha: Date = new Date()): string {
  return FORMATO.format(fecha);
}
