import type { SVGProps } from "react";

/* ============================================================
   Icono — las cinco geometrías propias del sitio
   ------------------------------------------------------------
   BWS no arrastra la librería de SF Symbols de Pay: necesita seis
   trazos (check, chevron, flecha, ventana, reguladores, maletín) y
   dos de contacto (teléfono, sobre). Todos van sobre la retícula de 24
   con trazo 1,75 y extremos redondos, que es el grosor con el que la
   línea se ve segura a 28–32 px sin engordar el resto de la página.
   La excepción es la burbuja de WhatsApp, que es marca de terceros y
   se entinta tal cual: ver su entrada en `TRAZOS`.

   `fill: none` y el color por `currentColor` (regla `.icon` en
   base.css): el icono siempre toma el color del texto que acompaña,
   así en la sección oscura sale blanco sin declararlo.

   El chevron apunta a la derecha cerrado; `landing.css` lo gira 90°
   al abrir, que es el gesto de la referencia de Apple.
   ============================================================ */

export type NombreIcono =
  | "check"
  | "chevron"
  | "flecha"
  | "pagina"
  | "app"
  | "portafolio"
  | "whatsapp"
  | "telefono"
  | "correo";

/** Cada trazado se pinta con `stroke` salvo donde se indique relleno. */
const TRAZOS: Record<NombreIcono, string[]> = {
  check: ["M5 12.6 10 17.6 19.2 6.9"],

  chevron: ["M9.6 5.4 16.2 12l-6.6 6.6"],

  flecha: ["M4.4 12h13.8", "M12.6 6.6 18.2 12l-5.6 5.4"],

  // Ventana de navegador: marco, barra superior y dos puntos.
  pagina: [
    "M3.4 7.2A2.8 2.8 0 0 1 6.2 4.4h11.6a2.8 2.8 0 0 1 2.8 2.8v9.6a2.8 2.8 0 0 1-2.8 2.8H6.2a2.8 2.8 0 0 1-2.8-2.8z",
    "M3.4 9h17.2",
    "M6.7 6.7h.01",
    "M9.4 6.7h.01",
  ],

  // Reguladores: la operación de un negocio se ajusta, no se reescribe.
  app: [
    "M4 8h7.2",
    "M16.6 8h3.4",
    "M4 16h3.4",
    "M12.8 16h7.2",
    "M14.6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
    "M10.8 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  ],

  // Maletín: el portafolio de alguien que trabaja de lo suyo.
  portafolio: [
    "M3.6 9.6A2.2 2.2 0 0 1 5.8 7.4h12.4a2.2 2.2 0 0 1 2.2 2.2v7.8a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2z",
    "M9 7.4V6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6v1.4",
    "M3.6 13h16.8",
  ],

  /* La burbuja de WhatsApp NO es un dibujo propio: es el trazado
     oficial, vendorizado desde `cdn.simpleicons.org/whatsapp` el
     2026-11-09 y copiado aquí literal, sin tocar un número. Es la
     única marca de terceros que aparece fuera de la banda de aliados,
     y aparece porque el botón promete un canal concreto: el recognizable
     del glifo es lo que hace escaneable la fila de contacto. Un trazo
     aproximado —el que estaba antes— se lee como «un globo» y no como
     WhatsApp, que es peor que no poner nada.

     Va rellena (`RELLLENOS`), porque el glifo oficial es un compuesto
     de anillo + auricular: entintado es como conserva la silueta. */
  whatsapp: [
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  ],

  telefono: [
    "M5.6 3.6h2.6c.6 0 1.1.4 1.3 1l.7 2.5c.1.5 0 1-.4 1.3l-1.3 1a11.5 11.5 0 0 0 5.1 5.1l1-1.3c.3-.4.8-.5 1.3-.4l2.5.7c.6.2 1 .7 1 1.3v2.6c0 .8-.7 1.5-1.5 1.4C10.4 19.4 4.6 13.6 4.2 5.1a1.4 1.4 0 0 1 1.4-1.5z",
  ],

  correo: [
    "M3.6 7a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z",
    "M4.2 7.6 12 13l7.8-5.4",
  ],
};

interface Props extends SVGProps<SVGSVGElement> {
  nombre: NombreIcono;
  /** Solo decorativo, que es el caso del sitio: el texto de al lado ya
      dice lo que hay que decir. Con `true` se saca del lector de pantalla. */
  oculto?: boolean;
}

/* Los glifos compuestos de terceros se entintan; el resto se traza. La
   regla `.icon--relleno` de base.css apaga el trazo y enciende el relleno
   sobre el mismo `currentColor`, así que el color sigue viniendo del texto. */
const RELLENOS = new Set<NombreIcono>(["whatsapp"]);

export function Icono({ nombre, oculto = true, className = "", ...resto }: Props) {
  const relleno = RELLENOS.has(nombre);
  return (
    <svg
      className={`icon${relleno ? " icon--relleno" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      aria-hidden={oculto || undefined}
      focusable="false"
      {...resto}
    >
      {TRAZOS[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
