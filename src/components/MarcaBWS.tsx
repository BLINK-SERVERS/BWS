import marcaBlink from "../assets/marca-blink-texto.svg?raw";
import { MARCA } from "../lib/contenido";

/* ============================================================
   MarcaBWS — wordmark aprobado (solo texto) + subword tipográfico
   ------------------------------------------------------------
   «Blink» es geometría aprobada y se pinta TAL CUAL, sin el isotipo:
   el master `src/assets/marca-blink.svg` trae dos capas (wordmark y
   rostro), y de aquí se sirve `src/assets/marca-blink-texto.svg`, que
   son los mismos cinco trazos del wordmark, copiados carácter por
   carácter, con la caja recortada a su tinta. Lo genera
   `scripts/generar-marca-texto.mjs`, que compara los `d` con el master
   y sale con error si uno solo difiere — la silueta no se redibuja, se
   recorta el aire. El master sigue intacto en el repo como referencia.

   Al insertarlo en línea se le quitan los `id` — la marca aparece tres
   veces en la página y un `id` duplicado rompe el DOM — y la metadata
   del editor. Ningún `d` se toca.

   «Web Services» NO está vectorizado, y es una decisión declarada: no
   existe geometría aprobada para esas palabras y reinterpretarlas
   violaría la regla de marca. Se compone con la pila de la familia en
   peso 500, que es exactamente el peso con el que `blink-pay.svg`
   declara su «Pay» (SF Pro Display Medium). Alineación por línea base,
   como en los lockups maestros.

   Accesibilidad: el lockup NO lleva `aria-label` en el contenedor. La
   primera versión sí lo llevaba (`aria-label="Blink Web Services"`), y
   axe lo cazó en 390 px con `label-content-name-mismatch` (WCAG 2.1,
   2.5.3 Label in Name): en móvil lo que se ve es «Blink BWS», y el
   nombre accesible tenía que contener lo visible, no el nombre largo.
   Se resuelve dejando que el nombre se calcule del contenido: el SVG
   aprobado ya trae su `<title>Blink</title>` como primer hijo, y el
   subword que no está a la vista está en `display: none`, o sea fuera
   del árbol de accesibilidad. Resultado: «Blink Web Services» en
   escritorio y «Blink BWS» en móvil, cada uno exactamente como se lee.

   El pie es el único sitio donde no hay texto visible al lado: ahí sí
   hace falta el `aria-label`, porque sin él el enlace no diría nada.

   En pantallas de 420 px o menos el subword pasa a la sigla «BWS»
   (`.lp-marca-bws__sub--corto`); la visibilidad la decide el CSS, así
   que aquí se pintan los dos textos.
   ============================================================ */

/** El lockup, listo para insertar en línea sin `id` ni metadata del editor. */
export const MARCA_BLINK = marcaBlink
  .replace(/<\?xml[^>]*\?>/g, "")
  .replace(/\sid="[^"]*"/g, "")
  .replace(/\sxmlns:inkscape="[^"]*"/g, "")
  .replace(/\sinkscape:[a-z-]+="[^"]*"/g, "")
  .trim();

interface Props {
  /** `hero` = lockup grande; `nav` = compacto de barra; `pie` = solo «Blink». */
  variante?: "hero" | "nav" | "pie";
  /** Nombre con el que se anuncia el conjunto, solo para el pie. */
  etiqueta?: string;
}

export function MarcaBWS({ variante = "hero", etiqueta }: Props) {
  if (variante === "pie") {
    return (
      <span
        className="lp-pie__marca"
        role="img"
        aria-label={etiqueta ?? MARCA.nombre}
        dangerouslySetInnerHTML={{ __html: MARCA_BLINK }}
      />
    );
  }

  return (
    <span className={`lp-marca-bws lp-marca-bws--${variante}`}>
      <span
        className="lp-marca-bws__blink"
        dangerouslySetInnerHTML={{ __html: MARCA_BLINK }}
      />
      <span className="lp-marca-bws__sub lp-marca-bws__sub--largo">
        {MARCA.sub}
      </span>
      <span className="lp-marca-bws__sub lp-marca-bws__sub--corto">
        {MARCA.sigla}
      </span>
    </span>
  );
}
