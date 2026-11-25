// Módulo Guillotina y melamina: rectángulos en planchas con cortes de lado a lado (cizalla, sierra de paneles).
// DEMO: las 144 combinaciones fijas, hasta 5 piezas, sin precio. PRO: la búsqueda completa del escritorio (por
// tiempo, sin trabar la pantalla), sin límite y precio por pieza (repo privado, guillotina/optimizar.js).
import { optimizarRapido, leerTexto, sumarFilas, textoCorte } from "../guillotina/motor.js";
import { recortar, numero, med, miles } from "../barras/motor.js";
import { cargarPro } from "../licencia.js";
import { ponerContexto } from "../hoja-pro.js";

const CLAVE = "optimax-guillotina";
const DEMO_PIEZAS = 5;
const INICIAL = {
  largo: "2440", ancho: "1220", corte: "2", refilado: "0", max: "0", rotar: true,
  filas: [["600", "400", 2], ["300", "1200", 2], ["450", "450", 1]], precio: "", reparto: false,
};
const PALETA = ["#a6ceff", "#ffd699", "#b2e8ba", "#ffb6c1", "#d6c4ff", "#fff499", "#9fe3e0", "#f5c6a5",
  "#c9e59a", "#e0c3e8"];

const $ = (s) => document.querySelector(s);
let raiz, pro, est, reloj, turno = 0;

function cargarMemoria() {
  try { return { ...INICIAL, ...(JSON.parse(localStorage.getItem(CLAVE)) || {}) }; } catch { return { ...INICIAL }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch { /* sin almacenamiento */ }
}

export async function montar(cont) {
  raiz = cont;
  est = cargarMemoria();
  est.filas = est.filas.map(([a, l, c]) => [String(a), String(l), Math.max(1, Math.trunc(c) || 1)]);
  pro = await cargarPro("guillotina/optimizar.js");
  ponerContexto("Guillotina y melamina", "");
  cont.innerHTML = PLANTILLA;
  for (const k of ["largo", "ancho", "corte", "refilado", "max", "precio"]) $(`#g-${k}`).value = est[k];
  $("#g-rotar").checked = est.rotar;
  $("#g-reparto").checked = est.reparto;
  raiz.querySelector(".precio").classList.toggle("bloq", !pro);
  armarEventos();
  dibujarFilas();
  calcular();
}

export function desmontar() {
  clearTimeout(reloj);
  turno++;                                         // cancela un cálculo PRO en marcha
  $("#hoja-pegar")?.close?.();
}

const campoMm = (id, rotulo) => `<div class="campo"><label class="rotulo" for="g-${id}">${rotulo}</label>
  <span class="entrada"><input id="g-${id}" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">mm</span></span></div>`;

const PLANTILLA = `
<div class="app app-barras">
  <section class="b-datos" aria-label="Plancha y piezas">
    <h1 class="titulo-figura">Guillotina y melamina</h1>
    ${campoMm("largo", "Largo de la plancha")}
    ${campoMm("ancho", "Ancho de la plancha")}
    ${campoMm("corte", "Ancho del corte")}
    ${campoMm("refilado", "Refilado de los bordes")}
    ${campoMm("max", "Largo máximo de corte (0 = sin límite)")}
    <label class="tilde"><input type="checkbox" id="g-rotar"> Las piezas se pueden girar (sin veta)</label>

    <h2 class="sub">Piezas a cortar</h2>
    <div class="fila-tit fila-tit-g" aria-hidden="true"><span>Alto</span><span>Largo</span><span>Cantidad</span></div>
    <ul class="piezas" id="piezas"></ul>
    <div class="piezas-acc">
      <button type="button" class="btn-sec" id="g-agregar">Agregar pieza</button>
      <button type="button" class="btn-sec" id="g-pegar">Pegar lista</button>
      <button type="button" class="btn-sec btn-quieto" id="g-vaciar">Vaciar</button>
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
      <div class="precio">
        <h2 class="sub">Precio por pieza <span class="tag">PRO</span></h2>
        <div class="campo"><label class="rotulo" for="g-precio">Precio de una plancha</label>
          <span class="entrada"><input id="g-precio" type="text" inputmode="decimal" spellcheck="false" placeholder="0"></span></div>
        <label class="tilde"><input type="checkbox" id="g-reparto"> Repartir el sobrante en el precio</label>
        <button type="button" class="btn-bloq precio-pro" data-abre-pro="precio"><span class="candado" aria-hidden="true"></span>Ver el precio de cada pieza <span class="tag">PRO</span></button>
      </div>
      <div id="g-costo"></div>
    </div>
    <div class="acciones">
      <button type="button" class="btn-bloq" data-abre-pro="pdf"><span class="candado" aria-hidden="true"></span>Imprimir o guardar en PDF <span class="tag">PRO</span></button>
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
  const d = {
    largo: num(est.largo, "Largo de la plancha"), ancho: num(est.ancho, "Ancho de la plancha"),
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
    $("#g-resultado").hidden = true;
    return;
  }
  $("#g-resultado").hidden = false;
  mostrar(res);
}

// ------------------------------------------------------------------ resultado
function mostrar(r) {
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
  if (!pro) return;
  let precio = 0;
  try { precio = String(est.precio).trim() === "" ? 0 : numero(est.precio); } catch { precio = NaN; }
  if (!(precio > 0)) return;
  const c = pro.costear(r, precio, 0, est.reparto);
  const d2 = (v) => miles(v, 2);
  cont.innerHTML = (c.reparto ? `<p class="nota">Con el sobrante repartido entre las piezas.</p>` : "") +
    `<table class="tabla"><thead><tr><th>Pieza</th><th>Cant.</th><th>c/u</th><th>Subtotal</th></tr></thead><tbody>` +
    c.filas.map((f) => `<tr><td>${med(f.alto)} × ${med(f.largo)}</td><td>${f.cant}</td><td>${d2(f.unit)}</td><td>${d2(f.subtotal)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td colspan="3">Total de las piezas</td><td>${d2(c.piezas)}</td></tr>` +
    (c.reparto ? "" : `<tr><td colspan="3">Sobrante (desperdicio)</td><td>${d2(c.sobrante)}</td></tr>`) +
    `<tr><td colspan="3">${r.n_planchas} ${r.n_planchas === 1 ? "plancha" : "planchas"}</td><td>${d2(c.total)}</td></tr></tfoot></table>`;
}
