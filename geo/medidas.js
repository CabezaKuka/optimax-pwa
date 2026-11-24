// Medidas de una pieza para mostrar: tamaño de la chapa (rectángulo que la contiene) y peso aproximado.
// Sin DOM (se prueba con Node).
import { arcoBulge } from "./base.js";

export const DENSIDAD_ACERO = 7.85e-6;          // kg/mm³ (7,85 kg/dm³)

/** Área con signo de un contorno cerrado de CORTE (+ antihorario). Los tramos con bulge suman o restan su
 * segmento circular exacto. */
export function areaContorno(tipo, d) {
  if (tipo === "circle") return Math.PI * d[2] * d[2];
  const pts = tipo === "poly" ? d[0] : d;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += (p[0] * q[1] - q[0] * p[1]) / 2;
    if (tipo === "lwbulge" && Math.abs(p[2]) > 1e-12) {
      const arc = arcoBulge(p, q, p[2]);
      if (arc) {
        const th = Math.abs(arc.th);
        a += Math.sign(arc.th) * (arc.r * arc.r / 2) * (th - Math.sin(th));
      }
    }
  }
  return a;
}

/** Puntos de un contorno (vértices; para saber si uno está dentro de otro alcanza). */
function puntos(tipo, d) {
  if (tipo === "circle") return [[d[0] + d[2], d[1]]];
  return (tipo === "poly" ? d[0] : d).map((p) => [p[0], p[1]]);
}

function dentro(pt, poli) {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Superficie de chapa de la pieza (mm²): contornos exteriores menos los agujeros (un contorno dentro de otro). */
export function superficie(pieza) {
  const cont = pieza.ents
    .filter(([capa, tipo, d]) => capa === "CORTE" && (tipo !== "poly" || d[1]))
    .map(([, tipo, d]) => ({ area: Math.abs(areaContorno(tipo, d)), pts: puntos(tipo, d), tipo, d }))
    .sort((a, b) => b.area - a.area);
  let total = 0;
  cont.forEach((c, i) => {
    let nivel = 0;
    for (let k = 0; k < i; k++) {
      if (cont[k].tipo !== "circle" && dentro(c.pts[0], cont[k].pts)) nivel++;
    }
    total += nivel % 2 === 0 ? c.area : -c.area;
  });
  return total;
}

/** {ancho, alto, superficie, peso} de una pieza; peso en kg de acero con el espesor dado (mm). */
export function medidas(pieza, espesor) {
  const [x0, y0, x1, y1] = pieza.limites();
  const sup = superficie(pieza);
  return { ancho: x1 - x0, alto: y1 - y0, superficie: sup, peso: sup * espesor * DENSIDAD_ACERO };
}
