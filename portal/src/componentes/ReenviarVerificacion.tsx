/* ============================================================
   Reenvío del enlace de verificación
   ------------------------------------------------------------
   El enlace del correo vence a las 24 horas y se consume una sola
   vez. Esta acción emite otro para la cuenta con sesión abierta,
   sin salir del portal.
   ============================================================ */

import { useState } from "react";
import { api, FalloApi } from "../datos/api";

type Estado = "inactivo" | "enviando" | "enviado" | "fallo";

export function ReenviarVerificacion() {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(null);

  const pedir = async () => {
    setEstado("enviando");
    setMensaje(null);
    try {
      const respuesta = await api.reenviarVerificacion();
      if (respuesta.enviado) {
        setEstado("enviado");
        setMensaje(
          "Te enviamos un enlace nuevo. Revisa la bandeja y el correo no deseado; vence en 24 horas.",
        );
      } else {
        setEstado("fallo");
        setMensaje(
          "No pudimos enviar el correo. Escribe a business@blink.com.ve.",
        );
      }
    } catch (error) {
      setEstado("fallo");
      setMensaje(
        error instanceof FalloApi
          ? error.message
          : "No pudimos enviar el correo. Escribe a business@blink.com.ve.",
      );
    }
  };

  return (
    <>
      <button
        type="button"
        className="po-boton po-boton-suave"
        onClick={() => void pedir()}
        disabled={estado === "enviando" || estado === "enviado"}
      >
        {estado === "enviando"
          ? "Enviando…"
          : estado === "enviado"
            ? "Enlace enviado"
            : "Reenviar el correo de verificación"}
      </button>
      {mensaje ? (
        <p
          className={estado === "enviado" ? "po-apagado" : "po-campo-error"}
          role={estado === "enviado" ? "status" : "alert"}
        >
          {mensaje}
        </p>
      ) : null}
    </>
  );
}
