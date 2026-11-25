// Comparación de Rejas y portones contra los casos del escritorio (la usan tests/portones.mjs y pro/tests/portones.mjs).
import * as P from "../portones/motor.js";

const TOL = 1e-6;

/** Diferencia entre dos valores JSON (números con tolerancia). null si son iguales, o la ruta y lo que difiere. */
export function dif(a, b, ruta = "") {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b)) ? null : `${ruta}: ${a} ≠ ${b}`;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${ruta}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
    if (a.length !== b.length) return `${ruta}: largo ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = dif(a[i], b[i], `${ruta}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of ks) {
      const d = dif(a[k], b[k], `${ruta}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${ruta}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

const claveJson = (k) => {
  if (k === null) return null;
  const [nombre, largo, corte] = k.split("\u0001");
  return [nombre, Number(largo), JSON.parse(corte)];
};

export function volcarR(R) {
  if (!R) return null;
  return {
    vano: R.vano, hojas: R.hojas, formas: R.formas.map(([cap, pts, k]) => [cap, pts, claveJson(k)]),
    luces: R.luces, u: R.u, herrajes: R.herrajes, soldadura_extra_mm: R.soldadura_extra_mm,
    cotas: R.cotas.map((c) => ({
      eje: c.eje, origen: c.origen, puntos: c.puntos, pos: c.pos, base: c.base, tipo: c.tipo, lado: c.lado,
      general: c.general, valores: c.valores(), trazos: P.trazosCota(c, 30.0, R.u, true),
      trazos_pdf: P.trazosCota(c, 25.0, R.u, false)[1],
    })),
    limites: P.limites(R), limites_cotas: P.limites(R, true),
  };
}

/** Lo mismo que volcar_calc del escritorio. conBarras: false = sin lo que depende del acomodo de las barras. */
export function volcarCalc(c, conBarras = true) {
  const out = {
    filas: c.filas.map((f) => ({
      marca: f.marca, perfil: f.perfil.nombre, largo: f.largo, corte: f.corte, cant: f.cant, usos: [...f.usos].sort(),
      color: f.color, texto_corte: P.textoCorte(f.corte), croquis: P.croquis(f.corte, 64, 10),
    })),
    grupos: c.grupos.map((g) => {
      const o = {
        perfil: g.perfil.nombre, largas: g.largas.map((f) => f.marca), pedidas: g.pedidas, mm_neto: g.mm_neto,
        mm_largas: g.mm_largas, kg_neto: g.kg_neto,
      };
      if (conBarras) {
        Object.assign(o, {
          n_barras: g.n_barras, barras: g.barras, patrones: g.patrones, kg_compra: g.kg_compra, costo: g.costo,
          aprovechamiento: g.aprovechamiento,
        });
      }
      return o;
    }),
    errores: c.errores, avisos: c.avisos, herrajes: c.herrajes, piezas: c.piezas, kg_chapa: c.kg_chapa,
    m2_chapa: c.m2_chapa, kg_neto: c.kg_neto, sold_m: c.sold_m, pint_m2: c.pint_m2,
    items: c.items.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !P.SOLO_PWA.includes(k)))),   // la PC no las tiene
    resultados: c.resultados.map(volcarR), verificar: P.verificar(c),
  };
  if (conBarras) Object.assign(out, { kg_compra: c.kg_compra, n_barras: c.n_barras, costos: c.costos });
  return out;
}

/** Saca del caso del escritorio lo que depende de las barras (para comparar con el cálculo rápido). */
export function sinBarras(ref) {
  const r = structuredClone(ref);
  for (const k of ["kg_compra", "n_barras", "costos"]) delete r[k];
  for (const g of r.grupos) for (const k of ["n_barras", "barras", "patrones", "kg_compra", "costo", "aprovechamiento"]) delete g[k];
  return r;
}

/** Controles que no dependen del caso: medidas, deducir, kg/m, distribuir, miniaturas, DEMO. [[nombre, error]] */
export function generales(ref) {
  const malas = [];
  const ok = (nombre, d) => { if (d) malas.push([nombre, d]); };
  for (const [f, t, esperado] of ref.medidas) ok(`medidas ${f} «${t}»`, dif(P.leerMedidas(f, t), esperado));
  for (const [n, esperado] of ref.deducir) ok(`deducir «${n}»`, dif(P.deducirPerfil(n), esperado));
  for (const [f, m, esperado] of ref.kg_m) ok(`kg/m ${m}`, dif(P.kgMMedidas(f, m), esperado));
  for (const [l, b, m, esperado] of ref.distribuir) ok(`distribuir ${l}`, dif(P.distribuir(l, b, m), esperado));
  for (const [k, n] of Object.entries(ref.miniaturas)) {
    const [t, r] = k.split("|");
    const R = P.miniatura(t, r);
    ok(`miniatura ${k}`, dif(R ? R.formas.length : null, n));
  }
  for (const [w, h, mx, permite] of ref.demo) {
    ok(`demo ${w}×${h}`, dif([P.demoMax(h), P.demoPermite(P.normalizarItem({ tipo: "reja_ventana", ancho: w, alto: h }))], [mx, permite]));
  }
  return [ref.medidas.length + ref.deducir.length + ref.kg_m.length + ref.distribuir.length
    + Object.keys(ref.miniaturas).length + ref.demo.length, malas];
}

/**
 * ¿El caso tiene algún ítem con marco de ángulo? Regla nueva de la PWA (25-nov, Max: travesaños, relleno y chapa
 * adentro de la L, hasta las alas); la PC todavía no la tiene: esos casos no se comparan con el escritorio.
 */
export function conMarcoAngulo(ref, caso) {
  const angulos = new Set(ref.materiales.filter((m) => m.forma === "angulo").map((m) => m.nombre));
  return caso.items.some((it) => angulos.has(it.perfil_marco));
}
