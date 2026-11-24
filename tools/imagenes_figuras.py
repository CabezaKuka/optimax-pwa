#!/usr/bin/env python3
"""
Imágenes del catálogo de la PWA, dibujadas con el mismo motor del escritorio (desarrollos/iconos.py).

    python tools/imagenes_figuras.py RUTA/nesting-cnc

Escribe img/fig/<id>.webp (240 × 180, se muestran a la mitad). Requiere Pillow y shapely.
"""
import os
import sys

os.environ["OPTIMAX_IDIOMA"] = "es"
IDS = ["t_cil_cil", "codo_sectores", "tronco_cono", "tronco_piramide",              # libres en la PWA
       "t_rect_cil", "t_cil_rect", "codo_rect", "curva_directa_90", "curva_directa", "desvio_paralelo",
       "transicion_rect_red", "helicoide"]                                           # PRO (vidriera)


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python tools/imagenes_figuras.py RUTA/nesting-cnc")
    sys.path.insert(0, os.path.abspath(sys.argv[1]))
    from desarrollos import iconos
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img", "fig")
    os.makedirs(dest, exist_ok=True)
    for gid in IDS:
        im = iconos.imagen(gid, 240, 180)
        if im is None:
            print(f"sin imagen: {gid}")
            continue
        im.save(os.path.join(dest, f"{gid}.webp"), "WEBP", quality=88, method=6)
        print(gid, os.path.getsize(os.path.join(dest, f"{gid}.webp")), "bytes")


if __name__ == "__main__":
    main()
