import type { Vehiculo } from "../tipos";
import { formatearKilometraje, formatearPrecio } from "../datos/filtros";
import { Icono } from "./Icono";

interface TarjetaVehiculoProps {
  vehiculo: Vehiculo;
  guardado: boolean;
  gustado: boolean;
  onGuardar: (id: string) => void;
  onGustar: (id: string) => void;
}

function tiempoPublicado(dias: number): string {
  if (dias === 1) return "Hace 1 h";
  if (dias <= 3) return `Hace ${dias} h`;
  if (dias <= 6) return `Hace ${dias - 3} días`;
  return "Ayer";
}

export function TarjetaVehiculo({ vehiculo, guardado, gustado, onGuardar, onGustar }: TarjetaVehiculoProps) {
  const foto = vehiculo.fotos[0];
  const titulo = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;

  return (
    <article className="tarjeta-vehiculo">
      <div className="tarjeta-vehiculo__media">
        <a href={`#/auto/${vehiculo.id}`} aria-label={`Ver ${titulo}`}>
          <img src={foto.src} srcSet={foto.srcSet} sizes="(max-width: 600px) 100vw, (max-width: 840px) 50vw, 33vw" alt={foto.alt} loading="lazy" decoding="async" />
        </a>
        {vehiculo.esNuevo && <span className="etiqueta etiqueta--nuevo">Nuevo</span>}
        <button className={`boton-icono boton-icono--flotante ${guardado ? "is-active" : ""}`} type="button" onClick={() => onGuardar(vehiculo.id)} aria-pressed={guardado} aria-label={guardado ? `Quitar ${titulo} de guardados` : `Guardar ${titulo}`}>
          <Icono nombre="guardar" />
        </button>
        <span className="tarjeta-vehiculo__fotos"><Icono nombre="imagen" tamano={15} />{vehiculo.fotos.length}</span>
      </div>

      <div className="tarjeta-vehiculo__cuerpo">
        <div className="tarjeta-vehiculo__precio">
          <a href={`#/auto/${vehiculo.id}`}><strong>{formatearPrecio(vehiculo.precio)}</strong></a>
          <button className={`boton-icono boton-icono--gusto ${gustado ? "is-active" : ""}`} type="button" onClick={() => onGustar(vehiculo.id)} aria-pressed={gustado} aria-label={gustado ? `Quitar me gusta a ${titulo}` : `Dar me gusta a ${titulo}`}>
            <Icono nombre="corazon" tamano={21} />
          </button>
        </div>
        <h3><a href={`#/auto/${vehiculo.id}`}>{titulo}</a></h3>
        <div className="tarjeta-vehiculo__datos" aria-label="Datos del vehículo">
          <span>{vehiculo.anio}</span>
          <span>{formatearKilometraje(vehiculo.kilometraje)}</span>
          <span>{vehiculo.transmision}</span>
        </div>
        <p className="tarjeta-vehiculo__ubicacion"><Icono nombre="ubicacion" tamano={17} />{vehiculo.ciudad} · {vehiculo.sector}</p>
        <div className="tarjeta-vehiculo__vendedor">
          <span className="avatar avatar--pequeno">{vehiculo.vendedor.iniciales}</span>
          <span className="tarjeta-vehiculo__nombre">{vehiculo.vendedor.nombre}</span>
          {vehiculo.vendedor.verificado && <span className="verificado" title="Identidad verificada"><Icono nombre="verificado" tamano={17} /><span className="sr-only">Identidad verificada</span></span>}
          <time>{tiempoPublicado(vehiculo.publicadoEn)}</time>
        </div>
      </div>
    </article>
  );
}
