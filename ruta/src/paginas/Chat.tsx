import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Conversacion, Vehiculo } from "../tipos";
import { formatearPrecio } from "../datos/filtros";
import { Icono } from "../componentes/Icono";

interface ChatProps {
  conversaciones: Conversacion[];
  vehiculos: Vehiculo[];
  ruta: string;
  onSeleccionar: (id: string) => void;
  onEnviar: (id: string, texto: string) => void;
}

export function Chat({ conversaciones, vehiculos, ruta, onSeleccionar, onEnviar }: ChatProps) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const ordenadas = useMemo(
    () => [...conversaciones].sort((a, b) => Number(b.noLeidos > 0) - Number(a.noLeidos > 0)),
    [conversaciones],
  );
  const conversacion = conversaciones.find((item) => item.id === seleccionada);
  const vehiculo = conversacion ? vehiculos.find((item) => item.id === conversacion.vehiculoId) : undefined;

  useEffect(() => {
    const consulta = new URLSearchParams(ruta.split("?")[1] ?? "");
    const vehiculoId = consulta.get("vehiculo");
    if (!vehiculoId) return;
    const destino = conversaciones.find((item) => item.vehiculoId === vehiculoId);
    if (destino) {
      setSeleccionada(destino.id);
      onSeleccionar(destino.id);
    }
  }, [ruta, conversaciones, onSeleccionar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [conversacion?.mensajes.length, seleccionada]);

  function abrir(id: string) {
    setSeleccionada(id);
    setBorrador("");
    onSeleccionar(id);
    window.history.replaceState(null, "", `#/chat?conversacion=${id}`);
  }

  function enviar() {
    const texto = borrador.trim();
    if (!texto || !conversacion) return;
    onEnviar(conversacion.id, texto);
    setBorrador("");
  }

  function alPresionarEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviar();
    }
  }

  return (
    <div className="pagina chat">
      <header className="chat__cabecera">
        <div><p className="eyebrow">Conversaciones</p><h1>Habla con compradores y vendedores.</h1><p>Acuerda detalles y citas sin compartir tu teléfono.</p></div>
        <span className="chat__demo"><Icono nombre="info" tamano={17} />Chat local de demostración</span>
      </header>

      <div className={`chat__diseno ${seleccionada ? "has-seleccion" : ""}`}>
        <aside className="conversaciones" aria-label="Conversaciones">
          <div className="conversaciones__titulo"><h2>Mensajes</h2><span>{conversaciones.reduce((total, item) => total + item.noLeidos, 0)} sin leer</span></div>
          {ordenadas.length > 0 ? (
            <div className="conversaciones__lista">
              {ordenadas.map((item) => {
                const auto = vehiculos.find((candidato) => candidato.id === item.vehiculoId);
                if (!auto) return null;
                const ultimo = item.mensajes[item.mensajes.length - 1];
                return (
                  <button key={item.id} className={`conversacion ${seleccionada === item.id ? "is-active" : ""}`} type="button" onClick={() => abrir(item.id)} aria-pressed={seleccionada === item.id}>
                    <img src={auto.fotos[0].src} srcSet={auto.fotos[0].srcSet} sizes="64px" alt="" />
                    <span className="conversacion__cuerpo">
                      <span className="conversacion__superior"><strong>{auto.vendedor.nombre}</strong><time>{ultimo?.hora ?? "Ahora"}</time></span>
                      <span className="conversacion__auto">{auto.marca} {auto.modelo} {auto.anio}</span>
                      <span className="conversacion__mensaje">{ultimo ? `${ultimo.autor === "yo" ? "Tú: " : ""}${ultimo.texto}` : "Escribe para iniciar la conversación."}</span>
                    </span>
                    {item.noLeidos > 0 && <span className="contador" aria-label={`${item.noLeidos} mensajes sin leer`}>{item.noLeidos}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="estado-vacio estado-vacio--chat"><Icono nombre="chat" tamano={32} /><h3>Aún no tienes conversaciones.</h3><p>Abre una publicación y escribe al vendedor.</p><a className="boton boton--secundario" href="#/">Explorar carros</a></div>
          )}
        </aside>

        <section className="hilo" aria-label="Conversación seleccionada">
          {conversacion && vehiculo ? (
            <>
              <header className="hilo__cabecera">
                <button className="boton-icono hilo__volver" type="button" onClick={() => setSeleccionada(null)} aria-label="Volver a conversaciones"><Icono nombre="flecha-izquierda" /></button>
                <span className="avatar">{vehiculo.vendedor.iniciales}</span>
                <div><strong>{vehiculo.vendedor.nombre}</strong><span>{vehiculo.vendedor.verificado ? "Identidad verificada" : vehiculo.vendedor.tipo}</span></div>
                {vehiculo.vendedor.verificado && <span className="verificado"><Icono nombre="verificado" tamano={18} /><span className="sr-only">Identidad verificada</span></span>}
              </header>
              <a className="hilo__publicacion" href={`#/auto/${vehiculo.id}`}>
                <img src={vehiculo.fotos[0].src} srcSet={vehiculo.fotos[0].srcSet} sizes="72px" alt="" />
                <span><small>Conversación sobre</small><strong>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</strong><span>{formatearPrecio(vehiculo.precio)}</span></span>
                <Icono nombre="chevron-derecha" />
              </a>
              <div className="hilo__mensajes" aria-live="polite" aria-label="Mensajes">
                <p className="hilo__aviso"><Icono nombre="privacidad" tamano={16} />No compartas contraseñas, códigos ni datos bancarios.</p>
                {conversacion.mensajes.map((mensaje) => (
                  <div key={mensaje.id} className={`mensaje mensaje--${mensaje.autor}`}>
                    <p>{mensaje.texto}</p>
                    <span>{mensaje.hora}{mensaje.autor === "yo" && <Icono nombre="check" tamano={14} />}</span>
                  </div>
                ))}
                <div ref={finRef} />
              </div>
              <form className="composer" onSubmit={(event) => { event.preventDefault(); enviar(); }}>
                <label className="sr-only" htmlFor="mensaje">Escribe un mensaje</label>
                <textarea id="mensaje" rows={1} maxLength={1000} value={borrador} onChange={(event) => setBorrador(event.target.value)} onKeyDown={alPresionarEnter} placeholder="Escribe un mensaje…" />
                <button className="boton boton--primario boton--enviar" type="submit" disabled={!borrador.trim()} aria-label="Enviar mensaje"><Icono nombre="enviar" tamano={20} /></button>
                <span className="composer__ayuda">Enter para enviar · Shift + Enter para nueva línea</span>
              </form>
            </>
          ) : (
            <div className="estado-vacio estado-vacio--hilo"><span className="estado-vacio__icono"><Icono nombre="chat" tamano={34} /></span><h2>Elige una conversación.</h2><p>Tus mensajes aparecerán aquí.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
