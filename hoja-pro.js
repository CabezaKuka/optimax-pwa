// Hoja de compra de la PRO (se abre desde cualquier botón con data-abre-pro="<motivo>").
// Cada módulo puede sumar lo suyo con ponerContexto (ej. Chapa: las figuras PRO).
const WHATSAPP = "59177626675";

const MOTIVOS = {
  imprimir: "Imprimir la plantilla a escala, para trazar sobre la chapa, es de la versión PRO.",
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
  const txt = `Hola, probé optiMAX en el celular${contexto.nombre ? ` (${contexto.nombre})` : ""} y quiero la versión PRO.`;
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
}
