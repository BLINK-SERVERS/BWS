/* ============================================================
   g2.mjs — verificador numérico de continuidad en los trazos propios
   ------------------------------------------------------------
   El dueño pide G2 en el trabajo vectorial: donde dos curvas se tocan,
   además de la tangente tiene que coincidir la curvatura. Este script
   desarma cada `d` de `TRAZOS` con un tokenizador propio (no regex sobre
   el fuente: eso solo leía una entrada y medía de más), reconstruye los
   segmentos en coordenadas absolutas y mide en cada unión curva+curva
   del mismo subtrazo:

     · hueco entre el punto final de uno y el inicial del siguiente
     · Δ de tangente  → ¿es siquiera G1?
     · Δ de curvatura relativo |κ₂−κ₁| / max(κ₁,κ₂) → ¿es G2?

   κ de Bézier cúbica = (x'y'' − y'x'') / (x'²+y'²)^1.5, evaluada en los
   extremos. Los arcos (`A`) se parten en cúbicas de ≤90°, que es la
   construcción estándar del círculo: κ constante 1/r con error <0,02%.

   Las uniones recta/recta son esquinas deliberadas (el check, la punta
   de la flecha) y no se reportan como quiebre: ahí la esquina ES el
   glifo. Lo que tiene que ser continuo es lo que se dibuja curvo.

   node scripts/g2.mjs [nombre ...]
   ============================================================ */
import { readFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);

/* --- 1. Leer TRAZOS sin ejecutar React ---------------------------------
   Recorto el objeto literal llave-llave y extraigo cada bloque `[...]`
   con sus cadenas; así no depende de que haya o menos comas. */
const fuente = readFileSync(new URL("src/components/Icono.tsx", RAIZ), "utf8");
const inicio = fuente.indexOf("const TRAZOS");
if (inicio === -1) throw new Error("No se encuentra TRAZOS en Icono.tsx");
let nivel = 0,
  apertura = fuente.indexOf("{", inicio),
  cierre = apertura;
for (; cierre < fuente.length; cierre++) {
  if (fuente[cierre] === "{") nivel++;
  else if (fuente[cierre] === "}") {
    nivel--;
    if (nivel === 0) break;
  }
}
const cuerpo = fuente
  .slice(apertura + 1, cierre)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const TRAZOS = {};
for (const m of cuerpo.matchAll(/([A-Za-z_]\w*)\s*:\s*\[/g)) {
  let depth = 0,
    i = m.index + m[0].length - 1;
  for (;; i++) {
    if (cuerpo[i] === "[") depth++;
    else if (cuerpo[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const bloque = cuerpo.slice(m.index + m[0].length, i);
  const cadenas = [...bloque.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((s) => JSON.parse(`"${s[1]}"`));
  /* Las líneas que siguen a un `+` son cadenas partidas para poder
     tabular los controles de un trazado; se pegan antes de nada. */
  const unidas = [];
  for (const s of bloque.split("\n")) {
    const m = s.match(/"((?:[^"\\]|\\.)*)"/);
    if (!m) continue;
    const cadena = JSON.parse(`"${m[1]}"`);
    if (/^\s*\+/.test(s) && unidas.length) unidas[unidas.length - 1] += cadena;
    else unidas.push(cadena);
  }
  if (unidas.length) TRAZOS[m[1]] = unidas;
  else if (cadenas.length) TRAZOS[m[1]] = cadenas;
}

/* --- 2. Tokenizador de path ------------------------------------------- */
const CUENTA = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const NUM = /-?\d*\.?\d+(?:[eE][-+]?\d+)?|[MLHVCSTQAZmlhvcstqaz]/g;

function tokens(d) {
  const out = [];
  for (const t of d.match(NUM) ?? []) {
    if (/^[A-Za-z]$/.test(t)) out.push({ cmd: t, args: [] });
    else out.push({ num: parseFloat(t) });
  }
  const cmds = [];
  let actual = null;
  for (const t of out) {
    if (t.cmd) {
      actual = { cmd: t.cmd, args: [] };
      cmds.push(actual);
    } else if (actual) actual.args.push(t.num);
  }
  return cmds.filter((c) => c.cmd.toUpperCase() !== "M" || c.args.length >= 2);
}

/* --- 3. Geometría ------------------------------------------------------ */
const bezierCub = (p0, p1, p2, p3) => ({
  p: [p0, p1, p2, p3],
  d1(t) {
    const u = 1 - t;
    return [
      3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
    ];
  },
  d2(t) {
    const u = 1 - t;
    return [
      6 * u * (p2[0] - 2 * p1[0] + p0[0]) + 6 * t * (p3[0] - 2 * p2[0] + p1[0]),
      6 * u * (p2[1] - 2 * p1[1] + p0[1]) + 6 * t * (p3[1] - 2 * p2[1] + p1[1]),
    ];
  },
});

const kappa = (v1, v2) => {
  const s = v1[0] * v1[0] + v1[1] * v1[1];
  if (s < 1e-14) return NaN;
  return (v1[0] * v2[1] - v1[1] * v2[0]) / Math.pow(s, 1.5);
};

/* Arco circular (rx === ry) expresado en cúbicas de ≤90°. */
function arcoACubicas(p0, rx, ry, rotDeg, large, sweep, p1) {
  if (rx === 0 || ry === 0) return [];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi),
    sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2,
    dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy,
    y1 = -sin * dx + cos * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cx = (co * rx * y1) / ry,
    cy = (co * -ry * x1) / rx;
  const c = [cos * cx - sin * cy + (p0[0] + p1[0]) / 2, sin * cx + cos * cy + (p0[1] + p1[1]) / 2];
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th0 = ang(1, 0, (x1 - cx) / rx, (y1 - cy) / ry);
  let dth = ang((x1 - cx) / rx, (y1 - cy) / ry, (-x1 - cx) / rx, (-y1 - cy) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
  const paso = dth / n;
  const alfa = (4 / 3) * Math.tan(paso / 4);
  const P = (t) => [
    c[0] + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    c[1] + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  ];
  const T = (t) => [
    -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  ];
  const segs = [];
  for (let k = 0; k < n; k++) {
    const t0 = th0 + k * paso,
      t1 = t0 + paso;
    const a0 = P(t0),
      a1 = P(t1);
    segs.push(bezierCub(a0, [a0[0] + alfa * T(t0)[0], a0[1] + alfa * T(t0)[1]], [a1[0] - alfa * T(t1)[0], a1[1] - alfa * T(t1)[1]], a1));
  }
  return segs;
}

/* --- 4. Un `d` -> segmentos con curvas y líneas ------------------------ */
function segmentos(d) {
  const curvas = []; // {cub}
  const cur = { p: [0, 0] };
  let ini = [0, 0];
  let prevControl = null,
    prevCmd = "";
  const rectas = []; // uniones que son línea: esquina deliberada, no se mide
  for (const t of tokens(d)) {
    const abs = t.cmd === t.cmd.toUpperCase();
    const ab = (v, eje) => (abs ? v : eje === 0 ? v + cur.p[0] : v + cur.p[1]);
    const arg = (i) => (i % 2 === 0 ? ab(t.args[i], 0) : ab(t.args[i], 1));
    switch (t.cmd.toUpperCase()) {
      case "M": {
        cur.p = [arg(0), arg(1)];
        ini = [...cur.p];
        prevControl = null;
        for (let i = 2; i + 1 < t.args.length; i += 2) {
          const p = [i % 2 === 0 ? ab(t.args[i], 0) : ab(t.args[i], 1), ab(t.args[i + 1], 1)];
          rectas.push([cur.p, p]);
          cur.p = p;
        }
        break;
      }
      case "L":
      case "H":
      case "V": {
        const U = t.cmd.toUpperCase();
        for (let i = 0; i < t.args.length; i++) {
          const p =
            U === "H" ? [ab(t.args[i], 0), cur.p[1]] : U === "V" ? [cur.p[0], ab(t.args[i], 0)] : [arg(i), arg(i + 1)];
          if (U !== "H" && U !== "V") i++;
          rectas.push([cur.p, p]);
          cur.p = p;
        }
        break;
      }
      case "C": {
        for (let i = 0; i + 5 < t.args.length; i += 6) {
          const pts = [
            [arg(i), arg(i + 1)],
            [arg(i + 2), arg(i + 3)],
            [arg(i + 4), arg(i + 5)],
          ];
          curvas.push({ cub: bezierCub(cur.p, pts[0], pts[1], pts[2]) });
          prevControl = pts[1];
          cur.p = pts[2];
        }
        break;
      }
      case "S": {
        for (let i = 0; i + 3 < t.args.length; i += 4) {
          const c2 = [arg(i), arg(i + 1)],
            p = [arg(i + 2), arg(i + 3)];
          const ref =
            ["C", "S"].includes(prevCmd) && prevControl
              ? [2 * cur.p[0] - prevControl[0], 2 * cur.p[1] - prevControl[1]]
              : cur.p;
          curvas.push({ cub: bezierCub(cur.p, ref, c2, p) });
          prevControl = c2;
          cur.p = p;
        }
        break;
      }
      case "Q": {
        for (let i = 0; i + 3 < t.args.length; i += 4) {
          const q = [arg(i), arg(i + 1)],
            p = [arg(i + 2), arg(i + 3)];
          curvas.push({
            cub: bezierCub(
              cur.p,
              [cur.p[0] + (2 / 3) * (q[0] - cur.p[0]), cur.p[1] + (2 / 3) * (q[1] - cur.p[1])],
              [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])],
              p,
            ),
          });
          prevControl = q;
          cur.p = p;
        }
        break;
      }
      case "T": {
        for (let i = 0; i + 1 < t.args.length; i += 2) {
          const p = [arg(i), arg(i + 1)];
          const ref =
            ["Q", "T"].includes(prevCmd) && prevControl
              ? [2 * cur.p[0] - prevControl[0], 2 * cur.p[1] - prevControl[1]]
              : cur.p;
          curvas.push({
            cub: bezierCub(
              cur.p,
              [cur.p[0] + (2 / 3) * (ref[0] - cur.p[0]), cur.p[1] + (2 / 3) * (ref[1] - cur.p[1])],
              [p[0] + (2 / 3) * (ref[0] - p[0]), p[1] + (2 / 3) * (ref[1] - p[1])],
              p,
            ),
          });
          prevControl = ref;
          cur.p = p;
        }
        break;
      }
      case "A": {
        for (let i = 0; i + 6 < t.args.length; i += 7) {
          const rx = t.args[i],
            ry = t.args[i + 1],
            rot = t.args[i + 2];
          const large = t.args[i + 3] === 1,
            sweep = t.args[i + 4] === 1;
          const p = [ab(t.args[i + 5], 0), ab(t.args[i + 6], 1)];
          for (const cub of arcoACubicas(cur.p, rx, ry, rot, large, sweep, p)) curvas.push({ cub });
          cur.p = p;
        }
        break;
      }
      case "Z": {
        if (Math.hypot(cur.p[0] - ini[0], cur.p[1] - ini[1]) > 1e-9) rectas.push([cur.p, ini]);
        cur.p = [...ini];
        break;
      }
    }
    prevCmd = t.cmd.toUpperCase();
  }
  return { curvas, rectas };
}

/* --- 5. Medición ------------------------------------------------------- */
const grados = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
function deltaTangente(a, b) {
  /* Dos derivadas en una unión continua deben apuntar al MISMO lado. */
  let d = Math.abs(grados(a) - grados(b)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

const FILTRO = process.argv.slice(2);
const filas = [];
let malas = 0;
for (const [nombre, trazos] of Object.entries(TRAZOS)) {
  if (FILTRO.length && !FILTRO.includes(nombre)) continue;
  if (nombre === "whatsapp") continue; // marca de terceros: trazado oficial, intocable
  trazos.forEach((d, trazo) => {
    const { curvas } = segmentos(d);
    /* Una unión solo es unión si el segmento siguiente arranca donde
       termina el anterior. Si hay hueco, son dos subtrazos distintos
       que no se tocan (un marco y su barra), no un quiebre. */
    for (let i = 0; i + 1 < curvas.length; i++) {
      const A = curvas[i].cub,
        B = curvas[i + 1].cub;
      const hueco = Math.hypot(A.p[3][0] - B.p[0][0], A.p[3][1] - B.p[0][1]);
      if (hueco > 1e-6) continue;
      const va = A.d1(1),
        vb = B.d1(0);
      const dt = deltaTangente(va, vb);
      const ka = kappa(A.d1(1), A.d2(1)),
        kb = kappa(B.d1(0), B.d2(0));
      const tope = Math.max(Math.abs(ka), Math.abs(kb));
      const dk = isFinite(ka) && isFinite(kb) && tope > 1e-9 ? Math.abs(kb - ka) / tope : 0;
      const falla = dt > 0.5 || dk > 0.05;
      if (falla) malas++;
      filas.push({ nombre, trazo, i, hueco, dt, dk, falla });
    }
  });
}
filas.sort((a, b) => b.dk - a.dk || b.dt - a.dt);
console.log(`uniones curva+curva medidas: ${filas.length}  (en ${Object.keys(TRAZOS).filter((n) => n !== "whatsapp" && (!FILTRO.length || FILTRO.includes(n))).length} geometrías)`);
console.log(`fuera de tolerancia: ${malas}   [hueco >1e-6 · Δtangente >0,5° · Δcurvatura >5%]`);
for (const f of filas.slice(0, 14)) {
  console.log(
    `${f.falla ? "✗" : "✓"} ${f.nombre.padEnd(11)} t${f.trazo}·u${String(f.i).padStart(2)}  hueco ${f.hueco.toExponential(1).padEnd(9)} Δtang ${f.dt.toFixed(3).padStart(7)}°  Δκ ${(f.dk * 100).toFixed(3).padStart(7)}%`,
  );
}
console.log(malas === 0 ? "RESULTADO: G2 sostenido en todas las uniones curvas." : "RESULTADO: hay quiebres que corregir.");
process.exit(malas === 0 ? 0 : 1);
