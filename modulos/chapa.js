// Módulo Chapa: elegir figura, cargar medidas y ver la plantilla con sus cotas.
// DEMO: las 4 figuras de geo/ (solo ver). PRO: las demás figuras (código en el repo privado, licencia.js) e
// imprimir a escala.
import { FIGURAS as DEMO, valoresDefecto, leer } from "../geo/index.js";
import { leerNum, corto } from "../geo/base.js";
import { medidas } from "../geo/medidas.js";
import { Vista } from "../vista.js";
import { esPro, cargarPro } from "../licencia.js";
import { ponerContexto, abrirPro } from "../hoja-pro.js";

const CLAVE_MEMORIA = "optimax-pwa";
const ESPESOR_DEF = "2";

// catálogo: todas las figuras (las PRO solo con nombre e imagen; su geometría llega con la licencia)
const CATALOGO = [
  ["t_cil_cil", "T de caño"],
  ["codo_sectores", "Codo por gajos"],
  ["tronco_cono", "Cono / reducción"],
  ["tronco_piramide", "Fondo de tolva"],
  ["t_rect_cil", "T ramal rectangular sobre caño"],
  ["t_cil_rect", "T ramal redondo sobre caja"],
  ["codo_rect", "Curva rectangular"],
  ["curva_directa_90", "Curva directa 90°"],
  ["curva_directa", "Curva directa"],
  ["desvio_paralelo", "Desvío circular paralelo"],
  ["transicion_rect_red", "Transición rectangular a redondo"],
  ["helicoide", "Helicoide (hélice de sinfín)"],
].map(([id, corto]) => ({ id, corto }));

const $ = (s, r = document) => r.querySelector(s);

// ------------------------------------------------------------------ memoria (por navegador; puede no estar)
function cargarMemoria() {
  try { return JSON.parse(localStorage.getItem(CLAVE_MEMORIA)) || {}; } catch { return {}; }
}

let raiz, vista, memoria, figs, fig, crudo, espesor, reloj;
let limpiar = [];

export async function montar(cont) {
  raiz = cont;
  memoria = cargarMemoria();
  memoria.valores ??= {};
  // figuras disponibles: las DEMO + las PRO si hay licencia
  figs = new Map(DEMO.map((g) => [g.id, g]));
  const pro = await cargarPro("chapa/figuras.js");
  for (const g of pro?.FIGURAS || []) figs.set(g.id, g);
  fig = figs.get(memoria.figura) || DEMO[0];
  espesor = memoria.espesor ?? ESPESOR_DEF;

  cont.innerHTML = PLANTILLA;
  vista = new Vista($("#vista", cont));
  armarSelector();
  armarFormulario();
  armarPlancha();
  ponerContexto(fig.nombre, figurasProHTML());
  calcular({ ajustar: true });
}

export function desmontar() {
  cerrarCompleta(true);
  clearTimeout(reloj);
  limpiar.forEach((f) => f());
  limpiar = [];
  $("#hoja-figuras")?.close?.();
}

function guardarMemoria() {
  try { localStorage.setItem(CLAVE_MEMORIA, JSON.stringify(memoria)); } catch { /* sin almacenamiento */ }
}

const PLANTILLA = `
<div class="app">
  <section class="col-form" aria-label="Figura y medidas">
    <div class="figuras">
      <button type="button" class="fig-actual" id="fig-actual" aria-haspopup="dialog">
        <img id="fig-img" alt="" width="120" height="90">
        <span class="fig-actual-txt"><span class="fig-actual-nom" id="fig-nom"></span><span class="fig-cambiar">Cambiar figura</span></span>
      </button>
    </div>
    <div class="medidas">
      <h1 class="titulo-figura" id="titulo-figura"></h1>
      <form id="form" autocomplete="off" novalidate></form>
    </div>
  </section>

  <section class="col-vista" aria-label="Plantilla">
    <div class="plancha">
      <svg id="vista" role="img" aria-label="Desarrollo de la pieza con sus medidas"></svg>
      <div class="error" id="error" role="alert" hidden></div>
      <div class="zoom" role="group" aria-label="Zoom">
        <button type="button" id="z-mas" class="z-fino" aria-label="Acercar">+</button>
        <button type="button" id="z-menos" class="z-fino" aria-label="Alejar">−</button>
        <button type="button" id="z-ajustar" class="z-fino" aria-label="Ver todo">⤢</button>
        <button type="button" id="z-ampliar" class="z-ampliar">Ampliar</button>
      </div>
      <button type="button" id="z-cerrar" class="z-cerrar">Cerrar</button>
      <p class="unidades">Medidas en mm</p>
    </div>

    <ul class="chapas" id="chapas" aria-live="polite"></ul>

    <div class="acciones">
      <button type="button" class="btn-bloq" data-abre-pro="imprimir"><span class="candado" aria-hidden="true"></span>Imprimir a escala <span class="tag">PRO</span></button>
    </div>

    <p class="verificar">Verificá todas las medidas antes de cortar o fabricar.</p>
  </section>
</div>

<dialog class="hoja-pro hoja-figuras" id="hoja-figuras" aria-labelledby="figs-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="figs-tit">Elegí la figura</h2>
    <ul class="grilla-figs" id="grilla-figs"></ul>
  </form>
</dialog>`;

// ------------------------------------------------------------------ selector de figura
function armarSelector() {
  const pro = esPro();
  $("#grilla-figs").innerHTML = CATALOGO.map((c) => {
    const libre = figs.has(c.id);
    return `<li><button type="button" class="fig${libre ? "" : " fig-bloq"}" data-id="${c.id}">
      <img src="img/fig/${c.id}.webp" alt="" width="120" height="90" loading="lazy">
      <span>${c.corto}</span>${libre ? "" : `<span class="tag">PRO</span>`}</button></li>`;
  }).join("");
  $("#grilla-figs").addEventListener("click", (e) => {
    const b = e.target.closest(".fig");
    if (!b) return;
    const g = figs.get(b.dataset.id);
    if (!g) {
      $("#hoja-figuras").close();
      if (!pro) abrirPro("figura");         // figura PRO sin licencia: hoja de compra
      return;                               // con licencia: figura que todavía no está portada (desarrollo)
    }
    $("#hoja-figuras").close();
    elegir(g);
  });
  $("#fig-actual").addEventListener("click", () => {
    marcarFigura();
    const d = $("#hoja-figuras");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  });
  $("#hoja-figuras").addEventListener("click", (e) => { if (e.target.id === "hoja-figuras") e.target.close(); });
  marcarFigura();
}

function nombreCorto(id) {
  return CATALOGO.find((c) => c.id === id)?.corto || fig.nombre;
}

function marcarFigura() {
  $("#fig-img").src = `img/fig/${fig.id}.webp`;
  $("#fig-nom").textContent = nombreCorto(fig.id);
  for (const b of raiz.querySelectorAll(".grilla-figs .fig")) {
    const sel = b.dataset.id === fig.id;
    b.classList.toggle("elegida", sel);
    b.setAttribute("aria-pressed", sel);
  }
}

function figurasProHTML() {
  const pro = CATALOGO.filter((c) => !figs.has(c.id));
  if (!pro.length) return "";
  return `<p class="pro-figuras-tit">La PRO tiene además estas figuras:</p><ul class="pro-figuras">` +
    pro.map((c) => `<li><img src="img/fig/${c.id}.webp" alt="" width="120" height="90" loading="lazy"><span>${c.corto}</span></li>`).join("") +
    "</ul>";
}

// ------------------------------------------------------------------ formulario
function armarFormulario() {
  $("#titulo-figura").textContent = fig.nombre;
  crudo = { ...valoresDefecto(fig), ...(memoria.valores[fig.id] || {}) };
  const form = $("#form");
  form.innerHTML = "";
  for (const p of fig.params) form.append(campo(p));
  const esp = campo({ clave: "_espesor", etiqueta: "Espesor de la chapa", unidad: "mm", tipo: "float" }, espesor);
  esp.classList.add("campo-espesor");
  form.append(esp);
  form.addEventListener("submit", (e) => e.preventDefault());
}

function campo(p, valor = crudo[p.clave]) {
  const fila = document.createElement("div");
  fila.className = "campo";
  fila.dataset.clave = p.clave;
  const id = `c-${p.clave}`;
  if (p.tipo === "opcion") {
    fila.classList.add("campo-opcion");
    fila.setAttribute("role", "radiogroup");
    fila.setAttribute("aria-labelledby", `${id}-r`);
    fila.innerHTML = `<span class="rotulo" id="${id}-r">${p.etiqueta}</span><span class="segmentos"></span>`;
    const seg = fila.querySelector(".segmentos");
    for (const op of p.opciones) {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="radio" name="${p.clave}" value="${op}"${op === valor ? " checked" : ""}><span>${op}</span>`;
      lab.querySelector("input").addEventListener("change", () => cambiar(p.clave, op));
      seg.append(lab);
    }
    return fila;
  }
  const unidad = p.unidad ? `<span class="unidad">${p.unidad}</span>` : "";
  fila.innerHTML = `<label class="rotulo" for="${id}">${p.etiqueta}</label>` +
    `<span class="entrada"><input id="${id}" type="text" inputmode="${p.tipo === "int" ? "numeric" : "decimal"}" ` +
    `enterkeyhint="next" spellcheck="false">${unidad}</span>`;
  const inp = fila.querySelector("input");
  inp.value = String(valor).replace(".", ",");
  inp.addEventListener("input", () => cambiar(p.clave, inp.value));
  inp.addEventListener("focus", () => inp.select());
  return fila;
}

function cambiar(clave, valor) {
  if (clave === "_espesor") espesor = valor; else crudo[clave] = valor;
  clearTimeout(reloj);
  reloj = setTimeout(calcular, 220);
}

// ------------------------------------------------------------------ cálculo
function calcular({ ajustar = false } = {}) {
  marcarError(null);
  let piezas, t;
  try {
    const v = leer(fig, crudo);
    try { t = leerNum(espesor); } catch { throw new Error("Espesor de la chapa: valor inválido."); }
    if (!(t > 0)) throw new Error("El espesor debe ser mayor que 0.");
    piezas = fig.generar(v, t);
  } catch (e) {
    mostrarError(e.message);
    return;
  }
  memoria.figura = fig.id;
  memoria.valores[fig.id] = { ...crudo };
  memoria.espesor = espesor;
  guardarMemoria();
  $("#error").hidden = true;
  $(".plancha").classList.remove("con-error");
  vista.mostrar(piezas, { ajustar });
  listar(piezas, t);
}

function mostrarError(msg) {
  const el = $("#error");
  // los mensajes vienen tal cual del escritorio («mayor que 50.0 mm»): en pantalla, con coma decimal
  el.textContent = msg.replace(/(\d)\.(\d)/g, "$1,$2");
  $("#chapas").innerHTML = "";
  $("#chapas").dataset.nota = "";
  el.hidden = false;
  $(".plancha").classList.add("con-error");
  const p = fig.params.find((q) => msg.startsWith(`${q.etiqueta}:`));     // el campo que nombra el mensaje
  if (p) marcarError(p.clave);
  else if (/espesor/i.test(msg)) marcarError("_espesor");
}

function marcarError(clave) {
  for (const f of raiz.querySelectorAll(".campo")) {
    const mal = f.dataset.clave === clave;
    f.classList.toggle("mal", mal);
    f.querySelector("input:not([type=radio])")?.setAttribute("aria-invalid", mal);
  }
}

function listar(piezas, t) {
  const ul = $("#chapas");
  ul.innerHTML = "";
  let total = 0, chapas = 0;
  for (const p of piezas) {
    const m = medidas(p, t);
    total += m.peso * p.cantidad;
    chapas += p.cantidad;
    const li = document.createElement("li");
    li.innerHTML = `<span class="ch-nom">${p.nombre}</span><span class="ch-cant">×${p.cantidad}</span>` +
      `<span class="ch-med">${corto(m.ancho, 1)} × ${corto(m.alto, 1)} mm</span>` +
      `<span class="ch-peso">${corto(m.peso, 2)} kg</span>`;
    ul.append(li);
  }
  if (chapas > 1) {
    const li = document.createElement("li");
    li.className = "ch-total";
    li.innerHTML = `<span class="ch-nom">${chapas} chapas</span><span class="ch-peso">${corto(total, 2)} kg</span>`;
    ul.append(li);
  }
  ul.dataset.nota = `Peso aproximado en acero (7,85 kg/dm³), espesor ${corto(t, 2)} mm.`;
}

function elegir(g) {
  if (g === fig) return;
  fig = g;
  marcarFigura();
  armarFormulario();
  ponerContexto(fig.nombre, figurasProHTML());
  calcular({ ajustar: true });
}

// ------------------------------------------------------------------ plancha: zoom y pantalla completa
// En la página, la plancha no toma el dedo (se baja por la página como siempre). Para ver de cerca: tocarla o
// «Ampliar» → pantalla completa, donde un dedo mueve y dos dedos acercan. «Cerrar», Esc o atrás vuelven.
function armarPlancha() {
  $("#z-mas").addEventListener("click", () => vista.acercar(1.4));
  $("#z-menos").addEventListener("click", () => vista.acercar(1 / 1.4));
  $("#z-ajustar").addEventListener("click", () => vista.ajustar());
  vista.alTocar = abrirCompleta;
  $("#z-ampliar").addEventListener("click", abrirCompleta);
  $("#z-cerrar").addEventListener("click", () => cerrarCompleta());
  const pop = () => cerrarCompleta(true);
  const esc = (e) => { if (e.key === "Escape") cerrarCompleta(); };
  addEventListener("popstate", pop);
  addEventListener("keydown", esc);
  limpiar.push(() => removeEventListener("popstate", pop), () => removeEventListener("keydown", esc));
}

function abrirCompleta() {
  const pl = $(".plancha");
  if (!pl || pl.classList.contains("completa")) return;
  pl.classList.add("completa");
  document.body.classList.add("sin-scroll");
  vista.modoCompleto(true);
  history.pushState({ completa: true }, "");
  $("#z-cerrar").focus({ preventScroll: true });
}

function cerrarCompleta(desdeHistorial = false) {
  const pl = raiz && $(".plancha");
  if (!pl || !pl.classList.contains("completa")) return;
  pl.classList.remove("completa");
  document.body.classList.remove("sin-scroll");
  vista.modoCompleto(false);
  if (!desdeHistorial && history.state?.completa) history.back();
}
