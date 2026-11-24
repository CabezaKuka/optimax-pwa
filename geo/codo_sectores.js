// Curva redonda por sectores (codo de gajos). Port de desarrollos/codo_sectores.py.
import { Param, PiezaGen, dividirRango, fmt, trad, pyRound } from "./base.js";

const N = 360;
export const COSTURA = { "Garganta": Math.PI, "Talón": 0.0, "Costado": Math.PI / 2 };

export const CodoSectores = {
  id: "codo_sectores",
  nombre: "Curva redonda por sectores",
  descripcion: "Codo de chapa en gajos: dos extremos (medio gajo) y gajos intermedios completos. " +
    "Los gajos encastran entre sí girados 180°, el nesting lo aprovecha.",
  usaEspesor: true,
  params: [
    new Param("d", "Ø exterior", 200, { minimo: 10 }),
    new Param("ang", "Ángulo total de la curva", 90, { unidad: "°", minimo: 5, maximo: 180 }),
    new Param("piezas", "Cantidad de piezas (gajos)", 5, { unidad: "", minimo: 2, maximo: 24, tipo: "int" }),
    new Param("rc", "Radio de curvatura (al eje)", 300, { minimo: 1 }),
    new Param("recto", "Tramo recto en cada extremo", 0, { minimo: 0 }),
    new Param("costura", "Costura", "Garganta", { unidad: "", tipo: "opcion", opciones: Object.keys(COSTURA) }),
    new Param("partes", "Dividir cada gajo en partes", 1, { unidad: "", minimo: 1, maximo: 8, tipo: "int" }),
  ],

  resumen(v) {
    return `Ø${fmt(v.d)} ${fmt(v.ang)}° ${v.piezas}p`;
  },

  datos(v, t) {
    const r = (v.d - t) / 2;                     // radio neutro
    const beta = ((v.ang * Math.PI) / 180) / (2 * (v.piezas - 1));
    return [r, beta];
  },

  generar(v, t) {
    if (t <= 0 || t >= v.d / 2) throw new Error("Espesor inválido para ese diámetro.");
    const [r, beta] = this.datos(v, t);
    const rc = v.rc;
    if (rc <= v.d / 2) {
      throw new Error(trad("El radio de curvatura debe ser mayor que el radio del caño ({v1} mm).", { v1: fmt(v.d / 2) }));
    }
    const W = 2 * Math.PI * r;
    const th0 = COSTURA[v.costura];
    const xs = [], f = [];
    for (let k = 0; k <= N; k++) {
      const th = th0 + (2 * Math.PI * k) / N;
      xs.push((W * k) / N);
      f.push(Math.tan(beta) * (rc + r * Math.cos(th)));   // media longitud de gajo en esa generatriz
    }
    const rangos = dividirRango(N, v.partes);
    const nMed = v.piezas - 2;
    const piezas = [];

    const armar = (nombre, cant, arriba, abajo) => {
      rangos.forEach(([i0, i1], j0) => {
        const nom = nombre + (rangos.length > 1 ? ` ${j0 + 1}/${rangos.length}` : "");
        const p = new PiezaGen(nom, cant);
        const x0 = xs[i0];
        const sup = [], inf = [];
        for (let i = i0; i <= i1; i++) {
          sup.push([xs[i] - x0, arriba[i]]);
          inf.push([xs[i] - x0, abajo[i]]);
        }
        p.poly([...sup, ...inf.reverse()]);
        for (let q = 0; q < 4; q++) {
          const kq = pyRound((N * q) / 4);
          if (i0 < kq && kq < i1) {
            const xm = xs[kq] - x0;
            p.line([xm, abajo[kq]], [xm, abajo[kq] + 6]);
            p.line([xm, arriba[kq]], [xm, arriba[kq] - 6]);
          }
        }
        piezas.push(p);
      });
    };

    const base = trad("Codo {r}", { r: this.resumen(v) });
    armar(base + " - extremo", 2, f.map((fi) => fi + v.recto), new Array(N + 1).fill(0.0));
    if (nMed > 0) armar(base + " - intermedio", nMed, f, f.map((fi) => -fi));
    return piezas;
  },
};
