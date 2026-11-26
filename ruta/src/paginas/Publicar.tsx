import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import type { Foto, TipoCarroceria, Vehiculo } from "../tipos";
import { formatearKilometraje, formatearPrecio } from "../datos/filtros";
import { marcas } from "../datos/vehiculos";
import { Icono } from "../componentes/Icono";

interface PublicarProps {
  onPublicar: (vehiculo: Vehiculo) => void;
  onAviso: (mensaje: string) => void;
}

interface FotoPendiente {
  id: string;
  archivo?: File;
  demo?: boolean;
}

interface FormularioPublicacion {
  marca: string;
  modelo: string;
  anio: string;
  kilometraje: string;
  ciudad: string;
  sector: string;
  tipo: string;
  combustible: string;
  transmision: string;
  condicion: string;
  color: string;
  precio: string;
  descripcion: string;
}

const formularioInicial: FormularioPublicacion = {
  marca: "",
  modelo: "",
  anio: "",
  kilometraje: "",
  ciudad: "",
  sector: "",
  tipo: "",
  combustible: "",
  transmision: "",
  condicion: "",
  color: "",
  precio: "",
  descripcion: "",
};

const pasos = [
  { numero: 1, titulo: "Vehículo", texto: "Marca, modelo y uso" },
  { numero: 2, titulo: "Fotos y precio", texto: "Cómo se ve y cuánto cuesta" },
  { numero: 3, titulo: "Revisar", texto: "Confirma la publicación" },
];

function leerComoDatos(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => typeof lector.result === "string" ? resolve(lector.result) : reject(new Error("No se pudo leer la imagen"));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.readAsDataURL(archivo);
  });
}

export function Publicar({ onPublicar, onAviso }: PublicarProps) {
  const [paso, setPaso] = useState(1);
  const [formulario, setFormulario] = useState<FormularioPublicacion>(formularioInicial);
  const [fotos, setFotos] = useState<FotoPendiente[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmado, setConfirmado] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const resumenRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  const previstas = useMemo(
    () => fotos.map((foto) => ({ ...foto, url: foto.archivo ? URL.createObjectURL(foto.archivo) : `${import.meta.env.BASE_URL}fotos/photo-f203245941-960.webp` })),
    [fotos],
  );

  useEffect(() => () => previstas.forEach((foto) => foto.archivo && URL.revokeObjectURL(foto.url)), [previstas]);

  function cambiar(campo: keyof FormularioPublicacion, valor: string) {
    setFormulario({ ...formulario, [campo]: valor });
    if (errores[campo]) setErrores({ ...errores, [campo]: "" });
  }

  function validarPaso(numero: number): boolean {
    const nuevos: Record<string, string> = {};
    if (numero === 1) {
      if (!formulario.marca) nuevos.marca = "Elige la marca.";
      if (!formulario.modelo.trim()) nuevos.modelo = "Escribe el modelo.";
      if (!formulario.anio || Number(formulario.anio) < 1950 || Number(formulario.anio) > 2027) nuevos.anio = "Escribe un año entre 1950 y 2027.";
      if (formulario.kilometraje === "" || Number(formulario.kilometraje) < 0) nuevos.kilometraje = "Escribe el kilometraje.";
      if (!formulario.ciudad) nuevos.ciudad = "Elige la ciudad.";
      if (!formulario.sector.trim()) nuevos.sector = "Escribe el sector o urbanización.";
      if (!formulario.tipo) nuevos.tipo = "Elige el tipo de carro.";
      if (!formulario.combustible) nuevos.combustible = "Elige el combustible.";
      if (!formulario.transmision) nuevos.transmision = "Elige la transmisión.";
      if (!formulario.condicion) nuevos.condicion = "Elige la condición.";
    }
    if (numero === 2) {
      if (fotos.length === 0) nuevos.fotos = "Agrega al menos una foto.";
      if (!formulario.precio || Number(formulario.precio) <= 0) nuevos.precio = "Escribe un precio mayor que cero.";
      if (formulario.descripcion.trim().length < 30) nuevos.descripcion = "Describe el carro en al menos 30 caracteres.";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  }

  function continuar(event: FormEvent) {
    event.preventDefault();
    if (!validarPaso(paso)) return;
    setPaso((actual) => Math.min(3, actual + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function agregarArchivos(lista: FileList | File[]) {
    const entradas = Array.from(lista);
    const validos = entradas.filter((archivo) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
        onAviso("Usa fotos JPG, PNG o WebP.");
        return false;
      }
      if (archivo.size > 8 * 1024 * 1024) {
        onAviso("Cada foto debe pesar menos de 8 MB.");
        return false;
      }
      return true;
    });
    setFotos((actuales) => [...actuales, ...validos.map((archivo) => ({ id: crypto.randomUUID(), archivo }))].slice(0, 8));
    if (validos.length) setErrores({ ...errores, fotos: "" });
  }

  function alElegirArchivos(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) agregarArchivos(event.target.files);
    event.target.value = "";
  }

  function alSoltar(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setArrastrando(false);
    if (event.dataTransfer.files.length) agregarArchivos(event.dataTransfer.files);
  }

  function usarFotoDemo() {
    if (fotos.some((foto) => foto.demo)) return;
    setFotos((actuales) => [...actuales, { id: "foto-demo", demo: true }].slice(0, 8));
    setErrores({ ...errores, fotos: "" });
  }

  async function publicar(event: FormEvent) {
    event.preventDefault();
    if (!validarPaso(2) || !confirmado) return;
    setPublicando(true);
    try {
      const fotosFinales: Foto[] = await Promise.all(
        previstas.map(async (foto, indice) => {
          if (foto.archivo) {
            const datos = await leerComoDatos(foto.archivo);
            return { src: datos, srcSet: datos, alt: `Foto ${indice + 1} del ${formulario.marca} ${formulario.modelo}` };
          }
          return {
            src: foto.url,
            srcSet: `${import.meta.env.BASE_URL}fotos/photo-f203245941-500.webp 500w, ${import.meta.env.BASE_URL}fotos/photo-f203245941-960.webp 960w`,
            alt: "Toyota Corolla blanco, fotografía de demostración",
          };
        }),
      );
      const caracteristicas = [formulario.color && `Color ${formulario.color}`, formulario.transmision, formulario.combustible].filter(Boolean) as string[];
      onPublicar({
        id: `publicacion-${crypto.randomUUID()}`,
        marca: formulario.marca,
        modelo: formulario.modelo.trim(),
        anio: Number(formulario.anio),
        precio: Number(formulario.precio),
        kilometraje: Number(formulario.kilometraje),
        ciudad: formulario.ciudad as Vehiculo["ciudad"],
        sector: formulario.sector.trim(),
        tipo: formulario.tipo as TipoCarroceria,
        combustible: formulario.combustible as Vehiculo["combustible"],
        transmision: formulario.transmision as Vehiculo["transmision"],
        condicion: formulario.condicion as Vehiculo["condicion"],
        color: formulario.color.trim() || "No indicado",
        vendedor: { nombre: "Tu cuenta", tipo: "Particular", verificado: false, iniciales: "TÚ", miembroDesde: "esta sesión" },
        fotos: fotosFinales,
        descripcion: formulario.descripcion.trim(),
        caracteristicas,
        publicadoEn: Date.now(),
        esNuevo: false,
      });
    } catch {
      onAviso("No pudimos preparar las fotos. Intenta con imágenes más pequeñas.");
      setPublicando(false);
    }
  }

  const error = (campo: string) => errores[campo] ? <span className="campo__error" id={`error-${campo}`}>{errores[campo]}</span> : null;
  const accesibilidad = (campo: string) => errores[campo] ? { "aria-invalid": true, "aria-describedby": `error-${campo}` } : {};

  return (
    <div className="pagina publicar">
      <nav className="migas"><a href="#/"><Icono nombre="flecha-izquierda" tamano={17} />Volver a explorar</a></nav>
      <header className="publicar__cabecera">
        <p className="eyebrow">Vende desde Ruta</p>
        <h1>Publica tu carro.</h1>
        <p>Cuenta lo que ofreces, muestra el estado real y recibe mensajes de compradores interesados.</p>
      </header>

      <div className="publicar__aviso"><Icono nombre="info" /><p><strong>Este prototipo guarda la publicación sólo en este navegador.</strong> La verificación de identidad, la revisión y el almacenamiento definitivo se conectarán al backend.</p></div>

      <div className="publicar__diseno">
        <aside className="pasos" aria-label="Progreso de publicación">
          {pasos.map((item) => (
            <button key={item.numero} type="button" className={`paso ${paso === item.numero ? "is-active" : ""} ${paso > item.numero ? "is-completo" : ""}`} onClick={() => item.numero < paso && setPaso(item.numero)} disabled={item.numero > paso} aria-current={paso === item.numero ? "step" : undefined}>
              <span className="paso__numero">{paso > item.numero ? <Icono nombre="check" tamano={17} /> : item.numero}</span>
              <span><strong>{item.titulo}</strong><small>{item.texto}</small></span>
            </button>
          ))}
          <div className="pasos__consejo"><Icono nombre="camara" /><p><strong>Fotos claras, mejores conversaciones.</strong> Incluye frente, atrás, interior y tablero. Evita filtros que cambien el color.</p></div>
        </aside>

        <div className="publicar__formulario">
          {paso === 1 && (
            <form onSubmit={continuar} noValidate>
              <div className="formulario__titulo"><span>Paso 1 de 3</span><h2>Datos del vehículo</h2><p>Usa la información de los documentos del carro.</p></div>
              <div className="campos-2">
                <label className="campo"><span>Marca</span><input list="marcas" value={formulario.marca} onChange={(event) => cambiar("marca", event.target.value)} placeholder="Ej. Toyota" required {...accesibilidad("marca")} />{error("marca")}</label>
                <datalist id="marcas">{marcas.map((marca) => <option key={marca} value={marca} />)}</datalist>
                <label className="campo"><span>Modelo</span><input value={formulario.modelo} onChange={(event) => cambiar("modelo", event.target.value)} placeholder="Ej. Corolla" required {...accesibilidad("modelo")} />{error("modelo")}</label>
                <label className="campo"><span>Año</span><input type="number" min="1950" max="2027" inputMode="numeric" value={formulario.anio} onChange={(event) => cambiar("anio", event.target.value)} placeholder="2018" required {...accesibilidad("anio")} />{error("anio")}</label>
                <label className="campo"><span>Kilometraje</span><input type="number" min="0" inputMode="numeric" value={formulario.kilometraje} onChange={(event) => cambiar("kilometraje", event.target.value)} placeholder="92000" required {...accesibilidad("kilometraje")} />{error("kilometraje")}</label>
              </div>
              <div className="campos-2">
                <label className="campo"><span>Tipo de carro</span><select value={formulario.tipo} onChange={(event) => cambiar("tipo", event.target.value)} required {...accesibilidad("tipo")}><option value="">Elige una opción</option>{["Sedán", "SUV", "Hatchback", "Pickup"].map((tipo) => <option key={tipo}>{tipo}</option>)}</select>{error("tipo")}</label>
                <label className="campo"><span>Condición</span><select value={formulario.condicion} onChange={(event) => cambiar("condicion", event.target.value)} required {...accesibilidad("condicion")}><option value="">Elige una opción</option>{["Excelente", "Muy buena", "Buena"].map((condicion) => <option key={condicion}>{condicion}</option>)}</select>{error("condicion")}</label>
                <label className="campo"><span>Combustible</span><select value={formulario.combustible} onChange={(event) => cambiar("combustible", event.target.value)} required {...accesibilidad("combustible")}><option value="">Elige una opción</option>{["Gasolina", "Diésel", "Híbrido"].map((combustible) => <option key={combustible}>{combustible}</option>)}</select>{error("combustible")}</label>
                <label className="campo"><span>Transmisión</span><select value={formulario.transmision} onChange={(event) => cambiar("transmision", event.target.value)} required {...accesibilidad("transmision")}><option value="">Elige una opción</option><option>Automática</option><option>Manual</option></select>{error("transmision")}</label>
              </div>
              <div className="campos-2">
                <label className="campo"><span>Ciudad</span><select value={formulario.ciudad} onChange={(event) => cambiar("ciudad", event.target.value)} required {...accesibilidad("ciudad")}><option value="">Elige una opción</option><option>Maracaibo</option><option>San Francisco</option></select>{error("ciudad")}</label>
                <label className="campo"><span>Sector o urbanización</span><input value={formulario.sector} onChange={(event) => cambiar("sector", event.target.value)} placeholder="Ej. La Lago" maxLength={80} required {...accesibilidad("sector")} />{error("sector")}</label>
              </div>
              <label className="campo"><span>Color <small>(opcional)</small></span><input value={formulario.color} onChange={(event) => cambiar("color", event.target.value)} placeholder="Ej. Blanco" maxLength={40} /></label>
              <div className="formulario__acciones"><span /><button className="boton boton--primario" type="submit">Continuar<Icono nombre="flecha-derecha" tamano={18} /></button></div>
            </form>
          )}

          {paso === 2 && (
            <form onSubmit={continuar} noValidate>
              <div className="formulario__titulo"><span>Paso 2 de 3</span><h2>Fotos y precio</h2><p>Agrega hasta 8 fotos. La primera será la portada.</p></div>
              <div className={`zona-fotos ${arrastrando ? "is-arrastrando" : ""} ${errores.fotos ? "has-error" : ""}`} onDragOver={(event) => { event.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={alSoltar}>
                <span className="zona-fotos__icono"><Icono nombre="galeria" tamano={30} /></span>
                <h3>Arrastra tus fotos aquí</h3>
                <p>JPG, PNG o WebP · hasta 8 MB por foto</p>
                <button className="boton boton--secundario" type="button" onClick={() => entradaRef.current?.click()}><Icono nombre="agregar" tamano={18} />Elegir fotos</button>
                <input ref={entradaRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={alElegirArchivos} tabIndex={-1} />
                {error("fotos")}
              </div>
              <button className="boton boton--terciario usar-demo" type="button" onClick={usarFotoDemo} disabled={fotos.some((foto) => foto.demo)}><Icono nombre="imagen" tamano={18} />{fotos.some((foto) => foto.demo) ? "Foto de demostración agregada" : "Usar una foto de demostración"}</button>
              {previstas.length > 0 && <div className="fotos-preview" aria-label="Fotos seleccionadas">{previstas.map((foto, indice) => <div key={foto.id} className="fotos-preview__item"><img src={foto.url} alt={`Vista previa ${indice + 1}`} />{indice === 0 && <span>Portada</span>}<button className="boton-icono boton-icono--flotante" type="button" onClick={() => setFotos((actuales) => actuales.filter((item) => item.id !== foto.id))} aria-label={`Quitar foto ${indice + 1}`}><Icono nombre="basura" tamano={18} /></button></div>)}</div>}
              <div className="separador" />
              <label className="campo campo--precio"><span>Precio en dólares</span><div className="campo__prefijo"><span>$</span><input type="number" min="1" step="100" inputMode="decimal" value={formulario.precio} onChange={(event) => cambiar("precio", event.target.value)} placeholder="14500" required {...accesibilidad("precio")} /></div>{error("precio")}</label>
              <label className="campo"><span>Descripción</span><textarea rows={5} minLength={30} maxLength={1200} value={formulario.descripcion} onChange={(event) => cambiar("descripcion", event.target.value)} placeholder="Cuenta el estado real, mantenimiento reciente y detalles que el comprador debe conocer." required {...accesibilidad("descripcion")} />{error("descripcion")}<small className="campo__ayuda">{formulario.descripcion.length} / 1200 caracteres</small></label>
              <div className="formulario__acciones"><button className="boton boton--secundario" type="button" onClick={() => setPaso(1)}><Icono nombre="flecha-izquierda" tamano={18} />Atrás</button><button className="boton boton--primario" type="submit">Revisar<Icono nombre="flecha-derecha" tamano={18} /></button></div>
            </form>
          )}

          {paso === 3 && (
            <form onSubmit={publicar}>
              <div className="formulario__titulo"><span>Paso 3 de 3</span><h2>Revisa tu publicación</h2><p>Así la verán los compradores.</p></div>
              <div className="revision" ref={resumenRef}>
                <img src={previstas[0]?.url} alt="Foto de portada seleccionada" />
                <div><span className="etiqueta etiqueta--verificado">Vista previa</span><h3>{formulario.marca} {formulario.modelo} {formulario.anio}</h3><strong>{formatearPrecio(Number(formulario.precio))}</strong><p><Icono nombre="ubicacion" tamano={16} />{formulario.ciudad} · {formulario.sector}</p><span>{formatearKilometraje(Number(formulario.kilometraje))} · {formulario.transmision} · {formulario.combustible}</span></div>
              </div>
              <dl className="revision__datos"><div><dt>Tipo</dt><dd>{formulario.tipo}</dd></div><div><dt>Condición</dt><dd>{formulario.condicion}</dd></div><div><dt>Fotos</dt><dd>{fotos.length}</dd></div><div><dt>Vendedor</dt><dd>Tu cuenta</dd></div></dl>
              <div className="revision__descripcion"><h3>Descripción</h3><p>{formulario.descripcion}</p></div>
              <label className="confirmacion"><input type="checkbox" checked={confirmado} onChange={(event) => setConfirmado(event.target.checked)} required /><span>Confirmo que la información es correcta y que las fotos corresponden a este carro.</span></label>
              <div className="aviso-demo"><Icono nombre="info" /><p>Al publicar, el carro aparecerá en este prototipo y podrás abrir su detalle. No se enviará a otros usuarios.</p></div>
              <div className="formulario__acciones"><button className="boton boton--secundario" type="button" onClick={() => setPaso(2)} disabled={publicando}><Icono nombre="flecha-izquierda" tamano={18} />Atrás</button><button className="boton boton--primario" type="submit" disabled={!confirmado || publicando}>{publicando ? "Preparando publicación…" : "Publicar carro"}<Icono nombre="publicar" tamano={18} /></button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
