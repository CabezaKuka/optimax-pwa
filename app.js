// optiMAX PWA: arranque, rutas (#inicio, #chapa, …), hoja de compra, instalación y service worker.
// Cada módulo (modulos/*.js) exporta montar(contenedor) y desmontar().
import { moduloPorId } from "./modulos.js";
import * as inicio from "./inicio.js";
import { armarHojaPro, ponerContexto, abrirActivar, seguirCompra } from "./hoja-pro.js";
import { esPro, DESARROLLO, iniciar, licencia, avisoLicencia, revalidar } from "./licencia.js";

const $ = (s) => document.querySelector(s);
const pantalla = $("#pantalla");
let actual = null;              // { id, mod }
let turno = 0;                  // descarta montajes viejos si se cambia de ruta mientras carga

// color del oficio del módulo abierto (app.css: .of-chapa, .of-herreria, .of-carpinteria), también en sus hojas
const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function ponerOficio(m) {
  document.body.classList.remove(...[...document.body.classList].filter((c) => c.startsWith("of-")));
  if (m) document.body.classList.add(`of-${slug(m.oficio)}`);
}

async function ir() {
  const id = decodeURIComponent(location.hash.slice(1));
  const m = moduloPorId(id);
  const destino = m?.disponible ? id : "inicio";
  if (destino === "inicio" && id && id !== "inicio") {
    history.replaceState(null, "", location.pathname + location.search);   // módulo que no hay (o todavía no)
  }
  if (actual?.id === destino) return;                     // ya está (p. ej. vuelta de la pantalla completa)
  const mio = ++turno;
  actual?.mod.desmontar?.();
  actual = null;
  ponerContexto();
  pantalla.innerHTML = "";
  window.scrollTo(0, 0);
  if (destino === "inicio") {
    actual = { id: "inicio", mod: inicio };
    document.title = "optiMAX · Herramientas para el taller";
    $("#migas").hidden = true;
    ponerOficio(null);
    inicio.montar(pantalla);
    return;
  }
  $("#migas").hidden = false;
  ponerOficio(m);
  $("#migas-mod").textContent = m.nombre;
  document.title = `optiMAX · ${m.nombre}`;
  const mod = await m.cargar();
  if (mio !== turno) return;
  actual = { id: destino, mod };
  await mod.montar(pantalla);
}

// ------------------------------------------------------------------ instalar
function armarInstalacion() {
  let memoria = {};
  try { memoria = JSON.parse(localStorage.getItem("optimax-pwa-app")) || {}; } catch { /* sin almacenamiento */ }
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (esIOS && !instalada && !memoria.iosVisto) $("#aviso-ios").hidden = false;
  $("#cerrar-ios").addEventListener("click", () => {
    $("#aviso-ios").hidden = true;
    memoria.iosVisto = true;
    try { localStorage.setItem("optimax-pwa-app", JSON.stringify(memoria)); } catch { /* sin almacenamiento */ }
  });
  let aviso = null;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e;
    $("#btn-instalar").hidden = false;
  });
  $("#btn-instalar").addEventListener("click", async () => {
    if (!aviso) return;
    aviso.prompt();
    await aviso.userChoice;
    aviso = null;
    $("#btn-instalar").hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin caché: igual anda con internet */ });
  }
}

// ------------------------------------------------------------------ arranque
try {
  await iniciar();                                // clave guardada → verificar → abrir el código PRO
} catch { /* sigue como DEMO */ }
if (esPro()) {
  $(".btn-pro").hidden = true;                    // con PRO no se ofrece comprar
  if (DESARROLLO) document.body.dataset.pro = "desarrollo";
  const lic = licencia();
  if (lic) {
    $("#pie-lic").textContent = `PRO · ${lic.nombre}`;
    $("#pie-lic").hidden = false;
  }
  // con internet, en segundo plano: si este equipo fue reemplazado por otro de la cuenta, vuelve a la DEMO
  revalidar().then((r) => { if (r === "reemplazado") location.reload(); });
} else if (avisoLicencia()) {
  $("#aviso-lic").innerHTML = "";
  $("#aviso-lic").append(avisoLicencia(), " ");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "enlace";
  b.textContent = "Entrar con WhatsApp";
  b.addEventListener("click", abrirActivar);
  $("#aviso-lic").append(b);
  $("#aviso-lic").hidden = false;
}
armarHojaPro();
if (!esPro()) seguirCompra();                   // compra en curso: la hoja sigue esperando la confirmación del pago
armarInstalacion();
addEventListener("hashchange", ir);
ir();
