/* ============================================================
   Verificación del correo
   ------------------------------------------------------------
   El enlace trae el token en el fragmento de la ruta. Se consume
   una sola vez; al terminar, la cuenta puede firmar.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { api, FalloApi, parametro } from "../datos/api";

type Estado = "cargando" | "ok" | "error" | "sin-token";

export function Verificar() {
  const token = useMemo(() => parametro("token"), []);
  const [estado, setEstado] = useState<Estado>(token ? "cargando" : "sin-token");
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    api
      .verificar(token)
      .then(() => {
        if (vigente) setEstado("ok");
      })
      .catch((fallo) => {
        if (!vigente) return;
        setEstado("error");
        setMensaje(
          fallo instanceof FalloApi ? fallo.message : "No pudimos confirmar el correo.",
        );
      });
    return () => {
      vigente = false;
    };
  }, [token]);

  if (estado === "sin-token") {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-verificar-titulo">
        <h1 className="po-titulo-pagina" id="po-verificar-titulo">
          Falta el enlace.
        </h1>
        <p className="po-entrada">
          Abre el enlace completo del correo de verificación. Si ya no lo tienes, entra al
          portal con tu correo y tu clave y pide un enlace nuevo desde tu cuenta.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="po-pagina po-pagina-angosta" aria-labelledby="po-verificar-titulo">
      <h1 className="po-titulo-pagina" id="po-verificar-titulo">
        {estado === "cargando" ? "Confirmando el correo…" : null}
        {estado === "ok" ? "Correo confirmado." : null}
        {estado === "error" ? "No se pudo confirmar." : null}
      </h1>
      {estado === "ok" ? (
        <>
          <p className="po-entrada">
            Ya puedes entrar al portal y registrar tu firma. El correo quedó vinculado a la
            cuenta.
          </p>
          <p>
            <a className="po-boton po-boton-principal" href="/ingreso">
              Entrar y firmar
            </a>
          </p>
        </>
      ) : null}
      {estado === "error" ? (
        <>
          <p className="po-entrada">{mensaje}</p>
          <p>
            Entra al portal con tu correo y tu clave: en tu cuenta puedes pedir un enlace
            nuevo cuando el anterior venció o ya se usó.
          </p>
          <p>
            <a href="/ingreso">Entrar para pedir otro enlace</a>
          </p>
        </>
      ) : null}
      {estado === "cargando" ? (
        <p className="po-apagado" role="status">
          Un momento.
        </p>
      ) : null}
    </section>
  );
}
