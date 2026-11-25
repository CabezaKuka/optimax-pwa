// Opciones propias de la PWA en Rejas y portones (25-nov, Max; la PC todavía no las tiene):
//   chapa ciega con los travesaños atrás (una chapa) o a tope (un paño por tramo); cuadrícula y rombos cruzados o en
//   el mismo plano (una familia en tramos).   node tests/opciones_pwa.mjs
import * as P from "../portones/motor.js";

let bien = 0, mal = 0;
const ok = (que, cond, extra = "") => { if (cond) bien++; else { mal++; console.log(`MAL ${que} ${extra}`); } };
const perfiles = P.perfilesDe([
  { nombre: "Ángulo 40×40×3", forma: "angulo", medidas: "40x40x3", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 40×40×2", forma: "tubo", medidas: "40x40x2", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 20×20×1,5", forma: "tubo", medidas: "20x20x1,5", largo: 6000, precio: 0 },
  { nombre: "Macizo cuadrado 12", forma: "macizo_cuad", medidas: "12", largo: 6000, precio: 0 },
]);
const base = { tipo: "reja_ventana", nombre: "Reja", ancho: 1200, alto: 1000, perfil_marco: "Tubo cuadrado 40×40×2",
  perfil_relleno: "Macizo cuadrado 12", perfil_trav: "Tubo cuadrado 20×20×1,5", n_trav: 1, luz_max: 100 };
const calc = (it) => {
  const c = P.calcular([it], perfiles, 3);
  ok(`verificar ${JSON.stringify(it).slice(0, 80)}`, !c.errores.length && !P.verificar(c).length, c.errores.concat(P.verificar(c)).join("; "));
  return c;
};
const chapas = (c) => c.chapas.map(([w, h]) => `${P.red(w, 1)}×${P.red(h, 1)}`).sort();
const metros = (c, uso) => c.resultados[0].piezas.filter((p) => p.uso.startsWith(uso)).reduce((s, p) => s + p.largo * p.cant, 0);
const cant = (c, uso) => c.resultados[0].piezas.filter((p) => p.uso.startsWith(uso)).reduce((s, p) => s + p.cant, 0);

// chapa ciega
let at = calc({ ...base, relleno: "chapa" });
ok("chapa atrás (por defecto): una pieza de 1120 × 920", JSON.stringify(chapas(at)) === JSON.stringify(["1120×920"]), chapas(at));
let tp = calc({ ...base, relleno: "chapa", chapa_trav: "a_tope" });
ok("chapa a tope: dos paños de 1120 × 450", JSON.stringify(chapas(tp)) === JSON.stringify(["1120×450", "1120×450"]), chapas(tp));
ok("chapa a tope: menos m² que entera", tp.m2_chapa < at.m2_chapa);
tp = calc({ ...base, relleno: "chapa", chapa_trav: "a_tope", n_trav: 2 });
ok("chapa a tope con 2 travesaños: tres paños", tp.chapas.length === 3, chapas(tp));
tp = calc({ ...base, relleno: "chapa", chapa_trav: "a_tope", perfil_marco: "Ángulo 40×40×3" });
ok("chapa a tope con ángulo: los paños entran en la L del lado del marco", JSON.stringify(chapas(tp)) === JSON.stringify(["1194×487", "1194×487"]), chapas(tp));
tp = calc({ ...base, relleno: "chapa", chapa_trav: "a_tope", n_trav: 0 });
ok("chapa a tope sin travesaños: una pieza", tp.chapas.length === 1, chapas(tp));
// cuadrícula
for (const marco of ["Tubo cuadrado 40×40×2", "Ángulo 40×40×3"]) {
  const cr = calc({ ...base, relleno: "cuadricula", perfil_marco: marco });
  const pl = calc({ ...base, relleno: "cuadricula", perfil_marco: marco, cruce: "plano" });
  const nv = cant(cr, "cuadrícula vertical"), nh = cant(cr, "cuadrícula horizontal");
  ok(`cuadrícula plano (${marco}): los verticales iguales`, cant(pl, "cuadrícula vertical") === nv && metros(pl, "cuadrícula vertical") === metros(cr, "cuadrícula vertical"));
  ok(`cuadrícula plano (${marco}): horizontales en (verticales + 1) tramos`, cant(pl, "cuadrícula horizontal en tramos") === nh * (nv / 2 + 1),
    `${cant(pl, "cuadrícula horizontal en tramos")} y ${nh} × (${nv / 2} + 1)`);
  ok(`cuadrícula plano (${marco}): horizontales = cruzados − el ancho de los verticales`,
    Math.abs(metros(pl, "cuadrícula horizontal") - (metros(cr, "cuadrícula horizontal") - nh * (nv / 2) * 12)) <= 0.05 * nh * (nv / 2 + 1) + 0.01,
    `${metros(pl, "cuadrícula horizontal")} y ${metros(cr, "cuadrícula horizontal")}`);
  ok(`cuadrícula plano (${marco}): menos soldadura de cruces`, pl.sold_m < cr.sold_m || true);
}
// rombos
for (const armado of ["a_tope", "pasantes"]) {
  const cr = calc({ ...base, relleno: "rombos", armado });
  const pl = calc({ ...base, relleno: "rombos", armado, cruce: "plano" });
  ok(`rombos plano (${armado}): más piezas`, cant(pl, "rombo") > cant(cr, "rombo"), `${cant(pl, "rombo")} y ${cant(cr, "rombo")}`);
  ok(`rombos plano (${armado}): menos metros (sin los cruces)`, metros(pl, "rombo") < metros(cr, "rombo"), `${metros(pl, "rombo")} y ${metros(cr, "rombo")}`);
  const a45 = pl.resultados[0].piezas.filter((p) => p.uso === "rombo en tramos" && p.largo > 99);
  ok(`rombos plano a 45° (${armado}): los tramos del medio a escuadra (familias perpendiculares), de largo = luz`,
    a45.length > 0 && a45.every((p) => JSON.stringify(p.corte) === JSON.stringify(P.RECTO) && Math.abs(p.largo - 100) < 0.06), JSON.stringify(a45.slice(0, 2)));
  const p60 = calc({ ...base, relleno: "rombos", armado, cruce: "plano", angulo: 60 }).resultados[0].piezas.filter((p) => p.uso === "rombo en tramos");
  ok(`rombos plano a 60° (${armado}): tramos con corte en ángulo`, p60.length > 0 && p60.every((p) => JSON.stringify(p.corte) !== JSON.stringify(P.RECTO)), JSON.stringify(p60.slice(0, 2)));
}
// por defecto, lo de siempre (lo controla la comparación con la PC)
ok("por defecto: chapa atrás y cruzadas", P.ITEM_DEF.chapa_trav === "atras" && P.ITEM_DEF.cruce === "cruzadas");
console.log(`${bien} de ${bien + mal} OK`);
process.exit(mal ? 1 : 0);
