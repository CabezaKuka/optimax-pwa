// Módulo Barras y tubos: cómo cortar las barras para aprovecharlas mejor.
// DEMO: cálculo rápido, hasta 5 piezas (sumando cantidades), sin precio. PRO: optimizador completo del escritorio,
// sin límite y precio por pieza (repo privado, barras/optimizar.js).
import { optimizarRapido, leerTexto, sumarFilas, recortar, numero, med, miles } from "../barras/motor.js";
import { cargarPro } from "../licencia.js";
import { ponerContexto } from "../hoja-pro.js";
import { abrirSalida, activarBoton, cerrarSalida } from "../salida.js";

const CLAVE = "optimax-barras";
const DEMO_PIEZAS = 5;
const INICIAL = { largo: "6000", corte: "3", filas: [["1200", 2], ["800", 2], ["450", 1]], precio: "", reparto: false };
// colores de las piezas (los del PDF del escritorio, barras.PALETA)
const PALETA = ["#a6ceff", "#ffd699", "#b2e8ba", "#ffb6c1", "#d6c4ff", "#fff499", "#9fe3e0", "#f5c6a5",
  "#c9e59a", "#e0c3e8"];

const $ = (s) => document.querySelector(s);
let raiz, pro, est, reloj, ultimo = null, salidaPdf = null;

function cargarMemoria() {
  try { return { ...INICIAL, ...(JSON.parse(localStorage.getItem(CLAVE)) || {}) }; } catch { return { ...INICIAL }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch { /* sin almacenamiento */ }
}

export async function montar(cont) {
  raiz = cont;
  est = cargarMemoria();
  est.filas = est.filas.map(([l, c]) => [String(l), Math.max(1, Math.trunc(c) || 1)]);
  pro = await cargarPro("barras/optimizar.js");
  salidaPdf = pro ? await cargarPro("salidas/listas.js") : null;
  ponerContexto("Barras y tubos", "");
  cont.innerHTML = PLANTILLA;
  $("#b-largo").value = est.largo;
  $("#b-corte").value = est.corte;
  $("#b-precio").value = est.precio;
  $("#b-reparto").checked = est.reparto;
  raiz.querySelector(".precio").classList.toggle("bloq", !pro);
  armarEventos();
  dibujarFilas();
  calcular();
  if (salidaPdf) activarBoton($("#b-pdf"), "Imprimir o guardar en PDF", guardarPdf);
}

function guardarPdf() {
  if (!ultimo) return;
  let precio = 0;
  try { precio = String(est.precio).trim() === "" ? 0 : numero(est.precio); } catch { precio = 0; }
  const r = ultimo;
  abrirSalida({
    titulo: "Lista de corte en PDF",
    archivo: "Barras - lista de corte.pdf",
    describir: () => "Hoja A4 apaisada: cada barra dibujada con la medida de sus piezas y el control de las piezas pedidas" +
      (precio > 0 ? ", con el precio de cada una." : "."),
    armar: () => salidaPdf.pdfBarras(r, { precioBarra: precio > 0 ? precio : null, costos: precio > 0 ? pro.costear(r, precio, 0, est.reparto) : null }),
  });
}

export function desmontar() {
  clearTimeout(reloj);
  cerrarSalida();
  $("#hoja-pegar")?.close?.();
}

const PLANTILLA = `
<div class="app app-barras">
  <section class="b-datos" aria-label="Barra y piezas">
    <h1 class="titulo-figura">Barras y tubos</h1>
    <div class="campo"><label class="rotulo" for="b-largo">Largo de la barra</label>
      <span class="entrada"><input id="b-largo" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">mm</span></span></div>
    <div class="campo"><label class="rotulo" for="b-corte">Ancho del corte (sierra o disco)</label>
      <span class="entrada"><input id="b-corte" type="text" inputmode="decimal" spellcheck="false"><span class="unidad">mm</span></span></div>

    <h2 class="sub">Piezas a cortar</h2>
    <div class="fila-tit" aria-hidden="true"><span>Largo (mm)</span><span>Cantidad</span></div>
    <ul class="piezas" id="piezas"></ul>
    <div class="piezas-acc">
      <button type="button" class="btn-sec" id="b-agregar">Agregar pieza</button>
      <button type="button" class="btn-sec" id="b-pegar">Pegar lista</button>
      <button type="button" class="btn-sec btn-quieto" id="b-vaciar">Vaciar</button>
    </div>

  </section>

  <section class="b-res" aria-label="Resultado" aria-live="polite">
    <p class="aviso-demo" id="b-demo" hidden></p>
    <div class="error-txt" id="b-error" role="alert" hidden></div>
    <div id="b-resultado">
      <div class="resumen" id="b-resumen"></div>
      <div class="barras-dib" id="b-dib"></div>
      <h2 class="sub">Lista de corte</h2>
      <ol class="lista-corte" id="b-lista"></ol>
    <div class="precio">
        <h2 class="sub">Precio por pieza <span class="tag">PRO</span></h2>
        <div class="campo"><label class="rotulo" for="b-precio">Precio de una barra</label>
          <span class="entrada"><input id="b-precio" type="text" inputmode="decimal" spellcheck="false" placeholder="0"></span></div>
        <label class="tilde"><input type="checkbox" id="b-reparto"> Repartir el sobrante en el precio</label>
        <button type="button" class="btn-bloq precio-pro" data-abre-pro="precio"><span class="candado" aria-hidden="true"></span>Ver el precio de cada pieza <span class="tag">PRO</span></button>
      </div>
      <div id="b-costo"></div>
    </div>
    <div class="acciones">
      <button type="button" class="btn-bloq" id="b-pdf" data-abre-pro="pdf"><span class="candado" aria-hidden="true"></span>Imprimir o guardar en PDF <span class="tag">PRO</span></button>
    </div>
    <p class="verificar">Verificá todas las medidas antes de cortar o fabricar.</p>
  </section>
</div>

<dialog class="hoja-pro" id="hoja-pegar" aria-labelledby="pegar-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="pegar-tit">Pegar lista</h2>
    <p>Un largo por renglón y, al lado, la cantidad. Sirve copiar de Excel, de un mensaje o escribir así:</p>
    <textarea id="pegar-txt" rows="7" placeholder="1200 4&#10;800 6&#10;450 10"></textarea>
    <p class="error-txt" id="pegar-avisos" hidden></p>
    <button type="button" class="btn-prim" id="pegar-ok">Agregar a la lista</button>
  </form>
</dialog>`;

// ------------------------------------------------------------------ piezas
function dibujarFilas() {
  const ul = $("#piezas");
  ul.innerHTML = "";
  est.filas.forEach(([largo, cant], i) => {
    const li = document.createElement("li");
    li.className = "pieza";
    li.innerHTML = `<span class="entrada"><input type="text" inputmode="decimal" spellcheck="false" aria-label="Largo de la pieza ${i + 1}" value="${largo}"><span class="unidad">mm</span></span>
      <span class="paso" role="group" aria-label="Cantidad de la pieza ${i + 1}">
        <button type="button" class="menos" aria-label="Una menos">−</button><span class="cant">${cant}</span><button type="button" class="mas" aria-label="Una más">+</button>
      </span>
      <button type="button" class="borrar" aria-label="Sacar la pieza ${i + 1}">×</button>`;
    const inp = li.querySelector("input");
    inp.addEventListener("input", () => { est.filas[i][0] = inp.value; programar(); });
    inp.addEventListener("focus", () => inp.select());
    li.querySelector(".menos").addEventListener("click", () => { est.filas[i][1] = Math.max(1, est.filas[i][1] - 1); dibujarFilas(); programar(0); });
    li.querySelector(".mas").addEventListener("click", () => { est.filas[i][1] += 1; dibujarFilas(); programar(0); });
    li.querySelector(".borrar").addEventListener("click", () => { est.filas.splice(i, 1); dibujarFilas(); programar(0); });
    ul.append(li);
  });
}

function armarEventos() {
  for (const [id, k] of [["#b-largo", "largo"], ["#b-corte", "corte"], ["#b-precio", "precio"]]) {
    const inp = $(id);
    inp.addEventListener("input", () => { est[k] = inp.value; programar(); });
    inp.addEventListener("focus", () => inp.select());
  }
  $("#b-reparto").addEventListener("change", (e) => { est.reparto = e.target.checked; programar(0); });
  $("#b-agregar").addEventListener("click", () => {
    est.filas.push(["", 1]);
    dibujarFilas();
    const ins = raiz.querySelectorAll(".pieza input");
    ins[ins.length - 1].focus();
  });
  $("#b-vaciar").addEventListener("click", () => { est.filas = [["", 1]]; dibujarFilas(); programar(0); });
  const d = $("#hoja-pegar");
  $("#b-pegar").addEventListener("click", () => {
    $("#pegar-avisos").hidden = true;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    $("#pegar-txt").focus();
  });
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  $("#pegar-ok").addEventListener("click", () => {
    const [nuevas, avisos] = leerTexto($("#pegar-txt").value);
    if (!nuevas.length) {
      $("#pegar-avisos").textContent = avisos[0] || "No se encontró ningún largo en el texto.";
      $("#pegar-avisos").hidden = false;
      return;
    }
    // se suman a las filas válidas; las vacías se descartan
    const validas = est.filas.filter(([l]) => String(l).trim() !== "").map(([l, c]) => {
      try { return [numero(l), c]; } catch { return null; }
    }).filter(Boolean);
    est.filas = sumarFilas(validas, nuevas).map(([l, c]) => [med(l).replace(/\./g, ""), c]);
    dibujarFilas();
    $("#pegar-txt").value = "";
    if (avisos.length) {
      $("#pegar-avisos").textContent = `Se agregaron ${nuevas.length} largos. ${avisos.join(" ")}`;
      $("#pegar-avisos").hidden = false;
    } else d.close();
    programar(0);
  });
}

function programar(ms = 250) {
  clearTimeout(reloj);
  reloj = setTimeout(calcular, ms);
}

// ------------------------------------------------------------------ cálculo
function leerDatos() {
  let barra, corte;
  try { barra = numero(est.largo); } catch { throw new Error("Largo de la barra: valor inválido."); }
  try { corte = est.corte.trim() === "" ? 0 : numero(est.corte); } catch { throw new Error("Ancho del corte: valor inválido."); }
  const filas = [];
  est.filas.forEach(([l, c], i) => {
    if (String(l).trim() === "") return;                       // renglón vacío: se ignora
    let v;
    try { v = numero(l); } catch { throw new Error(`Pieza ${i + 1}: largo inválido «${l}».`); }
    if (!(v > 0)) throw new Error(`Pieza ${i + 1}: el largo tiene que ser mayor que 0.`);
    filas.push([v, c]);
  });
  return { barra, corte, filas };
}

function calcular() {
  guardar();
  const err = $("#b-error"), demo = $("#b-demo");
  err.hidden = true;
  demo.hidden = true;
  let datos;
  try {
    datos = leerDatos();
    let filas = datos.filas;
    if (!pro) {
      const [rec, quitadas] = recortar(filas, DEMO_PIEZAS);
      if (quitadas > 0) {
        filas = rec;
        demo.innerHTML = `La versión de prueba calcula hasta ${DEMO_PIEZAS} piezas: se calcularon las primeras ${DEMO_PIEZAS} y quedaron ${quitadas} afuera. ` +
          `<button type="button" class="enlace" data-abre-pro="barras">Calcular todas con la PRO</button>`;
        demo.hidden = false;
      }
    }
    ultimo = (pro ? pro.optimizar : optimizarRapido)(filas, datos.barra, datos.corte);
  } catch (e) {
    ultimo = null;
    err.textContent = e.message;
    err.hidden = false;
    $("#b-resultado").hidden = true;
    return;
  }
  $("#b-resultado").hidden = false;
  mostrar(ultimo);
}

// ------------------------------------------------------------------ resultado
function colores(r) {
  const c = new Map();
  r.pedidas.forEach(([l], i) => c.set(l, PALETA[i % PALETA.length]));
  return c;
}

function mostrar(r) {
  const n = r.n_barras;
  $("#b-resumen").innerHTML =
    `<div class="dato"><span class="dato-v">${n}</span><span class="dato-r">${n === 1 ? "barra" : "barras"} de ${med(r.barra)} mm</span></div>` +
    `<div class="dato"><span class="dato-v">${miles(r.aprovechamiento * 100, 1, true)} %</span><span class="dato-r">aprovechado</span></div>` +
    `<div class="dato"><span class="dato-v">${med(r.retazo, 0)}</span><span class="dato-r">mm, el retazo más largo</span></div>`;
  const col = colores(r);
  // una fila por patrón (barras iguales juntas)
  const pct = (v) => `${((v / r.barra) * 100).toFixed(3)}%`;
  $("#b-dib").innerHTML = r.patrones.map((p) => {
    const seg = p.piezas.map((l, k) => {
      const ancho = (l / r.barra) * 100;
      const gap = k < p.piezas.length - 1 ? `margin-right:${pct(r.corte)};` : "";
      // rótulo: normal si hay lugar, chico en piezas angostas, nada en las muy angostas (están en la lista)
      const cls = ancho > 10 ? "seg" : ancho > 5 ? "seg chico" : "seg";
      return `<span class="${cls}" style="width:${ancho.toFixed(3)}%;${gap}background:${col.get(Math.round(l * 1e4) / 1e4) || "#ddd"}">` +
        (ancho > 5 ? med(l) : "") + "</span>";
    }).join("");
    const ps = (p.sobrante / r.barra) * 100;
    const txt = ps > 20 ? `sobra ${med(p.sobrante, 0)}` : ps > 8 ? med(p.sobrante, 0) : "";
    const sob = p.sobrante > 0.5 ? `<span class="seg sobra" style="flex:1">${txt}</span>` : "";
    return `<div class="barra-fila"><span class="barra-n">×${p.n}</span>
      <div class="barra" role="img" aria-label="${p.n} ${p.n === 1 ? "barra" : "barras"}: ${p.piezas.map((l) => med(l)).join(" + ")}">${seg}${sob}</div></div>`;
  }).join("");
  $("#b-lista").innerHTML = r.patrones.map((p) =>
    `<li><span class="lc-n">${p.n} ${p.n === 1 ? "barra" : "barras"}:</span> <span class="lc-p">${p.piezas.map((l) => med(l)).join(" + ")}</span>` +
    `<span class="lc-s">sobran ${med(p.sobrante)} mm</span></li>`).join("");
  mostrarCosto(r);
}

function mostrarCosto(r) {
  const cont = $("#b-costo");
  cont.innerHTML = "";
  if (!pro) return;
  let precio = 0;
  try { precio = est.precio.trim() === "" ? 0 : numero(est.precio); } catch { precio = NaN; }
  if (!(precio > 0)) return;
  const c = pro.costear(r, precio, 0, est.reparto);
  const d2 = (v) => miles(v, 2);
  cont.innerHTML = (c.reparto ? `<p class="nota">Con el sobrante repartido entre las piezas.</p>` : "") + `
    <table class="tabla"><thead><tr><th>Largo</th><th>Cant.</th><th>c/u</th><th>Subtotal</th></tr></thead><tbody>` +
    c.filas.map((f) => `<tr><td>${med(f.largo)}</td><td>${f.cant}</td><td>${d2(f.unit)}</td><td>${d2(f.subtotal)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td colspan="3">Total de las piezas</td><td>${d2(c.piezas)}</td></tr>` +
    (c.reparto ? "" : `<tr><td colspan="3">Sobrante (desperdicio)</td><td>${d2(c.sobrante)}</td></tr>`) +
    `<tr><td colspan="3">${r.n_barras} ${r.n_barras === 1 ? "barra" : "barras"}</td><td>${d2(c.total)}</td></tr></tfoot></table>`;
}

