// Marco de ángulo (regla de la PWA, 25-nov, Max; pendiente en la PC): travesaños, relleno y chapa adentro de la L,
// hasta las alas: cada extremo que toca el marco se alarga a − t. La distribución no cambia.   node tests/angulo.mjs
import * as P from "../portones/motor.js";

let bien = 0, mal = 0;
const ok = (que, cond, extra = "") => { if (cond) bien++; else { mal++; console.log(`MAL ${que} ${extra}`); } };
const perfiles = P.perfilesDe([
  { nombre: "Ángulo 40×40×3", forma: "angulo", medidas: "40x40x3", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 40×40×2", forma: "tubo", medidas: "40x40x2", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 20×20×1,5", forma: "tubo", medidas: "20x20x1,5", largo: 6000, precio: 0 },
  { nombre: "Ángulo 20×20×3", forma: "angulo", medidas: "20x20x3", largo: 6000, precio: 0 },
]);
const base = { tipo: "reja_ventana", nombre: "Reja", ancho: 1200, alto: 1000, perfil_marco: "Ángulo 40×40×3",
  perfil_relleno: "Tubo cuadrado 20×20×1,5", perfil_trav: "Tubo cuadrado 20×20×1,5", relleno: "verticales", n_trav: 1,
  armado: "a_tope", luz_max: 100 };
const piezas = (it) => {
  const c = P.calcular([it], perfiles, 3);
  ok(`verificar ${it.relleno}/${it.armado}/${it.n_trav}`, !P.verificar(c).length, P.verificar(c).join("; "));
  return c.resultados[0].piezas;
};
const largos = (ps, uso) => ps.filter((p) => p.uso.startsWith(uso)).flatMap((p) => Array(p.cant).fill(p.largo)).sort((a, b) => a - b);
const tubo = (it) => ({ ...it, perfil_marco: "Tubo cuadrado 40×40×2" });
const e = 37;                                                     // a − t = 40 − 3

// a tope, 1 travesaño: interior 1120 × 920, tramos de 450; los dos tramos tocan el marco de un lado
let ps = piezas(base);
ok("travesaño = interior + 2 (a − t)", largos(ps, "travesaño").every((l) => l === 1120 + 2 * e), largos(ps, "travesaño"));
ok("barrotes a tope = tramo + (a − t)", largos(ps, "barrote").every((l) => l === 450 + e), largos(ps, "barrote"));
ok("misma cantidad de barrotes que con tubo", largos(ps, "barrote").length === largos(piezas(tubo(base)), "barrote").length);
// a tope, 2 travesaños: el tramo del medio no se alarga
ps = piezas({ ...base, n_trav: 2 });
const t2 = (920 - 40) / 3;
const b2 = largos(ps, "barrote");
ok("2 travesaños: los de las puntas más largos que los del medio",
  b2.filter((l) => Math.abs(l - P.red(t2, 1)) < 0.06).length > 0 && b2.filter((l) => Math.abs(l - P.red(t2 + e, 1)) < 0.06).length > 0, b2);
// pasantes: barrote entero de ala a ala
ps = piezas({ ...base, armado: "pasantes" });
ok("pasantes = interior + 2 (a − t)", largos(ps, "barrote").every((l) => l === 920 + 2 * e), largos(ps, "barrote"));
// horizontales con montante
ps = piezas({ ...base, relleno: "horizontales" });
ok("montante = interior + 2 (a − t)", largos(ps, "montante").every((l) => l === 920 + 2 * e), largos(ps, "montante"));
ok("barrotes horizontales = tramo + (a − t)", largos(ps, "barrote").every((l) => l === P.red((1120 - 20) / 2 + e, 1)), largos(ps, "barrote"));
// chapa ciega: apoyada detrás de la cara, de ala a ala
let c = P.calcular([{ ...base, relleno: "chapa" }], perfiles, 3);
ok("chapa = (interior + 2 (a − t))²", JSON.stringify(c.resultados[0].chapas[0].slice(0, 2)) === JSON.stringify([1120 + 2 * e, 920 + 2 * e]), c.resultados[0].chapas[0]);
// cuadrícula
ps = piezas({ ...base, relleno: "cuadricula" });
ok("cuadrícula vertical = tramo + (a − t)", largos(ps, "cuadrícula vertical").every((l) => l === 450 + e), largos(ps, "cuadrícula vertical"));
ok("cuadrícula horizontal = ancho + 2 (a − t)", largos(ps, "cuadrícula horizontal").every((l) => l === 1120 + 2 * e), largos(ps, "cuadrícula horizontal"));
// diagonales, rombos, cruz: misma cantidad de piezas que con tubo y cada una al menos igual de larga
for (const relleno of ["diagonales", "rombos", "cruz"]) {
  for (const armado of ["a_tope", "pasantes"]) {
    const it = { ...base, relleno, armado };
    const la = largos(piezas(it), ""), lt = largos(piezas(tubo(it)), "");
    ok(`${relleno}/${armado}: misma cantidad de piezas`, la.length === lt.length, `${la.length} y ${lt.length}`);
    const sa = la.reduce((s, v) => s + v, 0), st = lt.reduce((s, v) => s + v, 0);
    ok(`${relleno}/${armado}: más metros que con tubo`, sa > st, `${sa} y ${st}`);
  }
}
// con marco de tubo nada cambia (lo controla la comparación con la PC: tests/portones.mjs)
// travesaño de ángulo: se alarga como cualquier travesaño (el relleno no entra en su L)
ps = piezas({ ...base, perfil_trav: "Ángulo 20×20×3" });
ok("travesaño de ángulo dentro del marco de ángulo", largos(ps, "travesaño").every((l) => l === 1120 + 2 * e), largos(ps, "travesaño"));
// portón de 2 hojas
c = P.calcular([{ ...base, tipo: "batiente_2" }], perfiles, 3);
ok("batiente 2 hojas: verificar", !P.verificar(c).length || c.errores.length, P.verificar(c).join("; "));
console.log(`${bien} de ${bien + mal} OK`);
process.exit(mal ? 1 : 0);
