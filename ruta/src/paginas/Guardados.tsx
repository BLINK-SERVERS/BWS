import { useState } from "react";
import type { Vehiculo } from "../tipos";
import { Icono } from "../componentes/Icono";
import { TarjetaVehiculo } from "../componentes/TarjetaVehiculo";

interface GuardadosProps {
  vehiculos: Vehiculo[];
  guardados: Set<string>;
  gustados: Set<string>;
  onGuardar: (id: string) => void;
  onGustar: (id: string) => void;
}

export function Guardados({ vehiculos, guardados, gustados, onGuardar, onGustar }: GuardadosProps) {
  const [vista, setVista] = useState<"guardados" | "gustados">("guardados");
  const seleccion = vista === "guardados" ? guardados : gustados;
  const resultados = vehiculos.filter((vehiculo) => seleccion.has(vehiculo.id));

  return (
    <div className="pagina guardados">
      <header className="pagina__cabecera"><p className="eyebrow">Tu selección</p><h1>{vista === "guardados" ? "Carros guardados." : "Carros que te gustan."}</h1><p>Vuelve a las publicaciones que quieres revisar con calma.</p></header>
      <div className="tabs" role="tablist" aria-label="Tipo de selección">
        <button className={vista === "guardados" ? "is-active" : ""} type="button" role="tab" aria-selected={vista === "guardados"} onClick={() => setVista("guardados")}><Icono nombre="guardar" tamano={18} />Guardados <span>{guardados.size}</span></button>
        <button className={vista === "gustados" ? "is-active" : ""} type="button" role="tab" aria-selected={vista === "gustados"} onClick={() => setVista("gustados")}><Icono nombre="corazon" tamano={18} />Me gusta <span>{gustados.size}</span></button>
      </div>
      {resultados.length > 0 ? (
        <div className="cuadricula-vehiculos">
          {resultados.map((vehiculo) => <TarjetaVehiculo key={vehiculo.id} vehiculo={vehiculo} guardado={guardados.has(vehiculo.id)} gustado={gustados.has(vehiculo.id)} onGuardar={onGuardar} onGustar={onGustar} />)}
        </div>
      ) : (
        <section className="estado-vacio estado-vacio--pagina">
          <span className="estado-vacio__icono"><Icono nombre={vista === "guardados" ? "guardar" : "corazon"} tamano={34} /></span>
          <h2>{vista === "guardados" ? "Todavía no guardas ningún carro." : "Todavía no has marcado ningún carro."}</h2>
          <p>{vista === "guardados" ? "Pulsa el marcador de una publicación para encontrarla aquí." : "Pulsa el corazón para mostrar interés y volver a ella después."}</p>
          <a className="boton boton--primario" href="#/">Explorar carros</a>
        </section>
      )}
    </div>
  );
}
