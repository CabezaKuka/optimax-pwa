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

  /**
   * Codo armado en 3D (geo/arma3d.js): cada gajo es un tramo recto de caño (radio neutro) cortado por dos planos que
   * pasan por el eje de la curva. Curva en el plano xz, centro en el origen: arranca en x = rc subiendo (z) y gira
   * hacia −x. Extremo, intermedios (centrados a 2β, 4β…) y el otro extremo (el mismo, dado vuelta).
   */
  armado3D(v, t) {
    const piezas = this.generar(v, t);
    const [r, beta] = this.datos(v, t);
    const rc = v.rc, W = 2 * Math.PI * r, th0 = COSTURA[v.costura], A = (v.ang * Math.PI) / 180;
    const th = [], xs = [], f = [];
    for (let k = 0; k <= N; k++) {
      th.push(th0 + (2 * Math.PI * k) / N);
      xs.push((W * k) / N);
      f.push(Math.tan(beta) * (rc + r * Math.cos(th[k])));
    }
    const radial = (psi) => [Math.cos(psi), 0, Math.sin(psi)];
    const tang = (psi) => [-Math.sin(psi), 0, Math.cos(psi)];
    // punto de la generatriz k del gajo centrado en psi, a s mm sobre el eje (signo: sentido del eje)
    const punto = (psi, sentido, k, s) => {
      const R = radial(psi), T = tang(psi), q = rc + r * Math.cos(th[k]), n = r * Math.sin(th[k]);
      return [q * R[0] + sentido * s * T[0], n, q * R[2] + sentido * s * T[2]];
    };
    const rangos = dividirRango(N, v.partes);
    const nMed = v.piezas - 2;
    const out = [];
    // gajo (pieza de la plantilla j) puesto en psi: y de la chapa → s = y − desde
    const gajo = (nombre, psi, sentido, arriba, abajo, desde) => {
      rangos.forEach(([i0, i1]) => {
        const banda = [];
        for (let i = i0; i <= i1; i++) {
          banda.push([[xs[i] - xs[i0], abajo[i]], [xs[i] - xs[i0], arriba[i]],
            punto(psi, sentido, i, abajo[i] - desde), punto(psi, sentido, i, arriba[i] - desde)]);
        }
        out.push({ nombre, tono: "corte", bandas: [banda] });
      });
    };
    const cero = new Array(N + 1).fill(0.0);
    const ext = piezas[0].nombre.replace(/ \d+\/\d+$/, ""), med = nMed > 0 ? piezas[rangos.length].nombre.replace(/ \d+\/\d+$/, "") : "";
    gajo(ext, 0, 1, f.map((fi) => fi + v.recto), cero, v.recto);
    for (let i = 0; i < nMed; i++) gajo(med, 2 * beta * (i + 1), 1, f, f.map((fi) => -fi), 0);
    gajo(ext, A, -1, f.map((fi) => fi + v.recto), cero, v.recto);
    return out;
  },
};
