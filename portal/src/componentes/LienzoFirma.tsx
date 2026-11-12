/* ============================================================
   Lienzo de firma
   ------------------------------------------------------------
   Canvas de trazo único que comparten la firma del cliente y la
   captura del representante de Blink. Guarda los trazos para
   deshacer y para redibujar si cambia el ancho, y escala por
   densidad de píxeles. El PNG se pide al componente con `png()`.

   El trazo se captura en un lienzo lógico de tamaño fijo, con una
   línea de guía del ancho de la línea impresa en los documentos.
   La guía es solo una referencia: la firma puede pasar por debajo,
   como en el papel. El PNG sale con el lienzo completo y el PDF
   apoya la guía sobre la línea impresa, así que todas las firmas
   llegan con la misma proporción y posición.

   Quien no pueda dibujar con el puntero tiene la firma en papel
   como alternativa; este lienzo no la sustituye.
   ============================================================ */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

type Punto = { x: number; y: number };

/** Lienzo lógico: el mismo en cualquier pantalla y en el PNG. */
const ANCHO = 720;
const ALTO = 200;
/** Línea de guía: coincide con la línea de firma de los documentos. */
const LINEA = 120;
const MARGEN_LINEA = 18;

function pintar(contexto: CanvasRenderingContext2D, trazos: Punto[][]) {
  contexto.strokeStyle = "#111";
  contexto.fillStyle = "#111";
  contexto.lineWidth = 2.4;
  contexto.lineCap = "round";
  contexto.lineJoin = "round";
  for (const trazo of trazos) {
    if (trazo.length === 1) {
      contexto.beginPath();
      contexto.arc(trazo[0].x, trazo[0].y, 1.1, 0, Math.PI * 2);
      contexto.fill();
      continue;
    }
    contexto.beginPath();
    trazo.forEach((punto, indice) => {
      if (indice === 0) contexto.moveTo(punto.x, punto.y);
      else contexto.lineTo(punto.x, punto.y);
    });
    contexto.stroke();
  }
}

function guia(contexto: CanvasRenderingContext2D) {
  contexto.save();
  contexto.strokeStyle = "#c3c7cd";
  contexto.lineWidth = 1;
  contexto.beginPath();
  contexto.moveTo(MARGEN_LINEA, LINEA);
  contexto.lineTo(ANCHO - MARGEN_LINEA, LINEA);
  contexto.stroke();
  contexto.fillStyle = "#8b9199";
  contexto.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  contexto.fillText("Firma", MARGEN_LINEA, LINEA - 8);
  contexto.restore();
}

export interface LienzoFirmaHandle {
  png: () => string | null;
  deshacer: () => void;
  borrar: () => void;
}

export const LienzoFirma = forwardRef<
  LienzoFirmaHandle,
  {
    habilitado: boolean;
    alCambiar?: (tieneTrazo: boolean) => void;
    velo?: string;
  }
>(function LienzoFirma({ habilitado, alCambiar, velo }, ref) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const trazos = useRef<Punto[][]>([]);
  const dibujando = useRef(false);

  const redibujar = useCallback(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.clearRect(0, 0, ANCHO, ALTO);
    guia(contexto);
    pintar(contexto, trazos.current);
  }, []);

  const ajustar = useCallback(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const densidad = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(ANCHO * densidad);
    canvas.height = Math.round(ALTO * densidad);
    const contexto = canvas.getContext("2d");
    if (contexto) contexto.setTransform(densidad, 0, 0, densidad, 0, 0);
    redibujar();
  }, [redibujar]);

  useEffect(() => {
    ajustar();
    const observador = new ResizeObserver(() => ajustar());
    if (lienzo.current) observador.observe(lienzo.current);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, [ajustar]);

  const borrar = useCallback(() => {
    trazos.current = [];
    redibujar();
    alCambiar?.(false);
  }, [redibujar, alCambiar]);

  useImperativeHandle(
    ref,
    () => ({
      png: () => {
        const canvas = lienzo.current;
        if (!canvas) return null;
        // Se exporta el lienzo completo: lo que baja de la guía también
        // viaja al PDF, que apoya la guía al 60 % del alto de la imagen.
        const salida = document.createElement("canvas");
        salida.width = canvas.width;
        salida.height = canvas.height;
        const contexto = salida.getContext("2d");
        if (!contexto) return canvas.toDataURL("image/png");
        contexto.setTransform(
          canvas.width / ANCHO,
          0,
          0,
          canvas.height / ALTO,
          0,
          0,
        );
        pintar(contexto, trazos.current);
        return salida.toDataURL("image/png");
      },
      deshacer: () => {
        trazos.current.pop();
        redibujar();
        alCambiar?.(trazos.current.length > 0);
      },
      borrar,
    }),
    [redibujar, borrar, alCambiar],
  );

  const punto = (evento: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const rect = evento.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(ANCHO, Math.max(0, ((evento.clientX - rect.left) / rect.width) * ANCHO)),
      y: Math.min(ALTO, Math.max(0, ((evento.clientY - rect.top) / rect.height) * ALTO)),
    };
  };

  const bajar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!habilitado) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    dibujando.current = true;
    trazos.current.push([punto(evento)]);
    alCambiar?.(true);
    redibujar();
  };

  const mover = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !habilitado) return;
    const trazo = trazos.current.at(-1);
    if (!trazo) return;
    trazo.push(punto(evento));
    redibujar();
  };

  const subir = () => {
    dibujando.current = false;
  };

  return (
    <div className={habilitado ? "po-lienzo-marco" : "po-lienzo-marco po-lienzo-apagado"}>
      <canvas
        ref={lienzo}
        className="po-lienzo"
        aria-label="Área para dibujar la firma sobre la línea de guía, arriba o abajo de ella"
        role="img"
        aria-disabled={!habilitado}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={subir}
        onPointerCancel={subir}
        onPointerLeave={subir}
      >
        Tu navegador no permite dibujar aquí. La firma en papel sigue disponible.
      </canvas>
      {!habilitado && velo ? <p className="po-lienzo-velo">{velo}</p> : null}
    </div>
  );
});
