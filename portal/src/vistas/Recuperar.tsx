/* ============================================================
   Recuperación de la clave
   ------------------------------------------------------------
   Sin token: se pide el correo y la respuesta es genérica exista
   o no la cuenta. Con token: se elige la clave nueva; al guardar
   se cierran todas las sesiones abiertas.
   ============================================================ */

import { useMemo, useState } from "react";
import { mensajeClave } from "../../legal/identidad";
import { api, FalloApi, parametro } from "../datos/api";
import { Campo } from "../componentes/Campo";

export function Recuperar() {
  const token = useMemo(() => parametro("token"), []);

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  const pedir = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await api.recuperar(correo.trim());
      setAviso(respuesta.mensaje);
    } catch (fallo) {
      setError(fallo instanceof FalloApi ? fallo.message : "No pudimos procesar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    const problema = mensajeClave(clave);
    if (problema) {
      setError(problema);
      return;
    }
    if (clave !== repetida) {
      setError("Las dos claves no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      await api.restablecer(token, clave);
      setHecho(true);
    } catch (fallo) {
      setError(
        fallo instanceof FalloApi ? fallo.message : "No pudimos cambiar la clave.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-recuperar-titulo">
        <h1 className="po-titulo-pagina" id="po-recuperar-titulo">
          Clave cambiada.
        </h1>
        <p className="po-entrada">
          Cerramos todas las sesiones abiertas. Entra con la clave nueva.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="#/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-recuperar-titulo">
      <p className="po-sello">Portal de clientes</p>
      <h1 className="po-titulo-pagina" id="po-recuperar-titulo">
        {token ? "Elige una clave nueva." : "Restablecer la clave."}
      </h1>

      {token ? (
        <form className="po-formulario" onSubmit={(e) => void cambiar(e)} noValidate>
          <p className="po-entrada">
            La clave debe tener al menos diez caracteres y combinar letras y números.
          </p>
          <Campo
            id="recuperar-clave"
            etiqueta="Clave nueva"
            tipo="password"
            autocompletar="new-password"
            valor={clave}
            alCambiar={setClave}
          />
          <Campo
            id="recuperar-repetida"
            etiqueta="Repite la clave"
            tipo="password"
            autocompletar="new-password"
            valor={repetida}
            alCambiar={setRepetida}
          />
          {error ? (
            <p className="po-campo-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="po-boton po-boton-principal" type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : "Cambiar la clave"}
          </button>
        </form>
      ) : (
        <form className="po-formulario" onSubmit={(e) => void pedir(e)} noValidate>
          <p className="po-entrada">
            Escribe el correo de tu cuenta. Si existe, enviamos un enlace de un solo uso que
            vence en una hora.
          </p>
          <Campo
            id="recuperar-correo"
            etiqueta="Correo"
            tipo="email"
            autocompletar="email"
            valor={correo}
            alCambiar={setCorreo}
          />
          {error ? (
            <p className="po-campo-error" role="alert">
              {error}
            </p>
          ) : null}
          {aviso ? (
            <p className="po-nota" role="status">
              {aviso}
            </p>
          ) : null}
          <button className="po-boton po-boton-principal" type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar el enlace"}
          </button>
        </form>
      )}

      <p className="po-apagado">
        <a href="#/ingreso">Volver al ingreso</a>
      </p>
    </section>
  );
}
