// Worker del optimizador completo de barras (PRO): la búsqueda exacta puede tardar unos segundos con muchas piezas
// y así no traba la pantalla. Recibe {id, ruta (dirección del optimizador PRO), pedidos: [[piezas, barra, corte]]} y
// devuelve {id, out: [{res} | {error}]}.
let modulo = null, rutaCargada = null;

self.onmessage = async (e) => {
  const { id, ruta, pedidos } = e.data;
  try {
    if (rutaCargada !== ruta) { modulo = await import(ruta); rutaCargada = ruta; }
  } catch (err) {
    self.postMessage({ id, fallo: String(err) });
    return;
  }
  const out = pedidos.map(([piezas, barra, corte]) => {
    try { return { res: modulo.optimizar(piezas, barra, corte) }; } catch (err) { return { error: err.message }; }
  });
  self.postMessage({ id, out });
};
