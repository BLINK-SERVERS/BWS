import type { Filtros } from "../tipos";
import { filtrosIniciales } from "../datos/filtros";
import { marcas, modelosPorMarca } from "../datos/vehiculos";
import { Icono } from "./Icono";

interface PanelFiltrosProps {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  onAplicar: () => void;
  onLimpiar: () => void;
}

export function PanelFiltros({ filtros, onChange, onAplicar, onLimpiar }: PanelFiltrosProps) {
  const modelos = filtros.marca ? modelosPorMarca(filtros.marca) : [];
  const cambiar = (clave: keyof Filtros, valor: string | boolean) => onChange({ ...filtros, [clave]: valor });

  return (
    <div className="filtros">
      <div className="filtros__cuerpo">
        <div className="filtros__grupo">
          <h3>Vehículo</h3>
          <div className="campos-2">
            <label className="campo">
              <span>Marca</span>
              <select value={filtros.marca} onChange={(event) => onChange({ ...filtros, marca: event.target.value, modelo: "" })}>
                <option value="">Todas las marcas</option>
                {marcas.map((marca) => <option key={marca} value={marca}>{marca}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Modelo</span>
              <select value={filtros.modelo} onChange={(event) => cambiar("modelo", event.target.value)} disabled={!filtros.marca}>
                <option value="">{filtros.marca ? "Todos los modelos" : "Elige una marca"}</option>
                {modelos.map((modelo) => <option key={modelo} value={modelo}>{modelo}</option>)}
              </select>
            </label>
          </div>
          <div className="campos-2">
            <label className="campo">
              <span>Tipo de carro</span>
              <select value={filtros.tipo} onChange={(event) => cambiar("tipo", event.target.value)}>
                <option value="">Todos</option>
                {["Sedán", "SUV", "Hatchback", "Pickup"].map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Condición</span>
              <select value={filtros.condicion} onChange={(event) => cambiar("condicion", event.target.value)}>
                <option value="">Cualquiera</option>
                {["Excelente", "Muy buena", "Buena"].map((condicion) => <option key={condicion} value={condicion}>{condicion}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="filtros__grupo">
          <h3>Precio y año</h3>
          <div className="campos-2">
            <label className="campo">
              <span>Precio mínimo</span>
              <div className="campo__prefijo"><span>$</span><input type="number" min="0" step="100" inputMode="numeric" placeholder="0" value={filtros.precioMin} onChange={(event) => cambiar("precioMin", event.target.value)} /></div>
            </label>
            <label className="campo">
              <span>Precio máximo</span>
              <div className="campo__prefijo"><span>$</span><input type="number" min="0" step="100" inputMode="numeric" placeholder="Sin límite" value={filtros.precioMax} onChange={(event) => cambiar("precioMax", event.target.value)} /></div>
            </label>
          </div>
          <div className="campos-2">
            <label className="campo">
              <span>Año desde</span>
              <input type="number" min="1950" max="2027" inputMode="numeric" placeholder="2010" value={filtros.anioMin} onChange={(event) => cambiar("anioMin", event.target.value)} />
            </label>
            <label className="campo">
              <span>Año hasta</span>
              <input type="number" min="1950" max="2027" inputMode="numeric" placeholder="2026" value={filtros.anioMax} onChange={(event) => cambiar("anioMax", event.target.value)} />
            </label>
          </div>
          <label className="campo">
            <span>Kilometraje máximo</span>
            <input type="number" min="0" step="1000" inputMode="numeric" placeholder="Ej. 100.000" value={filtros.kmMax} onChange={(event) => cambiar("kmMax", event.target.value)} />
          </label>
        </div>

        <div className="filtros__grupo">
          <h3>Ubicación y vendedor</h3>
          <label className="campo">
            <span>Ciudad</span>
            <select value={filtros.ciudad} onChange={(event) => cambiar("ciudad", event.target.value)}>
              <option value="">Todas las ciudades</option>
              <option value="Maracaibo">Maracaibo</option>
              <option value="San Francisco">San Francisco</option>
            </select>
          </label>
          <label className="campo">
            <span>Vendedor</span>
            <select value={filtros.vendedor} onChange={(event) => cambiar("vendedor", event.target.value)}>
              <option value="">Particular o concesionario</option>
              <option value="Particular">Particular</option>
              <option value="Concesionario">Concesionario</option>
            </select>
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={filtros.verificado} onChange={(event) => cambiar("verificado", event.target.checked)} />
            <span className="interruptor__pista"><span /></span>
            <span><strong>Sólo identidad verificada</strong><small>Vendedores con KYC aprobado</small></span>
          </label>
        </div>

        <div className="filtros__grupo">
          <h3>Detalles</h3>
          <div className="campos-2">
            <label className="campo">
              <span>Combustible</span>
              <select value={filtros.combustible} onChange={(event) => cambiar("combustible", event.target.value)}>
                <option value="">Cualquiera</option>
                {["Gasolina", "Diésel", "Híbrido"].map((combustible) => <option key={combustible} value={combustible}>{combustible}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Transmisión</span>
              <select value={filtros.transmision} onChange={(event) => cambiar("transmision", event.target.value)}>
                <option value="">Cualquiera</option>
                <option value="Automática">Automática</option>
                <option value="Manual">Manual</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <footer className="filtros__acciones">
        <button className="boton boton--secundario" type="button" onClick={onLimpiar} disabled={JSON.stringify(filtros) === JSON.stringify(filtrosIniciales)}>
          Limpiar
        </button>
        <button className="boton boton--primario" type="button" onClick={onAplicar}>
          <Icono nombre="filtro" tamano={19} />
          Ver resultados
        </button>
      </footer>
    </div>
  );
}
