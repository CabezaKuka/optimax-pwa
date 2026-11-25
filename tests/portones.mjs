// Rejas y portones, motor público (DEMO: reja de ventana) contra el escritorio. node tests/portones.mjs
// Las barras de la DEMO usan el cálculo rápido: se compara todo lo demás y se cuenta en cuántos casos da las mismas
// barras que el optimizador completo de la PC.
import { readFileSync } from "node:fs";
import * as P from "../portones/motor.js";
import { dif, volcarCalc, sinBarras, generales } from "./portones_comun.mjs";

const ref = JSON.parse(readFileSync(new URL("./casos_portones.json", import.meta.url), "utf8"));
// la PWA no tiene «Ajustes → Barras y perfiles»: los perfiles se cargan en el mismo módulo
for (const c of ref.casos) c.calc.errores = c.calc.errores.map((e) => e.replace(" (Ajustes → Barras y perfiles)", ""));
const perfiles = P.perfilesDe(ref.materiales);
let bien = 0, total = 0, mismasBarras = 0, conBarras = 0;
const malas = [];
for (const [i, caso] of ref.casos.entries()) {
  total += 1;
  let d;
  try {
    const c = P.calcular(caso.items, perfiles, caso.corte);
    d = dif(volcarCalc(c, false), sinBarras(caso.calc));
    if (caso.calc.grupos.some((g) => g.barras.length)) {
      conBarras += 1;
      if (c.n_barras === caso.calc.n_barras) mismasBarras += 1;
    }
    if (!d && P.verificar(c).length) d = `verificar: ${P.verificar(c).join("; ")}`;
  } catch (e) {
    d = `error: ${e.stack}`;
  }
  if (d) malas.push([`caso ${i} (${caso.items.map((x) => `${x.tipo}/${x.relleno}`).join(", ")})`, d]);
  else bien += 1;
}
const [n, malasG] = generales(ref);
total += n;
bien += n - malasG.length;
malas.push(...malasG);
for (const [k, d] of malas.slice(0, 15)) console.log(`MAL ${k}: ${d}`);
console.log(`DEMO: cálculo rápido con la misma cantidad de barras que la PC en ${mismasBarras} de ${conBarras}`);
console.log(`${bien} de ${total} OK`);
process.exit(malas.length ? 1 : 0);
