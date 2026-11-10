/* ============================================================
   Aliados de BWS — la cinta
   ------------------------------------------------------------
   Nueve marcas, cada una con su lockup OFICIAL a color. El 2026-11-10
   el dueño del proyecto entregó las nueve capturas de las marcas
   (ocho distintas: la de Qoder venía repetida, md5 en mano) y esas
   capturas son ahora la fuente: viven sin tocar en
   `src/assets/logos/origen/*.jpg` y `scripts/preparar-logos.py` las
   clavea, les quita el fondo cocido, las recorta a la caja de tinta y
   las deja en `src/assets/logos/*.png`. El repo publica los PNG, nunca
   los JPG: un JPG no tiene alfa y su fondo negro o blanco se vería
   como un ladrillo sobre el blanco de la sección.

   CERO PETICIONES A TERCEROS. Nada de `<img src="https://cdn...">`: el
   sitio no puede depender de que un ajeno esté arriba, ni regalarle
   una visita por cada impresión de un logo. Lo que se sirve está en el
   repo y sale con el build.

   EL ORDEN ES LA JERARQUÍA. Lo que sostiene un proyecto no pesa igual.
   La cinta se lee en dos filas: la de arriba es lo que hace que el
   sitio exista (el repositorio del que se publica, la red por la que
   entra la gente, la base que responde); la de abajo es lo que lo hace
   andar (la base alterna, la nube, el correo con tu dominio, el correo
   programático, la herramienta con la que se construye, el registro del
   dominio). La fila la decide la POSICIÓN en esta lista — `FILA_1`
   partiendo — y el peso visual de cada marca lo decide `alto`. Mover
   una marca de fila cambia su tamaño solo: no hay un segundo sitio
   donde tocarla.

   `alto` es un ajuste óptico, no geométrico: un lockup apilado (el
   cloud de encima del descriptor en Cloudflare, el sobre de Zoho)
   necesita más altura de tinta que uno horizontal para pesar lo mismo
   a la vista, y un disco redondo (nic.ve) más que una palabra. Se
   calibra mirando la captura de la cinta, y `preparar-logos.py` LO LEE
   DE AQUÍ — exportar a otra altura con otro `alto` es la única forma
   de que la cinta salga borrosa o descalibrada.

   `px` es la caja exportada (ancho x alto del PNG), medida por el
   propio script al escribir el archivo. Sirve de referencia para
   recalcular el `alto` sin tener que abrir el PNG.

   Resend es la única que sigue compuesta: su lockup no llegó entre las
   capturas, así que se dibuja con el glifo vectorial oficial
   (simpleicons, copiado y servido desde aquí) y el nombre con la pila
   de la familia. No es una aproximación de la silueta: es el glifo real
   y el nombre real, y se pinta con la tinta de la sección para que no
   lea como un marcador de posición al lado de las otras ocho.
   ============================================================ */

import aws from "../assets/logos/aws.png";
import cloudflare from "../assets/logos/cloudflare.png";
import github from "../assets/logos/github.png";
import neon from "../assets/logos/neon.png";
import nicVe from "../assets/logos/nic-ve.png";
import qoder from "../assets/logos/qoder.png";
import supabase from "../assets/logos/supabase.png";
import zohoMail from "../assets/logos/zoho-mail.png";

export interface Marca {
  nombre: string;
  /** Nombre del archivo en `src/assets/logos/` — y del JPG de origen. */
  archivo: string;
  /** Lockup oficial a color. Falta solo en Resend, que se compone. */
  logo?: string;
  /** Multiplo del alto del escalón con el que se dibuja esta marca. */
  alto: number;
  /** Caja exportada por `preparar-logos.py`, en px. */
  px?: { w: number; h: number };
  /** `d` verbatim del SVG oficial monocromático, para las compuestas. */
  ruta?: string;
  /** Caja de tinta del `d` dentro del viewBox 0 0 24 24. */
  caja?: { x: number; y: number; w: number; h: number };
}

/** Cuántas marcas van en la fila de arriba: partir la lista por aquí es
    lo que hace que la jerarquía se vea. */
export const FILA_1 = 3;

/* Los `alto` y los `px` están medidos, no calculados a ojo: `alto` se
   calibró contra `.capturas/escritorio-1440-aliados.png` y `px` lo
   reporta `python3 scripts/preparar-logos.py` al escribir el PNG. */
export const SOCIOS: Marca[] = [
  {
    nombre: "GitHub",
    archivo: "github",
    logo: github,
    alto: 1,
    px: { w: 425, h: 102 },
  },
  {
    nombre: "Cloudflare",
    archivo: "cloudflare",
    logo: cloudflare,
    alto: 1.18,
    px: { w: 358, h: 120 },
  },
  {
    nombre: "Supabase",
    archivo: "supabase",
    logo: supabase,
    alto: 0.92,
    px: { w: 476, h: 94 },
  },
  {
    nombre: "Neon",
    archivo: "neon",
    logo: neon,
    alto: 1,
    px: { w: 247, h: 72 },
  },
  {
    nombre: "AWS",
    archivo: "aws",
    logo: aws,
    alto: 1.25,
    px: { w: 149, h: 90 },
  },
  {
    nombre: "Zoho Mail",
    archivo: "zoho-mail",
    logo: zohoMail,
    alto: 1.2,
    px: { w: 186, h: 86 },
  },
  {
    nombre: "Resend",
    archivo: "resend",
    alto: 1,
    /* Caja de tinta medida con `scripts/medir-socios.mjs` (getBBox de
       Chromium sobre este mismo `d`) dentro del viewBox 0 0 24 24. */
    ruta: "M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z",
    caja: { x: 0, y: 0, w: 24, h: 24 },
  },
  {
    nombre: "Qoder",
    archivo: "qoder",
    logo: qoder,
    alto: 1,
    px: { w: 283, h: 72 },
  },
  {
    nombre: "nic.ve",
    archivo: "nic-ve",
    logo: nicVe,
    alto: 1.3,
    px: { w: 96, h: 94 },
  },
];
