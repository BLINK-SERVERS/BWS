import { PAGOS } from "../lib/pagos";

/* ============================================================
   Pagos — los rectángulos del pie
   ------------------------------------------------------------
   Cada rectángulo lleva el símbolo oficial y, escrito al lado, el nombre
   de la red. Por eso el `<img>` va MUDEZ: el nombre ya está en el texto
   que lo acompaña, y un `alt="Binance"` junto a «Binance» hace que el
   lector de pantalla lo diga dos veces. El enlace accesible de cada
   rectángulo es el nombre escrito, no el dibujo.

   `translate="no"` en el `<li>`: son nombres propios de marcas, y el
   traductor del navegador no debe convertir «Pago Móvil» en «Payment
   Mobile».

   El `width`/`height` van declarados aunque el CSS mande: sin las dos
   cifras el navegador no reserva el hueco y la fila salta cuando baja el
   archivo (Web Interface Guidelines, CLS).

   No llevan `loading="lazy"`, y no es un olvido: Vite incrusta estos
   cuatro SVG como `data:` dentro del bundle (son 2,5 KB entre tres
   archivos), así que no hay ninguna petición que aplazar. Posponer lo que
   ya está en memoria solo abre la carrera de no pintarlos —visible en la
   captura completa de 390 px del 2026-11-15: cuatro rectángulos con el
   nombre y la marca ausente.

   La explicación de cómo se usa cada red no va aquí —va en /pagos/, a
   donde apunta el título del bloque— para que la fila del pie quede en una
   sola línea y se lea de un golpe.
   ============================================================ */

export function Pagos() {
  return (
    <ul className="lp-pagos">
      {PAGOS.map((medio) => (
        <li key={medio.nombre} className="lp-pago" translate="no">
          {medio.glifo && (
            <img
              className="lp-pago__glifo"
              src={medio.glifo}
              alt=""
              aria-hidden="true"
              width={medio.px?.w}
              height={medio.px?.h}
              decoding="async"
              draggable={false}
            />
          )}
          <span className="lp-pago__nombre">{medio.nombre}</span>
        </li>
      ))}
    </ul>
  );
}
