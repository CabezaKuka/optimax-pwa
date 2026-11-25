// Módulo Guillotina y melamina: rectángulos en planchas con cortes de lado a lado (cizalla, sierra de paneles).
// DEMO: las 144 combinaciones fijas, hasta 5 piezas, sin precio. PRO: la búsqueda completa del escritorio (por
// tiempo, sin trabar la pantalla), sin límite y precio por pieza (repo privado, guillotina/optimizar.js).
import { optimizarRapido, leerTexto, sumarFilas, textoCorte } from "../guillotina/motor.js";
import { recortar, numero, med, miles } from "../barras/motor.js";
import { corto } from "../geo/base.js";
import { cargarPro } from "../licencia.js";
import { ponerContexto } from "../hoja-pro.js";
import { abrirSalida, activarBoton, cerrarSalida } from "../salida.js";

const CLAVE = "optimax-guillotina";
const DEMO_PIEZAS = 5;
// planchas de ejemplo (lista de Max, 25-nov), sin precio: cada uno carga el suyo en «Editar planchas»
const PLANCHAS_EJEMPLO = [
  ["Plancha negra", 2000, 1000, 0.9], ["Plancha negra", 2000, 1000, 1], ["Plancha negra", 2000, 1000, 1.5],
  ["Plancha negra", 2000, 1000, 2], ["Plancha negra", 2000, 1000, 3], ["Plancha negra", 2000, 1000, 4.5],
  ["Plancha negra", 2000, 1000, 6], ["Melamina", 2440, 1220, 15], ["Melamina", 2440, 1220, 18],
  ["Tablero carpintero", 2440, 1220, 15], ["Tablero carpintero", 2440, 1220, 18],
].map(([material, largo, ancho, espesor]) => ({ material, largo, ancho, espesor, precio: 0 }));
const INICIAL = {
  largo: "2440", ancho: "1220", corte: "2", refilado: "0", max: "0", rotar: true,
  filas: [["600", "400", 2], ["300", "1200", 2], ["450", "450", 1]], precio: "", reparto: false,
  plancha: "Melamina 2440×1220×18 mm",            // la elegida; "" = otra medida (largo, ancho y precio a mano)
};
const PALETA = ["#a6ceff", "#ffd699", "#b2e8ba", "#ffb6c1", "#d6c4ff", "#fff499", "#9fe3e0", "#f5c6a5",
  "#c9e59a", "#e0c3e8"];

const $ = (s) => document.querySelector(s);
let raiz, pro, est, reloj, turno = 0, ultimo = null, salidaPdf = null;

function cargarMemoria() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(CLAVE)); } catch { m = null; }
  const out = { ...INICIAL, ...(m || {}) };
  if (m && !("plancha" in m)) out.plancha = "";          // guardado de antes: sigue con su medida a mano
  if (!Array.isArray(out.planchas)) out.planchas = PLANCHAS_EJEMPLO;
  out.planchas = out.planchas.map((p) => ({ ...p }));
  renombrar(out);
  return out;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch { /* sin almacenamiento */ }
}

export async function montar(cont) {
  raiz = cont;
  est = cargarMemoria();
  est.filas = est.filas.map(([a, l, c]) => [String(a), String(l), Math.max(1, Math.trunc(c) || 1)]);
  pro = await cargarPro("guillotina/optimizar.js");
  salidaPdf = pro ? await cargarPro("salidas/listas.js") : null;
  ponerContexto("Guillotina y melamina", "");
  cont.innerHTML = PLANTILLA;
  for (const k of ["largo", "ancho", "corte", "refilado", "max", "precio"]) $(`#g-${k}`).value = est[k];
  $("#g-rotar").checked = est.rotar;
  $("#g-reparto").checked = est.reparto;
  raiz.querySelector(".precio").classList.toggle("bloq", !pro);
  $("#g-precio-campo").classList.toggle("pe-bloq", !pro);
  $("#g-precio").disabled = !pro;
  opcionesPlanchas();
  armarEventos();
  dibujarFilas();
  calcular();
  if (salidaPdf) activarBoton($("#g-pdf"), "Imprimir o guardar en PDF", guardarPdf);
}

function guardarPdf() {
  if (!ultimo) return;
  const precio = precioPlancha() || 0;
  const r = ultimo;
  abrirSalida({
    titulo: "Plan de cortes en PDF",
    archivo: "Guillotina - plan de cortes.pdf",
    describir: () => `Hoja A4 apaisada por plancha (${r.n_planchas}), con los cortes numerados en orden y la lista de cortes; al final el control de piezas` +
      (precio > 0 ? " con el precio de cada una." : "."),
    armar: () => salidaPdf.pdfGuillotina(r, { precioPlancha: precio > 0 ? precio : null, costos: precio > 0 ? pro.costear(r, precio, 0, est.reparto) : null }),
  });
}

export function desmontar() {
  clearTimeout(reloj);
  cerrarSalida();
  turno++;                                         // cancela un cálculo PRO en marcha
  $("#hoja-pegar")?.close?.();
  $("#hoja-planchas")?.close?.();
}

const campoMm = (id, rotulo) => `<div class="campo"><label class="rotulo" for="g-${id}">${rotulo}</label>
  <span class="entrada"><input id="g-${id}" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">mm</span></span></div>`;

const PLANTILLA = `
<div class="app app-barras">
  <section class="b-datos" aria-label="Plancha y piezas">
    <h1 class="titulo-figura">Guillotina y melamina</h1>
    <div class="grupo">
    <h2 class="sub">Plancha <button type="button" class="btn-sec btn-chico" id="g-admin">Editar planchas</button></h2>
    <div class="campo campo-ancho"><label class="rotulo" for="g-plancha">Material</label>
      <select id="g-plancha" class="p-select"></select></div>
    <p class="nota g-pl-res" id="g-pl-res"></p>
    <div id="g-otra">
    ${campoMm("largo", "Largo de la plancha")}
    ${campoMm("ancho", "Ancho de la plancha")}
    <div class="campo" id="g-precio-campo"><label class="rotulo" for="g-precio">Precio de la plancha <span class="tag">PRO</span></label>
      <span class="entrada"><input id="g-precio" type="text" inputmode="decimal" spellcheck="false" placeholder="0"></span></div>
    </div>
    ${campoMm("refilado", "Refilado de los bordes")}
    </div>
    <div class="grupo">
    <h2 class="sub">Corte</h2>
    ${campoMm("corte", "Ancho del corte")}
    ${campoMm("max", "Largo máximo de corte (0 = sin límite)")}
    <label class="tilde"><input type="checkbox" id="g-rotar"> Las piezas se pueden girar (sin veta)</label>
    </div>

    <div class="grupo">
    <h2 class="sub">Piezas a cortar</h2>
    <div class="fila-tit fila-tit-g" aria-hidden="true"><span>Alto</span><span>Largo</span><span>Cantidad</span></div>
    <ul class="piezas" id="piezas"></ul>
    <div class="piezas-acc">
      <button type="button" class="btn-sec" id="g-agregar">Agregar pieza</button>
      <button type="button" class="btn-sec" id="g-pegar">Pegar lista</button>
      <button type="button" class="btn-sec btn-quieto" id="g-vaciar">Vaciar</button>
    </div>
    </div>
  </section>

  <section class="b-res" aria-label="Resultado" aria-live="polite">
    <p class="aviso-demo" id="g-demo" hidden></p>
    <div class="error-txt" id="g-error" role="alert" hidden></div>
    <p class="nota" id="g-calc" hidden>Calculando…</p>
    <div id="g-resultado">
      <div class="resumen" id="g-resumen"></div>
      <p class="nota" id="g-avisos" hidden></p>
      <div id="g-planchas"></div>
      <div class="precio grupo">
        <h2 class="sub">Precio por pieza <span class="tag">PRO</span></h2>
        <p class="nota" id="g-sin-precio" hidden>Cargá el precio de la plancha (en «Editar planchas») para ver el precio de cada pieza.</p>
        <label class="tilde"><input type="checkbox" id="g-reparto"> Repartir el sobrante en el precio</label>
        <button type="button" class="btn-bloq precio-pro" data-abre-pro="precio"><span class="candado" aria-hidden="true"></span>Ver el precio de cada pieza <span class="tag">PRO</span></button>
      </div>
      <div id="g-costo"></div>
    </div>
    <div class="acciones">
      <button type="button" class="btn-bloq" id="g-pdf" data-abre-pro="pdf"><span class="candado" aria-hidden="true"></span>Imprimir o guardar en PDF <span class="tag">PRO</span></button>
    </div>
    <p class="verificar">Verificá todas las medidas antes de cortar.</p>
  </section>
</div>

<dialog class="hoja-pro" id="hoja-pegar" aria-labelledby="pegar-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="pegar-tit">Pegar lista</h2>
    <p>Una pieza por renglón: alto, largo y cantidad. Sirve copiar de Excel, de un mensaje o escribir así:</p>
    <textarea id="pegar-txt" rows="7" placeholder="600 400 4&#10;300 x 1200 2&#10;450 450 3"></textarea>
    <p class="error-txt" id="pegar-avisos" hidden></p>
    <button type="button" class="btn-prim" id="pegar-ok">Agregar a la lista</button>
  </form>
</dialog>

<dialog class="hoja-pro hoja-perfiles" id="hoja-planchas" aria-labelledby="planchas-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="planchas-tit">Planchas</h2>
    <p class="nota">Tocá una plancha para cambiarla. El nombre se arma solo con el material y las medidas.</p>
    <ul class="perfiles" id="planchas"></ul>
    <button type="button" class="btn-sec pe-nuevo" id="plancha-nueva"><span aria-hidden="true">+</span> Agregar plancha</button>
    <div class="pe-pie"><button type="submit" class="btn-prim" value="listo">Listo</button></div>
  </form>
</dialog>`;

// ------------------------------------------------------------------ piezas
function dibujarFilas() {
  const ul = $("#piezas");
  ul.innerHTML = "";
  est.filas.forEach(([alto, largo, cant], i) => {
    const li = document.createElement("li");
    li.className = "pieza pieza-g";
    li.innerHTML = `<span class="entrada"><input type="text" inputmode="decimal" spellcheck="false" aria-label="Alto de la pieza ${i + 1}" value="${alto}"></span>
      <span class="entrada"><input type="text" inputmode="decimal" spellcheck="false" aria-label="Largo de la pieza ${i + 1}" value="${largo}"></span>
      <span class="paso" role="group" aria-label="Cantidad de la pieza ${i + 1}">
        <button type="button" class="menos" aria-label="Una menos">−</button><span class="cant">${cant}</span><button type="button" class="mas" aria-label="Una más">+</button>
      </span>
      <button type="button" class="borrar" aria-label="Sacar la pieza ${i + 1}">×</button>`;
    const [ia, il] = li.querySelectorAll("input");
    ia.addEventListener("input", () => { est.filas[i][0] = ia.value; programar(); });
    il.addEventListener("input", () => { est.filas[i][1] = il.value; programar(); });
    for (const inp of [ia, il]) inp.addEventListener("focus", () => inp.select());
    li.querySelector(".menos").addEventListener("click", () => { est.filas[i][2] = Math.max(1, est.filas[i][2] - 1); dibujarFilas(); programar(0); });
    li.querySelector(".mas").addEventListener("click", () => { est.filas[i][2] += 1; dibujarFilas(); programar(0); });
    li.querySelector(".borrar").addEventListener("click", () => { est.filas.splice(i, 1); dibujarFilas(); programar(0); });
    ul.append(li);
  });
}

function armarEventos() {
  for (const k of ["largo", "ancho", "corte", "refilado", "max", "precio"]) {
    const inp = $(`#g-${k}`);
    inp.addEventListener("input", () => { est[k] = inp.value; programar(k === "precio" ? 150 : 350); });
    inp.addEventListener("focus", () => inp.select());
  }
  $("#g-rotar").addEventListener("change", (e) => { est.rotar = e.target.checked; programar(0); });
  $("#g-plancha").addEventListener("change", (e) => elegirPlancha(e.target.value));
  $("#g-admin").addEventListener("click", abrirPlanchas);
  $("#plancha-nueva").addEventListener("click", nuevaPlancha);
  const hp = $("#hoja-planchas");
  hp.addEventListener("close", cerrarPlanchas);
  hp.addEventListener("click", (e) => { if (e.target === hp) hp.close(); else clickPlanchas(e); });
  $("#g-reparto").addEventListener("change", (e) => { est.reparto = e.target.checked; programar(0); });
  $("#g-agregar").addEventListener("click", () => {
    est.filas.push(["", "", 1]);
    dibujarFilas();
    const ins = raiz.querySelectorAll(".pieza input");
    ins[ins.length - 2].focus();
  });
  $("#g-vaciar").addEventListener("click", () => { est.filas = [["", "", 1]]; dibujarFilas(); programar(0); });
  const d = $("#hoja-pegar");
  $("#g-pegar").addEventListener("click", () => {
    $("#pegar-avisos").hidden = true;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    $("#pegar-txt").focus();
  });
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  $("#pegar-ok").addEventListener("click", () => {
    const [nuevas, avisos] = leerTexto($("#pegar-txt").value);
    if (!nuevas.length) {
      $("#pegar-avisos").textContent = avisos[0] || "No se encontró ninguna pieza en el texto.";
      $("#pegar-avisos").hidden = false;
      return;
    }
    const validas = est.filas.map(([a, l, c]) => {
      try { return [numero(a), numero(l), c]; } catch { return null; }
    }).filter(Boolean);
    const txt = (v) => med(v).replace(/\./g, "");
    est.filas = sumarFilas(validas, nuevas).map(([a, l, c]) => [txt(a), txt(l), c]);
    dibujarFilas();
    $("#pegar-txt").value = "";
    if (avisos.length) {
      $("#pegar-avisos").textContent = `Se agregaron ${nuevas.length} piezas. ${avisos.join(" ")}`;
      $("#pegar-avisos").hidden = false;
    } else d.close();
    programar(0);
  });
}

function programar(ms = 300) {
  clearTimeout(reloj);
  reloj = setTimeout(calcular, ms);
}

// ------------------------------------------------------------------ cálculo
function num(txt, rotulo, vacio = null) {
  if (String(txt).trim() === "" && vacio !== null) return vacio;
  try { return numero(txt); } catch { throw new Error(`${rotulo}: valor inválido.`); }
}

function leerDatos() {
  const pl = planchaElegida();
  const d = {
    largo: pl ? pl.largo : num(est.largo, "Largo de la plancha"), ancho: pl ? pl.ancho : num(est.ancho, "Ancho de la plancha"),
    corte: num(est.corte, "Ancho del corte", 0), refilado: num(est.refilado, "Refilado", 0), max: num(est.max, "Largo máximo de corte", 0),
  };
  d.filas = [];
  est.filas.forEach(([a, l, c], i) => {
    if (String(a).trim() === "" && String(l).trim() === "") return;          // renglón vacío
    const alto = num(a, `Pieza ${i + 1}, alto`), largo = num(l, `Pieza ${i + 1}, largo`);
    if (!(alto > 0 && largo > 0)) throw new Error(`Pieza ${i + 1}: las medidas tienen que ser mayores que 0.`);
    d.filas.push([alto, largo, c]);
  });
  return d;
}

async function calcular() {
  guardar();
  const mio = ++turno;
  const err = $("#g-error"), demo = $("#g-demo");
  err.hidden = true;
  demo.hidden = true;
  let res;
  try {
    const d = leerDatos();
    let filas = d.filas;
    if (!pro) {
      const [rec, quitadas] = recortar(filas, DEMO_PIEZAS);
      if (quitadas > 0) {
        filas = rec;
        demo.innerHTML = `La versión de prueba calcula hasta ${DEMO_PIEZAS} piezas: se calcularon las primeras ${DEMO_PIEZAS} y quedaron ${quitadas} afuera. ` +
          `<button type="button" class="enlace" data-abre-pro="guillotina">Calcular todas con la PRO</button>`;
        demo.hidden = false;
      }
      res = optimizarRapido(filas, d.largo, d.ancho, d.corte, d.refilado, d.max, est.rotar);
    } else {
      $("#g-calc").hidden = false;
      res = await pro.optimizarSinTrabar(filas, d.largo, d.ancho, d.corte, d.refilado, d.max, est.rotar,
        { limiteMs: 1500, cancelado: () => mio !== turno });
      if (mio !== turno || res === null) return;             // llegó otro cambio mientras calculaba
      $("#g-calc").hidden = true;
    }
  } catch (e) {
    if (mio !== turno) return;
    $("#g-calc").hidden = true;
    err.textContent = e.message;
    err.hidden = false;
    ultimo = null;
    $("#g-resultado").hidden = true;
    return;
  }
  $("#g-resultado").hidden = false;
  mostrar(res);
}

// ------------------------------------------------------------------ resultado
function mostrar(r) {
  ultimo = r;
  const n = r.n_planchas;
  const [rw, rh] = r.retazo;
  $("#g-resumen").innerHTML =
    `<div class="dato"><span class="dato-v">${n}</span><span class="dato-r">${n === 1 ? "plancha" : "planchas"} de ${med(r.W)} × ${med(r.H)}</span></div>` +
    `<div class="dato"><span class="dato-v">${miles(r.aprovechamiento * 100, 1, true)} %</span><span class="dato-r">aprovechado</span></div>` +
    `<div class="dato"><span class="dato-v dato-v-chico">${rw ? `${med(rw, 0)} × ${med(rh, 0)}` : "—"}</span><span class="dato-r">mm, el retazo más grande</span></div>`;
  const av = $("#g-avisos");
  av.textContent = r.avisos.join(" ");
  av.hidden = !r.avisos.length;
  const col = new Map(r.piezas_lista.map(([a, l], i) => [`${a}|${l}`, PALETA[i % PALETA.length]]));
  $("#g-planchas").innerHTML = r.planchas.map((pl, i) => plancha(r, pl, i, col)).join("");
  mostrarCosto(r);
}

/** Una plancha: piezas, retazos y cortes numerados (y hacia arriba, como en el escritorio). */
function plancha(r, pl, i, col) {
  const W = r.W, H = r.H, Y = (y, h) => H - y - h;
  const fs = Math.max(W, H) / 38;                          // letra en unidades de la plancha
  const m = fs * 0.9;                                      // margen: los números de los cortes del borde no se cortan
  const piezas = pl.piezas.map((p) => {
    const [alto, largo] = r.dims[p.idx];
    const color = col.get(`${alto}|${largo}`) || "#ddd";
    const txt = `${med(alto)}×${med(largo)}`;
    const cabe = p.w > txt.length * fs * 0.55 && p.h > fs * 1.4;
    return `<rect x="${p.x}" y="${Y(p.y, p.h)}" width="${p.w}" height="${p.h}" fill="${color}" stroke="#3c4752" stroke-width="${fs / 8}"/>` +
      (cabe ? `<text x="${p.x + p.w / 2}" y="${Y(p.y, p.h) + p.h / 2 + fs * 0.35}" font-size="${fs}" text-anchor="middle">${txt}</text>` : "");
  }).join("");
  const libres = pl.libres.map((l) => `<rect x="${l.x}" y="${Y(l.y, l.h)}" width="${l.w}" height="${l.h}" fill="url(#rayado-g${i})"/>`).join("");
  const cortes = pl.cortes.map((c) => {
    const [x1, y1, x2, y2] = c.orient === "V" ? [c.linea, c.y, c.linea, c.y + c.longitud] : [c.x, c.linea, c.x + c.longitud, c.linea];
    const mx = (x1 + x2) / 2, my = H - (y1 + y2) / 2;
    return `<line x1="${x1}" y1="${H - y1}" x2="${x2}" y2="${H - y2}" class="g-corte" stroke-width="${fs / 6}"/>` +
      `<circle cx="${mx}" cy="${my}" r="${fs * 0.75}" class="g-num"/><text x="${mx}" y="${my + fs * 0.33}" font-size="${fs * 0.9}" text-anchor="middle" class="g-num-t">${c.n}</text>`;
  }).join("");
  const lista = pl.cortes.map((c) => `<li><b>${c.n}.</b> ${textoCorte(c)}</li>`).join("");
  return `<figure class="g-plancha">
    <figcaption>Plancha ${i + 1}: ${pl.piezas.length} ${pl.piezas.length === 1 ? "pieza" : "piezas"}, ${pl.cortes.length} cortes</figcaption>
    <svg viewBox="${-m} ${-m} ${W + 2 * m} ${H + 2 * m}" role="img" aria-label="Plancha ${i + 1}">
      <defs><pattern id="rayado-g${i}" width="${fs}" height="${fs}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="${fs}" height="${fs}" fill="#eef1f4"/><path d="M0 0V${fs}" stroke="#d0d6dd" stroke-width="${fs / 3}"/></pattern></defs>
      <rect width="${W}" height="${H}" fill="#eef1f4" stroke="#3c4752" stroke-width="${fs / 5}"/>${libres}${piezas}${cortes}
    </svg>
    <details class="g-cortes"><summary>Orden de los cortes</summary><ol>${lista}</ol></details>
  </figure>`;
}

function mostrarCosto(r) {
  const cont = $("#g-costo");
  cont.innerHTML = "";
  $("#g-sin-precio").hidden = true;
  if (!pro) return;
  const precio = precioPlancha();
  if (!(precio > 0)) { $("#g-sin-precio").hidden = false; return; }
  const c = pro.costear(r, precio, 0, est.reparto);
  const d2 = (v) => miles(v, 2);
  cont.innerHTML = (c.reparto ? `<p class="nota">Con el sobrante repartido entre las piezas.</p>` : "") +
    `<table class="tabla"><thead><tr><th>Pieza</th><th>Cant.</th><th>c/u</th><th>Subtotal</th></tr></thead><tbody>` +
    c.filas.map((f) => `<tr><td>${med(f.alto)} × ${med(f.largo)}</td><td>${f.cant}</td><td>${d2(f.unit)}</td><td>${d2(f.subtotal)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td colspan="3">Total de las piezas</td><td>${d2(c.piezas)}</td></tr>` +
    (c.reparto ? "" : `<tr><td colspan="3">Sobrante (desperdicio)</td><td>${d2(c.sobrante)}</td></tr>`) +
    `<tr><td colspan="3">${r.n_planchas} ${r.n_planchas === 1 ? "plancha" : "planchas"}</td><td>${d2(c.total)}</td></tr></tfoot></table>`;
}

// ------------------------------------------------------------------ planchas (materiales)
// Como los materiales de la PC (Ajustes → Materiales), pero con el precio por plancha y sin peso (25-nov, Max).
// Nombre automático: material + largo × ancho × espesor. Igual nombre = repetida: se avisa y no se usa.
const TACHO = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const FLECHA = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let abierta = -1, borrando = -1;

function nombrePlancha(p) {
  const mat = String(p.material || "").trim().replace(/\s+/g, " ");
  const med3 = [p.largo, p.ancho].every((v) => Number(v) > 0)
    ? `${corto(p.largo, 1)}×${corto(p.ancho, 1)}${Number(p.espesor) > 0 ? `×${corto(p.espesor, 2)}` : ""} mm` : "";
  return [mat, med3].filter(Boolean).join(" ") || "Plancha";
}
const repetida = (lista, i) => lista.slice(0, i).some((o) => o.nombre === lista[i].nombre);
const valida = (p) => String(p.material || "").trim() !== "" && Number(p.largo) > 0 && Number(p.ancho) > 0;

/** Nombres automáticos; la plancha elegida sigue a su nombre nuevo. */
function renombrar(e = est) {
  const antes = e.planchas.map((p) => p.nombre);
  e.planchas.forEach((p) => { p.nombre = nombrePlancha(p); });
  const i = antes.indexOf(e.plancha);
  if (e.plancha && i >= 0) e.plancha = e.planchas[i].nombre;
}
const usables = () => est.planchas.filter((p, i) => valida(p) && !repetida(est.planchas, i));
const planchaElegida = () => (est.plancha ? usables().find((p) => p.nombre === est.plancha) || null : null);
function precioPlancha() {
  const pl = planchaElegida();
  if (pl) return Number(pl.precio) || 0;
  try { return String(est.precio).trim() === "" ? 0 : numero(est.precio); } catch { return NaN; }
}

/** Desplegable «Material» de la tarjeta Plancha y lo que se ve según la elección. */
function opcionesPlanchas() {
  const s = $("#g-plancha");
  if (!s) return;
  const ps = usables();
  if (est.plancha && !ps.some((p) => p.nombre === est.plancha)) est.plancha = "";
  s.innerHTML = ps.map((p) => `<option value="${esc(p.nombre)}">${esc(p.nombre)}</option>`).join("") +
    `<option value="">Otra medida</option>`;
  s.value = est.plancha;
  const pl = planchaElegida();
  $("#g-otra").hidden = !!pl;
  const res = $("#g-pl-res");
  res.hidden = !pl || !pro;                              // en la DEMO repetiría el nombre
  if (pl && pro) {
    res.textContent = Number(pl.precio) > 0 ? `Precio de la plancha: ${miles(pl.precio, 2)}` : "Sin precio: cargalo en «Editar planchas».";
  }
}

function elegirPlancha(nombre) {
  const pl = usables().find((p) => p.nombre === nombre);
  if (!pl && planchaElegida()) {                         // pasa a «Otra medida» con la medida que tenía
    const viejo = planchaElegida();
    est.largo = corto(viejo.largo, 1); est.ancho = corto(viejo.ancho, 1);
    $("#g-largo").value = est.largo; $("#g-ancho").value = est.ancho;
  }
  est.plancha = pl ? pl.nombre : "";
  opcionesPlanchas();
  programar(0);
}

function abrirPlanchas() {
  abierta = -1; borrando = -1;
  dibujarPlanchas();
  const d = $("#hoja-planchas");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

/** Al cerrar: se descartan las nuevas sin material ni medidas. */
function cerrarPlanchas() {
  const antes = est.planchas.length;
  est.planchas = est.planchas.filter((p) => String(p.material || "").trim() !== "" || !p._nueva);
  for (const p of est.planchas) delete p._nueva;
  if (est.planchas.length !== antes) renombrar();
  abierta = -1; borrando = -1;
  opcionesPlanchas();
  programar(0);
}

function estadoPlancha(i) {
  const p = est.planchas[i];
  if (!String(p.material || "").trim()) return { mal: true, res: "Falta el material", aviso: "Escribí el material (ej. Melamina blanca).", gris: true };
  if (!(Number(p.largo) > 0 && Number(p.ancho) > 0)) return { mal: true, res: "Faltan las medidas", aviso: "El largo y el ancho tienen que ser mayores que 0." };
  if (repetida(est.planchas, i)) return { mal: true, res: "Repetida", aviso: "Ya tenés esa plancha (mismo material y medidas)." };
  const precio = Number(p.precio) > 0 ? `precio ${miles(p.precio, 2)}` : "sin precio";
  return { mal: false, res: precio, aviso: p.nombre === est.plancha ? "Es la plancha elegida." : "", gris: true };
}

function dibujarPlanchas() {
  const ul = $("#planchas");
  ul.innerHTML = est.planchas.map((p, i) => {
    const e = estadoPlancha(i), ab = i === abierta;
    const num = (c, rot, v, uni = "mm") => `<label class="pe-c"><span>${rot}</span><span class="entrada"><input data-c="${c}" type="text" inputmode="decimal" value="${v}">${uni ? `<span class="unidad">${uni}</span>` : ""}</span></label>`;
    return `<li class="perfil-ed${ab ? " abierto" : ""}${e.mal ? " mal" : ""}" data-i="${i}">
      <button type="button" class="pe-cab" aria-expanded="${ab}">
        <span class="pe-tit">${esc(p.nombre)}</span>
        <span class="pe-res">${esc(e.res)}</span>
        <span class="pe-flecha">${FLECHA}</span>
      </button>
      <div class="pe-cuerpo"${ab ? "" : " hidden"}>
        <label class="pe-c pe-ancho"><span>Material</span><span class="entrada"><input data-c="material" type="text" autocomplete="off" placeholder="ej. Melamina blanca" value="${esc(p.material || "")}"></span></label>
        ${num("largo", "Largo", Number(p.largo) > 0 ? corto(p.largo, 1) : "")}
        ${num("ancho", "Ancho", Number(p.ancho) > 0 ? corto(p.ancho, 1) : "")}
        ${num("espesor", "Espesor", Number(p.espesor) > 0 ? corto(p.espesor, 2) : "")}
        <label class="pe-c${pro ? "" : " pe-bloq"}"><span>Precio de la plancha${pro ? "" : " (PRO)"}</span><span class="entrada"><input data-c="precio" type="text" inputmode="decimal" placeholder="0" value="${Number(p.precio) > 0 ? corto(p.precio, 2) : ""}"${pro ? "" : " disabled"}></span></label>
        <p class="pe-estado${e.gris ? "" : " perfil-mal"}">${esc(e.aviso)}</p>
        ${i === borrando ? `<div class="pe-confirma" role="alert">
          <p>¿Borrar <b>${esc(p.nombre)}</b>?${p.nombre === est.plancha ? " Es la plancha elegida: queda su medida como «Otra medida»." : ""}</p>
          <div class="pe-confirma-b"><button type="button" class="btn-sec btn-quieto" data-acc="no">Cancelar</button><button type="button" class="pe-si" data-acc="si">Borrar</button></div>
        </div>` : `<button type="button" class="pe-borrar" data-acc="borrar">${TACHO}Borrar plancha</button>`}
      </div></li>`;
  }).join("");
  for (const inp of ul.querySelectorAll("[data-c]")) {
    const i = Number(inp.closest(".perfil-ed").dataset.i), c = inp.dataset.c;
    inp.addEventListener("input", () => cambioPlancha(i, c, inp));
    inp.addEventListener("focus", () => { if (c !== "material") inp.select(); });
  }
}

function clickPlanchas(e) {
  const li = e.target.closest("#planchas .perfil-ed");
  if (!li) return;
  const i = Number(li.dataset.i);
  if (e.target.closest(".pe-cab")) {
    abierta = abierta === i ? -1 : i; borrando = -1;
    dibujarPlanchas();
    if (abierta === i) $(`#planchas .perfil-ed[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
    return;
  }
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (!acc) return;
  if (acc === "borrar") borrando = i;
  else if (acc === "no") borrando = -1;
  else if (acc === "si") {
    const p = est.planchas[i];
    if (p.nombre === est.plancha) elegirPlancha("");    // queda la medida a mano
    est.planchas.splice(i, 1);
    abierta = -1; borrando = -1;
    renombrar(); opcionesPlanchas(); programar(0);
  }
  dibujarPlanchas();
}

function nuevaPlancha() {
  est.planchas.push({ material: "", largo: 2440, ancho: 1220, espesor: 0, precio: 0, _nueva: true });
  renombrar();
  abierta = est.planchas.length - 1; borrando = -1;
  dibujarPlanchas();
  const inp = $(`#planchas .perfil-ed[data-i="${abierta}"] [data-c="material"]`);
  inp?.closest(".perfil-ed").scrollIntoView({ block: "nearest" });
  inp?.focus();
}

/** Actualiza nombres, resúmenes y avisos sin volver a dibujar (no se pierde el foco ni el teclado). */
function refrescarPlanchas() {
  for (const li of $("#planchas").querySelectorAll(".perfil-ed")) {
    const i = Number(li.dataset.i), e = estadoPlancha(i);
    li.querySelector(".pe-tit").textContent = est.planchas[i].nombre;
    li.querySelector(".pe-res").textContent = e.res;
    li.classList.toggle("mal", e.mal);
    const av = li.querySelector(".pe-estado");
    av.textContent = e.aviso;
    av.classList.toggle("perfil-mal", !e.gris);
  }
}

function cambioPlancha(i, c, inp) {
  const p = est.planchas[i];
  if (c === "material") p.material = inp.value;
  else {
    let v;
    try { v = inp.value.trim() === "" ? 0 : numero(inp.value); } catch { v = NaN; }
    const ok = v >= 0 && (!(c === "largo" || c === "ancho") || v > 0);
    inp.closest(".entrada").classList.toggle("mal", !ok);
    if (!ok) return;
    p[c] = v;
  }
  renombrar();
  refrescarPlanchas();
  opcionesPlanchas();
  programar(250);
}
