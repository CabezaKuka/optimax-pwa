// Vista 3D de la reja o el portón (DEMO y PRO; 25-nov, Max: «que se pueda rotar», sin herrajes).
// Sale del mismo cálculo que el plano: cada forma de la elevación (R.formas) con la profundidad de su perfil.
//   - Tubo cuadrado / rectangular, macizo cuadrado, planchuela: el contorno de la elevación (cortes a inglete y en
//     ángulo incluidos) extruido con la medida que no se ve de frente (b; cuadrado: a).
//   - Ángulo (25-nov, Max): la cara ancha adelante (el contorno con el espesor t) y el ala hacia atrás sobre el borde
//     más largo (en el marco, el de afuera): la parte hueca queda atrás.
//   - Tubo y macizo redondo: cilindro de diámetro a sobre el eje de la pieza.
//   - Chapa ciega: placa del espesor de la chapa.
// Profundidad (z, hacia el que mira): el marco centrado en z = 0; el resto en capas desde la cara de adelante del marco
// hacia atrás (25-nov, Max): a tope, el relleno y los travesaños en una capa; pasantes, el de adelante (travesaño o
// barrotes, a elegir) y el otro detrás; cuadrícula / rombos cruzados, una familia (verticales / diagonal «/») adelante y
// la otra detrás; chapa con los travesaños atrás, la chapa adelante; chapa a tope, paños y travesaños en una capa.
// Travesaño doble y paños a lo ancho (26-nov, Max): a tope, en la capa del relleno (parantes = travesaños). Marco de ángulo (25-nov, Max): travesaños, relleno y chapa adentro de la L, apoyados detrás de
// la cara (el cálculo ya los alarga hasta las alas). Unidades en mm, y hacia arriba (como la elevación).
// Alrededor (25-nov, Max): «Nada / Columnas / Paredes» solo en portones (entorno3D). Columnas de 300 × 300 y paredes
// de 150 × 1000, las dos 200 mm más altas que el portón, por fuera del vano. Batientes: en el plano del portón.
// Corredizo: la hoja corre por detrás (adelante = la calle): columna o pared del cierre pegada a la hoja (el solape
// queda detrás) y la del otro lado con el largo de la hoja abierta. Solo se ve en pantalla (no cambia el cálculo).
// Reja de ventana (25-nov, Max): «Nada / Pared»: paño de pared de 150 que sobresale 600 alrededor del hueco; la reja
// adentro del hueco al ras de la cara de afuera o, si sobresale, apoyada sobre la cara (sobrepuesta).
// three.js (vendor/three.min.js) se carga recién al abrir la vista (visor común: modulos/visor3d.js).
// Ladrillo y adoquín (26-nov, Max): paredes (también la de la reja de ventana) de ladrillo visto, columnas lisas color
// cemento y piso de adoquín en canasta (modulos/texturas3d.js). Solo la pinta.
import { abrirVisor, cerrarVisor } from "./visor3d.js";
import { texturaLadrillo, texturaAdoquin, enMm, TILE_LADRILLO, TILE_ADOQUIN, COLOR_CEMENTO } from "./texturas3d.js";

// ámbar de herrería (25-nov, Max): marco más oscuro, travesaños en el color del oficio, barrotes y chapa más claros
const COLOR = { MARCO: "#a65507", TRAVESANO: "#d97706", BARRA: "#f4b54f", CHAPA: "#f7deb0" };
const BORDE = "#3d2203";
const REDONDOS = new Set(["tubo_red", "macizo_red"]);
const MURO_BORDE = "#8f5a45", CEMENTO_BORDE = "#8a867e";
export const ENTORNOS = ["Nada", "Columnas", "Paredes"];
export const ENTORNOS_REJA = ["Nada", "Pared"];
const PANO = 600;                                   // pared alrededor del hueco de la ventana
const COLUMNA = 300, PARED = 150, LARGO_PARED = 1000, SOBRE = 200, HOLGURA = 20;
let ultimoEntorno = "Columnas";                     // lo último elegido (mientras la página está abierta)
let ultimoReja = "Pared";

/**
 * Cajas de columnas y paredes alrededor del portón (sin three.js). R = resultado (vano, hojas); zAdelante = z de la
 * cara de adelante del portón. {Columnas: [[x0, x1, y0, y1, z0, z1]…], Paredes: […]}.
 */
export function entorno3D(R, tipo, zAdelante = 20, zAtras = -20, sobrepuesta = false) {
  const [W, H] = R.vano;
  if (tipo === "reja_ventana") {
    // el hueco = el vano; adentro: la cara de afuera de la pared al ras de la reja; sobrepuesta: la reja sobre la cara
    const z1 = sobrepuesta ? zAtras : zAdelante, z0 = z1 - PARED;
    return { Pared: [[-PANO, 0, -PANO, H + PANO, z0, z1], [W, W + PANO, -PANO, H + PANO, z0, z1],
      [0, W, H, H + PANO, z0, z1], [0, W, -PANO, 0, z0, z1]] };
  }
  const alto = H + SOBRE;
  const hojaMax = Math.max(W, ...R.hojas.map((h) => h[0] + h[2]));
  if (tipo === "corredizo") {
    const z0 = zAdelante + HOLGURA;                  // por delante de la hoja, que corre detrás
    const abierta = hojaMax + 100;                   // la hoja abierta entra entera detrás de la pared
    return {
      Columnas: [[-COLUMNA, 0, 0, alto, z0, z0 + COLUMNA], [W, W + COLUMNA, 0, alto, z0, z0 + COLUMNA]],
      Paredes: [[-Math.max(LARGO_PARED, abierta), 0, 0, alto, z0, z0 + PARED], [W, W + LARGO_PARED, 0, alto, z0, z0 + PARED]],
    };
  }
  return {
    Columnas: [[-COLUMNA, 0, 0, alto, -COLUMNA / 2, COLUMNA / 2], [W, W + COLUMNA, 0, alto, -COLUMNA / 2, COLUMNA / 2]],
    Paredes: [[-LARGO_PARED, 0, 0, alto, -PARED / 2, PARED / 2], [W, W + LARGO_PARED, 0, alto, -PARED / 2, PARED / 2]],
  };
}

const fmt = (v) => String(Math.round(v * 10) / 10).replace(".", ",");

const profundidad = (p) => (p.forma === "tubo" || p.forma === "angulo" || p.forma === "macizo_cuad" || p.forma === "planchuela"
  ? (p.b || p.a) : p.a);

/**
 * Piezas 3D (sin three.js). {piezas: [{capa, tipo: "extruir", pts, z0, z1} | {capa, tipo: "cilindro", centro, dir,
 * largo, d, z}], n: piezas del plano, aviso}.
 */
export function piezas3D(R, perfiles, { espChapa = 1.5, pasantes = false, travAtras = false, relleno = "",
  cruce = "cruzadas", chapaTrav = "atras" } = {}) {
  // la clave lleva «\u0002g» pegada al nombre si el perfil va con la 2.ª medida de frente (botón «Frente», solo PWA)
  const perfil = (k) => {
    if (!k) return null;
    const [nom, g] = k.split("\u0001")[0].split("\u0002");
    const p = perfiles[nom] || null;
    return p && g !== undefined ? { ...p, a: p.b || p.a, b: p.a } : p;
  };
  const formas = R.formas.map(([capa, pts, k]) => ({ capa, pts, p: capa === "CHAPA" ? null : perfil(k) }));
  const prof = (f) => (f.p ? profundidad(f.p) : Math.max(0.5, Number(espChapa) || 1.5));
  const maxCapa = (c) => Math.max(0, ...formas.filter((f) => f.capa === c).map(prof));
  const Dm = maxCapa("MARCO") || maxCapa("BARRA") || 20;
  const pmAng = formas.find((f) => f.capa === "MARCO" && f.p && f.p.forma === "angulo" && f.p.t > 0)?.p || null;
  const frente = pmAng ? Dm / 2 - pmAng.t : Dm / 2;      // donde apoya el relleno: la cara de adelante del marco
  const hondo = pmAng ? Dm - pmAng.t : Dm;                // lugar para el relleno dentro del marco
  // capa de profundidad de cada pieza (de adelante hacia atrás): travesaño, familias del relleno, chapa
  const cruzadas = (relleno === "cuadricula" || relleno === "rombos") && cruce !== "plano";
  const familia = (f) => {
    if (f.capa === "CHAPA") return "chapa";
    if (f.capa === "TRAVESANO") return "trav";
    if (!cruzadas) return "barra";
    const { dir } = eje(f.pts);
    return relleno === "cuadricula" ? (Math.abs(dir[1]) > Math.abs(dir[0]) ? "famA" : "famB")
      : (dir[0] * dir[1] > 0 ? "famA" : "famB");
  };
  let capas;
  // chapa: los barrotes de la franja del travesaño doble (solo PWA, 26-nov) van en la capa de los travesaños
  if (relleno === "chapa") capas = chapaTrav === "a_tope" ? [["chapa", "trav", "barra"]] : [["chapa"], ["trav", "barra"]];
  else {
    const rel = cruzadas ? [["famA"], ["famB"]] : [["barra"]];
    if (pasantes) capas = travAtras ? [...rel, ["trav"]] : [["trav"], ...rel];
    else capas = [[...rel[0], "trav"], ...rel.slice(1)];
  }
  const fam = formas.map((f) => (f.capa === "MARCO" ? null : familia(f)));
  // fondo de cada capa: el de todas sus piezas, y lo que corre la capa siguiente (26-nov, Max): sin el travesaño si
  // va a tope con el relleno (no se pisan; antes un travesaño más hondo que el relleno separaba la 2.ª familia de
  // rombos / cuadrícula cruzados de la 1.ª)
  const hondoDe = (cs) => Math.max(0, ...formas.filter((f, i) => cs.includes(fam[i])).map(prof));
  const hondoCapa = capas.map(hondoDe);
  const pasoCapa = capas.map((cs) => (cs.length > 1 && cs.includes("trav") ? hondoDe(cs.filter((c) => c !== "trav")) : hondoDe(cs)));
  const z1Capa = {};
  let acum = 0, fondo = 0;
  capas.forEach((cs, i) => {
    for (const c of cs) z1Capa[c] = frente - acum;
    fondo = Math.max(fondo, acum + hondoCapa[i]);
    acum += pasoCapa[i];
  });
  let aviso = "";
  if (hondoCapa.filter((h) => h > 0).length > 1 && fondo > hondo + 0.05) {
    aviso = `El relleno y los travesaños, uno detrás del otro, suman ${fmt(fondo)} mm y ` +
      `${pmAng ? "detrás de la cara del ángulo hay" : "el marco tiene"} ${fmt(hondo)} mm: sobresalen atrás.`;
  }
  const piezas = [];
  formas.forEach((f, i) => {
    const d = prof(f);
    const z1 = f.capa === "MARCO" ? d / 2 : z1Capa[fam[i]];
    const z0 = z1 - d;
    if (f.p && REDONDOS.has(f.p.forma)) {
      piezas.push({ capa: f.capa, tipo: "cilindro", ...eje(f.pts), d: f.p.a, z: (z0 + z1) / 2 });
    } else if (f.p && f.p.forma === "angulo" && f.p.t > 0 && f.p.t < d) {
      piezas.push({ capa: f.capa, tipo: "extruir", pts: f.pts, z0: z1 - f.p.t, z1 });           // cara ancha
      const ala = franjaBorde(f.pts, f.p.t);
      if (ala.length >= 3) piezas.push({ capa: f.capa, tipo: "extruir", pts: ala, z0, z1: z1 - f.p.t });
    } else {
      piezas.push({ capa: f.capa, tipo: "extruir", pts: f.pts, z0, z1 });
    }
  });
  return { piezas, n: R.formas.length, aviso };
}

/** Franja de ancho t del polígono junto a su borde más largo (el ala del ángulo; en el marco, el borde de afuera). */
function franjaBorde(pts, t) {
  let i0 = 0, lmax = -1;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > lmax) { lmax = l; i0 = i; }
  });
  const p = pts[i0], q = pts[(i0 + 1) % pts.length];
  const cx = pts.reduce((s, v) => s + v[0], 0) / pts.length, cy = pts.reduce((s, v) => s + v[1], 0) / pts.length;
  let nx = -(q[1] - p[1]) / lmax, ny = (q[0] - p[0]) / lmax;
  if ((cx - p[0]) * nx + (cy - p[1]) * ny < 0) { nx = -nx; ny = -ny; }     // hacia adentro de la pieza
  const dist = (v) => (v[0] - p[0]) * nx + (v[1] - p[1]) * ny;
  const out = [];                                          // recorte por el semiplano dist <= t (Sutherland-Hodgman)
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length], da = dist(a) - t, db = dist(b) - t;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const u = da / (da - db);
      out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
    }
  });
  return out;
}

/** Eje de una pieza recta (dirección principal de su contorno), centro y largo punta a punta. */
function eje(pts) {
  const n = pts.length;
  const cx = pts.reduce((s, q) => s + q[0], 0) / n, cy = pts.reduce((s, q) => s + q[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir = [Math.cos(ang), Math.sin(ang)];
  const pr = pts.map(([x, y]) => (x - cx) * dir[0] + (y - cy) * dir[1]);
  const t0 = Math.min(...pr), t1 = Math.max(...pr);
  const m = (t0 + t1) / 2;
  return { centro: [cx + m * dir[0], cy + m * dir[1]], dir, largo: t1 - t0 };
}

/**
 * Abre la vista 3D a pantalla completa (visor común: modulos/visor3d.js). R = resultado del ítem (calc.resultados[0]);
 * perfiles = {nombre: Perfil}; opts.piso = true para dibujar el piso (portones; la reja de ventana va en la pared).
 */
export async function abrir3D(R, perfiles, { espChapa = 1.5, piso = false, pasantes = false, travAtras = false,
  relleno = "", cruce = "cruzadas", chapaTrav = "atras", tipo = "", sobrepuesta = false } = {}) {
  let zAdelante = 20, zAtras = -20;
  const reja = tipo === "reja_ventana";
  const entorno = piso || reja ? {
    opciones: reja ? ENTORNOS_REJA : ENTORNOS, inicial: reja ? ultimoReja : ultimoEntorno,
    alCambiar: (op) => { if (reja) ultimoReja = op; else ultimoEntorno = op; },
    armar: (T, basura) => {
      const ladrillo = texturaLadrillo(T);
      const mat = new T.MeshStandardMaterial({ map: ladrillo, color: "#ffffff", roughness: 0.9, metalness: 0 });
      const lin = new T.LineBasicMaterial({ color: MURO_BORDE });
      const matCol = new T.MeshStandardMaterial({ color: COLOR_CEMENTO, roughness: 0.95, metalness: 0 });
      const linCol = new T.LineBasicMaterial({ color: CEMENTO_BORDE });
      basura.push(ladrillo, mat, lin, matCol, linCol);
      const out = { Nada: null };
      for (const [op, cajas] of Object.entries(entorno3D(R, tipo, zAdelante, zAtras, sobrepuesta))) {
        const g = new T.Group();
        const columnas = op === "Columnas";
        g.userData.textura = columnas ? "cemento" : "ladrillo";         // para las pruebas (data-texturas)
        if (reja) {
          // la pared de la ventana: una sola pieza con el hueco (sin las uniones de los 4 paños)
          const xs = cajas.flatMap((c) => [c[0], c[1]]), ys = cajas.flatMap((c) => [c[2], c[3]]);
          const [W, H] = R.vano, [z0, z1] = [cajas[0][4], cajas[0][5]];
          const sh = new T.Shape();
          sh.moveTo(Math.min(...xs), Math.min(...ys)); sh.lineTo(Math.max(...xs), Math.min(...ys));
          sh.lineTo(Math.max(...xs), Math.max(...ys)); sh.lineTo(Math.min(...xs), Math.max(...ys)); sh.closePath();
          const hu = new T.Shape();               // (el three.js propio no trae Path; Shape sirve de hueco)
          hu.moveTo(0, 0); hu.lineTo(0, H); hu.lineTo(W, H); hu.lineTo(W, 0); hu.closePath();
          sh.holes.push(hu);
          const geo = new T.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false });
          geo.translate(0, 0, z0);
          enMm(T, geo, TILE_LADRILLO);
          const ed = new T.EdgesGeometry(geo, 30);
          basura.push(geo, ed);
          g.add(new T.Mesh(geo, mat), new T.LineSegments(ed, lin));
          out[op] = g;
          continue;
        }
        for (const [x0, x1, y0, y1, z0, z1] of cajas) {
          const geo = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
          geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
          if (!columnas) enMm(T, geo, TILE_LADRILLO);
          const ed = new T.EdgesGeometry(geo);
          basura.push(geo, ed);
          g.add(new T.Mesh(geo, columnas ? matCol : mat), new T.LineSegments(ed, columnas ? linCol : lin));
        }
        out[op] = g;
      }
      return out;
    },
  } : null;
  const pisoTextura = (T) => ({ map: texturaAdoquin(T), tile: TILE_ADOQUIN, nombre: "adoquin", enMm });
  await abrirVisor({ piso, pisoTextura, margen: 200, entorno, clase: "of-herreria", armar: (T, grupo, basura) => {
    const mats = {}, lineas = new T.LineBasicMaterial({ color: BORDE });
    basura.push(lineas);
    const material = (c) => {
      if (!mats[c]) {
        mats[c] = new T.MeshStandardMaterial({ color: COLOR[c] || COLOR.BARRA, metalness: 0.1, roughness: 0.6,
          polygonOffset: true, polygonOffsetFactor: c === "BARRA" ? 2 : c === "CHAPA" ? 3 : c === "TRAVESANO" ? 1 : 0,
          polygonOffsetUnits: 1 });
        basura.push(mats[c]);
      }
      return mats[c];
    };
    const agregar = (geo, c) => {
      const m = new T.Mesh(geo, material(c));
      const ed = new T.EdgesGeometry(geo, 30);
      basura.push(geo, ed);
      grupo.add(m, new T.LineSegments(ed, lineas));
    };
    const { piezas: lista, n, aviso } = piezas3D(R, perfiles, { espChapa, pasantes, travAtras, relleno, cruce, chapaTrav });
    zAdelante = Math.max(0, ...lista.map((pz) => (pz.tipo === "cilindro" ? pz.z + pz.d / 2 : pz.z1)));
    zAtras = Math.min(0, ...lista.map((pz) => (pz.tipo === "cilindro" ? pz.z - pz.d / 2 : pz.z0)));
    const Y = new T.Vector3(0, 1, 0);
    for (const pz of lista) {
      if (pz.tipo === "extruir") {
        const sh = new T.Shape();
        sh.moveTo(pz.pts[0][0], pz.pts[0][1]);
        for (const [x, y] of pz.pts.slice(1)) sh.lineTo(x, y);
        sh.closePath();
        const geo = new T.ExtrudeGeometry(sh, { depth: pz.z1 - pz.z0, bevelEnabled: false });
        geo.translate(0, 0, pz.z0);
        agregar(geo, pz.capa);
      } else {
        const geo = new T.CylinderGeometry(pz.d / 2, pz.d / 2, pz.largo, 24);
        geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y, new T.Vector3(pz.dir[0], pz.dir[1], 0)));
        geo.translate(pz.centro[0], pz.centro[1], pz.z);
        agregar(geo, pz.capa);
      }
    }
    const planos = {};                                     // [z de atrás, z de adelante] por capa (para las pruebas)
    for (const pz of lista) {
      const [a0, a1] = pz.tipo === "cilindro" ? [pz.z - pz.d / 2, pz.z + pz.d / 2] : [pz.z0, pz.z1];
      const p = planos[pz.capa] ||= [a0, a1];
      p[0] = Math.min(p[0], a0); p[1] = Math.max(p[1], a1);
    }
    // piezas del plano y cuerpos dibujados (para las pruebas)
    return { aviso, datos: { piezas: String(n), cuerpos: String(lista.length), planos: JSON.stringify(planos) } };
  } });
}

export function cerrar3D() {
  cerrarVisor();
}
