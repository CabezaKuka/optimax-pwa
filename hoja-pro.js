// Hoja de compra de la PRO (se abre desde cualquier botón con data-abre-pro="<motivo>").
// Cada módulo puede sumar lo suyo con ponerContexto (ej. Chapa: las figuras PRO).
// Compra (26-nov): número de WhatsApp + forma de pago (pago-config.js) → datos para pagar → «Ya pagué» → el bot crea
// la orden y le avisa al dueño → cuando la confirma, este equipo queda activado solo (licencia.js). Sin hablar con nadie.
// Abajo, «Ya compré: activar» → «Entrar con WhatsApp»: el bot da un código de un solo uso, se abre WhatsApp con el
// mensaje para el bot y, cuando llega desde el número que compró, este equipo queda activado (licencia.js).
import { pedirIngreso, consultarIngreso, pedirCompra, consultarCompra, compraPendiente, olvidarCompra, normalizarNumero } from "./licencia.js";
import { METODOS } from "./pago-config.js";

const WHATSAPP = "59177626675";
// Precio de la PRO (25-nov, Max): 250 Bs en Bolivia, 20 USDT afuera (Bolivia = zona horaria, como optimax.lat)
const EN_BOLIVIA = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone === "America/La_Paz"; } catch { return false; } })();
export const PRECIO = EN_BOLIVIA ? "250 Bs" : "20 USDT";
const CADA_MS_COMPRA = 4000;             // consulta al bot mientras espera que confirmen el pago
// formas de pago con datos (sin dirección no se muestra); en Bolivia primero el QR, afuera al final
const PAGOS = (() => {
  const v = METODOS.filter((m) => m.qr || m.payId || m.direccion);
  return EN_BOLIVIA ? v : [...v.filter((m) => !m.bolivia), ...v.filter((m) => m.bolivia)];
})();
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
  if (compraPendiente()) pasoCompra("espera"); else if (!$h("#pro-paso-pagar").hidden) pasoCompra("pagar"); else pasoCompra("elegir");
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
  armarCompra();
  // al volver de WhatsApp, consultar enseguida (en segundo plano el navegador frena los relojes)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (reloj) consultar();
    if (relojCompra) consultarPago();
  });
}

// ------------------------------------------------------------------ compra
const ICONOS_PAGO = {
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM14 14h3v3h-3zM18 18h3v3h-3zM14 19h2v2h-2zM19 14h2v2h-2z" fill="currentColor"/>',
  billetera: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11v3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 12h5v4h-5a2 2 0 0 1 0-4Z" fill="none" stroke="currentColor" stroke-width="2"/>',
  moneda: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8M12 8v9M8.5 11.5c1 .6 2.2.9 3.5.9s2.5-.3 3.5-.9" fill="none" stroke="currentColor" stroke-width="2"/>',
};
const icono = (k) => `<svg class="metodo-ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS_PAGO[k] || ""}</svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let relojCompra = null;
let consultandoPago = false;

function metodoElegido() {
  const v = $h("#pro-metodos input:checked")?.value;
  return PAGOS.find((m) => m.id === v) || PAGOS[0];
}

function armarCompra() {
  $h("#pro-metodos").innerHTML = PAGOS.map((m, i) => `
    <label class="metodo">
      <input type="radio" name="pro-metodo" value="${m.id}"${i === 0 ? " checked" : ""}>
      ${icono(m.icono)}
      <span class="metodo-txt"><b>${esc(m.titulo)}</b><span>${esc(m.sub)}</span></span>
      <span class="metodo-marca" aria-hidden="true"></span>
    </label>`).join("");
  const ponerPrecio = () => { $h("#pro-precio").textContent = metodoElegido().precio; };
  ponerPrecio();
  $h("#pro-metodos").addEventListener("change", ponerPrecio);
  const num = $h("#pro-numero");
  try { num.value = localStorage.getItem("optimax-whatsapp") || ""; } catch { /* sin almacenamiento */ }
  // Enter en el número no cierra la hoja (es un <form method="dialog">): sigue al paso de pagar
  num.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $h("#pro-ver-pago").click(); } });
  num.addEventListener("input", () => { $h("#pro-numero-error").hidden = true; num.closest(".entrada").classList.remove("mal"); });
  $h("#pro-ver-pago").addEventListener("click", () => {
    try {
      normalizarNumero(num.value);
    } catch (e) {
      $h("#pro-numero-error").textContent = e.message;
      $h("#pro-numero-error").hidden = false;
      num.closest(".entrada").classList.add("mal");
      num.focus();
      return;
    }
    try { localStorage.setItem("optimax-whatsapp", num.value.trim()); } catch { /* sin almacenamiento */ }
    mostrarPago(metodoElegido());
    pasoCompra("pagar");
  });
  $h("#pro-cambiar").addEventListener("click", () => pasoCompra("elegir"));
  $h("#pro-pago").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copiar);
      b.textContent = "Copiado";
    } catch {
      b.textContent = "Mantené apretado el texto para copiarlo";
    }
    setTimeout(() => { b.textContent = "Copiar"; }, 1800);
  });
  $h("#pro-ya-pague").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $h("#pro-pagar-error").hidden = true;
    try {
      await pedirCompra(num.value, metodoElegido().id);
      pasoCompra("espera");
    } catch (err) {
      $h("#pro-pagar-error").textContent = err.message;
      $h("#pro-pagar-error").hidden = false;
    } finally {
      b.disabled = false;
    }
  });
  $h("#pro-c-listo").addEventListener("click", () => location.reload());
  $h("#pro-c-otra").addEventListener("click", () => { olvidarCompra(); pasoCompra("elegir"); });
  document.querySelector("#hoja-pro").addEventListener("close", pararCompra);
}

/** Datos para pagar con la forma elegida (QR, Binance Pay ID o dirección USDT). */
function mostrarPago(m) {
  const copiar = (t) => `<button type="button" class="btn-sec btn-chico" data-copiar="${esc(t)}">Copiar</button>`;
  const guardarQr = m.qr ? `<a class="btn-sec btn-chico pago-guardar" href="${m.qr}" download="${m.archivo}">Guardar QR</a>` : "";
  let h = `<p class="compra-tit">${esc(m.titulo)} · <b>${esc(m.precio)}</b></p>`;
  if (m.id === "qr") {
    h += `<img class="pago-qr pago-qr-banco" src="${m.qr}" alt="QR de pago de ${esc(m.precio)}" width="640" height="1027">
      <p class="nota">Escanealo desde la app de tu banco. Si pagás desde este mismo celular: <b>Guardar QR</b> y en la app
      del banco elegí «pagar con QR» → «subir imagen».</p>${guardarQr}`;
  } else if (m.payId) {
    h += `<div class="pago-dato"><span>Binance Pay ID</span><b>${esc(m.payId)}</b>${copiar(m.payId)}</div>
      <p class="nota">A nombre de <b>${esc(m.titular)}</b>. En Binance: Pagar → Enviar → por ID de Binance Pay, y mandá
      <b>${esc(m.precio)}</b>. Sin comisión.</p>`;
  } else {
    if (m.qr) h += `<img class="pago-qr" src="${m.qr}" alt="QR de la dirección USDT" width="420" height="420">`;
    h += `<div class="pago-dato pago-dir"><span>Dirección USDT · ${esc(m.red)}</span><b>${esc(m.direccion)}</b>${copiar(m.direccion)}</div>
      <p class="nota">Mandá solo <b>USDT</b> por la red <b>${esc(m.red)}</b>: por otra red se pierde. Tienen que llegar
      <b>${esc(m.precio)}</b> (la comisión de la red la paga quien envía).</p>${guardarQr}`;
  }
  $h("#pro-pago").innerHTML = h;
  $h("#pro-pago").dataset.metodo = m.id;
}

/** elegir | pagar | espera */
function pasoCompra(cual) {
  for (const k of ["elegir", "pagar", "espera"]) $h(`#pro-paso-${k}`).hidden = k !== cual;
  if (cual !== "espera") { pararCompra(); return; }
  const c = compraPendiente();
  if (!c) { pasoCompra("elegir"); return; }
  const m = PAGOS.find((x) => x.id === c.metodo);
  $h("#pro-precio").textContent = m ? m.precio : $h("#pro-precio").textContent;
  $h("#pro-orden").textContent = `Orden ${c.orden}${m ? ` · ${m.titulo}` : ""} · WhatsApp ${numeroVisible(c.numero)}`;
  for (const [k, v] of [["espera", true], ["error", false], ["ok", false]]) $h(`#pro-c-${k}`).hidden = !v;
  $h("#pro-c-listo").hidden = true;
  $h("#pro-c-otra").hidden = false;
  clearInterval(relojCompra);
  relojCompra = setInterval(consultarPago, CADA_MS_COMPRA);
  consultarPago();
}

function pararCompra() {
  clearInterval(relojCompra);
  relojCompra = null;
}

async function consultarPago() {
  const c = compraPendiente();
  if (!c || consultandoPago) return;
  consultandoPago = true;
  try {
    const r = await consultarCompra(c.token);
    if (r.estado === "pendiente") return;
    pararCompra();
    $h("#pro-c-espera").hidden = true;
    if (r.estado === "aprobada") {
      $h("#pro-c-ok").textContent = `✓ Pago confirmado: optiMAX PRO quedó activada en este equipo (${r.orden}). Desde ahora anda también sin internet.`;
      $h("#pro-c-ok").hidden = false;
      $h("#pro-c-listo").hidden = false;
      $h("#pro-c-otra").hidden = true;
      return;
    }
    const msj = {
      rechazada: `No encontramos el pago de la orden ${c.orden}. Si ya pagaste, escribinos por WhatsApp con la orden y el comprobante.`,
      sin_licencia: `La compra de la orden ${c.orden} fue dada de baja. Escribinos por WhatsApp.`,
      desconocida: `No encontramos la orden ${c.orden}. Si ya pagaste, escribinos por WhatsApp con el comprobante.`,
    }[r.estado] || `No se pudo confirmar la orden ${c.orden}.`;
    $h("#pro-c-error").textContent = msj;
    $h("#pro-c-error").hidden = false;
    const txt = `Hola, pagué optiMAX Taller PRO, orden ${c.orden} (WhatsApp ${numeroVisible(c.numero)}).`;
    $h("#btn-whatsapp").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
    olvidarCompra();
  } catch (e) {
    if (/Sin conexión/.test(e.message)) return;        // se reintenta solo en la próxima vuelta
    pararCompra();
    $h("#pro-c-espera").hidden = true;
    $h("#pro-c-error").textContent = e.message;
    $h("#pro-c-error").hidden = false;
  } finally {
    consultandoPago = false;
  }
}

/** Al arrancar: si hay una compra en curso en este equipo, abre la hoja en la espera (se activa sola al confirmarse). */
export function seguirCompra() {
  if (compraPendiente()) abrirPro("");
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
