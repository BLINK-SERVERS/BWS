/* ============================================================
   Registro en dos pasos
   ------------------------------------------------------------
   1. Los datos de la cuenta y de la ficha fiscal.
   2. Los cinco documentos resueltos con esos datos, su huella,
      y la creación de la cuenta.

   Si un dato cambia entre los dos pasos, la huella deja de
   coincidir y el alta no se completa: el consentimiento no se
   guarda sobre un texto que nadie leyó.
   ============================================================ */

import { useState } from "react";
import {
  correoNormalizado,
  domicilioValido,
  mensajeClave,
  mensajeDocumento,
  nombreValido,
  razonSocialValida,
  telefonoNormalizado,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "../../legal/identidad";
import {
  api,
  FalloApi,
  type PreviaRegistro,
  type RespuestaRegistro,
  type TipoDocumento as TipoCliente,
} from "../datos/api";
import { Campo } from "../componentes/Campo";
import { TextoLegal } from "../componentes/TextoLegal";

export function Registro() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [razon, setRazon] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento>("RIF");
  const [numero, setNumero] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correoFactura, setCorreoFactura] = useState("");

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [previa, setPrevia] = useState<PreviaRegistro | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState<RespuestaRegistro | null>(null);

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (!nombreValido(nombre)) nuevos.nombre = "Escribe el nombre de la persona que firma.";
    if (!correoNormalizado(correo)) nuevos.correo = "El correo no tiene un formato válido.";
    const problema = mensajeClave(clave);
    if (problema) nuevos.clave = problema;
    if (!razonSocialValida(razon)) {
      nuevos.razon = "Escribe la razón social o el nombre del cliente.";
    }
    const documento = mensajeDocumento(tipo, numero);
    if (documento) nuevos.numero = documento;
    if (!domicilioValido(domicilio)) nuevos.domicilio = "Escribe el domicilio fiscal completo.";
    if (!telefonoNormalizado(telefono)) {
      nuevos.telefono = "Escribe un teléfono con al menos siete dígitos.";
    }
    if (!correoNormalizado(correoFactura)) {
      nuevos.correoFactura = "El correo de facturación no tiene un formato válido.";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const cliente = () => ({
    razon_social: razon.trim(),
    documento_tipo: tipo as TipoCliente,
    documento_numero: numero.trim(),
    domicilio: domicilio.trim(),
    telefono: telefono.trim(),
    correo_factura: correoFactura.trim(),
  });

  const revisar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const respuesta = await api.consentimiento(correo.trim(), cliente());
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
        cuenta: { correo: correo.trim(), clave, nombre: nombre.trim() },
        cliente: cliente(),
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
        <p className="po-sello">Paso 3 de 3</p>
        <h1 className="po-titulo-pagina" id="po-registro-titulo">
          Cuenta creada.
        </h1>
        <p className="po-entrada">
          Enviamos un mensaje a <strong>{hecho.correo}</strong> con el enlace para confirmar
          el correo. El enlace vence en 24 horas.
        </p>
        {hecho.verificacion_enviada ? (
          <div className="po-nota" role="status">
            <p>
              Sin confirmar el correo puedes entrar al portal, pero no firmar. Si el mensaje
              no llega, revisa la carpeta de spam o escribe a{" "}
              <a href="mailto:business@blink.com.ve">business@blink.com.ve</a>.
            </p>
          </div>
        ) : (
          <div className="po-nota po-nota-aviso" role="alert">
            <p>
              La cuenta quedó creada, pero el correo de verificación no pudo enviarse desde
              este servidor. Escribe a{" "}
              <a href="mailto:business@blink.com.ve">business@blink.com.ve</a> para activar
              la firma.
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
    <section className="po-pagina" aria-labelledby="po-registro-titulo">
      <p className="po-sello">{previa ? "Paso 2 de 3" : "Paso 1 de 3"}</p>
      <h1 className="po-titulo-pagina" id="po-registro-titulo">
        {previa ? "Lee y acepta los documentos." : "Crear la cuenta."}
      </h1>

      {!previa ? (
        <>
          <p className="po-entrada">
            La cuenta es de la persona que va a firmar. Los datos fiscales son del cliente
            que contrata. El portal valida el formato del documento; no consulta al SENIAT.
          </p>

          <form className="po-formulario" onSubmit={(e) => void revisar(e)} noValidate>
            <fieldset className="po-grupo">
              <legend>Cuenta</legend>
              <Campo
                id="registro-nombre"
                etiqueta="Nombre de la persona que firma"
                autocompletar="name"
                valor={nombre}
                alCambiar={setNombre}
                error={errores.nombre}
              />
              <Campo
                id="registro-correo"
                etiqueta="Correo"
                tipo="email"
                autocompletar="email"
                ayuda="Aquí llega el enlace de verificación."
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
            </fieldset>

            <fieldset className="po-grupo">
              <legend>Datos fiscales del cliente</legend>
              <Campo
                id="registro-razon"
                etiqueta="Razón social o nombre"
                autocompletar="organization"
                valor={razon}
                alCambiar={setRazon}
                error={errores.razon}
              />
              <div className="po-fila">
                <Campo
                  id="registro-tipo"
                  etiqueta="Tipo de documento"
                  modo="select"
                  valor={tipo}
                  alCambiar={(valor) => setTipo(valor as TipoDocumento)}
                >
                  {TIPOS_DOCUMENTO.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </Campo>
                <Campo
                  id="registro-numero"
                  etiqueta="Número"
                  ayuda={TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.ayuda}
                  valor={numero}
                  alCambiar={setNumero}
                  error={errores.numero}
                />
              </div>
              <Campo
                id="registro-domicilio"
                etiqueta="Domicilio fiscal"
                autocompletar="street-address"
                valor={domicilio}
                alCambiar={setDomicilio}
                error={errores.domicilio}
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
                id="registro-factura"
                etiqueta="Correo de facturación"
                tipo="email"
                valor={correoFactura}
                alCambiar={setCorreoFactura}
                error={errores.correoFactura}
              />
            </fieldset>

            {errorGeneral ? (
              <p className="po-campo-error" role="alert">
                {errorGeneral}
              </p>
            ) : null}

            <button className="po-boton po-boton-principal" type="submit" disabled={enviando}>
              {enviando ? "Preparando…" : "Revisar documentos"}
            </button>
            <p className="po-apagado">
              Al continuar verás los cinco documentos del registro resueltos con estos
              datos, antes de aceptar nada.
            </p>
          </form>
        </>
      ) : (
        <>
          <p className="po-entrada">
            Estos son los documentos que quedarán asociados a tu cuenta. Léelos completos:
            la firma del consentimiento se guarda sobre este texto exacto.
          </p>

          {previa.prestador.provisional ? (
            <div className="po-nota po-nota-aviso" role="alert">
              <p>
                Este entorno muestra datos fiscales provisionales de Blink. El alta real usa
                los datos configurados en el servidor, no estos.
              </p>
            </div>
          ) : null}

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
                  <p className="po-apagado">{documento.resumen}</p>
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
              Leí los cinco documentos y acepto sus términos, incluido el consentimiento
              para el uso de firma electrónica simple no certificada.
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
              Volver a los datos
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
