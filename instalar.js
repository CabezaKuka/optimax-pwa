// Instalar la app. Tres casos, según dónde se abrió:
// - «prompt»: Chrome / Edge (Android o PC) avisa que se puede instalar (beforeinstallprompt) → instala directo.
// - «ios»: iPhone / iPad (Safari, o Chrome de iPhone): no hay botón del navegador → hoja con los pasos de Compartir.
// - «app»: navegador interno de Facebook / Instagram / Messenger (donde caen los anuncios): ahí no se puede instalar →
//   hoja para abrirla en el navegador (en Android, el enlace intent:// a Chrome; si Facebook lo bloquea, los pasos).
// Ya instalada (pantalla completa) o un navegador sin instalación (Firefox…): no se muestra nada.
// Se ve como tarjeta arriba del inicio hasta que la cierran con la ×; desde ahí (y siempre dentro de los módulos)
// queda el botón «Instalar» de la cabecera, al lado de «Comprar PRO».
const $ = (s) => document.querySelector(s);
const MEMORIA = "optimax-pwa-app";       // { instCerrado: true } (antes también iosVisto, del aviso de iPhone)

const ua = navigator.userAgent;
const esIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esAndroid = /android/i.test(ua);
const enApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(ua);

let modo = null;          // null | "prompt" | "ios" | "app"
let aviso = null;         // el beforeinstallprompt guardado
let enInicio = false;

function leer() {
  try { return JSON.parse(localStorage.getItem(MEMORIA)) || {}; } catch { return {}; }
}
function guardar(cambios) {
  const m = { ...leer(), ...cambios };
  try { localStorage.setItem(MEMORIA, JSON.stringify(m)); } catch { /* sin almacenamiento: vuelve a aparecer */ }
}

export const instalada = () =>
  matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches ||
  navigator.standalone === true;

// tarjeta en el inicio (si no la cerraron); botón de la cabecera cuando la tarjeta no se ve
function mostrar() {
  const tarjeta = !!modo && enInicio && !leer().instCerrado;
  $("#instalar").hidden = !tarjeta;
  $("#btn-instalar").hidden = !modo || tarjeta;
}

// app.js la llama al cambiar de pantalla
export function ponerInicio(si) {
  enInicio = si;
  mostrar();
}

async function instalar() {
  if (modo === "prompt" && aviso) {
    aviso.prompt();
    const r = await aviso.userChoice.catch(() => null);
    aviso = null;
    if (r?.outcome === "accepted") { modo = null; mostrar(); }
    return;                       // si dijo que no, Chrome vuelve a avisar más tarde (beforeinstallprompt)
  }
  if (modo === "ios" || modo === "app") abrirPasos();
}

function abrirPasos() {
  const d = $("#hoja-instalar");
  $("#inst-ios").hidden = modo !== "ios";
  $("#inst-app").hidden = modo !== "app";
  $("#inst-copiado").hidden = true;
  if (modo === "app") {
    $("#inst-nav").textContent = esIOS ? "Abrir en el navegador externo (Safari)" : "Abrir en el navegador (Chrome)";
    const chrome = $("#inst-chrome");
    chrome.hidden = !esAndroid;
    if (esAndroid) {
      const u = new URL(location.href);
      chrome.href = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;` +
        `S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    }
  }
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
}

async function copiarEnlace() {
  const url = location.origin + location.pathname;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const t = document.createElement("textarea");      // navegadores internos sin permiso de portapapeles
    t.value = url;
    document.body.append(t);
    t.select();
    try { document.execCommand("copy"); } catch { /* nada */ }
    t.remove();
  }
  $("#inst-copiado").hidden = false;
}

// al cargar el módulo (antes de que app.js espere la licencia): Chrome puede avisar enseguida
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  aviso = e;
  modo = "prompt";
  mostrar();
});
addEventListener("appinstalled", () => { aviso = null; modo = null; mostrar(); });

export function armarInstalar() {
  if (!modo && !instalada()) {
    if (enApp) modo = "app";
    else if (esIOS) modo = "ios";
  }
  $("#instalar-ok").addEventListener("click", instalar);
  $("#btn-instalar").addEventListener("click", instalar);
  $("#instalar-cerrar").addEventListener("click", () => { guardar({ instCerrado: true }); mostrar(); });
  $("#inst-copiar").addEventListener("click", copiarEnlace);
  mostrar();
}
