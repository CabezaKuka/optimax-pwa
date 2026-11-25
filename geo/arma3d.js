/*
 * Piezas de chapa armadas en 3D (25-nov, Max: «el 3D de las figuras de los desarrollos»). Sin DOM ni three.js: lo usan
 * la vista 3D de Chapa (modulos/chapa3d.js) y las pruebas de Node (tests/chapa3d.mjs).
 *
 * Idea: la plantilla se vuelve a enrollar. Todas las figuras son superficies regladas (cilindros, conos, caras planas,
 * bandas trianguladas): cada pieza se describe con BANDAS = listas de generatrices en orden, y cada generatriz lleva
 * sus dos puntos en la chapa plana (a2, b2, en las coordenadas de la pieza que se corta) y los mismos dos puntos ya
 * armados (A, B, en mm, z hacia arriba). Entre dos generatrices vecinas va una tira de triángulos. Las pruebas
 * comparan la tira plana con la armada (la chapa no se estira), que las bandas cubran la pieza (misma superficie) y
 * que los bordes caigan donde tienen que caer (costura que cierra, borde sobre el otro caño, gajos que encastran).
 *
 * Pieza 3D: { nombre, tono: "corte" (la chapa que se corta) | "ref" (lo que no se corta: el caño principal, la caja),
 *             bandas: [[[a2, b2, A, B], …], …] }   (en las de referencia a2 / b2 pueden ser null)
 */

export const sub3 = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
export const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
export const dist2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const lerp = (p, q, u) => p.map((v, i) => v + (q[i] - v) * u);

/** Banda de una función de la chapa plana al 3D: generatrices [[a2, b2], …] → [[a2, b2, f(a2), f(b2)], …]. Conserva
 * las marcas de borde (falsoA / falsoB, ver malla). */
export function conMapa(gens, f) {
  const out = gens.map(([a, b]) => [a, b, f(a), f(b)]);
  if (gens.falsoA) out.falsoA = gens.falsoA;
  if (gens.falsoB) out.falsoB = gens.falsoB;
  return out;
}

/**
 * Malla de una pieza 3D: { pos: [x, y, z, …], idx: [i, j, k, …], bordes: [[P, Q], …] }. Cada generatriz se parte
 * en tramos de a lo sumo 'paso' mm (las generatrices son rectas en la chapa y en el 3D: el punto del medio es exacto).
 */
export function malla(pieza, paso) {
  const pos = [], idx = [], bordes = [];
  for (const banda of pieza.bandas) {
    if (banda.length < 2) continue;
    const m = Math.max(1, Math.ceil(Math.max(...banda.map((g) => dist3(g[2], g[3]))) / paso));
    const base = pos.length / 3;
    for (const g of banda) {
      for (let j = 0; j <= m; j++) pos.push(...lerp(g[2], g[3], j / m));
    }
    for (let i = 0; i < banda.length - 1; i++) {
      for (let j = 0; j < m; j++) {
        const a = base + i * (m + 1) + j, b = a + 1, c = a + m + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // bordes: las dos generatrices de las puntas y las dos curvas de los extremos
    const ini = banda[0], fin = banda[banda.length - 1];
    bordes.push([ini[2], ini[3]], [fin[2], fin[3]]);
    // falsoA / falsoB[i] = el tramo i → i+1 de esa punta no es un borde de la chapa (banda.falsoA, si la hay)
    for (let i = 0; i < banda.length - 1; i++) {
      if (!banda.falsoA?.[i]) bordes.push([banda[i][2], banda[i + 1][2]]);
      if (!banda.falsoB?.[i]) bordes.push([banda[i][3], banda[i + 1][3]]);
    }
  }
  return { pos, idx, bordes };
}

/** Tamaño de todo lo armado (la diagonal de la caja), para elegir el paso de la malla y el encuadre. */
export function tamano(piezas) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of piezas) for (const b of p.bandas) for (const g of b) for (const P of [g[2], g[3]]) {
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[k]); mx[k] = Math.max(mx[k], P[k]); }
  }
  return Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
}

/**
 * Generatrices de una chapa rectangular [0, L] × [0, W] con un agujero (polígono cerrado en coordenadas de la chapa),
 * a lo largo de x (una por cada y): dos bandas, a la izquierda y a la derecha del agujero. Donde la recta no corta el
 * agujero, las dos se tocan en xc (el medio del agujero). Las alturas de arriba y de abajo del agujero van incluidas.
 */
export function bandasConHueco(L, W, hueco, columnas = 240) {
  const ys = hueco.map((p) => p[1]);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xc = (Math.min(...hueco.map((p) => p[0])) + Math.max(...hueco.map((p) => p[0]))) / 2;
  const alturas = new Set();
  for (let k = 0; k <= columnas; k++) alturas.add((W * k) / columnas);
  for (const y of ys) alturas.add(y);                          // pasa justo por cada vértice del agujero
  const lista = [...alturas].filter((y) => y >= 0 && y <= W).sort((a, b) => a - b);
  const izq = [], der = [], sin = [];
  for (const y of lista) {
    let xs = [];
    if (y >= ymin && y <= ymax) {
      for (let i = 0; i < hueco.length; i++) {
        const p = hueco[i], q = hueco[(i + 1) % hueco.length];
        if ((p[1] <= y && y <= q[1]) || (q[1] <= y && y <= p[1])) {
          xs.push(Math.abs(q[1] - p[1]) < 1e-12 ? Math.min(p[0], q[0]) : p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
        }
      }
    }
    const x0 = xs.length ? Math.min(...xs) : xc, x1 = xs.length ? Math.max(...xs) : xc;
    izq.push([[0, y], [x0, y]]);
    der.push([[x1, y], [L, y]]);
    sin.push(!xs.length);
  }
  // donde las dos bandas se tocan (fuera del agujero) no hay borde: no se dibuja la línea
  izq.falsoB = sin.slice(0, -1).map((v, i) => v && sin[i + 1]);
  der.falsoA = izq.falsoB;
  return [izq, der];
}

// ------------------------------------------------------------------ para las pruebas
/** Superficie plana de una banda (suma de los cuadriláteros entre generatrices vecinas). */
export function areaBanda(banda) {
  let s = 0;
  for (let i = 0; i < banda.length - 1; i++) {
    const q = [banda[i][0], banda[i + 1][0], banda[i + 1][1], banda[i][1]];
    let a = 0;
    for (let k = 0; k < 4; k++) a += q[k][0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * q[k][1];
    s += Math.abs(a) / 2;
  }
  return s;
}

/** Diferencia máxima (mm) entre las medidas planas y las armadas de cada tira: los 4 lados y las 2 diagonales. */
export function estiramiento(banda) {
  let peor = 0;
  for (let i = 0; i < banda.length - 1; i++) {
    const [a, b, A, B] = banda[i], [c, d, C, D] = banda[i + 1];
    for (const [p, q, P, Q] of [[a, b, A, B], [a, c, A, C], [b, d, B, D], [a, d, A, D], [b, c, B, C]]) {
      peor = Math.max(peor, Math.abs(dist2(p, q) - dist3(P, Q)));
    }
  }
  return peor;
}

/** Superficie de lo que se corta en una pieza plana (contornos de CORTE: el más grande menos los agujeros). */
export function areaPieza(pieza) {
  const areas = [];
  for (const [capa, tipo, d] of pieza.ents) {
    if (capa !== "CORTE") continue;
    if (tipo === "circle") { areas.push(Math.PI * d[2] * d[2]); continue; }
    let a = 0;
    if (tipo === "poly") {
      const p = d[0];
      for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
      a /= 2;
    } else if (tipo === "lwbulge") {
      for (let i = 0; i < d.length; i++) {
        const p = d[i], q = d[(i + 1) % d.length];
        a += (p[0] * q[1] - q[0] * p[1]) / 2;
        if (Math.abs(p[2]) > 1e-12) {                         // segmento circular del arco (con signo)
          const th = 4 * Math.atan(p[2]), c = dist2(p, q), r = Math.abs(c / (2 * Math.sin(th / 2)));
          a += Math.sign(th) * (r * r / 2) * (Math.abs(th) - Math.sin(Math.abs(th)));
        }
      }
    }
    areas.push(Math.abs(a));
  }
  areas.sort((x, y) => y - x);
  return areas.length ? areas[0] - areas.slice(1).reduce((s, x) => s + x, 0) : 0;
}
