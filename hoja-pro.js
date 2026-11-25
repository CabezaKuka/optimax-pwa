// Hoja de compra de la PRO (se abre desde cualquier botón con data-abre-pro="<motivo>").
// Cada módulo puede sumar lo suyo con ponerContexto (ej. Chapa: las figuras PRO).
// Abajo, «Ya compré: activar»: el código de este dispositivo (va en el mensaje de compra) y la clave.
import { codigoDispositivo, activar } from "./licencia.js";

const WHATSAPP = "59177626675";
const PRECIO = "25 USD";

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

/** nombre: lo que estaba usando (va en el mensaje de WhatsApp); extra: HTML que se muestra en la hoja. */
export function ponerContexto(nombre = "", extra = "") {
  contexto = { nombre, extra };
}

export function abrirPro(motivo = "") {
  const d = document.querySelector("#hoja-pro");
  d.querySelector("#pro-motivo").textContent = MOTIVOS[motivo] ?? MOTIVOS[""];
  d.querySelector("#pro-extra").innerHTML = contexto.extra;
  const txt = `Hola, probé optiMAX en el celular${contexto.nombre ? ` (${contexto.nombre})` : ""} y quiero la versión PRO ` +
    `(${PRECIO}). Código de mi dispositivo: ${codigoDispositivo()}`;
  d.querySelector("#pro-codigo").textContent = codigoDispositivo();
  d.querySelector("#btn-whatsapp").href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

export function armarHojaPro() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abre-pro]");
    if (b) abrirPro(b.dataset.abrePro);
  });
  const d = document.querySelector("#hoja-pro");
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // tocar afuera cierra
  d.querySelector("#pro-copiar").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(codigoDispositivo());
      e.target.textContent = "Copiado";
      setTimeout(() => { e.target.textContent = "Copiar"; }, 1500);
    } catch { /* sin portapapeles: el código se ve igual */ }
  });
  d.querySelector("#pro-activar-btn").addEventListener("click", activarClave);
}

async function activarClave() {
  const d = document.querySelector("#hoja-pro");
  const b = d.querySelector("#pro-activar-btn"), err = d.querySelector("#pro-error"), ok = d.querySelector("#pro-ok");
  const clave = d.querySelector("#pro-clave").value.trim();
  err.hidden = true;
  if (!clave) {
    err.textContent = "Pegá la clave que te mandamos por WhatsApp.";
    err.hidden = false;
    return;
  }
  b.disabled = true;
  b.textContent = "Activando…";
  try {
    const lic = await activar(clave);
    ok.textContent = `✓ optiMAX PRO activada a nombre de ${lic.nombre}. Desde ahora anda también sin internet.`;
    ok.hidden = false;
    b.textContent = "Listo";
    b.disabled = false;
    b.onclick = () => location.reload();                 // los módulos se vuelven a armar con la PRO
    b.removeEventListener("click", activarClave);
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    b.disabled = false;
    b.textContent = "Activar";
  }
}

/** Abre la hoja directo en «Ya compré: activar». */
export function abrirActivar() {
  abrirPro("");
  const d = document.querySelector("#hoja-pro");
  d.querySelector("#pro-activar").open = true;
}
