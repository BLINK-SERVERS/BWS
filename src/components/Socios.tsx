import { ALTO_TINTA_PX, SOCIOS, type Socio } from "../lib/socios";

/* ============================================================
   Socios — la banda de aliados
   ------------------------------------------------------------
   Prueba social, no documentación: cinco marcas y ni una línea que
   explique qué hace cada una. El cliente no tiene que saberlo; le
   basta ver con quién trabajamos.

   El truco de la fila es el ALTO DE TINTA, no el tamaño del SVG. Los
   cuatro vectores oficiales vienen en una caja de 24x24, pero su tinta
   real mide cosas muy distintas (medido con scripts/medir-socios.mjs):
     · Supabase   23,39 x 24      · Cloudflare 24 x 10,85
     · GitHub      24 x 23,41     · Zoho       24 x 10,21
   Si los cinco se dibujaran con viewBox "0 0 24 24" y el mismo alto,
   la nube de Cloudflare ocuparía la mitad del cuadro y se vería dos
   veces más chica que el rayo de Supabase. Recortando el viewBox a la
   caja de tinta, el alto que se fija en CSS es ALTO DE TINTA parejo.

   `alto` es un ajuste óptico por marca (las tiras anchas pesan más que
   los cuadros a la misma altura) y se calibra mirando la captura.

   nic.ve no tiene marca vectorial oficial: simpleicons responde 404.
   Se compone como texto-marca con la pila de la familia. Es un dato,
   no una flojera, y va anotado en lib/socios.ts.

   Los `aria-label` son los ÚNICOS sitios del sitio donde se leen estos
   nombres. No hay ALT escondido ni texto visible: la banda se dibuja,
   no se explica.
   ============================================================ */

function LogoSocio({ socio }: { socio: Socio }) {
  const alto = ALTO_TINTA_PX * (socio.alto ?? 1);

  if (socio.esTexto) {
    return (
      <span className="lp-socio lp-socio--texto" style={{ height: `${alto}px` }}>
        {socio.nombre}
      </span>
    );
  }

  const { x, y, w, h } = socio.caja;

  return (
    <span
      className="lp-socio"
      style={{ height: `${alto}px` }}
      role="img"
      aria-label={socio.nombre}
    >
      {/* viewBox recortado a la tinta medida: ver el comentario de arriba. */}
      <svg viewBox={`${x} ${y} ${w} ${h}`} focusable="false" aria-hidden="true">
        <path d={socio.ruta} />
      </svg>
    </span>
  );
}

export function Socios() {
  return (
    <ul className="lp-socios">
      {SOCIOS.map((socio) => (
        <li key={socio.nombre}>
          <LogoSocio socio={socio} />
        </li>
      ))}
    </ul>
  );
}
