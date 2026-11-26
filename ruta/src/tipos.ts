export type TipoCarroceria = "Sedán" | "SUV" | "Hatchback" | "Pickup";
export type TipoVendedor = "Particular" | "Concesionario";

export interface Foto {
  src: string;
  srcSet: string;
  alt: string;
}

export interface Vendedor {
  nombre: string;
  tipo: TipoVendedor;
  verificado: boolean;
  iniciales: string;
  miembroDesde: string;
}

export interface Vehiculo {
  id: string;
  marca: string;
  modelo: string;
  anio: number;
  precio: number;
  kilometraje: number;
  ciudad: "Maracaibo" | "San Francisco";
  sector: string;
  tipo: TipoCarroceria;
  combustible: "Gasolina" | "Diésel" | "Híbrido";
  transmision: "Automática" | "Manual";
  condicion: "Excelente" | "Muy buena" | "Buena";
  color: string;
  vendedor: Vendedor;
  fotos: Foto[];
  descripcion: string;
  caracteristicas: string[];
  publicadoEn: number;
  esNuevo?: boolean;
}

export interface Mensaje {
  id: string;
  autor: "yo" | "vendedor";
  texto: string;
  hora: string;
}

export interface Conversacion {
  id: string;
  vehiculoId: string;
  noLeidos: number;
  mensajes: Mensaje[];
}

export interface Filtros {
  consulta: string;
  marca: string;
  modelo: string;
  ciudad: string;
  tipo: string;
  combustible: string;
  transmision: string;
  condicion: string;
  vendedor: string;
  precioMin: string;
  precioMax: string;
  anioMin: string;
  anioMax: string;
  kmMax: string;
  verificado: boolean;
}

export type Orden = "recientes" | "precio-asc" | "precio-desc" | "anio-desc" | "km-asc";
