// Hoja de compra de la PRO (se abre desde cualquier botón con data-abre-pro="<motivo>").
// Cada módulo puede sumar lo suyo con ponerContexto (ej. Chapa: las figuras PRO).
// Abajo, «Ya compré: activar» → «Entrar con WhatsApp»: el bot da un código de un solo uso, se abre WhatsApp con el
// mensaje para el bot y, cuando llega desde el número que compró, este equipo queda activado (licencia.js).
import { pedirIngreso, consultarIngreso } from "./licencia.js";

const WHATSAPP = "59177626675";
// Precio de la PRO (25-nov, Max): 250 Bs en Bolivia, 20 USDT afuera (Bolivia = zona horaria, como optimax.lat)
const EN_BOLIVIA = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone === "America/La_Paz"; } catch { return false; } })();
export const PRECIO = EN_BOLIVIA ? "250 Bs" : "20 USDT";
const CADA_MS = 2000;                    // consulta al bot mientras espera el mensaje
const ANDROID = /android/i.test(navigator.userAgent);
const MSJ_ESPERA = "Mandá el mensaje que se abrió en WhatsApp y volvé acá. Esperando tu mensaje…";

const MOTIVOS = {
  imprimir: "El PDF de la pieza (plano con medidas y plantilla a escala para trazar) es de la versión PRO.",
  pdf: "Guardar la lista de corte en PDF es de la versión PRO.",
  figura: "Esta figura es de la versión PRO.",
  barras: "Calcular listas de más de 5 piezas, con el optimizador completo, es de la versión PRO.",
  guillotina: "Calcular listas de más de 5 piezas, con la búsqueda completa, es de la versión PRO.",
  portones: "Los portones (batiente y corredizo), las rejas de más de 1500 × 1000 mm y el optimizador completo de barras son de la versión PRO.",
  precio: "Los precios y costos son de la versión PRO.",
  trabajos: "Guardar y abrir trabajos (también como proyecto .nesting para optiMAX de PC) es de la versión PRO.",
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
  const txt = `Hola, probé optiMAX Taller${contexto.nombre ? ` (${contexto.nombre})` : ""} y quiero la versión PRO (${PRECIO}).`;
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
  for (const id of ["#pro-entrar", "#pro-business"]) {
    $h(id).addEventListener("click", (e) => {
      if (!ingreso) { e.preventDefault(); return; }
      mostrar("espera", MSJ_ESPERA);
      esperar();
    });
  }
  // copiar el mensaje para mandarlo desde otra app (Business en iPhone, PC sin WhatsApp Web…)
  $h("#pro-copiar-btn").addEventListener("click", async (e) => {
    if (!ingreso) return;
    mostrar("espera", "Pegalo en WhatsApp, mandalo y volvé acá. Esperando tu mensaje…");
    esperar();
    try {
      await navigator.clipboard.writeText(ingreso.texto);
      e.target.textContent = "Copiado";
      setTimeout(() => { e.target.textContent = "Copiar mensaje"; }, 1500);
    } catch { /* sin portapapeles: el mensaje está a la vista */ }
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
  $h("#pro-business").hidden = !si || !ANDROID;
  $h("#pro-copiar").hidden = !si;
}

const numeroVisible = (n) => (n.startsWith("591") && n.length === 11 ? `+591 ${n.slice(3)}` : `+${n}`);

/** Pide un código de un solo uso al bot y deja el botón apuntando a WhatsApp con el mensaje listo. */
async function prepararIngreso() {
  if (preparando || ingreso) return;
  preparando = true;
  habilitar(false);
  try {
    ingreso = await pedirIngreso();
    const waMe = `https://wa.me/${ingreso.whatsapp}?text=${encodeURIComponent(ingreso.texto)}`;
    $h("#pro-entrar").href = waMe;
    // Android: abre directo WhatsApp Business (si no está instalado, el enlace de siempre)
    $h("#pro-business").href = `intent://send/?phone=${ingreso.whatsapp}&text=${encodeURIComponent(ingreso.texto)}` +
      `#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(waMe)};end`;
    $h("#pro-bot").textContent = numeroVisible(ingreso.whatsapp);
    $h("#pro-msj").textContent = ingreso.texto;
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
        : "Ese número de WhatsApp no tiene optiMAX PRO. Si tenés WhatsApp y WhatsApp Business, mandalo desde el número " +
          "con el que compraste. Si ya pagaste, avisanos y la habilitamos; si no, tocá «Consultar por WhatsApp».");
      prepararIngreso();
      return;
    }
    mostrar("ok", `✓ optiMAX PRO activada a nombre de ${r.nombre}. Desde ahora anda también sin internet.`);
    $h("#pro-entrar").hidden = true;
    $h("#pro-business").hidden = true;
    $h("#pro-copiar").hidden = true;
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
