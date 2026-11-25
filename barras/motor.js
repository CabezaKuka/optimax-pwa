// Corte de barras (ángulos, tubos, perfiles): lo que necesita la DEMO. Port de barras.py del escritorio.
//
// Regla del corte: en una barra con n piezas hay n − 1 cortes entre piezas (el último lo hace el sobrante), así que
// Σ largos + (n − 1) × corte ≤ barra, o sea Σ (largo + corte) ≤ barra + corte.
//
// Acá va el cálculo rápido (First Fit Decreasing). El optimizador completo del escritorio (búsqueda exacta + juntar
// el sobrante en un retazo) y el precio por pieza son PRO: repo privado, barras/optimizar.js.
import { fijo } from "../geo/base.js";

export const EPS = 1e-6;

// ------------------------------------------------------------------ números
/** idioma.miles(v, dec, recortar) en español: «1.234,5», «6.000». */
export function miles(v, dec = 0, recortar = false) {
  let t = fijo(v, dec);                                  // como Python: al par en los empates exactos
  let [ent, frac] = t.split(".");
  const neg = ent.startsWith("-");
  if (neg) ent = ent.slice(1);
  ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (frac !== undefined && recortar) frac = frac.replace(/0+$/, "");
  return (neg ? "-" : "") + ent + (frac ? `,${frac}` : "");
}

/** Medida para mostrar: «1.000», «2.500,5» (barras.med). */
export const med = (v, dec = 2) => miles(v, dec, true);

// ------------------------------------------------------------------ lectura de la lista
/** «2,5» / «2.5» / «1 000,5» / «1.000» (miles) → número. Error si no es un número. */
export function numero(txt) {
  let s = String(txt).trim().replace(/[  ]/g, "");
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");          // «1.000»: punto de miles
  else if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else s = s.replace(/,/g, ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error("no es un número");
  return Number(s);
}

/**
 * Lista pegada de Excel, CSV o WhatsApp: una pieza por línea, «largo cantidad». Separadores: tabulador, «;»,
 * espacios o coma (la coma solo separa si no hay otro separador). Devuelve [[largo, cantidad]], avisos.
 */
export function leerTexto(texto) {
  const piezas = [], avisos = [];
  String(texto).split(/\r\n|\r|\n/).forEach((l, i) => {
    const n = i + 1;
    const linea = l.trim();
    if (!linea) return;
    let campos;
    if (linea.includes("\t")) campos = linea.split("\t");
    else if (linea.includes(";")) campos = linea.split(";");
    else if (/\s/.test(linea)) campos = linea.split(/\s+/);
    else campos = linea.split(",");
    campos = campos.map((c) => c.trim()).filter((c) => c !== "");
    if (!campos.length) return;
    let largo, cant;
    try {
      largo = numero(campos[0]);
      cant = campos.length < 2 ? 1 : numero(campos[1]);
    } catch {
      if (!piezas.length) return;                                   // fila de títulos («Largo», «Cantidad»)
      avisos.push(`Línea ${n}: «${linea.slice(0, 30)}» no se entiende (se ignora).`);
      return;
    }
    if (largo <= 0 || cant <= 0 || Math.abs(cant - Math.round(cant)) > 1e-9) {
      avisos.push(`Línea ${n}: largo y cantidad tienen que ser positivos y la cantidad entera (se ignora).`);
      return;
    }
    piezas.push([largo, Math.round(cant)]);
  });
  return [piezas, avisos];
}

/** Agrega piezas a la lista en el orden de carga: si el largo ya está, suma la cantidad en esa fila. */
export function sumarFilas(filas, nuevas) {
  const out = filas.map(([l, c]) => [l, Math.trunc(c)]);
  for (const [largo, cant] of nuevas) {
    const f = out.find((x) => Math.abs(x[0] - largo) < 1e-6);
    if (f) f[1] += Math.trunc(cant); else out.push([Number(largo), Math.trunc(cant)]);
  }
  return out;
}

/** Tope de la DEMO: las primeras piezas hasta sumar `tope` (contando cantidades). Devuelve [filas, quitadas]. */
export function recortar(filas, tope) {
  const out = [];
  let resto = Math.trunc(tope), quitadas = 0;
  for (const f of filas) {
    const c = Math.trunc(f[f.length - 1]);
    const n = Math.min(c, resto);
    quitadas += c - n;
    if (n > 0) { out.push([...f.slice(0, -1), n]); resto -= n; }
  }
  return [out, quitadas];
}

/** [[largo, cantidad]] con los largos repetidos sumados, de mayor a menor. */
export function juntar(piezas) {
  const acc = new Map();
  for (const [largo, cant] of piezas) {
    const k = Math.round(largo * 1e4) / 1e4;
    acc.set(k, (acc.get(k) || 0) + Math.trunc(cant));
  }
  return [...acc.entries()].sort((a, b) => b[0] - a[0] || b[1] - a[1]);
}

/** Controles comunes y la lista expandida. Devuelve {lista, items (de mayor a menor), tam, cap, cota}. */
export function preparar(piezas, barra, corte) {
  if (!(barra > 0)) throw new Error("El largo de la barra tiene que ser mayor que cero.");
  if (corte < 0) throw new Error("El ancho de corte no puede ser negativo.");
  const lista = juntar(piezas);
  if (!lista.length) throw new Error("No hay piezas para cortar.");
  for (const [largo] of lista) {
    if (largo > barra + EPS) throw new Error(`La pieza de ${med(largo)} mm no entra en una barra de ${med(barra)} mm.`);
  }
  const items = lista.flatMap(([largo, cant]) => Array(cant).fill(largo));
  const cap = barra + corte;
  const tam = items.map((l) => l + corte);
  const cota = Math.max(1, Math.ceil(tam.reduce((a, b) => a + b, 0) / cap - 1e-9));   // mínimo teórico
  return { lista, items, tam, cap, cota };
}

/** First Fit Decreasing: barras como listas de índices (tam ya viene de mayor a menor). */
export function ffd(tam, cap) {
  const barras = [], libre = [];
  tam.forEach((t, i) => {
    const j = libre.findIndex((lb) => t <= lb + EPS);
    if (j >= 0) { barras[j].push(i); libre[j] -= t; } else { barras.push([i]); libre.push(cap - t); }
  });
  return barras;
}

/** Resultado con los totales (barras.py _armar). barras: listas de largos (sin el corte). */
export function armar(barras, lista, barra, corte, cota) {
  const cmpLex = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return b[i] - a[i];
    return a.length - b.length;
  };
  barras = [...barras].sort((a, b) => b.length - a.length || cmpLex(a, b));
  const grupos = new Map();
  for (const b of barras) {
    const k = JSON.stringify(b);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(b);
  }
  const patrones = [...grupos.entries()].map(([k, lst]) => {
    const pat = JSON.parse(k);
    const usado = pat.reduce((a, b) => a + b, 0) + (pat.length - 1) * corte;
    return { piezas: pat, n: lst.length, sobrante: barra - usado };
  });
  patrones.sort((a, b) => b.n - a.n || b.piezas.length - a.piezas.length);
  const util = barras.reduce((s, b) => s + b.reduce((a, x) => a + x, 0), 0);
  const n = barras.length;
  const cortes = barras.reduce((s, b) => s + b.length - 1, 0);
  return {
    barra, corte, barras, patrones, pedidas: lista,
    n_barras: n, cota, piezas: barras.reduce((s, b) => s + b.length, 0),
    mm_util: util, mm_total: barra * n, mm_corte: cortes * corte,
    mm_sobrante: barra * n - util - cortes * corte,
    aprovechamiento: util / (barra * n),
    retazo: Math.max(...patrones.map((p) => p.sobrante)),
  };
}

/** Cálculo rápido (DEMO): First Fit Decreasing, sin búsqueda exacta ni juntar el sobrante. */
export function optimizarRapido(piezas, barra, corte) {
  const { lista, tam, cota } = preparar(piezas, barra, corte);
  const idx = ffd(tam, barra + corte);
  const barras = idx.map((b) => b.map((i) => tam[i] - corte).sort((a, b) => b - a));
  return armar(barras, lista, barra, corte, cota);
}

/** Controles: ninguna barra se pasa de largo y las piezas cortadas son exactamente las pedidas. [] = bien. */
export function verificar(res, piezas) {
  const problemas = [];
  const cuenta = new Map();
  for (const b of res.barras) {
    if (b.reduce((a, x) => a + x, 0) + (b.length - 1) * res.corte > res.barra + 1e-6) problemas.push("Una barra se pasa de largo.");
    for (const x of b) {
      const k = Math.round(x * 1e4) / 1e4;
      cuenta.set(k, (cuenta.get(k) || 0) + 1);
    }
  }
  const pedido = new Map(juntar(piezas));
  const igual = cuenta.size === pedido.size && [...pedido].every(([k, v]) => cuenta.get(k) === v);
  if (!igual) problemas.push("Las piezas cortadas no coinciden con las pedidas.");
  return problemas;
}

