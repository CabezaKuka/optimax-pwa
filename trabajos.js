// Trabajos (proyectos) de cada módulo, solo PRO (25-nov, Max: «como en la PC»):
// - «Mis trabajos»: guardados en el celular (localStorage), con nombre y fecha; abrir, reemplazar, borrar. El inicio
//   los muestra todos juntos (trabajosGuardados) y abre uno en su módulo (pedirAbrir → abrirPedido).
// - .nesting compatible con optiMAX para PC (código PRO, proyectos/nesting.js): descargar / compartir y abrir archivo.
// Un trabajo se guarda con el formato de la PC: opciones = {tipo, <tipo>: {...}} (las claves de la PC + algunas propias
// de la PWA que la PC ignora). Chapa solo se guarda en el celular (el .nesting de chapa lleva el DXF de cada pieza).
import { esPro, cargarPro } from "./licencia.js";

const CARPETA = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const TACHO = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const TIPOS = { chapa_pwa: "desarrollos de chapa", barras: "barras y tubos", guillotina: "guillotina", portones: "rejas y portones",
  escaleras: "escaleras", tolvas: "tolvas", chapa: "chapa (nesting)" };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const firma = (op) => JSON.stringify(op);
const fechaCorta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
};

// «Mis trabajos» del inicio: los guardados de todos los módulos (más nuevo primero) y abrir uno en su módulo
const PEDIDO = "optimax-abrir-trabajo";             // sessionStorage: {modulo, nombre} que el inicio pidió abrir
export function trabajosGuardados(modulos) {
  return modulos.flatMap((modulo) => leer(`optimax-trabajos-${modulo}`, [])
    .filter((t) => t && t.nombre).map((t) => ({ modulo, nombre: t.nombre, fecha: t.fecha })))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
export function pedirAbrir(modulo, nombre) {
  try { sessionStorage.setItem(PEDIDO, JSON.stringify({ modulo, nombre })); } catch { /* sin almacenamiento */ }
}
/** app.js, después de montar un módulo: si el inicio pidió abrir un trabajo de ese módulo, lo abre. */
export function abrirPedido(modulo) {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(PEDIDO)); sessionStorage.removeItem(PEDIDO); } catch { /* nada */ }
  if (p?.modulo === modulo) window.__optimaxTrabajos?.[modulo]?.abrirGuardado(p.nombre);
}

/**
 * Barra «Trabajo» al principio de `lugar` y su hoja. cfg:
 *   modulo  clave del módulo (guillotina, barras, portones, chapa)
 *   tipo    opciones.tipo (guillotina, barras, portones, chapa_pwa)
 *   nesting true si se puede guardar / abrir como .nesting de la PC
 *   datos() → opciones del trabajo actual; cargar(op) → Promise<aviso | "">; nuevo() → Promise; sugerido() → nombre
 */
export function armarTrabajos(lugar, cfg) {
  const CLAVE_LISTA = `optimax-trabajos-${cfg.modulo}`, CLAVE_ACTUAL = `optimax-trabajo-${cfg.modulo}`;
  const pro = esPro();
  const actual = leer(CLAVE_ACTUAL, { nombre: "", firma: "" });
  let nesting = null, confirmar = null;

  const barra = document.createElement("div");
  barra.className = "trabajo-barra";
  barra.innerHTML = `<button type="button" class="trabajo-btn" id="t-btn"${pro ? "" : ' data-abre-pro="trabajos"'}>
      <span class="t-ico">${CARPETA}</span>
      <span class="t-txt"><span class="t-rot">Trabajo</span><span class="t-nom" id="t-nom-actual"></span></span>
      ${pro ? "" : `<span class="candado" aria-hidden="true"></span>`}
    </button>`;
  // en el renglón de «← Inicio» (26-nov, Max: gana un renglón); sin ese renglón, donde estaba (arriba del módulo)
  const migas = document.querySelector("#migas");
  for (const b of document.querySelectorAll("#migas .trabajo-barra")) b.remove();
  if (migas) migas.append(barra);
  else { const tit = lugar.querySelector(".titulo-figura"); if (tit) tit.after(barra); else lugar.prepend(barra); }
  const hoja = document.createElement("dialog");
  hoja.className = "hoja-pro hoja-trabajos";
  hoja.id = "hoja-trabajos";
  hoja.setAttribute("aria-labelledby", "t-tit");
  hoja.innerHTML = `<form method="dialog" class="hoja">
    <button class="cerrar" value="cerrar" aria-label="Cerrar">×</button>
    <h2 id="t-tit">Trabajos</h2>
    <label class="t-campo"><span>Nombre del trabajo</span><span class="entrada"><input id="t-nombre" type="text" autocomplete="off" maxlength="80"></span></label>
    <button type="button" class="btn-prim" id="t-guardar">Guardar en este equipo</button>
    <div class="t-acc">
      <button type="button" class="btn-sec" id="t-nuevo">Nuevo</button>
      ${cfg.nesting ? `<button type="button" class="btn-sec" id="t-bajar">Descargar .nesting</button>
      <button type="button" class="btn-sec" id="t-archivo">Abrir .nesting</button>` : ""}
    </div>
    ${cfg.nesting ? `<input type="file" id="t-file" hidden>
    <p class="nota t-nota">El archivo .nesting se abre también en optiMAX para PC (PRO).</p>` : ""}
    <div class="t-confirma" id="t-confirma" role="alert" hidden><p id="t-conf-txt"></p>
      <div class="pe-confirma-b"><button type="button" class="btn-sec btn-quieto" id="t-conf-no">Cancelar</button><button type="button" class="pe-si" id="t-conf-si">Seguir</button></div></div>
    <p class="t-aviso" id="t-aviso" role="status" hidden></p>
    <h3 class="t-sub">Mis trabajos</h3>
    <ul class="t-lista" id="t-lista"></ul>
  </form>`;
  lugar.append(hoja);
  const $t = (s) => hoja.querySelector(s);

  const lista = () => leer(CLAVE_LISTA, []);
  const modificado = () => firma(cfg.datos()) !== actual.firma;
  function ponerActual(nombre, op) {
    actual.nombre = nombre;
    actual.firma = firma(op ?? cfg.datos());            // lo de ahora es la base para «sin guardar»
    escribir(CLAVE_ACTUAL, actual);
    mostrarNombre();
  }
  function mostrarNombre() {
    barra.querySelector("#t-nom-actual").textContent = !pro ? "Trabajos"
      : actual.nombre ? actual.nombre + (modificado() ? " (sin guardar)" : "") : "Sin guardar";
  }
  function aviso(txt, mal = false) {
    const a = $t("#t-aviso");
    a.textContent = txt;
    a.classList.toggle("perfil-mal", mal);
    a.hidden = !txt;
  }
  function preguntar(txt, si, accion) {
    confirmar = accion;
    $t("#t-conf-txt").textContent = txt;
    $t("#t-conf-si").textContent = si;
    $t("#t-confirma").hidden = false;
    $t("#t-confirma").scrollIntoView({ block: "nearest" });
  }
  function sinConfirmar() { confirmar = null; $t("#t-confirma").hidden = true; }

  function dibujarLista() {
    const ls = lista();
    $t("#t-lista").innerHTML = ls.length ? ls.map((t, i) => `<li class="t-item${t.nombre === actual.nombre ? " t-actual" : ""}">
        <button type="button" class="t-abrir" data-i="${i}"><b>${esc(t.nombre)}</b><span>${esc(fechaCorta(t.fecha))}</span></button>
        <button type="button" class="t-borrar" data-b="${i}" aria-label="Borrar ${esc(t.nombre)}">${TACHO}</button></li>`).join("")
      : `<li class="nota">Todavía no guardaste trabajos en este equipo.</li>`;
  }
  function abrirHoja() {
    sinConfirmar();
    aviso("");
    $t("#t-nombre").value = actual.nombre || cfg.sugerido();
    dibujarLista();
    if (typeof hoja.showModal === "function") hoja.showModal(); else hoja.setAttribute("open", "");
  }

  function guardarLocal(reemplazar = false) {
    const nombre = $t("#t-nombre").value.trim().replace(/\s+/g, " ");
    if (!nombre) { aviso("Escribí un nombre para el trabajo.", true); $t("#t-nombre").focus(); return; }
    const ls = lista(), i = ls.findIndex((t) => t.nombre.toLowerCase() === nombre.toLowerCase());
    if (i >= 0 && !reemplazar && ls[i].nombre !== actual.nombre) {
      preguntar(`Ya hay un trabajo «${ls[i].nombre}». ¿Reemplazarlo?`, "Reemplazar", () => guardarLocal(true));
      return;
    }
    const op = cfg.datos(), t = { nombre, fecha: new Date().toISOString(), opciones: op };
    if (i >= 0) ls.splice(i, 1);
    ls.unshift(t);
    if (!escribir(CLAVE_LISTA, ls)) { aviso("No se pudo guardar: el navegador no deja espacio.", true); return; }
    ponerActual(nombre, op);
    sinConfirmar();
    dibujarLista();
    aviso(`Guardado: «${nombre}».`);
  }

  async function abrirOpciones(op, nombre, guardadoLocal) {
    if (op.tipo !== cfg.tipo) {
      aviso(op.tipo in TIPOS ? `Ese proyecto es de ${TIPOS[op.tipo]}: abrilo en ese módulo${op.tipo === "chapa" || op.tipo === "escaleras" || op.tipo === "tolvas" ? " de optiMAX para PC" : ""}.`
        : "Ese proyecto no es de este módulo.", true);
      return;
    }
    hoja.close();
    let msg;
    try { msg = await cfg.cargar(op); } catch (e) {      // no se pudo: el módulo quedó como estaba
      abrirHoja(); aviso(e.message, true); return;
    }                                                       // se pudo: el módulo se volvió a armar (barra nueva)
    const t = window.__optimaxTrabajos?.[cfg.modulo];
    t?.despues(nombre, guardadoLocal ? cfg.datos() : null, msg);
  }
  function conCambios(accion) {
    if (modificado()) preguntar("Hay cambios sin guardar en el trabajo actual. ¿Seguir igual?", "Seguir", accion);
    else accion();
  }

  async function bajarNesting() {
    nesting ??= await cargarPro("proyectos/nesting.js");
    if (!nesting) { aviso("No se pudo cargar el código PRO.", true); return; }
    const nombre = ($t("#t-nombre").value.trim() || cfg.sugerido()).replace(/[\\/:*?"<>|]+/g, "-");
    const bytes = nesting.armarNesting(cfg.datos());
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const archivo = `${nombre}.nesting`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = archivo;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    aviso(`Se descargó «${archivo}». En el celular queda en Descargas: desde ahí lo podés mandar por WhatsApp.`);
  }
  async function abrirArchivo(f) {
    nesting ??= await cargarPro("proyectos/nesting.js");
    if (!nesting) { aviso("No se pudo cargar el código PRO.", true); return; }
    let op;
    try { op = await nesting.leerNesting(new Uint8Array(await f.arrayBuffer())); } catch (e) { aviso(e.message, true); return; }
    await abrirOpciones(op, f.name.replace(/\.nesting$/i, ""), false);
  }

  // ------------------------------------------------------------------ eventos
  if (pro) barra.querySelector("#t-btn").addEventListener("click", abrirHoja);   // DEMO: data-abre-pro abre la compra
  hoja.addEventListener("click", (e) => {
    if (e.target === hoja) { hoja.close(); return; }
    const ab = e.target.closest(".t-abrir"), bo = e.target.closest(".t-borrar");
    if (ab) {
      const t = lista()[Number(ab.dataset.i)];
      if (t) conCambios(() => abrirOpciones(t.opciones, t.nombre, true));
    } else if (bo) {
      const t = lista()[Number(bo.dataset.b)];
      if (t) preguntar(`¿Borrar el trabajo «${t.nombre}» de este equipo?`, "Borrar", () => {
        escribir(CLAVE_LISTA, lista().filter((x) => x.nombre !== t.nombre));
        if (actual.nombre === t.nombre) ponerActual("", null);
        sinConfirmar(); dibujarLista(); aviso(`Se borró «${t.nombre}».`);
      });
    }
  });
  $t("#t-guardar").addEventListener("click", () => guardarLocal());
  $t("#t-nombre").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); guardarLocal(); } });
  $t("#t-nuevo").addEventListener("click", () => conCambios(async () => {
    hoja.close();
    await cfg.nuevo();
    window.__optimaxTrabajos?.[cfg.modulo]?.despues("", null, "");
  }));
  $t("#t-conf-no").addEventListener("click", sinConfirmar);
  $t("#t-conf-si").addEventListener("click", () => { const f = confirmar; sinConfirmar(); f?.(); });
  if (cfg.nesting) {
    $t("#t-bajar").addEventListener("click", bajarNesting);
    $t("#t-archivo").addEventListener("click", () => conCambios(() => $t("#t-file").click()));
    $t("#t-file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) abrirArchivo(f); });
  }

  const api = {
    /** Después de abrir / empezar un trabajo (la barra se volvió a armar con el módulo). */
    despues(nombre, op, msg) {
      ponerActual(nombre, op);
      if (msg) { abrirHoja(); aviso(msg); }
    },
    /** El módulo cambió algo: actualiza «(sin guardar)». */
    cambio: mostrarNombre,
    /** Desde «Mis trabajos» del inicio: abre el trabajo guardado con ese nombre (con cambios sin guardar, pregunta). */
    abrirGuardado(nombre) {
      const t = pro && lista().find((x) => x.nombre === nombre);
      if (!t) return false;
      abrirHoja();
      conCambios(() => abrirOpciones(t.opciones, t.nombre, true));
      return true;
    },
  };
  (window.__optimaxTrabajos ??= {})[cfg.modulo] = api;
  if (!actual.firma) ponerActual(actual.nombre, null);  // primera vez: lo que hay es la base
  mostrarNombre();
  return api;
}
