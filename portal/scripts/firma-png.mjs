/* Genera dos PNG de firma de muestra, deterministas, para los PDF locales.
   No son firmas de nadie: son trazos sintéticos para probar el estampado.
   Se dibujan píxel a píxel y se codifican con node:zlib, sin dependencias. */

import { deflateSync } from "node:zlib";

const TABLA = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABLA[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const filas = [];
  for (let y = 0; y < alto; y++) {
    filas.push(Buffer.from([0]));
    filas.push(rgba.subarray(y * ancho * 4, (y + 1) * ancho * 4));
  }
  const datos = deflateSync(Buffer.concat(filas), { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", datos),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mezclarPixel(rgba, ancho, alto, x, y, alpha) {
  if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
  const i = (y * ancho + x) * 4;
  const a = Math.max(0, Math.min(255, Math.round(alpha)));
  const previo = rgba[i + 3] / 255;
  const nuevo = a / 255 + previo * (1 - a / 255);
  if (nuevo <= 0) return;
  const tinta = [29, 29, 31];
  for (let c = 0; c < 3; c++) {
    rgba[i + c] = Math.round((tinta[c] * (a / 255) + rgba[i + c] * previo * (1 - a / 255)) / nuevo);
  }
  rgba[i + 3] = Math.round(nuevo * 255);
}

function disco(rgba, ancho, alto, cx, cy, radio) {
  const x0 = Math.floor(cx - radio - 1);
  const x1 = Math.ceil(cx + radio + 1);
  const y0 = Math.floor(cy - radio - 1);
  const y1 = Math.ceil(cy + radio + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radio + 1) mezclarPixel(rgba, ancho, alto, x, y, (radio + 1 - d) * 160);
    }
  }
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0],
    y: u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1],
  };
}

const TRAZOS = {
  representante: [
    [[70, 110], [130, 40], [195, 42], [250, 95]],
    [[250, 95], [300, 140], [380, 132], [445, 75]],
    [[445, 75], [487, 35], [553, 40], [590, 90]],
    [[590, 90], [617, 128], [658, 120], [667, 84]],
  ],
  cliente: [
    [[60, 95], [110, 50], [168, 46], [205, 85]],
    [[205, 85], [245, 128], [322, 120], [378, 68]],
    [[378, 68], [426, 26], [495, 36], [525, 82]],
    [[525, 82], [558, 133], [620, 118], [648, 70]],
    [[145, 138], [285, 130], [450, 135], [576, 128]],
  ],
};

export function firmaPNG(variante = "cliente") {
  // Misma proporción que el lienzo recortado: 720 × 160 (4.5:1).
  const ancho = 720;
  const alto = 160;
  const rgba = Buffer.alloc(ancho * alto * 4);
  const trazos = TRAZOS[variante] ?? TRAZOS.cliente;
  trazos.forEach(([p0, p1, p2, p3], indice) => {
    const pasos = 700;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const { x, y } = bezier(p0, p1, p2, p3, t);
      const radio = 1.8 + 0.7 * Math.sin(Math.PI * t + indice);
      disco(rgba, ancho, alto, x, y, radio);
    }
  });
  return png(ancho, alto, rgba);
}
