// Licencia PRO de la PWA. Hoy solo está la estructura: el servidor de activación (Railway) se conecta al final.
//
// Cómo va a quedar (ver estado-pwa.md):
//   - El código PRO vive en el repo privado optimax-pwa-pro; no se publica con la PWA.
//   - Railway activa la clave (máx. 2 dispositivos) y entrega el código PRO + un certificado firmado (Ed25519);
//     el dispositivo los guarda y verifica la firma con la llave pública, sin conexión.
//   - Nunca va acá una fórmula para generar o validar claves.
//
// Mientras tanto, en desarrollo (localhost) la PRO se prende con ?pro=1 (y se apaga con ?pro=0) y el código PRO
// se carga de la carpeta pro/ (el repo privado clonado ahí; está en .gitignore). Publicada, esPro() da siempre false.

const CLAVE_DEV = "optimax-pro-dev";
export const DESARROLLO = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

if (DESARROLLO) {
  const p = new URLSearchParams(location.search).get("pro");
  try {
    if (p === "1") localStorage.setItem(CLAVE_DEV, "1");
    if (p === "0") localStorage.removeItem(CLAVE_DEV);
  } catch { /* sin almacenamiento */ }
}

/** ¿Está activa la PRO en este dispositivo? */
export function esPro() {
  if (DESARROLLO) {
    try { return localStorage.getItem(CLAVE_DEV) === "1"; } catch { return false; }
  }
  return false;          // fase de licencias: certificado guardado + firma válida
}

/**
 * Módulo de código PRO (ruta relativa dentro del repo privado, ej. "chapa/figuras.js"), o null si no hay PRO o
 * no se pudo cargar.
 */
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

/** Dirección del código PRO (para cargarlo en un Worker), o null si no hay PRO. */
export function urlPro(ruta) {
  if (!esPro()) return null;
  if (DESARROLLO) return new URL(`./pro/${ruta}`, import.meta.url).href;
  return null;           // fase de licencias: código entregado por el servidor y guardado en el dispositivo
}
