// Hoja «Imprimir / guardar en PDF», la misma para todos los módulos: opciones (si hay), cuántas páginas salen,
// «Armar el PDF» y después Descargar o Compartir (WhatsApp, Drive, la imprenta). El PDF lo arma el código PRO, en el
// celular y sin internet; esta hoja solo lo entrega.
let d = null, actual = null, ultimo = null;

const HTML = `
<dialog class="hoja-pro hoja-salida" id="hoja-salida" aria-labelledby="s-tit">
  <form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="s-tit"></h2>
    <div class="s-opciones" id="s-op" role="radiogroup"></div>
    <p class="s-desc" id="s-desc"></p>
    <p class="error-txt" id="s-error" role="alert" hidden></p>
    <button type="button" class="btn-prim" id="s-armar">Armar el PDF</button>
    <div id="s-listo" hidden>
      <p class="s-ok"><b>PDF listo</b> <span id="s-info"></span></p>
      <div class="s-botones">
        <button type="button" class="btn-prim" id="s-descargar">Descargar</button>
        <button type="button" class="btn-sec" id="s-compartir" hidden>Compartir</button>
      </div>
      <p class="nota" id="s-nota"></p>
    </div>
  </form>
</dialog>`;

function armarHoja() {
  if (d && d.isConnected) return;
  document.body.insertAdjacentHTML("beforeend", HTML);
  d = document.querySelector("#hoja-salida");
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.querySelector("#s-armar").addEventListener("click", armar);
  d.querySelector("#s-descargar").addEventListener("click", descargar);
  d.querySelector("#s-compartir").addEventListener("click", compartir);
  d.querySelector("#s-op").addEventListener("change", () => { listo(false); describir(); });
}

const $ = (s) => d.querySelector(s);
const opcion = () => d.querySelector("#s-op input:checked")?.value ?? null;

function describir() {
  try {
    $("#s-desc").textContent = actual.describir ? actual.describir(opcion()) : "";
    $("#s-error").hidden = true;
    $("#s-armar").disabled = false;
  } catch (e) {
    $("#s-desc").textContent = "";
    $("#s-error").textContent = e.message;
    $("#s-error").hidden = false;
    $("#s-armar").disabled = true;
  }
}

function listo(si) {
  $("#s-listo").hidden = !si;
  $("#s-armar").hidden = si;
  if (!si) ultimo = null;
}

/**
 * Abre la hoja. o: {titulo, archivo (nombre del PDF), opciones: [[valor, texto]] (opcional), inicial,
 * describir(opción) → texto (cuántas páginas…; puede lanzar un error), armar(opción) → {bytes, paginas},
 * nota (cómo imprimir)}.
 */
export function abrirSalida(o) {
  armarHoja();
  actual = o;
  $("#s-tit").textContent = o.titulo;
  $("#s-op").innerHTML = (o.opciones || []).map(([v, t]) =>
    `<label class="s-op"><input type="radio" name="s-op" value="${v}"${v === (o.inicial ?? o.opciones[0][0]) ? " checked" : ""}><span>${t}</span></label>`).join("");
  $("#s-op").hidden = !o.opciones?.length;
  $("#s-nota").textContent = o.nota ?? "Para imprimir: al 100 % («Tamaño real»), sin «Ajustar a la página».";
  listo(false);
  describir();
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

async function armar() {
  const b = $("#s-armar");
  b.disabled = true;
  b.textContent = "Armando el PDF…";
  $("#s-error").hidden = true;
  try {
    await new Promise((r) => setTimeout(r, 30));          // que se vea «Armando…» antes de trabajar
    const r = await actual.armar(opcion());
    ultimo = new File([r.bytes], actual.archivo, { type: "application/pdf" });
    const kb = r.bytes.length / 1024;
    $("#s-info").textContent = `· ${r.paginas} ${r.paginas === 1 ? "página" : "páginas"} · ${kb < 1024 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1).replace(".", ",")} MB`}`;
    d.dataset.paginas = r.paginas;
    $("#s-compartir").hidden = !(navigator.canShare && navigator.canShare({ files: [ultimo] }));
    listo(true);
  } catch (e) {
    $("#s-error").textContent = `No se pudo armar el PDF: ${e.message}`;
    $("#s-error").hidden = false;
  } finally {
    b.disabled = false;
    b.textContent = "Armar el PDF";
  }
}

function descargar() {
  if (!ultimo) return;
  const url = URL.createObjectURL(ultimo);
  const a = document.createElement("a");
  a.href = url;
  a.download = ultimo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function compartir() {
  if (!ultimo) return;
  try {
    await navigator.share({ files: [ultimo], title: ultimo.name });
  } catch (e) {
    if (e.name !== "AbortError") descargar();               // si no se pudo compartir, se descarga
  }
}

export function cerrarSalida() {
  d?.close?.();
}

/** Convierte el botón con candado («… PRO») en el botón de la PRO: sin candado, con su texto y su acción. */
export function activarBoton(boton, texto, accion) {
  if (!boton) return;
  boton.removeAttribute("data-abre-pro");
  boton.classList.replace("btn-bloq", "btn-accion");
  boton.textContent = texto;
  boton.addEventListener("click", accion);
}
