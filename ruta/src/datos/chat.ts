import type { Conversacion } from "../tipos";

export const conversacionesDemo: Conversacion[] = [
  {
    id: "conv-corolla",
    vehiculoId: "corolla-2018",
    noLeidos: 2,
    mensajes: [
      { id: "m1", autor: "yo", texto: "Hola, ¿el Corolla sigue disponible?", hora: "10:12" },
      { id: "m2", autor: "vendedor", texto: "Hola, sí. Puedes verlo mañana después de las 4 de la tarde.", hora: "10:14" },
      { id: "m3", autor: "yo", texto: "Perfecto. ¿Me confirmas la ubicación para coordinarnos por Car Market?", hora: "10:16" },
      { id: "m4", autor: "vendedor", texto: "Claro, te comparto el punto exacto cuando confirmes la hora. Quedo atento.", hora: "10:18" },
    ],
  },
  {
    id: "conv-sportage",
    vehiculoId: "sportage-2021",
    noLeidos: 0,
    mensajes: [
      { id: "m5", autor: "yo", texto: "Hola, ¿tiene historial de mantenimiento?", hora: "Ayer" },
      { id: "m6", autor: "vendedor", texto: "Sí, lo tenemos completo. Te lo enseño en la cita.", hora: "Ayer" },
    ],
  },
  {
    id: "conv-explorer",
    vehiculoId: "explorer-2016",
    noLeidos: 1,
    mensajes: [
      { id: "m7", autor: "yo", texto: "Buenas, ¿la tercera fila está operativa?", hora: "Lun" },
      { id: "m8", autor: "vendedor", texto: "Sí, funciona y abate completa. También incluyo dos apoyacabezas.", hora: "Lun" },
    ],
  },
];
