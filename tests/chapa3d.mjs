// Piezas de chapa armadas en 3D (geo/arma3d.js + armado3D de cada figura): la plantilla vuelta a enrollar.
// Las mismas comprobaciones que hace la PC al «re-enrollar» los desarrollos (test_desarrollos.py), sobre el 3D:
// la chapa no se estira, las bandas cubren la plantilla entera, la costura cierra, el borde cae donde tiene que caer.
//   node tests/chapa3d.mjs        (con pro/ enlazado: node --preserve-symlinks --preserve-symlinks-main …)
import { FIGURAS, valoresDefecto, leer } from "../geo/index.js";
import { areaBanda, areaPieza, estiramiento, malla, dist3 } from "../geo/arma3d.js";

let bien = 0, mal = 0;
const ok = (que, cond, extra = "") => { if (cond) bien++; else { mal++; console.log(`MAL ${que} ${extra}`); } };
const fig = (id) => FIGURAS.find((g) => g.id === id);
const TOL_ESTIRA = 1e-3;                                   // mm (las tiras son cuerdas de 1° de caño: ~1e-5)

/** Comprobaciones comunes. Devuelve las piezas 3D. */
function comun(g, extra, t = 2) {
  const nom = `${g.id} ${JSON.stringify(extra)}`;
  const v = leer(g, { ...valoresDefecto(g), ...extra });
  const planas = g.generar(v, t);
  let arm;
  try { arm = g.armado3D(v, t); } catch (e) { ok(`${nom}: arma`, false, e.message); return null; }
  const corte = arm.filter((p) => p.tono === "corte");
  const chapas = planas.reduce((s, p) => s + p.cantidad, 0);
  ok(`${nom}: una pieza 3D por cada chapa a cortar`, corte.length === chapas, `${corte.length} y ${chapas}`);
  const peor = Math.max(...arm.flatMap((p) => p.bandas.filter((b) => b[0][0]).map(estiramiento)));
  ok(`${nom}: la chapa no se estira al armarla`, peor < TOL_ESTIRA, `${peor} mm`);
  // superficie: las bandas cubren la plantilla (cada chapa tantas veces como su cantidad)
  const a3 = corte.map((p) => p.bandas.reduce((s, b) => s + areaBanda(b), 0)).sort((x, y) => x - y);
  const a2 = planas.flatMap((p) => Array(p.cantidad).fill(areaPieza(p))).sort((x, y) => x - y);
  const dif = Math.max(...a3.map((a, i) => Math.abs(a - a2[i]) / a2[i]));
  ok(`${nom}: misma superficie que la plantilla`, dif < 3e-3, `${(dif * 100).toFixed(3)} %`);
  let tris = 0, sano = true;
  for (const p of arm) {
    const m = malla(p);
    tris += m.idx.length / 3;
    if (m.pos.some((x) => !Number.isFinite(x)) || m.idx.some((i) => i < 0 || i >= m.pos.length / 3)) sano = false;
  }
  ok(`${nom}: malla sana (${tris} triángulos)`, sano && tris > 0 && tris < 20000, `${tris}`);
  return { v, arm, corte, planas };
}
const costura = (b) => Math.max(dist3(b[0][2], b[b.length - 1][2]), dist3(b[0][3], b[b.length - 1][3]));
const maxDif = (b, f) => Math.max(...b.map(f));

// ------------------------------------------------------------------ T de caños
{
  const g = fig("t_cil_cil");
  for (const extra of [{}, { ppal: "Sí" }, { dp: "200", dr: "100", ang: "60", exc: "20", ppal: "Sí" },
    { dp: "150", dr: "80", tipo: "Penetrante", costura: "90" }, { partes: "3", ppal: "Sí" }, { dp: "300", dr: "60", ang: "45", largo: "300" }]) {
    const r = comun(g, extra);
    if (!r) continue;
    const { v, corte } = r, t = 2;
    // apoyado: hasta la cara de afuera del principal; penetrante: hasta la de adentro (perfil = los radios del corte).
    // La chapa va por el radio neutro del ramal: a medio espesor del radio del corte → tolerancia t.
    const R = g.perfil(v, t)[1], tol = t;
    const ramal = corte.filter((p) => p.nombre.includes("ramal"));
    const nom = `t_cil_cil ${JSON.stringify(extra)}`;
    const err = Math.max(...ramal.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(Math.hypot(gn[3][1], gn[3][2]) - R))));
    ok(`${nom}: el borde del ramal cae sobre el principal`, err <= tol, `${err} mm`);
    const a = (v.ang * Math.PI) / 180;
    const eje = (P) => Math.hypot(P[1] - v.exc, -P[0] * Math.sin(a) + P[2] * Math.cos(a));   // distancia al eje del ramal
    const rn = (v.dr - t) / 2;
    const er = Math.max(...ramal.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(eje(gn[2]) - rn) + Math.abs(eje(gn[3]) - rn))));
    ok(`${nom}: el ramal es un caño de radio neutro`, er < 1e-9, `${er}`);
    if (v.partes === 1) ok(`${nom}: la costura del ramal cierra`, costura(ramal[0].bandas[0]) < 1e-9, costura(ramal[0].bandas[0]));
    const ppal = r.arm.find((p) => !p.nombre.includes("ramal"));
    ok(`${nom}: el principal está (${v.ppal === "Sí" ? "su chapa" : "de referencia"})`,
      ppal && ppal.tono === (v.ppal === "Sí" ? "corte" : "ref"));
    const Rn = (v.dp - t) / 2;
    const ep = Math.max(...ppal.bandas.flatMap((b) => b.map((gn) => Math.abs(Math.hypot(gn[2][1], gn[2][2]) - Rn))));
    ok(`${nom}: el principal es un caño de radio neutro`, ep < 1e-9, ep);
  }
}

// ------------------------------------------------------------------ codo por gajos
{
  const g = fig("codo_sectores");
  for (const extra of [{}, { ang: "45", piezas: "3" }, { recto: "80", costura: "Talón" }, { ang: "180", piezas: "8", rc: "250" },
    { partes: "2" }, { piezas: "2", recto: "30" }]) {
    const r = comun(g, extra);
    if (!r) continue;
    const { v, corte } = r;
    const nom = `codo ${JSON.stringify(extra)}`;
    if (v.partes === 1) {
      ok(`${nom}: la costura de cada gajo cierra`, Math.max(...corte.map((p) => costura(p.bandas[0]))) < 1e-9);
      // gajos en orden: extremo, intermedios, extremo (dado vuelta): cada uno encastra con el siguiente
      let junta = 0;
      for (let i = 0; i < corte.length - 1; i++) {
        const b1 = corte[i].bandas[0], b2 = corte[i + 1].bandas[0];
        const ultimo = i + 1 === corte.length - 1;             // el último extremo va dado vuelta: su inglete es B
        for (let k = 0; k < b1.length; k++) junta = Math.max(junta, dist3(b1[k][3], ultimo ? b2[k][3] : b2[k][2]));
      }
      ok(`${nom}: los gajos encastran uno con el otro (${corte.length} gajos)`, junta < 1e-9, `${junta} mm`);
      // las bocas: la de arranque a z = −tramo recto (subiendo), la de salida girada el ángulo total
      const A = (v.ang * Math.PI) / 180, e0 = corte[0].bandas[0], e1 = corte[corte.length - 1].bandas[0];
      ok(`${nom}: boca de arranque en z = −tramo recto`, maxDif(e0, (gn) => Math.abs(gn[2][2] + v.recto)) < 1e-9);
      const dEnd = maxDif(e1, (gn) => Math.abs(-gn[2][0] * Math.sin(A) + gn[2][2] * Math.cos(A) - v.recto));
      ok(`${nom}: boca de salida girada ${v.ang}°, a un tramo recto del plano`, dEnd < 1e-9, dEnd);
    }
  }
}

// ------------------------------------------------------------------ tronco de cono
{
  const g = fig("tronco_cono");
  for (const extra of [{}, { partes: "3" }, { exc: "60" }, { d2: "0" }, { exc: "-40", d2: "120", partes: "2" }, { d1: "300", d2: "300", h: "200" }]) {
    const r = comun(g, extra);
    if (!r) continue;
    const { v, corte } = r, t = 2;
    const nom = `cono ${JSON.stringify(extra)}`;
    const R1 = (v.d1 - t) / 2, R2 = v.d2 > 0 ? (v.d2 - t) / 2 : 0;
    const e1 = Math.max(...corte.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(gn[2][2]) + Math.abs(Math.hypot(gn[2][0], gn[2][1]) - R1))));
    ok(`${nom}: boca mayor abajo, de radio neutro`, e1 < 1e-6, e1);
    const e2 = Math.max(...corte.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(gn[3][2] - v.h) + Math.abs(Math.hypot(gn[3][0] - v.exc, gn[3][1]) - R2))));
    ok(`${nom}: boca menor arriba, corrida la excentricidad`, e2 < 1e-6, e2);
    if (v.partes === 1) ok(`${nom}: la costura cierra`, costura(corte[0].bandas[0]) < 1e-6, costura(corte[0].bandas[0]));
  }
}

// ------------------------------------------------------------------ fondo de tolva
{
  const g = fig("tronco_piramide");
  for (const extra of [{}, { partes: "2" }, { partes: "4", x: "200", y: "-100" }, { inicio: "3" }, { a: "1000", b: "800", h: "300" }]) {
    let r;
    try { r = comun(g, extra); } catch (e) { ok(`tolva ${JSON.stringify(extra)}`, false, e.message); continue; }
    if (!r) continue;
    const { v, corte } = r, t = 2;
    const nom = `tolva ${JSON.stringify(extra)}`;
    const ez = Math.max(...corte.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(gn[2][2] - v.h) + Math.abs(gn[3][2]))));
    ok(`${nom}: boca mayor arriba (z = h), menor abajo`, ez < 1e-9, ez);
    const A = v.A - t, B = v.B - t;
    const esq = Math.max(...corte.map((p) => maxDif(p.bandas[0], (gn) => Math.abs(Math.abs(gn[2][0]) - A / 2) + Math.abs(Math.abs(gn[2][1]) - B / 2))));
    ok(`${nom}: las aristas arrancan en las esquinas de la boca mayor (neutra)`, esq < 1e-9, esq);
    if (v.partes === 1) ok(`${nom}: las 4 caras cierran`, costura(corte[0].bandas[0]) < 1e-9);
    if (v.partes === 4) {
      const total = corte.reduce((s, p) => s + p.bandas[0].length - 1, 0);
      ok(`${nom}: 4 caras sueltas`, total === 4, total);
    }
  }
}

// el paso parte las generatrices sin cambiar la superficie (los puntos nuevos quedan sobre la misma recta)
{
  const g = fig("t_cil_cil"), v = leer(g, valoresDefecto(g)), p = g.armado3D(v, 2)[0];
  const m1 = malla(p), m2 = malla(p, 20);
  ok("malla con paso: más triángulos, mismos bordes de las puntas", m2.idx.length > m1.idx.length && m2.bordes.length === m1.bordes.length);
}
ok("las 4 figuras DEMO tienen su 3D", FIGURAS.every((g) => typeof g.armado3D === "function"));
console.log(`${bien} de ${bien + mal} OK`);
process.exit(mal ? 1 : 0);
