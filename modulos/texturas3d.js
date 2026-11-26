// Texturas del alrededor del 3D de portones (26-nov, Max, con fotos de referencia): paredes de ladrillo visto (también
// la pared de la reja de ventana) y piso de adoquín de cemento en canasta. Se dibujan en un canvas al abrir la vista
// (sin imágenes que bajar) y se pegan en mm reales: cada cara toma las coordenadas de sus puntos en mm (uvDe), así los
// ladrillos siguen de una pieza a la otra. Solo es la pinta: no cambia ningún cálculo.
//   Ladrillo: 200 × 75, junta 14, trabado a medio ladrillo; un tono por ladrillo, manchas claras y poros oscuros.
//   Adoquín: 200 × 100, junta 8, en canasta (pares acostados y parados); gris, con el canto redondeado más oscuro.

export const LADRILLO = { largo: 200, alto: 75, junta: 14, columnas: 8, hileras: 6 };
export const ADOQUIN = { largo: 200, ancho: 100, junta: 8, celdas: 4 };
/** [ancho, alto] en mm del dibujo que se repite. */
export const TILE_LADRILLO = [LADRILLO.columnas * (LADRILLO.largo + LADRILLO.junta), LADRILLO.hileras * (LADRILLO.alto + LADRILLO.junta)];
const CELDA = 2 * (ADOQUIN.ancho + ADOQUIN.junta);          // canasta: dos adoquines acostados = uno parado
export const TILE_ADOQUIN = [ADOQUIN.celdas * CELDA, ADOQUIN.celdas * CELDA];
export const COLOR_CEMENTO = "#b9b6ae";

/** Generador de números al azar con semilla (el mismo dibujo siempre). */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Coordenadas de textura en mm (sin three.js; para las pruebas): cada punto se proyecta sobre el plano de su cara
 * (normal ±z → x, y; ±x → z, y; ±y → x, z) y se divide por el tamaño del dibujo. pos y nor = [x, y, z, x, y, z…].
 */
export function uvDe(pos, nor, [tw, th]) {
  const n = pos.length / 3, uv = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    const ax = Math.abs(nor[3 * i]), ay = Math.abs(nor[3 * i + 1]), az = Math.abs(nor[3 * i + 2]);
    let u, v;
    if (az >= ax && az >= ay) [u, v] = [x, y];
    else if (ax >= ay) [u, v] = [z, y];
    else [u, v] = [x, z];
    uv[2 * i] = u / tw;
    uv[2 * i + 1] = v / th;
  }
  return uv;
}

/** Pone en la geometría las coordenadas de textura en mm (ver uvDe). */
export function enMm(T, geo, tile) {
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const uv = uvDe(geo.getAttribute("position").array, geo.getAttribute("normal").array, tile);
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  return geo;
}

const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

function textura(T, canvas) {
  const t = new T.CanvasTexture(canvas);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;                                          // three.js lo limita a lo que da el equipo
  return t;
}

/** Ladrillo visto (canvas 2048 × 512 para 8 × 6 ladrillos). */
export function texturaLadrillo(T) {
  const W = 2048, H = 512, [tw, th] = TILE_LADRILLO, sx = W / tw, sy = H / th;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), r = azar(20261126);
  c.fillStyle = rgb(178, 186, 181);                          // junta gris clara
  c.fillRect(0, 0, W, H);
  const { largo, alto, junta, columnas, hileras } = LADRILLO, px = largo + junta, py = alto + junta;
  for (let f = 0; f < hileras; f++) {
    const corre = f % 2 ? px / 2 : 0;                        // trabado a medio ladrillo
    for (let k = -1; k < columnas; k++) {
      const x0 = (k * px + corre + junta / 2) * sx, y0 = (f * py + junta / 2) * sy, w = largo * sx, h = alto * sy;
      const tono = 0.92 + 0.14 * r();
      c.fillStyle = rgb(216 * tono, 126 * tono, 96 * tono);
      for (const dx of [0, W]) c.fillRect(x0 - dx, y0, w, h);   // el que sale por la derecha entra por la izquierda
      c.save();
      c.beginPath();
      for (const dx of [0, W]) c.rect(x0 - dx, y0, w, h);
      c.clip();
      for (let m = 0; m < 4; m++) {                          // manchas claras, corridas a lo largo (como lavadas)
        const mx = x0 + r() * w, my = y0 + r() * h, rr = (0.08 + 0.14 * r()) * h;
        c.fillStyle = rgb(238, 208, 190, 0.07 + 0.09 * r());
        for (const dx of [0, W]) { c.beginPath(); c.ellipse(mx - dx, my, rr * (3 + 4 * r()), rr, 0, 0, 2 * Math.PI); c.fill(); }
      }
      for (let m = 0; m < 26; m++) {                         // poros oscuros
        const mx = x0 + r() * w, my = y0 + r() * h;
        c.fillStyle = rgb(95, 45, 30, 0.35 + 0.4 * r());
        for (const dx of [0, W]) c.fillRect(mx - dx, my, 1 + r() * 2, 2 + r() * 5);
      }
      c.restore();
      c.strokeStyle = rgb(120, 60, 40, 0.35);                // canto apenas más oscuro
      c.lineWidth = 1.5;
      for (const dx of [0, W]) c.strokeRect(x0 - dx + 0.75, y0 + 0.75, w - 1.5, h - 1.5);
    }
  }
  return textura(T, cv);
}

/** Adoquín de cemento en canasta (canvas 1024 × 1024 para 4 × 4 celdas de dos adoquines). */
export function texturaAdoquin(T) {
  const S = 1024, s = S / TILE_ADOQUIN[0];
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d"), r = azar(1438);
  c.fillStyle = rgb(181, 172, 158);                          // junta arenosa
  c.fillRect(0, 0, S, S);
  const { junta } = ADOQUIN, rad = 10 * s;
  const adoquin = (x, y, w, h) => {
    const tono = 0.86 + 0.16 * r();
    const redondo = (dx, dy, ww, hh) => {
      c.beginPath();
      c.moveTo(dx + rad, dy); c.arcTo(dx + ww, dy, dx + ww, dy + hh, rad); c.arcTo(dx + ww, dy + hh, dx, dy + hh, rad);
      c.arcTo(dx, dy + hh, dx, dy, rad); c.arcTo(dx, dy, dx + ww, dy, rad); c.closePath();
    };
    redondo(x, y, w, h);
    c.fillStyle = rgb(118 * tono, 116 * tono, 112 * tono);   // canto más oscuro
    c.fill();
    redondo(x + 4 * s, y + 4 * s, w - 8 * s, h - 8 * s);
    c.fillStyle = rgb(140 * tono, 138 * tono, 133 * tono);
    c.fill();
    c.save();
    c.clip();
    for (let m = 0; m < 3; m++) {                            // manchas claras del cemento
      c.fillStyle = rgb(200, 196, 188, 0.05 + 0.07 * r());
      c.beginPath();
      c.ellipse(x + r() * w, y + r() * h, (0.08 + 0.18 * r()) * w, (0.08 + 0.14 * r()) * h, r() * Math.PI, 0, 2 * Math.PI);
      c.fill();
    }
    c.restore();
  };
  for (let i = 0; i < ADOQUIN.celdas; i++) {
    for (let j = 0; j < ADOQUIN.celdas; j++) {
      const x0 = i * CELDA * s, y0 = j * CELDA * s, mitad = CELDA / 2, j2 = junta / 2;
      const acostados = (i + j) % 2 === 0;
      for (const k of [0, 1]) {
        if (acostados) adoquin(x0 + j2 * s, y0 + (k * mitad + j2) * s, (CELDA - junta) * s, (mitad - junta) * s);
        else adoquin(x0 + (k * mitad + j2) * s, y0 + j2 * s, (mitad - junta) * s, (CELDA - junta) * s);
      }
    }
  }
  return textura(T, cv);
}
