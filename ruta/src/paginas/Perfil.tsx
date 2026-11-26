import { useState } from "react";
import type { Tema } from "../componentes/AppShell";
import { Icono } from "../componentes/Icono";
import type { IconoNombre } from "../componentes/Icono";
import { Acceso } from "../componentes/Acceso";
import { iniciales, type Usuario } from "../datos/auth";

interface PerfilProps {
  publicaciones: number;
  guardados: number;
  tema: Tema;
  usuario: Usuario | null;
  comprobando: boolean;
  errorSesion: string;
  onTema: (tema: Tema) => void;
  onAutenticado: (usuario: Usuario) => void;
  onSalir: () => Promise<void>;
}

function rolLegible(rol: string): string {
  if (rol === "concesionario") return "Concesionario";
  if (rol === "admin") return "Administración";
  return "Particular";
}

export function Perfil({ publicaciones, guardados, tema, usuario, comprobando, errorSesion, onTema, onAutenticado, onSalir }: PerfilProps) {
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalir, setErrorSalir] = useState("");

  if (!usuario) return <Acceso comprobando={comprobando} errorSesion={errorSesion} onAutenticado={onAutenticado} />;

  async function salir() {
    setSaliendo(true);
    setErrorSalir("");
    try {
      await onSalir();
    } catch (error) {
      setErrorSalir(error instanceof Error ? error.message : "No pudimos cerrar la sesión. Inténtalo de nuevo.");
      setSaliendo(false);
    }
  }

  return (
    <div className="pagina perfil">
      <header className="pagina__cabecera"><p className="eyebrow">Cuenta activa</p><h1>Tu espacio en Car Market.</h1><p>Administra tu cuenta y preferencias.</p></header>
      <section className="perfil__identidad">
        <span className="avatar avatar--muy-grande">{iniciales(usuario.nombre)}</span>
        <div className="perfil__datos"><h2>{usuario.nombre}</h2><p>{rolLegible(usuario.rol)} · {usuario.ciudad}</p><span className="perfil__correo">{usuario.correo}</span><span className="etiqueta etiqueta--neutral">Sesión iniciada</span></div>
        <div className="perfil__acciones">
          <a className="boton boton--primario" href="#/publicar"><Icono nombre="publicar" tamano={19} />Publicar carro</a>
          <button className="boton boton--secundario" type="button" onClick={salir} disabled={saliendo} aria-busy={saliendo}><Icono nombre="salir" tamano={19} />{saliendo ? "Cerrando…" : "Cerrar sesión"}</button>
        </div>
      </section>
      {errorSalir && <div className="acceso__error perfil__error" role="alert"><Icono nombre="info" tamano={20} /><span>{errorSalir}</span></div>}

      <div className="perfil__metricas">
        <a href="#/publicar"><strong>{publicaciones}</strong><span>Publicaciones en este navegador</span></a>
        <a href="#/guardados"><strong>{guardados}</strong><span>Carros guardados aquí</span></a>
        <div><strong>0</strong><span>Cierres de demostración</span></div>
      </div>

      <div className="perfil__diseno">
        <section className="tarjeta-ajustes" aria-labelledby="identidad-titulo">
          <div className="tarjeta-ajustes__titulo"><span><Icono nombre="escudo" /></span><div><h2 id="identidad-titulo">Verificación de identidad</h2><p>KYC de cédula y selfie frontal</p></div></div>
          <div className="estado-verificacion"><span className="estado-verificacion__icono"><Icono nombre="usuario" /></span><div><strong>Todavía no está habilitada</strong><p>Este piloto no captura documentos ni selfies. La verificación se abrirá cuando exista el flujo privado de Car Market.</p></div></div>
          <button className="boton boton--secundario boton--ancho" type="button" disabled>Verificar identidad</button>
        </section>

        <section className="tarjeta-ajustes" aria-labelledby="apariencia-titulo">
          <div className="tarjeta-ajustes__titulo"><span><Icono nombre="sol" /></span><div><h2 id="apariencia-titulo">Apariencia</h2><p>Elige cómo quieres ver Car Market</p></div></div>
          <div className="opciones-tema" role="group" aria-label="Tema de la aplicación">
            {([
              ["claro", "Claro", "sol"],
              ["oscuro", "Oscuro", "luna"],
              ["sistema", "Sistema", "monitor"],
            ] as [Tema, string, IconoNombre][]).map(([valor, etiqueta, icono]) => (
              <button key={valor} className={tema === valor ? "is-active" : ""} type="button" onClick={() => onTema(valor)} aria-pressed={tema === valor}><Icono nombre={icono} />{etiqueta}</button>
            ))}
          </div>
        </section>
      </div>

      <section className="perfil__privacidad">
        <Icono nombre="privacidad" tamano={26} />
        <div><h2>Qué se guarda y dónde</h2><p>Tu cuenta y sesión se guardan en el servidor. Las publicaciones, guardados, me gusta y mensajes de este piloto permanecen sólo en este navegador.</p></div>
      </section>
    </div>
  );
}
