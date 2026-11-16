import { PAGOS } from "../lib/pagos";

/* ============================================================
   Pagos — las credenciales del pie
   ------------------------------------------------------------
   Cada ficha es un icono nomás, con la proporción de la tarjeta de
   plástico y el fondo de su propia marca. El nombre escrito que llevaban
   al lado se fue, pero el nombre NO desaparece del sitio: pasa al `alt`
   del `<img>`. Sin eso la fila sería cuatro dibujos mudos —nadie, ni con
   lector de pantalla ni con buscador, sabría que uno de ellos es
   «Pago Móvil».

   El `alt` lleva el nombre y el glifo deja de estar `aria-hidden` por la
   misma razón que antes lo silenciaba, ahora invertida: ya no hay texto
   al lado que lo nombre, así que el dibujo es el único que habla.

   `translate="no"` en el `<li>`: ahora que el nombre vive en el `alt`, es
   lo que el traductor del navegador tiene delante, y no debe convertir
   «Pago Móvil» en «Payment Mobile».

   El `width`/`height` van declarados aunque el CSS mande: sin las dos
   cifras el navegador no reserva el hueco y la fila salta cuando baja el
   archivo (Web Interface Guidelines, CLS).

   No llevan `loading="lazy"`, y no es un olvido: tres de los cuatro
   archivos salen incrustados como `data:` dentro del bundle —los dos SVG
   y el PNG de BNC—, así que aplazarlos no ahorra nada. El cuarto,
   `zinli-z.png`, pasa del límite de 4096 bytes de Vite y sí es una
   petición, pero son 9 KB: posponerlos solo abre la carrera de no
   pintarlos —visible en la captura completa de 390 px del 2026-11-15.

   La explicación de cómo se usa cada red no va aquí —va en /pagos/, a
   donde apunta el título del bloque— para que la fila quede en una sola
   línea y se lea de un golpe.
   ============================================================ */

export function Pagos() {
  return (
    <ul className="lp-pagos">
      {PAGOS.map((medio) => (
        <li key={medio.nombre} className="lp-pago" style={{ background: medio.fondo }} translate="no">
          <img
            className="lp-pago__glifo"
            src={medio.glifo}
            alt={medio.alt ?? medio.nombre}
            width={medio.px.w}
            height={medio.px.h}
            decoding="async"
            draggable={false}
          />
        </li>
      ))}
    </ul>
  );
}
