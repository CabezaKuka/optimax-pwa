// Pantalla de inicio: los módulos en tarjetas (de a 2 en el celular, de a 4 en la PC), cada una con la foto de lo que
// sale (img/inicio/), el oficio en su color, el nombre y la descripción. El orden sigue a los oficios.
import { MODULOS, OFICIOS } from "./modulos.js";
import { icono } from "./iconos.js";

// clase de color por oficio (app.css: .of-chapa, .of-herreria, .of-carpinteria)
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function montar(cont) {
  const mods = OFICIOS.flatMap((of) => MODULOS.filter((m) => m.oficio === of && !m.oculto));
  cont.innerHTML = `<div class="inicio">
    <h1 class="inicio-tit">¿Qué vas a fabricar?</h1>
    <ul class="mods">
      ${mods.map((m) => m.disponible
        ? `<li><a class="mod of-${slug(m.oficio)}" href="#${m.id}">${tarjeta(m)}</a></li>`
        : `<li><div class="mod mod-off of-${slug(m.oficio)}" aria-disabled="true">${tarjeta(m, "Próximamente")}</div></li>`).join("")}
    </ul>
  </div>`;
}

// toda la tarjeta abre el módulo; sin foto (un módulo nuevo), el ícono en el recuadro
function tarjeta(m, estado = "") {
  const foto = m.imagen
    ? `<img src="${m.imagen}" alt="" decoding="async">`
    : `<span class="mod-ico">${icono(m.icono)}</span>`;
  return `<span class="mod-img${m.llena ? " llena" : ""}">${foto}</span>
    <span class="mod-txt"><span class="mod-of">${m.oficio}</span><span class="mod-nom">${m.nombre}</span>` +
    `<span class="mod-desc">${m.descripcion}</span>` +
    (estado ? `<span class="pronto">${estado}</span>` : "") + `</span>`;
}

export function desmontar() {}
