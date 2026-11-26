import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conversacion, Vehiculo } from "./tipos";
import { AppShell } from "./componentes/AppShell";
import type { Tema } from "./componentes/AppShell";
import { Icono } from "./componentes/Icono";
import { conversacionesDemo } from "./datos/chat";
import { vehiculosDemo } from "./datos/vehiculos";
import { Catalogo } from "./paginas/Catalogo";
import { Detalle } from "./paginas/Detalle";
import { Publicar } from "./paginas/Publicar";
import { Chat } from "./paginas/Chat";
import { Guardados } from "./paginas/Guardados";
import { Perfil } from "./paginas/Perfil";
import { cerrarSesion, consultarSesion, type Usuario } from "./datos/auth";

function leerConjunto(clave: string): Set<string> {
  try {
    const valor = JSON.parse(localStorage.getItem(clave) ?? "[]");
    return new Set(Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function leerTema(): Tema {
  const valor = localStorage.getItem("ruta.tema");
  return valor === "claro" || valor === "oscuro" || valor === "sistema" ? valor : "sistema";
}

function rutaActual(): string {
  return window.location.hash.slice(1) || "/";
}

export default function App() {
  const [ruta, setRuta] = useState(rutaActual);
  const [tema, setTema] = useState<Tema>(leerTema);
  const [guardados, setGuardados] = useState<Set<string>>(() => leerConjunto("ruta.guardados"));
  const [gustados, setGustados] = useState<Set<string>>(() => leerConjunto("ruta.gustados"));
  const [publicaciones, setPublicaciones] = useState<Vehiculo[]>([]);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>(conversacionesDemo);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [comprobandoSesion, setComprobandoSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState("");
  const [aviso, setAviso] = useState("");

  const vehiculos = useMemo(() => [...publicaciones, ...vehiculosDemo], [publicaciones]);
  const noLeidos = useMemo(() => conversaciones.reduce((total, conversacion) => total + conversacion.noLeidos, 0), [conversaciones]);

  useEffect(() => {
    function cambiarRuta() {
      setRuta(rutaActual());
    }
    window.addEventListener("hashchange", cambiarRuta);
    return () => window.removeEventListener("hashchange", cambiarRuta);
  }, []);

  useEffect(() => {
    const base = ruta.split("?")[0];
    const titulo = base.startsWith("/auto/") ? "Detalle del carro" : base === "/publicar" ? "Publicar carro" : base === "/guardados" ? "Guardados" : base === "/chat" ? "Mensajes" : base === "/perfil" ? "Tu cuenta" : "Carros en Maracaibo y San Francisco";
    document.title = `${titulo} · Ruta`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [ruta]);

  useEffect(() => {
    const medio = window.matchMedia("(prefers-color-scheme: dark)");
    function aplicar() {
      document.documentElement.dataset.theme = tema === "sistema" ? (medio.matches ? "oscuro" : "claro") : tema;
    }
    aplicar();
    medio.addEventListener("change", aplicar);
    localStorage.setItem("ruta.tema", tema);
    return () => medio.removeEventListener("change", aplicar);
  }, [tema]);

  useEffect(() => {
    try {
      localStorage.setItem("ruta.guardados", JSON.stringify([...guardados]));
      localStorage.setItem("ruta.gustados", JSON.stringify([...gustados]));
    } catch {
      setAviso("No pudimos guardar tus preferencias en este navegador.");
    }
  }, [guardados, gustados]);

  useEffect(() => {
    let activo = true;
    consultarSesion()
      .then((cuenta) => {
        if (activo) setUsuario(cuenta);
      })
      .catch((error: unknown) => {
        if (activo) setErrorSesion(error instanceof Error ? error.message : "No pudimos comprobar tu sesión.");
      })
      .finally(() => {
        if (activo) setComprobandoSesion(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(""), 4500);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  const mostrarAviso = useCallback((mensaje: string) => setAviso(mensaje), []);

  const autenticar = useCallback((cuenta: Usuario) => {
    setUsuario(cuenta);
    setErrorSesion("");
    setAviso("Tu cuenta está conectada.");
  }, []);

  const desconectar = useCallback(async () => {
    await cerrarSesion();
    setUsuario(null);
    setAviso("Cerraste tu sesión.");
  }, []);

  const alternarGuardado = useCallback((id: string) => {
    setGuardados((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(id)) nuevos.delete(id);
      else nuevos.add(id);
      return nuevos;
    });
  }, []);

  const alternarGustado = useCallback((id: string) => {
    setGustados((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(id)) nuevos.delete(id);
      else nuevos.add(id);
      return nuevos;
    });
  }, []);

  const seleccionarConversacion = useCallback((id: string) => {
    setConversaciones((actuales) => {
      const destino = actuales.find((conversacion) => conversacion.id === id);
      if (!destino || destino.noLeidos === 0) return actuales;
      return actuales.map((conversacion) => conversacion.id === id ? { ...conversacion, noLeidos: 0 } : conversacion);
    });
  }, []);

  const abrirChat = useCallback((vehiculoId: string) => {
    setConversaciones((actuales) => {
      const existente = actuales.find((conversacion) => conversacion.vehiculoId === vehiculoId);
      if (existente) return actuales.map((conversacion) => conversacion.id === existente.id ? { ...conversacion, noLeidos: 0 } : conversacion);
      return [{ id: `conv-${vehiculoId}`, vehiculoId, noLeidos: 0, mensajes: [] }, ...actuales];
    });
    window.location.hash = `/chat?vehiculo=${encodeURIComponent(vehiculoId)}`;
  }, []);

  const enviarMensaje = useCallback((id: string, texto: string) => {
    const hora = new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setConversaciones((actuales) => actuales.map((conversacion) => conversacion.id === id ? {
      ...conversacion,
      noLeidos: 0,
      mensajes: [...conversacion.mensajes, { id: crypto.randomUUID(), autor: "yo", texto, hora }],
    } : conversacion));
  }, []);

  const publicarVehiculo = useCallback((vehiculo: Vehiculo) => {
    setPublicaciones((actuales) => [vehiculo, ...actuales]);
    window.location.hash = `/auto/${encodeURIComponent(vehiculo.id)}`;
    setAviso("Publicación creada en este prototipo.");
  }, []);

  function cambiarTema() {
    setTema((actual) => actual === "claro" ? "oscuro" : actual === "oscuro" ? "sistema" : "claro");
  }

  const base = ruta.split("?")[0];
  let contenido;

  if (base === "/") {
    contenido = <Catalogo vehiculos={vehiculos} guardados={guardados} gustados={gustados} onGuardar={alternarGuardado} onGustar={alternarGustado} />;
  } else if (base.startsWith("/auto/")) {
    const id = decodeURIComponent(base.slice("/auto/".length));
    const vehiculo = vehiculos.find((item) => item.id === id);
    const similares = vehiculos.filter((item) => item.id !== id && (item.tipo === vehiculo?.tipo || item.marca === vehiculo?.marca)).slice(0, 6);
    contenido = <Detalle vehiculo={vehiculo} similares={similares} guardados={guardados} gustados={gustados} onGuardar={alternarGuardado} onGustar={alternarGustado} onChatear={abrirChat} onAviso={mostrarAviso} />;
  } else if (base === "/publicar") {
    contenido = <Publicar onPublicar={publicarVehiculo} onAviso={mostrarAviso} />;
  } else if (base === "/chat") {
    contenido = <Chat conversaciones={conversaciones} vehiculos={vehiculos} ruta={ruta} onSeleccionar={seleccionarConversacion} onEnviar={enviarMensaje} />;
  } else if (base === "/guardados") {
    contenido = <Guardados vehiculos={vehiculos} guardados={guardados} gustados={gustados} onGuardar={alternarGuardado} onGustar={alternarGustado} />;
  } else if (base === "/perfil") {
    contenido = <Perfil publicaciones={publicaciones.length} guardados={guardados.size} tema={tema} usuario={usuario} comprobando={comprobandoSesion} errorSesion={errorSesion} onTema={setTema} onAutenticado={autenticar} onSalir={desconectar} />;
  } else {
    contenido = <section className="estado-vacio estado-vacio--pagina"><span className="estado-vacio__icono"><Icono nombre="info" tamano={34} /></span><h1>Esta página no existe.</h1><p>Vuelve al catálogo para seguir explorando.</p><a className="boton boton--primario" href="#/">Ir a Ruta</a></section>;
  }

  return (
    <>
      <AppShell ruta={ruta} noLeidos={noLeidos} tema={tema} usuario={usuario} onCambiarTema={cambiarTema}>{contenido}</AppShell>
      {aviso && <div className="aviso" role="status"><Icono nombre="check" tamano={19} /><span>{aviso}</span><button className="boton-icono" type="button" onClick={() => setAviso("")} aria-label="Cerrar aviso"><Icono nombre="cerrar" tamano={17} /></button></div>}
    </>
  );
}
