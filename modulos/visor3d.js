// Visor 3D común (25-nov): pantalla completa con «Frente / Girar / Cerrar», un dedo gira y dos acercan y mueven.
// Lo usan Rejas y portones (modulos/portones3d.js) y Chapa (modulos/chapa3d.js). three.js (vendor/three.min.js) se
// carga recién al abrir y queda guardado por el service worker.
//
// abrirVisor({ armar, piso, margen, ... }): armar(T, grupo, basura) agrega las mallas al grupo (y lo que hay que
// liberar a basura) y devuelve { aviso, datos } (datos = atributos data-* de la capa, para las pruebas).

let abierta = null;

/** true si hay una vista 3D abierta. */
export const visorAbierto = () => !!abierta;

/**
 * Abre la vista 3D a pantalla completa.
 *   armar(T, grupo, basura) → { aviso?: texto, datos?: {clave: texto} }
 *   piso: dibuja el piso debajo (portones; la reja de ventana va en la pared).
 *   margen: mm de aire alrededor de lo dibujado para el encuadre (portones 200; chapa, una parte de la pieza).
 *   zArriba: las piezas vienen con z hacia arriba (chapa); se giran para que three.js (y arriba) las vea paradas.
 */
export async function abrirVisor({ armar, piso = false, margen = 200, zArriba = false, fondo = "#eef1f4" }) {
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
  escena.background = new T.Color(fondo);
  escena.add(new T.HemisphereLight("#ffffff", "#b9a88f", 2.4));
  const sol = new T.DirectionalLight("#ffffff", 2.2);
  sol.position.set(0.6, 1, 0.9);
  escena.add(sol);
  const sol2 = new T.DirectionalLight("#ffffff", 0.5);
  sol2.position.set(-0.8, 0.3, -0.7);
  escena.add(sol2);

  const grupo = new T.Group(), basura = [];
  let res;
  try { res = armar(T, grupo, basura) || {}; } catch (e) {
    for (const b of basura) b.dispose();
    ren.dispose();
    lienzo.innerHTML = `<p class="error-txt">No se pudo armar la vista 3D: ${String(e.message || e)}</p>`;
    return;
  }
  if (res.aviso) { const a = capa.querySelector(".p-3d-aviso"); a.textContent = `⚠ ${res.aviso}`; a.hidden = false; }
  for (const [k, v] of Object.entries(res.datos || {})) capa.dataset[k] = v;
  if (zArriba) grupo.rotation.x = -Math.PI / 2;            // z de la pieza → y de three.js
  escena.add(grupo);
  grupo.updateMatrixWorld(true);
  const caja = new T.Box3().setFromObject(grupo);
  const centro = caja.getCenter(new T.Vector3()), tam = caja.getSize(new T.Vector3());
  if (piso) {
    const ancho = tam.x + 1200, hondo = Math.max(1200, tam.x * 0.6);
    const geo = new T.BoxGeometry(ancho, 20, hondo);
    geo.translate(centro.x, -10, 0);
    const m = new T.MeshStandardMaterial({ color: "#dcd6cb", roughness: 0.95, metalness: 0 });
    basura.push(geo, m);
    escena.add(new T.Mesh(geo, m));
  }

  // chapa: la esfera que contiene la caja (media diagonal); portones: como antes (el lado mayor)
  const radio = (zArriba ? tam.length() : Math.max(tam.x, tam.y)) * 0.5 + margen;
  const cam = zArriba ? new T.PerspectiveCamera(35, 1, Math.max(0.5, radio / 200), radio * 400)
    : new T.PerspectiveCamera(35, 1, 10, 200000);
  const ctl = new (T.OrbitControls)(cam, ren.domElement);
  ctl.enableDamping = true;
  ctl.dampingFactor = 0.12;
  ctl.target.copy(centro);
  ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
  if (piso) ctl.maxPolarAngle = Math.PI / 2 - 0.03;       // la cámara no baja del piso
  ctl.minDistance = radio * 0.25;
  ctl.maxDistance = radio * 8;
  function vista(azimut, altura) {
    const dist = radio / Math.tan((cam.fov * Math.PI) / 360) * 1.05 * Math.max(1, (cam.aspect < 1 ? 1 / cam.aspect : 1));
    const a = (azimut * Math.PI) / 180, h = (altura * Math.PI) / 180;
    cam.position.set(centro.x + dist * Math.sin(a) * Math.cos(h), centro.y + dist * Math.sin(h),
      (zArriba ? centro.z : 0) + dist * Math.cos(a) * Math.cos(h));
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
  const inicial = zArriba ? [-35, 25] : [-30, 15];
  vista(...inicial);
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

/** Cierra la vista 3D abierta (si hay). */
export function cerrarVisor() {
  abierta?.capa.querySelector(".p-c-cerrar")?.click();
}
