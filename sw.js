// Service worker: guarda la app para que ande sin internet. Al cambiar cualquier archivo, subir VERSION
// (si no, los que ya la tienen siguen viendo la vieja hasta que se borre la caché).
const VERSION = "optimax-pwa-27";
const ARCHIVOS = [
  "./", "index.html", "app.css", "app.js", "vista.js", "manifest.webmanifest",
  "modulos.js", "inicio.js", "iconos.js", "licencia.js", "licencia-config.js", "vendor/ed25519.js", "hoja-pro.js", "salida.js", "trabajos.js", "modulos/chapa.js", "modulos/barras.js", "barras/motor.js",
  "modulos/guillotina.js", "guillotina/motor.js", "modulos/portones.js", "modulos/portones3d.js", "modulos/visor3d.js", "modulos/chapa3d.js", "portones/motor.js", "barras/trabajador.js",
  "geo/base.js", "geo/index.js", "geo/medidas.js", "geo/arma3d.js",
  "geo/t_cil_cil.js", "geo/codo_sectores.js", "geo/tronco_cono.js", "geo/tronco_piramide.js",
  "fuentes/barlow-latin-400-normal.woff2", "fuentes/barlow-latin-600-normal.woff2",
  "fuentes/barlow-latin-700-normal.woff2", "fuentes/barlow-semi-condensed-latin-500-normal.woff2",
  "fuentes/barlow-semi-condensed-latin-600-normal.woff2",
  "img/logo.png", "img/favicon.png", "img/icono-180.png", "img/icono-192.png", "img/icono-512.png",
  ...["t_cil_cil", "codo_sectores", "tronco_cono", "tronco_piramide", "t_rect_cil", "t_cil_rect", "codo_rect",
    "curva_directa_90", "curva_directa", "desvio_paralelo", "transicion_rect_red", "helicoide"]
    .map((id) => `img/fig/${id}.webp`),
];

self.addEventListener("install", (e) => {
  // pro.bin (código PRO cifrado) aparte: si una versión no lo trae, la app igual se instala
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ARCHIVOS).then(() => c.add("pro.bin").catch(() => {})))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// primero la caché (anda sin internet); lo que no está, de la red. El código PRO va cifrado en pro.bin (se guarda
// como cualquier archivo: sin la llave no sirve); la carpeta pro/ es solo de desarrollo y no se guarda.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // three.js (vista 3D, ~600 KB) no va en la instalación: se guarda la primera vez que alguien abre el 3D
  const alUsar = new URL(req.url).pathname.endsWith("/vendor/three.min.js");
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r ||
    fetch(req).then((resp) => {
      if (alUsar && resp.ok) { const copia = resp.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
      return resp;
    }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
