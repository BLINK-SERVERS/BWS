/* ============================================================
   Portal de clientes — BWS
   ------------------------------------------------------------
   Rutas por hash (`#/ingreso`, `#/registro`, `#/panel`, `#/proyecto`,
   `#/admin`) para no depender de reescrituras del servidor. Esta
   entrega deja el armazón y la portada; las vistas del flujo se
   montan sobre `RUTAS` en las siguientes entregas.
   ============================================================ */

import { useEffect, useState } from "react";

const RUTAS = ["/ingreso", "/registro", "/panel", "/proyecto", "/admin"] as const;

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

function Portada() {
  return (
    <section className="po-portada" aria-labelledby="po-titulo">
      <p className="po-sello">Blink Web Services</p>
      <h1 id="po-titulo" className="po-titulo">
        Alta, proyecto y firma en un solo expediente.
      </h1>
      <p className="po-entrada">
        Este portal reúne la identidad fiscal del cliente, el alcance cerrado del proyecto y el
        contrato con sus anexos. La firma es electrónica simple, no certificada, con evidencia
        reforzada: trazo, fecha y hora en UTC, IP, agente y sello de contenido SHA-256.
      </p>
      <div className="po-aviso">
        <h2 className="po-aviso-titulo">Portal en preparación</h2>
        <p>
          El alta de clientes y la firma se habilitan con la primera entrega. Mientras tanto,
          cualquier consulta se atiende en{" "}
          <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>.
        </p>
      </div>
      <p className="po-pie">
        <a href="https://bws.blink.com.ve">Volver a bws.blink.com.ve</a>
      </p>
    </section>
  );
}

function Pendiente({ ruta }: { ruta: string }) {
  return (
    <section className="po-portada" aria-labelledby="po-titulo">
      <p className="po-sello">Blink Web Services</p>
      <h1 id="po-titulo" className="po-titulo">
        Esta sección todavía no está publicada.
      </h1>
      <p className="po-entrada">
        La ruta <code>{ruta}</code> forma parte del portal y se habilita con la entrega del flujo
        completo. No hay datos que puedas enviar desde aquí.
      </p>
      <p className="po-pie">
        <a href="#/">Volver al inicio</a>
      </p>
    </section>
  );
}

export function App() {
  const ruta = usarRuta();
  return (
    <main className="po-marco">
      <header className="po-cabecera">
        <a className="po-marca" href="#/">
          Blink <span>Web Services</span>
        </a>
        <span className="po-candado">Sitio privado</span>
      </header>
      {ruta === "/" ? <Portada /> : <Pendiente ruta={`#${ruta}`} />}
      <footer className="po-legal">
        <span>© {new Date().getFullYear()} Blink</span>
        <span>Powered by Blink</span>
      </footer>
    </main>
  );
}
