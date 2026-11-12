/* ============================================================
   Alta del proyecto
   ------------------------------------------------------------
   El cliente describe el alcance, el dominio, hasta cinco
   buzones y el plan de infraestructura de su aplicación. Antes de
   enviar ve el anexo B con los límites reales del plan elegido y
   el resumen del anexo D; al enviar, el alcance se congela.

   Los precios y límites llegan de `planes_infra`, no de este
   archivo. Cambiar el plan recalcula el anexo B en pantalla.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import {
  correoNormalizado,
  dominioDe,
  normalizarDominio,
} from "../../legal/identidad";
import {
  api,
  FalloApi,
  type Complejidad,
  type Condiciones,
  type DatosProyecto,
  type PlanVista,
  type ProyectoVista,
  type SesionPortal,
} from "../datos/api";
import { Campo } from "../componentes/Campo";

const ESTADOS: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  entregado: "Entregado",
  terminado: "Terminado",
};

function AnexoB({ plan }: { plan: PlanVista }) {
  return (
    <section className="po-tarjeta" aria-labelledby="po-anexo-b">
      <h2 className="po-tarjeta-titulo" id="po-anexo-b">
        Anexo B — Infraestructura de tu aplicación
      </h2>
      <p>
        Plan <strong>{plan.nombre}</strong> · {plan.precio_usd === 0
          ? "sin costo mensual"
          : `USD ${plan.precio_usd} al mes`}
      </p>
      <div className="po-tabla-marco">
        <table>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Límite</th>
            </tr>
          </thead>
          <tbody>
            {plan.limites.map((limite) => (
              <tr key={limite.concepto}>
                <th scope="row">{limite.concepto}</th>
                <td>{limite.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="po-apagado">
        Fuente: {plan.fuente}. Consulta: {plan.fecha_larga}. El plan Pro es opcional y no
        se activa solo; si el proveedor cambia los límites, se avisa y se ajusta por anexo.
      </p>
    </section>
  );
}

function AnexoD({ condiciones, plan }: { condiciones: Condiciones; plan: PlanVista }) {
  return (
    <section className="po-tarjeta" aria-labelledby="po-anexo-d">
      <h2 className="po-tarjeta-titulo" id="po-anexo-d">
        Anexo D — Condiciones comerciales
      </h2>
      <dl className="po-datos">
        <div>
          <dt>Desarrollo</dt>
          <dd>{condiciones.tarifa_desarrollo} por mes</dd>
        </div>
        <div>
          <dt>Plan de infraestructura elegido</dt>
          <dd>
            {plan.nombre}: {plan.precio_usd === 0
              ? "sin costo mensual"
              : `USD ${plan.precio_usd} por mes`}
          </dd>
        </div>
        <div>
          <dt>Primera demo</dt>
          <dd>{condiciones.demo_plazo}</dd>
        </div>
        <div>
          <dt>Dominio</dt>
          <dd>{condiciones.dominio_costo_eur} al año, en bolívares a la tasa del BCV del día</dd>
        </div>
        <div>
          <dt>Licencia de uso</dt>
          <dd>{condiciones.licencia_duracion}</dd>
        </div>
        <div>
          <dt>Crédito «Powered by Blink»</dt>
          <dd>{condiciones.credito_meses} desde la entrega, salvo renuncia escrita</dd>
        </div>
      </dl>
      <p className="po-apagado">
        El desarrollo y el plan Pro son conceptos distintos: {condiciones.tarifa_desarrollo} es
        el desarrollo y {condiciones.tarifa_infra_pro} es el plan Pro de infraestructura, que
        solo se paga si lo eliges. No se suman automáticamente.
      </p>
    </section>
  );
}

export function Proyecto({ sesion }: { sesion: SesionPortal | null | undefined }) {
  const [datos, setDatos] = useState<DatosProyecto | null>(null);
  const [proyecto, setProyecto] = useState<ProyectoVista | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [dominio, setDominio] = useState("");
  const [buzones, setBuzones] = useState<string[]>([]);
  const [alcance, setAlcance] = useState("");
  const [complejidad, setComplejidad] = useState<Complejidad>("media");
  const [planClave, setPlanClave] = useState("supabase");
  const [planNivel, setPlanNivel] = useState("inicial");

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!sesion?.usuario) return;
    let vigente = true;
    api
      .proyecto()
      .then((respuesta) => {
        if (!vigente) return;
        setDatos(respuesta);
        setProyecto(respuesta.proyecto);
        if (respuesta.proyecto) {
          const p = respuesta.proyecto;
          setNombre(p.nombre);
          setCategoria(p.categoria);
          setDominio(p.dominio);
          setBuzones(p.buzones.filter((b) => !b.startsWith("no-reply@")));
          setAlcance(p.alcance);
          setComplejidad(p.complejidad);
          setPlanClave(p.plan.clave);
          setPlanNivel(p.plan.nivel);
        } else {
          const primero = respuesta.planes[0];
          const nivel = primero?.niveles[0];
          if (primero && nivel) {
            setPlanClave(primero.clave);
            setPlanNivel(nivel.nivel);
          }
          setCategoria(respuesta.categorias[0] ?? "");
        }
      })
      .catch((error) => {
        if (vigente) {
          setFallo(
            error instanceof FalloApi && error.estado === 401
              ? "Tu sesión venció. Vuelve a entrar."
              : error instanceof FalloApi
                ? error.message
                : "No pudimos cargar el proyecto.",
          );
        }
      });
    return () => {
      vigente = false;
    };
  }, [sesion]);

  const plan = useMemo(
    () =>
      datos?.planes
        .find((p) => p.clave === planClave)
        ?.niveles.find((n) => n.nivel === planNivel) ?? null,
    [datos, planClave, planNivel],
  );

  const dominioLimpio = normalizarDominio(dominio);

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (nombre.trim().length < 3 || nombre.trim().length > 120) {
      nuevos.nombre = "Escribe un nombre de proyecto de 3 a 120 caracteres.";
    }
    if (!datos?.categorias.includes(categoria)) {
      nuevos.categoria = "Elige una categoría de la lista.";
    }
    if (!dominioLimpio) {
      nuevos.dominio = "Escribe un dominio válido, por ejemplo estudio.com.ve.";
    }
    const adicionales = buzones.map((b) => b.trim()).filter(Boolean);
    if (adicionales.length + 1 > 5) {
      nuevos.buzones = "El proyecto admite un máximo de cinco buzones.";
    } else if (dominioLimpio) {
      for (const correo of adicionales) {
        const normalizado = correoNormalizado(correo);
        if (!normalizado) {
          nuevos.buzones = `El buzón «${correo}» no tiene un formato válido.`;
          break;
        }
        if (dominioDe(normalizado) !== dominioLimpio) {
          nuevos.buzones = `El buzón «${correo}» debe pertenecer a ${dominioLimpio}.`;
          break;
        }
      }
      const todos = [`no-reply@${dominioLimpio}`, ...adicionales];
      if (new Set(todos).size !== todos.length) {
        nuevos.buzones = "Hay un buzón repetido.";
      }
    }
    if (alcance.trim().length < 40) {
      nuevos.alcance = "Describe el alcance con al menos 40 caracteres.";
    }
    if (!plan) nuevos.plan = "Elige un plan disponible.";
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const enviar = async (etapa: "guardar" | "enviar") => {
    if (!dominioLimpio || !validar()) return;
    setGuardando(true);
    setFallo(null);
    setAviso(null);
    try {
      const guardado = await api.guardarProyecto({
        nombre: nombre.trim(),
        categoria,
        dominio: dominioLimpio,
        buzones: [
          `no-reply@${dominioLimpio}`,
          ...buzones.map((b) => b.trim().toLowerCase()).filter(Boolean),
        ],
        alcance: alcance.trim(),
        complejidad,
        plan_clave: planClave,
        plan_nivel: planNivel,
      });
      setProyecto(guardado.proyecto);
      if (etapa === "guardar") {
        setAviso("Borrador guardado. Todavía no se envió ni se congeló el alcance.");
      } else {
        const enviado = await api.enviarProyecto();
        setProyecto(enviado.proyecto);
        setConfirmando(false);
        setAviso("Proyecto enviado. El alcance quedó congelado.");
      }
    } catch (error) {
      if (error instanceof FalloApi && error.codigo === "proyecto_enviado") {
        setConfirmando(false);
        const recargado = await api.proyecto().catch(() => null);
        if (recargado) setProyecto(recargado.proyecto);
      }
      setFallo(
        error instanceof FalloApi ? error.message : "No pudimos guardar el proyecto.",
      );
    } finally {
      setGuardando(false);
    }
  };

  if (sesion === undefined) {
    return (
      <section className="po-pagina" aria-live="polite" aria-busy="true">
        <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
          Proyecto
        </h1>
        <p className="po-apagado">Cargando tu cuenta…</p>
      </section>
    );
  }

  if (sesion === null) {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-proyecto-titulo">
        <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
          Necesitas entrar.
        </h1>
        <p className="po-entrada">
          El alta del proyecto es privada. Entra con tu correo y tu clave.
        </p>
        <p>
          <a className="po-boton po-boton-principal" href="/ingreso">
            Entrar
          </a>
        </p>
      </section>
    );
  }

  if (fallo && !datos) {
    return (
      <section className="po-pagina po-pagina-angosta" aria-labelledby="po-proyecto-titulo">
        <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
          No pudimos cargar el proyecto.
        </h1>
        <p className="po-campo-error" role="alert">
          {fallo}
        </p>
      </section>
    );
  }

  if (!datos || !plan) {
    return (
      <section className="po-pagina" aria-live="polite" aria-busy="true">
        <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
          Proyecto
        </h1>
        <p className="po-apagado">Consultando el catálogo de infraestructura.</p>
      </section>
    );
  }

  if (proyecto && proyecto.estado !== "borrador") {
    return (
      <section className="po-pagina" aria-labelledby="po-proyecto-titulo">
        <p className="po-sello">Proyecto</p>
        <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
          {proyecto.nombre}
        </h1>
        <p className="po-entrada">
          Estado: <strong>{ESTADOS[proyecto.estado] ?? proyecto.estado}</strong>
          {proyecto.enviado
            ? ` · enviado el ${new Date(proyecto.enviado).toLocaleDateString("es-VE")}`
            : ""}
        </p>
        {aviso ? (
          <p className="po-nota po-nota-ok" role="status">
            {aviso}
          </p>
        ) : null}
        {fallo ? (
          <p className="po-campo-error" role="alert">
            {fallo}
          </p>
        ) : null}
        <div className="po-nota" role="status">
          <p>
            El alcance quedó congelado al enviar. Lo que no está descrito aquí se cotiza
            aparte, con su anexo y su precio.
          </p>
        </div>

        <section className="po-tarjeta" aria-labelledby="po-proyecto-datos">
          <h2 className="po-tarjeta-titulo" id="po-proyecto-datos">
            Alcance enviado
          </h2>
          <dl className="po-datos">
            <div>
              <dt>Categoría</dt>
              <dd>{proyecto.categoria}</dd>
            </div>
            <div>
              <dt>Dominio</dt>
              <dd>{proyecto.dominio}</dd>
            </div>
            <div>
              <dt>Buzones</dt>
              <dd>{proyecto.buzones.join(", ")}</dd>
            </div>
            <div>
              <dt>Complejidad</dt>
              <dd>{proyecto.complejidad}</dd>
            </div>
          </dl>
          <p className="po-texto-largo">{proyecto.alcance}</p>
        </section>

        <AnexoB plan={proyecto.plan} />
        <AnexoD condiciones={datos.condiciones} plan={proyecto.plan} />

        <p>
          <a className="po-boton po-boton-principal" href="/panel">
            Volver al panel
          </a>
        </p>
      </section>
    );
  }

  const puedeEnviar = Boolean(sesion.usuario.verificado && sesion.firma);

  return (
    <section className="po-pagina" aria-labelledby="po-proyecto-titulo">
      <p className="po-sello">Proyecto</p>
      <h1 className="po-titulo-pagina" id="po-proyecto-titulo">
        Describe tu proyecto.
      </h1>
      <p className="po-entrada">
        Lo que escribas aquí se convierte en el anexo A del contrato. Al enviar, el alcance
        se congela; las funciones que no estén descritas se cotizan aparte.
      </p>

      {!sesion.usuario.verificado ? (
        <div className="po-nota po-nota-aviso" role="alert">
          <p>
            Confirma tu correo para poder enviar el proyecto. Puedes guardar el borrador
            mientras tanto.
          </p>
        </div>
      ) : null}
      {!sesion.firma ? (
        <div className="po-nota po-nota-aviso" role="alert">
          <p>
            Registra tu firma en el <a href="/panel">panel</a> antes de enviar. Sin firma
            no hay quién se obligue al alcance descrito.
          </p>
        </div>
      ) : null}

      <form className="po-formulario" onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset className="po-grupo">
          <legend>El proyecto</legend>
          <Campo
            id="proyecto-nombre"
            etiqueta="Nombre del proyecto"
            valor={nombre}
            alCambiar={setNombre}
            ayuda="El nombre con el que aparecerá en el contrato y el acta de entrega."
            error={errores.nombre}
          />
          <div className="po-fila">
            <Campo
              id="proyecto-categoria"
              etiqueta="Categoría"
              modo="select"
              valor={categoria}
              alCambiar={setCategoria}
              error={errores.categoria}
            >
              {datos.categorias.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </Campo>
            <Campo
              id="proyecto-complejidad"
              etiqueta="Complejidad"
              modo="select"
              valor={complejidad}
              alCambiar={(valor) => setComplejidad(valor as Complejidad)}
              ayuda="La complejidad declarada orienta el plazo; no cambia el precio por sí sola."
            >
              {datos.complejidades.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </Campo>
          </div>
          <Campo
            id="proyecto-dominio"
            etiqueta="Dominio"
            valor={dominio}
            alCambiar={setDominio}
            ayuda="El dominio .com.ve se registra a tu nombre y Blink solo lo tramita."
            error={errores.dominio}
          />
        </fieldset>

        <fieldset className="po-grupo">
          <legend>Buzones</legend>
          <div className="po-campo">
            <label htmlFor="proyecto-no-reply">Buzón obligatorio</label>
            <input
              id="proyecto-no-reply"
              value={dominioLimpio ? `no-reply@${dominioLimpio}` : "no-reply@tu-dominio"}
              readOnly
              aria-describedby="proyecto-no-reply-ayuda"
            />
            <p className="po-campo-ayuda" id="proyecto-no-reply-ayuda">
              Se crea siempre a partir del dominio y se usa para las notificaciones de la
              aplicación.
            </p>
          </div>
          {buzones.map((buzon, indice) => (
            <div className="po-buzon" key={`buzon-${indice}`}>
              <div className="po-campo">
                <label htmlFor={`proyecto-buzon-${indice}`}>Buzón adicional {indice + 1}</label>
                <input
                  id={`proyecto-buzon-${indice}`}
                  type="email"
                  value={buzon}
                  onChange={(evento) => {
                    const copia = [...buzones];
                    copia[indice] = evento.target.value;
                    setBuzones(copia);
                  }}
                  placeholder={dominioLimpio ? `contacto@${dominioLimpio}` : "contacto@tu-dominio"}
                />
              </div>
              <button
                type="button"
                className="po-boton po-boton-suave po-boton-compacto"
                onClick={() => setBuzones(buzones.filter((_, i) => i !== indice))}
              >
                Quitar
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="po-boton po-boton-suave"
              onClick={() => setBuzones([...buzones, ""])}
              disabled={buzones.length >= 4}
            >
              Añadir buzón
            </button>
          </div>
          {errores.buzones ? (
            <p className="po-campo-error" role="alert">
              {errores.buzones}
            </p>
          ) : null}
          <p className="po-apagado">
            Hasta cinco buzones en total, incluido no-reply@. Todos deben pertenecer a
            {" "}
            {dominioLimpio ?? "tu dominio"}.
          </p>
        </fieldset>

        <fieldset className="po-grupo">
          <legend>Alcance</legend>
          <Campo
            id="proyecto-alcance"
            etiqueta="Qué incluye el proyecto"
            modo="area"
            valor={alcance}
            alCambiar={setAlcance}
            ayuda="Pantallas, funciones e integraciones que esperas. Lo que no esté aquí queda fuera."
            error={errores.alcance}
          />
          <p className="po-apagado">{alcance.trim().length} caracteres · mínimo 40</p>
        </fieldset>

        <fieldset className="po-grupo">
          <legend>Plan de infraestructura</legend>
          <div className="po-planes" role="radiogroup" aria-label="Plan de infraestructura">
            {datos.planes.flatMap((preset) =>
              preset.niveles.map((nivel) => {
                const elegido = nivel.clave === planClave && nivel.nivel === planNivel;
                return (
                  <label
                    className={elegido ? "po-plan po-plan-elegido" : "po-plan"}
                    key={`${nivel.clave}-${nivel.nivel}`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={`${nivel.clave}|${nivel.nivel}`}
                      checked={elegido}
                      onChange={() => {
                        setPlanClave(nivel.clave);
                        setPlanNivel(nivel.nivel);
                      }}
                    />
                    <span className="po-plan-cabecera">
                      <span className="po-plan-nombre">
                        {nivel.nombre} · {preset.nombre}
                      </span>
                      <span className="po-plan-precio">
                        {nivel.precio_usd === 0
                          ? "Sin costo mensual"
                          : `USD ${nivel.precio_usd}/mes`}
                      </span>
                    </span>
                    <span className="po-plan-limites">
                      {nivel.limites.map((l) => `${l.concepto}: ${l.valor}`).join(" · ")}
                    </span>
                  </label>
                );
              }),
            )}
          </div>
          {errores.plan ? (
            <p className="po-campo-error" role="alert">
              {errores.plan}
            </p>
          ) : null}
        </fieldset>

        {fallo ? (
          <p className="po-campo-error" role="alert">
            {fallo}
          </p>
        ) : null}
        {aviso ? (
          <p className="po-nota po-nota-ok" role="status">
            {aviso}
          </p>
        ) : null}

        <div className="po-firma-acciones">
          <button
            type="button"
            className="po-boton po-boton-suave"
            onClick={() => void enviar("guardar")}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            type="button"
            className="po-boton po-boton-principal"
            onClick={() => setConfirmando(true)}
            disabled={guardando || !puedeEnviar}
          >
            Revisar y enviar
          </button>
        </div>
        {!puedeEnviar ? (
          <p className="po-apagado">
            Para enviar hacen falta el correo confirmado y la firma registrada.
          </p>
        ) : null}

        {confirmando ? (
          <div className="po-aviso-legal" role="alert">
            <p>
              Al enviar, el alcance, los buzones, el dominio y el plan quedan congelados y
              se abre la etapa del contrato. Revisa el anexo B y el resumen del anexo D
              antes de continuar.
            </p>
            <div className="po-firma-acciones">
              <button
                type="button"
                className="po-boton po-boton-suave"
                onClick={() => setConfirmando(false)}
                disabled={guardando}
              >
                Volver
              </button>
              <button
                type="button"
                className="po-boton po-boton-principal"
                onClick={() => void enviar("enviar")}
                disabled={guardando}
              >
                {guardando ? "Enviando…" : "Confirmar envío"}
              </button>
            </div>
          </div>
        ) : null}
      </form>

      <AnexoB plan={plan} />
      <AnexoD condiciones={datos.condiciones} plan={plan} />
    </section>
  );
}
