import { Acordeon } from "../components/Acordeon";
import { Icono } from "../components/Icono";
import { MarcaBWS } from "../components/MarcaBWS";
import { Seccion } from "../components/Seccion";
import { Socios } from "../components/Socios";
import {
  BENEFICIOS,
  CIERRE,
  CONTACTO,
  HERO,
  MARCA,
  NAV,
  NOTAS,
  PIE,
  PROCESO,
  PROMESA,
  PREGUNTAS,
  SERVICIOS,
  SOCIOS,
} from "../lib/contenido";

/* ============================================================
   Landing de bws.blink.com.ve
   ------------------------------------------------------------
   Una sola página, nueve bloques, en el orden de la referencia de
   Apple que ya usa Pay: cinta → hero → beneficios oscuros → qué
   hacemos → proceso → promesa oscura → banda de aliados → preguntas
   → cierre oscuro → pie.

   La regla que gobierna el documento entero: el cliente trae una idea
   y dinero; del resto nos encargamos nosotros. Ninguna pantalla de
   esta página habla de tecnología. Las ÚNICAS palabras técnicas del
   sitio son los cinco logos de la banda de aliados, y salen sin una
   línea de explicación.

   Qué se cambió respecto a la estructura de Pay y por qué
   · El H1 es la frase ancla, no la marca. `lp-hero__titular` es el
     elemento más grande de la página y el que manda en el esquema del
     documento; la marca va delante, oculta para la vista y presente
     para el lector de pantalla.
   · No hay mockups de hardware ni de teléfono. Pay los necesita porque
     enseña una app; BWS vende un servicio y el hero no tiene pantalla
     que mostrar. Cerrar con aire, y no con una interfaz inventada, es
     también no prometer algo que todavía no existe.
   · El proceso son tres columnas numeradas en vez del scroll pegajoso
     de Pay: cabe en una pantalla y no justifica la animación.
   ============================================================ */

const asunto = encodeURIComponent("Hola BWS: quiero montar una página");
const correo = `mailto:${CONTACTO.correo}?subject=${asunto}`;

export function Landing() {
  return (
    <div className="lp" id="arriba">
      <a className="lp-salto" href="#contenido">
        Saltar al contenido
      </a>

      {/* --- Barra superior --- */}
      <header className="lp-nav">
        <div className="lp-nav__fila">
          {/* Sin `aria-label` en el enlace: lo que se ve en la barra ya
              ES el nombre, y en móvil es «Blink BWS». Poner el nombre
              largo aquí es lo que hacía caer WCAG 2.1 2.5.3
              (label-content-name-mismatch) en el barrido de axe. */}
          <a className="lp-nav__marca" href="#arriba">
            <MarcaBWS variante="nav" />
          </a>

          <nav className="lp-nav__enlaces" aria-label="Secciones de la página">
            {NAV.map((enlace) => (
              <a key={enlace.ancla} href={enlace.ancla}>
                {enlace.texto}
              </a>
            ))}
          </nav>

          <a className="lp-boton lp-boton--primario lp-nav__cta" href="#hablemos">
            Hablemos
          </a>
        </div>
      </header>

      <main id="contenido">
        {/* --- 1. Hero --- */}
        <section className="lp-seccion lp-hero" aria-labelledby="hero-titulo">
          <div className="lp-contenido">
            <p className="lp-cinta">{MARCA.cinta}</p>

            <p className="lp-hero__marca">
              <MarcaBWS variante="hero" />
            </p>

            <h1 className="lp-hero__titular" id="hero-titulo">
              <span className="visualmente-oculto">{MARCA.nombre}: </span>
              {HERO.titulo}
            </h1>

            <p className="lp-hero__sub">{HERO.sub}</p>

            <p className="lp-hero__cta">
              <a className="lp-boton lp-boton--primario" href={HERO.ctaPrimaria.ancla}>
                {HERO.ctaPrimaria.texto}
              </a>
              <a className="lp-boton lp-boton--fantasma" href={HERO.ctaSecundaria.ancla}>
                {HERO.ctaSecundaria.texto}
                <Icono nombre="flecha" />
              </a>
            </p>
          </div>
        </section>

        {/* --- 2. Beneficios (oscuro) --- */}
        <Seccion
          id={BENEFICIOS.id}
          tema="oscura"
          titulo={BENEFICIOS.titulo}
          claseTitulo="lp-titulo-seccion"
        >
          <ul className="lp-beneficios__rejilla">
            {BENEFICIOS.piezas.map((pieza) => (
              <li key={pieza.titulo} className="lp-beneficio">
                <span className="lp-beneficio__check">
                  <Icono nombre="check" />
                </span>
                <h3 className="lp-beneficio__titulo">{pieza.titulo}</h3>
                <p className="lp-dos-tonos">{pieza.cuerpo}</p>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* --- 3. Qué hacemos --- */}
        <Seccion id={SERVICIOS.id} tema="clara" titulo={SERVICIOS.titulo}>
          <p className="lp-cuerpo-icono">{SERVICIOS.bajada}</p>
          <ul className="lp-servicios__rejilla">
            {SERVICIOS.piezas.map((pieza) => (
              <li key={pieza.titulo} className="lp-pieza">
                <span className="lp-pieza__icono">
                  <Icono nombre={pieza.icono} />
                </span>
                <h3 className="lp-subtitulo">{pieza.titulo}</h3>
                <p className="lp-dos-tonos">{pieza.cuerpo}</p>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* --- 4. Proceso --- */}
        <Seccion id={PROCESO.id} tema="gris" titulo={PROCESO.titulo}>
          <p className="lp-cuerpo-icono">{PROCESO.bajada}</p>
          <ol className="lp-pasos lp-pasos--tres">
            {PROCESO.pasos.map((paso, indice) => (
              <li key={paso.titulo}>
                <span className="lp-numero" aria-hidden="true">
                  {indice + 1}
                </span>
                <h3 className="lp-paso__titulo">{paso.titulo}</h3>
                <p className="lp-dos-tonos">{paso.cuerpo}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* --- 5. La promesa (oscura) --- */}
        <Seccion
          id={PROMESA.id}
          tema="oscura"
          titulo={PROMESA.titulo}
          claseTitulo="lp-promesa"
          estrecho
        >
          <p className="lp-promesa__apoyo">{PROMESA.apoyo}</p>
        </Seccion>

        {/* --- 6. Banda de aliados --- */}
        <Seccion id={SOCIOS.id} tema="clara" titulo={SOCIOS.titulo}>
          <Socios />
          <p className="lp-socios__nota">{SOCIOS.nota}</p>
        </Seccion>

        {/* --- 7. Preguntas --- */}
        <Seccion id={PREGUNTAS.id} tema="gris" titulo={PREGUNTAS.titulo}>
          <Acordeon items={PREGUNTAS.piezas} />
        </Seccion>

        {/* --- 8. Cierre (oscuro) --- */}
        <Seccion id={CIERRE.id} tema="oscura" titulo={CIERRE.titulo} className="lp-cierre">
          <p className="lp-cuerpo-icono">{CIERRE.bajada}</p>
          <p className="lp-cierre__cta">
            <a
              className="lp-boton lp-boton--primario"
              href={CONTACTO.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icono nombre="whatsapp" />
              Escribir por WhatsApp
            </a>
            <a className="lp-boton lp-boton--fantasma" href={`tel:${CONTACTO.telefonoMarca}`}>
              <Icono nombre="telefono" />
              Llamar al {CONTACTO.telefono}
            </a>
            <a className="lp-boton lp-boton--fantasma" href={correo}>
              <Icono nombre="correo" />
              {CONTACTO.correo}
            </a>
          </p>
        </Seccion>
      </main>

      {/* --- Notas: la línea que falta cuando no hay precios a la vista --- */}
      <aside className="lp-notas" aria-label="Aclaraciones">
        <div className="lp-contenido">
          <ul className="lp-notas__lista">
            {NOTAS.piezas.map((nota) => (
              <li key={nota}>{nota}</li>
            ))}
          </ul>
        </div>
      </aside>

      {/* --- 9. Pie --- */}
      <footer className="lp-pie">
        <div className="lp-contenido">
          <MarcaBWS variante="pie" />

          <div className="lp-pie__fila">
            <p className="lp-pie__legal">
              {PIE.legal} — {PIE.nota}
            </p>
            <ul className="lp-pie__enlaces">
              {PIE.enlaces.map((enlace) => (
                <li key={enlace.texto}>
                  <a className="lp-enlace" href={enlace.url}>
                    {enlace.texto}
                    <Icono nombre="flecha" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
