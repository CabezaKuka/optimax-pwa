# optiMAX PWA

optiMAX en el celular y el navegador: desarrollos de chapa (T de caño, codo por gajos, cono / reducción y fondo de
tolva) con la plantilla y sus cotas. Anda sin internet (service worker). Exportar DXF e imprimir a escala son PRO:
abren la hoja de compra (WhatsApp).

Es estática: se publica con GitHub Pages desde `main` (Settings → Pages → Deploy from a branch → `main` / root).
No tiene paso de compilación.

## Archivos
```
index.html, app.css, app.js   interfaz
vista.js                      dibujo de la plancha (SVG), cotas, zoom y desplazamiento
geo/                          geometría (port del escritorio: desarrollos/*.py es la fuente de verdad)
  base.js                     Param, PiezaGen, números como Python (redondeo, coma decimal), triangulación
  t_cil_cil.js, codo_sectores.js, tronco_cono.js, tronco_piramide.js
  medidas.js                  tamaño de la chapa y peso (acero)
  index.js                    lista de figuras
sw.js                         caché para usar sin internet (subir VERSION al cambiar cualquier archivo)
manifest.webmanifest, img/, fuentes/ (Barlow, SIL OFL 1.1)
tools/volcar_casos.py         casos de referencia desde el programa de escritorio → tests/casos.json
tools/imagenes_figuras.py     imágenes del catálogo con el motor del escritorio → img/fig/
tests/comparar.mjs            compara la geometría JS contra tests/casos.json
```

## Probar
```
node tests/comparar.mjs                                  # 49 de 49 OK
python -m http.server 8000                               # y abrir http://localhost:8000
```
Si cambia una figura en el escritorio: `python tools/volcar_casos.py RUTA/nesting-cnc` y volver a comparar.

## Diferencias conocidas con el escritorio
- Fondo de tolva: la pieza puede salir girada 180° respecto del escritorio (misma pieza). El escritorio la orienta
  con el rectángulo mínimo de shapely, que elige el lado largo según la versión de GEOS.
- Cono en punta excéntrico: hasta 4·10⁻⁵ mm de diferencia (ruido numérico de la triangulación). El resto, < 10⁻⁹ mm.
