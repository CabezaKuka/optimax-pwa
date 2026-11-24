// Figuras de la PWA, en el orden del catálogo.
import { TCilCil } from "./t_cil_cil.js";
import { CodoSectores } from "./codo_sectores.js";
import { TroncoCono } from "./tronco_cono.js";
import { TroncoPiramide } from "./tronco_piramide.js";

export const FIGURAS = [TCilCil, CodoSectores, TroncoCono, TroncoPiramide];

/** Valores por defecto de los parámetros, como texto (lo que muestra el formulario). */
export function valoresDefecto(g) {
  return Object.fromEntries(g.params.map((p) => [p.clave, String(p.defecto)]));
}

/** Convierte y valida un objeto {clave: texto} → {clave: valor} (Generador.leer del escritorio). */
export function leer(g, crudo) {
  return Object.fromEntries(g.params.map((p) => [p.clave, p.convertir(p.clave in crudo ? crudo[p.clave] : p.defecto)]));
}
