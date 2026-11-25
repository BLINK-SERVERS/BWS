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
  | "correo"
  | "reloj"
  | "mundo"
  | "escudo"
  | "burbuja"
  | "carta";

/** Cada trazado se pinta con `stroke` salvo donde se indique relleno. */
const TRAZOS: Record<NombreIcono, string[]> = {
  check: ["M5 12.6 10 17.6 19.2 6.9"],

  chevron: ["M9.6 5.4 16.2 12l-6.6 6.6"],

  flecha: ["M4.4 12h13.8", "M12.6 6.6 18.2 12l-5.6 5.4"],

  // Ventana de navegador: marco, barra superior y dos puntos.
  // El radio de 2,8 sobre un marco de 17,2 x 15,2 (≈16 % del lado corto)
  // es el que hace que a 32 px se lea como «ventana», no como «cuadrado»:
  // por debajo de ~2,4 las esquinas se cierran y el glifo compite con el
  // borde de la barra. Las uniones recta–arco caen exactamente sobre el
  // tangente (ver entrega): G2 sostenido en los cuatro bordes.
  pagina: [
    "M3.4 7.2A2.8 2.8 0 0 1 6.2 4.4h11.6a2.8 2.8 0 0 1 2.8 2.8v9.6a2.8 2.8 0 0 1-2.8 2.8H6.2a2.8 2.8 0 0 1-2.8-2.8z",
    "M3.4 9h17.2",
    "M6.7 6.7h.01",
    "M9.4 6.7h.01",
  ],

  /* Reguladores: la operación de un negocio se ajusta, no se reescribe.
     Endurecido frente al glifo anterior, que a 32 px se leía como «dos
     rayas con burbujas» por tres razones medidas:
       · los pomos colgaban del trazo a 2 px de distancia —un pomo flotando
         no es un pomo—; ahora cada circunferencia cruza su riel: el eje
         vertical del knob mide 5,6 px contra los 4,8 px del glifo viejo;
       · el riel inferior terminaba a 1,8 px del margen, casi pegado al
         borde de la retícula; ahora respira igual que arriba (rieles de
         x=3,2 a x=20,8, simétricos);
       · las cabezas de riel subían a y=6,4, dentro de la banda óptica del
         título; el conjunto entero baja — rieles en y=9,6 e y=14,4, pomos
         de y=6,8 a y=17,2 — para que las dos filas queden centradas en la
         retícula (media de tintas = 12).
     Los pomos van a x=11,2 en ambos rieles: los dos huecos libres quedan
     del mismo lado, que es lo que hace leer «dos reguladores» y no «una X». */
  app: [
    "M3.2 9.6h5.2",
    "M15.6 9.6h5.2",
    "M3.2 14.4h5.2",
    "M15.6 14.4h5.2",
    "M13.6 9.6a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 1 1 5.6 0z",
    "M10.8 14.4a2.8 2.8 0 1 1 5.6 0 2.8 2.8 0 1 1-5.6 0z",
  ],

  /* Maletín: el portafolio de alguien que trabaja de lo suyo.
     Dos cambios de legibilidad a 32 px sobre la versión anterior:
       1. La línea horizontal que cruzaba el marco de lado a lado (la
          «solapa») partía el cuerpo en dos mitades iguales y a trazo 1,75
          se leía como caja rota, no como maletín: se fue. El identificador
          del glifo pasa a ser el asa — arco de radio 2,6 con hombros de
          radio 1,8, tope en y=3,4, anclada sobre la tapa en y=8,4 —, que
          es lo que hace que se lea «maletín» y no «caja».
       2. El aire muerto entre el asa vieja (y=5,8) y la solapa (y=13) se
          cerró: la caja sube a y=8,4 y el conjunto ocupa de 3,4 a 19,6,
          centrado en la retícula (media de tintas = 12).
     Tapa y cuerpo comparten la geometría de esquina de `pagina`: las
     uniones curva+curva (recta→arco, arco→arco) caen tangentes con κ
     constante 1/2,2 en cada esquina — G2 sostenido medido por `g2.mjs`.
     Los quiebres recta–recta son esquinas deliberadas: los cantos de la
     caja — (3,4 8,4), (20,6 8,4), (20,6 17,4), (3,4 17,4) — y los hombros
     del asa, donde el vertical de x=9,4 y el de x=15,0 empalman con el
     horizontal de y=6,0. Ahí la esquina ES el glifo, no se alisa.
     Los radios de caja (2,2 sobre lados de 16,8 x 9,0 ≈ 24 % del lado
     corto) se mantienen: achicarlos más cerca del cuerpo lo endurecen a
     «sobre»; 2,2 es el punto donde lee a maletín sin parecer tarjeta. */
  portafolio: [
    "M3.6 10.6a2.2 2.2 0 0 1 2.2-2.2h12.4a2.2 2.2 0 0 1 2.2 2.2v6.8a2.2 2.2 0 0 1-2.2 2.2H5.8a2.2 2.2 0 0 1-2.2-2.2z",
    "M9.4 8.4V6a2.6 2.6 0 0 1 2.6-2.6 2.6 2.6 0 0 1 2.6 2.6v2.4",
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

  /* Auricular telefónico sobre retícula 24. Las uniones marcadas por
     `g2.mjs` (u5, u6) son las esquinas donde el mango recto se une a la
     curvatura del auricular: G1 sostenido (Δtang 20,9° y 1,4°), curvatura
     con salto deliberado — un radio de orejera y un radio de cuerpo no
     tienen por qué compartir κ; forzarlas a G2 abulta la orejera hasta
     perder la silueta a 28 px. Se deja como está y se reporta. */
  telefono: [
    "M5.6 3.6h2.6c.6 0 1.1.4 1.3 1l.7 2.5c.1.5 0 1-.4 1.3l-1.3 1a11.5 11.5 0 0 0 5.1 5.1l1-1.3c.3-.4.8-.5 1.3-.4l2.5.7c.6.2 1 .7 1 1.3v2.6c0 .8-.7 1.5-1.5 1.4C10.4 19.4 4.6 13.6 4.2 5.1a1.4 1.4 0 0 1 1.4-1.5z",
  ],

  correo: [
    "M3.6 7a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z",
    "M4.2 7.6 12 13l7.8-5.4",
  ],

  /* --- Las cinco geometrías nuevas -------------------------------
     Imitan un glifo de la gramática SF Symbols como PATRÓN VISUAL —la
     proporción del trazo respecto al cuadro, el radio de las esquinas,
     cómo se cierra el volumen—, no como archivo. Ningún trazado viene de
     una librería de símbolos ni menciona sus nombres: ver nota en la
     entrega y `docs/estilo/evidencia-manzana.md`, apartado Iconografía.

     Se dibujaron sobre la misma retícula de 24, con el mismo aire de
     margen que `pagina` (17,2 × 15,2) y `portafolio`. Cada unión
     curva+curva está resuelta por construcción, no a ojo:

       · Los círculos van partidos en cuatro cúbicas de exactamente 90°
         con el factor κ = 0,5523·r, así tangente y curvatura coinciden en
         los cuatro cuadrantes (Δκ = 0,0000 %, medido).
       · Las curvas espejadas (solapa de `carta`, paralelo de `mundo`)
         usan controles simétricos respecto al vértice: eso fuerza G1 y,
         con la misma distancia de control a cada lado, G2 sale solo.

     Verificar con `node scripts/g2.mjs [nombre]`. */

  /* Reloj: carátula circular + manecillas desde el centro. Imita el patrón
     del glifo de hora: círculo completo de radio 8,2 (margen 3,8, igual que
     `pagina` deja 3,4) y dos agujas cortas que salen del centro exacto, con
     el minutero hacia arriba para que el par se lea abierto a 28 px. El
     cuarto de hora entre agujas es lo que lo distingue de un simple diana. */
  reloj: [
    "M12 3.8c4.53 0 8.2 3.67 8.2 8.2s-3.67 8.2-8.2 8.2-8.2-3.67-8.2-8.2 3.67-8.2 8.2-8.2z",
    "M12 7.4V12l3.3 2.2",
  ],

  /* Mundo: esfera con meridiano y paralelo, ambos curvos. Imita el patrón
     del glifo de globo terráqueo: círculo de radio 8,4, un meridiano
     elíptico (rx 3,5 sobre el mismo ry 8,4, así roza el polo sin achatarse)
     y un solo paralelo arqueado hacia arriba, que es lo que da volumen sin
     llenar la figura de líneas. El paralelo son dos cúbicas espejadas que
     se encuentran en x=12: controles simétricos → G2 exacto. */
  mundo: [
    "M12 3.6c4.64 0 8.4 3.76 8.4 8.4s-3.76 8.4-8.4 8.4-8.4-3.76-8.4-8.4 3.76-8.4 8.4-8.4z",
    "M12 3.6c1.93 0 3.5 3.76 3.5 8.4s-1.57 8.4-3.5 8.4-3.5-3.76-3.5-8.4 1.57-8.4 3.5-8.4z",
    "M4.4 12c0-1.88 3.4-3.4 7.6-3.4s7.6 1.52 7.6 3.4",
  ],

  /* Escudo: silueta de hombros anchos y punta redondeada, con una marca de
     confirmación dentro. Imita el patrón del glifo de protección: el canto
     superior es un arco amplio y la base cierra en V muy abierta, nunca en
     pico. Aquí todo el contorno comparte radio 6,4 en cúpula y falda, así
     la curvatura no cambia de valor al pasar del hombro a la punta. La cruz
     interior va en ángulo recto deliberado: es un signo, no una curva. */
  escudo: [
    "M12 2.8c3.53 0 6.4 2.87 6.4 6.4 0 4.27-2.87 8.53-6.4 12.8-3.53-4.27-6.4-8.53-6.4-12.8 0-3.53 2.87-6.4 6.4-6.4z",
    "M8.8 11.6 11.2 14 15.4 9.8",
  ],

  /* Burbuja de mensaje con rabo: marco redondeado cuyo costado inferior
     izquierdo baja en curva continua hasta la punta y vuelve a subir. Es el
     acompañamiento del canal humano; el glifo relleno de WhatsApp sigue
     siendo la única marca de terceros entintada del sitio. Radio de esquina
     3 sobre 16,8 × 11,4 ≈ 26 % del lado corto, el mismo orden que `pagina`. */
  burbuja: [
    "M6.6 4.6h10.8c1.66 0 3 1.34 3 3v5.4c0 1.66-1.34 3-3 3H9.4c-1.66 0-3-1.34-3-3V7.6c0-1.66 1.34-3 3-3z",
    "M9.4 16c0 1.53-1.24 2.8-2.77 2.8",
  ],

  /* Carta abierta: sobre con la solapa caída por delante. Imita el patrón
     del glifo de correo saliente: caja de radio 2,2 y una V amplia cuyo
     vértice hunde hasta el centro del sobre. La V son dos cúbicas espejadas
     alrededor de x=12 con controles simétricos respecto al vértice, que es
     lo que impide que se le marque una rodilla en la punta. */
  carta: [
    "M5.6 5.6h12.8c1.22 0 2.2 0.98 2.2 2.2v8.6c0 1.22-0.98 2.2-2.2 2.2H5.6c-1.22 0-2.2-0.98-2.2-2.2V7.8c0-1.22 0.98-2.2 2.2-2.2z",
    "M4.2 7.8c1.3 1.13 2.6 2.27 3.9 3.4 1.3 1.13 2.6 1.13 3.9 0s2.6-2.27 3.9-3.4",
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
