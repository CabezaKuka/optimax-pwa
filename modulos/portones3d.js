// Vista 3D de la reja o el portón (DEMO y PRO; 25-nov, Max: «que se pueda rotar», sin herrajes).
// Sale del mismo cálculo que el plano: cada forma de la elevación (R.formas) con la profundidad de su perfil.
//   - Tubo cuadrado / rectangular, macizo cuadrado, planchuela, ángulo: el contorno de la elevación (cortes a inglete y
//     en ángulo incluidos) extruido con la medida que no se ve de frente (b; cuadrado: a). El ángulo va como barra
//     llena (simplificación).
//   - Tubo y macizo redondo: cilindro de diámetro a sobre el eje de la pieza.
//   - Chapa ciega: placa del espesor de la chapa.
// Todo centrado en el plano del marco (z = 0). Unidades en mm, y hacia arriba (como la elevación).
// three.js (vendor/three.min.js) se carga recién al abrir la vista.

const COLOR = { MARCO: "#46596c", TRAVESANO: "#71879b", BARRA: "#9db3c7", CHAPA: "#c9d1d9" };
const BORDE = "#1d2833";
const REDONDOS = new Set(["tubo_red", "macizo_red"]);

/** Piezas 3D (sin three.js): [{capa, tipo: "extruir", pts, prof} | {capa, tipo: "cilindro", centro, dir, largo, d}]. */
export function piezas3D(R, perfiles, espChapa = 1.5) {
  const out = [];
  for (const [capa, pts, k] of R.formas) {
    const p = k ? perfiles[k.split("\u0001")[0]] : null;
    if (capa === "CHAPA" || !p) {
      out.push({ capa, tipo: "extruir", pts, prof: Math.max(0.5, Number(espChapa) || 1.5) });
      continue;
    }
    if (REDONDOS.has(p.forma)) {
      out.push({ capa, tipo: "cilindro", ...eje(pts), d: p.a });
      continue;
    }
    const prof = p.forma === "tubo" || p.forma === "angulo" || p.forma === "macizo_cuad" || p.forma === "planchuela" ? (p.b || p.a) : p.a;
    out.push({ capa, tipo: "extruir", pts, prof });
  }
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
export async function abrir3D(R, perfiles, { espChapa = 1.5, piso = false } = {}) {
  if (abierta) return;
  const capa = document.createElement("div");
  capa.className = "p-completa p-3d";
  capa.innerHTML = `<div class="p-completa-barra">
      <button type="button" class="p-3d-frente">Frente</button><button type="button" class="p-3d-girar">Girar</button>
      <button type="button" class="p-c-cerrar">Cerrar</button></div>
    <div class="p-3d-lienzo"><p class="nota p-3d-cargando">Cargando la vista 3D…</p></div>
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
  escena.add(new T.HemisphereLight("#ffffff", "#8a95a3", 1.6));
  const sol = new T.DirectionalLight("#ffffff", 1.8);
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
      mats[c] = new T.MeshStandardMaterial({ color: COLOR[c] || COLOR.BARRA, metalness: 0.35, roughness: 0.55,
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
  const lista = piezas3D(R, perfiles, espChapa);
  const Y = new T.Vector3(0, 1, 0);
  for (const pz of lista) {
    if (pz.tipo === "extruir") {
      const sh = new T.Shape();
      sh.moveTo(pz.pts[0][0], pz.pts[0][1]);
      for (const [x, y] of pz.pts.slice(1)) sh.lineTo(x, y);
      sh.closePath();
      const geo = new T.ExtrudeGeometry(sh, { depth: pz.prof, bevelEnabled: false });
      geo.translate(0, 0, -pz.prof / 2);
      agregar(geo, pz.capa);
    } else {
      const geo = new T.CylinderGeometry(pz.d / 2, pz.d / 2, pz.largo, 24);
      geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y, new T.Vector3(pz.dir[0], pz.dir[1], 0)));
      geo.translate(pz.centro[0], pz.centro[1], 0);
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
  capa.dataset.piezas = String(lista.length);              // para las pruebas

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
