// Licencia PRO de la PWA: la compra queda a nombre del NÚMERO DE WHATSAPP del cliente (en el bot), con hasta 2 equipos
// activos (celular, PC…).
//
//   - Cada equipo tiene un código interno (ej. 7K3Q-WXPM-2HDA). Se crea al azar la primera vez y queda guardado en el
//     navegador; el usuario no lo ve.
//   - «Entrar con WhatsApp»: el bot da un código de un solo uso; la PWA abre WhatsApp con un mensaje para el bot y,
//     cuando llega desde un número con licencia, el bot le da a este equipo su clave y la llave del código PRO.
//   - La clave (OPWA1-…) es un dato firmado con Ed25519 (versión + código del equipo + fecha + nombre), con el mismo
//     formato que las claves de la PC pero con su propio par de llaves. Se verifica acá, sin internet, con la llave
//     PÚBLICA (licencia-config.js).
//   - El código PRO viaja dentro de la PWA, pero cifrado (pro.bin, AES-GCM). Con la llave guardada anda sin internet.
//   - Al abrir con internet, se le pregunta al bot si el equipo sigue activo (revalidar). Si fue reemplazado por otro
//     equipo de la misma cuenta, vuelve a la DEMO. Sin internet sigue andando (sin plazo máximo).
//   - Compra desde la app (26-nov): el cliente pone su número, elige cómo pagar, paga y toca «Ya pagué» → el bot
//     crea la orden (OM-1048) y le avisa al dueño; cuando el dueño confirma el pago, la cuenta del número queda con
//     este equipo y la consulta del estado trae la clave y la llave (igual que «Entrar con WhatsApp»). La orden en
//     curso queda guardada en el equipo: si cierran la app, sigue al volver a abrirla.
//   - Nunca va acá una forma de fabricar claves: eso es la llave privada, que está solo en el bot.
//
// En desarrollo (localhost) la PRO se prende con ?pro=1 (y se apaga con ?pro=0): el código sale de la carpeta pro/
// (el repo privado clonado ahí; está en .gitignore), sin clave ni paquete.
import { LLAVE_PUBLICA, SERVIDOR } from "./licencia-config.js";
import { verifyAsync } from "./vendor/ed25519.js";

export const PREFIJO = "OPWA1-";
const VERSION_CLAVE = 1;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const FECHA_BASE = Date.UTC(2020, 0, 1);
const CLAVE_DEV = "optimax-pro-dev";
const CLAVE_DISP = "optimax-dispositivo";
const CLAVE_LIC = "optimax-licencia";
const CLAVE_PAQ = "optimax-paquete";
const CLAVE_AVISO = "optimax-aviso";
const CLAVE_COMPRA = "optimax-compra";
const NAVEGADOR = typeof location !== "undefined";
export const DESARROLLO = NAVEGADOR && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const BASE_PRO = NAVEGADOR ? new URL("./pro/", import.meta.url).href : "";

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

let modoDev = false;
if (DESARROLLO) {
  const p = new URLSearchParams(location.search).get("pro");
  if (p === "1") guardar(CLAVE_DEV, "1");
  if (p === "0") guardar(CLAVE_DEV, null);
  modoDev = leer(CLAVE_DEV) === "1";
}

// estado: lo arma iniciar() al arrancar
const estado = { licencia: null, modulos: null, aviso: "" };

// ------------------------------------------------------------------ código del dispositivo y clave
/** «7K3Q-WXPM-2HDA»: 12 letras o números (base32 sin 0, 1 ni 8), en grupos de 4. Error si no sirve. */
export function normalizarCodigo(codigo) {
  let t = [...String(codigo).toUpperCase()].filter((c) => /[\p{L}\p{N}]/u.test(c)).join("");
  t = t.replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B");
  if (t.length !== 12 || [...t].some((c) => !B32.includes(c))) {
    throw new Error("Código de dispositivo inválido: deben ser 12 letras o números, ej. 7K3Q-WXPM-2HDA.");
  }
  return `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}`;
}

/** 8 bytes al azar → base32 → 12 caracteres (como licencia._formatear de la PC). */
export function codigoNuevo(bytes = crypto.getRandomValues(new Uint8Array(8))) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let t = "";
  for (let i = 0; i < 12; i++) t += B32[parseInt(bits.slice(i * 5, i * 5 + 5).padEnd(5, "0"), 2)];
  return normalizarCodigo(t);
}

/** El código de este dispositivo (se crea la primera vez). */
export function codigoDispositivo() {
  let c = leer(CLAVE_DISP);
  try { if (c) return normalizarCodigo(c); } catch { /* guardado roto: uno nuevo */ }
  c = codigoNuevo();
  guardar(CLAVE_DISP, c);
  return c;
}

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function b64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  return b64(s + "=".repeat((4 - (s.length % 4)) % 4));
}

/**
 * Verifica la clave para el código dado (licencia.verificar de la PC). Devuelve {nombre, fecha, codigo}; si no es
 * válida, lanza un Error con un mensaje para el usuario.
 */
export async function verificarClave(clave, codigo, llave = LLAVE_PUBLICA) {
  if (!llave || llave === "PENDIENTE") throw new Error("Esta versión no tiene configurada la verificación de claves.");
  const t = String(clave).replace(/\s+/g, "");
  if (!t.toUpperCase().startsWith(PREFIJO)) throw new Error("La clave no tiene el formato de optiMAX para el celular (empieza con OPWA1-).");
  let raw;
  try { raw = b64url(t.slice(PREFIJO.length)); } catch { throw new Error("La clave está incompleta o tiene caracteres de más."); }
  if (raw.length < 1 + 12 + 2 + 1 + 64) throw new Error("La clave está incompleta.");
  const datos = raw.subarray(0, raw.length - 64), firma = raw.subarray(raw.length - 64);
  let ok = false;
  try { ok = await verifyAsync(firma, datos, b64(llave)); } catch { ok = false; }
  if (!ok) throw new Error("La clave no es válida.");
  if (datos[0] !== VERSION_CLAVE) throw new Error("La clave es de otra versión del programa.");
  const codClave = normalizarCodigo(String.fromCharCode(...datos.subarray(1, 13)));
  const cod = normalizarCodigo(codigo);
  if (codClave !== cod) throw new Error(`La clave es para otro dispositivo (código ${codClave}). El código de este es ${cod}.`);
  const dias = (datos[13] << 8) | datos[14];
  const fecha = new Date(FECHA_BASE + dias * 86400000).toISOString().slice(0, 10);
  return { nombre: new TextDecoder().decode(datos.subarray(15)), fecha, codigo: codClave };
}

// ------------------------------------------------------------------ paquete PRO cifrado
/** pro.bin: «OPX1» + IV (12) + AES-GCM(JSON {version, archivos: {ruta: código}}). */
export async function abrirPaquete(bytes, llaveB64) {
  const b = new Uint8Array(bytes);
  if (b.length < 16 + 16 || String.fromCharCode(...b.subarray(0, 4)) !== "OPX1") throw new Error("El paquete PRO está dañado.");
  const k = await crypto.subtle.importKey("raw", b64(llaveB64), "AES-GCM", false, ["decrypt"]);
  let claro;
  try {
    claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.subarray(4, 16) }, k, b.subarray(16));
  } catch {
    throw new Error("La llave no abre el código PRO de esta versión.");
  }
  return JSON.parse(new TextDecoder().decode(claro));
}

/**
 * Módulos del paquete como blob: URLs. Los import de cada archivo se reescriben: los del propio paquete (pro/…)
 * apuntan al blob de ese archivo y los demás a la dirección completa del archivo público (así el módulo público es
 * el mismo que usa la página: p. ej. registrarTipos de portones).
 */
export function armarModulos(archivos, base = BASE_PRO) {
  const urls = new Map(), enCurso = new Set();
  const re = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;
  const armar = (ruta) => {
    if (urls.has(ruta)) return urls.get(ruta);
    if (!(ruta in archivos)) throw new Error(`Falta ${ruta} en el paquete PRO.`);
    if (enCurso.has(ruta)) throw new Error(`Importación circular en el paquete PRO: ${ruta}.`);
    enCurso.add(ruta);
    const propia = new URL(ruta, base).href;
    const codigo = archivos[ruta].replace(re, (m, pre, q, esp) => {
      const abs = new URL(esp, propia).href;
      const dest = abs.startsWith(base) ? armar(abs.slice(base.length)) : abs;
      return `${pre}${q}${dest}${q}`;
    });
    enCurso.delete(ruta);
    const url = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
    urls.set(ruta, url);
    return url;
  };
  for (const ruta of Object.keys(archivos)) armar(ruta);
  return urls;
}

/** POST al bot. Devuelve el JSON; lanza Error con un mensaje para el usuario si no hay conexión o el bot falla. */
async function alBot(ruta, cuerpo) {
  if (!SERVIDOR || SERVIDOR === "PENDIENTE") throw new Error("Esta versión todavía no tiene el servidor de activación configurado.");
  let r;
  try {
    r = await fetch(`${SERVIDOR.replace(/\/$/, "")}${ruta}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("Sin conexión: para activar hace falta internet una sola vez.");
  }
  let d = {};
  try { d = await r.json(); } catch { /* respuesta sin JSON */ }
  if (!r.ok) throw new Error(d.error || `El servidor no respondió bien (${r.status}).`);
  return d;
}

const MSJ_REEMPLAZADO = "La PRO está activa en otros equipos de tu cuenta.";

async function pedirLlave(clave, codigo) {
  const d = await alBot("/pwa/equipo", { clave, codigo });
  if (!d.activo) throw new Error(MSJ_REEMPLAZADO);
  if (!d.llave) throw new Error("El servidor no mandó la llave del código PRO.");
  return d.llave;
}

async function bajarPaquete() {
  let r;
  try { r = await fetch(new URL("./pro.bin", import.meta.url)); } catch { throw new Error("No se pudo leer el código PRO (sin conexión y sin copia guardada)."); }
  if (!r.ok) throw new Error("Esta versión no trae el código PRO.");
  return r.arrayBuffer();
}

/** Abre el paquete con la llave guardada (o la pide al bot si falta o no sirve) y deja los módulos listos. */
async function prepararPaquete(clave, codigo, { pedir = true } = {}) {
  const bytes = await bajarPaquete();
  let llave = leer(CLAVE_PAQ);
  let paquete = null;
  if (llave) { try { paquete = await abrirPaquete(bytes, llave); } catch { paquete = null; } }
  if (!paquete) {
    if (!pedir) throw new Error("Falta la llave del código PRO.");
    llave = await pedirLlave(clave, codigo);
    paquete = await abrirPaquete(bytes, llave);
    guardar(CLAVE_PAQ, llave);
  }
  estado.modulos = armarModulos(paquete.archivos);
}

// ------------------------------------------------------------------ API para la app
/** Al arrancar (app.js, antes de mostrar nada): clave guardada → verificar → abrir el código PRO. */
export async function iniciar() {
  if (!NAVEGADOR || modoDev) return;
  const aviso = leer(CLAVE_AVISO);                       // lo deja revalidar() antes de recargar
  if (aviso) { estado.aviso = aviso; guardar(CLAVE_AVISO, null); }
  const clave = leer(CLAVE_LIC);
  if (!clave) return;
  const codigo = codigoDispositivo();
  try {
    const lic = await verificarClave(clave, codigo);
    await prepararPaquete(clave, codigo, { pedir: navigator.onLine !== false });
    estado.licencia = lic;
  } catch (e) {
    estado.licencia = null;
    estado.modulos = null;
    estado.aviso = `optiMAX PRO no está activa en este dispositivo: ${e.message}`;
  }
}

/** «Entrar con WhatsApp», paso 1 (con internet): {token, whatsapp, texto} para abrir WhatsApp con el mensaje al bot. */
export async function pedirIngreso() {
  const d = await alBot("/pwa/ingreso", { codigo: codigoDispositivo() });
  if (!d.token || !d.whatsapp || !d.texto) throw new Error("El servidor no respondió bien.");
  return d;
}

/**
 * Paso 2: ¿llegó el mensaje? Devuelve "pendiente" | "sin_licencia" | "vencido", o {nombre} cuando el equipo quedó
 * activado (clave verificada acá y código PRO abierto). Lanza Error si no hay conexión o algo no cierra.
 */
export async function consultarIngreso(token) {
  const d = await alBot("/pwa/ingreso/estado", { token });
  if (d.estado !== "ok") return d.estado || "pendiente";
  return activarCon(d.clave, d.llave);
}

/** Clave y llave que mandó el bot → verificar, abrir el código PRO y guardar. → {nombre} */
async function activarCon(clave, llave) {
  const codigo = codigoDispositivo();
  const lic = await verificarClave(clave, codigo);
  const paquete = await abrirPaquete(await bajarPaquete(), llave);
  guardar(CLAVE_PAQ, llave);
  guardar(CLAVE_LIC, clave);
  estado.modulos = armarModulos(paquete.archivos);
  estado.licencia = lic;
  estado.aviso = "";
  try { await navigator.storage?.persist?.(); } catch { /* el navegador puede negarlo: igual queda guardada */ }
  return { nombre: lic.nombre };
}

// ------------------------------------------------------------------ compra desde la app
/**
 * Número de WhatsApp como lo usa el bot: «71234567» → «59171234567» (8 cifras que empiezan con 6 o 7 = celular de
 * Bolivia); si no, con el código de país (10 a 15 cifras). Error con un mensaje para el usuario si no sirve.
 */
export function normalizarNumero(texto) {
  let d = String(texto).replace(/\D/g, "");
  if (d.length === 8 && /^[67]/.test(d)) d = "591" + d;
  if (d.length < 10 || d.length > 15) {
    throw new Error("Poné tu número de WhatsApp con el código de país (ej. +54 9 11 2345 6789); en Bolivia alcanzan los 8 números.");
  }
  return d;
}

/** La orden en curso guardada en este equipo ({token, orden, metodo, numero}) o null. */
export function compraPendiente() {
  try {
    const c = JSON.parse(leer(CLAVE_COMPRA) || "null");
    return c && c.token && c.orden ? c : null;
  } catch {
    return null;
  }
}

export function olvidarCompra() { guardar(CLAVE_COMPRA, null); }

/** «Ya pagué» (con internet): crea la orden en el bot y la guarda en el equipo. → {orden, token} */
export async function pedirCompra(numero, metodo) {
  numero = normalizarNumero(numero);
  const d = await alBot("/pwa/compra", { codigo: codigoDispositivo(), numero, metodo });
  if (!d.token || !d.orden) throw new Error("El servidor no respondió bien.");
  guardar(CLAVE_COMPRA, JSON.stringify({ token: d.token, orden: d.orden, metodo, numero }));
  return d;
}

/**
 * ¿Ya confirmaron el pago? → {estado: "pendiente" | "rechazada" | "sin_licencia" | "desconocida", orden} o
 * {estado: "aprobada", nombre} con la PRO ya activada en este equipo (y la orden olvidada). Error sin conexión.
 */
export async function consultarCompra(token) {
  const d = await alBot("/pwa/compra/estado", { token });
  if (d.estado !== "aprobada") return { estado: d.estado || "pendiente", orden: d.orden };
  const r = await activarCon(d.clave, d.llave);
  olvidarCompra();
  return { estado: "aprobada", nombre: r.nombre, orden: d.orden };
}

/**
 * Al abrir con internet: ¿este equipo sigue activo en la cuenta? Si fue reemplazado, borra la licencia, deja el aviso
 * para el próximo arranque y devuelve "reemplazado" (la app recarga). Sin conexión o con el bot caído no cambia nada.
 */
export async function revalidar() {
  if (!NAVEGADOR || modoDev || !estado.licencia || navigator.onLine === false) return "sin cambios";
  const clave = leer(CLAVE_LIC);
  let d;
  try { d = await alBot("/pwa/equipo", { clave, codigo: codigoDispositivo() }); } catch { return "sin cambios"; }
  if (d.activo !== false) return "activo";
  guardar(CLAVE_LIC, null);
  guardar(CLAVE_PAQ, null);
  guardar(CLAVE_AVISO, `${MSJ_REEMPLAZADO} Para usarla en este, entrá con WhatsApp.`);
  return "reemplazado";
}

/** ¿Está activa la PRO en este dispositivo? */
export function esPro() {
  if (modoDev) return true;
  return Boolean(estado.licencia && estado.modulos);
}

/** {nombre, fecha, codigo} de la licencia activa (null en la DEMO o en desarrollo). */
export function licencia() { return estado.licencia; }

/** Aviso del arranque si la clave guardada no se pudo usar (o ""). */
export function avisoLicencia() { return estado.aviso; }

/** Dirección del código PRO (para importarlo o cargarlo en un Worker), o null si no hay PRO. */
export function urlPro(ruta) {
  if (!esPro()) return null;
  if (modoDev) return new URL(`./pro/${ruta}`, import.meta.url).href;
  return estado.modulos.get(ruta) ?? null;
}

/** Módulo de código PRO (ruta dentro del repo privado, ej. "chapa/figuras.js"), o null. */
export async function cargarPro(ruta) {
  const url = urlPro(ruta);
  if (!url) return null;
  try {
    return await import(url);
  } catch (e) {
    console.warn(`No se pudo cargar el código PRO «${ruta}»:`, e);
    return null;
  }
}
