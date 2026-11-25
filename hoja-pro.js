// Hoja de compra de la PRO (se abre desde cualquier botón con data-abre-pro="<motivo>").
// Cada módulo puede sumar lo suyo con ponerContexto (ej. Chapa: las figuras PRO).
// Abajo, «Ya compré: activar» → «Entrar con WhatsApp»: el bot da un código de un solo uso, se abre WhatsApp con el
// mensaje para el bot y, cuando llega desde el número que compró, este equipo queda activado (licencia.js).
import { pedirIngreso, consultarIngreso } from "./licencia.js";

const WHATSAPP = "59177626675";
const PRECIO = "25 USD";
const CADA_MS = 2000;                    // consulta al bot mientras espera el mensaje

const MOTIVOS = {
  imprimir: "El PDF de la pieza (plano con medidas y plantilla a escala para trazar) es de la versión PRO.",
  pdf: "Guardar la lista de corte en PDF es de la versión PRO.",
  figura: "Esta figura es de la versión PRO.",
  barras: "Calcular listas de más de 5 piezas, con el optimizador completo, es de la versión PRO.",
  guillotina: "Calcular listas de más de 5 piezas, con la búsqueda completa, es de la versión PRO.",
  portones: "Los portones (batiente y corredizo), las rejas de más de 1500 × 1000 mm y el optimizador completo de barras son de la versión PRO.",
  precio: "Los precios y costos son de la versión PRO.",
  "": "Imprimir a escala y guardar las listas de corte en PDF son de la versión PRO.",
};

let contexto = { nombre: "", extra: "" };
let ingreso = null;                      // {token, whatsapp, texto} del pedido en curso
let reloj = null;
let preparando = false;

/** nombre: lo que estaba usando (va en el mensaje de WhatsApp); extra: HTML que se muestra en la hoja. */
export function ponerContexto(nombre = "", extra = "") {
  contexto = { nombre, extra };
}

const $h = (s) => document.querySelector("#hoja-pro").querySelector(s);

export function abrirPro(motivo = "") {
  const d = document.querySelector("#hoja-pro");
  $h("#pro-motivo").textContent = MOTIVOS[motivo] ?? MOTIVOS[""];
  $h("#pro-extra").innerHTML = contexto.extra;
  const txt = `Hola, probé optiMAX${contexto.nombre ? ` (${contexto.nombre})` : ""} y quiero la versión PRO (${PRECIO}).`;
  $h("#btn-whatsapp").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  if ($h("#pro-activar").open) prepararIngreso();
}

export function armarHojaPro() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abre-pro]");
    if (b) abrirPro(b.dataset.abrePro);
  });
  const d = document.querySelector("#hoja-pro");
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // tocar afuera cierra
  d.addEventListener("close", parar);
  $h("#pro-activar").addEventListener("toggle", (e) => { if (e.target.open) prepararIngreso(); else parar(); });
  $h("#pro-entrar").addEventListener("click", (e) => {
    if (!ingreso) { e.preventDefault(); return; }
    mostrar("espera", "Mandá el mensaje que se abrió en WhatsApp y volvé acá. Esperando tu mensaje…");
    esperar();
  });
  $h("#pro-listo").addEventListener("click", () => location.reload());     // los módulos se vuelven a armar con la PRO
  // al volver de WhatsApp, consultar enseguida (en segundo plano el navegador frena los relojes)
  document.addEventListener("visibilitychange", () => { if (!document.hidden && reloj) consultar(); });
}

/** Muestra una sola línea de estado: espera | error | ok (o nada). */
function mostrar(cual, texto = "") {
  for (const k of ["espera", "error", "ok"]) {
    const el = $h(`#pro-${k}`);
    el.hidden = k !== cual;
    if (k === cual) el.textContent = texto;
  }
}

function habilitar(si) {
  const a = $h("#pro-entrar");
  a.setAttribute("aria-disabled", si ? "false" : "true");
  if (!si) a.href = "#";
}

/** Pide un código de un solo uso al bot y deja el botón apuntando a WhatsApp con el mensaje listo. */
async function prepararIngreso() {
  if (preparando || ingreso) return;
  preparando = true;
  habilitar(false);
  try {
    ingreso = await pedirIngreso();
    $h("#pro-entrar").href = `https://wa.me/${ingreso.whatsapp}?text=${encodeURIComponent(ingreso.texto)}`;
    habilitar(true);
  } catch (e) {
    mostrar("error", e.message);
  } finally {
    preparando = false;
  }
}

function esperar() {
  clearInterval(reloj);
  reloj = setInterval(consultar, CADA_MS);
}

function parar() {
  clearInterval(reloj);
  reloj = null;
}

let consultando = false;
async function consultar() {
  if (!ingreso || consultando) return;
  consultando = true;
  try {
    const r = await consultarIngreso(ingreso.token);
    if (r === "pendiente") return;
    parar();
    if (r === "sin_licencia" || r === "vencido") {
      ingreso = null;                                  // otro código para volver a intentar
      mostrar("error", r === "vencido"
        ? "El pedido venció. Tocá «Entrar con WhatsApp» de nuevo."
        : "Ese número de WhatsApp no tiene optiMAX PRO. Si ya pagaste, avisanos y la habilitamos; si no, tocá «Consultar por WhatsApp».");
      prepararIngreso();
      return;
    }
    mostrar("ok", `✓ optiMAX PRO activada a nombre de ${r.nombre}. Desde ahora anda también sin internet.`);
    $h("#pro-entrar").hidden = true;
    $h("#pro-listo").hidden = false;
    ingreso = null;
  } catch (e) {
    if (/Sin conexión/.test(e.message)) return;        // se reintenta solo en la próxima vuelta
    parar();
    ingreso = null;
    mostrar("error", e.message);
    prepararIngreso();
  } finally {
    consultando = false;
  }
}

/** Abre la hoja directo en «Ya compré: activar». */
export function abrirActivar() {
  abrirPro("");
  const det = $h("#pro-activar");
  det.open = true;
  prepararIngreso();
}
