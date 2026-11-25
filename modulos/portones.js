// Módulo Rejas y portones (herrería): elevación con marcas, lista de corte de cada perfil, barras a comprar, peso,
// soldadura y pintura. Port de ui_portones.py del escritorio, con un solo trabajo (con cantidad).
// DEMO: solo reja de ventana hasta 1500 × 1000 (en cualquier orientación), barras con el cálculo rápido, sin costos.
// PRO (repo privado): los portones (batiente 1 y 2 hojas, corredizo), barras con el optimizador completo (en un
// Worker, para no trabar la pantalla) y los costos.
import * as P from "../portones/motor.js";
import { optimizarRapido, numero, med, miles } from "../barras/motor.js";
import { corto } from "../geo/base.js";
import { cargarPro, urlPro } from "../licencia.js";
import { ponerContexto, abrirPro } from "../hoja-pro.js";
import { abrirSalida, activarBoton, cerrarSalida } from "../salida.js";

const CLAVE = "optimax-portones";
// perfiles de ejemplo, sin precio (cada uno carga los suyos en «Perfiles»)
const PERFILES_EJEMPLO = [
  ["Tubo cuadrado 40×40×2", "tubo", "40×40×2"], ["Tubo cuadrado 30×30×1,5", "tubo", "30×30×1,5"],
  ["Tubo cuadrado 20×20×1,5", "tubo", "20×20×1,5"], ["Tubo 60×40×2", "tubo", "60×40×2"],
  ["Tubo redondo Ø1\" × 2", "tubo_red", "Ø1\" × 2"], ["Macizo cuadrado 12", "macizo_cuad", "12"],
  ["Macizo redondo Ø12", "macizo_red", "Ø12"], ["Planchuela 1 1/2\" × 3/16\"", "planchuela", "1 1/2 x 3/16\""],
  ["Ángulo 40×40×3", "angulo", "40×40×3"],
].map(([nombre, forma, medidas]) => ({ nombre, forma, medidas, largo: 6000, precio: 0 }));
const ITEM_INICIAL = {
  ...P.ITEM_DEF, ...P.DEMO_MUESTRA, perfil_marco: "Tubo cuadrado 40×40×2", perfil_relleno: "Tubo cuadrado 20×20×1,5",
};
const INICIAL = { item: ITEM_INICIAL, perfiles: PERFILES_EJEMPLO, corte: "3", sold: "", pint: "", margen: "1", cotas: false };
// colores del dibujo sin marca (miniaturas) y orden de dibujo por capa (ui_portones.MONO / ORDEN)
const MONO = { CHAPA: ["#d9dee4", "#9aa3ad"], BARRA: ["#a9bccd", "#4d6378"], TRAVESANO: ["#6f8396", "#2f3d4a"], MARCO: ["#3f5163", "#1d2833"] };
const ORDEN = { CHAPA: 0, BARRA: 1, TRAVESANO: 2, MARCO: 3 };
const COTA = "#1f7a4d", PISO = "#8a95a3", FONDO = "#ffffff";
const CORTOS = {
  reja_ventana: "Reja de ventana", batiente_1: "Batiente 1 hoja", batiente_2: "Batiente 2 hojas", corredizo: "Corredizo",
  verticales: "Verticales", horizontales: "Horizontales", diagonales: "Diagonales", rombos: "Rombos",
  cuadricula: "Cuadrícula", cruz: "Cruz (X)", chapa: "Chapa ciega",
};
// campos numéricos: clave, rótulo, unidad, mínimo
const CAMPOS = {
  ancho: ["Ancho del vano", "mm", 100], alto: ["Alto del vano", "mm", 100],
  luz_max: ["Luz máxima entre barrotes", "mm", 5], angulo: ["Ángulo", "°", 10], esp_chapa: ["Espesor de la chapa", "mm", 0.5],
  holg_lat: ["Holgura a los costados", "mm", 0], holg_centro: ["Holgura entre hojas", "mm", 0],
  luz_piso: ["Luz al piso", "mm", 0], solape: ["Solape del corredizo", "mm", 0],
};

const $ = (s) => raiz.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = (v) => miles(v, 1, true);
let raiz, est, observador = null, salidaPdf = null, pro = false, optPro = null, rutaOpt = null, reloj, calc = null, sel = null, avisoDemo = "";
let trabajador = null, ocupado = false, pedido = 0, alVolver = null, completa = null, zoom = 1;
const cache = new Map();                 // resultados del optimizador completo (como portones._MEMO)

function cargarMemoria() {
  let m;
  try { m = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { m = {}; }
  const out = { ...INICIAL, ...m };
  out.item = P.normalizarItem({ ...ITEM_INICIAL, ...(m.item || {}) });
  if (!Array.isArray(out.perfiles)) out.perfiles = PERFILES_EJEMPLO;
  return out;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch { /* sin almacenamiento */ }
}
const perfiles = () => P.perfilesDe(est.perfiles);

export async function montar(cont) {
  raiz = cont;
  est = cargarMemoria();
  const tipos = await cargarPro("portones/tipos.js");
  if (tipos) {
    P.registrarTipos(tipos.TIPOS_PORTON);
    pro = tipos;
    optPro = await cargarPro("barras/optimizar.js");
    salidaPdf = await cargarPro("salidas/portones.js");
    rutaOpt = urlPro("barras/optimizar.js");
  }
  if (!pro && !P.demoPermite(est.item)) Object.assign(est.item, P.DEMO_MUESTRA);   // la DEMO arranca en la reja
  ponerContexto("Rejas y portones", "");
  cont.innerHTML = PLANTILLA;
  armarTarjetas();
  armarCampos();
  armarEventos();
  ponerValores();
  calcular();
  if (salidaPdf) activarBoton($("#p-pdf"), "Imprimir o guardar en PDF", guardarPdf);
}

function guardarPdf() {
  if (!calc || !calc.resultados[0]) return;
  const c = calc;
  abrirSalida({
    titulo: "Lista de corte en PDF",
    archivo: "Rejas y portones - lista de corte.pdf",
    describir: () => (ocupado ? "Las barras todavía se están optimizando: esperá un momento para que el PDF salga con las definitivas. " : "") +
      "Hojas A4 apaisadas: lista de corte con marcas, ángulos y croquis, las barras de cada perfil y la elevación acotada.",
    armar: () => salidaPdf.pdfPortones(c),
  });
}

export function desmontar() {
  clearTimeout(reloj);
  cerrarSalida();
  observador?.disconnect();
  pedido++;
  if (trabajador) { trabajador.terminate(); trabajador = null; ocupado = false; }
  cerrarCompleta();
  raiz?.querySelector("#hoja-perfiles")?.close?.();
}

// ------------------------------------------------------------------ plantilla
const campo = (k) => {
  const [rot, uni] = CAMPOS[k];
  return `<div class="campo" data-k="${k}"><label class="rotulo" for="p-${k}">${rot}</label>
    <span class="entrada"><input id="p-${k}" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">${uni}</span></span></div>`;
};
const paso = (k, rot) => `<div class="campo" data-k="${k}"><span class="rotulo" id="p-${k}-rot">${rot}</span>
  <span class="paso" role="group" aria-labelledby="p-${k}-rot"><button type="button" class="menos" data-paso="${k}" data-d="-1" aria-label="Uno menos">−</button><span class="cant" id="p-${k}">1</span><button type="button" class="mas" data-paso="${k}" data-d="1" aria-label="Uno más">+</button></span></div>`;
const perfilSel = (k, rot) => `<div class="campo campo-perfil" data-k="${k}"><label class="rotulo" for="p-${k}">${rot}</label>
  <select id="p-${k}" class="p-select"></select></div>`;

const PLANTILLA = `
<div class="app app-barras app-portones">
  <section class="b-datos" aria-label="Datos de la reja o el portón">
    <h1 class="titulo-figura">Rejas y portones</h1>
    <h2 class="sub">Tipo</h2>
    <div class="p-tarjetas p-tipos" id="p-tipos"></div>
    ${paso("cantidad", "Cantidad iguales")}
    <h2 class="sub">Medidas</h2>
    ${campo("ancho")}${campo("alto")}
    <h2 class="sub">Perfiles <button type="button" class="btn-sec btn-chico" id="p-admin">Editar perfiles</button></h2>
    ${perfilSel("perfil_marco", "Marco")}${perfilSel("perfil_trav", "Travesaños")}${perfilSel("perfil_relleno", "Relleno")}
    <h2 class="sub">Relleno</h2>
    <div class="p-tarjetas p-rellenos" id="p-rellenos"></div>
    ${campo("luz_max")}${campo("angulo")}${paso("n_trav", "Travesaños")}
    <div class="campo campo-opcion" data-k="armado"><span class="rotulo">Armado con travesaños</span>
      <div class="segmentos" role="radiogroup" aria-label="Armado">
        <label><input type="radio" name="p-armado" value="a_tope"><span>A tope</span></label>
        <label><input type="radio" name="p-armado" value="pasantes"><span>Pasantes</span></label>
      </div></div>
    ${campo("esp_chapa")}
    <details class="p-plegable" id="p-holguras"><summary>Holguras del portón</summary>
      ${campo("holg_lat")}${campo("holg_centro")}${campo("luz_piso")}${campo("solape")}</details>
    <details class="p-plegable"><summary>Corte y costos del taller</summary>
      <div class="campo"><label class="rotulo" for="p-corte">Ancho del corte de sierra</label>
        <span class="entrada"><input id="p-corte" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">mm</span></span></div>
      <div class="precio" id="p-costos">
        <div class="campo"><label class="rotulo" for="p-sold">Soldadura, por metro</label>
          <span class="entrada"><input id="p-sold" type="text" inputmode="decimal" spellcheck="false" placeholder="0"></span></div>
        <div class="campo"><label class="rotulo" for="p-pint">Pintura, por m²</label>
          <span class="entrada"><input id="p-pint" type="text" inputmode="decimal" spellcheck="false" placeholder="0"></span></div>
        <div class="campo"><label class="rotulo" for="p-margen">Margen (× el costo)</label>
          <span class="entrada"><input id="p-margen" type="text" inputmode="decimal" spellcheck="false" placeholder="1"></span></div>
        <p class="nota">El acero sale del precio de cada barra (en «Editar perfiles»).</p>
        <button type="button" class="btn-bloq precio-pro" data-abre-pro="precio"><span class="candado" aria-hidden="true"></span>Costo y precio del trabajo <span class="tag">PRO</span></button>
      </div>
    </details>
  </section>

  <section class="b-res" aria-label="Resultado" aria-live="polite">
    <p class="aviso-demo" id="p-demo" hidden></p>
    <div class="error-txt" id="p-error" role="alert" hidden></div>
    <div id="p-resultado">
      <div class="resumen" id="p-resumen"></div>
      <figure class="p-elev">
        <div class="p-elev-cab">
          <span class="p-luz" id="p-luz"></span>
          <label class="tilde tilde-chica"><input type="checkbox" id="p-cotas"> Cotas</label>
          <button type="button" class="btn-sec btn-chico" id="p-ampliar">Ampliar</button>
        </div>
        <div class="p-dibujo" id="p-dibujo"></div>
        <figcaption class="nota">Tocá una pieza para ver dónde va y su renglón en la lista.</figcaption>
      </figure>
      <p class="nota p-aviso" id="p-avisos" hidden></p>
      <h2 class="sub">Lista de corte</h2>
      <ol class="p-lista" id="p-lista"></ol>
      <h2 class="sub">Barras a comprar</h2>
      <p class="nota" id="p-opt" hidden>Optimizando las barras…</p>
      <div id="p-barras"></div>
      <div class="p-datos" id="p-datos"></div>
      <div id="p-costo"></div>
    </div>
    <div class="acciones">
      <button type="button" class="btn-bloq" id="p-pdf" data-abre-pro="pdf"><span class="candado" aria-hidden="true"></span>Imprimir o guardar en PDF <span class="tag">PRO</span></button>
    </div>
    <p class="verificar">Verificá todas las medidas antes de cortar o fabricar.</p>
  </section>
</div>

<dialog class="hoja-pro hoja-perfiles" id="hoja-perfiles" aria-labelledby="perfiles-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="perfiles-tit">Perfiles</h2>
    <p>Los perfiles que usás: forma y medidas (ej. 40x40x2, Ø12, 1 1/2 x 3/16"), largo de la barra que comprás y su precio.</p>
    <ul class="perfiles" id="perfiles"></ul>
    <button type="button" class="btn-sec" id="perfil-nuevo">Agregar perfil</button>
    <button type="submit" class="btn-prim" value="listo">Listo</button>
  </form>
</dialog>`;

// ------------------------------------------------------------------ dibujo (SVG en mm, y hacia arriba)
function mezcla(c1, c2, f) {
  const a = [1, 3, 5].map((i) => parseInt(c1.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(c2.slice(i, i + 2), 16));
  return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * f).toString(16).padStart(2, "0")).join("");
}
const ptsSvg = (pts) => pts.map(([x, y]) => `${+x.toFixed(3)},${+(-y).toFixed(3)}`).join(" ");

/**
 * Elevación R en SVG. anchoPx / altoMax: lugar disponible en píxeles (de ahí sale la escala, para que textos y
 * marcas tengan tamaño fijo en pantalla). marcas: {clave: fila} para colorear; sel: marca resaltada.
 */
function svgElevacion(R, { anchoPx, altoMax = 1e9, marcas = null, seleccion = null, cotas = false, mini = false }) {
  const [x0, y0, x1, y1] = P.limites(R, cotas);
  const [W, H] = R.vano;
  const borde = mini ? 3 : cotas ? 16 : 34;                       // px alrededor (sin cotas: los textos del vano)
  let s = Math.min((anchoPx - 2 * borde) / Math.max(x1 - x0, 1), (altoMax - 2 * borde) / Math.max(y1 - y0, 1));
  s = Math.max(s, 1e-4);
  const pad = borde / s;
  const vb = [x0 - pad, -(y1 + pad), x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
  const wPx = vb[2] * s, hPx = vb[3] * s;
  const px = (v) => v / s;
  const out = [];
  if (!mini) {
    out.push(`<line x1="${Math.min(x0, 0) - px(20)}" y1="0" x2="${Math.max(x1, W) + px(20)}" y2="0" stroke="${PISO}" stroke-width="2" vector-effect="non-scaling-stroke"/>`,
      `<rect x="0" y="${-H}" width="${W}" height="${H}" fill="none" stroke="${PISO}" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`);
  }
  const mejor = new Map();
  for (const [capa, pts, k] of [...R.formas].sort((a, b) => ORDEN[a[0]] - ORDEN[b[0]])) {
    const f = marcas && k !== null ? marcas[k] : null;
    if (f) {
      let fill, linea, grosor = 1;
      if (seleccion && f.marca !== seleccion) { fill = mezcla(f.color, FONDO, 0.78); linea = mezcla(f.color, FONDO, 0.6); } else {
        fill = f.color; linea = mezcla(f.color, "#000000", 0.45);
        if (f.marca === seleccion) grosor = 2;
      }
      out.push(`<polygon points="${ptsSvg(pts)}" fill="${fill}" stroke="${linea}" stroke-width="${grosor}" vector-effect="non-scaling-stroke" data-m="${f.marca}"/>`);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
      const area = (bx1 - bx0) * (by1 - by0);
      const cen = by1 - by0 > bx1 - bx0 ? [(bx0 + bx1) / 2, by0 + 0.3 * (by1 - by0)] : [bx0 + 0.3 * (bx1 - bx0), (by0 + by1) / 2];
      if (!mejor.has(f.marca) || area > mejor.get(f.marca)[0]) mejor.set(f.marca, [area, cen, f]);
    } else {
      const [fi, o] = MONO[capa];
      out.push(`<polygon points="${ptsSvg(pts)}" fill="${fi}" stroke="${o}" stroke-width="${mini ? 0.6 : 1}" vector-effect="non-scaling-stroke"/>`);
    }
  }
  for (const [, [cx, cy], f] of mejor.values()) {
    if (seleccion && f.marca !== seleccion) continue;
    const r = px(f.marca.length === 1 ? 11 : 14), ry = px(11);
    out.push(`<g data-m="${f.marca}"><ellipse cx="${cx}" cy="${-cy}" rx="${r}" ry="${ry}" fill="#fff" stroke="${mezcla(f.color, "#000000", 0.3)}" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
      `<text x="${cx}" y="${-cy}" font-size="${px(13)}" class="p-letra">${f.marca}</text></g>`);
  }
  if (cotas) out.push(dibujarCotas(R, s));
  else if (!mini) {
    out.push(`<text x="${W / 2}" y="${px(18)}" font-size="${px(13)}" class="p-vano">${med(W)} mm (vano)</text>`,
      `<text x="${-px(20)}" y="${-H / 2}" font-size="${px(13)}" class="p-vano" transform="rotate(-90 ${-px(20)} ${-H / 2})">${med(H)}</text>`);
  }
  return `<svg viewBox="${vb.join(" ")}" width="${wPx.toFixed(1)}" height="${hPx.toFixed(1)}" role="img" aria-label="Elevación">${out.join("")}</svg>`;
}

/** Cotas de armado (ui_portones.dibujar_cotas): si los textos no entran, el primero, el último y un resumen. */
function dibujarCotas(R, s) {
  const alto = 11;                                                  // px del texto
  const out = [];
  for (const c of R.cotas) {
    let [lineas, textos] = P.trazosCota(c, alto / s, R.u, true);
    for (const [a, b, cc, d] of lineas) out.push(`<line x1="${a}" y1="${-b}" x2="${cc}" y2="${-d}" stroke="${COTA}" vector-effect="non-scaling-stroke"/>`);
    if (c.tipo === "ordenada" && c.puntos.length > 2) {
      const dif = c.puntos.slice(1).map((b, i) => b - c.puntos[i]);
      const ancho = Math.max(...textos.map((t) => t[2].length)) * 6.5 + 4;
      if (Math.min(...dif) * s < ancho) {                          // más estricto que la PC: la pantalla es angosta
        const pasos = new Set(dif.map((d) => P.red(d, 1)));
        const resumen = `${c.puntos.length} marcas` + (pasos.size === 1 ? ` · paso ${med(dif[0], 1)}` : "");
        textos = [...textos].sort((p, q) => (c.eje === "V" ? p[1] - q[1] : p[0] - q[0]));
        textos = [textos[0], textos[textos.length - 1]];
        if (c.base !== null && R.u * s >= 2.2 * alto) {
          const mx = (c.puntos[0] + c.puntos[c.puntos.length - 1]) / 2, d = c.lado * 1.3 * alto / s;
          textos.push(c.eje === "H" ? [mx, textos[0][1] + d, resumen, "C", 0] : [textos[0][0] + d, mx, resumen, "C", 90]);
        }
      }
    }
    for (const [tx, ty, txt, al, ang] of textos) {
      const anc = { C: "middle", L: "start", R: "end" }[al];
      const rot = ang ? ` transform="rotate(-90 ${tx} ${-ty})"` : "";
      out.push(`<text x="${tx}" y="${-ty}" font-size="${alto / s}" text-anchor="${anc}" class="p-cota"${rot}>${txt}</text>`);
    }
  }
  return out.join("");
}

function croquisSvg(corte) {
  const pts = P.croquis(corte, 64, 10);
  return `<svg class="p-croquis" viewBox="-1 -11 66 12" width="66" height="12" aria-hidden="true"><polygon points="${ptsSvg(pts)}"/></svg>`;
}

// ------------------------------------------------------------------ formulario
function armarTarjetas() {
  const tarjeta = (clave, k, R) => {
    const bloq = clave === "tipo" && !pro && !P.DEMO_TIPOS.includes(k);
    return `<button type="button" class="p-tarjeta" data-clave="${clave}" data-v="${k}" aria-pressed="false">` +
      `<span class="p-mini">${R ? svgElevacion(R, { anchoPx: 96, altoMax: 60, mini: true }) : ""}</span>` +
      `<span class="p-tnom">${CORTOS[k]}${bloq ? ' <span class="tag">PRO</span>' : ""}</span></button>`;
  };
  // en la DEMO los portones no están registrados: sus miniaturas se arman con las hojas de muestra
  $("#p-tipos").innerHTML = P.TIPOS.map(([k]) => tarjeta("tipo", k, P.miniatura(k, "verticales") || miniDemo(k))).join("");
  $("#p-rellenos").innerHTML = P.RELLENOS.map(([k]) => tarjeta("relleno", k, P.miniatura("reja_ventana", k, 0))).join("");
}

/**
 * Miniatura de un portón en la DEMO (el motor de los portones es PRO): las hojas de muestra de portones.miniatura,
 * cada una dibujada como una reja y corrida a su lugar.
 */
function miniDemo(tipo) {
  const muestra = {
    batiente_1: [[1200, 1800], [[40, 60, 1120, 1740]]],
    batiente_2: [[2400, 1600], [[40, 60, 1140, 1540], [1220, 60, 1140, 1540]]],
    corredizo: [[2400, 1500], [[0, 60, 2550, 1440]]],
  }[tipo];
  if (!muestra) return null;
  const R = { vano: muestra[0], formas: [], cotas: [], u: 1 };
  for (const [x, y, w, h] of muestra[1]) {
    const g = P.generar({ ...P.ITEM_DEF, tipo: "reja_ventana", ancho: w, alto: h, perfil_marco: "m", perfil_relleno: "r", luz_max: 150, n_trav: 1 },
      { m: new P.Perfil("m", "tubo", 60, 60, 2), r: new P.Perfil("r", "tubo", 30, 30, 1.5) });
    for (const [capa, pts] of g.formas) R.formas.push([capa, pts.map(([px, py]) => [px + x, py + y]), null]);
  }
  return R;
}

function armarCampos() {
  for (const k of Object.keys(CAMPOS)) {
    const inp = $(`#p-${k}`);
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => cambioCampo(k, inp));
    inp.addEventListener("change", () => ponerValores());          // al salir: el valor que quedó (o el tope de la DEMO)
  }
}

function cambioCampo(k, inp) {
  const it = est.item, cont = inp.closest(".campo");
  let v;
  try { v = numero(inp.value); } catch { cont.classList.add("mal"); return; }
  const minimo = CAMPOS[k][2];
  if (!(v >= minimo)) { cont.classList.add("mal"); return; }
  cont.classList.remove("mal");
  avisoDemo = "";
  if (!pro && (k === "ancho" || k === "alto")) {
    const tope = P.demoMax(it[k === "ancho" ? "alto" : "ancho"]);
    if (v > tope) {
      v = tope;
      avisoDemo = `En la versión de prueba la reja va hasta ${miles(P.DEMO_LADOS[0])} × ${miles(P.DEMO_LADOS[1])} mm (en cualquier orientación). ` +
        `<button type="button" class="enlace" data-abre-pro="portones">Más grande y portones con la PRO</button>`;
    }
  }
  it[k] = v;
  programar();
}

function ponerValores() {
  const it = est.item;
  for (const k of Object.keys(CAMPOS)) {
    const inp = $(`#p-${k}`);
    if (document.activeElement !== inp) { inp.value = corto(it[k], 2); inp.closest(".campo").classList.remove("mal"); }
  }
  $("#p-cantidad").textContent = it.cantidad;
  $("#p-n_trav").textContent = it.n_trav;
  for (const r of raiz.querySelectorAll('input[name="p-armado"]')) r.checked = r.value === it.armado;
  $("#p-corte").value = est.corte;
  $("#p-sold").value = est.sold;
  $("#p-pint").value = est.pint;
  $("#p-margen").value = est.margen;
  $("#p-cotas").checked = !!est.cotas;
  $("#p-costos").classList.toggle("bloq", !pro);
  opcionesPerfiles();
  habilitar();
}

function opcionesPerfiles() {
  const ps = Object.values(perfiles()).sort((a, b) => P.cmp([a.forma, a.a, a.nombre], [b.forma, b.a, b.nombre]));
  const it = est.item;
  for (const k of ["perfil_marco", "perfil_trav", "perfil_relleno"]) {
    const s = $(`#p-${k}`);
    const ops = ps.map((p) => `<option value="${esc(p.nombre)}">${esc(p.nombre)}</option>`);
    if (k === "perfil_trav") ops.unshift(`<option value="">Igual que el marco</option>`);
    else if (!ps.some((p) => p.nombre === it[k])) ops.unshift(`<option value="">Elegí un perfil</option>`);
    s.innerHTML = ops.join("");
    s.value = ps.some((p) => p.nombre === it[k]) ? it[k] : "";
  }
}

/** Muestra solo los campos que usa el tipo y el relleno elegidos (ui_portones._habilitar). */
function habilitar() {
  const it = est.item, r = it.relleno, t = it.tipo;
  const on = {
    luz_max: P.usaLuz(r), angulo: P.usaAngulo(r), armado: P.usaArmado(r) && it.n_trav > 0, esp_chapa: r === "chapa",
    perfil_relleno: r !== "chapa", perfil_trav: it.n_trav > 0,
    holg_lat: t === "batiente_1" || t === "batiente_2", holg_centro: t === "batiente_2", luz_piso: P.PORTONES.includes(t),
    solape: t === "corredizo",
  };
  for (const [k, v] of Object.entries(on)) raiz.querySelector(`.campo[data-k="${k}"]`).hidden = !v;
  $("#p-holguras").hidden = !P.PORTONES.includes(t);
  $("#p-n_trav-rot").textContent = r === "horizontales" ? "Montantes" : "Travesaños";
  raiz.querySelector('label[for="p-perfil_trav"]').textContent = r === "horizontales" ? "Montantes" : "Travesaños";
  for (const b of raiz.querySelectorAll(".p-tarjeta")) {
    const ok = it[b.dataset.clave] === b.dataset.v;
    b.classList.toggle("elegida", ok);
    b.setAttribute("aria-pressed", String(ok));
  }
}

function armarEventos() {
  raiz.addEventListener("click", (e) => {
    const t = e.target.closest(".p-tarjeta");
    if (t) {
      const { clave, v } = t.dataset;
      if (clave === "tipo" && !pro && !P.DEMO_TIPOS.includes(v)) { abrirPro("portones"); return; }
      est.item[clave] = v;
      if (clave === "tipo" && est.item.nombre === "") est.item.nombre = P.TEXTO[v];
      habilitar();
      programar(0);
      return;
    }
    const b = e.target.closest("[data-paso]");
    if (b) {
      const k = b.dataset.paso, it = est.item;
      it[k] = k === "n_trav" ? Math.max(0, Math.min(P.MAX_TRAV, it[k] + Number(b.dataset.d))) : Math.max(1, it[k] + Number(b.dataset.d));
      $(`#p-${k}`).textContent = it[k];
      habilitar();
      programar(0);
      return;
    }
    if (e.target.closest("#perfil-nuevo")) { nuevoPerfil(); return; }
    const d = $("#hoja-perfiles");
    if (e.target === d) { d.close(); return; }
    const m = e.target.closest("[data-m]");
    if (m && !e.target.closest("#hoja-perfiles")) seleccionar(m.dataset.m);
  });
  for (const k of ["perfil_marco", "perfil_trav", "perfil_relleno"]) {
    $(`#p-${k}`).addEventListener("change", (e) => { est.item[k] = e.target.value; programar(0); });
  }
  for (const r of raiz.querySelectorAll('input[name="p-armado"]')) {
    r.addEventListener("change", () => { if (r.checked) { est.item.armado = r.value; programar(0); } });
  }
  for (const [id, k] of [["p-corte", "corte"], ["p-sold", "sold"], ["p-pint", "pint"], ["p-margen", "margen"]]) {
    const inp = $(`#${id}`);
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => { est[k] = inp.value; programar(k === "corte" ? 300 : 150); });
  }
  $("#p-cotas").addEventListener("change", (e) => { est.cotas = e.target.checked; guardar(); dibujar(); });
  $("#p-ampliar").addEventListener("click", abrirCompleta);
  $("#p-admin").addEventListener("click", abrirPerfiles);
  let ancho = 0;
  observador = new ResizeObserver(() => {
    const d = raiz.querySelector("#p-dibujo");
    if (!d || !d.isConnected) return;
    if (Math.abs(d.clientWidth - ancho) > 8) { ancho = d.clientWidth; dibujar(); }
  });
  observador.observe($("#p-dibujo"));
}

function programar(ms = 300) {
  clearTimeout(reloj);
  reloj = setTimeout(calcular, ms);
}

// ------------------------------------------------------------------ perfiles
function abrirPerfiles() {
  dibujarPerfiles();
  const d = $("#hoja-perfiles");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

function dibujarPerfiles() {
  const ul = $("#perfiles");
  const nombres = est.perfiles.map((m) => m.nombre.trim());
  ul.innerHTML = est.perfiles.map((m, i) => {
    const p = P.perfilDe(m);
    const repetido = nombres.indexOf(m.nombre.trim()) !== i;
    const estado = repetido ? `<span class="perfil-mal">Ese nombre ya está: cambialo.</span>`
      : p ? `${n1(p.kgM())} kg/m${p.pulgadas ? " · pulgadas" : ""}` : `<span class="perfil-mal">No se entienden las medidas.</span>`;
    return `<li class="perfil-ed" data-i="${i}">
      <span class="entrada pe-nombre"><input data-c="nombre" type="text" aria-label="Nombre del perfil" value="${esc(m.nombre)}"></span>
      <button type="button" class="borrar" data-borrar="${i}" aria-label="Sacar ${esc(m.nombre)}">×</button>
      <select data-c="forma" aria-label="Forma">${P.FORMAS.map(([k, t]) => `<option value="${k}"${k === m.forma ? " selected" : ""}>${t}</option>`).join("")}</select>
      <span class="entrada"><input data-c="medidas" type="text" spellcheck="false" aria-label="Medidas" placeholder="40x40x2" value="${esc(m.medidas)}"></span>
      <label class="pe-num"><span>Barra</span><span class="entrada"><input data-c="largo" type="text" inputmode="decimal" value="${corto(m.largo, 1)}"><span class="unidad">mm</span></span></label>
      <label class="pe-num${pro ? "" : " pe-bloq"}"><span>Precio</span><span class="entrada"><input data-c="precio" type="text" inputmode="decimal" placeholder="0" value="${m.precio ? corto(m.precio, 2) : ""}"${pro ? "" : " disabled"}></span></label>
      <span class="pe-estado">${estado}</span></li>`;
  }).join("");
  for (const inp of ul.querySelectorAll("[data-c]")) {
    const i = Number(inp.closest(".perfil-ed").dataset.i), c = inp.dataset.c;
    const ev = inp.tagName === "SELECT" ? "change" : "input";
    inp.addEventListener(ev, () => cambioPerfil(i, c, inp));
    if (c === "nombre") inp.addEventListener("change", () => dibujarPerfiles());
  }
  for (const b of ul.querySelectorAll("[data-borrar]")) {
    b.addEventListener("click", () => { est.perfiles.splice(Number(b.dataset.borrar), 1); dibujarPerfiles(); opcionesPerfiles(); programar(0); });
  }
}

function nuevoPerfil() {
  let n = 1;
  while (est.perfiles.some((m) => m.nombre === `Perfil ${n}`)) n++;
  est.perfiles.push({ nombre: `Perfil ${n}`, forma: "tubo", medidas: "", largo: 6000, precio: 0 });
  dibujarPerfiles();
  const ins = raiz.querySelectorAll('#perfiles [data-c="medidas"]');
  ins[ins.length - 1]?.focus();
}

function cambioPerfil(i, c, inp) {
  const m = est.perfiles[i];
  if (c === "nombre") {
    const viejo = m.nombre, nuevo = inp.value.trim() || "Perfil";
    for (const k of ["perfil_marco", "perfil_trav", "perfil_relleno"]) if (est.item[k] === viejo) est.item[k] = nuevo;
    m.nombre = nuevo;
  } else if (c === "largo" || c === "precio") {
    let v;
    try { v = inp.value.trim() === "" ? 0 : numero(inp.value); } catch { v = NaN; }
    inp.closest(".entrada").classList.toggle("mal", !(v >= 0) || (c === "largo" && !(v > 0)));
    if (!(v >= 0) || (c === "largo" && !(v > 0))) return;
    m[c] = v;
  } else {
    m[c] = inp.value;
  }
  const li = inp.closest(".perfil-ed"), p = P.perfilDe(m);
  if (c !== "nombre") li.querySelector(".pe-estado").innerHTML = p ? `${n1(p.kgM())} kg/m${p.pulgadas ? " · pulgadas" : ""}` : `<span class="perfil-mal">No se entienden las medidas.</span>`;
  opcionesPerfiles();
  programar(250);
}

// ------------------------------------------------------------------ cálculo
function num(txt, vacio) {
  if (String(txt ?? "").trim() === "") return vacio;
  try { const v = numero(txt); return v >= 0 ? v : vacio; } catch { return vacio; }
}

/** Optimizador de barras: el completo si ya está calculado (Worker), si no el rápido y se anota lo que falta. */
function conMemoria(faltan) {
  return (piezas, barra, corte) => {
    const k = JSON.stringify([piezas, barra, corte]);
    if (cache.has(k)) return cache.get(k);
    faltan.push([piezas, barra, corte]);
    return optimizarRapido(piezas, barra, corte);
  };
}

function calcular() {
  guardar();
  const faltan = [];
  const opt = pro ? conMemoria(faltan) : optimizarRapido;
  calc = P.calcular([est.item], perfiles(), num(est.corte, 3), opt);
  if (pro) {
    calc.costos = pro.costear(calc, { soldadura_m: num(est.sold, 0), pintura_m2: num(est.pint, 0) }, num(est.margen, 1) || 1);
  }
  calc.problemas = P.verificar(calc);
  mostrar();
  if (faltan.length) optimizarAparte(faltan);
  else { pedido++; $("#p-opt").hidden = true; }
}

/** Barras con el optimizador completo en un Worker; al volver, se recalcula con esos resultados. */
function optimizarAparte(faltan) {
  const id = ++pedido;
  const listo = (out) => {
    if (id !== pedido) return;
    out.forEach((o, i) => cache.set(JSON.stringify(faltan[i]), o.res || optimizarRapido(...faltan[i])));
    while (cache.size > 64) cache.delete(cache.keys().next().value);
    calcular();
  };
  if (!rutaOpt || typeof Worker === "undefined") {                   // sin Worker: en la misma página
    if (optPro) setTimeout(() => listo(faltan.map((f) => { try { return { res: optPro.optimizar(...f) }; } catch { return {}; } })), 30);
    return;
  }
  if (ocupado && trabajador) { trabajador.terminate(); trabajador = null; }   // lo viejo ya no sirve
  if (!trabajador) {
    try { trabajador = new Worker(new URL("../barras/trabajador.js", import.meta.url), { type: "module" }); } catch { trabajador = null; }
    if (!trabajador) { rutaOpt = null; optimizarAparte(faltan); return; }
    trabajador.onmessage = (e) => {
      ocupado = false;
      if (e.data.fallo) {                                          // no se pudo cargar el optimizador en el Worker
        rutaOpt = null; trabajador.terminate(); trabajador = null;
        if (e.data.id === pedido) calcular();
        return;
      }
      if (e.data.id === pedido && alVolver) alVolver(e.data.out);
    };
    trabajador.onerror = () => { ocupado = false; rutaOpt = null; trabajador?.terminate(); trabajador = null; calcular(); };
  }
  alVolver = listo;
  ocupado = true;
  $("#p-opt").hidden = false;
  trabajador.postMessage({ id, ruta: rutaOpt, pedidos: faltan });
}

// ------------------------------------------------------------------ resultado
function seleccionar(m) {
  sel = sel === m ? null : m;
  dibujar();
  marcarLista();
  if (completa) dibujarCompleta();
}

function mostrar() {
  const c = calc, R = c.resultados[0];
  if (sel && !c.filas.some((f) => f.marca === sel)) sel = null;
  const demo = $("#p-demo");
  demo.innerHTML = avisoDemo;
  demo.hidden = !avisoDemo;
  const err = $("#p-error");
  err.textContent = c.errores.join(" ");
  err.hidden = !c.errores.length;
  $("#p-resultado").hidden = !R;
  if (!R) { $("#p-opt").hidden = true; return; }
  const marcas = c.filas.length, perfs = c.grupos.length;
  $("#p-resumen").innerHTML =
    `<div class="dato"><span class="dato-v">${c.piezas}</span><span class="dato-r">piezas, ${marcas} ${marcas === 1 ? "marca" : "marcas"}</span></div>` +
    `<div class="dato"><span class="dato-v">${c.n_barras}</span><span class="dato-r">${c.n_barras === 1 ? "barra" : "barras"}, ${perfs} ${perfs === 1 ? "perfil" : "perfiles"}</span></div>` +
    `<div class="dato"><span class="dato-v">${n1(c.kg_neto)}</span><span class="dato-r">kg (comprar ${n1(c.kg_compra)})</span></div>`;
  const luces = [...new Set(R.luces.map((v) => P.red(v, 1)))].sort((a, b) => a - b);
  $("#p-luz").textContent = luces.length ? `Luz real: ${luces.map((v) => corto(v, 4)).join(" / ")} mm` : "";
  const av = $("#p-avisos");
  const avisos = [...c.avisos];
  av.textContent = avisos.map((a) => `⚠ ${a}`).join(" ");
  av.hidden = !avisos.length;
  dibujar();
  lista();
  barras();
  datos();
  costo();
}

function dibujar() {
  if (!calc || !calc.resultados[0]) return;
  const cont = $("#p-dibujo");
  const w = Math.max(cont.clientWidth, 240);
  cont.innerHTML = svgElevacion(calc.resultados[0], {
    anchoPx: w, altoMax: Math.max(300, Math.min(window.innerHeight * 0.62, 640)), marcas: calc.marcas, seleccion: sel, cotas: !!est.cotas,
  });
}

function lista() {
  const c = calc;
  $("#p-lista").innerHTML = c.filas.map((f) => `<li data-m="${f.marca}">
    <span class="p-chip" style="background:${f.color}">${f.marca}</span>
    <span class="p-largo">${med(f.largo, 1)} <small>mm</small></span><span class="p-cant">× ${f.cant}</span>
    <span class="p-det">${esc(f.perfil.nombre)} · ${P.textoCorte(f.corte)}</span>${croquisSvg(f.corte)}
    <span class="p-uso">${[...f.usos].sort().join(", ")}</span></li>`).join("");
  marcarLista();
}

function marcarLista() {
  for (const li of raiz.querySelectorAll("#p-lista li")) li.classList.toggle("sel", li.dataset.m === sel);
}

function barras() {
  const c = calc, col = new Map(c.filas.map((f) => [f.marca, f.color]));
  $("#p-barras").innerHTML = c.grupos.map((g) => {
    const L = g.perfil.largo;
    const pct = (v) => `${((v / L) * 100).toFixed(3)}%`;
    const pats = g.patrones.map((p) => {
      const seg = p.piezas.map(([l, m], k) => {
        const ancho = (l / L) * 100;
        const gap = k < p.piezas.length - 1 ? `margin-right:${pct(c.corte)};` : "";
        const txt = ancho > 14 ? `${m} ${med(l)}` : ancho > 4 ? m : "";
        return `<span class="seg${ancho > 14 ? "" : " chico"}" style="width:${ancho.toFixed(3)}%;${gap}background:${col.get(m)}" data-m="${m}">${txt}</span>`;
      }).join("");
      const ps = (p.sobrante / L) * 100;
      const txt = ps > 20 ? `sobra ${med(p.sobrante, 0)}` : ps > 8 ? med(p.sobrante, 0) : "";
      const sob = p.sobrante > 0.5 ? `<span class="seg sobra" style="flex:1">${txt}</span>` : "";
      return `<div class="barra-fila"><span class="barra-n">×${p.n}</span><div class="barra" role="img" aria-label="${p.n} ${p.n === 1 ? "barra" : "barras"}: ${p.piezas.map(([l, m]) => `${m} ${med(l)}`).join(" + ")}">${seg}${sob}</div></div>`;
    }).join("");
    const largas = g.largas.map((f) => `<p class="nota p-aviso">⚠ Marca ${f.marca}: ${f.cant} × ${med(f.largo)} mm no entra en la barra (requiere empalme).</p>`).join("");
    return `<div class="p-grupo"><h3 class="p-perfil">${esc(g.perfil.nombre)}<span>${g.n_barras} ${g.n_barras === 1 ? "barra" : "barras"} de ${med(L)} mm` +
      (g.n_barras ? ` · ${n1(g.aprovechamiento * 100)} % aprovechado` : "") + `</span></h3>${pats}${largas}</div>`;
  }).join("") + (pro ? "" : `<p class="nota">Barras con el cálculo rápido. <button type="button" class="enlace" data-abre-pro="portones">La PRO usa el optimizador completo</button>.</p>`);
}

function datos() {
  const c = calc, ln = [];
  ln.push(`Peso de las piezas: <b>${n1(c.kg_neto)} kg</b> · acero a comprar (barras enteras): <b>${n1(c.kg_compra)} kg</b>` +
    (c.kg_chapa ? ` · chapa ${n1(c.kg_chapa)} kg` : ""));
  ln.push(`Soldadura estimada: <b>${n1(c.sold_m)} m</b> · superficie a pintar: <b>${miles(c.pint_m2, 2)} m²</b>`);
  if (c.herrajes.length) ln.push(`Herrajes (no van en el precio): ${c.herrajes.map(([n, v]) => `${n}: ${corto(v, 4)}`).join(", ")}`);
  ln.push(c.problemas.length ? `⚠ Control: ${esc(c.problemas.slice(0, 3).join("; "))}`
    : "✓ Control: piezas dibujadas = lista de corte y barras = piezas pedidas.");
  $("#p-datos").innerHTML = ln.map((t) => `<p>${t}</p>`).join("");
}

function costo() {
  const cont = $("#p-costo"), k = calc.costos;
  cont.innerHTML = "";
  if (!k) return;
  const d2 = (v) => miles(v, 2);
  const filas = [["Acero", k.acero], ["Soldadura", k.soldadura], ["Pintura", k.pintura]];
  cont.innerHTML = `<h2 class="sub">Costo y precio</h2><table class="tabla"><tbody>` +
    filas.map(([n, v]) => `<tr><td>${n}</td><td>${d2(v)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td>Costo</td><td>${d2(k.costo)}</td></tr><tr><td>Precio (× ${corto(k.margen, 4)})</td><td>${d2(k.precio)}</td></tr></tfoot></table>` +
    (k.sin_precio.length ? `<p class="nota">Sin precio de barra: ${esc(k.sin_precio.join(", "))} (cargalo en «Editar perfiles»).</p>` : "") +
    (calc.m2_chapa ? `<p class="nota">La chapa ciega no tiene precio en este cálculo (se pesa, no se costea).</p>` : "");
}

// ------------------------------------------------------------------ pantalla completa (se mueve con el dedo, nativo)
function abrirCompleta() {
  if (completa) return;
  zoom = 1;
  completa = document.createElement("div");
  completa.className = "p-completa";
  completa.innerHTML = `<div class="p-completa-barra">
      <button type="button" data-z="-1" aria-label="Alejar">−</button><button type="button" data-z="1" aria-label="Acercar">+</button>
      <label class="tilde tilde-chica"><input type="checkbox" class="p-c-cotas"${est.cotas ? " checked" : ""}> Cotas</label>
      <button type="button" class="p-c-cerrar">Cerrar</button></div>
    <div class="p-completa-dib"></div>`;
  document.body.append(completa);
  document.body.classList.add("sin-scroll");
  completa.addEventListener("click", (e) => {
    const z = e.target.closest("[data-z]");
    if (z) { zoom = Math.max(1, Math.min(6, zoom * (z.dataset.z === "1" ? 1.6 : 1 / 1.6))); dibujarCompleta(); return; }
    if (e.target.closest(".p-c-cerrar")) { cerrarCompleta(); return; }
    const m = e.target.closest("[data-m]");
    if (m) seleccionar(m.dataset.m);
  });
  completa.querySelector(".p-c-cotas").addEventListener("change", (e) => { est.cotas = e.target.checked; $("#p-cotas").checked = est.cotas; guardar(); dibujar(); dibujarCompleta(); });
  completa.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarCompleta(); });
  dibujarCompleta();
  completa.querySelector(".p-c-cerrar").focus();
}

function dibujarCompleta() {
  if (!completa || !calc?.resultados[0]) return;
  const cont = completa.querySelector(".p-completa-dib");
  const w = cont.clientWidth, h = cont.clientHeight;
  const fx = cont.scrollLeft / Math.max(cont.scrollWidth, 1), fy = cont.scrollTop / Math.max(cont.scrollHeight, 1);
  cont.innerHTML = svgElevacion(calc.resultados[0], {
    anchoPx: w * zoom, altoMax: h * zoom, marcas: calc.marcas, seleccion: sel, cotas: !!est.cotas,
  });
  cont.scrollLeft = fx * cont.scrollWidth;
  cont.scrollTop = fy * cont.scrollHeight;
}

function cerrarCompleta() {
  if (!completa) return;
  completa.remove();
  completa = null;
  document.body.classList.remove("sin-scroll");
}
