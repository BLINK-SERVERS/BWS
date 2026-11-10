import { type Marca, FILA_1, SOCIOS } from "../lib/socios";

/* ============================================================
   Socios — la cinta de aliados
   ------------------------------------------------------------
   Prueba social, no documentación: los lockups oficiales de la gente
   con la que se trabaja, pasando de largo. Ni una línea que explique
   qué hace cada una.

   Es una cinta, no una matriz. Antes la banda era una rejilla de tres
   por tres quieta; ahora son dos pistas que corren en sentido
   contrario. Lo que se gana es que quepan las nueve marcas con su
   lockup completo —los nueve PNG oficiales pesan mucho más que un
   glifo de 24 px— sin que la sección se vuelva una pared de logos ni
   tenga que agrandarse.

   Cuatro cosas sostienen el truco, y las cuatro están en `landing.css`
   o aquí, no repartidas:

   1. BUCLE SIN COSTURA. La pista son `REPLICAS` juegos idénticos en
      fila, y el keyframe manda `translate3d(-25%, 0, 0)`: al terminar
      el ciclo la pista está exactamente como empezó, desplazada un
      juego. Para que eso sea verdad cada `<li>` lleva su propio margen
      de separación (`margin-inline-end`) en vez de un `gap` del
      contenedor — con `gap` sobraría medio espacio entre el último
      elemento de un juego y el primero del siguiente, y el salto de
      medio `gap` en cada vuelta se vería. Cuatro juegos de ~600 px son
      2400 px: alcanzan para cubrir 1440 px de ventana menos un juego,
      que es lo que necesita el truco para no dejar hueco.

   2. PAUSA. Al pasar el ratón o el foco sobre la cinta, las dos pistas
      se paran. Un logo que se mueve no se puede leer, y esta banda
      existe para que se lea.

   3. MOVIMIENTO REDUCIDO. Con `prefers-reduced-motion: reduce` no hay
      traslación: la pista deja de animarse, se corta a un solo juego y
      ese juego se envuelve centrado. La información es la misma; lo
      único que cambia es que no pasa.

   4. ACCESIBILIDAD. El nombre de cada marca va en el `alt` del lockup,
      así que la cinta se lee como lo que es. Los tres juegos que son
      copia del primero van en `aria-hidden`: sin eso, un lector de
      pantalla diría «GitHub, GitHub, GitHub, GitHub».
   ============================================================ */

const REPLICAS = 4;

function Pieza({ marca }: { marca: Marca }) {
  const optico = { ["--optico" as string]: String(marca.alto) };

  if (!marca.logo) {
    const { x, y, w, h } = marca.caja ?? { x: 0, y: 0, w: 24, h: 24 };
    /* Resend: glifo oficial + nombre con la pila de la familia. El
       viewBox va recortado a la caja de tinta medida, que es lo que
       hace que pese igual que los lockups de al lado. */
    return (
      <span className="lp-cinta__compuesta" style={optico}>
        <svg
          className="lp-cinta__glifo"
          viewBox={`${x} ${y} ${w} ${h}`}
          focusable="false"
          aria-hidden="true"
        >
          <path d={marca.ruta} />
        </svg>
        <span className="lp-cinta__nombre">{marca.nombre}</span>
      </span>
    );
  }

  return (
    <img
      className="lp-cinta__logo"
      src={marca.logo}
      alt={marca.nombre}
      style={optico}
      decoding="async"
      draggable={false}
    />
  );
}

function Fila({
  marcas,
  escalon,
  sentido,
}: {
  marcas: Marca[];
  escalon: 1 | 2;
  sentido: "izquierda" | "derecha";
}) {
  return (
    <div
      className={`lp-cinta__pista lp-cinta__pista--${sentido}`}
      data-escalon={escalon}
    >
      {Array.from({ length: REPLICAS }, (_, replica) => (
        <ul key={replica} className="lp-cinta__fila" aria-hidden={replica > 0 || undefined}>
          {marcas.map((marca) => (
            <li key={marca.nombre}>
              <Pieza marca={marca} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function Socios() {
  /* La partición es la jerarquía declarada en `lib/socios.ts`: arriba
     lo que hace que el proyecto exista, abajo lo que lo hace andar. */
  return (
    <div className="lp-cinta">
      <Fila marcas={SOCIOS.slice(0, FILA_1)} escalon={1} sentido="izquierda" />
      <Fila marcas={SOCIOS.slice(FILA_1)} escalon={2} sentido="derecha" />
    </div>
  );
}
