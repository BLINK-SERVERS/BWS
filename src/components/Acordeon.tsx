import { useId, useState } from "react";
import { Icono } from "./Icono";

/* ============================================================
   Acordeon — las preguntas, sin librerías
   ------------------------------------------------------------
   Mismo patrón que la landing de Pay, clonado a propósito:

   · La pregunta vive en un `h3`, así el esquema del documento la ve
     aunque esté cerrada.
   · El botón lleva `aria-expanded` y `aria-controls`; el panel es
     `role="region"` etiquetado por ese botón.
   · El panel cerrado se marca con `inert`, no solo con `display:none`:
     así tampoco se puede tabular hacia una respuesta oculta, que es el
     fallo de accesibilidad típico de los acordeones hechos a mano.
   · Se deja UN solo panel abierto a la vez. Cinco respuestas abiertas
     a la vez convierten la sección en un muro de texto, que es justo
     lo que este sitio evita.
   · Escape cierra y devuelve el foco al botón.
   · La animación es `grid-template-rows: 0fr → 1fr` (en landing.css),
     que mide el contenido real en vez de una altura fija adivinada.

   Como el sitio es una SPA, el FAQ necesita JavaScript para abrirse.
   Va anotado en el README; sin JS la pregunta y su botón se ven y se
   copian, solo que la respuesta queda plegada.
   ============================================================ */

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

export function Acordeon({ items }: { items: Pregunta[] }) {
  const base = useId();
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <ul className="lp-acordeon">
      {items.map((item, indice) => {
        const activo = abierta === indice;
        const idBoton = `${base}-boton-${indice}`;
        const idPanel = `${base}-panel-${indice}`;

        return (
          <li
            key={item.pregunta}
            className={`lp-acordeon__item${activo ? " lp-acordeon__item--abierto" : ""}`}
            onKeyDown={(evento) => {
              if (evento.key !== "Escape" || abierta === null) return;
              evento.stopPropagation();
              setAbierta(null);
              document.getElementById(`${base}-boton-${abierta}`)?.focus();
            }}
          >
            <h3 className="lp-acordeon__titulo">
              <button
                type="button"
                className="lp-acordeon__boton"
                id={idBoton}
                aria-expanded={activo}
                aria-controls={idPanel}
                onClick={() => setAbierta(activo ? null : indice)}
              >
                <span className="lp-acordeon__texto">{item.pregunta}</span>
                <span className="lp-acordeon__chevron" aria-hidden="true">
                  <Icono nombre="chevron" />
                </span>
              </button>
            </h3>
            <div
              className="lp-acordeon__bandeja"
              id={idPanel}
              role="region"
              aria-labelledby={idBoton}
              inert={!activo}
            >
              <div className="lp-acordeon__contenido">
                <p className="lp-acordeon__respuesta">{item.respuesta}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
