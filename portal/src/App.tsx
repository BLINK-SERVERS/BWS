/* ============================================================
   Portal de clientes — BWS
   ------------------------------------------------------------
   Rutas por hash (`#/ingreso`, `#/registro`, `#/panel`, …) para
   no depender de reescrituras del servidor. La cuenta, la sesión
   y la firma única ya están montadas; el alta del proyecto y el
   panel de administración llegan en las siguientes entregas.
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";
import { api, type SesionPortal } from "./datos/api";
import { useSesion } from "./datos/sesion";
import { Ingreso } from "./vistas/Ingreso";
import { Panel } from "./vistas/Panel";
import { Proyecto } from "./vistas/Proyecto";
import { Recuperar } from "./vistas/Recuperar";
import { Registro } from "./vistas/Registro";
import { Verificar } from "./vistas/Verificar";

const RUTAS = [
  "/ingreso",
  "/registro",
  "/panel",
  "/proyecto",
  "/admin",
  "/verificar",
  "/recuperar",
] as const;

type Ruta = (typeof RUTAS)[number] | "/";

function rutaActual(): Ruta {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0];
  const limpia = hash === "" ? "/" : hash.replace(/\/+$/, "") || "/";
  return (RUTAS as readonly string[]).includes(limpia) ? (limpia as Ruta) : "/";
}

function usarRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(rutaActual);
  useEffect(() => {
    const alCambiar = () => setRuta(rutaActual());
    window.addEventListener("hashchange", alCambiar);
    if (window.location.hash === "") window.history.replaceState(null, "", "#/");
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);
  return ruta;
}

function Portada({ sesion }: { sesion: SesionPortal | null | undefined }) {
  return (
    <section className="po-portada" aria-labelledby="po-titulo">
      <p className="po-sello">Blink Web Services</p>
      <h1 id="po-titulo" className="po-titulo">
        Tu cuenta, tu firma y el expediente, en un solo lugar.
      </h1>
      <p className="po-entrada">
        Este portal reúne la identidad fiscal del cliente, el consentimiento de firma y, con
        el proyecto, el contrato y sus anexos. La firma es electrónica simple, no
        certificada, con evidencia reforzada: trazo, fecha y hora en UTC, IP, agente y sello
        de contenido SHA-256.
      </p>

      <div className="po-acciones-portada">
        {sesion?.usuario ? (
          <a className="po-boton po-boton-principal" href="#/panel">
            Ir a mi panel
          </a>
        ) : (
          <>
            <a className="po-boton po-boton-principal" href="#/registro">
              Crear cuenta
            </a>
            <a className="po-boton po-boton-suave" href="#/ingreso">
              Entrar
            </a>
          </>
        )}
      </div>

      <ol className="po-pasos">
        <li>
          <span className="po-paso-numero">1</span>
          <h2>Cuenta</h2>
          <p>Identidad fiscal del cliente y correo confirmado.</p>
        </li>
        <li>
          <span className="po-paso-numero">2</span>
          <h2>Firma</h2>
          <p>Consentimiento leído y trazo con evidencia.</p>
        </li>
        <li>
          <span className="po-paso-numero">3</span>
          <h2>Proyecto</h2>
          <p>Alcance, plan, contrato y anexos. Siguiente entrega.</p>
        </li>
      </ol>

      <p className="po-pie">
        <a href="https://bws.blink.com.ve">Volver a bws.blink.com.ve</a>
      </p>
    </section>
  );
}

function Pendiente({ sesion }: { sesion: SesionPortal | null | undefined }) {
  const autorizado = sesion?.usuario.rol === "admin";
  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-titulo">
      <p className="po-sello">Blink Web Services</p>
      <h1 id="po-titulo" className="po-titulo-pagina">
        {autorizado
          ? "El panel de administración llega con la siguiente entrega."
          : "Esta sección es solo para la administración."}
      </h1>
      <p className="po-entrada">
        Aquí se revisarán expedientes, plantillas, pagos y el estado de las licencias.
      </p>
      <p>
        <a href={sesion?.usuario ? "#/panel" : "#/ingreso"}>
          {sesion?.usuario ? "Volver al panel" : "Entrar"}
        </a>
      </p>
    </section>
  );
}

export function App() {
  const ruta = usarRuta();
  const { sesion, recargar } = useSesion();

  const salir = async () => {
    try {
      await api.salir();
    } finally {
      await recargar();
      window.location.hash = "#/";
    }
  };

  let contenido: ReactNode;
  switch (ruta) {
    case "/ingreso":
      contenido = <Ingreso sesion={sesion} alEntrar={recargar} />;
      break;
    case "/registro":
      contenido = <Registro />;
      break;
    case "/panel":
      contenido = <Panel sesion={sesion} recargar={recargar} />;
      break;
    case "/verificar":
      contenido = <Verificar />;
      break;
    case "/recuperar":
      contenido = <Recuperar />;
      break;
    case "/proyecto":
      contenido = <Proyecto sesion={sesion} />;
      break;
    case "/admin":
      contenido = <Pendiente sesion={sesion} />;
      break;
    default:
      contenido = <Portada sesion={sesion} />;
  }

  return (
    <main className="po-marco">
      <header className="po-cabecera">
        <a className="po-marca" href="#/">
          Blink <span>Web Services</span>
        </a>
        <nav className="po-nav" aria-label="Cuenta">
          {sesion?.usuario ? (
            <>
              <a href="#/panel">Panel</a>
              <button type="button" className="po-enlace-boton" onClick={() => void salir()}>
                Salir
              </button>
            </>
          ) : (
            <>
              <a href="#/ingreso">Entrar</a>
              <a className="po-nav-destacado" href="#/registro">
                Crear cuenta
              </a>
            </>
          )}
        </nav>
      </header>
      {contenido}
      <footer className="po-legal">
        <span>© {new Date().getFullYear()} Blink</span>
        <span>Powered by Blink</span>
      </footer>
    </main>
  );
}
