// Corte de guillotina (cizalla, sierra de paneles): rectángulos en planchas con cortes de lado a lado.
// Port de guillotina.py del escritorio.
//
// Por plancha se arma un árbol de cortes: cada corte atraviesa por completo el rectángulo que corta y lo parte en
// dos, así lo que sale se puede cortar en una cizalla. Se prueban órdenes y reglas de colocación y se queda con la
// solución de menos planchas; entre esas, la de menos cortes que deje un retazo de al menos 95 % del mejor. Además
// (solo PWA) se arman soluciones por columnas / filas de lado a lado, que dejan el sobrante junto (ver más abajo).
// Medidas: la plancha es «largo» (X) × «ancho» (Y). Una pieza es «alto» × «largo»: sin girar, su largo va sobre el X
// de la plancha (la veta corre a lo largo). El ancho de corte se pierde en cada corte; el refilado es el margen que
// se descarta en los cuatro bordes.
//
// Acá va todo lo que usa la DEMO: las 144 combinaciones fijas de orden × colocación × regla. La búsqueda al azar por
// tiempo del escritorio y el precio por pieza son PRO (repo privado, guillotina/optimizar.js).
import { med, numero } from "../barras/motor.js";

export const EPS = 1e-6;
const MIN_SOBRA = 1.0;               // una franja de menos de 1 mm no es un retazo
export const TOL_RETAZO = 0.05;      // se acepta hasta 5 % menos de retazo mayor a cambio de menos cortes

class Nodo {
  constructor(x, y, w, h) {
    Object.assign(this, { x, y, w, h, tipo: "libre", pieza: null, rot: false, orient: null, linea: 0.0, longitud: 0.0, hijos: null });
  }
}

// ------------------------------------------------------------------ lectura de la lista
/** «alto  largo  cantidad» por línea (también «1200 x 600  5»); con dos números la cantidad es 1. */
export function leerTexto(texto) {
  const piezas = [], avisos = [];
  String(texto).split(/\r\n|\r|\n/).forEach((linea, i) => {
    const n = i + 1;
    let t = linea.trim();
    if (!t) return;
    t = t.replace(/(?<=\d)\s*[x×X]\s*(?=\d)/g, " ");
    const partes = (t.includes("\t") || t.includes(";")) ? t.split(/[\t;]+/).filter((p) => p.trim()) : t.split(/\s+/).filter((p) => p);
    let v;
    try {
      v = partes.slice(0, 3).map(numero);
    } catch {
      if (!piezas.length && n <= 3) return;                    // fila de títulos
      avisos.push(`Línea ${n}: «${t.slice(0, 30)}» no se entiende.`);
      return;
    }
    if (v.length < 2) { avisos.push(`Línea ${n}: faltan datos.`); return; }
    const [alto, largo] = v;
    const cant = v.length > 2 ? v[2] : 1.0;
    if (alto <= 0 || largo <= 0 || cant <= 0 || Math.abs(cant - Math.round(cant)) > 1e-9) {
      avisos.push(`Línea ${n}: medidas mayores que cero y cantidad entera.`);
      return;
    }
    piezas.push([alto, largo, Math.round(cant)]);
  });
  return [piezas, avisos];
}

/** Agrega [[alto, largo, cant]] en el orden de carga; si la medida ya está, suma la cantidad. */
export function sumarFilas(filas, nuevas) {
  const out = filas.map(([a, l, c]) => [a, l, Math.trunc(c)]);
  for (const [alto, largo, cant] of nuevas) {
    const f = out.find((x) => Math.abs(x[0] - alto) < 1e-6 && Math.abs(x[1] - largo) < 1e-6);
    if (f) f[2] += Math.trunc(cant); else out.push([Number(alto), Number(largo), Math.trunc(cant)]);
  }
  return out;
}

// ------------------------------------------------------------------ colocación
/** Cómo cortar la pieza (pw × ph) fuera del rectángulo libre: "V" = primero vertical, "H" = primero horizontal;
 * null si algún corte supera el largo máximo de la cizalla. */
export function ordenCorte(nodo, pw, ph, regla, k, maxc) {
  const rw = nodo.w, rh = nodo.h;
  const lw = rw - pw, lh = rh - ph;
  const ok = (largo) => maxc <= 0 || largo <= maxc + EPS;
  const vOk = (lw <= EPS || ok(rh)) && (lh <= EPS || ok(pw));
  const hOk = (lh <= EPS || ok(rw)) && (lw <= EPS || ok(ph));
  if (!vOk && !hOk) return null;
  if (vOk !== hOk) return vOk ? "V" : "H";
  if (regla === "V") return "V";
  if (regla === "H") return "H";
  if (regla === "A" || regla === "B") {
    const a = lw < lh ? "V" : "H";
    return regla === "A" ? a : (a === "V" ? "H" : "V");
  }
  // C / D: el resto más grande de una pieza (mayor o menor retazo único)
  const mayorV = Math.max(Math.max(lw - k, 0) * rh, pw * Math.max(lh - k, 0));
  const mayorH = Math.max(rw * Math.max(lh - k, 0), Math.max(lw - k, 0) * ph);
  if (regla === "C") return mayorV >= mayorH ? "V" : "H";
  return mayorV < mayorH ? "V" : "H";
}

/** Convierte el rectángulo libre en cortes + pieza. Devuelve los rectángulos libres nuevos. */
function partir(nodo, pw, ph, orden, k, idx, rot) {
  const libres = [];
  const { x, y, w: rw, h: rh } = nodo;
  const pieza = (n, x0, y0) => Object.assign(n, { tipo: "pieza", pieza: idx, rot, x: x0, y: y0, w: pw, h: ph });
  const libre = (x0, y0, w0, h0) => {
    if (w0 >= MIN_SOBRA && h0 >= MIN_SOBRA) { const n = new Nodo(x0, y0, w0, h0); libres.push(n); return n; }
    return null;
  };
  const cortar = (n, orient, linea, longitud, a, b) => Object.assign(n, { tipo: "corte", orient, linea, longitud, hijos: [a, b] });
  if (orden === "V") {
    let strip;
    if (rw - pw > EPS) {
      strip = new Nodo(x, y, pw, rh);
      const resto = libre(x + pw + k, y, rw - pw - k, rh);
      cortar(nodo, "V", x + pw, rh, strip, resto);
    } else strip = nodo;
    if (rh - ph > EPS) {
      const p = new Nodo(x, y, pw, ph);
      pieza(p, x, y);
      const arriba = libre(x, y + ph + k, pw, rh - ph - k);
      cortar(strip, "H", y + ph, pw, p, arriba);
    } else pieza(strip, x, y);
  } else {
    let franja;
    if (rh - ph > EPS) {
      franja = new Nodo(x, y, rw, ph);
      const resto = libre(x, y + ph + k, rw, rh - ph - k);
      cortar(nodo, "H", y + ph, rw, franja, resto);
    } else franja = nodo;
    if (rw - pw > EPS) {
      const p = new Nodo(x, y, pw, ph);
      pieza(p, x, y);
      const derecha = libre(x + pw + k, y, rw - pw - k, ph);
      cortar(franja, "V", x + pw, ph, p, derecha);
    } else pieza(franja, x, y);
  }
  return libres;
}

function puntaje(modo, nodo, pw, ph) {
  const lw = nodo.w - pw, lh = nodo.h - ph;
  if (modo === "area") return nodo.w * nodo.h - pw * ph;
  if (modo === "corto") return Math.min(lw, lh);
  if (modo === "largo") return Math.max(lw, lh);
  return -(nodo.w * nodo.h - pw * ph);                        // peor ajuste
}

/** Una pasada: coloca las piezas [idx, ancho_x, alto_y] en el orden dado. Planchas o null. */
function empaquetar(items, W, H, k, maxc, rotar, modo, regla) {
  const planchas = [];
  const nueva = () => { const raiz = new Nodo(0.0, 0.0, W, H); planchas.push({ raiz, libres: [raiz], piezas: [] }); };
  for (const [idx, a, b] of items) {
    const formas = [[a, b, false], ...(rotar && Math.abs(a - b) > EPS ? [[b, a, true]] : [])];
    let mejor = null;
    for (let intento = 0; intento < 2; intento++) {
      planchas.forEach((pl, pi) => {
        for (const nodo of pl.libres) {
          for (const [pw, ph, rot] of formas) {
            if (pw <= nodo.w + EPS && ph <= nodo.h + EPS) {
              const orden = ordenCorte(nodo, pw, ph, regla, k, maxc);
              if (orden === null) continue;
              const sc = [puntaje(modo, nodo, pw, ph), pi];
              if (mejor === null || sc[0] < mejor.sc[0] || (sc[0] === mejor.sc[0] && sc[1] < mejor.sc[1])) {
                mejor = { sc, pl, nodo, pw, ph, rot, orden };
              }
            }
          }
        }
      });
      if (mejor !== null || intento === 1) break;
      nueva();
    }
    if (mejor === null) return null;
    const { pl, nodo, pw, ph, rot, orden } = mejor;
    pl.libres.splice(pl.libres.indexOf(nodo), 1);
    pl.libres.push(...partir(nodo, pw, ph, orden, k, idx, rot));
    pl.piezas.push([idx, pw, ph, rot]);
  }
  return planchas;
}

/** [planchas, −retazo único más grande]. */
function calidad(planchas) {
  let mayor = 0.0;
  for (const pl of planchas) for (const n of pl.libres) mayor = Math.max(mayor, n.w * n.h);
  return [planchas.length, -mayor];
}

/** [cortes, piezas giradas] de una solución. */
function contar(planchas) {
  let cortes = 0;
  for (const pl of planchas) {
    const pila = [pl.raiz];
    while (pila.length) {
      const n = pila.pop();
      if (n !== null && n.tipo === "corte") { cortes++; pila.push(...n.hijos); }
    }
  }
  return [cortes, planchas.reduce((s, pl) => s + pl.piezas.filter((p) => p[3]).length, 0)];
}

/** candidatas [[retazo, cortes, giradas, planchas]]: entre las de retazo ≥ (1 − tol) × el mejor, la de menos
 * cortes, después menos giradas, después más retazo. */
function elegir(candidatas, tol) {
  const tope = Math.max(...candidatas.map((c) => c[0])) * (1 - tol);
  const validas = candidatas.filter((c) => c[0] >= tope - EPS);
  let m = validas[0];
  for (const c of validas.slice(1)) {
    if (c[1] < m[1] || (c[1] === m[1] && (c[2] < m[2] || (c[2] === m[2] && -c[0] < -m[0])))) m = c;
  }
  return m[3];
}

// ------------------------------------------------------------------ resultado
/** Cortes de una plancha en orden de trabajo: por etapas. */
function cortesDe(raiz) {
  const actual = [], cola = [[raiz, 1]];
  while (cola.length) {
    const [nodo, e] = cola.shift();
    if (nodo === null || nodo.tipo !== "corte") continue;
    const [a, b] = nodo.hijos;
    actual.push({ etapa: e, orient: nodo.orient, linea: nodo.linea, longitud: nodo.longitud, x: nodo.x, y: nodo.y, w: nodo.w, h: nodo.h });
    cola.push([a, e + 1], [b, e + 1]);
  }
  const out = [...actual].sort((p, q) => p.etapa - q.etapa);
  out.forEach((c, i) => {
    c.n = i + 1;
    c.desde = c.orient === "V" ? c.linea - c.x : c.linea - c.y;
  });
  return out;
}

function armarRes(planchas, piezas, dims, W, H, k, trim, maxc, rotar, avisos, total) {
  const plOut = [];
  let util = 0.0;
  for (const pl of planchas) {
    const hojas = [], libres = [];
    const rec = (n) => {
      if (n === null) return;
      if (n.tipo === "pieza") hojas.push(n);
      else if (n.tipo === "corte") { rec(n.hijos[0]); rec(n.hijos[1]); }
    };
    rec(pl.raiz);
    const ps = hojas.map((n) => ({ idx: n.pieza, x: n.x + trim[0], y: n.y + trim[1], w: n.w, h: n.h, rot: n.rot }));
    const rec2 = (n) => {
      if (n === null) return;
      if (n.tipo === "libre") libres.push({ x: n.x + trim[0], y: n.y + trim[1], w: n.w, h: n.h });
      else if (n.tipo === "corte") { rec2(n.hijos[0]); rec2(n.hijos[1]); }
    };
    rec2(pl.raiz);
    const cortes = cortesDe(pl.raiz);
    for (const c of cortes) {
      c.x += trim[0];
      c.y += trim[1];
      c.linea += c.orient === "V" ? trim[0] : trim[1];
    }
    util += ps.reduce((s, p) => s + p.w * p.h, 0);
    plOut.push({ piezas: ps, libres, cortes });
  }
  const n = plOut.length;
  let retazo = [0, 0];
  for (const p of plOut) for (const r of p.libres) if (r.w * r.h > retazo[0] * retazo[1]) retazo = [r.w, r.h];
  const areaPieza = piezas.reduce((s, [a, b, c]) => s + a * b * c, 0);
  const ref = [];
  if (trim[0] > 0) {
    ref.push({ orient: "V", linea: trim[0], longitud: total[1] }, { orient: "V", linea: total[0] - trim[0], longitud: total[1] });
  }
  if (trim[1] > 0) {
    ref.push({ orient: "H", linea: trim[1], longitud: total[0] }, { orient: "H", linea: total[1] - trim[1], longitud: total[0] });
  }
  return {
    cortes_refilado: ref, planchas: plOut, n_planchas: n, W: total[0], H: total[1], corte: k,
    refilado: trim[0] === trim[1] ? trim[0] : Math.max(...trim), trim, max_corte: maxc, rotar,
    piezas_lista: piezas.map(([a, b, c]) => [a, b, c]), dims, avisos,
    piezas: plOut.reduce((s, p) => s + p.piezas.length, 0), area_util: util,
    aprovechamiento: n ? util / (n * total[0] * total[1]) : 0.0,
    retazo, cota: areaPieza ? Math.max(1, Math.ceil(areaPieza / (W * H) - 1e-9)) : 0,
  };
}

// ------------------------------------------------------------------ armado por columnas (solo PWA, 25-nov)
// El armado de arriba pone cada pieza en una esquina de un hueco y el corte sigue el borde de esa pieza: nunca arma
// un corte de lado a lado que deje todas las piezas de un lado y el resto entero del otro. Este arma en 3 etapas:
// columnas de todo el alto de la plancha (cortes verticales), cada columna en franjas (horizontales) y cada franja en
// piezas (verticales); lo que sobra queda junto, al final. También por filas (lo mismo girado). Las soluciones se
// suman al frente y se elige igual que siempre. La PC todavía no lo tiene (pendiente).
export const AJUSTES = { columnas: true };    // las pruebas contra la PC lo apagan
const MAX_ANCHOS = 8;                          // anchos de franja que se prueban además del de la plancha

/** Planchas armadas por columnas (o por filas si `T`: se arma con los ejes cambiados y se pasa a la plancha). */
function porColumnas(items, W, H, k, maxc, rotar, T, giro, cw) {
  const VW = T ? H : W, VH = T ? W : H;          // medidas en el armado (x = a lo ancho de las columnas)
  // piezas en el armado: [idx, w, h]; giro: "tal" / "acostada" (w ≥ h) / "parada" (w ≤ h)
  const ps = [];
  for (const [idx, a, b] of items) {
    let w = T ? b : a, h = T ? a : b;
    if (rotar && ((giro === "acostada" && h > w + EPS) || (giro === "parada" && w > h + EPS))) [w, h] = [h, w];
    if (w > VW + EPS || h > VH + EPS) {
      if (!rotar || h > VW + EPS || w > VH + EPS) return null;
      [w, h] = [h, w];
    }
    ps.push([idx, w, h]);
  }
  ps.sort((p, q) => q[2] - p[2] || q[1] - p[1] || p[0] - q[0]);
  // franjas: el primero que entra (alto decreciente)
  const franjas = [];
  for (const p of ps) {
    const f = franjas.find((s) => p[2] <= s.h + EPS && s.usado + k + p[1] <= Math.max(cw, s.usado) + EPS);
    if (f) { f.usado += k + p[1]; f.ps.push(p); } else franjas.push({ h: p[2], usado: p[1], ps: [p] });
  }
  // columnas: franjas de ancho decreciente, la primera columna donde entra a lo alto
  franjas.sort((s, t) => t.usado - s.usado || t.h - s.h);
  const cols = [];
  for (const f of franjas) {
    const c = cols.find((c) => c.alto + k + f.h <= VH + EPS);
    if (c) { c.alto += k + f.h; c.fs.push(f); } else cols.push({ w: f.usado, alto: f.h, fs: [f] });
  }
  // planchas: columnas de ancho decreciente, la primera plancha donde entra a lo ancho
  const pls = [];
  for (const c of cols) {
    const pl = pls.find((p) => p.usado + k + c.w <= VW + EPS);
    if (pl) { pl.usado += k + c.w; pl.cs.push(c); } else pls.push({ usado: c.w, cs: [c] });
  }
  // árbol de cortes: se arma en las coordenadas del armado (vx, vy) y los nodos quedan en las de la plancha
  const mk = (x, y, w, h) => (T ? new Nodo(y, x, h, w) : new Nodo(x, y, w, h));
  const vx = (n) => (T ? n.y : n.x), vy = (n) => (T ? n.x : n.y);
  const ori = (o) => (T ? (o === "V" ? "H" : "V") : o);
  const cortar = (n, o, linea, longitud, a, c) => Object.assign(n, { tipo: "corte", orient: ori(o), linea, longitud, hijos: [a, c] });
  const real = new Map(items.map((it) => [it[0], it]));
  const out = [];
  for (const pl of pls) {
    const raiz = mk(0, 0, VW, VH), libres = [], piezas = [];
    let falla = false;
    const libre = (x, y, w, h) => (w >= MIN_SOBRA && h >= MIN_SOBRA ? mk(x, y, w, h) : null);
    // Parte el nodo n (esquina x0, y0 del armado) en tramos de las medidas dadas, a lo largo de x (o = "V") o de y
    // (o = "H"); `largo` = lo que mide n en ese sentido, `alto` = lo que mide en el otro (= largo de cada corte).
    const tramos = (n, x0, y0, largo, alto, medidas, o) => {
      const r = [];
      let cur = n, pos = 0;
      for (const a of medidas) {
        if (cur === null) { falla = true; return r; }
        const resta = largo - pos;
        if (resta - a > EPS) {
          const t = o === "V" ? mk(x0 + pos, y0, a, alto) : mk(x0, y0 + pos, alto, a);
          const rw = resta - a - k;
          const resto = o === "V" ? libre(x0 + pos + a + k, y0, rw, alto) : libre(x0, y0 + pos + a + k, alto, rw);
          cortar(cur, o, (o === "V" ? x0 : y0) + pos + a, alto, t, resto);
          r.push(t);
          cur = resto;
          pos += a + k;
        } else { r.push(cur); cur = null; pos = largo; }
      }
      if (cur) libres.push(cur);
      return r;
    };
    const nc = tramos(raiz, 0, 0, VW, VH, pl.cs.map((c) => c.w), "V");
    pl.cs.forEach((c, ic) => {
      if (falla) return;
      const xc = vx(nc[ic]);
      const nf = tramos(nc[ic], xc, 0, VH, c.w, c.fs.map((f) => f.h), "H");
      c.fs.forEach((f, jf) => {
        if (falla) return;
        const yf = vy(nf[jf]);
        const np = tramos(nf[jf], xc, yf, c.w, f.h, f.ps.map((p) => p[1]), "V");
        f.ps.forEach(([idx, w, h], kp) => {
          if (falla) return;
          let n = np[kp];
          const xp = vx(n);
          if (f.h - h > EPS) {
            const p = mk(xp, yf, w, h);
            const arriba = libre(xp, yf + h + k, w, f.h - h - k);
            if (arriba) libres.push(arriba);
            cortar(n, "H", yf + h, w, p, arriba);
            n = p;
          }
          const [rw, rh] = T ? [h, w] : [w, h];
          const it = real.get(idx);
          const rot = Math.abs(it[1] - it[2]) > EPS && Math.abs(rw - it[1]) > EPS;
          Object.assign(n, { tipo: "pieza", pieza: idx, rot, w: rw, h: rh, hijos: null });
          piezas.push([idx, rw, rh, rot]);
        });
      });
    });
    if (falla) return null;
    // control de la cizalla
    const pila = [raiz];
    while (pila.length) {
      const n = pila.pop();
      if (n && n.tipo === "corte") {
        if (maxc > 0 && n.longitud > maxc + EPS) return null;
        pila.push(...n.hijos);
      }
    }
    out.push({ raiz, libres, piezas });
  }
  return out;
}

/** Suma al frente las soluciones por columnas y por filas (giros y anchos de franja distintos). */
function correrColumnas(b) {
  const { items, W, H, corte, maxCorte, rotar } = b.p;
  const giros = rotar ? ["tal", "acostada", "parada"] : ["tal"];
  for (const T of [false, true]) {
    const VW = T ? H : W;
    for (const giro of giros) {
      const anchos = new Set([VW]);
      const ws = [...new Set(items.flatMap(([, a, c]) => (rotar ? [a, c] : [T ? c : a])))].filter((w) => w < VW - EPS)
        .sort((p, q) => q - p).slice(0, MAX_ANCHOS);
      ws.forEach((w) => anchos.add(w));
      for (const cw of anchos) sumar(b, porColumnas(items, W, H, corte, maxCorte, rotar, T, giro, cw));
    }
  }
}

// ------------------------------------------------------------------ búsqueda
export const LLAVES = [(t) => t[1] * t[2], (t) => Math.max(t[1], t[2]), (t) => Math.min(t[1], t[2]),
  (t) => t[1], (t) => t[2], (t) => t[1] + t[2]];
export const MODOS = ["area", "corto", "largo", "peor"];
export const REGLAS = ["V", "H", "A", "B", "C", "D"];
/** combinaciones (modo, regla, orden) en el orden del escritorio (antes de mezclarlas). */
export const combos = () => LLAVES.flatMap((_, o) => MODOS.flatMap((m) => REGLAS.map((r) => [m, r, o])));

/** sorted(items, key, reverse=True) de Python (estable). */
export function ordenar(items, llave) {
  const k = items.map(llave);
  return items.map((t, i) => i).sort((a, b) => k[b] - k[a] || a - b).map((i) => items[i]);
}

/**
 * Controles y datos comunes. Devuelve {lista, items, dims, W, H, trim, avisos, total} o lanza Error.
 */
export function preparar(piezas, largoPlancha, anchoPlancha, corte = 0.0, refilado = 0.0, maxCorte = 0.0, rotar = true) {
  if (largoPlancha <= 0 || anchoPlancha <= 0) throw new Error("La plancha tiene que tener largo y ancho mayores que cero.");
  if (corte < 0 || refilado < 0) throw new Error("El ancho de corte y el refilado no pueden ser negativos.");
  const lista = piezas.filter(([, , c]) => c > 0).map(([a, b, c]) => [a, b, c]);
  if (!lista.length) throw new Error("No hay piezas para cortar.");
  const avisos = [];
  const trim = [refilado, refilado];
  if (refilado > 0 && maxCorte > 0) {
    if (largoPlancha > maxCorte + EPS) {
      trim[1] = 0.0;
      avisos.push(`El refilado de los lados largos (${med(largoPlancha)} mm) supera el largo de corte de la cizalla (${med(maxCorte)} mm): no se aplica.`);
    }
    if (anchoPlancha > maxCorte + EPS) {
      trim[0] = 0.0;
      avisos.push(`El refilado de los lados cortos (${med(anchoPlancha)} mm) supera el largo de corte de la cizalla (${med(maxCorte)} mm): no se aplica.`);
    }
  }
  const W = largoPlancha - 2 * trim[0], H = anchoPlancha - 2 * trim[1];
  if (W <= 0 || H <= 0) throw new Error("El refilado es mayor que la plancha.");
  const items = [], dims = [];
  for (const [alto, largo, cant] of lista) {
    for (let i = 0; i < cant; i++) { items.push([items.length, largo, alto]); dims.push([alto, largo]); }
  }
  if (items.length > 4000) throw new Error("Demasiadas piezas (máximo 4000).");
  for (const [idx, a, b] of items) {
    const formas = [[a, b], ...(rotar && Math.abs(a - b) > EPS ? [[b, a]] : [])];
    const entra = formas.some(([pw, ph]) => pw <= W + EPS && ph <= H + EPS && ordenCorte(new Nodo(0, 0, W, H), pw, ph, "V", corte, maxCorte));
    if (!entra) {
      const [alto, largo] = dims[idx];
      const motivo = !formas.some(([pw, ph]) => pw <= W + EPS && ph <= H + EPS) ? "no entra en la plancha" : "necesita un corte más largo que la cizalla";
      throw new Error(`La pieza de ${med(alto)} × ${med(largo)} mm ${motivo}${rotar ? "" : " (el giro está desactivado)"}.`);
    }
  }
  return { lista, items, dims, W, H, trim, avisos, total: [largoPlancha, anchoPlancha], corte, maxCorte, rotar };
}

/** Estado de la búsqueda: el frente de soluciones con el mínimo de planchas (como el escritorio). */
export function nuevaBusqueda(p) {
  return { p, nMin: null, frente: [], corridas: 0 };
}

/** Una corrida con (modo, regla, orden de las piezas). */
export function correr(b, m, r, orden) {
  const { W, H, corte, maxCorte, rotar } = b.p;
  b.corridas++;
  sumar(b, empaquetar(orden, W, H, corte, maxCorte, rotar, m, r));
}

/** Suma una solución (planchas o null) al frente de la búsqueda. */
function sumar(b, pls) {
  if (pls === null) return;
  const [n, menosRetazo] = calidad(pls);
  if (b.nMin === null || n < b.nMin) { b.nMin = n; b.frente = []; }
  if (n === b.nMin) {
    const c = [-menosRetazo, ...contar(pls)];
    if (!b.frente.some((f) => f[0] >= c[0] - EPS && f[1] <= c[1] && f[2] <= c[2])) {
      b.frente = b.frente.filter((f) => !(c[0] >= f[0] - EPS && c[1] <= f[1] && c[2] <= f[2]));
      b.frente.push([...c, pls]);
    }
  }
}

/** Resultado final de la búsqueda (o error si nada entró). */
export function terminar(b) {
  const p = b.p;
  if (AJUSTES.columnas) correrColumnas(b);
  if (!b.frente.length) throw new Error("No se pudo acomodar alguna pieza con esos límites de cizalla.");
  const mejor = elegir(b.frente, TOL_RETAZO);
  const res = armarRes(mejor, p.lista, p.dims, p.W, p.H, p.corte, p.trim, p.maxCorte, p.rotar, p.avisos, p.total);
  res.corridas = b.corridas;
  const areaPieza = p.lista.reduce((s, [a, c, d]) => s + a * c * d, 0);
  res.cota = Math.max(1, Math.ceil(areaPieza / (p.W * p.H) - 1e-9));
  return res;
}

/** DEMO: las 144 combinaciones fijas, en orden (sin búsqueda al azar). */
export function optimizarRapido(piezas, largo, ancho, corte = 0, refilado = 0, maxCorte = 0, rotar = true) {
  const b = nuevaBusqueda(preparar(piezas, largo, ancho, corte, refilado, maxCorte, rotar));
  for (const [m, r, o] of combos()) correr(b, m, r, ordenar(b.p.items, LLAVES[o]));
  return terminar(b);
}

// ------------------------------------------------------------------ verificación y textos
/** Control independiente: todas las piezas dentro de la plancha, sin pisarse (con el corte entre ellas), cada corte
 * dentro de la cizalla y las piezas cortadas = las pedidas. [] = bien. */
export function verificar(res, piezas) {
  const err = [];
  const k = res.corte, W = res.W, H = res.H, t = res.trim;
  const clave = (a, b) => `${Math.round(a * 1e4) / 1e4}|${Math.round(b * 1e4) / 1e4}`;
  const pedidas = new Map(), hechas = new Map();
  for (const [a, b, c] of piezas) pedidas.set(clave(a, b), (pedidas.get(clave(a, b)) || 0) + c);
  res.planchas.forEach((pl, i) => {
    const n = i + 1, ps = pl.piezas;
    for (const p of ps) {
      const [alto, largo] = res.dims[p.idx];
      hechas.set(clave(alto, largo), (hechas.get(clave(alto, largo)) || 0) + 1);
      const okDim = (Math.abs(p.w - largo) < 1e-6 && Math.abs(p.h - alto) < 1e-6) ||
        (res.rotar && Math.abs(p.w - alto) < 1e-6 && Math.abs(p.h - largo) < 1e-6);
      if (!okDim) err.push(`Plancha ${n}: una pieza no tiene su medida.`);
      if (p.x < t[0] - 1e-6 || p.y < t[1] - 1e-6 || p.x + p.w > W - t[0] + 1e-6 || p.y + p.h > H - t[1] + 1e-6) {
        err.push(`Plancha ${n}: una pieza queda fuera de la plancha.`);
      }
    }
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        const A = ps[a], B = ps[b];
        const sx = Math.max(A.x - (B.x + B.w), B.x - (A.x + A.w));
        const sy = Math.max(A.y - (B.y + B.h), B.y - (A.y + A.h));
        if (Math.max(sx, sy) < k - 1e-6) err.push(`Plancha ${n}: dos piezas se pisan o no dejan lugar al corte.`);
      }
    }
    for (const c of pl.cortes) {
      if (res.max_corte > 0 && c.longitud > res.max_corte + 1e-6) err.push(`Plancha ${n}: el corte ${c.n} (${med(c.longitud)} mm) supera la cizalla.`);
    }
  });
  const igual = pedidas.size === hechas.size && [...pedidas].every(([k2, v]) => hechas.get(k2) === v);
  if (!igual) err.push("No coinciden las piezas pedidas con las cortadas.");
  return err;
}

/** «Corte 3: vertical, a 1.205 mm del borde izquierdo del tramo, largo 1.490 mm». */
export function textoCorte(c) {
  return c.orient === "V"
    ? `vertical, a ${med(c.desde)} mm del borde izquierdo del tramo, largo ${med(c.longitud)} mm`
    : `horizontal, a ${med(c.desde)} mm del borde inferior del tramo, largo ${med(c.longitud)} mm`;
}
