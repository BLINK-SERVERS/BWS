import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icono } from "./Icono";

interface DialogoProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  onCerrar: () => void;
  variante?: "centro" | "hoja" | "zoom";
  clase?: string;
}

export function Dialogo({ abierto, titulo, descripcion, children, onCerrar, variante = "centro", clase = "" }: DialogoProps) {
  const tituloId = useId();
  const descripcionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const cierreRef = useRef(onCerrar);
  cierreRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;
    const focoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const enfocarPrimero = window.requestAnimationFrame(() => {
      const primero = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea, a[href]");
      primero?.focus();
    });

    function alPresionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cierreRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const elementos = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex='0']")].filter(
        (elemento) => elemento.offsetParent !== null,
      );
      if (elementos.length === 0) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alPresionarTecla);
    return () => {
      window.cancelAnimationFrame(enfocarPrimero);
      document.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = overflowPrevio;
      focoPrevio?.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div className={`dialogo dialogo--${variante}`} onMouseDown={(event) => event.target === event.currentTarget && onCerrar()}>
      <section
        ref={panelRef}
        className={`dialogo__panel dialogo__panel--${variante} ${clase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? descripcionId : undefined}
      >
        <header className="dialogo__cabecera">
          <div>
            <h2 id={tituloId}>{titulo}</h2>
            {descripcion && <p id={descripcionId}>{descripcion}</p>}
          </div>
          <button className="boton-icono" type="button" onClick={onCerrar} aria-label="Cerrar ventana">
            <Icono nombre="cerrar" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
