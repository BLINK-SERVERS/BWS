/* ============================================================
   Campo de formulario
   ------------------------------------------------------------
   Etiqueta siempre visible, ayuda opcional y error anunciado con
   `role="alert"`. El identificador de la ayuda se ata con
   `aria-describedby` para que un lector de pantalla lea lo mismo
   que se ve.
   ============================================================ */

import type { ReactNode } from "react";

export function Campo({
  id,
  etiqueta,
  valor,
  alCambiar,
  tipo = "text",
  autocompletar,
  ayuda,
  error,
  modo = "texto",
  children,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  tipo?: string;
  autocompletar?: string;
  ayuda?: string;
  error?: string | null;
  modo?: "texto" | "select" | "area";
  children?: ReactNode;
}) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descrito = [ayuda ? idAyuda : null, error ? idError : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="po-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {modo === "select" ? (
        <select
          id={id}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          aria-describedby={descrito || undefined}
          aria-invalid={error ? true : undefined}
        >
          {children}
        </select>
      ) : modo === "area" ? (
        <textarea
          id={id}
          rows={7}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          aria-describedby={descrito || undefined}
          aria-invalid={error ? true : undefined}
        />
      ) : (
        <input
          id={id}
          type={tipo}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          autoComplete={autocompletar}
          aria-describedby={descrito || undefined}
          aria-invalid={error ? true : undefined}
        />
      )}
      {ayuda ? (
        <p className="po-campo-ayuda" id={idAyuda}>
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p className="po-campo-error" id={idError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
