import type { ReactNode } from "react";
import { Icono } from "./Icono";
import type { IconoNombre } from "./Icono";
import { Marca } from "./Marca";
import { iniciales, type Usuario } from "../datos/auth";

export type Tema = "claro" | "oscuro" | "sistema";

interface AppShellProps {
  children: ReactNode;
  ruta: string;
  noLeidos: number;
  tema: Tema;
  usuario: Usuario | null;
  onCambiarTema: () => void;
}

interface Destino {
  href: string;
  etiqueta: string;
  icono: IconoNombre;
  clave: string;
}

const destinos: Destino[] = [
  { href: "#/", etiqueta: "Explorar", icono: "inicio", clave: "inicio" },
  { href: "#/guardados", etiqueta: "Guardados", icono: "guardar", clave: "guardados" },
  { href: "#/chat", etiqueta: "Chat", icono: "chat", clave: "chat" },
  { href: "#/perfil", etiqueta: "Perfil", icono: "usuario", clave: "perfil" },
];

function seccionActiva(ruta: string): string {
  if (ruta.startsWith("/guardados")) return "guardados";
  if (ruta.startsWith("/chat")) return "chat";
  if (ruta.startsWith("/perfil")) return "perfil";
  if (ruta.startsWith("/publicar")) return "publicar";
  return "inicio";
}

function tituloRuta(ruta: string): string {
  if (ruta.startsWith("/auto/")) return "Detalle del carro";
  if (ruta.startsWith("/publicar")) return "Publicar carro";
  if (ruta.startsWith("/guardados")) return "Guardados";
  if (ruta.startsWith("/chat")) return "Mensajes";
  if (ruta.startsWith("/perfil")) return "Tu cuenta";
  return "Explorar carros";
}

function iconoTema(tema: Tema): IconoNombre {
  if (tema === "oscuro") return "luna";
  if (tema === "sistema") return "monitor";
  return "sol";
}

function textoTema(tema: Tema): string {
  if (tema === "oscuro") return "Tema oscuro";
  if (tema === "sistema") return "Tema del sistema";
  return "Tema claro";
}

export function AppShell({ children, ruta, noLeidos, tema, usuario, onCambiarTema }: AppShellProps) {
  const activa = seccionActiva(ruta);

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#contenido"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("contenido")?.focus();
        }}
      >
        Saltar al contenido
      </a>

      <aside className="barra-lateral" aria-label="Navegación principal">
        <Marca />
        <nav className="navegacion-lateral">
          {destinos.map((destino) => (
            <a key={destino.clave} className={`nav-lateral__enlace ${activa === destino.clave ? "is-active" : ""}`} href={destino.href} aria-current={activa === destino.clave ? "page" : undefined}>
              <Icono nombre={destino.icono} />
              <span>{destino.etiqueta}</span>
              {destino.clave === "chat" && noLeidos > 0 && <span className="contador" aria-label={`${noLeidos} mensajes sin leer`}>{noLeidos}</span>}
            </a>
          ))}
          <a className={`nav-lateral__enlace nav-lateral__publicar ${activa === "publicar" ? "is-active" : ""}`} href="#/publicar" aria-current={activa === "publicar" ? "page" : undefined}>
            <Icono nombre="publicar" />
            <span>Publicar carro</span>
          </a>
        </nav>

        <div className="barra-lateral__pie">
          <div className="indicador-demo">
            <span className="indicador-demo__punto" />
            Cuentas reales · catálogo de demostración
          </div>
          <p>Carros en Maracaibo y San Francisco.</p>
          <button className="tema-lateral" type="button" onClick={onCambiarTema} aria-label={`Cambiar tema. Actual: ${textoTema(tema)}`}>
            <Icono nombre={iconoTema(tema)} />
            <span>{textoTema(tema)}</span>
            <Icono nombre="chevron-derecha" tamano={18} />
          </button>
          <span className="marca-lateral__firma">Powered by Blink</span>
        </div>
      </aside>

      <div className="columna-principal">
        <header className="barra-superior">
          <div className="barra-superior__marca">
            <Marca compacta />
          </div>
          <div className="barra-superior__ruta">
            <span>Ruta</span>
            <Icono nombre="chevron-derecha" tamano={16} />
            <strong>{tituloRuta(ruta)}</strong>
          </div>
          <div className="barra-superior__acciones">
            <button className="boton-icono barra-superior__tema" type="button" onClick={onCambiarTema} aria-label={`Cambiar tema. Actual: ${textoTema(tema)}`} title={textoTema(tema)}>
              <Icono nombre={iconoTema(tema)} />
            </button>
            <a className="boton-icono" href="#/chat" aria-label={`Abrir chat${noLeidos ? `, ${noLeidos} mensajes sin leer` : ""}`}>
              <Icono nombre="campana" />
              {noLeidos > 0 && <span className="punto-notificacion" />}
            </a>
            <a className="avatar avatar--pequeno barra-superior__perfil" href="#/perfil" aria-label={usuario ? `Abrir el perfil de ${usuario.nombre}` : "Entrar a tu cuenta"}>{usuario ? iniciales(usuario.nombre) : "TÚ"}</a>
          </div>
        </header>

        <main id="contenido" className="contenido" tabIndex={-1}>
          {children}
        </main>

        <footer className="pie">
          <p>Las cuentas usan el servidor. El catálogo, las publicaciones y el chat son demostración; no representan inventario real.</p>
          <a href={`${import.meta.env.BASE_URL}creditos.json`} target="_blank" rel="noreferrer">Créditos y licencias de las fotos</a>
          <span>Powered by Blink</span>
        </footer>
      </div>

      <nav className="navegacion-inferior" aria-label="Navegación principal móvil">
        {destinos.slice(0, 2).map((destino) => (
          <a key={destino.clave} className={`nav-inferior__enlace ${activa === destino.clave ? "is-active" : ""}`} href={destino.href} aria-current={activa === destino.clave ? "page" : undefined}>
            <span className="nav-inferior__icono">
              <Icono nombre={destino.icono} />
              {destino.clave === "chat" && noLeidos > 0 && <span className="contador contador--pequeno">{noLeidos}</span>}
            </span>
            <span>{destino.etiqueta}</span>
          </a>
        ))}
        <a className={`nav-inferior__publicar ${activa === "publicar" ? "is-active" : ""}`} href="#/publicar" aria-label="Publicar carro" aria-current={activa === "publicar" ? "page" : undefined}>
          <span><Icono nombre="publicar" tamano={25} /></span>
          <small>Publicar</small>
        </a>
        {destinos.slice(2).map((destino) => (
          <a key={destino.clave} className={`nav-inferior__enlace ${activa === destino.clave ? "is-active" : ""}`} href={destino.href} aria-current={activa === destino.clave ? "page" : undefined}>
            <span className="nav-inferior__icono">
              <Icono nombre={destino.icono} />
              {destino.clave === "chat" && noLeidos > 0 && <span className="contador contador--pequeno">{noLeidos}</span>}
            </span>
            <span>{destino.etiqueta}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
