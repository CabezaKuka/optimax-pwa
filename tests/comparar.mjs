// Compara la geometría de la PWA (geo/*.js) con la del programa de escritorio (tests/casos.json, de
// tools/volcar_casos.py). Mismos nombres, cantidades, capas, tipos y cantidad de puntos; coordenadas a menos de
// TOL mm; superficie (peso) a menos de 1e-4 relativo; mismos mensajes de error.     node tests/comparar.mjs
//
// TOL = 0,1 µm: el peor caso (cono en punta excéntrico) da 4e-5 mm de ruido numérico, porque la triangulación con la
// boca reducida a un punto resta números casi iguales y las funciones sin / cos de JS y de Python difieren en el
// último decimal. Los demás casos dan menos de 1e-9 mm.
//
// comparar() la usa también el repo privado (optimax-pwa-pro/tests/comparar.mjs) para las figuras PRO.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FIGURAS, leer } from "../geo/index.js";
import { superficie } from "../geo/medidas.js";

const TOL = 1e-4;

function numeros(ents) {
  const out = [];
  const walk = (x) => (Array.isArray(x) ? x.forEach(walk) : typeof x === "number" ? out.push(x) : null);
  walk(ents.map((e) => e[2]));
  return out;
}

function forma(ents) {
  return JSON.stringify(ents.map(([c, t, d]) => [c, t, JSON.stringify(d, (k, v) => (typeof v === "number" ? 0 : v))]));
}

/** Pieza girada k × 90° y llevada otra vez al origen (para el fondo de tolva, ver más abajo). */
function girar(ents, k) {
  const g = ([x, y]) => [[x, y], [-y, x], [-x, -y], [y, -x]][k];
  const r = ents.map(([c, t, d]) => [c, t, t === "poly" ? [d[0].map(g), d[1]] : d.map(g)]);
  const pts = r.flatMap(([, t, d]) => (t === "poly" ? d[0] : d));
  const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1]));
  return r.map(([c, t, d]) => [c, t, t === "poly" ? [d[0].map(([x, y]) => [x - x0, y - y0]), d[1]] :
    d.map(([x, y]) => [x - x0, y - y0])]);
}

function difMax(a, b) {
  const na = numeros(a), nb = numeros(b);
  if (na.length !== nb.length) return Infinity;
  return na.reduce((m, v, i) => Math.max(m, Math.abs(v - nb[i])), 0);
}

/** Corre los casos con las figuras dadas y muestra el resultado; devuelve true si todo está bien. */
export function comparar(figuras, casos) {
  let ok = 0, mal = 0, maxDif = 0, maxArea = 0;
  const porFigura = {}, giradas = [];
  const sinCasos = figuras.filter((g) => !(g.id in casos)).map((g) => g.id);
  for (const g of figuras) {
    for (const [i, caso] of (casos[g.id] || []).entries()) {
      const id = `${g.id} #${i} ${JSON.stringify(caso.params)} e=${caso.espesor}`;
      let res, err = null;
      try {
        const crudo = Object.fromEntries(Object.entries(caso.params).map(([k, v]) => [k, String(v)]));
        res = g.generar(leer(g, crudo), caso.espesor);
      } catch (e) {
        err = e.message;
      }
      const fallas = [];
      if ("error" in caso) {
        if (err !== caso.error) fallas.push(`error esperado «${caso.error}», salió «${err ?? "sin error"}»`);
      } else if (err) {
        fallas.push(`error inesperado: ${err}`);
      } else if (res.length !== caso.piezas.length) {
        fallas.push(`piezas: ${res.length} en vez de ${caso.piezas.length}`);
      } else {
        caso.piezas.forEach((pp, k) => {
          const pj = res[k];
          if (pj.nombre !== pp.nombre) fallas.push(`nombre «${pj.nombre}» ≠ «${pp.nombre}»`);
          if (pj.cantidad !== pp.cantidad) fallas.push(`cantidad ${pj.cantidad} ≠ ${pp.cantidad}`);
          const sup = superficie(pj), rel = Math.abs(sup - pp.area) / pp.area;
          maxArea = Math.max(maxArea, rel);
          if (rel > 1e-4) fallas.push(`superficie ${sup.toFixed(1)} ≠ ${pp.area.toFixed(1)} mm² en ${pp.nombre}`);
          if (forma(pj.ents) !== forma(pp.ents)) { fallas.push(`entidades distintas (capas, tipos o puntos) en ${pp.nombre}`); return; }
          let d = difMax(pj.ents, pp.ents);
          if (d > TOL && g.id === "tronco_piramide") {
            // El escritorio orienta la pieza con el rectángulo mínimo de shapely; cuál de los lados largos iguales
            // toma depende de la versión de GEOS. Se acepta la misma pieza girada 90°, 180° o 270° (y se informa).
            for (let q = 1; q < 4; q++) {
              const dq = difMax(pj.ents, girar(pp.ents, q));
              if (dq <= TOL) { giradas.push(`${id} (${q * 90}°)`); d = dq; break; }
            }
          }
          maxDif = Math.max(maxDif, d);
          porFigura[g.id] = Math.max(porFigura[g.id] || 0, d);
          if (d > TOL) fallas.push(`diferencia ${d.toExponential(2)} mm en ${pp.nombre}`);
        });
      }
      if (fallas.length) { mal++; console.log(`MAL ${id}\n    ${fallas.join("\n    ")}`); } else ok++;
    }
  }
  for (const [f, d] of Object.entries(porFigura)) console.log(`${f}: diferencia máxima ${d.toExponential(2)} mm`);
  for (const s of giradas) console.log(`girada: ${s}`);
  if (sinCasos.length) { mal++; console.log(`MAL figuras sin casos: ${sinCasos.join(", ")}`); }
  console.log(`superficie (peso): diferencia relativa máxima ${maxArea.toExponential(2)} (shapely aplana los arcos)`);
  console.log(`\n${ok} de ${ok + mal} OK · diferencia máxima ${maxDif.toExponential(2)} mm` +
    (giradas.length ? ` · ${giradas.length} giradas` : ""));
  return mal === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const casos = JSON.parse(readFileSync(new URL("./casos.json", import.meta.url), "utf8"));
  process.exit(comparar(FIGURAS, casos) ? 0 : 1);
}
