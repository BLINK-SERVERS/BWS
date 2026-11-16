import binance from "../assets/pagos/origen/binance.svg";
import mastercard from "../assets/pagos/origen/mastercard.svg";
import zinli from "../assets/pagos/origen/zinli-isotipo.svg";

/* ============================================================
   Pagos — los medios con los que se puede pagar, sin preguntar
   ------------------------------------------------------------
   El pie no dice «consúltenos las formas de pago»: la gente no espera
   una respuesta para saber si puede. Cuatro rectángulos, cada uno con
   la marca OFICIAL de su red y el nombre escrito al lado.

   POR QUÉ NINGUNO ES UN LOCKUP COMPLETO. De las cuatro marcas solo Zinli
   publica un wordmark vectorial limpio; Binance, Mastercard y Pago Móvil
   llegaron como símbolo —o, en el caso de Pago Móvil, no llegó nada
   vectorial y comprobable. Un rombo amarillo suelto no se lee «Binance»,
   así que la regla es una sola para las cuatro y no dos: se sirve el
   símbolo oficial tal cual (el archivo SVG verbatim, sin retocar la
   geometría ni el color de marca) y el nombre al lado, con la pila de la
   familia. Donde no hay símbolo, queda solo el nombre escrito: un texto
   dice «Pago Móvil», un logo inventado por nosotros dice una mentira sobre
   una red bancaria ajena. Mezclar lockups con símbolos compuestos daría
   una fila de rectángulos con pesos distintos. Es el mismo trato que
   Resend en la cinta de aliados.

   CERO PETICIONES A TERCEROS, igual que en la cinta: lo que se sirve está
   en `src/assets/pagos/origen/` y sale con el build. Nada de
   `cdn.simpleicons.org` en tiempo de ejecución. Los SVG viven en `origen/`
   porque aquí no hay nada que procesar: son el vector final, no la materia
   prima de un script.

   El orden es el de uso, no el alfabético: primero lo que la gente ya
   tiene en el bolsillo (transferencia y tarjeta) y después lo demás.
   ============================================================ */

export interface Medio {
  nombre: string;
  /** SVG oficial de la marca, tomado del repo. Falta cuando no existe un
      vector público comprobable: un nombre escrito vale, un logo dibujado
      a mano por nosotros no. */
  glifo?: string;
  /** Caja del SVG, para que el navegador reserve el hueco (CLS). */
  px?: { w: number; h: number };
}

export const PAGOS: Medio[] = [
  { nombre: "Pago Móvil" },
  { nombre: "Mastercard", glifo: mastercard, px: { w: 24, h: 24 } },
  { nombre: "Binance", glifo: binance, px: { w: 24, h: 24 } },
  { nombre: "Zinli", glifo: zinli, px: { w: 302, h: 338 } },
];
