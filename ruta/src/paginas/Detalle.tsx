import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Vehiculo } from "../tipos";
import { formatearKilometraje, formatearPrecio } from "../datos/filtros";
import { Dialogo } from "../componentes/Dialogo";
import { Icono } from "../componentes/Icono";
import { TarjetaVehiculo } from "../componentes/TarjetaVehiculo";

interface DetalleProps {
  vehiculo?: Vehiculo;
  similares: Vehiculo[];
  guardados: Set<string>;
  gustados: Set<string>;
  onGuardar: (id: string) => void;
  onGustar: (id: string) => void;
  onChatear: (vehiculoId: string) => void;
  onAviso: (mensaje: string) => void;
}

export function Detalle({ vehiculo, similares, guardados, gustados, onGuardar, onGustar, onChatear, onAviso }: DetalleProps) {
  const [fotoActiva, setFotoActiva] = useState(0);
  const [zoomAbierto, setZoomAbierto] = useState(false);
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [cierreSolicitado, setCierreSolicitado] = useState(false);
  const [reporteAbierto, setReporteAbierto] = useState(false);

  useEffect(() => {
    setFotoActiva(0);
    setZoomAbierto(false);
    setCierreAbierto(false);
    setCierreSolicitado(false);
    setReporteAbierto(false);
  }, [vehiculo?.id]);

  const totalFotos = vehiculo?.fotos.length ?? 0;

  useEffect(() => {
    if (!zoomAbierto || totalFotos === 0) return;
    function moverFoto(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setFotoActiva((actual) => (actual + 1) % totalFotos);
      if (event.key === "ArrowLeft") setFotoActiva((actual) => (actual - 1 + totalFotos) % totalFotos);
    }
    window.addEventListener("keydown", moverFoto);
    return () => window.removeEventListener("keydown", moverFoto);
  }, [zoomAbierto, totalFotos]);

  if (!vehiculo) {
    return (
      <section className="estado-vacio estado-vacio--pagina">
        <span className="estado-vacio__icono"><Icono nombre="info" tamano={34} /></span>
        <h1>No encontramos esa publicación.</h1>
        <p>Puede que el vendedor la haya retirado o que el enlace esté incompleto.</p>
        <a className="boton boton--primario" href="#/">Volver a explorar</a>
      </section>
    );
  }

  const foto = vehiculo.fotos[fotoActiva];
  const titulo = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;
  const guardado = guardados.has(vehiculo.id);
  const gustado = gustados.has(vehiculo.id);

  function cambiarFoto(direccion: number) {
    setFotoActiva((actual) => (actual + direccion + totalFotos) % totalFotos);
  }

  async function compartir() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onAviso("Enlace copiado.");
    } catch {
      onAviso("No pudimos copiar el enlace. Cópialo desde la barra del navegador.");
    }
  }

  function solicitarCierre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCierreSolicitado(true);
    setCierreAbierto(false);
    onAviso("Cierre registrado en este prototipo. El envío al vendedor se conectará al backend.");
  }

  return (
    <div className="pagina detalle">
      <nav className="migas" aria-label="Ruta de navegación">
        <a href="#/"><Icono nombre="flecha-izquierda" tamano={17} />Explorar</a>
        <span>/</span>
        <span>{vehiculo.marca} {vehiculo.modelo}</span>
      </nav>

      <div className="detalle__principal">
        <section className="galeria" aria-label={`Galería de ${titulo}`}>
          <div className="galeria__principal">
            <button type="button" onClick={() => setZoomAbierto(true)} aria-label={`Ampliar foto ${fotoActiva + 1} de ${vehiculo.fotos.length}`}>
              <img src={foto.src} srcSet={foto.srcSet} sizes="(max-width: 840px) 100vw, 60vw" alt={foto.alt} />
            </button>
            <span className="galeria__contador"><Icono nombre="imagen" tamano={16} />{fotoActiva + 1} / {vehiculo.fotos.length}</span>
            <button className="boton-icono boton-icono--flotante galeria__expandir" type="button" onClick={() => setZoomAbierto(true)} aria-label="Ampliar galería"><Icono nombre="expandir" /></button>
            {vehiculo.fotos.length > 1 && (
              <div className="galeria__flechas">
                <button className="boton-icono boton-icono--flotante" type="button" onClick={() => cambiarFoto(-1)} aria-label="Foto anterior"><Icono nombre="flecha-izquierda" /></button>
                <button className="boton-icono boton-icono--flotante" type="button" onClick={() => cambiarFoto(1)} aria-label="Foto siguiente"><Icono nombre="flecha-derecha" /></button>
              </div>
            )}
          </div>
          {vehiculo.fotos.length > 1 && (
            <div className="galeria__miniaturas" aria-label="Elegir foto">
              {vehiculo.fotos.map((miniatura, indice) => (
                <button key={miniatura.src} className={indice === fotoActiva ? "is-active" : ""} type="button" onClick={() => setFotoActiva(indice)} aria-pressed={indice === fotoActiva} aria-label={`Ver foto ${indice + 1}`}>
                  <img src={miniatura.src} srcSet={miniatura.srcSet} sizes="120px" alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="detalle__resumen" aria-labelledby="titulo-vehiculo">
          <div className="detalle__insignias">
            {vehiculo.esNuevo && <span className="etiqueta etiqueta--nuevo">Nuevo</span>}
            {vehiculo.vendedor.verificado && <span className="etiqueta etiqueta--verificado"><Icono nombre="verificado" tamano={16} />Vendedor verificado</span>}
          </div>
          <h1 id="titulo-vehiculo">{titulo}</h1>
          <p className="detalle__precio">{formatearPrecio(vehiculo.precio)}</p>
          <p className="detalle__ubicacion"><Icono nombre="ubicacion" />{vehiculo.ciudad}, sector {vehiculo.sector}</p>

          <dl className="detalle__datos">
            <div><dt>Año</dt><dd>{vehiculo.anio}</dd></div>
            <div><dt>Kilometraje</dt><dd>{formatearKilometraje(vehiculo.kilometraje)}</dd></div>
            <div><dt>Transmisión</dt><dd>{vehiculo.transmision}</dd></div>
            <div><dt>Combustible</dt><dd>{vehiculo.combustible}</dd></div>
            <div><dt>Carrocería</dt><dd>{vehiculo.tipo}</dd></div>
            <div><dt>Condición</dt><dd>{vehiculo.condicion}</dd></div>
          </dl>

          <div className="detalle__acciones">
            <button className="boton boton--primario boton--ancho" type="button" onClick={() => onChatear(vehiculo.id)}><Icono nombre="chat" tamano={20} />Chatear con {vehiculo.vendedor.nombre.split(" ")[0]}</button>
            <div className="detalle__acciones-secundarias">
              <button className={`boton boton--secundario ${guardado ? "is-active" : ""}`} type="button" onClick={() => onGuardar(vehiculo.id)} aria-pressed={guardado}><Icono nombre="guardar" tamano={19} />{guardado ? "Guardado" : "Guardar"}</button>
              <button className={`boton boton--secundario boton--icono-texto ${gustado ? "is-active" : ""}`} type="button" onClick={() => onGustar(vehiculo.id)} aria-pressed={gustado}><Icono nombre="corazon" tamano={19} /><span className="sr-only">{gustado ? "Quitar me gusta" : "Dar me gusta"}</span></button>
              <button className="boton boton--secundario boton--icono-texto" type="button" onClick={compartir}><Icono nombre="compartir" tamano={19} /><span className="sr-only">Compartir publicación</span></button>
            </div>
            <button className="boton boton--terciario boton--ancho" type="button" onClick={() => setCierreAbierto(true)} disabled={cierreSolicitado}><Icono nombre="cierre" tamano={19} />{cierreSolicitado ? "Cierre propuesto" : "Proponer un cierre"}</button>
          </div>

          <div className="vendedor">
            <span className="avatar avatar--grande">{vehiculo.vendedor.iniciales}</span>
            <div>
              <strong>{vehiculo.vendedor.nombre}</strong>
              <span>{vehiculo.vendedor.tipo} · Desde {vehiculo.vendedor.miembroDesde}</span>
            </div>
            {vehiculo.vendedor.verificado && <span className="verificado" title="Identidad verificada"><Icono nombre="verificado" /><span className="sr-only">Identidad verificada</span></span>}
          </div>
          <div className="aviso-seguridad"><Icono nombre="escudo" /><p><strong>Coordina con cuidado.</strong> Car Market no procesa pagos ni custodia el vehículo. Verifica los documentos antes de acordar una entrega.</p></div>
          <button className="enlace-sutil" type="button" onClick={() => setReporteAbierto(true)}><Icono nombre="bandera" tamano={16} />Reportar publicación</button>
        </aside>
      </div>

      <div className="detalle__informacion">
        <section className="descripcion" aria-labelledby="descripcion-titulo">
          <h2 id="descripcion-titulo">Sobre este carro</h2>
          <p>{vehiculo.descripcion}</p>
          <h3>Equipamiento y detalles</h3>
          <ul className="caracteristicas">
            {vehiculo.caracteristicas.map((caracteristica) => <li key={caracteristica}><Icono nombre="check" tamano={17} />{caracteristica}</li>)}
          </ul>
        </section>
        <section className="ficha" aria-labelledby="ficha-titulo">
          <h2 id="ficha-titulo">Ficha del vehículo</h2>
          <dl>
            <div><dt>Marca</dt><dd>{vehiculo.marca}</dd></div>
            <div><dt>Modelo</dt><dd>{vehiculo.modelo}</dd></div>
            <div><dt>Año</dt><dd>{vehiculo.anio}</dd></div>
            <div><dt>Color</dt><dd>{vehiculo.color}</dd></div>
            <div><dt>Combustible</dt><dd>{vehiculo.combustible}</dd></div>
            <div><dt>Transmisión</dt><dd>{vehiculo.transmision}</dd></div>
            <div><dt>Condición</dt><dd>{vehiculo.condicion}</dd></div>
            <div><dt>Publicación</dt><dd>Demostración</dd></div>
          </dl>
        </section>
      </div>

      {similares.length > 0 && (
        <section className="similares" aria-labelledby="similares-titulo">
          <div className="seccion__cabecera"><h2 id="similares-titulo">También puedes explorar</h2><a href="#/">Ver todos <Icono nombre="flecha-derecha" tamano={17} /></a></div>
          <div className="cuadricula-vehiculos cuadricula-vehiculos--similares">
            {similares.slice(0, 3).map((similar) => <TarjetaVehiculo key={similar.id} vehiculo={similar} guardado={guardados.has(similar.id)} gustado={gustados.has(similar.id)} onGuardar={onGuardar} onGustar={onGustar} />)}
          </div>
        </section>
      )}

      <Dialogo abierto={zoomAbierto} titulo={`${titulo} · Foto ${fotoActiva + 1}`} onCerrar={() => setZoomAbierto(false)} variante="zoom">
        <div className="zoom" onKeyDown={(event) => event.key === "ArrowRight" && cambiarFoto(1)}>
          <img src={foto.src} srcSet={foto.srcSet} sizes="95vw" alt={foto.alt} />
          {vehiculo.fotos.length > 1 && <div className="zoom__controles"><button className="boton boton--secundario" type="button" onClick={() => cambiarFoto(-1)}><Icono nombre="flecha-izquierda" />Anterior</button><span>{fotoActiva + 1} de {vehiculo.fotos.length}</span><button className="boton boton--secundario" type="button" onClick={() => cambiarFoto(1)}>Siguiente<Icono nombre="flecha-derecha" /></button></div>}
        </div>
      </Dialogo>

      <Dialogo abierto={cierreAbierto} titulo="Proponer un cierre" descripcion="Acuerden una fecha y un lugar seguro antes de entregar el carro." onCerrar={() => setCierreAbierto(false)}>
        <form className="formulario formulario--dialogo" onSubmit={solicitarCierre}>
          <div className="aviso-demo"><Icono nombre="info" /><p>En este prototipo la propuesta queda registrada sólo en esta pantalla. Todavía no se envía al vendedor.</p></div>
          <label className="campo"><span>Fecha y hora propuesta</span><input type="datetime-local" name="fecha" required data-autofocus /></label>
          <label className="campo"><span>Lugar o referencia</span><input name="lugar" maxLength={120} placeholder="Ej. sector La Lago, centro comercial" required /></label>
          <label className="campo"><span>Nota para el vendedor</span><textarea name="nota" rows={3} maxLength={500} placeholder="Indica si llevarás a tu mecánico o necesitas coordinar la entrega." /></label>
          <button className="boton boton--primario boton--ancho" type="submit">Registrar propuesta</button>
        </form>
      </Dialogo>

      <Dialogo abierto={reporteAbierto} titulo="Reportar publicación" descripcion="Cuéntanos qué problema encontraste." onCerrar={() => setReporteAbierto(false)}>
        <form className="formulario formulario--dialogo" onSubmit={(event) => { event.preventDefault(); setReporteAbierto(false); onAviso("Reporte registrado en este prototipo. La moderación se conectará al backend."); }}>
          <label className="campo"><span>Motivo</span><select name="motivo" required data-autofocus><option value="">Elige un motivo</option><option>Información engañosa</option><option>Vehículo no disponible</option><option>Fotos inadecuadas</option><option>Posible fraude</option><option>Otro</option></select></label>
          <label className="campo"><span>Detalles</span><textarea name="detalles" rows={4} maxLength={800} placeholder="Agrega el contexto necesario para revisarlo." required /></label>
          <button className="boton boton--primario boton--ancho" type="submit">Enviar reporte de demostración</button>
        </form>
      </Dialogo>
    </div>
  );
}
