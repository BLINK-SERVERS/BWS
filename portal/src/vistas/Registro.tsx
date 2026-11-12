/* ============================================================
   Registro en dos pasos
   ------------------------------------------------------------
   1. Nombre, apellidos, teléfono, correo y clave.
   2. Los cuatro documentos de la cuenta y su aceptación.

   Los datos fiscales no se piden aquí: se completan al solicitar
   un proyecto. El nombre y los apellidos se guardan juntos como
   el nombre completo de la persona. Si un dato cambia entre los
   dos pasos, la huella deja de coincidir y el alta no se
   completa.
   ============================================================ */

import { useState } from "react";
import {
  correoNormalizado,
  mensajeClave,
  nombreValido,
  telefonoNormalizado,
} from "../../legal/identidad";
import {
  api,
  FalloApi,
  type PersonaDatos,
  type PreviaRegistro,
  type RespuestaRegistro,
} from "../datos/api";
import { Campo } from "../componentes/Campo";
import { TextoLegal } from "../componentes/TextoLegal";

export function Registro() {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [clave, setClave] = useState("");

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [previa, setPrevia] = useState<PreviaRegistro | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState<RespuestaRegistro | null>(null);

  const nombreCompleto = () =>
    `${nombre.trim()} ${apellidos.trim()}`.replace(/\s+/g, " ").trim();

  const persona = (): PersonaDatos => ({
    nombre: nombreCompleto(),
    telefono: telefono.trim(),
    correo: correo.trim(),
  });

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (!nombreValido(nombre)) nuevos.nombre = "Escribe tu nombre.";
    if (!nombreValido(apellidos)) nuevos.apellidos = "Escribe tus apellidos.";
    if (!correoNormalizado(correo)) nuevos.correo = "El correo no tiene un formato válido.";
    if (!telefonoNormalizado(telefono)) {
      nuevos.telefono = "Escribe un teléfono con al menos siete dígitos.";
    }
    const problema = mensajeClave(clave);
    if (problema) nuevos.clave = problema;
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const revisar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const respuesta = await api.consentimiento(persona());
      setPrevia(respuesta);
      setAcepta(false);
    } catch (fallo) {
      setErrorGeneral(
        fallo instanceof FalloApi ? fallo.message : "No pudimos preparar los documentos.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const crear = async () => {
    if (!previa || !acepta) return;
    setEnviando(true);
    setErrorGeneral(null);
    try {
      const respuesta = await api.registro({
        cuenta: { correo: correo.trim(), clave, nombre: nombreCompleto() },
        persona: persona(),
        hashes: Object.fromEntries(previa.documentos.map((d) => [d.codigo, d.hash])),
      });
      setHecho(respuesta);
    } catch (fallo) {
      if (fallo instanceof FalloApi && fallo.codigo === "consentimiento") {
        setPrevia(null);
        setErrorGeneral(fallo.message);
      } else {
        setErrorGeneral(
          fallo instanceof FalloApi ? fallo.message : "No pudimos crear la cuenta.",
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-registro-titulo">
        <h1 className="po-titulo-pagina" id="po-registro-titulo">
          Cuenta creada.
        </h1>
        <p className="po-entrada">
          Te enviamos un mensaje a <strong>{hecho.correo}</strong> para confirmar el correo.
        </p>
        {hecho.verificacion_enviada ? null : (
          <div className="po-nota po-nota-aviso" role="alert">
            <p>
              El correo de verificación no pudo enviarse. Escribe a{" "}
              <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>.
            </p>
          </div>
        )}
        <p>
          <a className="po-boton po-boton-principal" href="/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-registro-titulo">
      <h1 className="po-titulo-pagina" id="po-registro-titulo">
        {previa ? "Documentos de la cuenta." : "Crear cuenta."}
      </h1>

      {!previa ? (
        <>
          <form className="po-formulario" onSubmit={(e) => void revisar(e)} noValidate>
            <Campo
              id="registro-nombre"
              etiqueta="Nombre completo"
              autocompletar="given-name"
              valor={nombre}
              alCambiar={setNombre}
              error={errores.nombre}
            />
            <Campo
              id="registro-apellidos"
              etiqueta="Apellidos"
              autocompletar="family-name"
              valor={apellidos}
              alCambiar={setApellidos}
              error={errores.apellidos}
            />
            <Campo
              id="registro-telefono"
              etiqueta="Teléfono"
              tipo="tel"
              autocompletar="tel"
              valor={telefono}
              alCambiar={setTelefono}
              error={errores.telefono}
            />
            <Campo
              id="registro-correo"
              etiqueta="Correo"
              tipo="email"
              autocompletar="email"
              valor={correo}
              alCambiar={setCorreo}
              error={errores.correo}
            />
            <Campo
              id="registro-clave"
              etiqueta="Clave"
              tipo="password"
              autocompletar="new-password"
              ayuda="Al menos diez caracteres, con letras y números."
              valor={clave}
              alCambiar={setClave}
              error={errores.clave}
            />

            {errorGeneral ? (
              <p className="po-campo-error" role="alert">
                {errorGeneral}
              </p>
            ) : null}

            <button className="po-boton po-boton-principal" type="submit" disabled={enviando}>
              {enviando ? "Preparando…" : "Continuar"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="po-entrada">Lee y acepta para crear la cuenta.</p>

          <div className="po-documentos">
            {previa.documentos.map((documento) => (
              <details className="po-documento" key={documento.codigo}>
                <summary>
                  <strong>{documento.titulo}</strong>
                  <span className="po-documento-meta">
                    {documento.codigo} · versión {documento.version}
                  </span>
                </summary>
                <div className="po-documento-cuerpo">
                  <TextoLegal bloques={documento.bloques} />
                  <p className="po-hash-linea">
                    Huella: <code className="po-hash">{documento.hash}</code>
                  </p>
                </div>
              </details>
            ))}
          </div>

          <label className="po-casilla">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(evento) => setAcepta(evento.target.checked)}
            />
            <span>
              Acepto los documentos anteriores, incluido el consentimiento de firma
              electrónica simple no certificada.
            </span>
          </label>

          {errorGeneral ? (
            <p className="po-campo-error" role="alert">
              {errorGeneral}
            </p>
          ) : null}

          <div className="po-firma-acciones">
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => setPrevia(null)}
              disabled={enviando}
            >
              Volver
            </button>
            <button
              type="button"
              className="po-boton po-boton-principal"
              onClick={() => void crear()}
              disabled={!acepta || enviando}
            >
              {enviando ? "Creando…" : "Crear cuenta"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
