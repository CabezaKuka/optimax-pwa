// Rejas y portones (herrería): elevación paramétrica, lista de corte con marcas y barras por perfil. Sin DOM.
// Port de portones.py del escritorio (fuente de verdad), sin el DXF ni el PDF.
//
// Piezas inclinadas: largo PUNTA A PUNTA y el ángulo de cada extremo medido DESDE LA ESCUADRA (0° = recto). Con los dos
// extremos en ángulo: «trapecio» = las puntas largas del mismo lado; «paralelos» = en lados opuestos. Un extremo que
// llega a una esquina lleva dos cortes: «en punta». Recortes de menos de MIN_RECORTE en las esquinas se descartan.
//
// Cada pieza distinta (perfil + largo + corte) lleva una marca (letra y color). Barras en modo Despuntar: cada pieza se
// corta a escuadra al largo punta a punta y las marcas se reparten después por largo.
//
// En este archivo (público) va la reja de ventana, que es lo que tiene la DEMO. Los tipos de portón (hojas, holguras,
// herrajes) y los costos van en el repo privado: portones/tipos.js y portones/costos.js (se registran con
// registrarTipos).
import { fijo, corto, pyRound } from "../geo/base.js";
import { med, optimizarRapido, verificar as verificarBarras } from "../barras/motor.js";

export const DENSIDAD = 7.85e-6;          // kg/mm³ (acero)
export const MIN_RECORTE = 30.0;          // mm: piezas inclinadas más cortas (puntas en las esquinas) no se ponen

export const TIPOS = [["reja_ventana", "Reja de ventana"], ["batiente_1", "Portón batiente 1 hoja"],
  ["batiente_2", "Portón batiente 2 hojas"], ["corredizo", "Portón corredizo"]];
export const RELLENOS = [["verticales", "Barrotes verticales"], ["horizontales", "Barrotes horizontales"],
  ["diagonales", "Diagonales"], ["rombos", "Rombos"], ["cuadricula", "Cuadrícula"], ["cruz", "Cruz (X) por tramo"],
  ["chapa", "Chapa ciega"]];
export const ARMADOS = [["a_tope", "A tope (mismo plano)"], ["pasantes", "Barrotes pasantes"]];
export const FORMAS = [["tubo", "Tubo cuadrado / rectangular"], ["tubo_red", "Tubo redondo"],
  ["macizo_cuad", "Macizo cuadrado"], ["macizo_red", "Macizo redondo"], ["planchuela", "Planchuela"], ["angulo", "Ángulo"]];
export const TEXTO = Object.fromEntries([...TIPOS, ...RELLENOS, ...ARMADOS, ...FORMAS]);
export const PORTONES = ["batiente_1", "batiente_2", "corredizo"];
// DEMO: solo reja de ventana, hasta 1500 × 1000 mm en cualquier orientación (lado mayor / lado menor)
export const DEMO_TIPOS = ["reja_ventana"];
export const DEMO_LADOS = [1500.0, 1000.0];
export const DEMO_MUESTRA = { tipo: "reja_ventana", nombre: "Reja de ventana", ancho: 1200.0, alto: 1000.0 };

export const ITEM_DEF = {
  nombre: "Portón", cantidad: 1, tipo: "batiente_2", ancho: 3000.0, alto: 2000.0,
  perfil_marco: "", perfil_relleno: "", perfil_trav: "",            // perfil_trav "" = el del marco
  relleno: "verticales", luz_max: 100.0, angulo: 45.0, n_trav: 1, armado: "a_tope", holg_lat: 10.0, holg_centro: 10.0,
  luz_piso: 30.0, solape: 100.0, esp_chapa: 1.5,
  trav_lado: "adelante",            // solo PWA (pasantes): el travesaño adelante o atrás de los barrotes (3D y dibujo)
  chapa_trav: "atras",              // solo PWA (chapa ciega): travesaños atrás de la chapa (una pieza) o a tope (paños)
  cruce: "cruzadas",                // solo PWA (cuadrícula, rombos): familias superpuestas o en el mismo plano (en tramos)
  // solo PWA (25-nov, Max): cara de frente de cada perfil. «a» = la 1.ª medida (40 en 40×20×2, como la PC), «b» = la 2.ª
  frente_marco: "a", frente_trav: "a", frente_relleno: "a",
};
/** Claves del ítem que la PC no tiene (las ignora al abrir el .nesting). */
export const SOLO_PWA = ["trav_lado", "chapa_trav", "cruce", "frente_marco", "frente_trav", "frente_relleno"];
const ENTEROS = new Set(["cantidad", "n_trav"]);
export const MAX_TRAV = 10;

// marcas: color de pantalla (el segundo número es el color de AutoCAD del escritorio; acá no se usa)
export const PALETA = ["#e15759", "#4e79a7", "#59a14f", "#f28e2b", "#b07aa1", "#76b7b2", "#edc948", "#9c755f", "#ff9da7",
  "#2f7f8f", "#8cd17d", "#d37295", "#a0cbe8", "#86754d"];
// corte de una pieza: [extremo, extremo, configuración]. Extremo = [ángulo, 0] si es un corte simple o [a, b] con a < b
// si va en punta. Configuración «T» trapecio / «P» paralelos, solo con dos cortes simples en ángulo.
export const RECTO = [[0, 0], [0, 0], ""];
export const INGLETE = [[45, 0], [45, 0], "T"];

export const usaLuz = (r) => r !== "chapa" && r !== "cruz";
export const usaAngulo = (r) => r === "diagonales" || r === "rombos";
export const usaArmado = (r) => r !== "chapa" && r !== "cruz";
/** Rellenos con dos familias que se cruzan (opción «Cruce»). */
export const usaCruce = (r) => r === "cuadricula" || r === "rombos";

/** round(x, n) de Python (correcto en los empates, como el escritorio). */
export const red = (x, n) => Number(fijo(x, n));
const rad = (g) => g * (Math.PI / 180);
const grados = (r) => r * (180 / Math.PI);

// ------------------------------------------------------------------ comparar como tuplas de Python
export function cmp(a, b) {
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = cmp(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
const igual = (a, b) => cmp(a, b) === 0;

// ------------------------------------------------------------------ perfiles
export class Perfil {
  constructor(nombre, forma, a, b = 0, t = 0, largo = 6000.0, precio = 0.0, kgMDato = 0.0) {
    Object.assign(this, { nombre, forma, a, b, t, largo, precio, kgMDato });
  }
  area() {
    const { a, t, forma: f } = this, b = this.b || this.a;
    if (f === "tubo") return a * b - Math.max(a - 2 * t, 0) * Math.max(b - 2 * t, 0);
    if (f === "tubo_red") return Math.PI / 4 * (a * a - Math.max(a - 2 * t, 0) ** 2);
    if (f === "macizo_red") return Math.PI * a * a / 4;
    if (f === "angulo") return t * (a + b - t);
    return a * b;                                         // macizo cuadrado, planchuela
  }
  kgM() { return this.kgMDato || this.area() * DENSIDAD * 1000; }
  perimetro() {
    if (this.forma === "tubo_red" || this.forma === "macizo_red") return Math.PI * this.a;
    return 2 * (this.a + (this.b || this.a));
  }
  get pulgadas() { return esPulgadas(this.nombre); }
}

export function esPulgadas(nombre) {
  const s = String(nombre).toLowerCase();
  return s.includes('"') || s.includes("”") || s.includes("pulg");
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:"|”|pulg\.?)?`;
const CALIBRES = { 10: 3.4, 11: 3.0, 12: 2.6, 13: 2.3, 14: 1.9, 16: 1.5, 18: 1.2, 20: 0.9, 22: 0.7, 24: 0.6 };

function valor(tok) {
  tok = tok.trim();
  const pulg = /("|”|pulg)/.test(tok);
  tok = tok.replace(/("|”|pulg\.?)/g, "").trim();
  let m, v;
  if ((m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(tok))) v = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if ((m = /^(\d+)\/(\d+)$/.exec(tok))) {
    if (Number(m[2]) === 0) throw new Error("división por cero");
    v = Number(m[1]) / Number(m[2]);
  } else {
    const s = tok.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("no es un número");
    v = Number(s);
  }
  return pulg ? v * 25.4 : v;
}

/** Primer grupo de medidas «40x40x2», «Ø1" × 2», «1 1/2"» del texto, en mm (portones._numeros). */
function numeros(txt) {
  const s = String(txt).replace(/[ØøΦ⌀]/g, " ");
  const m = new RegExp(`${NUM}(?:\\s*[x×X*]\\s*${NUM})*`).exec(s);
  if (!m) return [];
  let toks = m[0].split(/\s*[x×X*]\s*/).filter((t) => t.trim());
  const marca = toks.map((t) => /("|”|pulg)/.test(t));
  if (toks.length > 1 && marca[marca.length - 1] && !marca.slice(0, -1).some(Boolean)) {
    toks = [...toks.slice(0, -1).map((t) => t + '"'), toks[toks.length - 1]];
  }
  try { return toks.map(valor); } catch { return []; }
}

function calibre(txt) {
  const m = /(?:\bcal(?:ibre)?\.?\s*|#)(\d{1,2})\b/.exec(String(txt).toLowerCase());
  return m ? (CALIBRES[Number(m[1])] ?? null) : null;
}

/** [a, b, t] en mm a partir de un texto («40x40x2», «Ø12», «1 1/2" cal.16»), o null si no se entiende. */
export function leerMedidas(forma, txt) {
  const n = numeros(txt), g = calibre(txt);
  let a = null, b = null, t = null;
  if (forma === "tubo" || forma === "angulo") {
    if (n.length >= 3) [a, b, t] = n;
    else if (n.length === 2) [a, b, t] = [n[0], n[0], n[1]];
    else if (n.length === 1 && g) [a, b, t] = [n[0], n[0], g];
  } else if (forma === "tubo_red") {
    if (n.length >= 2) [a, b, t] = [n[0], n[0], n[1]];
    else if (n.length === 1 && g) [a, b, t] = [n[0], n[0], g];
  } else if (forma === "macizo_cuad") {
    if (n.length) [a, b, t] = [n[0], n.length > 1 ? n[1] : n[0], 0.0];
  } else if (forma === "macizo_red") {
    if (n.length) [a, b, t] = [n[0], n[0], 0.0];
  } else if (forma === "planchuela") {
    if (n.length >= 2) [a, b, t] = [Math.max(n[0], n[1]), Math.min(n[0], n[1]), 0.0];
  }
  if (a === null || a <= 0 || b <= 0 || t < 0) return null;
  if ((forma === "tubo" || forma === "tubo_red") && !(t > 0 && t < Math.min(a, b) / 2)) return null;
  if (forma === "angulo" && !(t > 0 && t < Math.min(a, b))) return null;
  return [a, b, t];
}

const f2 = (v) => corto(v, 2);

export function textoMedidas(forma, a, b, t) {
  if (forma === "tubo_red") return `Ø${f2(a)}×${f2(t)}`;
  if (forma === "macizo_red") return `Ø${f2(a)}`;
  if (forma === "macizo_cuad" || forma === "planchuela") return `${f2(a)}×${f2(b)}`;
  return `${f2(a)}×${f2(b)}×${f2(t)}`;
}

export function deducirForma(nombre) {
  const s = String(nombre).toLowerCase();
  if (s.includes("ángulo") || s.includes("angulo") || s.includes("angular")) return "angulo";
  if (s.includes("planchuela") || s.includes("pletina") || s.includes("platina")) return "planchuela";
  const redondo = s.includes("redondo") || s.includes("ø") || s.includes("⌀");
  if (s.includes("tubo") || s.includes("caño")) return redondo ? "tubo_red" : "tubo";
  if (redondo) return "macizo_red";
  if (s.includes("macizo") || s.includes("cuadrado")) return "macizo_cuad";
  return "";
}

/** [forma, medidas] que se leen del nombre («Tubo cuadrado 40×40×2» → tubo, 40×40×2), o ["", ""]. */
export function deducirPerfil(nombre) {
  const forma = deducirForma(nombre);
  const m = forma ? leerMedidas(forma, nombre) : null;
  return m ? [forma, textoMedidas(forma, ...m)] : ["", ""];
}

/** true si el perfil tiene dos caras distintas que pueden ir de frente (tubo rectangular, ángulo de alas distintas,
 * planchuela, macizo rectangular). */
export const sePuedeGirar = (p) => !!p && p.forma !== "tubo_red" && p.forma !== "macizo_red" && p.b > 0 &&
  Math.abs(p.a - p.b) > 1e-9;

/** Perfil con la 2.ª medida de frente (botón «Frente», solo PWA): mismo nombre, así la compra de barras se junta con
 * el sin girar; «girado» separa las piezas en la lista de corte (otro corte: el inglete cruza la otra cara). */
export function girarPerfil(p) {
  if (!sePuedeGirar(p) || p.girado) return p;
  const g = new Perfil(p.nombre, p.forma, p.b, p.a, p.t, p.largo, p.precio, p.kgMDato);
  g.girado = true;
  g.rotulo = `${p.nombre} · ${corto(g.a, 2)} de frente`;
  return g;
}

/** Perfil de un material {nombre, forma, medidas, largo, precio, kg_m} o null si le faltan forma o medidas. */
export function perfilDe(m) {
  const forma = String(m.forma || "");
  if (!(forma in TEXTO) || !FORMAS.some(([k]) => k === forma)) return null;
  const md = leerMedidas(forma, m.medidas || "");
  if (!md) return null;
  const num = (v, d) => { const x = Number(v || d); return Number.isFinite(x) ? x : NaN; };
  const largo = num(m.largo, 6000), precio = num(m.precio, 0), kg = num(m.kg_m, 0);
  if ([largo, precio, kg].some(Number.isNaN)) return null;
  return new Perfil(String(m.nombre || "Perfil"), forma, ...md, largo, precio, kg);
}

/** {nombre: Perfil} de una lista de materiales (los que no tienen medidas quedan afuera). */
export function perfilesDe(materiales) {
  const out = {};
  for (const m of materiales || []) {
    const p = perfilDe(m);
    if (p) out[p.nombre] = p;
  }
  return out;
}

/** kg/m calculado con las medidas (0 si no se entienden). */
export function kgMMedidas(forma, medidas) {
  const md = forma in TEXTO ? leerMedidas(forma, medidas) : null;
  return md ? red(new Perfil("x", forma, ...md).kgM(), 3) : 0.0;
}

// ------------------------------------------------------------------ ítems
/** Ítem completo y con tipos correctos (tolera claves faltantes o de más). */
export function normalizarItem(d) {
  const out = { ...ITEM_DEF };
  for (const [k, v] of Object.entries(d || {})) {
    if (!(k in ITEM_DEF)) continue;
    const base = ITEM_DEF[k];
    if (typeof base === "string") out[k] = String(v);
    else {
      const x = Number(v);
      if (v === null || v === "" || typeof v === "boolean" || !Number.isFinite(x)) continue;
      out[k] = ENTEROS.has(k) ? pyRound(x) : x;
    }
  }
  if (out.tipo === "panel_cerco") out.tipo = "reja_ventana";
  if (!TIPOS.some(([k]) => k === out.tipo)) out.tipo = ITEM_DEF.tipo;
  if (!RELLENOS.some(([k]) => k === out.relleno)) out.relleno = ITEM_DEF.relleno;
  if (!ARMADOS.some(([k]) => k === out.armado)) out.armado = ITEM_DEF.armado;
  out.cantidad = Math.max(1, out.cantidad);
  out.n_trav = Math.max(0, Math.min(MAX_TRAV, out.n_trav));
  out.nombre = out.nombre.trim() || TEXTO[out.tipo];
  for (const k of ["frente_marco", "frente_trav", "frente_relleno"]) if (out[k] !== "b") out[k] = "a";
  return out;
}

// ------------------------------------------------------------------ modelo
export class Cota {
  /** Cota de la elevación. eje «H» mide en x, «V» mide en y (ver portones.Cota). */
  constructor(eje, origen, puntos, pos, base = null, tipo = "ordenada", lado = -1, general = false) {
    Object.assign(this, { eje, origen, puntos, pos, base, tipo, lado, general });
  }
  /** [[coordenada del texto, texto]]: la lineal en el medio, la ordenada en cada punto. */
  valores() {
    if (this.tipo === "lineal") {
      const p = this.puntos[0];
      return [[(this.origen + p) / 2, med(Math.abs(p - this.origen), 1)]];
    }
    return this.puntos.map((p) => [p, med(p - this.origen, 1)]);
  }
}

class Resultado {
  constructor(vano) {
    this.vano = vano;
    this.hojas = [];            // [x0, y0, ancho, alto, nombre]
    this.piezas = [];           // {perfil, largo, corte, cant, uso}
    this.formas = [];           // [capa, [[x, y], ...], clave de pieza o null]
    this.juntas = [];           // [perfil, cantidad de uniones]
    this.chapas = [];           // [ancho, alto, espesor]
    this.soldadura_extra_mm = 0.0;
    this.luces = [];
    this.herrajes = [];
    this.avisos = [];
    this.cotas = [];
    this.u = 100.0;             // separación entre filas de cotas (mm)
  }
}

/** Mínima cantidad de barrotes para que todas las luces sean iguales y <= luz_max. [n, luz]. */
export function distribuir(libre, anchoBarra, luzMax) {
  if (libre <= luzMax) return [0, libre];
  const n = Math.ceil((libre - luzMax) / (anchoBarra + luzMax) - 1e-9);
  return [n, (libre - n * anchoBarra) / (n + 1)];
}

/** Identifica una pieza de la lista de corte (mismo perfil, largo y corte = misma marca). */
export const clave = (perfil, largo, corte) =>
  `${perfil.nombre}${perfil.girado ? GIRADO : ""}\u0001${red(largo, 1)}\u0001${JSON.stringify(corte)}`;
/** Marca del perfil girado en la clave, pegada al nombre (la vista 3D la lee). */
export const GIRADO = "\u0002g";

const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function rect(R, capa, x, y, w, h, perfil = null, largo = null) {
  R.formas.push([capa, rectPts(x, y, w, h), perfil ? clave(perfil, largo, RECTO) : null]);
}

// Un semiplano es [nx, ny, c] y representa nx*x + ny*y <= c.
const planosRect = (x0, y0, w, h) => [[-1, 0, -x0], [1, 0, x0 + w], [0, -1, -y0], [0, 1, y0 + h]];

/** Sutherland–Hodgman: recorta un polígono convexo con una lista de semiplanos. */
function recortarPoligono(poly, planos) {
  for (const [nx, ny, c] of planos) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const fp = nx * P[0] + ny * P[1] - c;
      const fq = nx * Q[0] + ny * Q[1] - c;
      if (fp <= 0) out.push(P);
      if ((fp < 0 && 0 < fq) || (fq < 0 && 0 < fp)) {
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}

/** Recorta la recta p0 + t·d. [tmin, tmax, plano_inicio, plano_fin] o null. */
function recortarLinea(p0, d, planos) {
  let tmin = -1e9, tmax = 1e9, pmin = null, pmax = null;
  for (const pl of planos) {
    const [nx, ny, c] = pl;
    const den = nx * d[0] + ny * d[1];
    const num = c - (nx * p0[0] + ny * p0[1]);
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = num / den;
    if (den > 0 && t < tmax) { tmax = t; pmax = pl; } else if (den < 0 && t > tmin) { tmin = t; pmin = pl; }
  }
  if (tmax - tmin <= 1e-6 || pmin === null || pmax === null) return null;
  return [tmin, tmax, pmin, pmax];
}

/** [ángulo desde la escuadra, lado de la punta larga: +1 / −1 / 0] del corte contra el semiplano. */
function extremo(d, n, plano) {
  const [nx, ny] = plano;
  const nd = nx * d[0] + ny * d[1], nn = nx * n[0] + ny * n[1];
  const ang = pyRound(grados(Math.atan2(Math.abs(nn), Math.abs(nd))));
  return [ang, ang === 0 ? 0 : (nn < 0 ? 1 : -1)];
}

/** Corte de un extremo de la franja: ["S", ángulo, lado] o ["D", a, b] (extremo en punta). */
function corteExtremo(p0, d, n, a, planos, fin) {
  const pls = [];
  const agregar = (r) => {
    if (r === null) return;
    const pl = fin ? r[3] : r[2];
    if (!pls.some((q) => igual(q, pl))) pls.push(pl);
  };
  for (const e of [1, -1]) agregar(recortarLinea([p0[0] + e * a / 2 * n[0], p0[1] + e * a / 2 * n[1]], d, planos));
  if (pls.length !== 2) agregar(recortarLinea(p0, d, planos));
  if (pls.length >= 2) {
    const a1 = extremo(d, n, pls[0])[0], a2 = extremo(d, n, pls[1])[0];
    if (a1 !== a2 || !igual(pls[0].slice(0, 2), pls[1].slice(0, 2))) return ["D", Math.min(a1, a2), Math.max(a1, a2)];
  }
  return ["S", ...extremo(d, n, pls[0])];
}

/** Clave del corte a partir de los dos extremos (ver RECTO). */
function claveCorte(e0, e1) {
  const t0 = e0[0] === "S" ? [e0[1], 0] : [e0[1], e0[2]];
  const t1 = e1[0] === "S" ? [e1[1], 0] : [e1[1], e1[2]];
  let cfg = "";
  if (e0[0] === "S" && e1[0] === "S" && e0[1] && e1[1]) cfg = e0[2] === e1[2] ? "T" : "P";
  return cmp(t0, t1) <= 0 ? [t0, t1, cfg] : [t1, t0, cfg];
}

const textoExt = (e) => (e[1] === 0 ? `${e[0]}°` : `punta ${e[0]}°+${e[1]}°`);

/** «Recto», «45° / 45° trapecio», «11° / 39° paralelos», «0° / 30°», «punta 33°+57° / punta 33°+57°». */
export function textoCorte(corte) {
  const [e0, e1, cfg] = corte;
  if (igual(e0, [0, 0]) && igual(e1, [0, 0])) return "Recto";
  return `${textoExt(e0)} / ${textoExt(e1)}` + ({ T: " trapecio", P: " paralelos" }[cfg] || "");
}

/** Contorno esquemático de la pieza (fuera de escala, con los ángulos reales). [[x, y]] con y hacia arriba. */
export function croquis(corte, L = 1.0, h = 0.25) {
  const [e0, e1, cfg] = corte;
  const tope = L * 0.3;
  const off = (ang, alto) => Math.min(alto * Math.tan(rad(ang)), tope);
  const izq = e0[1] ? [[off(e0[0], h / 2), 0.0], [0.0, h / 2], [off(e0[1], h / 2), h]]
    : [[0.0, 0.0], [off(e0[0], h), h]];
  let der;
  if (e1[1]) der = [[L - off(e1[0], h / 2), 0.0], [L, h / 2], [L - off(e1[1], h / 2), h]];
  else if (cfg === "P") der = [[L - off(e1[0], h), 0.0], [L, h]];
  else der = [[L, 0.0], [L - off(e1[0], h), h]];
  return [izq[0], ...der, ...izq.slice(1).reverse()];
}

/** Barra de ancho perfil.a cuyo eje es la recta n·p = s (θ desde la horizontal), recortada por 'planos'. */
function piezaInclinada(R, perfil, s, theta, planos, uso, prueba = false) {
  const th = rad(theta);
  const d = [Math.cos(th), Math.sin(th)];
  const n = [-d[1], d[0]];
  const a = perfil.a, L = 1e5;
  const p0 = [s * n[0], s * n[1]];
  const franja = [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([sg, sl]) =>
    [p0[0] + sg * a / 2 * n[0] + sl * L * d[0], p0[1] + sg * a / 2 * n[1] + sl * L * d[1]]);
  const poly = recortarPoligono(franja, planos);
  const eje = recortarLinea(p0, d, planos);
  if (poly.length < 3 || eje === null) return null;
  const proy = poly.map(([x, y]) => d[0] * x + d[1] * y);
  const largo = Math.max(...proy) - Math.min(...proy);                 // punta a punta
  if (largo < Math.max(MIN_RECORTE, 2 * a)) return null;
  if (prueba) return true;
  const [tmin, tmax] = eje;
  const corte = claveCorte(corteExtremo(p0, d, n, a, planos, false), corteExtremo(p0, d, n, a, planos, true));
  R.formas.push(["BARRA", poly, clave(perfil, largo, corte)]);
  R.piezas.push({ perfil, largo: red(largo, 1), corte, cant: 1, uso });
  R.juntas.push([perfil, 2]);
  return [[p0[0] + tmin * d[0], p0[1] + tmin * d[1]], [p0[0] + tmax * d[0], p0[1] + tmax * d[1]]];
}

/** Barras paralelas a θ dentro del tramo, con luz perpendicular 'luz', centradas en el tramo. */
function familiaDiagonal(R, perfil, theta, luz, bay, uso, recorte = null) {
  const [x0, y0, w, h] = bay;
  const th = rad(theta);
  const n = [-Math.sin(th), Math.cos(th)];
  const ss = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].map(([x, y]) => n[0] * x + n[1] * y);
  const smin = Math.min(...ss), smax = Math.max(...ss);
  const c = (smin + smax) / 2, paso = luz + perfil.a;
  const segs = [];
  segs.offsets = [];                                    // posición (sobre n) de cada barra puesta
  for (let k = Math.floor((smin - c) / paso); k <= Math.ceil((smax - c) / paso); k++) {
    if (recorte && !piezaInclinada(R, perfil, c + k * paso, theta, planosRect(...bay), uso, true)) continue;
    const seg = piezaInclinada(R, perfil, c + k * paso, theta, planosRect(...(recorte || bay)), uso);
    if (seg) { segs.push(seg); segs.offsets.push(c + k * paso); }
  }
  return segs;
}

/**
 * Rombos en el mismo plano (PWA): la familia theta en tramos entre las barras de la otra familia (theta1, en las
 * posiciones offs1), con el corte en ángulo contra cada barra. Mismas posiciones que familiaDiagonal.
 */
function familiaCortada(R, perfil, theta, luz, bay, uso, recorte, theta1, offs1) {
  const [x0, y0, w, h] = bay;
  const th = rad(theta), th1 = rad(theta1);
  const n = [-Math.sin(th), Math.cos(th)], n1 = [-Math.sin(th1), Math.cos(th1)];
  const ss = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].map(([x, y]) => n[0] * x + n[1] * y);
  const smin = Math.min(...ss), smax = Math.max(...ss);
  const c = (smin + smax) / 2, paso = luz + perfil.a, a2 = perfil.a / 2;
  const cortes = [...offs1].sort((p, q) => p - q);
  const segs = [];
  for (let k = Math.floor((smin - c) / paso); k <= Math.ceil((smax - c) / paso); k++) {
    const s = c + k * paso;
    if (!piezaInclinada(R, perfil, s, theta, planosRect(...bay), uso, true)) continue;      // la barra no va
    const base = planosRect(...(recorte || bay));
    for (let i = 0; i <= cortes.length; i++) {
      const pl = [...base];
      if (i > 0) pl.push([-n1[0], -n1[1], -(cortes[i - 1] + a2)]);
      if (i < cortes.length) pl.push([n1[0], n1[1], cortes[i] - a2]);
      const seg = piezaInclinada(R, perfil, s, theta, pl, uso);
      if (seg) segs.push(seg);
    }
  }
  return segs;
}

function cruces(segsA, segsB) {
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  let n = 0;
  for (const [p1, p2] of segsA) {
    for (const [q1, q2] of segsB) {
      if (orient(p1, p2, q1) * orient(p1, p2, q2) < 0 && orient(q1, q2, p1) * orient(q1, q2, p2) < 0) n += 1;
    }
  }
  return n;
}

/** Máximo de un lado de la reja en la DEMO, según el otro lado (vale en cualquier orientación). */
export function demoMax(otro) {
  const [mayor, menor] = DEMO_LADOS;
  return otro <= menor ? mayor : menor;
}

/** ¿La DEMO puede dibujar este ítem? (reja de ventana dentro de DEMO_LADOS) */
export function demoPermite(it) {
  const [a, b] = [it.ancho, it.alto].sort((x, y) => y - x);
  return DEMO_TIPOS.includes(it.tipo) && a <= DEMO_LADOS[0] + 1e-9 && b <= DEMO_LADOS[1] + 1e-9;
}

// ------------------------------------------------------------------ tipos (los portones se registran desde el PRO)
const TIPOS_DEF = {
  reja_ventana: { hojas: (it) => [[0.0, 0.0, it.ancho, it.alto, "Hoja"]], herrajes: () => [] },
};
/** Agrega tipos {id: {hojas(it), herrajes(it, hojas)}} (los portones del repo privado). */
export function registrarTipos(tipos) { Object.assign(TIPOS_DEF, tipos); }
export const tipoDisponible = (t) => t in TIPOS_DEF;

/** Una hoja: marco (pm), travesaños o montantes (pt; null = el del marco) y relleno (pr). */
function hoja(x0, y0, W, H, it, pm, pr, nombre, R, espejo = false, pt = null) {
  pt = pt || pm;
  const a = pm.a;
  const iw = W - 2 * a, ih = H - 2 * a;
  if (iw <= 0 || ih <= 0) throw new Error(`${nombre}: el marco no deja espacio interior`);
  R.hojas.push([x0, y0, W, H, nombre]);

  // marco a inglete (se dibuja con la forma real del corte a 45°)
  const x1 = x0 + W, y1 = y0 + H;
  const kh = clave(pm, W, INGLETE), kv = clave(pm, H, INGLETE);
  R.formas.push(
    ["MARCO", [[x0, y0], [x1, y0], [x1 - a, y0 + a], [x0 + a, y0 + a]], kh],       // inferior
    ["MARCO", [[x0 + a, y1 - a], [x1 - a, y1 - a], [x1, y1], [x0, y1]], kh],       // superior
    ["MARCO", [[x0, y0], [x0 + a, y0 + a], [x0 + a, y1 - a], [x0, y1]], kv],       // izquierdo
    ["MARCO", [[x1 - a, y0 + a], [x1, y0], [x1, y1], [x1 - a, y1 - a]], kv],       // derecho
  );
  R.piezas.push({ perfil: pm, largo: red(W, 1), corte: INGLETE, cant: 2, uso: "marco horizontal" });
  R.piezas.push({ perfil: pm, largo: red(H, 1), corte: INGLETE, cant: 2, uso: "marco vertical" });
  R.juntas.push([pm, 4]);

  const ix = x0 + a, iy = y0 + a, n = it.n_trav;
  const relleno = it.relleno;
  const vertical = relleno !== "horizontales";
  // Marco de ángulo (PWA, 25-nov, Max; pendiente en la PC): la cara ancha adelante y el ala atrás; travesaños, relleno
  // y chapa van adentro de la L, apoyados detrás de la cara, hasta las alas: cada extremo que toca el marco se alarga
  // e = a − t (el vano menos 2 espesores del ángulo). La distribución y lo que se ve de frente no cambian.
  const e = pm.forma === "angulo" && pm.t > 0 && pm.t < a ? a - pm.t : 0;
  const ampliar = ([x, y, w, h], [eL, eB, eR, eT]) => [x - eL, y - eB, w + eL + eR, h + eB + eT];

  // travesaños (perpendiculares a los barrotes; con chapa, horizontales), de cara interior a cara interior del marco
  const ejesTrav = [];
  const at = pt.a;
  let tramos;
  if (vertical) {
    const tramo = (ih - n * at) / (n + 1);
    if (tramo <= 0) throw new Error("Demasiados travesaños para esa altura");
    for (let k = 0; k < n; k++) {
      const y = iy + (k + 1) * tramo + k * at;
      rect(R, "TRAVESANO", ix - e, y, iw + 2 * e, at, pt, iw + 2 * e);
      ejesTrav.push([[ix - e, y + at / 2], [ix + iw + e, y + at / 2]]);
    }
    if (n) R.piezas.push({ perfil: pt, largo: red(iw + 2 * e, 1), corte: RECTO, cant: n, uso: "travesaño" });
    tramos = Array.from({ length: n + 1 }, (_, k) => [ix, iy + k * (tramo + at), iw, tramo]);
  } else {
    const tramo = (iw - n * at) / (n + 1);
    if (tramo <= 0) throw new Error("Demasiados montantes para ese ancho");
    for (let k = 0; k < n; k++) {
      const x = ix + (k + 1) * tramo + k * at;
      rect(R, "TRAVESANO", x, iy - e, at, ih + 2 * e, pt, ih + 2 * e);
      ejesTrav.push([[x + at / 2, iy - e], [x + at / 2, iy + ih + e]]);
    }
    if (n) R.piezas.push({ perfil: pt, largo: red(ih + 2 * e, 1), corte: RECTO, cant: n, uso: "montante" });
    tramos = Array.from({ length: n + 1 }, (_, k) => [ix + k * (tramo + at), iy, tramo, ih]);
  }
  if (n) R.juntas.push([pt, 2 * n]);
  // lados del marco que toca cada tramo [izq., abajo, der., arriba] (los de los travesaños no se alargan)
  const ladosTramo = (k) => (vertical ? [e, k === 0 ? e : 0, e, k === n ? e : 0] : [k === 0 ? e : 0, e, k === n ? e : 0, e]);

  if (relleno === "chapa") {
    // atrás (por defecto, como la PC): una sola chapa y los travesaños detrás; a tope (PWA): un paño por tramo
    const panos = it.chapa_trav === "a_tope" && n > 0 ? tramos.map((z, k) => ampliar(z, ladosTramo(k))) : [[ix - e, iy - e, iw + 2 * e, ih + 2 * e]];
    for (const [cx, cy, cw, ch] of panos) {
      rect(R, "CHAPA", cx, cy, cw, ch);
      R.chapas.push([cw, ch, it.esp_chapa]);
      R.soldadura_extra_mm += 2 * (cw + ch) * 0.3;      // puntos / cordones intermitentes ≈ 30 % del contorno
    }
    return;
  }

  const punto = 2 * pr.a;                               // soldadura estimada por cada cruce de piezas superpuestas
  const luzMax = it.luz_max;

  if (relleno === "cruz") {                             // siempre por tramo: el armado no aplica
    for (const [k, [tx, ty, tw, th]] of tramos.entries()) {
      const cx = tx + tw / 2, cy = ty + th / 2;
      const t1 = grados(Math.atan2(th, tw));
      const t2 = 180 - t1;
      const pl = planosRect(...ampliar([tx, ty, tw, th], ladosTramo(k)));
      const r1 = rad(t1);
      const n1 = [-Math.sin(r1), Math.cos(r1)];
      const s1 = n1[0] * cx + n1[1] * cy;
      const r2 = rad(t2);
      const s2 = -Math.sin(r2) * cx + Math.cos(r2) * cy;
      // barra 1 entera, barra 2 en dos mitades que apoyan contra la barra 1
      piezaInclinada(R, pr, s1, t1, pl, "cruz entera");
      piezaInclinada(R, pr, s2, t2, [...pl, [n1[0], n1[1], s1 - pr.a / 2]], "cruz media");
      piezaInclinada(R, pr, s2, t2, [...pl, [-n1[0], -n1[1], -(s1 + pr.a / 2)]], "cruz media");
    }
    return;
  }

  // a tope → el relleno se corta en cada tramo; pasantes → entero de marco a marco, travesaños superpuestos
  const pasantes = it.armado === "pasantes" && n > 0;
  const zonas = pasantes ? [[ix, iy, iw, ih]] : tramos;
  const lados = pasantes ? [[e, e, e, e]] : tramos.map((_, k) => ladosTramo(k));
  let ejes = [];

  if (relleno === "diagonales") {
    const theta = espejo ? 180 - it.angulo : it.angulo;
    for (const [k, bay] of zonas.entries()) {
      const s = familiaDiagonal(R, pr, theta, luzMax, bay, "diagonal", e ? ampliar(bay, lados[k]) : null);
      ejes = ejes.concat(s);
      if (s.length) R.luces.push(luzMax);
    }
  } else if (relleno === "rombos") {
    for (const [k, bay] of zonas.entries()) {
      const rec = e ? ampliar(bay, lados[k]) : null;
      const s1 = familiaDiagonal(R, pr, it.angulo, luzMax, bay, "rombo", rec);
      let s2;
      if (it.cruce === "plano") {                       // mismo plano: la 2.ª familia en tramos (juntas, sin cruces)
        s2 = familiaCortada(R, pr, 180 - it.angulo, luzMax, bay, "rombo en tramos", rec, it.angulo, s1.offsets);
      } else {
        s2 = familiaDiagonal(R, pr, 180 - it.angulo, luzMax, bay, "rombo", rec);
        R.soldadura_extra_mm += cruces(s1, s2) * punto;
      }
      ejes = ejes.concat(s1, s2);
      if (s1.length || s2.length) R.luces.push(luzMax);
    }
  } else if (relleno === "cuadricula") {
    for (const [k, [tx, ty, tw, th]] of zonas.entries()) {
      const [eL, eB, eR, eT] = lados[k];
      const [nv, luzv] = distribuir(tw, pr.a, luzMax);
      const [nh, luzh] = distribuir(th, pr.a, luzMax);
      for (let i = 0; i < nv; i++) {
        const x = tx + luzv + i * (pr.a + luzv);
        rect(R, "BARRA", x, ty - eB, pr.a, th + eB + eT, pr, th + eB + eT);
        ejes.push([[x + pr.a / 2, ty - eB], [x + pr.a / 2, ty + th + eT]]);
      }
      const plano = it.cruce === "plano" && nv > 0;     // mismo plano: horizontales en tramos entre los verticales
      // tramos de cada horizontal: [x de inicio, largo]
      const xs = Array.from({ length: nv }, (_, i) => tx + luzv + i * (pr.a + luzv));
      const tramosH = plano ? [[tx - eL, luzv + eL], ...xs.slice(0, -1).map((x) => [x + pr.a, luzv]), [xs[nv - 1] + pr.a, luzv + eR]]
        : [[tx - eL, tw + eL + eR]];
      for (let j = 0; j < nh; j++) {
        const y = ty + luzh + j * (pr.a + luzh);
        for (const [hx, hl] of tramosH) {
          rect(R, "BARRA", hx, y, hl, pr.a, pr, hl);
          ejes.push([[hx, y + pr.a / 2], [hx + hl, y + pr.a / 2]]);
        }
      }
      if (nv) {
        R.piezas.push({ perfil: pr, largo: red(th + eB + eT, 1), corte: RECTO, cant: nv, uso: "cuadrícula vertical" });
        R.juntas.push([pr, 2 * nv]);
      }
      if (nh) {
        const porLargo = new Map();
        for (const [, hl] of tramosH) porLargo.set(red(hl, 1), (porLargo.get(red(hl, 1)) || 0) + nh);
        for (const [hl, q] of porLargo) {
          R.piezas.push({ perfil: pr, largo: hl, corte: RECTO, cant: q, uso: plano ? "cuadrícula horizontal en tramos" : "cuadrícula horizontal" });
          R.juntas.push([pr, 2 * q]);
        }
      }
      if (!plano) R.soldadura_extra_mm += nv * nh * punto;
      R.luces.push(luzv, luzh);
    }
  } else {                                              // barrotes verticales u horizontales
    for (const [k, [tx, ty, tw, th]] of zonas.entries()) {
      const [eL, eB, eR, eT] = lados[k];
      let nb, luz, largo;
      if (vertical) {
        [nb, luz] = distribuir(tw, pr.a, luzMax);
        largo = th + eB + eT;
        for (let i = 0; i < nb; i++) {
          const x = tx + luz + i * (pr.a + luz);
          rect(R, "BARRA", x, ty - eB, pr.a, largo, pr, largo);
          ejes.push([[x + pr.a / 2, ty - eB], [x + pr.a / 2, ty + th + eT]]);
        }
      } else {
        [nb, luz] = distribuir(th, pr.a, luzMax);
        largo = tw + eL + eR;
        for (let i = 0; i < nb; i++) {
          const y = ty + luz + i * (pr.a + luz);
          rect(R, "BARRA", tx - eL, y, largo, pr.a, pr, largo);
          ejes.push([[tx - eL, y + pr.a / 2], [tx + tw + eR, y + pr.a / 2]]);
        }
      }
      if (nb) {
        R.piezas.push({ perfil: pr, largo: red(largo, 1), corte: RECTO, cant: nb, uso: pasantes ? "barrote pasante" : "barrote" });
        R.juntas.push([pr, 2 * nb]);
      }
      R.luces.push(luz);
    }
  }
  if (pasantes) R.soldadura_extra_mm += cruces(ejes, ejesTrav) * punto;
}

/** Elevación de un ítem con sus perfiles {nombre: Perfil}. Lanza Error con un mensaje para el usuario. */
export function generar(it, perfiles) {
  it = normalizarItem(it);
  const def = TIPOS_DEF[it.tipo];
  if (!def) throw new Error("ese tipo es de la versión PRO");
  let pm = perfiles[it.perfil_marco];
  if (!pm) throw new Error(it.perfil_marco ? `el perfil «${it.perfil_marco}» no tiene medidas` : "elegí el perfil del marco");
  let pr = perfiles[it.perfil_relleno];
  if (!pr) {
    if (it.relleno !== "chapa") {
      throw new Error(it.perfil_relleno ? `el perfil «${it.perfil_relleno}» no tiene medidas` : "elegí el perfil del relleno");
    }
    pr = null;                                          // chapa: más abajo, el del marco
  }
  let pt = pm;
  if (it.perfil_trav && it.n_trav > 0) {
    pt = perfiles[it.perfil_trav];
    if (!pt) throw new Error(`el perfil «${it.perfil_trav}» de los travesaños no tiene medidas`);
  }
  // botón «Frente» (solo PWA): con «Igual que el marco» los travesaños siguen al marco
  const marcoGirado = it.frente_marco === "b";
  if (it.perfil_trav && it.n_trav > 0 ? it.frente_trav === "b" : marcoGirado) pt = girarPerfil(pt);
  if (it.relleno !== "chapa" && it.frente_relleno === "b") pr = girarPerfil(pr);
  if (marcoGirado) pm = girarPerfil(pm);
  if (pr === null) pr = pm;
  if (it.ancho <= 0 || it.alto <= 0) throw new Error("el ancho y el alto tienen que ser mayores que cero");
  if (usaLuz(it.relleno) && it.luz_max <= 0) throw new Error("la luz máxima tiene que ser mayor que cero");
  if (usaAngulo(it.relleno) && !(it.angulo >= 10 && it.angulo <= 80)) throw new Error("el ángulo tiene que estar entre 10° y 80°");
  if (it.relleno === "chapa" && it.esp_chapa <= 0) throw new Error("el espesor de la chapa tiene que ser mayor que cero");
  const R = new Resultado([it.ancho, it.alto]);
  const hojas = def.hojas(it);
  for (const [x0, y0, W, H, nombre] of hojas) {
    if (W <= 0 || H <= 0) throw new Error("las holguras dejan la hoja sin tamaño");
    hoja(x0, y0, W, H, it, pm, pr, nombre, R, nombre === "Hoja der.", pt);
  }
  R.herrajes.push(...def.herrajes(it, hojas));
  cotas(R, it, pm.a);
  return R;
}

function unicos(vals) {
  const out = [];
  for (const v of [...vals].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > 0.05) out.push(v);
  return out;
}

/** Cotas de armado a partir de la geometría ya generada (portones._cotas). */
function cotas(R, it, a) {
  const [W, H] = R.vano;
  const u = (R.u = Math.max(80.0, Math.max(W, H) / 28));
  const uv = 1.5 * u;                                   // al costado el texto va acostado: más lugar entre filas
  const tol = 1e-6;
  const varias = PORTONES.includes(it.tipo);
  for (const [x0, y0, w, h, nombre] of R.hojas) {
    const lado = nombre === "Hoja der." ? 1 : -1;
    const xl = lado > 0 ? x0 + w : x0;
    const dentro = R.formas.filter(([, pts]) =>
      pts.every(([x, y]) => x0 - tol <= x && x <= x0 + w + tol && y0 - tol <= y && y <= y0 + h + tol));
    const travY = [], travX = [], barX = [], barY = [];
    const lineasH = [y0 + a, y0 + h - a], lineasV = [x0 + a, x0 + w - a];
    const sumar = (lst, v) => { if (!lst.includes(v)) lst.push(v); };
    const inclinadas = [];
    for (const [cap, pts, k] of dentro) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
      if (cap === "TRAVESANO") {
        if (dx > dy) { travY.push(Math.min(...ys)); sumar(lineasH, Math.min(...ys)); sumar(lineasH, Math.max(...ys)); } else { travX.push(Math.min(...xs)); sumar(lineasV, Math.min(...xs)); sumar(lineasV, Math.max(...xs)); }
      } else if (cap === "BARRA" && k !== null && k.endsWith("\u0001" + JSON.stringify(RECTO))) {
        if (dy > dx) barX.push(Math.min(...xs)); else barY.push(Math.min(...ys));
      } else if (cap === "BARRA") inclinadas.push(pts);
    }
    if (varias) {
      R.cotas.push(new Cota("H", x0, [x0 + w], y0 + h + u, y0 + h, "lineal", 1, true));
      R.cotas.push(new Cota("V", y0, [y0 + h], xl + lado * uv, xl, "lineal", lado, true));
    }
    let nivel = 2;
    if (travY.length) { R.cotas.push(new Cota("V", y0, unicos(travY), xl + lado * nivel * uv, xl, "ordenada", lado)); nivel += 1; }
    if (travX.length) R.cotas.push(new Cota("H", x0, unicos(travX), y0 + h + 2 * u, y0 + h, "ordenada", 1));
    if (barX.length) R.cotas.push(new Cota("H", x0, unicos(barX), y0 - u, y0, "ordenada", -1));
    if (barY.length) R.cotas.push(new Cota("V", y0, unicos(barY), xl + lado * nivel * uv, xl, "ordenada", lado));
    // piezas inclinadas: dónde apoya cada una (la cara de su borde de apoyo) sobre el marco o el travesaño
    const sobre = new Map();
    const anotar = (k, v) => {
      const s = JSON.stringify(k);
      if (!sobre.has(s)) sobre.set(s, [k, []]);
      sobre.get(s)[1].push(v);
    };
    for (const pts of inclinadas) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      for (const c of lineasH) {
        const en = pts.filter((p) => Math.abs(p[1] - c) < 1e-6).map((p) => p[0]);
        if (en.length >= 2) anotar(["H", c, cy > c ? -1 : 1], Math.min(...en));
      }
      for (const c of lineasV) {
        const en = pts.filter((p) => Math.abs(p[0] - c) < 1e-6).map((p) => p[1]);
        if (en.length >= 2) anotar(["V", c, cx > c ? -1 : 1], Math.min(...en));
      }
    }
    for (const [[eje, c, ld], vals] of [...sobre.values()].sort((p, q) => cmp(p[0], q[0]))) {
      R.cotas.push(new Cota(eje, eje === "H" ? x0 : y0, unicos(vals), c, null, "ordenada", ld));
    }
  }
  // vano, holguras y luz al piso
  const xmin = Math.min(0.0, ...R.hojas.map((h) => h[0]));
  const xmax = Math.max(W, ...R.hojas.map((h) => h[0] + h[2]));
  const ymin = Math.min(0.0, ...R.hojas.map((h) => h[1]));
  R.cotas.push(new Cota("H", 0.0, [W], ymin - 2.8 * u, 0.0, "lineal", -1, true));
  R.cotas.push(new Cota("V", 0.0, [H], xmin - 4 * uv, 0.0, "lineal", -1, true));
  if (varias) {
    const arriba = H + 3 * u;
    const tramos = [];
    if (it.tipo === "batiente_1" || it.tipo === "batiente_2") {
      const hs = [...R.hojas].sort(cmp);
      tramos.push([0.0, hs[0][0]]);
      if (hs.length === 2) tramos.push([hs[0][0] + hs[0][2], hs[1][0]]);
      tramos.push([hs[hs.length - 1][0] + hs[hs.length - 1][2], W]);
    } else tramos.push([W, W + it.solape]);
    for (const [o, p] of tramos) if (p - o > 1e-6) R.cotas.push(new Cota("H", o, [p], arriba, H, "lineal", 1, true));
    if (it.luz_piso > 0) R.cotas.push(new Cota("V", 0.0, [it.luz_piso], xmax + 4 * uv, xmax, "lineal", 1, true));
  }
}

/** Marco primero, después travesaños / montantes, después el relleno. */
function rango(f) {
  const usos = [...f.usos].join(" ");
  return usos.includes("larguero") ? -1 : usos.includes("marco") ? 0
    : (usos.includes("travesaño") || usos.includes("montante")) ? 1 : 2;
}

export function letraMarca(i) {
  let s = "";
  i += 1;
  while (i) {
    const r = (i - 1) % 26;
    i = Math.floor((i - 1) / 26);
    s = String.fromCharCode(65 + r) + s;
  }
  return s;
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Trabajo completo: genera cada ítem, junta las piezas (× cantidad del ítem), les pone marca y arma las barras de
 * cada perfil. optimizar: el de barras (DEMO: el rápido; PRO: el completo del repo privado). Los costos los agrega
 * el PRO (costos.js). Devuelve un objeto como el dict de portones.calcular.
 */
export function calcular(items, perfiles, corte = 3.0, optimizar = optimizarRapido) {
  items = items.map(normalizarItem);
  const resultados = [], errores = [], avisos = [];
  const acc = new Map(), chapas = [], herrajes = new Map();
  let soldMm = 0.0;
  items.forEach((it, i) => {
    let R;
    try {
      R = generar(it, perfiles);
    } catch (e) {
      resultados.push(null);
      errores.push(`${it.nombre}: ${e.message}.`);
      return;
    }
    resultados.push(R);
    const q = it.cantidad;
    for (const p of R.piezas) {
      const k = clave(p.perfil, p.largo, p.corte);
      if (!acc.has(k)) acc.set(k, { perfil: p.perfil, largo: red(p.largo, 1), corte: p.corte, cant: 0, usos: new Set(), items: new Set(), clave: k });
      const f = acc.get(k);
      f.cant += p.cant * q;
      f.usos.add(p.uso);
      f.items.add(i);
    }
    soldMm += (R.juntas.reduce((s, [pf, n]) => s + pf.perimetro() * n, 0) + R.soldadura_extra_mm) * q;
    for (const [w, h, e] of R.chapas) chapas.push([w, h, e, q]);
    for (const [nombre, c] of R.herrajes) herrajes.set(nombre, (herrajes.get(nombre) || 0) + c * q);
  });
  const filas = [...acc.values()].sort((a, b) => cmp([rango(a), a.perfil.nombre, -a.largo, a.corte, a.perfil.girado ? 1 : 0],
    [rango(b), b.perfil.nombre, -b.largo, b.corte, b.perfil.girado ? 1 : 0]));
  const marcas = {};
  filas.forEach((f, i) => {
    f.marca = letraMarca(i);
    f.color = PALETA[i % PALETA.length];
    marcas[f.clave] = f;
  });

  const grupos = [];
  const porPerfil = new Map();
  for (const f of filas) {
    if (!porPerfil.has(f.perfil.nombre)) porPerfil.set(f.perfil.nombre, []);
    porPerfil.get(f.perfil.nombre).push(f);
  }
  for (const fs of porPerfil.values()) {
    const perfil = fs[0].perfil;
    const L = perfil.largo;
    const largas = fs.filter((f) => f.largo > L + 1e-6);
    const cortas = fs.filter((f) => f.largo <= L + 1e-6);
    const g = { perfil, res: null, barras: [], patrones: [], largas, n_barras: 0, pedidas: cortas.map((f) => [f.largo, f.cant]) };
    if (cortas.length) {
      const res = optimizar(g.pedidas, L, corte);
      const cola = new Map();
      for (const f of [...cortas].sort((a, b) => cmp(a.marca, b.marca))) {
        const k = r4(f.largo);
        if (!cola.has(k)) cola.set(k, []);
        for (let j = 0; j < f.cant; j++) cola.get(k).push(f.marca);
      }
      for (const lst of cola.values()) lst.reverse();   // pop() saca en orden de marca
      g.barras = res.barras.map((b) => b.map((x) => [x, cola.get(r4(x)).pop()]));
      const pats = new Map();
      for (const b of g.barras) {
        const k = JSON.stringify(b);
        if (!pats.has(k)) pats.set(k, [b, 0]);
        pats.get(k)[1] += 1;
      }
      g.patrones = [...pats.values()].map(([b, n]) => ({
        piezas: b, n, sobrante: L - b.reduce((s, [x]) => s + x, 0) - (b.length - 1) * corte,
      })).sort((p, q) => q.n - p.n || q.piezas.length - p.piezas.length);
      g.res = res;
      g.n_barras = res.n_barras;
    }
    for (const f of largas) {
      avisos.push(`Marca ${f.marca}: ${f.cant} ${f.cant === 1 ? "pieza" : "piezas"} de ${med(f.largo)} mm no ${f.cant === 1 ? "entra" : "entran"} en la barra de ${med(L)} mm (requiere empalme).`);
    }
    const kgM = perfil.kgM();
    g.mm_neto = fs.reduce((s, f) => s + f.largo * f.cant, 0);
    g.mm_largas = largas.reduce((s, f) => s + f.largo * f.cant, 0);
    g.kg_neto = g.mm_neto / 1000 * kgM;
    g.kg_compra = (g.n_barras * L + g.mm_largas) / 1000 * kgM;
    g.costo = perfil.precio ? perfil.precio * (g.n_barras + g.mm_largas / L) : null;
    g.aprovechamiento = g.n_barras ? (g.mm_neto - g.mm_largas) / (g.n_barras * L) : 0.0;
    grupos.push(g);
  }

  const kgChapa = chapas.reduce((s, [w, h, e, q]) => s + w * h * e * DENSIDAD * q, 0);
  const m2Chapa = chapas.reduce((s, [w, h, , q]) => s + w * h * q, 0) / 1e6;
  const pint = filas.reduce((s, f) => s + f.perfil.perimetro() * f.largo * f.cant, 0) / 1e6 + 2 * m2Chapa;
  return {
    filas, marcas, grupos, items, resultados, errores, avisos, corte,
    herrajes: [...herrajes.entries()].sort((a, b) => cmp(a[0], b[0])),
    piezas: filas.reduce((s, f) => s + f.cant, 0), kg_chapa: kgChapa, m2_chapa: m2Chapa, chapas,
    kg_neto: grupos.reduce((s, g) => s + g.kg_neto, 0) + kgChapa,
    kg_compra: grupos.reduce((s, g) => s + g.kg_compra, 0) + kgChapa,
    sold_m: soldMm / 1000, pint_m2: pint, n_barras: grupos.reduce((s, g) => s + g.n_barras, 0),
    costos: null,
  };
}

/** Controles: piezas dibujadas = lista de corte y barras = lo pedido. [] si todo está bien. */
export function verificar(c) {
  const problemas = [];
  c.items.forEach((it, i) => {
    const R = c.resultados[i];
    if (!R) return;
    const dib = new Map(), lista = new Map();
    for (const [, , k] of R.formas) if (k !== null) dib.set(k, (dib.get(k) || 0) + 1);
    for (const p of R.piezas) {
      const k = clave(p.perfil, p.largo, p.corte);
      lista.set(k, (lista.get(k) || 0) + p.cant);
    }
    if (dib.size !== lista.size || [...lista].some(([k, v]) => dib.get(k) !== v)) {
      problemas.push(`${it.nombre}: las piezas dibujadas no coinciden con la lista de corte.`);
    }
  });
  for (const g of c.grupos) {
    if (!g.res) continue;
    for (const p of verificarBarras(g.res, g.pedidas)) problemas.push(`${g.perfil.nombre}: ${p}`);
    const cuenta = new Map();
    for (const b of g.barras) for (const [, m] of b) cuenta.set(m, (cuenta.get(m) || 0) + 1);
    if (c.filas.some((f) => f.perfil.nombre === g.perfil.nombre && !g.largas.includes(f) && (cuenta.get(f.marca) || 0) !== f.cant)) {
      problemas.push(`${g.perfil.nombre}: las marcas de las barras no coinciden con la lista.`);
    }
  }
  return problemas;
}

/** (xmin, ymin, xmax, ymax) del dibujo (vano + piezas; con cotas, también las cotas y su texto). */
export function limites(R, conCotas = false) {
  const [W, H] = R.vano;
  const xs = [0.0, W], ys = [0.0, H];
  for (const [, pts] of R.formas) for (const [x, y] of pts) { xs.push(x); ys.push(y); }
  if (conCotas) {
    for (const c of R.cotas) {
      (c.eje === "H" ? ys : xs).push(c.pos + c.lado * (c.eje === "H" ? 0.7 : 1.3) * R.u);
      (c.eje === "H" ? xs : ys).push(c.origen, ...c.puntos);
    }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Líneas [[x1, y1, x2, y2]] y textos [[x, y, texto, al, ángulo]] de una cota, en mm del dibujo (portones.trazos_cota).
 * h: alto del texto en esas unidades. girado: en las cotas verticales el texto va a 90°, a lo largo de la línea.
 */
export function trazosCota(c, h, u, girado = false) {
  const P = (a, b) => (c.eje === "H" ? [a, b] : [b, a]);
  const lineas = [], textos = [];
  const pts = [c.origen, ...c.puntos];
  lineas.push([...P(Math.min(...pts), c.pos), ...P(Math.max(...pts), c.pos)]);
  const t = 0.1 * u;
  for (const v of pts) {
    if (c.base !== null) {
      const sg = c.pos > c.base ? 1 : -1;
      lineas.push([...P(v, c.base + sg * 0.15 * u), ...P(v, c.pos + sg * 0.15 * u)]);
    }
    lineas.push([...P(v - t, c.pos - t), ...P(v + t, c.pos + t)]);       // marca a 45°
  }
  const sep = 0.35 * h + 0.06 * u;
  const ultimo = [-1e18, -1e18];
  const aLoLargo = c.eje === "H" || girado;
  for (const [v, txt] of c.valores().sort(cmp)) {
    const largo = aLoLargo ? txt.length * 0.62 * h : 1.25 * h;
    const fila = (v - ultimo[0] >= largo || c.tipo === "lineal") ? 0 : (v - ultimo[1] >= largo ? 1 : 0);
    ultimo[fila] = v + largo;
    if (c.eje === "H") textos.push([v, c.pos + c.lado * (sep + h / 2 + fila * 1.25 * h), txt, "C", 0]);
    else if (girado) textos.push([c.pos + c.lado * (sep + h / 2 + fila * 1.25 * h), v, txt, "C", 90]);
    else {
      const ancho = txt.length * 0.62 * h;
      textos.push([c.pos + c.lado * (sep + fila * (ancho + sep)), v, txt, c.lado > 0 ? "L" : "R", 0]);
    }
  }
  return [lineas, textos];
}

/** Elevación de muestra para las tarjetas (perfiles de ejemplo); null si el tipo no está disponible. */
export function miniatura(tipo, relleno, nTrav = null) {
  const pm = new Perfil("m", "tubo", 60, 60, 2), pr = new Perfil("r", "tubo", 30, 30, 1.5);
  const medidas = { reja_ventana: [1200, 1000], batiente_1: [1200, 1800], batiente_2: [2400, 1600], corredizo: [2400, 1500] }[tipo];
  const it = normalizarItem({
    tipo, relleno, ancho: medidas[0], alto: medidas[1], perfil_marco: "m", perfil_relleno: "r", luz_max: 150,
    n_trav: nTrav === null ? 1 : nTrav, holg_lat: 40, holg_centro: 40, luz_piso: 60, solape: 150,
  });
  try { return generar(it, { m: pm, r: pr }); } catch { return null; }
}
