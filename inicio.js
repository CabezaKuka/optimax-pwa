// Pantalla de inicio (26-nov, propuesta E de Max): portada (la imagen de optimax.lat/taller) con una línea, tira de la
// PRO (solo DEMO, abre la compra), «Módulos» en lista (foto de lo que sale, oficio, nombre, descripción y flecha) y
// «Mis trabajos»: en la PRO, los trabajos guardados de todos los módulos juntos (tocar uno lo abre en su módulo); en la
// DEMO, la hoja de compra.
import { MODULOS, OFICIOS, moduloPorId } from "./modulos.js";
import { icono } from "./iconos.js";
import { esPro } from "./licencia.js";
import { PRECIO } from "./hoja-pro.js";
import { trabajosGuardados, pedirAbrir } from "./trabajos.js";

// clase de color por oficio (app.css: .of-chapa, .of-herreria, .of-carpinteria)
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FLECHA = `<svg class="mod-ir" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CARPETA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h6l2 2h8v11H4Z"/></svg>`;
const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
};

export function montar(cont) {
  const pro = esPro();
  const mods = OFICIOS.flatMap((of) => MODULOS.filter((m) => m.oficio === of && !m.oculto));
  const ids = mods.filter((m) => m.disponible).map((m) => m.id);
  const guardados = pro ? trabajosGuardados(ids) : [];
  cont.innerHTML = `<div class="inicio">
    <figure class="ini-portada">
      <img src="img/inicio/portada.webp" alt="Portón en 3D entre paredes, codo de chapa y plancha con los cortes" width="1000" height="525">
      <p>Plantillas de chapa, listas de corte y portones en 3D. Medís, cargás y sale.</p>
    </figure>
    ${pro ? "" : `<button type="button" class="ini-pro" data-abre-pro="">
      <span class="ini-pro-txt"><b>Con la PRO:</b> las 12 figuras, la lista de corte de todos los portones, PDF a escala, costos y trabajos guardados.</span>
      <span class="ini-precio"><b>${PRECIO}</b>pago único</span>
    </button>`}
    <div class="ini-tit"><h1>Módulos</h1><span>${mods.length}</span></div>
    <ul class="mods">
      ${mods.map((m) => m.disponible
        ? `<li><a class="mod of-${slug(m.oficio)}" href="#${m.id}">${tarjeta(m)}${FLECHA}</a></li>`
        : `<li><div class="mod mod-off of-${slug(m.oficio)}" aria-disabled="true">${tarjeta(m, "Próximamente")}</div></li>`).join("")}
    </ul>
    <button type="button" class="ini-trabajos${pro ? " con" : ""}" id="ini-trabajos"${pro ? "" : ' data-abre-pro="trabajos"'}>
      ${CARPETA}
      <span><b>Mis trabajos</b>${!pro ? "Guardá cada pedido y retomalo cuando quieras."
        : guardados.length ? "Los que guardaste en este equipo, de todos los módulos."
        : "Todavía no guardaste trabajos: se guardan desde cada módulo, en «Trabajo»."}</span>
      ${pro ? (guardados.length ? `<span class="ini-cuenta">${guardados.length}</span>` : "") : `<span class="tag">PRO</span>`}
    </button>
  </div>
  <dialog class="hoja-pro hoja-ini-trabajos" id="hoja-ini-trabajos" aria-labelledby="it-tit">
    <form method="dialog" class="hoja">
      <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
      <h2 id="it-tit">Mis trabajos</h2>
      <ul class="it-lista" id="it-lista"></ul>
    </form>
  </dialog>`;
  if (pro) armarHojaTrabajos(cont, ids);
}

// sin foto (un módulo nuevo), el ícono en el recuadro
function tarjeta(m, estado = "") {
  const foto = m.imagen
    ? `<img src="${m.imagen}" alt="" decoding="async">`
    : `<span class="mod-ico">${icono(m.icono)}</span>`;
  return `<span class="mod-img${m.llena ? " llena" : ""}">${foto}</span>
    <span class="mod-txt"><span class="mod-of">${m.oficio}</span><span class="mod-nom">${m.nombre}</span>` +
    `<span class="mod-desc">${m.descripcion}</span>` +
    (estado ? `<span class="pronto">${estado}</span>` : "") + `</span>`;
}

// PRO: la lista de todos los trabajos guardados (más nuevo primero); tocar uno abre su módulo con ese trabajo
function armarHojaTrabajos(cont, ids) {
  const hoja = cont.querySelector("#hoja-ini-trabajos");
  cont.querySelector("#ini-trabajos").addEventListener("click", () => {
    const ts = trabajosGuardados(ids);
    hoja.querySelector("#it-lista").innerHTML = ts.length ? ts.map((t, i) => {
      const m = moduloPorId(t.modulo);
      return `<li><button type="button" class="it-abrir of-${slug(m.oficio)}" data-i="${i}">
        <span class="it-txt"><b>${esc(t.nombre)}</b><small>${esc(fecha(t.fecha))}</small></span>
        <span class="it-mod">${esc(m.nombre)}</span></button></li>`;
    }).join("")
      : `<li class="nota">Todavía no guardaste trabajos en este equipo. Se guardan desde cada módulo, en «Trabajo» → «Guardar en este equipo».</li>`;
    hoja.querySelector("#it-lista").onclick = (e) => {
      const b = e.target.closest(".it-abrir");
      if (!b) return;
      const t = ts[Number(b.dataset.i)];
      hoja.close();
      pedirAbrir(t.modulo, t.nombre);
      location.hash = `#${t.modulo}`;
    };
    if (typeof hoja.showModal === "function") hoja.showModal(); else hoja.setAttribute("open", "");
  });
  hoja.addEventListener("click", (e) => { if (e.target === hoja) hoja.close(); });
}

export function desmontar() {}
