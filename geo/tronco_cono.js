// Tronco de cono (reducción) concéntrico o excéntrico. Port de desarrollos/tronco_cono.py.
import { Param, PiezaGen, dividirRango, desplegarBanda, fmt, trad, pyRound, dist } from "./base.js";

const N = 720;

export const TroncoCono = {
  id: "tronco_cono",
  nombre: "Tronco de cono / reducción",
  descripcion: "Reducción entre dos bocas circulares paralelas. Concéntrica (desarrollo exacto en arcos) o " +
    "excéntrica (desarrollo por triangulación). Se puede dividir en partes si no entra en la plancha.",
  usaEspesor: true,
  params: [
    new Param("d1", "Ø exterior boca mayor", 400, { minimo: 5 }),
    new Param("d2", "Ø exterior boca menor", 200, { minimo: 0 }),
    new Param("h", "Altura entre bocas", 300, { minimo: 1 }),
    new Param("exc", "Excentricidad (desplazamiento de la boca menor)", 0),
    new Param("costura", "Posición de la costura", 180, { unidad: "°" }),
    new Param("partes", "Dividir en partes", 1, { unidad: "", minimo: 1, maximo: 12, tipo: "int" }),
  ],

  resumen(v) {
    const s = `Ø${fmt(v.d1)}/Ø${fmt(v.d2)} h${fmt(v.h)}`;
    return s + (v.exc ? ` exc${fmt(v.exc)}` : "");
  },

  /** Radio neutro de la boca menor (0 si no hay boca). */
  _r2(v, t) {
    return v.d2 > 0 ? (v.d2 - t) / 2 : 0.0;
  },

  generar(v, t) {
    if (t <= 0 || t >= v.d1 / 2 || (v.d2 > 0 && t >= v.d2 / 2)) throw new Error("Espesor inválido para esos diámetros.");
    if (v.d2 > v.d1) throw new Error("La boca menor no puede ser mayor que la mayor.");
    if (v.exc === 0 && v.d1 !== v.d2) return this._concentrico(v, t);
    return this._triangulado(v, t);
  },

  _concentrico(v, t) {
    const R1 = (v.d1 - t) / 2, R2 = this._r2(v, t), H = v.h;
    const s = Math.hypot(H, R1 - R2);                 // generatriz
    const Rg = (R1 * s) / (R1 - R2), Rs = (R2 * s) / (R1 - R2);   // radios del desarrollo
    const phi = (2 * Math.PI * R1) / Rg;              // ángulo total del sector
    const piezas = [];
    const k = v.partes;
    for (let j = 0; j < k; j++) {
      const a0 = -phi / 2 + (phi * j) / k;
      const a1 = -phi / 2 + (phi * (j + 1)) / k;
      const bul = Math.tan((a1 - a0) / 4);
      const nom = trad("Cono {r}", { r: this.resumen(v) }) + (k > 1 ? ` ${j + 1}/${k}` : "");
      const p = new PiezaGen(nom);
      const vert = [[Rg * Math.cos(a0), Rg * Math.sin(a0), bul], [Rg * Math.cos(a1), Rg * Math.sin(a1), 0]];
      if (Rs > 1e-9) {
        vert.push([Rs * Math.cos(a1), Rs * Math.sin(a1), -bul], [Rs * Math.cos(a0), Rs * Math.sin(a0), 0]);
      } else {
        vert.push([0.0, 0.0, 0]);                    // sin boca: el sector cierra en el vértice del cono
      }
      p.lwbulge(vert);
      for (let q = 0; q < 4; q++) {                  // marcas cada 90° de la boca
        const a = -phi / 2 + (phi * q) / 4;
        if (a0 + 1e-9 < a && a < a1 - 1e-9) {
          p.line([Rg * Math.cos(a), Rg * Math.sin(a)], [(Rg - 6) * Math.cos(a), (Rg - 6) * Math.sin(a)]);
        }
      }
      piezas.push(p);
    }
    return piezas;
  },

  _triangulado(v, t) {
    const R1 = (v.d1 - t) / 2, R2 = this._r2(v, t), H = v.h, e = v.exc;
    const c0 = (v.costura * Math.PI) / 180;
    const P = [], Q = [];
    for (let k = 0; k <= N; k++) {
      const th = c0 + (2 * Math.PI * k) / N;
      P.push([R1 * Math.cos(th), R1 * Math.sin(th), 0.0]);
      Q.push([e + R2 * Math.cos(th), R2 * Math.sin(th), H]);
    }
    const piezas = [];
    const rangos = dividirRango(N, v.partes);
    rangos.forEach(([i0, i1], j0) => {
      const [p2, q2] = desplegarBanda(P.slice(i0, i1 + 1), Q.slice(i0, i1 + 1));
      const nom = trad("Cono {r}", { r: this.resumen(v) }) + (rangos.length > 1 ? ` ${j0 + 1}/${rangos.length}` : "");
      const p = new PiezaGen(nom);
      let cont = [...p2, ...[...q2].reverse()];
      if (R2 <= 1e-9) cont = [...p2, q2[q2.length - 1]];   // sin boca: la boca menor es un punto
      p.poly(cont);
      for (let q = 0; q < 4; q++) {
        const kq = pyRound((N * q) / 4);
        if (i0 < kq && kq < i1) {
          const a = p2[kq - i0], b = q2[kq - i0];
          const L = dist(a, b);
          p.line(a, [a[0] + ((b[0] - a[0]) * 6) / L, a[1] + ((b[1] - a[1]) * 6) / L]);
        }
      }
      piezas.push(p);
    });
    return piezas;
  },
};
