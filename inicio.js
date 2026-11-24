// Pantalla de inicio: los módulos agrupados por oficio.
import { MODULOS, OFICIOS } from "./modulos.js";
import { icono } from "./iconos.js";

export function montar(cont) {
  cont.innerHTML = `<div class="inicio">
    <h1 class="inicio-tit">¿Qué vas a fabricar?</h1>
    ${OFICIOS.map((of) => `
      <section class="oficio" aria-labelledby="of-${of}">
        <h2 id="of-${of}">${of}</h2>
        <ul class="mods">
          ${MODULOS.filter((m) => m.oficio === of).map((m) => m.disponible
            ? `<li><a class="mod" href="#${m.id}">${tarjeta(m)}</a></li>`
            : `<li><div class="mod mod-off" aria-disabled="true">${tarjeta(m, "Próximamente")}</div></li>`).join("")}
        </ul>
      </section>`).join("")}
  </div>`;
}

function tarjeta(m, estado = "") {
  return `<span class="mod-ico">${icono(m.icono)}</span>
    <span class="mod-txt"><span class="mod-nom">${m.nombre}</span><span class="mod-desc">${m.descripcion}</span>` +
    (estado ? `<span class="pronto">${estado}</span>` : "") + "</span>";
}

export function desmontar() {}
