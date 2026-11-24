// Íconos de los módulos (los mismos dibujos de los botones de módulo del escritorio, icono_modulo en nesting.py),
// en una grilla de 46 × 46, como SVG con trazo del color del texto.
const trazo = (d, w = 2.4, extra = "") => `<path d="${d}" stroke-width="${w}"${extra}/>`;
const caja = (x0, y0, x1, y1, w = 2.4) => trazo(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`, w);
const linea = (x0, y0, x1, y1, w = 2.4, puntos = false) =>
  trazo(`M${x0} ${y0}L${x1} ${y1}`, w, puntos ? ' stroke-dasharray="3 2.5"' : "");

const DIBUJOS = {
  // desarrollo de un ramal de T: chapa con el borde de la boca y marcas cada 90°
  chapa: () => trazo("M5 40V24C11 24 12 12 17 12S22 24 23 24 24 12 29 12 35 24 41 24V40Z") +
    linea(14, 40, 14, 36, 1.6) + linea(23, 40, 23, 36, 1.6) + linea(32, 40, 32, 36, 1.6),
  barras: () => caja(4, 9, 42, 15) + caja(4, 20, 34, 26) + caja(4, 31, 26, 37) + linea(38, 23, 38, 38, 2.4, true),
  guillotina: () => caja(5, 12, 41, 40) + linea(5, 24, 41, 24, 2.4, true) + linea(23, 24, 23, 40, 2.4, true) +
    '<path d="M3 4H25L21 9H3Z" fill="currentColor" stroke="none"/>',
  escaleras: () => trazo("M4 41V33H13V25H22V17H31V9H42V41Z") + linea(4, 24, 31, 3, 1.8) +
    linea(8.5, 32.5, 8.5, 20.5, 1.6) + linea(17.5, 25.5, 17.5, 13.5, 1.6) + linea(26.5, 18.5, 26.5, 6.5, 1.6),
  portones: () => caja(5, 8, 41, 40) + linea(23, 8, 23, 40) +
    [11, 17, 29, 35].map((x) => linea(x, 8, x, 40, 1.6)).join("") + linea(5, 24, 41, 24, 1.6),
};

export function icono(tipo) {
  const dib = DIBUJOS[tipo] || DIBUJOS.chapa;
  return `<svg viewBox="0 0 46 46" aria-hidden="true" fill="none" stroke="currentColor" stroke-linejoin="round">${dib()}</svg>`;
}
