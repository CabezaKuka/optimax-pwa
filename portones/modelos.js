// Modelos de reja y portón (27-nov, Max): diseños de arranque para elegir en una galería al entrar al módulo. Un modelo
// carga solo el diseño (relleno, travesaños, franja, paños, armado); medidas, perfiles, tipo y cantidad quedan como
// estaban. Todo se puede cambiar después: el modelo elegido queda en el trabajo (`modelo`, solo PWA) y, si se cambia
// alguna de esas opciones, la barra dice «modificado». «Diseño libre» no cambia nada (se arma como siempre).
// Los portones de un modelo sirven para batiente de 1 o 2 hojas y corredizo: el tipo se elige después.
import { ITEM_DEF, normalizarItem, PORTONES, MEDIDAS_MUESTRA, TEXTO } from "./motor.js";

/** Opciones del diseño que fija un modelo (las demás del ítem no se tocan). */
export const CAMPOS_DISENO = ["relleno", "n_trav", "trav_modo", "franja", "n_franja", "n_panos", "armado", "trav_lado",
  "chapa_trav", "cruce"];
export const LIBRE = "libre";

// para: "porton" (batiente 1 y 2 hojas, corredizo) y / o "reja" (reja de ventana). cambios: sobre ITEM_DEF.
export const MODELOS = [
  { id: "barrotes_1", nombre: "Barrotes · 1 travesaño", desc: "Barrotes verticales con un travesaño al medio.",
    para: ["porton", "reja"], cambios: { relleno: "verticales", n_trav: 1 } },
  { id: "barrotes_2", nombre: "Barrotes · 2 travesaños", desc: "Dos travesaños repartidos en el alto.",
    para: ["porton", "reja"], cambios: { relleno: "verticales", n_trav: 2 } },
  { id: "barrotes_doble", nombre: "Barrotes · travesaño doble", desc: "Dos travesaños al centro, con la franja libre.",
    para: ["porton"], cambios: { relleno: "verticales", trav_modo: "doble", franja: 200, n_franja: 0 } },
  { id: "doble_franja", nombre: "Doble con barrotes en la franja", desc: "La franja del centro con barrotes más separados.",
    para: ["porton"], cambios: { relleno: "verticales", trav_modo: "doble", franja: 200, n_franja: 6 } },
  { id: "diagonales_1", nombre: "Diagonales · 1 travesaño", desc: "Diagonales pasantes con el travesaño atrás.",
    para: ["porton", "reja"], cambios: { relleno: "diagonales", n_trav: 1, armado: "pasantes", trav_lado: "atras" } },
  { id: "diagonales_doble", nombre: "Diagonales · travesaño doble", desc: "Diagonales por tramo, con la franja libre al centro.",
    para: ["porton"], cambios: { relleno: "diagonales", trav_modo: "doble", franja: 200, n_franja: 0 } },
  { id: "chapa", nombre: "Chapa ciega", desc: "Una sola chapa, con el travesaño atrás.",
    para: ["porton", "reja"], cambios: { relleno: "chapa", n_trav: 1, chapa_trav: "atras" } },
  { id: "chapa_panos", nombre: "Chapa en 3 paños", desc: "Paños de chapa con parantes y travesaño.",
    para: ["porton"], cambios: { relleno: "chapa", n_trav: 1, n_panos: 3 } },
  { id: "horizontales", nombre: "Barras horizontales", desc: "Barras acostadas de lado a lado.",
    para: ["porton", "reja"], cambios: { relleno: "horizontales", n_trav: 0 } },
  { id: "cuadricula", nombre: "Cuadrícula", desc: "Barras verticales y horizontales cruzadas.",
    para: ["porton", "reja"], cambios: { relleno: "cuadricula", n_trav: 0 } },
  { id: "rombos", nombre: "Rombos", desc: "Diagonales en los dos sentidos.",
    para: ["porton", "reja"], cambios: { relleno: "rombos", n_trav: 0 } },
  { id: "diagonales", nombre: "Diagonales", desc: "Todas inclinadas al mismo lado, sin travesaño.",
    para: ["porton", "reja"], cambios: { relleno: "diagonales", n_trav: 0 } },
];
const POR_ID = Object.fromEntries(MODELOS.map((m) => [m.id, m]));
export const modelo = (id) => POR_ID[id] || null;
/** Modelos de una pestaña: "porton" o "reja". */
export const modelosDe = (para) => MODELOS.filter((m) => m.para.includes(para));
/** Imagen del modelo en la pestaña (portones en batiente 2 hojas; la reja en su pared). */
export const imagenModelo = (id, para) => `img/modelos/${para}-${id}.webp`;
/** Pestaña que corresponde al tipo del ítem. */
export const paraDe = (tipo) => (PORTONES.includes(tipo) ? "porton" : "reja");
/** Tipo con el que se dibujan los portones de la galería (y al que se pasa desde la reja). */
export const TIPO_PORTON = "batiente_2";

/**
 * El ítem con el diseño del modelo. Conserva medidas, perfiles y cantidad. El tipo: si el modelo es de la otra pestaña,
 * pasa al de esa pestaña (portón: batiente 2 hojas; reja: reja de ventana) con sus medidas de muestra si las medidas
 * eran las de muestra del tipo anterior. id = LIBRE: el diseño como está (solo el tipo de la pestaña, si cambia).
 */
export function aplicarModelo(it, id, para = paraDe(it.tipo)) {
  const m = id === LIBRE ? null : modelo(id);
  if (id !== LIBRE && !m) return { ...it };
  const out = { ...it };
  if (m) {
    for (const k of CAMPOS_DISENO) out[k] = ITEM_DEF[k];
    Object.assign(out, m.cambios);
  }
  const tipo = para === "porton" ? (PORTONES.includes(it.tipo) ? it.tipo : TIPO_PORTON) : "reja_ventana";
  if (tipo !== it.tipo) {
    const antes = MEDIDAS_MUESTRA[it.tipo], nuevas = MEDIDAS_MUESTRA[tipo];
    if (antes && nuevas && Number(it.ancho) === antes[0] && Number(it.alto) === antes[1]) [out.ancho, out.alto] = nuevas;
    out.tipo = tipo;
    if (!it.nombre || it.nombre === TEXTO[it.tipo]) out.nombre = TEXTO[tipo];
  }
  return { ...normalizarItem(out), modelo: id };
}

/** ¿Se cambió alguna opción del diseño respecto del modelo elegido? (Diseño libre: nunca.) */
export function modificado(it) {
  const m = modelo(it.modelo);
  if (!m) return false;
  const ref = normalizarItem({ ...it, ...Object.fromEntries(CAMPOS_DISENO.map((k) => [k, ITEM_DEF[k]])), ...m.cambios });
  return CAMPOS_DISENO.some((k) => ref[k] !== it[k]);
}

/** Texto de la barra: «Doble con barrotes en la franja» / «Diseño libre». */
export const nombreModelo = (id) => (id === LIBRE ? "Diseño libre" : modelo(id)?.nombre || "");
