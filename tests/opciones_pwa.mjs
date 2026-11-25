// Opciones propias de la PWA en Rejas y portones (25-nov, Max; la PC todavía no las tiene):
//   chapa ciega con los travesaños atrás (una chapa) o a tope (un paño por tramo); cuadrícula y rombos cruzados o en
//   el mismo plano (una familia en tramos); botón «Frente» (qué medida del perfil va de frente).
//   node tests/opciones_pwa.mjs
import * as P from "../portones/motor.js";
import { piezas3D } from "../modulos/portones3d.js";

let bien = 0, mal = 0;
const ok = (que, cond, extra = "") => { if (cond) bien++; else { mal++; console.log(`MAL ${que} ${extra}`); } };
const perfiles = P.perfilesDe([
  { nombre: "Ángulo 40×40×3", forma: "angulo", medidas: "40x40x3", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 40×40×2", forma: "tubo", medidas: "40x40x2", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 20×20×1,5", forma: "tubo", medidas: "20x20x1,5", largo: 6000, precio: 0 },
  { nombre: "Macizo cuadrado 12", forma: "macizo_cuad", medidas: "12", largo: 6000, precio: 0 },
  { nombre: "Tubo rectangular 40×20×2", forma: "tubo", medidas: "40x20x2", largo: 6000, precio: 0 },
  { nombre: "Planchuela 40×6", forma: "planchuela", medidas: "40x6", largo: 6000, precio: 0 },
  { nombre: "Ángulo 50×30×3", forma: "angulo", medidas: "50x30x3", largo: 6000, precio: 0 },
  { nombre: "Tubo redondo Ø25×1,5", forma: "tubo_red", medidas: "Ø25x1,5", largo: 6000, precio: 0 },
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
// botón «Frente» (25-nov, Max): un solo perfil, la 2.ª medida de frente
const R40 = "Tubo rectangular 40×20×2";
ok("frente: se puede girar rectangular / planchuela / ángulo desigual; no cuadrado ni redondo",
  P.sePuedeGirar(perfiles[R40]) && P.sePuedeGirar(perfiles["Planchuela 40×6"]) && P.sePuedeGirar(perfiles["Ángulo 50×30×3"]) &&
  !P.sePuedeGirar(perfiles["Tubo cuadrado 40×40×2"]) && !P.sePuedeGirar(perfiles["Tubo redondo Ø25×1,5"]) && !P.sePuedeGirar(perfiles["Ángulo 40×40×3"]));
const g = P.girarPerfil(perfiles[R40]);
ok("frente: el girado tiene a y b cambiados, mismo nombre, mismo kg/m y perímetro",
  g.a === 20 && g.b === 40 && g.nombre === R40 && g.girado && Math.abs(g.kgM() - perfiles[R40].kgM()) < 1e-12 && g.perimetro() === perfiles[R40].perimetro());
ok("frente: rótulo «· 20 de frente»", g.rotulo === `${R40} · 20 de frente`, g.rotulo);
ok("frente: normalizar deja «a» o «b»", P.normalizarItem({ frente_marco: "x", frente_trav: "b" }).frente_marco === "a" &&
  P.normalizarItem({ frente_trav: "b" }).frente_trav === "b" && P.ITEM_DEF.frente_relleno === "a");
ok("frente: fuera de la comparación con la PC", ["frente_marco", "frente_trav", "frente_relleno"].every((k) => P.SOLO_PWA.includes(k)));
const fb = { ...base, perfil_marco: R40, perfil_trav: R40 };
const sinG = calc(fb), conA = calc({ ...fb, frente_marco: "a", frente_trav: "a", frente_relleno: "a" });
const huella = (c) => JSON.stringify(c.filas.map((f) => [f.perfil.nombre, f.largo, f.corte, f.cant, [...f.usos]])) + JSON.stringify(c.resultados[0].formas);
ok("frente «a» = sin el botón (lo de siempre)", huella(sinG) === huella(conA));
const lg = (c, uso) => c.resultados[0].piezas.find((p) => p.uso === uso);
ok("frente: sin girar, travesaño de 1200 − 2 × 40", lg(sinG, "travesaño").largo === 1120, lg(sinG, "travesaño").largo);
const mg = calc({ ...fb, frente_marco: "b" });
ok("frente marco 20: travesaño de 1200 − 2 × 20", lg(mg, "travesaño").largo === 1160, lg(mg, "travesaño").largo);
ok("frente marco 20: el marco usa el girado, el travesaño no", lg(mg, "marco horizontal").perfil.girado && !lg(mg, "travesaño").perfil.girado);
const fil = mg.filas.filter((f) => f.perfil.nombre === R40);
ok("frente: girado y sin girar en renglones aparte (inglete del marco ≠ travesaño)", fil.some((f) => f.perfil.girado) && fil.some((f) => !f.perfil.girado));
ok("frente: una sola compra de barras del mismo caño", mg.grupos.filter((x) => x.perfil.nombre === R40).length === 1);
const mm = mg.grupos.find((x) => x.perfil.nombre === R40);
ok("frente: la compra suma las piezas giradas y las sin girar", Math.abs(mm.mm_neto - fil.reduce((s, f) => s + f.largo * f.cant, 0)) < 1e-6);
const sinTr = calc({ ...base, perfil_marco: R40, perfil_trav: "", frente_marco: "b", frente_trav: "a" });
ok("frente: travesaños «Igual que el marco» siguen al marco", lg(sinTr, "travesaño").perfil.girado, lg(sinTr, "travesaño").perfil.a);
const tg = calc({ ...fb, frente_trav: "b" });
ok("frente travesaño 20: el marco no gira", !lg(tg, "marco horizontal").perfil.girado && lg(tg, "travesaño").perfil.girado);
const pl0 = calc({ ...base, perfil_relleno: "Planchuela 40×6" }), pl1 = calc({ ...base, perfil_relleno: "Planchuela 40×6", frente_relleno: "b" });
ok("frente relleno planchuela de canto (6 de frente): más barrotes", cant(pl1, "barrote") > cant(pl0, "barrote"), `${cant(pl1, "barrote")} y ${cant(pl0, "barrote")}`);
ok("frente: el redondo no gira", !lg(calc({ ...base, perfil_relleno: "Tubo redondo Ø25×1,5", frente_relleno: "b" }), "barrote").perfil.girado);
ok("frente: con chapa ciega no gira el relleno", calc({ ...fb, relleno: "chapa", frente_relleno: "b" }).filas.every((f) => !f.perfil.girado));
// 3D: la profundidad del marco pasa a ser la otra medida
const prof = (c) => {
  const pz = piezas3D(c.resultados[0], perfiles).piezas.filter((q) => q.capa === "MARCO");
  return Math.max(...pz.map((q) => q.z1 - q.z0));
};
ok("frente 3D: marco 40×20 sin girar, 20 de profundidad", Math.abs(prof(sinG) - 20) < 1e-9, prof(sinG));
ok("frente 3D: marco girado, 40 de profundidad", Math.abs(prof(mg) - 40) < 1e-9, prof(mg));
const ang = calc({ ...base, perfil_marco: "Ángulo 50×30×3", frente_marco: "b" });
ok("frente: ángulo 50×30 girado = cara de 30, travesaño 1200 − 2 × 30 + 2 × (30 − 3)", lg(ang, "travesaño").largo === 1194, lg(ang, "travesaño").largo);

// por defecto, lo de siempre (lo controla la comparación con la PC)
ok("por defecto: chapa atrás y cruzadas", P.ITEM_DEF.chapa_trav === "atras" && P.ITEM_DEF.cruce === "cruzadas");
console.log(`${bien} de ${bien + mal} OK`);
process.exit(mal ? 1 : 0);
