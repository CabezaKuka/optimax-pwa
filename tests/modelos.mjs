// Modelos de la galería (27-nov, Max): cada modelo se calcula sin errores en cada tipo de su pestaña (portones: batiente
// 1 y 2 hojas, corredizo; reja: reja de ventana), con el diseño esperado, y aplicar un modelo conserva medidas y perfiles.
// Los portones se calculan con el código PRO (pro/, el repo privado enlazado); sin él, solo la reja de ventana.
//   node --preserve-symlinks --preserve-symlinks-main tests/modelos.mjs
import * as P from "../portones/motor.js";
import * as M from "../portones/modelos.js";
import { piezas3D } from "../modulos/portones3d.js";

let hayPro = false;
try { P.registrarTipos((await import("../pro/portones/tipos.js")).TIPOS_PORTON); hayPro = true; }
catch { console.log("(sin pro/: solo la reja de ventana)"); }
let bien = 0, mal = 0;
const ok = (que, cond, extra = "") => { if (cond) bien++; else { mal++; console.log(`MAL ${que} ${extra}`); } };
const perfiles = P.perfilesDe([
  { nombre: "Tubo cuadrado 40×40×2", forma: "tubo", medidas: "40x40x2", largo: 6000, precio: 0 },
  { nombre: "Tubo cuadrado 20×20×1,5", forma: "tubo", medidas: "20x20x1,5", largo: 6000, precio: 0 },
]);
const base = { ...P.ITEM_DEF, perfil_marco: "Tubo cuadrado 40×40×2", perfil_relleno: "Tubo cuadrado 20×20×1,5" };
const usos = (c) => new Set(c.resultados[0].piezas.map((p) => p.uso));
const cuenta = (c, uso) => c.resultados[0].piezas.filter((p) => p.uso === uso).reduce((s, p) => s + p.cant, 0);

ok("12 modelos", M.MODELOS.length === 12);
ok("pestaña portones: 12", M.modelosDe("porton").length === 12);
ok("pestaña reja: sin doble ni paños (8)", M.modelosDe("reja").length === 8 &&
  M.modelosDe("reja").every((m) => m.cambios.trav_modo !== "doble" && !(m.cambios.n_panos > 1)));
ok("modelo: dato solo de la PWA", P.SOLO_PWA.includes("modelo") && P.ITEM_DEF.modelo === "");
ok("normalizarItem guarda el modelo", P.normalizarItem({ modelo: "chapa" }).modelo === "chapa");

for (const m of M.MODELOS) {
  for (const para of m.para) {
    const tipos = para === "porton" ? (hayPro ? P.PORTONES : []) : ["reja_ventana"];
    for (const tipo of tipos) {
      const [w, h] = P.MEDIDAS_MUESTRA[tipo];
      const it = M.aplicarModelo({ ...base, tipo, ancho: w, alto: h }, m.id, para);
      const c = P.calcular([it], perfiles, 3);
      const que = `${m.id} en ${tipo}`;
      ok(`${que}: sin errores`, !c.errores.length && !P.verificar(c).length, c.errores.concat(P.verificar(c)).join("; "));
      if (c.errores.length) continue;
      ok(`${que}: no modificado`, !M.modificado(it) && it.modelo === m.id && it.tipo === tipo);
      const R = c.resultados[0];
      const p3 = piezas3D(R, perfiles, { espChapa: it.esp_chapa, pasantes: P.sonPasantes(it),
        travAtras: P.sonPasantes(it) && it.trav_lado === "atras", relleno: it.relleno, cruce: it.cruce,
        chapaTrav: P.chapaATope(it) ? "a_tope" : "atras" });
      ok(`${que}: 3D`, p3.piezas.length > 0 && !JSON.stringify(p3.piezas).includes("null"));
      const u = usos(c);
      const ch = m.cambios;
      if (ch.trav_modo === "doble") ok(`${que}: doble`, P.esDoble(it) && cuenta(c, "travesaño") === 2 * R.hojas.length &&
        (ch.n_franja ? cuenta(c, "barrote de la franja") === ch.n_franja * R.hojas.length : !u.has("barrote de la franja")),
        `${cuenta(c, "travesaño")} trav, ${cuenta(c, "barrote de la franja")} franja, ${R.hojas.length} hojas`);
      if (ch.n_panos > 1) ok(`${que}: paños`, c.chapas.reduce((s, x) => s + x[3], 0) === 2 * ch.n_panos * R.hojas.length,
        JSON.stringify(c.chapas));
      if (ch.armado === "pasantes") ok(`${que}: pasantes, travesaño atrás`, P.sonPasantes(it) && it.trav_lado === "atras");
      if (ch.n_trav === 0) ok(`${que}: sin travesaños`, !u.has("travesaño") && !u.has("montante"), [...u].join(","));
    }
  }
}

// aplicar: conserva medidas, perfiles, cantidad y tipo; desde la reja de muestra pasa al portón de muestra
const mio = { ...base, tipo: "corredizo", ancho: 4000, alto: 2200, cantidad: 2, perfil_marco: "Tubo cuadrado 20×20×1,5",
  luz_max: 120, relleno: "rombos", n_trav: 3, armado: "pasantes" };
let a = M.aplicarModelo(mio, "chapa_panos");
ok("aplicar: conserva medidas, perfiles, cantidad, tipo y luz", a.tipo === "corredizo" && a.ancho === 4000 && a.alto === 2200 &&
  a.cantidad === 2 && a.perfil_marco === "Tubo cuadrado 20×20×1,5" && a.luz_max === 120);
ok("aplicar: el diseño del modelo (lo demás vuelve a lo de siempre)", a.relleno === "chapa" && a.n_panos === 3 && a.n_trav === 1 &&
  a.armado === "a_tope" && a.trav_modo === "repartidos");
ok("modificado: cambiar el relleno", M.modificado({ ...a, relleno: "verticales" }));
ok("modificado: cambiar los paños", M.modificado({ ...a, n_panos: 4 }));
ok("modificado: las medidas no cuentan", !M.modificado({ ...a, ancho: 5000, perfil_relleno: "x" }));
a = M.aplicarModelo({ ...base, ...P.DEMO_MUESTRA }, "barrotes_doble", "porton");
ok("reja de muestra → portón: batiente 2 hojas de 3000 × 2000", a.tipo === "batiente_2" && a.ancho === 3000 && a.alto === 2000 &&
  a.nombre === P.TEXTO.batiente_2, JSON.stringify([a.tipo, a.ancho, a.alto, a.nombre]));
a = M.aplicarModelo({ ...base, tipo: "reja_ventana", ancho: 1200, alto: 900, nombre: "Ventana cocina" }, "chapa", "porton");
ok("reja con medidas propias → portón: quedan las medidas y el nombre", a.tipo === "batiente_2" && a.ancho === 1200 &&
  a.nombre === "Ventana cocina");
a = M.aplicarModelo({ ...base, tipo: "batiente_1", ancho: 3000, alto: 2000 }, "rombos", "reja");
ok("portón de muestra → reja: reja de ventana de 800 × 800", a.tipo === "reja_ventana" && a.ancho === 800 && a.alto === 800);
a = M.aplicarModelo(mio, M.LIBRE);
ok("diseño libre: no cambia nada", Object.keys(mio).every((k) => k === "modelo" || a[k] === mio[k]) && a.modelo === M.LIBRE && !M.modificado(a));
a = M.aplicarModelo({ ...base, ...P.DEMO_MUESTRA, relleno: "rombos" }, M.LIBRE, "porton");
ok("diseño libre desde Portones: el portón de muestra con el mismo diseño", a.tipo === "batiente_2" && a.ancho === 3000 &&
  a.relleno === "rombos" && a.modelo === M.LIBRE);
ok("nombre en la barra", M.nombreModelo("doble_franja") === "Doble con barrotes en la franja" && M.nombreModelo(M.LIBRE) === "Diseño libre");
ok("doble con horizontales no aplica: modificado", M.modificado({ ...M.aplicarModelo(mio, "barrotes_doble"), relleno: "horizontales" }));

console.log(`${bien} de ${bien + mal} OK`);
if (mal) process.exit(1);
