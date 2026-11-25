# optiMAX PWA

optiMAX en el celular y el navegador: desarrollos de chapa (T de caño, codo por gajos, cono / reducción y fondo de
tolva) con la plantilla y sus cotas. Anda sin internet (service worker). Exportar DXF e imprimir a escala son PRO:
abren la hoja de compra (WhatsApp).

Es estática: se publica con GitHub Pages desde `main` (Settings → Pages → Deploy from a branch → `main` / root).
No tiene paso de compilación.

## Archivos
```
index.html, app.css           cabecera, «← Inicio», hoja de compra, pie (el contenido lo pone cada pantalla)
app.js                        arranque y rutas (#inicio, #chapa, …), instalar, service worker
modulos.js                    módulos por oficio (disponible = false → «Próximamente» en el inicio)
inicio.js                     pantalla de inicio
modulos/chapa.js              módulo Chapa (figura, medidas, plancha, lista de chapas)
modulos/barras.js             módulo Barras y tubos (piezas, pegar lista, barras dibujadas, lista de corte, precio PRO)
barras/motor.js               corte de barras de la DEMO (lectura de listas, cálculo rápido); el completo es PRO
modulos/guillotina.js         módulo Guillotina (tablero, piezas, planchas dibujadas con los cortes numerados, orden de corte)
guillotina/motor.js           cortes de guillotina de la DEMO (144 combinaciones fijas); la búsqueda completa es PRO
modulos/portones.js           módulo Rejas y portones (tipo, medidas, perfiles, relleno, elevación con marcas y cotas, lista de corte, barras)
portones/motor.js             elevación, piezas con su corte, marcas, barras, peso y cotas (portones.py); los portones y los costos son PRO
barras/trabajador.js          Worker del optimizador completo de barras (PRO), para no trabar la pantalla
licencia.js                   licencia PRO: código del dispositivo, clave OPWA1- (Ed25519, sin internet), código PRO cifrado (pro.bin)
licencia-config.js            llave pública y dirección del bot (las escribe el generador de claves del repo privado)
vendor/ed25519.js             noble-ed25519 (MIT): verifica la firma de las claves en el navegador
pro.bin                       código PRO cifrado (AES-GCM); lo genera el repo privado (herramientas/), sin la llave no sirve
salida.js                     hoja «Imprimir / guardar en PDF» (opciones, páginas, Descargar / Compartir); el PDF lo arma el código PRO
hoja-pro.js, iconos.js        hoja de compra («Ya compré: activar» con el código del dispositivo); íconos de los módulos
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
tools/volcar_portones.py      casos de Rejas y portones desde el escritorio → tests/casos_portones.json (--todos: los del PRO)
tests/portones.mjs            compara el motor de portones (reja de ventana) contra tests/casos_portones.json
```

## Probar
```
node tests/comparar.mjs                                  # geometría contra el escritorio: 49 de 49 OK
node tests/portones.mjs                                  # rejas contra el escritorio: 175 de 175 OK
python tests/navegador.py                                # recorridos en Chrome (celular y PC)
python -m http.server 8000                               # y abrir http://localhost:8000
```

## Código PRO
Vive en el repo privado **CabezaKuka/optimax-pwa-pro** (este repo es público). En desarrollo se clona o enlaza en
`pro/` (ignorado por git) y se prende con `http://localhost:8000/?pro=1` (`?pro=0` la apaga; solo en localhost).
Publicada, la PRO se activa con una clave `OPWA1-` para el código del dispositivo: la PWA verifica la firma sin
internet y le pide al bot (Railway, `POST /pwa/llave`) la llave de `pro.bin` una sola vez. Claves, llaves y `pro.bin`
salen del repo privado (`herramientas/`, ver su LEEME.md).
Si cambia una figura en el escritorio: `python tools/volcar_casos.py RUTA/nesting-cnc` y volver a comparar.

## Diferencias conocidas con el escritorio
- Fondo de tolva: la pieza puede salir girada 180° respecto del escritorio (misma pieza). El escritorio la orienta
  con el rectángulo mínimo de shapely, que elige el lado largo según la versión de GEOS.
- Cono en punta excéntrico: hasta 4·10⁻⁵ mm de diferencia (ruido numérico de la triangulación). El resto, < 10⁻⁹ mm.
