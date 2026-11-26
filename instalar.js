// Instalar la app. Tres casos, según dónde se abrió:
// - «prompt»: Chrome / Edge (Android o PC) avisa que se puede instalar (beforeinstallprompt) → instala directo.
// - «ios»: iPhone / iPad (Safari, o Chrome de iPhone): no hay botón del navegador → hoja con los pasos de Compartir.
// - «app»: navegador interno de Facebook / Instagram / Messenger (donde caen los anuncios): ahí no se puede instalar →
//   hoja para abrirla en el navegador (en Android, el enlace intent:// a Chrome; si Facebook lo bloquea, los pasos).
// Ya instalada (pantalla completa) o un navegador sin instalación (Firefox…): no se muestra nada.
// Cartel flotante abajo al abrir la app (en cualquier pantalla); se cierra con la × hasta la próxima vez que se abra
// (sessionStorage). Mientras no se ve, queda el ícono de instalar de la cabecera, al lado de «Comprar PRO».
const $ = (s) => document.querySelector(s);
const CERRADO = "optimax-inst-cerrado";  // sessionStorage: cerró el cartel en esta apertura

const ua = navigator.userAgent;
const esIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esAndroid = /android/i.test(ua);
const enApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(ua);

let modo = null;          // null | "prompt" | "ios" | "app"
let aviso = null;         // el beforeinstallprompt guardado
let cerradoAhora = false;  // por si el navegador no deja sessionStorage

function cerrado() {
  try { return cerradoAhora || sessionStorage.getItem(CERRADO) === "1"; } catch { return cerradoAhora; }
}
function cerrar() {
  cerradoAhora = true;
  try { sessionStorage.setItem(CERRADO, "1"); } catch { /* queda en memoria */ }
}

export const instalada = () =>
  matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches ||
  navigator.standalone === true;

// cartel flotante (si no lo cerraron en esta apertura); ícono de la cabecera cuando el cartel no se ve
function mostrar() {
  const cartel = !!modo && !cerrado();
  $("#instalar").hidden = !cartel;
  $("#btn-instalar").hidden = !modo || cartel;
  document.body.classList.toggle("con-instalar", cartel);
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
  $("#instalar-cerrar").addEventListener("click", () => { cerrar(); mostrar(); });
  $("#inst-copiar").addEventListener("click", copiarEnlace);
  mostrar();
}
