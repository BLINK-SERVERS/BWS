import { useState, type FormEvent } from "react";
import type { Usuario } from "../datos/auth";
import { crearCuenta, entrarEnCuenta } from "../datos/auth";
import { Icono } from "./Icono";

interface AccesoProps {
  comprobando: boolean;
  errorSesion: string;
  onAutenticado: (usuario: Usuario) => void;
}

type Modo = "ingreso" | "registro";

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : "No pudimos completar la operación. Inténtalo de nuevo.";
}

function correoValido(correo: string): boolean {
  return correo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

export function Acceso({ comprobando, errorSesion, onAutenticado }: AccesoProps) {
  const [modo, setModo] = useState<Modo>("ingreso");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [ciudad, setCiudad] = useState("Maracaibo");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  function cambiarModo(siguiente: Modo) {
    setModo(siguiente);
    setClave("");
    setVerClave(false);
    setError("");
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    const correoNormalizado = correo.trim().toLowerCase();
    if (!correoValido(correoNormalizado)) {
      setError("Escribe un correo válido.");
      return;
    }
    if (clave.length < 10 || clave.length > 128) {
      setError("La contraseña debe tener entre 10 y 128 caracteres.");
      return;
    }
    if (modo === "registro" && (nombre.trim().length < 2 || nombre.trim().length > 80)) {
      setError("Escribe un nombre de 2 a 80 caracteres.");
      return;
    }

    setCargando(true);
    try {
      const usuario = modo === "registro"
        ? await crearCuenta({ nombre: nombre.trim(), correo: correoNormalizado, ciudad, clave })
        : await entrarEnCuenta({ correo: correoNormalizado, clave });
      onAutenticado(usuario);
    } catch (fallo) {
      setError(mensajeDe(fallo));
    } finally {
      setCargando(false);
    }
  }

  if (comprobando) {
    return <div className="pagina acceso acceso--cargando" role="status"><span className="acceso__cargando" aria-hidden="true" /><h1>Comprobando tu sesión…</h1></div>;
  }

  return (
    <div className="pagina acceso">
      <header className="pagina__cabecera">
        <p className="eyebrow">Tu cuenta Car Market</p>
        <h1>{modo === "registro" ? "Crea tu cuenta en Car Market." : "Qué bueno verte de nuevo."}</h1>
        <p>Tu cuenta se guarda en el servidor. El catálogo, las publicaciones y el chat de este piloto siguen siendo demostración.</p>
      </header>

      <div className="acceso__marco">
        <aside className="acceso__contexto" aria-label="Información de la cuenta">
          <span className="acceso__icono"><Icono nombre="usuario" tamano={30} /></span>
          <h2>Un acceso sencillo para empezar.</h2>
          <ul>
            <li><Icono nombre="escudo" tamano={20} /><span>Sesión privada y contraseña protegida.</span></li>
            <li><Icono nombre="ubicacion" tamano={20} /><span>Perfil para Maracaibo o San Francisco.</span></li>
            <li><Icono nombre="privacidad" tamano={20} /><span>Este piloto no captura cédula ni selfie.</span></li>
          </ul>
          <p>Más adelante podrás verificar tu identidad y sincronizar tus publicaciones.</p>
        </aside>

        <section className="acceso__formulario" aria-labelledby="acceso-titulo">
          <div className="acceso__modos" role="group" aria-label="Tipo de acceso">
            <button type="button" className={modo === "ingreso" ? "is-active" : ""} aria-pressed={modo === "ingreso"} onClick={() => cambiarModo("ingreso")}>Entrar</button>
            <button type="button" className={modo === "registro" ? "is-active" : ""} aria-pressed={modo === "registro"} onClick={() => cambiarModo("registro")}>Crear cuenta</button>
          </div>

          <h2 id="acceso-titulo">{modo === "registro" ? "Te tomará menos de un minuto." : "Entra con tu correo y contraseña."}</h2>

          {errorSesion && <div className="acceso__aviso" role="status"><Icono nombre="info" tamano={20} /><span>{errorSesion}</span></div>}
          {error && <div className="acceso__error" role="alert"><Icono nombre="info" tamano={20} /><span>{error}</span></div>}

          <form onSubmit={enviar} aria-busy={cargando}>
            {modo === "registro" && (
              <label className="campo">
                <span>Nombre</span>
                <input name="nombre" type="text" autoComplete="name" maxLength={80} required value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Tu nombre" />
              </label>
            )}

            <label className="campo">
              <span>Correo</span>
              <input name="correo" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required value={correo} onChange={(evento) => setCorreo(evento.target.value)} placeholder="tu@correo.com" />
            </label>

            {modo === "registro" && (
              <label className="campo">
                <span>Ciudad</span>
                <select name="ciudad" autoComplete="address-level2" required value={ciudad} onChange={(evento) => setCiudad(evento.target.value)}>
                  <option value="Maracaibo">Maracaibo</option>
                  <option value="San Francisco">San Francisco</option>
                </select>
              </label>
            )}

            <label className="campo">
              <span>Contraseña</span>
              <span className="acceso__clave">
                <input name="clave" type={verClave ? "text" : "password"} autoComplete={modo === "registro" ? "new-password" : "current-password"} minLength={10} maxLength={128} required value={clave} onChange={(evento) => setClave(evento.target.value)} aria-describedby="acceso-clave-ayuda" />
                <button type="button" onClick={() => setVerClave((actual) => !actual)} aria-pressed={verClave}>{verClave ? "Ocultar" : "Mostrar"}</button>
              </span>
              <small id="acceso-clave-ayuda">{modo === "registro" ? "Usa entre 10 y 128 caracteres." : "La misma contraseña con la que creaste tu cuenta."}</small>
            </label>

            <button className="boton boton--primario boton--ancho acceso__enviar" type="submit" disabled={cargando}>
              {cargando ? <><span className="acceso__girando" aria-hidden="true" />{modo === "registro" ? "Creando tu cuenta…" : "Entrando…"}</> : <>{modo === "registro" ? "Crear mi cuenta" : "Entrar a mi cuenta"}<Icono nombre="flecha-derecha" tamano={19} /></>}
            </button>
          </form>

          <p className="acceso__cambio">
            {modo === "registro" ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?"}{" "}
            <button type="button" onClick={() => cambiarModo(modo === "registro" ? "ingreso" : "registro")}>{modo === "registro" ? "Entra aquí" : "Créala aquí"}</button>
          </p>
          <p className="acceso__pie">Usaremos tu correo y contraseña para administrar el acceso. No compartiremos tus datos de acceso.</p>
        </section>
      </div>
    </div>
  );
}
