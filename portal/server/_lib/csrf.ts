/* ============================================================
   Comprobación de origen en mutaciones
   ------------------------------------------------------------
   La sesión viaja en una cookie `SameSite=Lax`. Aun así, toda
   escritura exige un `Origin` que coincida con el origen publicado.
   Los orígenes de desarrollo solo se aceptan fuera de producción:
   si no, cualquiera que sepa la URL podría firmar desde un
   `localhost` propio. Si `APP_ORIGEN` no está definido en
   producción, la lista queda vacía y eso cierra la puerta, no la
   abre.
   ============================================================ */

import { ErrorHttp } from "./respuestas";

const LOCALES = ["http://localhost:5177", "http://127.0.0.1:5177"];

export function origenPermitido(peticion: Request): boolean {
  const origen = peticion.headers.get("origin");
  if (!origen) return false;
  const configurados = (process.env.APP_ORIGEN ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
  const locales = process.env.ENTORNO === "produccion" ? [] : LOCALES;
  return [...locales, ...configurados].includes(origen);
}

export function exigirOrigen(peticion: Request): void {
  if (!origenPermitido(peticion)) {
    throw new ErrorHttp(403, "El origen de la petición no está permitido.", "origen");
  }
}
