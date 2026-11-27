// Módulo Rejas y portones (herrería): elevación con marcas, lista de corte de cada perfil, barras a comprar, peso,
// soldadura y pintura. Port de ui_portones.py del escritorio, con un solo trabajo (con cantidad).
// DEMO: solo reja de ventana hasta 1500 × 1000 (en cualquier orientación), barras con el cálculo rápido, sin costos.
// PRO (repo privado): los portones (batiente 1 y 2 hojas, corredizo), barras con el optimizador completo (en un
// Worker, para no trabar la pantalla) y los costos.
import * as P from "../portones/motor.js";
import * as M from "../portones/modelos.js";
import { optimizarRapido, numero, med, miles } from "../barras/motor.js";
import { corto } from "../geo/base.js";
import { cargarPro, urlPro } from "../licencia.js";
import { ponerContexto, abrirPro, PRECIO } from "../hoja-pro.js";
import { abrirSalida, activarBoton, cerrarSalida } from "../salida.js";
import { armarTrabajos } from "../trabajos.js";
import { abrir3D, cerrar3D } from "./portones3d.js";

const CLAVE = "optimax-portones";
// topes de los botones − / + (los demás: desde 1)
const PASOS = { n_trav: [0, P.MAX_TRAV], n_franja: [0, P.MAX_FRANJA], n_panos: [1, P.MAX_PANOS] };
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
  franja: ["Franja libre entre los travesaños", "mm", 1],
  holg_lat: ["Holgura a los costados", "mm", 0], holg_centro: ["Holgura entre hojas", "mm", 0],
  luz_piso: ["Luz al piso", "mm", 0], solape: ["Solape del corredizo", "mm", 0],
  // reja de ventana (25-nov, Max): ancho / alto son el hueco; sobrepuesta si sobresale, si no, adentro con holgura
  sob_lat: ["Sobresale a los costados (cada lado)", "mm", 0], sob_arr: ["Sobresale arriba", "mm", 0],
  sob_abj: ["Sobresale abajo", "mm", 0], holg_hueco: ["Holgura en el hueco (cada lado)", "mm", 0],
};

const $ = (s) => raiz.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = (v) => miles(v, 1, true);
let raiz, est, observador = null, salidaPdf = null, pro = false, optPro = null, rutaOpt = null, reloj, calc = null, sel = null, avisoDemo = "";
let trabajos = null;
let trabajador = null, ocupado = false, pedido = 0, alVolver = null, completa = null, zoom = 1;
const cache = new Map();                 // resultados del optimizador completo (como portones._MEMO)

function cargarMemoria() {
  let m;
  try { m = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { m = {}; }
  const out = { ...INICIAL, ...m };
  out.item = P.normalizarItem({ ...ITEM_INICIAL, ...(m.item || {}) });
  if (!Array.isArray(out.perfiles)) out.perfiles = PERFILES_EJEMPLO;
  out.perfiles = out.perfiles.map((p) => ({ ...p }));
  renombrar(out);                                         // nombres de antes (a mano) → forma + medidas
  return out;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch { /* sin almacenamiento */ }
  trabajos?.cambio();
}
const perfiles = () => P.perfilesDe(est.perfiles.filter((m, i) => !repetido(est.perfiles, i)));

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
  trabajos = armarTrabajos(raiz.querySelector(".b-datos"), {
    modulo: "portones", tipo: "portones", nesting: true, datos: datosTrabajo, cargar: cargarTrabajo,
    nuevo: nuevoTrabajo, sugerido: () => est.item.nombre || P.TEXTO[est.item.tipo] || "Portón",
  });
  acomodarVista();
  ANGOSTA.addEventListener("change", acomodarVista);
  armarGaleria();
  calcular();
  if (salidaPdf) activarBoton($("#p-pdf"), "Imprimir o guardar en PDF", guardarPdf);
  if (!est.item.modelo) mostrarGaleria();              // sin modelo elegido (primera vez o «Nuevo»): la galería
}

// Celular y tablet (26-nov, Max, propuesta G): el dibujo arriba ocupa lo que queda de la pantalla y las opciones van en
// una hoja que sube desde abajo, con una barra fija de 5 botones (Tipo · Medidas · Perfiles · Relleno · Lista) que lleva
// a cada parte de la hoja (se puede deslizar entre todas). La hoja empieza cerrada (26-nov, Max: el dibujo grande de
// entrada); la × o tocar otra vez el botón de la parte que se ve la cierra (el dibujo crece). En la PC (≥ 900 px) queda como siempre: formulario | resultado.
const ANGOSTA = matchMedia("(max-width: 899px)");
const SECCIONES = [
  ["tipo", "Tipo", '<path d="M3 5h18v14H3ZM12 5v14"/>'],
  ["medidas", "Medidas", '<path d="M3 17h18M3 17v-3M21 17v-3M7 17v-2M12 17v-3M17 17v-2"/>'],
  ["perfiles", "Perfiles", '<path d="M5 5h14v14H5Z"/><path d="M8 8h8v8H8Z"/>'],
  ["relleno", "Relleno", '<path d="M4 4h16v16H4ZM9 4v16M14 4v16"/>'],
  ["lista", "Lista", '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'],
];
let movidos = null, hojaAbierta = true, sinEspiar = 0, reloj2 = null;
const mover = (n, destino) => { if (n) destino.append(n); };
function acomodarVista() {
  if (!$(".p-elev")) return;
  const armada = !!$("#p-hoja");
  if (ANGOSTA.matches && !armada) armarHoja();
  else if (!ANGOSTA.matches && armada) desarmarHoja();
  else if (armada) medirVista();
}
function armarHoja() {
  hojaAbierta = false;                                // empieza cerrada (Max, 26-nov)
  const grupos = [...raiz.querySelectorAll(".b-datos > .grupo")];
  // lo que se mueve, en el orden en que vuelve a su lugar en la PC
  movidos = { datos: [...grupos, $("#p-holguras"), $("#p-taller")], res: [$("#p-demo"), $("#p-error"), $("#p-resultado"),
    $(".b-res .acciones"), $(".b-res .verificar")], fig: $(".p-elev") };
  const vista = document.createElement("div");
  vista.id = "p-vista-arriba";
  vista.className = "p-vista-arriba";
  vista.setAttribute("aria-live", "polite");
  $("#p-modelo-barra").after(vista);
  mover($("#p-demo"), vista);
  mover($("#p-error"), vista);
  mover($(".p-elev"), vista);
  const hoja = document.createElement("section");
  hoja.id = "p-hoja";
  hoja.className = "p-hoja";
  hoja.setAttribute("aria-label", "Opciones de la reja o el portón");
  hoja.innerHTML = `<div class="p-hoja-cab"><span class="p-hoja-agarre" aria-hidden="true"></span>
    <button type="button" class="cerrar" id="p-hoja-cerrar" aria-label="Cerrar las opciones">×</button></div>
    <div class="p-hoja-cuerpo" id="p-hoja-cuerpo"></div>`;
  const nav = document.createElement("nav");
  nav.id = "p-hoja-nav";
  nav.className = "p-hoja-nav";
  nav.setAttribute("aria-label", "Opciones");
  nav.innerHTML = SECCIONES.map(([k, rot, d]) => `<button type="button" data-sec="${k}" aria-controls="p-hoja">
    <svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg><span>${rot}</span></button>`).join("");
  raiz.append(hoja, nav);
  const cuerpo = $("#p-hoja-cuerpo");
  const partes = { tipo: [grupos[0]], medidas: [grupos[1], $("#p-holguras")], perfiles: [grupos[2]], relleno: [grupos[3]],
    lista: [$("#p-resultado"), $("#p-taller"), $(".b-res .acciones"), $(".b-res .verificar")] };
  for (const [k] of SECCIONES) {
    const sec = document.createElement("div");
    sec.className = "p-sec";
    sec.dataset.sec = k;
    cuerpo.append(sec);
    for (const n of partes[k]) mover(n, sec);
  }
  nav.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]");
    if (!b) return;
    if (hojaAbierta && b.getAttribute("aria-current") === "true") { abrirHoja(false); return; }
    irA(b.dataset.sec);
  });
  $("#p-hoja-cerrar").addEventListener("click", () => abrirHoja(false));
  cuerpo.addEventListener("scroll", espiar, { passive: true });
  addEventListener("resize", alRedimensionar);
  document.body.classList.add("modo-hoja");
  abrirHoja(hojaAbierta, false);
}
function desarmarHoja() {
  const datos = raiz.querySelector(".b-datos"), res = raiz.querySelector(".b-res");
  for (const n of movidos.datos) if (n) datos.append(n);
  for (const n of movidos.res) if (n) res.append(n);
  $("#p-resumen").after(movidos.fig);
  movidos = null;
  for (const id of ["#p-hoja", "#p-hoja-nav", "#p-vista-arriba"]) $(id)?.remove();
  removeEventListener("resize", alRedimensionar);
  document.body.classList.remove("modo-hoja");
  raiz.style.removeProperty("--p-elev-h");
  dibujar();
}
function abrirHoja(si, medir = true) {
  hojaAbierta = si;
  const hoja = $("#p-hoja");
  if (!hoja) return;
  hoja.classList.toggle("cerrada", !si);
  hoja.setAttribute("aria-hidden", String(!si));
  hoja.inert = !si;
  if (!si) marcarSec(null);                           // cerrada: ningún botón encendido
  if (medir) medirVista();
}
function irA(k, desplazar = true) {
  if (!hojaAbierta) abrirHoja(true);
  marcarSec(k);
  if (!desplazar) return;
  const cuerpo = $("#p-hoja-cuerpo"), sec = raiz.querySelector(`.p-sec[data-sec="${k}"]`);
  sinEspiar = Date.now() + 700;                       // mientras se desliza, no cambia el botón marcado
  cuerpo.scrollTo({ top: sec.offsetTop - 6, behavior: "smooth" });
}
function marcarSec(k) {
  for (const b of raiz.querySelectorAll("#p-hoja-nav [data-sec]")) b.setAttribute("aria-current", String(b.dataset.sec === k));
}
function espiar() {
  if (Date.now() < sinEspiar) return;
  const cuerpo = $("#p-hoja-cuerpo");
  let k = "tipo";
  for (const sec of raiz.querySelectorAll(".p-sec")) if (sec.offsetTop - 30 <= cuerpo.scrollTop) k = sec.dataset.sec;
  if (cuerpo.scrollTop + cuerpo.clientHeight >= cuerpo.scrollHeight - 4) k = "lista";
  marcarSec(k);
}
// alto del dibujo = lo que queda entre su borde de arriba y la hoja (o la barra, con la hoja cerrada)
function medirVista() {
  const fig = $(".p-elev"), nav = $("#p-hoja-nav"), hoja = $("#p-hoja");
  if (!fig || !nav || !hoja) return;
  const arriba = fig.getBoundingClientRect().top + window.scrollY;
  const abajo = nav.getBoundingClientRect().height + (hojaAbierta ? hoja.getBoundingClientRect().height : 0);
  raiz.style.setProperty("--p-elev-h", `${Math.max(170, Math.floor(window.innerHeight - arriba - abajo - 8))}px`);
}
function alRedimensionar() {
  clearTimeout(reloj2);
  reloj2 = setTimeout(medirVista, 120);
}
// tocar una pieza en el dibujo (con la hoja): abre la hoja en la lista, con el renglón a la vista
function verEnLista() {
  if (!$("#p-hoja") || !sel) return;
  const li = raiz.querySelector(`#p-lista li[data-m="${sel}"]`), cuerpo = $("#p-hoja-cuerpo");
  if (!li) return;
  irA("lista", false);
  sinEspiar = Date.now() + 700;
  const y = li.getBoundingClientRect().top - cuerpo.getBoundingClientRect().top + cuerpo.scrollTop;
  cuerpo.scrollTo({ top: y - 60, behavior: "smooth" });
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
  ANGOSTA.removeEventListener("change", acomodarVista);
  raiz?.classList.remove("p-en-galeria");
  removeEventListener("resize", alRedimensionar);
  document.body.classList.remove("modo-hoja");
  movidos = null;
  clearTimeout(reloj);
  cerrarSalida();
  observador?.disconnect();
  pedido++;
  if (trabajador) { trabajador.terminate(); trabajador = null; ocupado = false; }
  cerrarCompleta();
  cerrar3D();
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
// cada lista lleva abajo el botón «Frente» (25-nov, Max): qué medida va de frente en los perfiles de dos caras distintas
const FRENTE = { perfil_marco: "frente_marco", perfil_trav: "frente_trav", perfil_relleno: "frente_relleno" };
const perfilSel = (k, rot) => `<div class="campo campo-perfil" data-k="${k}"><label class="rotulo" for="p-${k}">${rot}</label>
  <select id="p-${k}" class="p-select"></select>
  <div class="p-frente" data-f="${FRENTE[k]}" hidden><span class="p-frente-rot" id="p-${FRENTE[k]}-rot">Frente</span>
    <div class="segmentos" role="radiogroup" aria-labelledby="p-${FRENTE[k]}-rot">
      <label><input type="radio" name="p-${FRENTE[k]}" value="a"><span></span></label>
      <label><input type="radio" name="p-${FRENTE[k]}" value="b"><span></span></label>
    </div></div></div>`;

const PLANTILLA = `
<section class="p-galeria" id="p-galeria" aria-label="Modelos de reja y portón" hidden>
  <div class="p-gal-lista" id="p-gal-lista">
    <div class="p-gal-cab">
      <h1 class="p-gal-tit">Elegí un modelo</h1>
      <button type="button" class="btn-sec btn-chico btn-quieto" id="p-gal-volver" hidden>Volver al diseño</button>
    </div>
    <p class="p-gal-sub">Después cambiás medidas, perfiles, travesaños y relleno.</p>
    <div class="segmentos p-gal-pest" role="radiogroup" aria-label="Qué vas a hacer">
      <label><input type="radio" name="p-gal-para" value="porton"><span>Portones</span></label>
      <label><input type="radio" name="p-gal-para" value="reja"><span>Reja de ventana</span></label>
    </div>
    <p class="p-gal-ley" id="p-gal-ley"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>
      <span>Cada modelo sirve para <b>batiente de 1 o 2 hojas</b> y <b>corredizo</b>. El tipo lo elegís después.</span></p>
    <ul class="p-modelos" id="p-modelos"></ul>
  </div>
  <div class="p-gal-det" id="p-gal-det" hidden></div>
</section>
<div class="app app-barras app-portones">
  <section class="b-datos" aria-label="Datos de la reja o el portón">
    <h1 class="titulo-figura solo-lector">Rejas y portones</h1>
    <button type="button" class="p-modelo-barra" id="p-modelo-barra" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4ZM4 12h16M9 4v16M15 4v16"/></svg>
      <span class="p-mb-txt"><b>Modelo:</b> <span id="p-mb-nom"></span></span><span class="p-mb-mod" id="p-mb-mod" hidden>· modificado</span>
      <span class="p-mb-ir">Cambiar</span>
    </button>
    <div class="grupo">
    <h2 class="sub">Tipo</h2>
    <div class="p-tarjetas p-tipos" id="p-tipos"></div>
    ${paso("cantidad", "Cantidad iguales")}
    </div>
    <div class="grupo">
    <h2 class="sub">Medidas</h2>
    ${campo("ancho")}${campo("alto")}
    ${campo("sob_lat")}${campo("sob_arr")}${campo("sob_abj")}${campo("holg_hueco")}
    <p class="nota" id="p-reja-medida" hidden></p>
    </div>
    <div class="grupo">
    <h2 class="sub">Perfiles <button type="button" class="btn-sec btn-chico" id="p-admin">Editar perfiles</button></h2>
    ${perfilSel("perfil_marco", "Marco")}${perfilSel("perfil_trav", "Travesaños")}${perfilSel("perfil_relleno", "Relleno")}
    </div>
    <div class="grupo">
    <h2 class="sub">Relleno</h2>
    <div class="p-tarjetas p-rellenos" id="p-rellenos"></div>
    ${campo("luz_max")}${campo("angulo")}
    <div class="campo campo-opcion" data-k="trav_modo"><span class="rotulo" id="p-trav_modo-rot">Travesaños</span>
      <div class="segmentos" role="radiogroup" aria-labelledby="p-trav_modo-rot">
        <label><input type="radio" name="p-trav_modo" value="repartidos"><span>Repartidos</span></label>
        <label><input type="radio" name="p-trav_modo" value="doble"><span>Doble al centro</span></label>
      </div></div>
    ${paso("n_trav", "Travesaños")}${campo("franja")}${paso("n_franja", "Barrotes en la franja")}
    ${paso("n_panos", "Paños a lo ancho")}
    <div class="campo campo-opcion" data-k="armado"><span class="rotulo">Armado con travesaños</span>
      <div class="segmentos" role="radiogroup" aria-label="Armado">
        <label><input type="radio" name="p-armado" value="a_tope"><span>A tope</span></label>
        <label><input type="radio" name="p-armado" value="pasantes"><span>Pasantes</span></label>
      </div></div>
    <div class="campo campo-opcion" data-k="chapa_trav"><span class="rotulo" id="p-chapa_trav-rot">Travesaños</span>
      <div class="segmentos" role="radiogroup" aria-labelledby="p-chapa_trav-rot">
        <label><input type="radio" name="p-chapa_trav" value="atras"><span>Atrás de la chapa</span></label>
        <label><input type="radio" name="p-chapa_trav" value="a_tope"><span>A tope</span></label>
      </div></div>
    <div class="campo campo-opcion" data-k="cruce"><span class="rotulo" id="p-cruce-rot">Cruce</span>
      <div class="segmentos" role="radiogroup" aria-labelledby="p-cruce-rot">
        <label><input type="radio" name="p-cruce" value="cruzadas"><span>Cruzadas</span></label>
        <label><input type="radio" name="p-cruce" value="plano"><span>Mismo plano</span></label>
      </div></div>
    <div class="campo campo-opcion" data-k="trav_lado"><span class="rotulo" id="p-trav_lado-rot">Travesaños</span>
      <div class="segmentos" role="radiogroup" aria-labelledby="p-trav_lado-rot">
        <label><input type="radio" name="p-trav_lado" value="adelante"><span>Adelante</span></label>
        <label><input type="radio" name="p-trav_lado" value="atras"><span>Atrás</span></label>
      </div></div>
    ${campo("esp_chapa")}
    </div>
    <details class="p-plegable" id="p-holguras"><summary>Holguras del portón</summary>
      ${campo("holg_lat")}${campo("holg_centro")}${campo("luz_piso")}${campo("solape")}</details>
    <details class="p-plegable" id="p-taller"><summary>Corte y costos del taller</summary>
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
          <button type="button" class="btn-3d" id="p-3d"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5Z"/><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5"/></svg>Ver en 3D</button>
          <button type="button" class="btn-sec btn-chico btn-ampliar" id="p-ampliar" aria-label="Ampliar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="p-amp-txt">Ampliar</span></button>
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
    <p class="nota">Tocá un perfil para cambiarlo. El nombre se arma solo con la forma y las medidas.</p>
    <ul class="perfiles" id="perfiles"></ul>
    <button type="button" class="btn-sec pe-nuevo" id="perfil-nuevo"><span aria-hidden="true">+</span> Agregar perfil</button>
    <div class="pe-pie"><button type="submit" class="btn-prim" value="listo">Listo</button></div>
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
function svgElevacion(R, { anchoPx, altoMax = 1e9, marcas = null, seleccion = null, cotas = false, mini = false, travAtras = false }) {
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
  const orden = travAtras ? { ...ORDEN, TRAVESANO: ORDEN.BARRA, BARRA: ORDEN.TRAVESANO } : ORDEN;   // el de adelante, encima
  for (const [capa, pts, k] of [...R.formas].sort((a, b) => orden[a[0]] - orden[b[0]])) {
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
  if (!pro && ["ancho", "alto", "sob_lat", "sob_arr", "sob_abj"].includes(k)) {
    // el tope de la DEMO es sobre la reja que se fabrica (hueco + lo que sobresale): lo más que entra con este campo
    const entra = (x) => P.demoPermite({ ...it, [k]: x });
    if (!entra(v)) {
      let lo = minimo, hi = v;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (entra(m)) lo = m; else hi = m; }
      v = entra(Math.round(lo)) ? Math.round(lo) : Math.floor(lo);
      if (!entra(v)) v = minimo;
      avisoDemo = `En la versión de prueba la reja va hasta ${miles(P.DEMO_LADOS[0])} × ${miles(P.DEMO_LADOS[1])} mm (en cualquier orientación). ` +
        `<button type="button" class="enlace" data-abre-pro="portones">Más grande y portones con la PRO</button>`;
    }
  }
  it[k] = v;
  if (k.startsWith("sob_") || k === "holg_hueco" || k === "ancho" || k === "alto") habilitar();
  programar();
}

/** Debajo de las medidas de la reja de ventana: la medida que se fabrica y cómo va. */
function notaReja() {
  const it = est.item, nota = $("#p-reja-medida");
  if (!nota) return;
  nota.hidden = it.tipo !== "reja_ventana";
  if (nota.hidden) return;
  const [w, h] = P.medidaReja(it);
  nota.textContent = `Reja de ${n1(w)} × ${n1(h)} mm, ` +
    (P.rejaSobrepuesta(it) ? "sobrepuesta (por delante de la pared)." : "adentro del hueco.");
}

function ponerValores() {
  const it = est.item;
  for (const k of Object.keys(CAMPOS)) {
    const inp = $(`#p-${k}`);
    if (document.activeElement !== inp) { inp.value = corto(it[k], 2); inp.closest(".campo").classList.remove("mal"); }
  }
  $("#p-cantidad").textContent = it.cantidad;
  $("#p-n_trav").textContent = it.n_trav;
  $("#p-n_franja").textContent = it.n_franja;
  $("#p-n_panos").textContent = it.n_panos;
  for (const r of raiz.querySelectorAll('input[name="p-armado"]')) r.checked = r.value === it.armado;
  for (const k of ["trav_lado", "chapa_trav", "cruce", "trav_modo"]) {
    for (const r of raiz.querySelectorAll(`input[name="p-${k}"]`)) r.checked = r.value === it[k];
  }
  $("#p-corte").value = est.corte;
  $("#p-sold").value = est.sold;
  $("#p-pint").value = est.pint;
  $("#p-margen").value = est.margen;
  $("#p-cotas").checked = !!est.cotas;
  $("#p-costos").classList.toggle("bloq", !pro);
  opcionesPerfiles();
  habilitar();
}

// orden de los perfiles por tipo (25-nov, Max): todos los cuadrados juntos, todos los rectangulares juntos…
const GRUPOS_PERFIL = ["Tubo cuadrado", "Tubo rectangular", "Tubo redondo", "Ángulo", "Planchuela", "Macizo cuadrado", "Macizo redondo"];
function grupoPerfil(forma, a, b) {
  if (forma === "tubo") return a === b ? 0 : 1;
  const i = GRUPOS_PERFIL.indexOf(FORMA_CORTA[forma]);
  return i < 0 ? GRUPOS_PERFIL.length : i;
}
/** Clave de orden: grupo, medidas de menor a mayor, espesor, largo de barra. */
const ordenPerfil = (p) => [grupoPerfil(p.forma, p.a, p.b), p.a, p.b, p.t, p.largo, p.nombre];
/** Clave de orden de un material del editor (sin medidas que se entiendan, al final). */
function ordenMaterial(m) {
  const md = P.leerMedidas(m.forma, m.medidas || "");
  return md ? [grupoPerfil(m.forma, md[0], md[1]), ...md, Number(m.largo) || 0] : [GRUPOS_PERFIL.length + 1, 0, 0, 0, 0];
}

function opcionesPerfiles() {
  const ps = Object.values(perfiles()).sort((a, b) => P.cmp(ordenPerfil(a), ordenPerfil(b)));
  const it = est.item;
  const grupos = [];
  for (const p of ps) {
    const g = GRUPOS_PERFIL[grupoPerfil(p.forma, p.a, p.b)] || "Otros";
    if (!grupos.length || grupos[grupos.length - 1][0] !== g) grupos.push([g, []]);
    grupos[grupos.length - 1][1].push(`<option value="${esc(p.nombre)}">${esc(p.nombre)}</option>`);
  }
  const html = grupos.map(([g, ops]) => `<optgroup label="${esc(g)}">${ops.join("")}</optgroup>`).join("");
  for (const k of ["perfil_marco", "perfil_trav", "perfil_relleno"]) {
    const s = $(`#p-${k}`);
    let pre = "";
    if (k === "perfil_trav") pre = `<option value="">Igual que el marco</option>`;
    else if (!ps.some((p) => p.nombre === it[k])) pre = `<option value="">Elegí un perfil</option>`;
    s.innerHTML = pre + html;
    s.value = ps.some((p) => p.nombre === it[k]) ? it[k] : "";
  }
  ponerFrente();
}

/** Botón «Frente» de cada lista: se ve si el perfil elegido tiene dos caras distintas; muestra sus dos medidas. */
function ponerFrente() {
  const it = est.item, ps = perfiles();
  for (const [k, f] of Object.entries(FRENTE)) {
    const caja = raiz.querySelector(`.p-frente[data-f="${f}"]`);
    const p = ps[it[k]] || null;                    // travesaños «Igual que el marco» = siguen al marco (sin botón)
    const ver = P.sePuedeGirar(p);
    caja.hidden = !ver;
    if (!ver) continue;
    const [ra, rb] = caja.querySelectorAll("input");
    ra.nextElementSibling.textContent = corto(p.a, 2);
    rb.nextElementSibling.textContent = corto(p.b, 2);
    ra.checked = it[f] !== "b";
    rb.checked = it[f] === "b";
  }
}

/** Muestra solo los campos que usa el tipo y el relleno elegidos (ui_portones._habilitar). */
function habilitar() {
  const it = est.item, r = it.relleno, t = it.tipo;
  // travesaño doble y paños a lo ancho (solo PWA, 26-nov): el doble va a tope (sin Armado / Adelante-Atrás); con
  // paños o con el doble, la chapa va a tope (sin «Atrás de la chapa»)
  const doble = P.esDoble(it), np = P.panos(it);
  const on = {
    luz_max: P.usaLuz(r), angulo: P.usaAngulo(r), armado: P.usaArmado(r) && it.n_trav > 0 && !doble, esp_chapa: r === "chapa",
    trav_lado: P.sonPasantes(it),
    chapa_trav: r === "chapa" && it.n_trav > 0 && !doble && np === 1, cruce: P.usaCruce(r),
    trav_modo: P.usaDoble(it), n_trav: !doble, franja: doble, n_franja: doble, n_panos: P.usaPanos(it),
    perfil_relleno: r !== "chapa" || (doble && it.n_franja > 0), perfil_trav: it.n_trav > 0 || np > 1,
    holg_lat: t === "batiente_1" || t === "batiente_2", holg_centro: t === "batiente_2", luz_piso: P.PORTONES.includes(t),
    solape: t === "corredizo",
    sob_lat: t === "reja_ventana", sob_arr: t === "reja_ventana", sob_abj: t === "reja_ventana",
    holg_hueco: t === "reja_ventana" && !P.rejaSobrepuesta(it),
  };
  for (const [k, v] of Object.entries(on)) raiz.querySelector(`.campo[data-k="${k}"]`).hidden = !v;
  $("#p-holguras").hidden = !P.PORTONES.includes(t);
  const reja = t === "reja_ventana";
  raiz.querySelector('label[for="p-ancho"]').textContent = reja ? "Ancho del hueco" : CAMPOS.ancho[0];
  raiz.querySelector('label[for="p-alto"]').textContent = reja ? "Alto del hueco" : CAMPOS.alto[0];
  notaReja();
  ponerBarraModelo();
  $("#p-n_trav-rot").textContent = r === "horizontales" ? "Montantes" : "Travesaños";
  $("#p-trav_lado-rot").textContent = r === "horizontales" ? "Montantes" : "Travesaños";
  raiz.querySelector('label[for="p-perfil_trav"]').textContent = r === "horizontales" ? "Montantes"
    : np > 1 ? (it.n_trav > 0 ? "Travesaños y parantes" : "Parantes") : "Travesaños";
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
      const med = clave === "tipo" ? P.medidasAlCambiarTipo(est.item, v) : null;   // medidas de muestra del tipo
      est.item[clave] = v;
      if (med) { Object.assign(est.item, med); ponerValores(); }
      if (clave === "tipo" && est.item.nombre === "") est.item.nombre = P.TEXTO[v];
      if (P.esDoble(est.item)) { est.item.n_trav = 2; $("#p-n_trav").textContent = 2; }   // el doble vuelve a valer
      habilitar();
      programar(0);
      return;
    }
    const b = e.target.closest("[data-paso]");
    if (b) {
      const k = b.dataset.paso, it = est.item;
      const [lo, hi] = PASOS[k] || [1, Infinity];
      it[k] = Math.max(lo, Math.min(hi, it[k] + Number(b.dataset.d)));
      $(`#p-${k}`).textContent = it[k];
      habilitar();
      programar(0);
      return;
    }
    if (e.target.closest("#perfil-nuevo")) { nuevoPerfil(); return; }
    if (e.target.closest("#perfiles") && clickPerfiles(e)) return;
    const d = $("#hoja-perfiles");
    if (e.target === d) { d.close(); return; }
    const m = e.target.closest("[data-m]");
    if (m && !e.target.closest("#hoja-perfiles")) {
      const enDibujo = !!e.target.closest("#p-dibujo");   // antes: seleccionar() rehace el dibujo
      seleccionar(m.dataset.m);
      if (enDibujo) verEnLista();
    }
  });
  for (const k of ["perfil_marco", "perfil_trav", "perfil_relleno"]) {
    $(`#p-${k}`).addEventListener("change", (e) => { est.item[k] = e.target.value; ponerFrente(); programar(0); });
  }
  for (const f of Object.values(FRENTE)) {                    // cambia la lista de corte: se recalcula
    for (const r of raiz.querySelectorAll(`input[name="p-${f}"]`)) {
      r.addEventListener("change", () => { if (r.checked) { est.item[f] = r.value; programar(0); } });
    }
  }
  for (const r of raiz.querySelectorAll('input[name="p-armado"]')) {
    r.addEventListener("change", () => { if (r.checked) { est.item.armado = r.value; habilitar(); programar(0); } });
  }
  for (const r of raiz.querySelectorAll('input[name="p-trav_lado"]')) {
    r.addEventListener("change", () => { if (r.checked) { est.item.trav_lado = r.value; guardar(); dibujar(); dibujarCompleta(); } });
  }
  for (const r of raiz.querySelectorAll('input[name="p-trav_modo"]')) {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      Object.assign(est.item, P.normalizarItem({ ...est.item, trav_modo: r.value }));  // el doble = 2 travesaños (PC)
      $("#p-n_trav").textContent = est.item.n_trav;
      habilitar();
      programar(0);
    });
  }
  for (const k of ["chapa_trav", "cruce"]) {                 // cambian la lista de corte: se recalcula
    for (const r of raiz.querySelectorAll(`input[name="p-${k}"]`)) {
      r.addEventListener("change", () => { if (r.checked) { est.item[k] = r.value; programar(0); } });
    }
  }
  for (const [id, k] of [["p-corte", "corte"], ["p-sold", "sold"], ["p-pint", "pint"], ["p-margen", "margen"]]) {
    const inp = $(`#${id}`);
    inp.addEventListener("focus", () => inp.select());
    inp.addEventListener("input", () => { est[k] = inp.value; programar(k === "corte" ? 300 : 150); });
  }
  $("#p-cotas").addEventListener("change", (e) => { est.cotas = e.target.checked; guardar(); dibujar(); });
  $("#p-ampliar").addEventListener("click", abrirCompleta);
  $("#p-3d").addEventListener("click", () => {
    if (!calc?.resultados[0]) return;
    abrir3D(calc.resultados[0], perfiles(), opciones3D(est.item));
  });
  $("#p-admin").addEventListener("click", abrirPerfiles);
  $("#hoja-perfiles").addEventListener("close", cerrarPerfiles);
  let ancho = 0, alto = 0;
  observador = new ResizeObserver(() => {
    const d = raiz.querySelector("#p-dibujo");
    if (!d || !d.isConnected) return;
    const conHoja = !!raiz.querySelector("#p-hoja");
    if (Math.abs(d.clientWidth - ancho) > 8 || (conHoja && Math.abs(d.clientHeight - alto) > 8)) {
      ancho = d.clientWidth; alto = d.clientHeight; dibujar();
    }
  });
  observador.observe($("#p-dibujo"));
}

function programar(ms = 300) {
  clearTimeout(reloj);
  reloj = setTimeout(calcular, ms);
}

// ------------------------------------------------------------------ perfiles
// Nombre automático: forma + medidas como las escribió (x → ×). Si hay dos con la misma forma y medidas y distinto
// largo de barra, los dos llevan el largo («Tubo cuadrado 40×40×2 · 6 m»). Igual forma, medidas y largo = repetido:
// se avisa y no se usa.
const FORMA_CORTA = { tubo_red: "Tubo redondo", macizo_cuad: "Macizo cuadrado", macizo_red: "Macizo redondo", planchuela: "Planchuela", angulo: "Ángulo" };
const EJEMPLO = { tubo: "40x40x2", tubo_red: "Ø1\" x 2", macizo_cuad: "12", macizo_red: "Ø12", planchuela: "1 1/2 x 3/16\"", angulo: "40x40x3" };
const USOS = [["perfil_marco", "el marco"], ["perfil_trav", "los travesaños"], ["perfil_relleno", "el relleno"]];
const TACHO = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const FLECHA = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
let abierto = -1, borrando = -1;

const textoMed = (t) => String(t || "").trim().replace(/\s+/g, " ").replace(/\s*[xX*×]\s*/g, "×");
function base(m) {
  const md = P.leerMedidas(m.forma, m.medidas || "");
  const forma = m.forma === "tubo" ? (md && md[0] !== md[1] ? "Tubo rectangular" : "Tubo cuadrado") : (FORMA_CORTA[m.forma] || "Perfil");
  const t = textoMed(m.medidas);
  return { nombre: t ? `${forma} ${t}` : forma, clave: `${m.forma}|${md ? md.map((v) => +v.toFixed(3)).join("×") : t.toLowerCase()}` };
}
const largoM = (v) => `${corto(Number(v) / 1000, 3)} m`;
/** true si un perfil anterior tiene la misma forma, medidas y largo de barra. */
function repetido(lista, i) {
  const k = base(lista[i]).clave;
  return lista.slice(0, i).some((o) => base(o).clave === k && Number(o.largo) === Number(lista[i].largo));
}
/** Pone los nombres automáticos y lleva las elecciones del trabajo (marco, travesaños, relleno) al nombre nuevo. */
function renombrar(e = est) {
  const lista = e.perfiles, antes = lista.map((m) => m.nombre), bs = lista.map(base);
  const largos = {};
  bs.forEach((b, i) => { (largos[b.clave] ||= new Set()).add(Number(lista[i].largo)); });
  lista.forEach((m, i) => { m.nombre = bs[i].nombre + (largos[bs[i].clave].size > 1 ? ` · ${largoM(m.largo)}` : ""); });
  for (const [k] of USOS) {
    const i = antes.indexOf(e.item[k]);
    if (e.item[k] && i >= 0) e.item[k] = lista[i].nombre;
  }
}

/** Estado de un perfil: resumen de la cabecera y aviso de adentro. */
function estadoPerfil(i, escribiendo = false) {
  const m = est.perfiles[i], p = P.perfilDe(m), vacio = !String(m.medidas || "").trim();
  if (repetido(est.perfiles, i)) return { mal: true, res: "Repetido", aviso: "Ya tenés ese perfil (misma forma, medidas y barra)." };
  if (vacio) return { mal: true, res: "Faltan las medidas", aviso: "Cargá las medidas.", gris: true };
  if (!p) return { mal: true, res: "Medidas mal cargadas", aviso: `No se entienden las medidas. Ejemplo: ${EJEMPLO[m.forma] || "40x40x2"}`, gris: escribiendo };
  const kg = `${n1(p.kgM())} kg/m${p.pulgadas ? " · pulgadas" : ""}`;
  return { mal: false, res: `Barra ${corto(m.largo, 1)} mm · ${kg}${m.precio ? ` · precio ${corto(m.precio, 2)}` : ""}`, aviso: kg, gris: true };
}

function abrirPerfiles() {
  abierto = -1; borrando = -1;
  // ordenados por tipo al abrir (no mientras se escribe, para que la tarjeta no salte); sort estable: entre repetidos
  // queda primero el mismo de antes
  est.perfiles = est.perfiles.map((m, i) => [m, i]).sort((x, y) => P.cmp(ordenMaterial(x[0]), ordenMaterial(y[0])) || x[1] - y[1])
    .map(([m]) => m);
  dibujarPerfiles();
  const d = $("#hoja-perfiles");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

/** Al cerrar: se descartan los perfiles nuevos que quedaron sin medidas. */
function cerrarPerfiles() {
  const antes = est.perfiles.length;
  est.perfiles = est.perfiles.filter((m) => String(m.medidas || "").trim());
  if (est.perfiles.length !== antes) { renombrar(); opcionesPerfiles(); programar(0); }
  abierto = -1; borrando = -1;
}

function usosDe(nombre) {
  const it = est.item, out = [];
  for (const [k, t] of USOS) {
    if (k === "perfil_trav" && !(it.n_trav > 0 || P.panos(it) > 1)) continue;
    if (k === "perfil_relleno" && it.relleno === "chapa" && !(P.esDoble(it) && it.n_franja > 0)) continue;
    if (it[k] === nombre) out.push(t);
  }
  return out;
}

function dibujarPerfiles() {
  const ul = $("#perfiles");
  ul.innerHTML = est.perfiles.map((m, i) => {
    const e = estadoPerfil(i), ab = i === abierto, usos = usosDe(m.nombre);
    return `<li class="perfil-ed${ab ? " abierto" : ""}${e.mal ? " mal" : ""}" data-i="${i}">
      <button type="button" class="pe-cab" aria-expanded="${ab}">
        <span class="pe-tit">${esc(m.nombre)}</span>
        <span class="pe-res">${esc(e.res)}</span>
        <span class="pe-flecha">${FLECHA}</span>
      </button>
      <div class="pe-cuerpo"${ab ? "" : " hidden"}>
        <label class="pe-c pe-ancho"><span>Forma</span><select data-c="forma">${P.FORMAS.map(([k, t]) => `<option value="${k}"${k === m.forma ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="pe-c pe-ancho"><span>Medidas</span><span class="entrada"><input data-c="medidas" type="text" spellcheck="false" autocomplete="off" placeholder="ej. ${esc(EJEMPLO[m.forma] || "")}" value="${esc(m.medidas)}"></span></label>
        <label class="pe-c"><span>Largo de la barra</span><span class="entrada"><input data-c="largo" type="text" inputmode="decimal" value="${corto(m.largo, 1)}"><span class="unidad">mm</span></span></label>
        <label class="pe-c${pro ? "" : " pe-bloq"}"><span>Precio de la barra${pro ? "" : " (PRO)"}</span><span class="entrada"><input data-c="precio" type="text" inputmode="decimal" placeholder="0" value="${m.precio ? corto(m.precio, 2) : ""}"${pro ? "" : " disabled"}></span></label>
        <p class="pe-estado${e.gris ? "" : " perfil-mal"}">${esc(e.aviso)}</p>
        ${i === borrando ? `<div class="pe-confirma" role="alert">
          <p>¿Borrar <b>${esc(m.nombre)}</b>?${usos.length ? ` Lo usa ${usos.join(" y ")} del trabajo.` : ""}</p>
          <div class="pe-confirma-b"><button type="button" class="btn-sec btn-quieto" data-acc="no">Cancelar</button><button type="button" class="pe-si" data-acc="si">Borrar</button></div>
        </div>` : `<button type="button" class="pe-borrar" data-acc="borrar">${TACHO}Borrar perfil</button>`}
      </div></li>`;
  }).join("");
  for (const inp of ul.querySelectorAll("[data-c]")) {
    const i = Number(inp.closest(".perfil-ed").dataset.i), c = inp.dataset.c;
    inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => cambioPerfil(i, c, inp));
    if (inp.tagName !== "SELECT") {
      inp.addEventListener("change", () => refrescarPerfiles(-1));            // al salir del campo, avisos completos
      inp.addEventListener("focus", () => { if (c !== "medidas") inp.select(); });
    }
  }
}

function clickPerfiles(e) {
  const li = e.target.closest(".perfil-ed");
  if (!li) return false;
  const i = Number(li.dataset.i);
  if (e.target.closest(".pe-cab")) {
    abierto = abierto === i ? -1 : i; borrando = -1;
    dibujarPerfiles();
    if (abierto === i) $(`#perfiles .perfil-ed[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
    return true;
  }
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (!acc) return false;
  if (acc === "borrar") borrando = i;
  else if (acc === "no") borrando = -1;
  else if (acc === "si") {
    est.perfiles.splice(i, 1);
    abierto = -1; borrando = -1;
    renombrar(); opcionesPerfiles(); programar(0);
  }
  dibujarPerfiles();
  return true;
}

function nuevoPerfil() {
  est.perfiles.push({ nombre: "", forma: "tubo", medidas: "", largo: 6000, precio: 0 });
  renombrar();
  abierto = est.perfiles.length - 1; borrando = -1;
  dibujarPerfiles();
  const inp = $(`#perfiles .perfil-ed[data-i="${abierto}"] [data-c="medidas"]`);
  inp?.closest(".perfil-ed").scrollIntoView({ block: "nearest" });
  inp?.focus();
}

/** Actualiza nombres, resúmenes y avisos sin volver a dibujar (no se pierde el foco ni el teclado). */
function refrescarPerfiles(escribiendo) {
  for (const li of $("#perfiles").querySelectorAll(".perfil-ed")) {
    const i = Number(li.dataset.i), e = estadoPerfil(i, i === escribiendo);
    li.querySelector(".pe-tit").textContent = est.perfiles[i].nombre;
    li.querySelector(".pe-res").textContent = e.res;
    li.classList.toggle("mal", e.mal);
    const av = li.querySelector(".pe-estado");
    av.textContent = e.aviso;
    av.classList.toggle("perfil-mal", !e.gris);
  }
}

function cambioPerfil(i, c, inp) {
  const m = est.perfiles[i];
  if (c === "largo" || c === "precio") {
    let v;
    try { v = inp.value.trim() === "" ? 0 : numero(inp.value); } catch { v = NaN; }
    const ok = v >= 0 && (c !== "largo" || v > 0);
    inp.closest(".entrada").classList.toggle("mal", !ok);
    if (!ok) return;
    m[c] = v;
  } else {
    m[c] = inp.value;
    if (c === "forma") {
      const med = inp.closest(".perfil-ed").querySelector('[data-c="medidas"]');
      med.placeholder = `ej. ${EJEMPLO[m.forma] || ""}`;
    }
  }
  renombrar();
  refrescarPerfiles(c === "medidas" ? i : -1);
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
  $(".p-elev").hidden = !R;                           // en el celular el dibujo está fuera de #p-resultado
  medirVista();
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
  const conHoja = !!raiz.querySelector("#p-hoja");     // celular / tablet: el alto lo da el lugar que deja la hoja
  cont.innerHTML = svgElevacion(calc.resultados[0], {
    anchoPx: w, altoMax: conHoja ? Math.max(120, cont.clientHeight) : Math.max(300, Math.min(window.innerHeight * 0.62, 640)), marcas: calc.marcas, seleccion: sel, cotas: !!est.cotas,
    travAtras: travAtras(),
  });
}

function lista() {
  const c = calc;
  $("#p-lista").innerHTML = c.filas.map((f) => `<li data-m="${f.marca}">
    <span class="p-chip" style="background:${f.color}">${f.marca}</span>
    <span class="p-largo">${med(f.largo, 1)} <small>mm</small></span><span class="p-cant">× ${f.cant}</span>
    <span class="p-det">${esc(f.perfil.rotulo || f.perfil.nombre)} · ${P.textoCorte(f.corte)}</span>${croquisSvg(f.corte)}
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
  if (c.chapas.length) {                                      // chapas a cortar (iguales juntas)
    const g = new Map();
    for (const [w, h, e, q] of c.chapas) {
      const k = `${corto(w, 1)} × ${corto(h, 1)} mm · ${corto(e, 2)} mm`;
      g.set(k, (g.get(k) || 0) + q);
    }
    ln.push(`Chapas a cortar: <b>${[...g].map(([k, q]) => `${q} de ${k}`).join("; ")}</b>`);
  }
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
    anchoPx: w * zoom, altoMax: h * zoom, marcas: calc.marcas, seleccion: sel, cotas: !!est.cotas, travAtras: travAtras(),
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

// ------------------------------------------------------------------ trabajo (proyecto, formato de la PC)
// PORTONES_CLAVES de la PC: items, corte, colorear, cotas, costos ({soldadura_m, pintura_m2}), filtro, perfiles (los
// usados, como materiales de barras) + version. La PWA tiene un portón por trabajo. Propio de la PWA: margen.
function datosTrabajo() {
  const it = est.item;
  const usados = new Set(["perfil_marco", "perfil_trav", "perfil_relleno"].map((k) => it[k]).filter(Boolean));
  const perfilesUsados = est.perfiles.filter((m, i) => usados.has(m.nombre) && !repetido(est.perfiles, i))
    .map((m) => ({ nombre: m.nombre, forma: m.forma, medidas: m.medidas, largo: Number(m.largo) || 6000,
      precio: Number(m.precio) || 0, kg_m: 0 }));
  return { tipo: "portones", portones: {
    version: 1, items: [P.itemParaPC(it)], corte: String(est.corte), colorear: true, cotas: !!est.cotas, filtro: "Todos",
    costos: { soldadura_m: num(est.sold, 0), pintura_m2: num(est.pint, 0) }, perfiles: perfilesUsados,
    margen: String(est.margen ?? "1"),
  } };
}

/** Abre un trabajo (de la PWA o de la PC). Los perfiles que no están en la lista se agregan (como hace la PC). */
async function cargarTrabajo(op) {
  const p = op.portones || {}, msgs = [];
  if (Number(p.version || 1) > 1) throw new Error("El proyecto se guardó con una versión más nueva del programa.");
  const items = Array.isArray(p.items) ? p.items : [];
  if (items.length > 1) msgs.push(`El proyecto tiene ${items.length} rejas o portones: se abrió el primero («${items[0].nombre || P.TEXTO[items[0].tipo] || "Portón"}»). La PWA trabaja con uno por trabajo.`);
  // la PC guarda la medida de la reja; con los datos del hueco (solo PWA) ancho / alto vuelven a ser el hueco
  const item = P.itemDePC(P.normalizarItem({ ...ITEM_INICIAL, ...(items[0] || {}) }));
  if (!item.modelo) item.modelo = M.LIBRE;            // trabajo de la PC o de antes de los modelos: va directo al diseño
  // perfiles del proyecto: el mismo (forma, medidas y barra) que ya está en la lista → se usa ese; si no, se agrega
  const cambio = {};
  let agregados = 0;
  for (const m of Array.isArray(p.perfiles) ? p.perfiles : []) {
    const nuevo = { nombre: String(m.nombre || ""), forma: String(m.forma || ""), medidas: String(m.medidas || ""),
      largo: Number(m.largo) || 6000, precio: Number(m.precio) || 0 };
    if (!P.perfilDe(nuevo)) continue;
    const k = base(nuevo).clave;
    const igual = est.perfiles.find((o) => base(o).clave === k && Number(o.largo) === nuevo.largo);
    if (igual) cambio[nuevo.nombre] = igual.nombre;
    else { est.perfiles.push(nuevo); agregados++; }
  }
  if (agregados) msgs.push(`Se ${agregados === 1 ? "agregó a tu lista 1 perfil" : `agregaron a tu lista ${agregados} perfiles`} del proyecto.`);
  for (const [k] of USOS) if (item[k] in cambio) item[k] = cambio[item[k]];
  est.item = item;
  renombrar();                                        // nombres automáticos; el ítem sigue a sus perfiles
  est.corte = String(p.corte ?? "3");
  est.cotas = !!p.cotas;
  const c = p.costos || {};
  est.sold = Number(c.soldadura_m) > 0 ? corto(Number(c.soldadura_m), 2) : "";
  est.pint = Number(c.pintura_m2) > 0 ? corto(Number(c.pintura_m2), 2) : "";
  if (p.margen !== undefined) est.margen = String(p.margen);
  guardar();
  desmontar();
  await montar(raiz);
  return msgs.join(" ");
}

async function nuevoTrabajo() {
  est.item = P.normalizarItem({ ...ITEM_INICIAL });
  guardar();
  desmontar();
  await montar(raiz);
}

/** Barrotes pasantes (travesaños superpuestos) y si el travesaño va atrás de los barrotes (3D y orden del dibujo). */
function pasantes(it = est.item) {
  return P.sonPasantes(it);
}
const travAtras = (it = est.item) => pasantes(it) && it.trav_lado === "atras";
/** Opciones de la vista 3D para un ítem (el del trabajo o el de un modelo de la galería). */
const opciones3D = (it) => ({ espChapa: it.esp_chapa, piso: P.PORTONES.includes(it.tipo), pasantes: pasantes(it),
  travAtras: travAtras(it), relleno: it.relleno, cruce: it.cruce, chapaTrav: P.chapaATope(it) ? "a_tope" : "atras",
  tipo: it.tipo, sobrepuesta: P.rejaSobrepuesta(it) });

// ------------------------------------------------------------------ galería de modelos (27-nov, Max)
// Al entrar sin modelo elegido (primera vez o «Nuevo») y con «Cambiar» de la barra del modelo. Tarjetas con la imagen
// del 3D (img/modelos/, tools/capturas_modelos.py); tocar una abre el detalle: la imagen grande, «Girar en 3D», qué trae
// y «Usar este modelo» (carga el diseño y conserva medidas y perfiles). En la DEMO los modelos de portón muestran la
// imagen y la compra (el cálculo de los portones es PRO); la reja de ventana se usa como siempre.
let galPara = "porton";
const ICONO_LIBRE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 10h36v30H6Z"/><path d="M24 18v14M17 25h14"/></svg>`;
const bloqueado = (para) => !pro && para === "porton";

function armarGaleria() {
  for (const r of raiz.querySelectorAll('input[name="p-gal-para"]')) {
    r.addEventListener("change", () => { if (r.checked) { galPara = r.value; pintarGaleria(); } });
  }
  $("#p-gal-volver").addEventListener("click", ocultarGaleria);
  $("#p-modelos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-modelo]");
    if (!b) return;
    if (b.dataset.modelo === M.LIBRE) usarModelo(M.LIBRE);
    else verModelo(b.dataset.modelo);
  });
  $("#p-gal-det").addEventListener("click", (e) => {
    const acc = e.target.closest("[data-acc]")?.dataset.acc;
    const id = $("#p-gal-det").dataset.modelo;
    if (acc === "volver") verLista();
    else if (acc === "usar") usarModelo(id);
    else if (acc === "girar") girarModelo(id);
    else if (acc === "reja") { galPara = "reja"; verLista(); pintarGaleria(); }
  });
  $("#p-modelo-barra").addEventListener("click", () => mostrarGaleria(true));
}

function mostrarGaleria(volver = false) {
  galPara = est.item.modelo ? M.paraDe(est.item.tipo) : "porton";   // la primera vez, los portones
  $("#p-gal-volver").hidden = !volver;
  raiz.classList.add("p-en-galeria");
  $("#p-galeria").hidden = false;
  verLista();
  pintarGaleria();
  window.scrollTo(0, 0);
}

function ocultarGaleria() {
  raiz.classList.remove("p-en-galeria");
  $("#p-galeria").hidden = true;
  cerrar3D();
  requestAnimationFrame(() => { medirVista(); dibujar(); });
  window.scrollTo(0, 0);
}

function verLista() {
  $("#p-gal-det").hidden = true;
  $("#p-gal-lista").hidden = false;
}

function pintarGaleria() {
  for (const r of raiz.querySelectorAll('input[name="p-gal-para"]')) r.checked = r.value === galPara;
  $("#p-gal-ley").hidden = galPara !== "porton";
  const actual = est.item.modelo && M.paraDe(est.item.tipo) === galPara ? est.item.modelo : "";
  const tarjeta = (id, img, nom, desc, extra = "") => `<li><button type="button" class="p-modelo${id === M.LIBRE ? " p-libre" : ""}${id === actual ? " elegido" : ""}" data-modelo="${id}"${id === actual ? ' aria-current="true"' : ""}>
    <span class="p-modelo-img">${img}${extra}</span><span class="p-modelo-nom">${nom}</span><span class="p-modelo-desc">${desc}</span></button></li>`;
  $("#p-modelos").innerHTML =
    tarjeta(M.LIBRE, ICONO_LIBRE, "Diseño libre", "Arrancás con lo de siempre y lo armás como quieras.") +
    M.modelosDe(galPara).map((m) => tarjeta(m.id,
      `<img src="${M.imagenModelo(m.id, galPara)}" alt="" width="720" height="540" loading="lazy" decoding="async">`,
      esc(m.nombre), esc(m.desc), bloqueado(galPara) ? '<span class="tag">PRO</span>' : "")).join("");
}

/** Lo que trae un modelo, en renglones «rótulo: valor». */
function filasModelo(m) {
  const c = { ...P.ITEM_DEF, ...m.cambios }, out = [["Relleno", P.TEXTO[c.relleno]]];
  const horiz = c.relleno === "horizontales";
  if (c.trav_modo === "doble") {
    out.push(["Travesaños", "Doble al centro"], ["Franja libre", `${corto(c.franja, 1)} mm`]);
    out.push(["Barrotes en la franja", c.n_franja ? String(c.n_franja) : "Ninguno"]);
  } else {
    out.push([horiz ? "Montantes" : "Travesaños", c.n_trav ? String(c.n_trav) : "Sin travesaños"]);
  }
  if (c.n_panos > 1) out.push(["Paños a lo ancho", String(c.n_panos)]);
  if (c.armado === "pasantes" && c.n_trav > 0) out.push(["Armado", c.trav_lado === "atras" ? "Pasantes, travesaño atrás" : "Pasantes"]);
  if (c.relleno === "chapa" && c.n_panos === 1 && c.n_trav > 0) out.push(["Travesaño", "Atrás de la chapa"]);
  return out;
}

function verModelo(id) {
  const m = M.modelo(id);
  if (!m) return;
  const det = $("#p-gal-det"), bloq = bloqueado(galPara);
  det.dataset.modelo = id;
  det.innerHTML = `<button type="button" class="btn-sec btn-chico btn-quieto p-det-volver" data-acc="volver">← Modelos</button>
    <div class="p-det-cuerpo">
      <figure class="p-det-img"><img src="${M.imagenModelo(id, galPara)}" alt="${esc(m.nombre)}" width="720" height="540">
        ${bloq ? "" : `<button type="button" class="btn-3d p-det-girar" data-acc="girar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5Z"/><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5"/></svg>Girar en 3D</button>`}</figure>
      <div class="p-det-txt">
        <h2 class="p-det-tit">${esc(m.nombre)}</h2>
        <p class="p-det-desc">${esc(m.desc)}</p>
        <dl class="p-det-filas">${filasModelo(m).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        <p class="nota">${galPara === "porton" ? "Sirve para batiente de 1 o 2 hojas y corredizo: el tipo lo elegís después. " : ""}Tus medidas y perfiles no cambian; todo se puede modificar después.</p>
        <div class="p-det-acc">${bloq
          ? `<button type="button" class="btn-prim p-det-pro" data-abre-pro="portones">Hacelo con la PRO · ${PRECIO}</button>
             <p class="nota">En la versión de prueba: reja de ventana hasta ${miles(P.DEMO_LADOS[0])} × ${miles(P.DEMO_LADOS[1])} mm. <button type="button" class="enlace" data-acc="reja">Ver los modelos de reja</button></p>`
          : `<button type="button" class="btn-prim" data-acc="usar">Usar este modelo</button>`}
          <button type="button" class="btn-sec btn-quieto p-det-otro" data-acc="volver">Ver otro modelo</button></div>
      </div>
    </div>`;
  $("#p-gal-lista").hidden = true;
  det.hidden = false;
  window.scrollTo(0, 0);
}

/** El ítem del trabajo con el modelo (en la DEMO, «Diseño libre» de la pestaña de portones queda en la reja). */
const conModelo = (id) => M.aplicarModelo(est.item, id, id === M.LIBRE && bloqueado(galPara) ? "reja" : galPara);

function usarModelo(id) {
  if (id !== M.LIBRE && bloqueado(galPara)) { abrirPro("portones"); return; }
  est.item = conModelo(id);
  avisoDemo = "";
  sel = null;
  ocultarGaleria();
  ponerValores();
  programar(0);
}

/** «Girar en 3D» del detalle: el modelo sobre el trabajo actual (medidas y perfiles), sin cambiar el trabajo. */
function girarModelo(id) {
  const it = conModelo(id);
  const c = P.calcular([it], perfiles(), num(est.corte, 3), optimizarRapido);
  if (!c.resultados[0]) return;                       // con un error (p. ej. un perfil sin medidas) no hay qué mostrar
  abrir3D(c.resultados[0], perfiles(), opciones3D(it));
}

/** Barra arriba del dibujo: «Modelo: … · modificado» y «Cambiar» (vuelve a la galería). */
function ponerBarraModelo() {
  const b = $("#p-modelo-barra");
  if (!b) return;
  const id = est.item.modelo;
  b.hidden = !id;
  if (!id) return;
  $("#p-mb-nom").textContent = M.nombreModelo(id) || "Diseño libre";
  $("#p-mb-mod").hidden = !M.modificado(est.item);
}
