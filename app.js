// optiMAX PWA (Fase 1, solo DEMO): elegir figura, cargar medidas y ver la plantilla con sus cotas.
// Exportar DXF e imprimir a escala son PRO: abren la hoja de compra (WhatsApp).
import { FIGURAS, valoresDefecto, leer } from "./geo/index.js";
import { leerNum, corto } from "./geo/base.js";
import { medidas } from "./geo/medidas.js";
import { Vista } from "./vista.js";

const WHATSAPP = "59177626675";
const CLAVE_MEMORIA = "optimax-pwa";
const ESPESOR_DEF = "2";

// nombres cortos para la tira de figuras (el título usa el nombre completo del escritorio)
const CORTOS = {
  t_cil_cil: "T de caño",
  codo_sectores: "Codo por gajos",
  tronco_cono: "Cono / reducción",
  tronco_piramide: "Fondo de tolva",
};

// figuras de la PRO del escritorio que todavía no están en la PWA (vidriera de la hoja de compra)
const PRO = [
  ["t_rect_cil", "T ramal rectangular sobre caño"],
  ["t_cil_rect", "T ramal redondo sobre caja"],
  ["codo_rect", "Curva rectangular"],
  ["curva_directa_90", "Curva directa 90°"],
  ["curva_directa", "Curva directa"],
  ["desvio_paralelo", "Desvío circular paralelo"],
  ["transicion_rect_red", "Transición rectangular a redondo"],
  ["helicoide", "Helicoide (hélice de sinfín)"],
];

const MOTIVOS = {
  dxf: "Exportar el DXF para la mesa de corte es de la versión PRO.",
  imprimir: "Imprimir la plantilla a escala, para trazar sobre la chapa, es de la versión PRO.",
  figura: "Estas figuras son de la versión PRO.",
  "": "Exportar el DXF para la mesa de corte e imprimir la plantilla a escala son de la versión PRO.",
};

const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ memoria (por navegador; puede no estar)
function cargarMemoria() {
  try { return JSON.parse(localStorage.getItem(CLAVE_MEMORIA)) || {}; } catch { return {}; }
}
function guardarMemoria() {
  try { localStorage.setItem(CLAVE_MEMORIA, JSON.stringify(memoria)); } catch { /* sin almacenamiento */ }
}
const memoria = cargarMemoria();
memoria.valores ??= {};

// ------------------------------------------------------------------ estado
let fig = FIGURAS.find((g) => g.id === memoria.figura) || FIGURAS[0];
let crudo = {};
let espesor = memoria.espesor ?? ESPESOR_DEF;
const vista = new Vista($("#vista"));

// ------------------------------------------------------------------ tira de figuras
function armarFiguras() {
  const nav = $("#figuras");
  nav.innerHTML = "";
  for (const g of FIGURAS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fig";
    b.dataset.id = g.id;
    b.innerHTML = `<img src="img/fig/${g.id}.webp" alt="" width="120" height="90"><span>${CORTOS[g.id] || g.nombre}</span>`;
    b.addEventListener("click", () => elegir(g));
    nav.append(b);
  }
  const mas = document.createElement("button");
  mas.type = "button";
  mas.className = "fig fig-pro";
  mas.innerHTML = `<span class="mas-n">+${PRO.length}</span><span>figuras en la PRO</span>`;
  mas.addEventListener("click", () => abrirPro("figura"));
  nav.append(mas);
}

function marcarFigura() {
  for (const b of document.querySelectorAll(".fig[data-id]")) {
    const sel = b.dataset.id === fig.id;
    b.classList.toggle("elegida", sel);
    b.setAttribute("aria-pressed", sel);
    if (sel) b.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
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

let reloj = null;
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
  // el campo que nombra el mensaje («Ø exterior ramal: mínimo 5.»)
  const p = fig.params.find((q) => msg.startsWith(`${q.etiqueta}:`));
  if (p) marcarError(p.clave);
  else if (/espesor/i.test(msg)) marcarError("_espesor");
}

function marcarError(clave) {
  for (const f of document.querySelectorAll(".campo")) {
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
  calcular({ ajustar: true });
}

// ------------------------------------------------------------------ PRO
function abrirPro(motivo = "") {
  $("#pro-motivo").textContent = MOTIVOS[motivo] ?? MOTIVOS[""];
  const txt = `Hola, probé optiMAX en el celular (${CORTOS[fig.id] || fig.nombre}) y quiero la versión PRO.`;
  $("#btn-whatsapp").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  const d = $("#hoja-pro");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

function armarPro() {
  const ul = $("#pro-figuras");
  ul.innerHTML = PRO.map(([id, nom]) =>
    `<li><img src="img/fig/${id}.webp" alt="" width="120" height="90" loading="lazy"><span>${nom}</span></li>`).join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abre-pro]");
    if (b) abrirPro(b.dataset.abrePro);
  });
  const d = $("#hoja-pro");
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // tocar afuera cierra
}

// ------------------------------------------------------------------ instalar
function armarInstalacion() {
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (esIOS && !instalada && !memoria.iosVisto) $("#aviso-ios").hidden = false;
  $("#cerrar-ios").addEventListener("click", () => {
    $("#aviso-ios").hidden = true;
    memoria.iosVisto = true;
    guardarMemoria();
  });
  let aviso = null;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e;
    $("#btn-instalar").hidden = false;
  });
  $("#btn-instalar").addEventListener("click", async () => {
    if (!aviso) return;
    aviso.prompt();
    await aviso.userChoice;
    aviso = null;
    $("#btn-instalar").hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin conexión offline, igual anda */ });
  }
}

// ------------------------------------------------------------------ arranque
$("#z-mas").addEventListener("click", () => vista.acercar(1.4));
$("#z-menos").addEventListener("click", () => vista.acercar(1 / 1.4));
$("#z-ajustar").addEventListener("click", () => vista.ajustar());

// ------------------------------------------------------------------ plancha a pantalla completa
// En la página, la plancha no toma el dedo (se baja por la página como siempre). Para ver de cerca: tocarla o
// «Ampliar» → pantalla completa, donde un dedo mueve y dos dedos acercan. «Cerrar», Esc o el botón atrás de
// Android vuelven.
function abrirCompleta() {
  const pl = $(".plancha");
  if (pl.classList.contains("completa")) return;
  pl.classList.add("completa");
  document.body.classList.add("sin-scroll");
  vista.modoCompleto(true);
  history.pushState({ completa: true }, "");
  $("#z-cerrar").focus({ preventScroll: true });
}
function cerrarCompleta(desdeHistorial = false) {
  const pl = $(".plancha");
  if (!pl.classList.contains("completa")) return;
  pl.classList.remove("completa");
  document.body.classList.remove("sin-scroll");
  vista.modoCompleto(false);
  if (!desdeHistorial && history.state?.completa) history.back();
}
vista.alTocar = abrirCompleta;
$("#z-ampliar").addEventListener("click", abrirCompleta);
$("#z-cerrar").addEventListener("click", () => cerrarCompleta());
addEventListener("popstate", () => cerrarCompleta(true));
addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarCompleta(); });
$("#form").addEventListener("submit", (e) => e.preventDefault());

armarFiguras();
armarPro();
marcarFigura();
armarFormulario();
calcular({ ajustar: true });
armarInstalacion();
