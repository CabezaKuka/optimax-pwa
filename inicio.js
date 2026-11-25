// Pantalla de inicio: los módulos agrupados por oficio.
import { MODULOS, OFICIOS } from "./modulos.js";
import { icono } from "./iconos.js";

// clase de color por oficio (app.css: .of-chapa, .of-herreria, .of-carpinteria)
const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// dibujo de la portada: el desarrollo de un ramal de T en «tiza», como en la plancha
const PORTADA = `<svg class="portada-dib" viewBox="0 0 220 120" aria-hidden="true">
  <path class="tz" d="M10 110V58C32 58 40 22 60 22S90 58 110 58 140 22 160 22 190 58 210 58V110Z"/>
  <path class="mk" d="M60 110v-7M110 110v-7M160 110v-7"/>
  <path class="ct" d="M10 117H210M6 121L14 113M206 121L214 113"/>
</svg>`;

export function montar(cont) {
  cont.innerHTML = `<div class="inicio">
    <div class="portada">
      <div class="portada-txt">
        <h1 class="inicio-tit">¿Qué vas a fabricar?</h1>
        <p class="inicio-sub">Plantillas y medidas para el taller, en el celular.</p>
      </div>
      ${PORTADA}
    </div>
    ${OFICIOS.map((of) => `
      <section class="oficio of-${slug(of)}" aria-labelledby="of-${slug(of)}">
        <h2 id="of-${slug(of)}">${of}</h2>
        <ul class="mods">
          ${MODULOS.filter((m) => m.oficio === of && !m.oculto).map((m) => m.disponible
            ? `<li><a class="mod" href="#${m.id}">${tarjeta(m)}${FLECHA}</a></li>`
            : `<li><div class="mod mod-off" aria-disabled="true">${tarjeta(m, "Próximamente")}</div></li>`).join("")}
        </ul>
      </section>`).join("")}
  </div>`;
}

// toda la tarjeta abre el módulo; la flecha solo indica que se puede tocar
const FLECHA = `<svg class="mod-ir" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function tarjeta(m, estado = "") {
  return `<span class="mod-ico">${icono(m.icono)}</span>
    <span class="mod-txt"><span class="mod-nom">${m.nombre}</span><span class="mod-desc">${m.descripcion}</span>` +
    (estado ? `<span class="pronto">${estado}</span>` : "") + `</span>`;
}

export function desmontar() {}
