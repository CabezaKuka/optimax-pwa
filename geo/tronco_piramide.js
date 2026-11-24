// Tronco de pirámide rectangular (fondo de tolva), con la boca menor centrada o descentrada.
// Port de desarrollos/tronco_piramide.py. Las dos funciones de shapely que usa el escritorio (rectángulo mínimo y
// polígono válido) están hechas acá, sin librerías.
import { Param, PiezaGen, fmt, trad } from "./base.js";

const TOL = 1e-9;

// ------------------------------------------------------------------ geometría 3D
/** [superiores, inferiores]: 4 esquinas de cada boca, antihorario visto desde arriba. La boca mayor (A × B) está a
 * la altura h, centrada; la menor (a × b) a z = 0, corrida (x, y). */
export function vertices(A, B, a, b, x, y, h) {
  const sup = [[A / 2, B / 2, h], [-A / 2, B / 2, h], [-A / 2, -B / 2, h], [A / 2, -B / 2, h]];
  const inf = [[x + a / 2, y + b / 2, 0.0], [x - a / 2, y + b / 2, 0.0], [x - a / 2, y - b / 2, 0.0],
    [x + a / 2, y - b / 2, 0.0]];
  return [sup, inf];
}

/** Corrida horizontal de cada cara (0 = lado +y, 1 = −x, 2 = −y, 3 = +x). Negativa = voladizo. */
export function corridas(A, B, a, b, x, y) {
  return [B / 2 - y - b / 2, A / 2 + x - a / 2, B / 2 + y - b / 2, A / 2 - x - a / 2];
}

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const unit = (p) => { const n = Math.sqrt(dot(p, p)); return [p[0] / n, p[1] / n, p[2] / n]; };
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mod = (i, n) => ((i % n) + n) % n;

/** Cara k (entre las esquinas k y k+1) en su plano: [T0, T1, B1, B0], T0 en el origen, T0→T1 sobre x. */
export function cara2d(sup, inf, k) {
  const T0 = sup[k], T1 = sup[(k + 1) % 4], B0 = inf[k], B1 = inf[(k + 1) % 4];
  const ex = unit(sub(T1, T0));
  const d = sub(B0, T0);
  const de = dot(d, ex);
  const ey = unit([0, 1, 2].map((i) => d[i] - de * ex[i]));
  const out = [T0, T1, B1, B0].map((P) => { const w = sub(P, T0); return [dot(w, ex), dot(w, ey)]; });
  const n = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
  if (Math.abs(dot(sub(B1, T0), n)) > 1e-6) throw new Error("Las bocas no son paralelas: la cara no es plana.");
  return out;
}

/** Pone las caras una a continuación de la otra, girando cada una sobre la arista que comparte con la anterior. */
export function encadenar(caras) {
  const col = [caras[0].slice()];
  for (const c of caras.slice(1)) {
    const prev = col[col.length - 1];
    const P = prev[1], Q = prev[2];
    const a0 = c[0], b0 = c[3];
    if (Math.abs(d2(P, Q) - d2(a0, b0)) > 1e-6) throw new Error("Las caras no comparten la arista (error de geometría).");
    const giro = Math.atan2(Q[1] - P[1], Q[0] - P[0]) - Math.atan2(b0[1] - a0[1], b0[0] - a0[0]);
    const cs = Math.cos(giro), sn = Math.sin(giro);
    col.push(c.map((v) => {
      const dx = v[0] - a0[0], dy = v[1] - a0[1];
      return [P[0] + dx * cs - dy * sn, P[1] + dx * sn + dy * cs];
    }));
  }
  return col;
}

/** Caras en 'orden' desarrolladas en una tira: [contorno, pliegues, caras]. */
export function desarrollar(sup, inf, orden) {
  const col = encadenar(orden.map((k) => cara2d(sup, inf, mod(k, 4))));
  const sup2 = [col[0][0], ...col.map((c) => c[1])];
  const inf2 = [col[0][3], ...col.map((c) => c[2])];
  const contorno = [...sup2, ...[...inf2].reverse()];
  const pliegues = [];
  for (let j = 1; j < col.length; j++) pliegues.push([sup2[j], inf2[j]]);
  return [contorno, pliegues, col];
}

// ------------------------------------------------------------------ reemplazos de shapely
/** Envolvente convexa (cadena monótona), en sentido horario, empezando por el punto más bajo (y, después x),
 * como la de GEOS. */
export function envolvente(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) {
    while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (hi.length >= 2 && cruz(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  const ccw = lo.slice(0, -1).concat(hi.slice(0, -1));
  const cw = ccw.reverse();
  let k0 = 0;
  cw.forEach((q, i) => { if (q[1] < cw[k0][1] || (q[1] === cw[k0][1] && q[0] < cw[k0][0])) k0 = i; });
  return cw.slice(k0).concat(cw.slice(0, k0));
}

/** Rectángulo de área mínima (un lado sobre una arista de la envolvente): 4 esquinas en el orden base-mín,
 * base-máx, opuesto-máx, opuesto-mín. Primera arista de área mínima (estricto), como GEOS. */
export function rectanguloMinimo(pts) {
  const h = envolvente(pts);
  let mejor = null;
  for (let i = 0; i < h.length; i++) {
    const p = h[i], q = h[(i + 1) % h.length];
    const L = d2(p, q);
    if (L < 1e-12) continue;
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
    let mn = Infinity, mx = -Infinity, op = 0;
    for (const s of h) {
      const a = (s[0] - p[0]) * ux + (s[1] - p[1]) * uy;
      const b = -(s[0] - p[0]) * uy + (s[1] - p[1]) * ux;
      mn = Math.min(mn, a); mx = Math.max(mx, a);
      if (Math.abs(b) > Math.abs(op)) op = b;
    }
    const area = (mx - mn) * Math.abs(op);
    if (!mejor || area < mejor.area) mejor = { area, p, ux, uy, mn, mx, op };
  }
  const { p, ux, uy, mn, mx, op } = mejor;
  const en = (a, b) => [p[0] + a * ux - b * uy, p[1] + a * uy + b * ux];
  return [en(mn, 0), en(mx, 0), en(mx, op), en(mn, op)];
}

/** ¿Polígono simple y con área (lo que el escritorio controla con shapely is_valid y area > 0)? */
export function poligonoValido(pts) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (!(Math.abs(area / 2) > 0)) return false;
  const orient = (a, b, c) => {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
  };
  const enSeg = (a, b, c) => Math.min(a[0], b[0]) - 1e-9 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    Math.min(a[1], b[1]) - 1e-9 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-9;
  const cortan = (a, b, c, d) => {
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4 && o1 * o2 <= 0 && o3 * o4 <= 0 && (o1 !== 0 || o2 !== 0)) return true;
    return (o1 === 0 && enSeg(a, b, c)) || (o2 === 0 && enSeg(a, b, d)) ||
      (o3 === 0 && enSeg(c, d, a)) || (o4 === 0 && enSeg(c, d, b));
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;      // aristas vecinas: comparten el vértice
      if (cortan(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Gira la pieza para que el lado largo de su rectángulo mínimo quede sobre x y la lleva al origen. */
export function alinear(contorno, pliegues) {
  const pts = rectanguloMinimo(contorno);
  let largo = -1, p = null, q = null;
  for (let i = 0; i < 4; i++) {
    const L = d2(pts[i], pts[(i + 1) % 4]);
    if (L > largo) { largo = L; p = pts[i]; q = pts[(i + 1) % 4]; }
  }
  const giro = -Math.atan2(q[1] - p[1], q[0] - p[0]);
  const cs = Math.cos(giro), sn = Math.sin(giro);
  const g = (v) => [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs];
  const c2 = contorno.map(g);
  const pl2 = pliegues.map(([a, b]) => [g(a), g(b)]);
  const x0 = Math.min(...c2.map((v) => v[0])), y0 = Math.min(...c2.map((v) => v[1]));
  return [c2.map(([x, y]) => [x - x0, y - y0]),
    pl2.map(([a, b]) => [[a[0] - x0, a[1] - y0], [b[0] - x0, b[1] - y0]])];
}

export const TroncoPiramide = {
  id: "tronco_piramide",
  nombre: "Fondo de tolva (tronco de pirámide)",
  descripcion: "Tronco de pirámide rectangular entre una boca mayor y una menor, centrada o descentrada " +
    "(fondo de tolva). Desarrollo por caras, en 1 pieza con pliegues, 2 mitades o 4 caras.",
  usaEspesor: true,
  tienePliegues: true,
  params: [
    new Param("A", "Boca mayor: lado A (exterior)", 1000, { minimo: 5 }),
    new Param("B", "Boca mayor: lado B (exterior)", 800, { minimo: 5 }),
    new Param("a", "Boca menor: lado a (exterior)", 200, { minimo: 5 }),
    new Param("b", "Boca menor: lado b (exterior)", 150, { minimo: 5 }),
    new Param("x", "Corrimiento de la boca menor en A", 0),
    new Param("y", "Corrimiento de la boca menor en B", 0),
    new Param("h", "Altura entre bocas", 700, { minimo: 1 }),
    new Param("partes", "Armado (1 pieza, 2 mitades o 4 caras)", 1, { unidad: "", minimo: 1, maximo: 4, tipo: "int" }),
    new Param("inicio", "Cara donde empieza el desarrollo (0 a 3)", 0, { unidad: "", minimo: 0, maximo: 3, tipo: "int" }),
  ],

  resumen(v) {
    let s = `${fmt(v.A)}x${fmt(v.B)}/${fmt(v.a)}x${fmt(v.b)} h${fmt(v.h)}`;
    if (v.x || v.y) s += ` desc ${fmt(v.x)},${fmt(v.y)}`;
    return s;
  },

  neutro(v, t) {
    return [v.A - t, v.B - t, v.a - t, v.b - t];
  },

  generar(v, t) {
    if (![1, 2, 4].includes(v.partes)) throw new Error("El armado es de 1 pieza, 2 mitades o 4 caras.");
    if (t <= 0 || t >= Math.min(v.a, v.b) / 2) throw new Error("Espesor inválido para esas medidas.");
    const [A, B, a, b] = this.neutro(v, t);
    const runs = corridas(A, B, a, b, v.x, v.y);
    if (Math.min(...runs) < -TOL) throw new Error("La boca menor se sale de la mayor: hay una pared en voladizo.");
    const [sup, inf] = vertices(A, B, a, b, v.x, v.y, v.h);
    const n = v.partes, s0 = v.inicio;
    const por = Math.trunc(4 / n);
    const piezas = [];
    for (let j = 0; j < n; j++) {
      const orden = [];
      for (let i = 0; i < por; i++) orden.push(s0 + j * por + i);
      let [cont, pl] = desarrollar(sup, inf, orden);
      if (!poligonoValido(cont)) throw new Error("El desarrollo en una pieza se superpone: usá 2 mitades o 4 caras.");
      [cont, pl] = alinear(cont, pl);
      const nom = trad("Fondo {r}", { r: this.resumen(v) }) + (n > 1 ? ` ${j + 1}/${n}` : "");
      const p = new PiezaGen(nom);
      p.poly(cont);
      for (const [a_, b_] of pl) p.line(a_, b_, "PLEGADO");
      piezas.push(p);
    }
    return piezas;
  },
};
