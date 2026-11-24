/*
 * Base común de los generadores (port de desarrollos/base.py del programa de escritorio, que es la fuente de verdad).
 *
 * Convenciones (las mismas del escritorio):
 *  - Todas las medidas en mm. Diámetros y medidas de secciones son EXTERIORES.
 *  - Los desarrollos se calculan sobre el espesor NEUTRO (diámetro exterior - espesor).
 *  - Capas: CORTE (se corta), MARCAS (referencias de armado), PLEGADO (líneas de doblado).
 *
 * Sin DOM: lo usan la PWA y las pruebas de Node (tests/comparar.mjs).
 */

// ------------------------------------------------------------------ números (idioma.py, en español)
/** Como f"{v:.{dec}f}" de Python: redondeo al par en los empates exactos (toFixed redondea hacia arriba). */
export function fijo(v, dec) {
  v = Number(v);
  const s = v.toFixed(dec);
  if (!isFinite(v)) return s;
  const exacto = v.toFixed(Math.min(100, dec + 60));        // desarrollo decimal exacto del double
  const resto = exacto.slice(exacto.indexOf(".") + 1 + dec);
  if (!/^50*$/.test(resto)) return s;                         // no es empate: toFixed ya da lo mismo que Python
  const abajo = exacto.slice(0, exacto.indexOf(".") + 1 + dec).replace(/\.$/, "");
  const ultimo = Number(abajo.slice(-1));                      // truncado: si termina en par, Python se queda ahí
  return ultimo % 2 === 0 ? abajo : s;                        // si no, sube (lo mismo que toFixed)
}

/** idioma.corto(v, dec): sin ceros de más, con coma decimal («2,5», «400»). */
export function corto(v, dec = 2) {
  let t = fijo(v, dec);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  return t.replace(".", ",");
}

/** Número corto para nombres de piezas (base.fmt). */
export const fmt = (v) => corto(v, 1);

/** idioma.leer_num en español: acepta coma o punto decimal («2,5», «2.5», «1.234,5»). Vacío o letras: error. */
export function leerNum(texto) {
  let s = String(texto).trim().replace(/−/g, "-").replace(/[  ]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/,/g, ".");
  }
  // float() de Python: número completo o error (Number("") daría 0 y "1e" daría NaN)
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) && !/^[+-]?(inf|infinity|nan)$/i.test(s)) {
    throw new Error("no es un número");
  }
  return Number(s);
}

/** Python round(): al par en los empates. */
export function pyRound(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Reemplaza {clave} por datos[clave] (los textos ya vienen en español). */
export function trad(texto, datos = {}) {
  return texto.replace(/\{(\w+)\}/g, (m, k) => (k in datos ? String(datos[k]) : m));
}

// ------------------------------------------------------------------ parámetros
export class Param {
  constructor(clave, etiqueta, defecto, { unidad = "mm", minimo = null, maximo = null, tipo = "float",
    opciones = [], ayuda = "" } = {}) {
    Object.assign(this, { clave, etiqueta, defecto, unidad, minimo, maximo, tipo, opciones, ayuda });
  }

  /** Convierte el texto ingresado al tipo del parámetro y valida límites (mismos mensajes que el escritorio). */
  convertir(texto) {
    const et = this.etiqueta;
    if (this.tipo === "opcion") {
      if (!this.opciones.includes(texto)) throw new Error(trad("{etiqueta}: opción inválida.", { etiqueta: et }));
      return texto;
    }
    const s = String(texto).trim();
    if (s === "") throw new Error(trad("{etiqueta}: falta el valor.", { etiqueta: et }));
    let v;
    try {
      v = leerNum(s);
      if (this.tipo === "int") {
        if (!isFinite(v)) throw new Error("int");
        v = Math.trunc(v);
      }
    } catch (e) {
      throw new Error(trad("{etiqueta}: valor inválido «{v1}».", { etiqueta: et, v1: texto }));
    }
    if (this.minimo !== null && v < this.minimo) throw new Error(trad("{etiqueta}: mínimo {minimo}.", { etiqueta: et, minimo: this.minimo }));
    if (this.maximo !== null && v > this.maximo) throw new Error(trad("{etiqueta}: máximo {maximo}.", { etiqueta: et, maximo: this.maximo }));
    return v;
  }
}

// ------------------------------------------------------------------ pieza generada
/**
 * Una pieza plana a cortar. Entidades: [capa, tipo, datos]
 *   ["CORTE", "poly", [puntos, cerrado]]   ["CORTE", "circle", [cx, cy, r]]
 *   ["CORTE", "lwbulge", [[x, y, bulge], ...]]   (polilínea cerrada con arcos exactos)
 *   ["MARCAS"|"PLEGADO", "line", [[x1, y1], [x2, y2]]]
 */
export class PiezaGen {
  constructor(nombre, cantidad = 1) {
    this.nombre = nombre;
    this.cantidad = Math.trunc(cantidad);
    this.ents = [];
  }

  poly(pts, capa = "CORTE", cerrado = true) {
    this.ents.push([capa, "poly", [pts.map((p) => [p[0], p[1]]), cerrado]]);
    return this;
  }

  circle(cx, cy, r, capa = "CORTE") {
    this.ents.push([capa, "circle", [cx, cy, r]]);
    return this;
  }

  lwbulge(ptsBulge, capa = "CORTE") {
    this.ents.push([capa, "lwbulge", ptsBulge.map((p) => [p[0], p[1], p[2]])]);
    return this;
  }

  line(p1, p2, capa = "MARCAS") {
    this.ents.push([capa, "line", [[p1[0], p1[1]], [p2[0], p2[1]]]]);
    return this;
  }

  limites() {
    const xs = [], ys = [];
    for (const [, tipo, d] of this.ents) {
      let pts;
      if (tipo === "poly") pts = d[0];
      else if (tipo === "lwbulge") {
        pts = d.map((p) => [p[0], p[1]]);
        d.forEach((p, k) => {                      // los arcos pueden salir de los vértices
          if (Math.abs(p[2]) > 1e-12) pts.push(...extremosArco(p, d[(k + 1) % d.length], p[2]));
        });
      } else if (tipo === "circle") pts = [[d[0] - d[2], d[1] - d[2]], [d[0] + d[2], d[1] + d[2]]];
      else pts = d;
      for (const p of pts) { xs.push(p[0]); ys.push(p[1]); }
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
}

/** Centro, radio y ángulos de un tramo con bulge p0 → p1. */
export function arcoBulge(p0, p1, bulge) {
  const th = 4 * Math.atan(bulge);                 // ángulo barrido, + antihorario
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (c < 1e-12) return null;
  const r = Math.abs(c / (2 * Math.sin(th / 2)));
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const ux = (p1[0] - p0[0]) / c, uy = (p1[1] - p0[1]) / c;
  const h = r * Math.cos(th / 2) * (th > 0 ? 1 : -1); // del medio de la cuerda al centro (con signo)
  const cx = mx - uy * h, cy = my + ux * h;
  return { cx, cy, r, th, a0: Math.atan2(p0[1] - cy, p0[0] - cx) };
}

/** Puntos del arco p0→p1 (bulge) a 0°, 90°, 180° y 270° de su centro, si caen dentro del arco. */
export function extremosArco(p0, p1, bulge) {
  const a = arcoBulge(p0, p1, bulge);
  if (!a) return [];
  const out = [];
  const dosPi = 2 * Math.PI;
  const mod = (x) => ((x % dosPi) + dosPi) % dosPi;
  for (let q = 0; q < 4; q++) {
    const ang = (q * Math.PI) / 2;
    const rel = a.th > 0 ? mod(ang - a.a0) : mod(a.a0 - ang);
    if (rel > 1e-12 && rel < Math.abs(a.th) - 1e-12) out.push([a.cx + a.r * Math.cos(ang), a.cy + a.r * Math.sin(ang)]);
  }
  return out;
}

// ------------------------------------------------------------------ utilidades geométricas
/** Divide índices 0..nTotal en 'partes' rangos [[i0, i1]] que comparten el extremo. */
export function dividirRango(nTotal, partes) {
  partes = Math.max(1, Math.trunc(partes));
  const cortes = [];
  for (let k = 0; k <= partes; k++) cortes.push(pyRound((nTotal * k) / partes));
  const out = [];
  for (let k = 0; k < partes; k++) out.push([cortes[k], cortes[k + 1]]);
  return out;
}

const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export { dist };

/**
 * Desarrolla una superficie reglada (cono, cilindro oblicuo) dada por pares de puntos 3D P[i] (borde 1) y Q[i]
 * (borde 2), por triangulación con longitudes verdaderas. Devuelve [p2d, q2d].
 */
export function desplegarBanda(P, Q) {
  const tercerPunto = (a, b, ra, rb, lado) => {
    // punto a distancia ra de a y rb de b, del lado indicado de a->b (lado = +1 / -1)
    const ab = dist(a, b);
    const x = (ra * ra - rb * rb + ab * ab) / (2 * ab);
    const y = Math.sqrt(Math.max(ra * ra - x * x, 0.0));
    const ux = (b[0] - a[0]) / ab, uy = (b[1] - a[1]) / ab;
    return [a[0] + ux * x - uy * y * lado, a[1] + uy * x + ux * y * lado];
  };
  const p2 = [[0.0, 0.0]];
  const q2 = [[0.0, dist(P[0], Q[0])]];
  for (let i = 0; i < P.length - 1; i++) {
    const np = tercerPunto(p2[i], q2[i], dist(P[i], P[i + 1]), dist(Q[i], P[i + 1]), -1);
    const nq = tercerPunto(np, q2[i], dist(P[i + 1], Q[i + 1]), dist(Q[i], Q[i + 1]), -1);
    p2.push(np);
    q2.push(nq);
  }
  return [p2, q2];
}

/** Rango de enteros [a, b). */
export const rango = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
