import { type Socio, SOCIOS } from "../lib/socios";

/* ============================================================
   Socios — la banda de aliados
   ------------------------------------------------------------
   Prueba social, no documentación: las marcas de la gente con la que
   se trabaja, en orden de lo que sostiene el proyecto. Ni una línea que
   explique qué hace cada una.

   Dos cosas cambian respecto a la banda de siempre:

   1. El nombre va al lado del logo, como lo trae cada marca. Antes los
      nombres solo existían en el `aria-label`, así que en pantalla la
      fila era un acertijo: un rayo, una nube, un pulpo. Con el nombre
      visible, la prueba social se lee sin tener que reconocer el glifo.
      Y como el texto ahora está a la vista, el `role="img"` con
      `aria-label` sobra y molesta: el accesible pasaría a decir
      «GitHub GitHub». Se deja el SVG oculto para lectores de pantalla
      (`aria-hidden`) y el nombre se lee una sola vez.
   2. La jerarquía la manda el ORDEN de `lib/socios.ts` y el tamaño lo
      fija `landing.css` con `:nth-child(-n + 5)`: los cinco que sostienen
      el proyecto se dibujan más grandes. No hay dos listas ni etiquetas
      de «menores»: una sola fila, ordenada.

   El truco de la fila sigue siendo el ALTO DE TINTA, no el tamaño del
   SVG. Los vectores oficiales vienen en una caja de 24x24, pero su tinta
   real mide cosas muy distintas (medido con `scripts/medir-socios.mjs`):
     · Supabase 23,39 x 24   · Cloudflare 24 x 10,85
     · GitHub    24 x 23,41  · Zoho       24 x 10,21
   Recortando el viewBox a la caja de tinta, y multiplicando por `alto`
   (ajuste óptico por marca), las nueve pesan lo que deben pesar.

   AWS, Qoder y nic.ve no tienen vector oficial al alcance (simpleicons y
   devicon responden 404): se componen como texto-marca con la pila de la
   familia, que es el nombre y nada más.
   ============================================================ */

function Pieza({ socio }: { socio: Socio }) {
  if (socio.esTexto) {
    return (
      <span className="lp-socio lp-socio--texto">
        <span className="lp-socio__nombre">{socio.nombre}</span>
      </span>
    );
  }

  const { x, y, w, h } = socio.caja;

  return (
    <span className="lp-socio" style={{ ["--optico" as string]: String(socio.alto ?? 1) }}>
      {/* viewBox recortado a la tinta medida: ver el comentario de arriba. */}
      <svg className="lp-socio__glifo" viewBox={`${x} ${y} ${w} ${h}`} focusable="false" aria-hidden="true">
        <path d={socio.ruta} />
      </svg>
      <span className="lp-socio__nombre">{socio.nombre}</span>
    </span>
  );
}

export function Socios() {
  return (
    <ul className="lp-socios">
      {SOCIOS.map((socio) => (
        <li key={socio.nombre}>
          <Pieza socio={socio} />
        </li>
      ))}
    </ul>
  );
}
