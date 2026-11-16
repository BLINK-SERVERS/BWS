import bnc from "../assets/pagos/origen/bnc-isotipo.png";
import binance from "../assets/pagos/origen/binance.svg";
import mastercard from "../assets/pagos/origen/mastercard-simbolo.svg";
import zinli from "../assets/pagos/origen/zinli-z.png";

/* ============================================================
   Pagos — los medios con los que se puede pagar, sin preguntar
   ------------------------------------------------------------
   El pie no dice «consúltenos las formas de pago»: la gente no espera
   una respuesta para saber si puede. Cuatro credenciales, cada una con el
   fondo de su propia marca y su símbolo encima, sin nombre escrito.

   CADA FICHA SE DEFINE POR EL FONDO DE LA MARCA, NO POR NUESTRO CRITERIO.
   Proveniencia comprobada de los cuatro, el 2026-11-15:

   · Mastercard — los dos círculos a color completo sobre negro. El propio
     brand center define su «acceptance mark» como el símbolo sobre fondo
     negro, así que el negro no es un gusto nuestro. Los tres hexes son los
     publicados (rojo #EB001B, solapamiento #FF5F00, amarillo #F79E1B) y la
     geometría sale de φ: separación de centros 2r(φ−1), caja 2φr × 2r.
     Verificado numéricamente, no a ojo: desvío 0,055 sobre 1000 unidades
     y los cortes de la lente caen en y = 66,08 y 551,92. El símbolo va a
     color completo: la versión anterior era monocroma porque el único
     lockup a color que circulaba estaba mal reproducido, y hecho desde la
     geometría publicada ese pretexto ya no existe.
   · Binance — el rombo oficial #F0B90B, tal cual, sobre negro.
   · Zinli — el icono de la app que el propio zinli.com sirve
     (`/icon-512x512.png`): campo morado #5A37B4 con la «Z» en su verde
     #32CD96, los dos colores planos, sin degradado. Los hexes son los
     tokens que ese sitio declara en su CSS (`--purple`, `--green`). Se
     recortó a la mancha de la Z y nada más: no se redibujó ni se cambió
     un color. Ojo con el rosetón de seis cintas que está en su HTML
     (`IsoPurple`, viewBox 302×338): es un motivo decorativo del sitio, no
     la marca —la Z del logo es angular y simple, y ese rosetón fue lo que
     servíamos antes de esta corrección.
   · BNC (Pago Móvil) — el símbolo que el banco publica en
     bncenlinea.com/…/bnc-logo-white.png (170×75), recortado a su bloque
     de 61×59 (arco + las tres letras), en blanco sobre su azul #001C4D,
     el color dominante de su propio archivo. No hay vector oficial de BNC
     en ningún sitio: el banco solo sirve mapa de bits, Wikidata no tiene
     P154 y simple-icons no lo incluye. Esos 61×59 son lo más grande que
     existe del símbolo —el favicon del sitio es de 48×48— y es la
     resolución con la que se sirve. La versión a color no servía sobre
     azul: su letra «N» es del mismo azul del fondo y desaparecía.

   Por qué el nombre va al `alt` y no escrito al lado: la ficha es un
   icono nomás, pero «Pago Móvil» no se lee en ningún dibujo —es una
   palabra—, y sin el nombre accesible la fila sería cuatro marcas mudas.

   CERO PETICIONES A TERCEROS, igual que en la cinta: lo que se sirve está
   en `src/assets/pagos/origen/` y sale con el build.

   El orden es el de uso, no el alfabético: primero lo que la gente ya
   tiene en el bolsillo (transferencia y tarjeta) y después lo demás.
   ============================================================ */

export interface Medio {
  nombre: string;
  /** Lo que dice el lector de pantalla. Coincide con `nombre` salvo donde
      el dibujo es de otra entidad que el medio: Pago Móvil es la red y el
      logo es el banco que la presta. */
  alt?: string;
  /** SVG o PNG oficial de la marca, tomado del repo y servido con el build. */
  glifo: string;
  /** Fondo de la marca, no nuestro. */
  fondo: string;
  /** Caja del archivo, para que el navegador reserve el hueco (CLS). */
  px: { w: number; h: number };
}

export const PAGOS: Medio[] = [
  { nombre: "Pago Móvil", alt: "Pago Móvil por BNC", glifo: bnc, fondo: "#001C4D", px: { w: 61, h: 59 } },
  { nombre: "Mastercard", glifo: mastercard, fondo: "#000000", px: { w: 1000, h: 618 } },
  { nombre: "Binance", glifo: binance, fondo: "#000000", px: { w: 24, h: 24 } },
  { nombre: "Zinli", glifo: zinli, fondo: "#5A37B4", px: { w: 348, h: 310 } },
];
