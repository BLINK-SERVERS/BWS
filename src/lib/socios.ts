/* ============================================================
   Aliados de BWS
   ------------------------------------------------------------
   Nombres con marca vectorial oficial vendorizados aquí, copiados de
   cdn.simpleicons.org en su versión monocromática: `<path d>` dentro de
   un viewBox "0 0 24 24". Se copian y se sirven desde el repo, NO se
   incrusta un `<img>` a la CDN ajena: el sitio no debe depender de que
   un tercero esté arriba, ni regalarle una visita por cada impresión del
   logo.

   EL ORDEN ES LA JERARQUÍA. Lo que sostiene un proyecto no pesa igual, y
   la banda se lee como una matriz de tres por tres: la primera fila es lo
   que hace que el sitio exista (el repositorio del que se publica, la red
   por la que entra la gente, la base de datos que responde); la segunda,
   lo que lo alimenta (la base alterna, la nube, el correo con tu dominio);
   la tercera, lo que lo hace andar en el día a día (el correo
   programático, la herramienta con la que se construye, el registro del
   dominio). `landing.css` agranda por POSICIÓN — `-n + 3` el primer
   escalón, `n + 4`-`n + 6` el segundo, el resto el tercero —, así que
   mover una marca en esta lista le cambia el tamaño solo: no hay un
   segundo sitio donde tocarla.

   `caja` es la caja de TINTA real dentro de ese viewBox, medida con
   `scripts/medir-socios.mjs` (getBBox en Chromium) sobre el mismo `d`
   que vive aquí abajo. Con esa caja se recorta el viewBox de cada logo,
   que es lo que hace que las marcas pesen igual en la fila: si todas
   usaran la caja cuadrada de 24, Cloudflare — que es una tira ancha y
   baja — se vería la mitad de grande que Supabase.

   `alto` es un ajuste óptico por marca (las tiras anchas pesan más que
   los cuadros a la misma altura) y se calibra mirando la captura.

   Las marcas sin vector oficial disponible —`nic.ve` (simpleicons
   responde 404), AWS y Qoder (404 en simpleicons y en devicon)— se
   componen como texto-marca con la pila de la familia: `esTexto: true`.
   No son aproximaciones de la silueta, son el nombre, que es lo único
   que se puede reproducir sin licencia.

   Esta es la ÚNICA pantalla del sitio donde estos nombres aparecen, y
   salen junto a su logo porque así es la marca de cada uno. El cliente
   no tiene que saber qué hace cada cual: la banda es prueba social, no
   documentación.
   ============================================================ */

export interface Socio {
  nombre: string;
  /** `d` verbatim del SVG oficial monocromático. */
  ruta: string;
  /** Caja de tinta medida dentro del viewBox 0 0 24 24. */
  caja: { x: number; y: number; w: number; h: number };
  /** Multiplo del alto común con el que se dibuja esta marca.
     Sale de la captura, no de la cabeza: las marcas cuadradas
     (Supabase, GitHub) y las tiras anchas (Cloudflare, Zoho) pesan
     distinto aun teniendo el mismo alto de tinta. */
  alto?: number;
  /** Sin vector oficial: se compone con tipografía. */
  esTexto?: boolean;
}

/* Las cajas de tinta están MEDIDAS con `node scripts/medir-socios.mjs`
   (getBBox de Chromium sobre el mismo `d` que vive aquí) el 2026-11-10.
   No son aproximaciones: si se cambia un `d`, se vuelve a correr el
   script y se copian los números nuevos. */
export const SOCIOS: Socio[] = [
  {
    nombre: "GitHub",
    ruta: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    caja: { x: 0, y: 0.3, w: 24, h: 23.41 },
  },
  {
    nombre: "Cloudflare",
    ruta: "M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727",
    caja: { x: 0, y: 6.57, w: 24, h: 10.85 },
    alto: 0.94,
  },
  {
    nombre: "Supabase",
    ruta: "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z",
    caja: { x: 0.3, y: 0, w: 23.39, h: 24 },
  },
  {
    nombre: "Neon",
    ruta: "M24 0V24l-9.365-8.045V24H0V0ZM2.942 21.087h8.751V9.563l9.365 8.204V2.919L2.942 2.914Z",
    caja: { x: 0, y: 0, w: 24, h: 24 },
    alto: 0.82,
  },
  { nombre: "AWS", ruta: "", caja: { x: 0, y: 0, w: 0, h: 0 }, esTexto: true },
  {
    nombre: "Zoho Mail",
    ruta: "M8.66 6.897a1.299 1.299 0 0 0-1.205.765l-.642 1.44-.062-.385A1.291 1.291 0 0 0 5.27 7.648l-4.185.678A1.291 1.291 0 0 0 .016 9.807l.678 4.18a1.293 1.293 0 0 0 1.27 1.087c.074 0 .143-.01.216-.017l4.18-.678c.436-.07.784-.351.96-.723l2.933 1.307a1.304 1.304 0 0 0 .988.026c.321-.12.575-.365.716-.678l.28-.629.038.276a1.297 1.297 0 0 0 1.455 1.103l3.712-.501a1.29 1.29 0 0 0 1.03.514h4.236c.713 0 1.29-.58 1.291-1.291V9.545c0-.712-.58-1.291-1.291-1.291h-4.236c-.079 0-.155.008-.23.022a1.309 1.309 0 0 0-.275-.288c-.275-.21-.614-.3-.958-.253l-4.197.571c-.155.021-.3.07-.432.14L9.159 7.01a1.27 1.27 0 0 0-.499-.113zm-.025.705c.077 0 .159.013.24.052l2.971 1.324c-.128.238-.18.508-.142.782l.357 2.596h.002l-.745 1.672a.59.59 0 0 1-.777.296l-3.107-1.385-.004-.041-.41-2.526L8.1 7.95a.589.589 0 0 1 .536-.348zm-3.159.733c.125 0 .245.039.343.112.13.09.21.227.237.382l.234 1.446-.56 1.259a1.27 1.27 0 0 0-.026.987c.12.322.364.575.678.717l.295.131a.585.585 0 0 1-.428.314l-4.185.678a.59.59 0 0 1-.674-.485l-.678-4.18a.588.588 0 0 1 .485-.674l4.185-.678c.03-.004.064-.01.094-.01zm11.705.09a.59.59 0 0 1 .415.173 1.287 1.287 0 0 0-.416.947v4.237c0 .033.003.065.005.097l-3.55.482a.586.586 0 0 1-.66-.502l-.191-1.403.899-2.017a1.29 1.29 0 0 0-.333-1.5l3.754-.51c.026-.004.051-.004.077-.004zm1.3.532h4.227c.326 0 .588.266.588.588v4.237a.589.589 0 0 1-.588.588h-4.237a.564.564 0 0 1-.12-.013c.47-.246.758-.765.684-1.318zm-5.988.309.254.113c.296.133.43.48.296.777l-.432.97-.207-1.465a.58.58 0 0 1 .09-.395zm5.39.538.453 3.325a.583.583 0 0 1-.453.65zM6.496 11.545l.17 1.052a.588.588 0 0 1-.293-.776zm3.985 4.344a.588.588 0 0 0-.612.603c0 .358.244.61.601.61a.582.582 0 0 0 .607-.608c0-.35-.242-.605-.596-.605zm5.545 0a.588.588 0 0 0-.612.603c0 .358.245.61.602.61a.582.582 0 0 0 .606-.608c0-.35-.24-.605-.596-.605zm-8.537.018a.047.047 0 0 0-.048.047v.085c0 .026.021.047.048.047h.52l-.623.9a.052.052 0 0 0-.009.027v.027c0 .026.021.047.048.047h.815a.047.047 0 0 0 .047-.047v-.085a.047.047 0 0 0-.047-.047h-.55l.606-.9a.05.05 0 0 0 .008-.026v-.028a.047.047 0 0 0-.047-.047zm5.303 0a.047.047 0 0 0-.047.047v1.086c0 .026.02.047.047.047h.135a.047.047 0 0 0 .047-.047v-.454h.545v.454c0 .026.02.047.047.047h.134a.047.047 0 0 0 .047-.047v-1.086a.047.047 0 0 0-.047-.047h-.134a.047.047 0 0 0-.047.047v.453h-.545v-.453a.047.047 0 0 0-.047-.047zm-2.324.164c.25 0 .372.194.372.425 0 .219-.109.425-.358.426-.242 0-.375-.197-.375-.419 0-.235.108-.432.36-.432zm5.545 0c.25 0 .372.194.372.425 0 .219-.108.425-.358.426-.242 0-.374-.197-.374-.419 0-.235.108-.432.36-.432z",
    caja: { x: 0, y: 6.9, w: 24, h: 10.21 },
    alto: 0.94,
  },
  {
    nombre: "Resend",
    ruta: "M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z",
    caja: { x: 0, y: 0, w: 24, h: 24 },
  },
  { nombre: "Qoder", ruta: "", caja: { x: 0, y: 0, w: 0, h: 0 }, esTexto: true },
  { nombre: "nic.ve", ruta: "", caja: { x: 0, y: 0, w: 0, h: 0 }, esTexto: true },
];

/** Alto de tinta del escalón de abajo, en px. Los otros dos valen 26 px
    y 32 px y los fija `landing.css` por posición, leyendo este número
    como referencia: 22 px es el punto donde la fila se lee sin empujar el
    titular, y 32 px es el techo a partir del cual la primera fila le
    discute el protagonismo al resto de la sección. */
export const ALTO_TINTA_PX = 22;
