import type { Filtros, Orden, Vehiculo } from "../tipos";

export const filtrosIniciales: Filtros = {
  consulta: "",
  marca: "",
  modelo: "",
  ciudad: "",
  tipo: "",
  combustible: "",
  transmision: "",
  condicion: "",
  vendedor: "",
  precioMin: "",
  precioMax: "",
  anioMin: "",
  anioMax: "",
  kmMax: "",
  verificado: false,
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function comoNumero(valor: string): number {
  return valor === "" ? Number.NaN : Number(valor);
}

export function aplicarFiltros(vehiculos: Vehiculo[], filtros: Filtros): Vehiculo[] {
  const consulta = normalizar(filtros.consulta);
  const precioMin = comoNumero(filtros.precioMin);
  const precioMax = comoNumero(filtros.precioMax);
  const anioMin = comoNumero(filtros.anioMin);
  const anioMax = comoNumero(filtros.anioMax);
  const kmMax = comoNumero(filtros.kmMax);

  return vehiculos.filter((vehiculo) => {
    const textoBuscable = normalizar(`${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio} ${vehiculo.ciudad} ${vehiculo.tipo}`);
    if (consulta && !textoBuscable.includes(consulta)) return false;
    if (filtros.marca && vehiculo.marca !== filtros.marca) return false;
    if (filtros.modelo && vehiculo.modelo !== filtros.modelo) return false;
    if (filtros.ciudad && vehiculo.ciudad !== filtros.ciudad) return false;
    if (filtros.tipo && vehiculo.tipo !== filtros.tipo) return false;
    if (filtros.combustible && vehiculo.combustible !== filtros.combustible) return false;
    if (filtros.transmision && vehiculo.transmision !== filtros.transmision) return false;
    if (filtros.condicion && vehiculo.condicion !== filtros.condicion) return false;
    if (filtros.vendedor && vehiculo.vendedor.tipo !== filtros.vendedor) return false;
    if (filtros.verificado && !vehiculo.vendedor.verificado) return false;
    if (!Number.isNaN(precioMin) && vehiculo.precio < precioMin) return false;
    if (!Number.isNaN(precioMax) && vehiculo.precio > precioMax) return false;
    if (!Number.isNaN(anioMin) && vehiculo.anio < anioMin) return false;
    if (!Number.isNaN(anioMax) && vehiculo.anio > anioMax) return false;
    if (!Number.isNaN(kmMax) && vehiculo.kilometraje > kmMax) return false;
    return true;
  });
}

export function ordenarVehiculos(vehiculos: Vehiculo[], orden: Orden): Vehiculo[] {
  return [...vehiculos].sort((a, b) => {
    if (orden === "precio-asc") return a.precio - b.precio;
    if (orden === "precio-desc") return b.precio - a.precio;
    if (orden === "anio-desc") return b.anio - a.anio;
    if (orden === "km-asc") return a.kilometraje - b.kilometraje;
    return b.publicadoEn - a.publicadoEn;
  });
}

export function contarFiltros(filtros: Filtros): number {
  return Object.entries(filtros).filter(([clave, valor]) => clave !== "consulta" && valor !== "" && valor !== false).length;
}

export function formatearPrecio(precio: number): string {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(precio);
}

export function formatearKilometraje(kilometraje: number): string {
  return `${new Intl.NumberFormat("es-VE").format(kilometraje)} km`;
}
