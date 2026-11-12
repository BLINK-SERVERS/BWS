/* ============================================================
   Envoltura de las funciones
   ------------------------------------------------------------
   Cloudflare entrega un `Request` web y espera un `Response` web.
   Esta envoltura comprueba el método, captura `ErrorHttp` y evita
   que un fallo interno se convierta en una traza con datos.
   ============================================================ */

import { json } from "./http";
import { respuestaDeError } from "./respuestas";

type Metodo = "GET" | "POST";

export function manejar(
  metodos: Metodo[],
  atender: (peticion: Request) => Promise<Response>,
): (peticion: Request) => Promise<Response> {
  return async (peticion) => {
    try {
      if (!metodos.includes(peticion.method as Metodo)) {
        return json(
          { error: "Método no permitido.", codigo: "metodo" },
          405,
          { allow: metodos.join(", ") },
        );
      }
      return await atender(peticion);
    } catch (error) {
      return respuestaDeError(error);
    }
  };
}
