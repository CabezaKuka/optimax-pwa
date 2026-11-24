// T / injerto cilindro sobre cilindro (ángulo y excentricidad) + chapa del principal con agujero.
// Port de desarrollos/t_cil_cil.py.
import { Param, PiezaGen, dividirRango, fmt, fijo, trad, pyRound } from "./base.js";

const N = 360;

/** Distancia sobre el eje del ramal (desde su cruce con el plano del eje principal) donde la generatriz theta del
 * ramal toca el cilindro de radio R. */
export function tContacto(r, R, theta, alfa, e) {
  const y = e + r * Math.sin(theta);
  const z = Math.sqrt(Math.max(R * R - y * y, 0.0));
  return (z + r * Math.cos(theta) * Math.cos(alfa)) / Math.sin(alfa);
}

/** Punto 3D de la generatriz theta del ramal a distancia t sobre su eje.
 * Eje principal = X; ramal en el plano XZ desplazado 'e' en Y, inclinado alfa respecto de X. */
export function punto3d(r, theta, t, alfa, e) {
  return [t * Math.cos(alfa) + r * Math.cos(theta) * Math.sin(alfa),
    e + r * Math.sin(theta),
    t * Math.sin(alfa) - r * Math.cos(theta) * Math.cos(alfa)];
}

export const TCilCil = {
  id: "t_cil_cil",
  nombre: "T cilindro / cilindro",
  descripcion: "Injerto de un caño (ramal) sobre otro (principal), a cualquier ángulo y con excentricidad. " +
    "Genera el desarrollo del ramal y, opcional, la chapa del principal con el agujero.",
  usaEspesor: true,
  params: [
    new Param("dp", "Ø exterior principal", 100, { minimo: 5 }),
    new Param("dr", "Ø exterior ramal", 100, { minimo: 5 }),
    new Param("ang", "Ángulo ramal / principal", 90, { unidad: "°", minimo: 15, maximo: 90 }),
    new Param("exc", "Excentricidad (desplazamiento lateral)", 0),
    new Param("largo", "Largo del ramal (desde eje principal)", 150, { minimo: 1 }),
    new Param("tipo", "Unión", "Apoyado", { unidad: "", tipo: "opcion", opciones: ["Apoyado", "Penetrante"] }),
    new Param("costura", "Posición de la costura", 0, { unidad: "°" }),
    new Param("partes", "Dividir el ramal en partes", 1, { unidad: "", minimo: 1, maximo: 8, tipo: "int" }),
    new Param("ppal", "Generar chapa del principal", "No", { unidad: "", tipo: "opcion", opciones: ["No", "Sí"] }),
    new Param("largo_ppal", "Largo chapa del principal", 300, { minimo: 1 }),
  ],

  resumen(v) {
    return `Ø${fmt(v.dp)}/Ø${fmt(v.dr)} ${fmt(v.ang)}°`;
  },

  /** Radios usados para el corte: [r_ramal, R_principal]. */
  perfil(v, t) {
    if (v.tipo === "Apoyado") return [v.dr / 2 - t, v.dp / 2];
    return [v.dr / 2, v.dp / 2 - t];
  },

  generar(v, t) {
    if (t <= 0 || t >= Math.min(v.dp, v.dr) / 2) throw new Error("Espesor inválido para esos diámetros.");
    const alfa = (v.ang * Math.PI) / 180, e = v.exc;
    const [r, R] = this.perfil(v, t);
    if (Math.abs(e) + r > R + 1e-9) {
      throw new Error("El ramal no apoya completo sobre el principal (Ø ramal + excentricidad mayor que el principal). Use 'Apoyado', reduzca el Ø o la excentricidad.");
    }
    const W = Math.PI * (v.dr - t);
    const c0 = (v.costura * Math.PI) / 180;
    const xs = [], hs = [];
    for (let k = 0; k <= N; k++) {
      const th = c0 + (2 * Math.PI * k) / N;
      xs.push((W * k) / N);
      hs.push(v.largo - tContacto(r, R, th, alfa, e));
    }
    const hmin = Math.min(...hs);
    if (hmin <= 0) {
      const need = v.largo - hmin;
      throw new Error(trad("Largo del ramal insuficiente: debe ser mayor que {need} mm.", { need: fijo(need, 1) }));
    }
    const piezas = [];
    const rangos = dividirRango(N, v.partes);
    rangos.forEach(([i0, i1], j0) => {
      const j = j0 + 1;
      const nom = trad("T {r} - ramal", { r: this.resumen(v) }) + (rangos.length > 1 ? ` ${j}/${rangos.length}` : "");
      const p = new PiezaGen(nom);
      const x0 = xs[i0];
      const curva = [];
      for (let i = i0; i <= i1; i++) curva.push([xs[i] - x0, hs[i]]);
      p.poly([[0, 0], [xs[i1] - x0, 0], ...curva.reverse()]);
      for (let q = 0; q < 4; q++) {                 // marcas cada 90° desde la costura
        const kq = pyRound((N * q) / 4);
        if (i0 < kq && kq < i1) {
          const xm = xs[kq] - x0;
          p.line([xm, 0], [xm, Math.min(8.0, hmin / 3)]);
        }
      }
      piezas.push(p);
    });
    if (v.ppal === "Sí") piezas.push(this._principal(v, t, alfa, e));
    return piezas;
  },

  _principal(v, t, alfa, e) {
    const Lp = v.largo_ppal;
    const Rn = (v.dp - t) / 2;
    const Wp = 2 * Math.PI * Rn;
    const rAg = v.tipo === "Apoyado" ? v.dr / 2 - t : v.dr / 2;
    const RAg = v.dp / 2;
    const ag = [];
    for (let k = 0; k < N; k++) {
      const th = (2 * Math.PI * k) / N;
      const tt = tContacto(rAg, RAg, th, alfa, e);
      const [x, y] = punto3d(rAg, th, tt, alfa, e);
      const phi = Math.asin(Math.max(-1.0, Math.min(1.0, y / RAg)));
      ag.push([Lp / 2 + x, Wp / 2 + Rn * phi]);
    }
    const xs = ag.map((a) => a[0]);
    const mn = Math.min(...xs), mx = Math.max(...xs);
    if (mn <= 0 || mx >= Lp) {
      throw new Error(trad("El agujero no entra en la chapa del principal: largo mínimo {v1} mm.", { v1: fijo(mx - mn + 2, 0) }));
    }
    const p = new PiezaGen(trad("T {v1} - principal {Lp}", { v1: this.resumen(v), Lp: fmt(Lp) }));
    p.poly([[0, 0], [Lp, 0], [Lp, Wp], [0, Wp]]);
    p.poly(ag);
    p.line([Lp / 2, 0], [Lp / 2, 6]);
    p.line([Lp / 2, Wp], [Lp / 2, Wp - 6]);
    return p;
  },
};
