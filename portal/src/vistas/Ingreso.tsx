/* ============================================================
   Ingreso
   ------------------------------------------------------------
   Correo y clave. Si ya hay sesión, no se enseña el formulario:
   se ofrece ir al panel.
   ============================================================ */

import { useState } from "react";
import { api, FalloApi, type SesionPortal } from "../datos/api";
import { Campo } from "../componentes/Campo";

export function Ingreso({
  sesion,
  alEntrar,
}: {
  sesion: SesionPortal | null | undefined;
  alEntrar: () => Promise<void>;
}) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (sesion?.usuario) {
    return (
      <section className="po-pagina" aria-labelledby="po-ingreso-titulo">
        <h1 className="po-titulo-pagina" id="po-ingreso-titulo">
          Ya tienes la sesión abierta.
        </h1>
        <p className="po-entrada">
          Entraste como {sesion.usuario.correo}. Puedes continuar en tu panel o cerrar la
          sesión desde la cabecera.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="#/panel">
            Ir al panel
          </a>
        </p>
      </section>
    );
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.ingreso(correo.trim(), clave);
      await alEntrar();
      window.location.hash = "#/panel";
    } catch (fallo) {
      setError(
        fallo instanceof FalloApi ? fallo.message : "No pudimos entrar. Inténtalo de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-ingreso-titulo">
      <p className="po-sello">Portal de clientes</p>
      <h1 className="po-titulo-pagina" id="po-ingreso-titulo">
        Entrar
      </h1>
      <p className="po-entrada">
        Con tu correo y tu clave. La sesión dura doce horas y se cierra al salir.
      </p>

      <form className="po-formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <Campo
          id="ingreso-correo"
          etiqueta="Correo"
          tipo="email"
          autocompletar="email"
          valor={correo}
          alCambiar={setCorreo}
        />
        <Campo
          id="ingreso-clave"
          etiqueta="Clave"
          tipo="password"
          autocompletar="current-password"
          valor={clave}
          alCambiar={setClave}
        />
        {error ? (
          <p className="po-campo-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="po-boton po-boton-principal" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="po-apagado">
        ¿No tienes cuenta? <a href="#/registro">Crea una</a>. ¿Olvidaste la clave?{" "}
        <a href="#/recuperar">Restablécala</a>.
      </p>
    </section>
  );
}
