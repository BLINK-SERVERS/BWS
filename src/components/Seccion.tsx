import type { ReactNode } from "react";

/* ============================================================
   Seccion — el envoltorio que fija el tema
   ------------------------------------------------------------
   `tema` no es cosmético: `.lp-seccion--oscura` redefine los tokens
   `--lp-*` para TODO su subárbol, así que el color lo decide la
   sección y no el sistema operativo. Por eso el sitio no necesita
   script de apariencia ni `light-dark()`.

   El `id` va en la propia sección para que el ancla de la barra
   (`#que-hacemos`) aterrice en el borde, con el respiro que ya le da
   `scroll-margin-top`.
   ============================================================ */

interface Props {
  /** Ancla de navegación. Sin `id` la sección no es enlazable. */
  id?: string;
  tema?: "clara" | "oscura" | "gris";
  /** Título de la sección. Es `h2` y etiqueta el bloque por referencia. */
  titulo?: string;
  /** Clase del título, para cuando el titular de la sección ya tiene la
      suya propia (`.lp-promesa`) y no hay que duplicar jerarquías. */
  claseTitulo?: string;
  /** Ancho del contenido: 980 px por defecto, 720 px en texto corrido. */
  estrecho?: boolean;
  className?: string;
  /* Opcional desde que la promesa se quedó sin subtítulo: hay secciones
     que son solo su titular, y meterles un `<></>` vacío sería ruido. */
  children?: ReactNode;
}

export function Seccion({
  id,
  tema = "clara",
  titulo,
  claseTitulo = "lp-titulo-seccion",
  estrecho = false,
  className = "",
  children,
}: Props) {
  const tituloId = id ? `${id}-titulo` : undefined;

  return (
    <section
      id={id}
      className={`lp-seccion lp-seccion--${tema}${className ? ` ${className}` : ""}`.trim()}
      aria-labelledby={titulo ? tituloId : undefined}
    >
      <div className={`lp-contenido${estrecho ? " lp-contenido--estrecho" : ""}`}>
        {titulo && (
          <h2 id={tituloId} className={claseTitulo}>
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}
