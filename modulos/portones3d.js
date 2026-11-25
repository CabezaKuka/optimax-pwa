// Vista 3D de la reja o el portón (DEMO y PRO; 25-nov, Max: «que se pueda rotar», sin herrajes).
// Sale del mismo cálculo que el plano: cada forma de la elevación (R.formas) con la profundidad de su perfil.
//   - Tubo cuadrado / rectangular, macizo cuadrado, planchuela: el contorno de la elevación (cortes a inglete y en
//     ángulo incluidos) extruido con la medida que no se ve de frente (b; cuadrado: a).
//   - Ángulo (25-nov, Max): la cara ancha adelante (el contorno con el espesor t) y el ala hacia atrás sobre el borde
//     más largo (en el marco, el de afuera): la parte hueca queda atrás.
//   - Tubo y macizo redondo: cilindro de diámetro a sobre el eje de la pieza.
//   - Chapa ciega: placa del espesor de la chapa.
// Profundidad (z, hacia el que mira): el marco centrado en z = 0. A tope: todo centrado. Pasantes (travesaños
// superpuestos, 25-nov, Max): el de adelante (travesaño o barrotes, a elegir) al ras de la cara del frente del marco y
// el otro apoyado detrás. Marco de ángulo (25-nov, Max): travesaños, relleno y chapa adentro de la L, apoyados detrás de
// la cara (el cálculo ya los alarga hasta las alas). Unidades en mm, y hacia arriba (como la elevación).
// three.js (vendor/three.min.js) se carga recién al abrir la vista.

// ámbar de herrería (25-nov, Max): marco más oscuro, travesaños en el color del oficio, barrotes y chapa más claros
const COLOR = { MARCO: "#a65507", TRAVESANO: "#d97706", BARRA: "#f4b54f", CHAPA: "#f7deb0" };
const BORDE = "#3d2203";
const REDONDOS = new Set(["tubo_red", "macizo_red"]);
const fmt = (v) => String(Math.round(v * 10) / 10).replace(".", ",");

const profundidad = (p) => (p.forma === "tubo" || p.forma === "angulo" || p.forma === "macizo_cuad" || p.forma === "planchuela"
  ? (p.b || p.a) : p.a);

/**
 * Piezas 3D (sin three.js). {piezas: [{capa, tipo: "extruir", pts, z0, z1} | {capa, tipo: "cilindro", centro, dir,
 * largo, d, z}], n: piezas del plano, aviso}.
 */
export function piezas3D(R, perfiles, { espChapa = 1.5, pasantes = false, travAtras = false } = {}) {
  const perfil = (k) => (k ? perfiles[k.split("\u0001")[0]] || null : null);
  const formas = R.formas.map(([capa, pts, k]) => ({ capa, pts, p: capa === "CHAPA" ? null : perfil(k) }));
  const prof = (f) => (f.p ? profundidad(f.p) : Math.max(0.5, Number(espChapa) || 1.5));
  const maxCapa = (c) => Math.max(0, ...formas.filter((f) => f.capa === c).map(prof));
  const Dm = maxCapa("MARCO") || maxCapa("BARRA") || 20;
  const pmAng = formas.find((f) => f.capa === "MARCO" && f.p && f.p.forma === "angulo" && f.p.t > 0)?.p || null;
  const frente = pmAng ? Dm / 2 - pmAng.t : Dm / 2;      // donde apoya el relleno: detrás de la cara del ángulo
  const hondo = pmAng ? Dm - pmAng.t : Dm;                // lugar para el relleno dentro del marco
  const adelante = travAtras ? "BARRA" : "TRAVESANO", atras = travAtras ? "TRAVESANO" : "BARRA";
  const dAdel = maxCapa(adelante), dAtras = maxCapa(atras);
  let aviso = "";
  if (pasantes && dAdel + dAtras > hondo + 0.05) {
    aviso = `Los ${travAtras ? "barrotes" : "travesaños"} y los ${travAtras ? "travesaños" : "barrotes"} juntos ` +
      `(${fmt(dAdel + dAtras)} mm) son más gruesos que ${pmAng ? "el lugar detrás de la cara del ángulo" : "el marco"} (${fmt(hondo)} mm): sobresalen atrás.`;
  }
  const piezas = [];
  for (const f of formas) {
    const d = prof(f);
    let z1 = d / 2;                                          // cara de adelante
    if (pasantes && f.capa === adelante) z1 = frente;
    else if (pasantes && f.capa === atras) z1 = frente - dAdel;
    else if (pmAng && f.capa !== "MARCO") z1 = frente;     // a tope o chapa: apoyado detrás de la cara del ángulo
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
  }
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

let abierta = null;

/**
 * Abre la vista 3D a pantalla completa. R = resultado del ítem (calc.resultados[0]); perfiles = {nombre: Perfil};
 * opts.piso = true para dibujar el piso (portones; la reja de ventana va en la pared).
 */
export async function abrir3D(R, perfiles, { espChapa = 1.5, piso = false, pasantes = false, travAtras = false } = {}) {
  if (abierta) return;
  const capa = document.createElement("div");
  capa.className = "p-completa p-3d";
  capa.innerHTML = `<div class="p-completa-barra">
      <button type="button" class="p-3d-frente">Frente</button><button type="button" class="p-3d-girar">Girar</button>
      <button type="button" class="p-c-cerrar">Cerrar</button></div>
    <div class="p-3d-lienzo"><p class="nota p-3d-cargando">Cargando la vista 3D…</p></div>
    <p class="p-3d-aviso" hidden></p>
    <p class="p-3d-ayuda">Un dedo gira · dos dedos acercan y mueven</p>`;
  document.body.append(capa);
  document.body.classList.add("sin-scroll");
  const est = { capa, cerrar: null };
  abierta = est;
  const cerrar = () => {
    est.cerrar?.();
    capa.remove();
    document.body.classList.remove("sin-scroll");
    abierta = null;
  };
  capa.querySelector(".p-c-cerrar").addEventListener("click", cerrar);
  capa.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
  capa.querySelector(".p-c-cerrar").focus();
  const lienzo = capa.querySelector(".p-3d-lienzo");

  let T;
  try { T = await import("../vendor/three.min.js"); } catch {
    lienzo.innerHTML = `<p class="error-txt">No se pudo cargar la vista 3D. Abrí la página con internet una vez para que quede guardada.</p>`;
    return;
  }
  if (abierta !== est) return;                            // la cerraron mientras cargaba
  let ren;
  try { ren = new T.WebGLRenderer({ antialias: true }); } catch {
    lienzo.innerHTML = `<p class="error-txt">Este equipo no puede mostrar 3D (WebGL).</p>`;
    return;
  }
  lienzo.innerHTML = "";
  ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  ren.outputColorSpace = T.SRGBColorSpace;
  lienzo.append(ren.domElement);

  const escena = new T.Scene();
  escena.background = new T.Color("#eef1f4");
  escena.add(new T.HemisphereLight("#ffffff", "#b9a88f", 2.4));
  const sol = new T.DirectionalLight("#ffffff", 2.2);
  sol.position.set(0.6, 1, 0.9);
  escena.add(sol);
  const sol2 = new T.DirectionalLight("#ffffff", 0.5);
  sol2.position.set(-0.8, 0.3, -0.7);
  escena.add(sol2);

  const grupo = new T.Group(), basura = [];
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
  const { piezas: lista, n, aviso } = piezas3D(R, perfiles, { espChapa, pasantes, travAtras });
  if (aviso) { const a = capa.querySelector(".p-3d-aviso"); a.textContent = `⚠ ${aviso}`; a.hidden = false; }
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
  escena.add(grupo);
  const caja = new T.Box3().setFromObject(grupo);
  const centro = caja.getCenter(new T.Vector3()), tam = caja.getSize(new T.Vector3());
  if (piso) {
    const ancho = tam.x + 1200, fondo = Math.max(1200, tam.x * 0.6);
    const geo = new T.BoxGeometry(ancho, 20, fondo);
    geo.translate(centro.x, -10, 0);
    const m = new T.MeshStandardMaterial({ color: "#dcd6cb", roughness: 0.95, metalness: 0 });
    basura.push(geo, m);
    escena.add(new T.Mesh(geo, m));
  }
  capa.dataset.piezas = String(n);                         // piezas del plano (para las pruebas)
  capa.dataset.cuerpos = String(lista.length);
  const planos = {};                                       // [z de atrás, z de adelante] por capa (para las pruebas)
  for (const pz of lista) {
    const [a0, a1] = pz.tipo === "cilindro" ? [pz.z - pz.d / 2, pz.z + pz.d / 2] : [pz.z0, pz.z1];
    const p = planos[pz.capa] ||= [a0, a1];
    p[0] = Math.min(p[0], a0); p[1] = Math.max(p[1], a1);
  }
  capa.dataset.planos = JSON.stringify(planos);

  const cam = new T.PerspectiveCamera(35, 1, 10, 200000);
  const ctl = new (T.OrbitControls)(cam, ren.domElement);
  ctl.enableDamping = true;
  ctl.dampingFactor = 0.12;
  ctl.target.copy(centro);
  ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
  const radio = Math.max(tam.x, tam.y) * 0.5 + 200;
  if (piso) ctl.maxPolarAngle = Math.PI / 2 - 0.03;       // la cámara no baja del piso
  ctl.minDistance = radio * 0.25;
  ctl.maxDistance = radio * 8;
  function vista(azimut, altura) {
    const dist = radio / Math.tan((cam.fov * Math.PI) / 360) * 1.05 * Math.max(1, (cam.aspect < 1 ? 1 / cam.aspect : 1));
    const a = (azimut * Math.PI) / 180, h = (altura * Math.PI) / 180;
    cam.position.set(centro.x + dist * Math.sin(a) * Math.cos(h), centro.y + dist * Math.sin(h), dist * Math.cos(a) * Math.cos(h));
    ctl.target.copy(centro);
    ctl.update();
  }
  function medir() {
    const w = lienzo.clientWidth || 1, h = lienzo.clientHeight || 1;
    ren.setSize(w, h, false);
    ren.domElement.style.width = "100%";
    ren.domElement.style.height = "100%";
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  medir();
  vista(-30, 15);
  const obs = new ResizeObserver(medir);
  obs.observe(lienzo);
  let girando = false, vivo = true;
  capa.querySelector(".p-3d-frente").addEventListener("click", () => { girando = false; vista(0, 0); });
  capa.querySelector(".p-3d-girar").addEventListener("click", () => { girando = !girando; });
  ren.domElement.addEventListener("pointerdown", () => { girando = false; });
  const cuadro = () => {
    if (!vivo) return;
    if (girando) { ctl.autoRotate = true; ctl.autoRotateSpeed = 2; } else ctl.autoRotate = false;
    ctl.update();
    ren.render(escena, cam);
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
  est.cerrar = () => {
    vivo = false;
    obs.disconnect();
    ctl.dispose();
    for (const b of basura) b.dispose();
    ren.dispose();
    ren.forceContextLoss?.();
  };
}

export function cerrar3D() {
  abierta?.capa.querySelector(".p-c-cerrar")?.click();
}
