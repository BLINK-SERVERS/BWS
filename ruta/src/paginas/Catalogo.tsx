import { useMemo, useState } from "react";
import type { Filtros, Orden, Vehiculo } from "../tipos";
import { aplicarFiltros, contarFiltros, filtrosIniciales, ordenarVehiculos } from "../datos/filtros";
import { Dialogo } from "../componentes/Dialogo";
import { Icono } from "../componentes/Icono";
import { PanelFiltros } from "../componentes/PanelFiltros";
import { TarjetaVehiculo } from "../componentes/TarjetaVehiculo";

interface CatalogoProps {
  vehiculos: Vehiculo[];
  guardados: Set<string>;
  gustados: Set<string>;
  onGuardar: (id: string) => void;
  onGustar: (id: string) => void;
}

export function Catalogo({ vehiculos, guardados, gustados, onGuardar, onGustar }: CatalogoProps) {
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciales);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const cantidadFiltros = contarFiltros(filtros);

  const resultados = useMemo(() => ordenarVehiculos(aplicarFiltros(vehiculos, filtros), orden), [vehiculos, filtros, orden]);
  const hayBusqueda = filtros.consulta !== "" || cantidadFiltros > 0;

  function limpiar() {
    setFiltros(filtrosIniciales);
  }

  return (
    <div className="pagina catalogo">
      <section className="catalogo__cabecera" aria-labelledby="titulo-catalogo">
        <div>
          <h1 id="titulo-catalogo">Encuentra tu próximo carro.</h1>
          <p>Publicaciones de particulares y concesionarios, con conversación dentro de Car Market.</p>
        </div>
        <a className="boton boton--enfasis catalogo__publicar" href="#/publicar">
          <Icono nombre="publicar" tamano={20} />
          Publicar carro
        </a>
      </section>

      <div className="buscador__campo">
        <label className="buscador__etiqueta" htmlFor="busqueda">Buscar carros</label>
        <form className="buscador" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icono nombre="buscar" />
          <input id="busqueda" type="search" placeholder="Marca, modelo, año o ciudad" autoComplete="off" value={filtros.consulta} onChange={(event) => setFiltros({ ...filtros, consulta: event.target.value })} />
          {filtros.consulta && <button className="boton-icono" type="button" onClick={() => setFiltros({ ...filtros, consulta: "" })} aria-label="Borrar búsqueda"><Icono nombre="cerrar" tamano={19} /></button>}
          <button className={`boton boton--filtro ${cantidadFiltros ? "is-active" : ""}`} type="button" onClick={() => setFiltrosAbiertos(true)} aria-expanded={filtrosAbiertos} aria-label={cantidadFiltros ? `Filtros, ${cantidadFiltros} aplicados` : "Filtros"}>
            <Icono nombre="filtro" tamano={19} />
            <span>Filtros</span>
            {cantidadFiltros > 0 && <span className="contador">{cantidadFiltros}</span>}
          </button>
          <p className="sr-only" role="status">{resultados.length} {resultados.length === 1 ? "publicación encontrada" : "publicaciones encontradas"}</p>
        </form>
      </div>

      <div className="chips" aria-label="Filtrar por tipo de carro">
        {["", "Sedán", "SUV", "Hatchback", "Pickup"].map((tipo) => (
          <button key={tipo || "todos"} className={`chip ${filtros.tipo === tipo ? "is-active" : ""}`} type="button" onClick={() => setFiltros({ ...filtros, tipo })} aria-pressed={filtros.tipo === tipo}>
            {tipo || "Todos"}
          </button>
        ))}
      </div>

      <div className="resultados__cabecera">
        <div>
          <h2>{hayBusqueda ? "Resultados" : "Carros para explorar"}</h2>
          <p>{resultados.length} {resultados.length === 1 ? "publicación" : "publicaciones"} de demostración</p>
        </div>
        <label className="orden">
          <span>Ordenar por</span>
          <select value={orden} onChange={(event) => setOrden(event.target.value as Orden)}>
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Menor precio</option>
            <option value="precio-desc">Mayor precio</option>
            <option value="anio-desc">Año más reciente</option>
            <option value="km-asc">Menor kilometraje</option>
          </select>
        </label>
      </div>

      {hayBusqueda && (
        <div className="resumen-filtros">
          <span><Icono nombre="filtro" tamano={17} />{filtros.consulta ? `“${filtros.consulta}”` : `${cantidadFiltros} ${cantidadFiltros === 1 ? "filtro aplicado" : "filtros aplicados"}`}</span>
          <button type="button" onClick={limpiar}>Quitar búsqueda y filtros</button>
        </div>
      )}

      {resultados.length > 0 ? (
        <div className="cuadricula-vehiculos">
          {resultados.map((vehiculo) => (
            <TarjetaVehiculo key={vehiculo.id} vehiculo={vehiculo} guardado={guardados.has(vehiculo.id)} gustado={gustados.has(vehiculo.id)} onGuardar={onGuardar} onGustar={onGustar} />
          ))}
        </div>
      ) : (
        <section className="estado-vacio" aria-labelledby="sin-resultados">
          <span className="estado-vacio__icono"><Icono nombre="buscar" tamano={34} /></span>
          <h2 id="sin-resultados">No encontramos carros con esos filtros.</h2>
          <p>Prueba ampliar el precio, cambiar la marca o quitar algunos filtros.</p>
          <button className="boton boton--primario" type="button" onClick={limpiar}>Limpiar búsqueda y filtros</button>
        </section>
      )}

      <Dialogo abierto={filtrosAbiertos} titulo="Filtrar carros" descripcion="Los resultados se actualizan mientras eliges." onCerrar={() => setFiltrosAbiertos(false)} variante="hoja" clase="dialogo__panel--filtros">
        <PanelFiltros filtros={filtros} onChange={setFiltros} onAplicar={() => setFiltrosAbiertos(false)} onLimpiar={limpiar} />
      </Dialogo>
    </div>
  );
}
