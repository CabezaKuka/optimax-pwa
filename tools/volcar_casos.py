#!/usr/bin/env python3
"""
Casos de referencia para validar la geometría de la PWA contra el programa de escritorio (fuente de verdad).

    python tools/volcar_casos.py RUTA/nesting-cnc

Corre los generadores de Python de optiMAX (desarrollos/) con las medidas de CASOS y escribe tests/casos.json con
las piezas (nombre, cantidad, entidades) o el mensaje de error. tests/comparar.mjs corre lo mismo en JS y compara.
Requiere: ezdxf, shapely (las mismas dependencias del escritorio).
"""
import json
import os
import sys

os.environ["OPTIMAX_IDIOMA"] = "es"

CASOS = {
    "t_cil_cil": [
        ({}, 2),
        ({"dr": 60}, 2),
        ({"dr": 60, "ang": 60}, 3),
        ({"dr": 60, "exc": 15}, 2),
        ({"dr": 80, "tipo": "Penetrante"}, 2),
        ({"costura": 90, "dr": 50}, 1.5),
        ({"partes": 3, "dp": 200, "dr": 150}, 3),
        ({"ppal": "Sí"}, 2),
        ({"ppal": "Sí", "ang": 45, "dr": 60, "exc": 10, "largo": 250, "largo_ppal": 400}, 2),
        ({"dp": 300, "dr": 100, "ang": 30, "largo": 400}, 4),
        ({"largo": 30}, 2),                                         # error: largo insuficiente
        ({"dr": 80, "exc": 30, "tipo": "Penetrante"}, 2),           # error: no apoya
        ({}, 60),                                                   # error: espesor
        ({"ppal": "Sí", "ang": 30, "largo_ppal": 150}, 2),          # error: largo (se controla antes)
        ({"ppal": "Sí", "largo_ppal": 50}, 2),                      # error: agujero no entra
    ],
    "codo_sectores": [
        ({}, 2),
        ({"ang": 45, "piezas": 3}, 2),
        ({"piezas": 2}, 1.5),
        ({"recto": 50}, 2),
        ({"costura": "Talón"}, 3),
        ({"costura": "Costado", "d": 150, "rc": 225}, 2),
        ({"partes": 2, "d": 600, "rc": 900}, 4),
        ({"ang": 180, "piezas": 12, "d": 100, "rc": 150}, 1),
        ({"ang": 30, "piezas": 4, "d": 250, "rc": 400, "recto": 20}, 2.5),
        ({"rc": 90}, 2),                                            # error: radio de curvatura
        ({}, 100),                                                  # error: espesor
    ],
    "tronco_cono": [
        ({}, 2),
        ({"partes": 3}, 2),
        ({"d2": 0}, 2),
        ({"exc": 50}, 2),
        ({"exc": 100, "partes": 2}, 3),
        ({"d2": 0, "exc": 50}, 2),
        ({"d1": 300, "d2": 300, "exc": 0}, 2),
        ({"exc": 30, "costura": 90}, 1.5),
        ({"d1": 1000, "d2": 150, "h": 600, "partes": 4}, 4),
        ({"d1": 200, "d2": 400}, 2),                                # error: boca menor mayor
        ({}, 150),                                                  # error: espesor
    ],
    "tronco_piramide": [
        ({}, 2),
        ({"x": 100, "y": -50}, 2),
        ({"partes": 2}, 3),
        ({"partes": 4}, 2),
        ({"inicio": 2}, 2),
        ({"A": 600, "B": 600, "a": 150, "b": 150, "h": 500}, 2),
        ({"A": 800, "B": 500, "a": 300, "b": 200, "x": 250, "y": 150, "h": 400, "partes": 2, "inicio": 1}, 2),
        ({"A": 1500, "B": 1200, "a": 300, "b": 300, "h": 900}, 3),
        ({"partes": 3}, 2),                                         # error: armado
        ({"x": 500}, 2),                                            # error: voladizo
        ({}, 100),                                                  # error: espesor
        ({"h": 1, "x": 390, "y": 320}, 2),                          # caso extremo (casi plano y corrido)
    ],
}


def area_corte(p):
    """Superficie de chapa con shapely (contornos aplanados a 0,005 mm; agujeros por par / impar), para controlar
    el peso que muestra la PWA."""
    from ezdxf import path as ezpath
    from shapely.geometry import Polygon
    geo = None
    for e in p.a_doc(solo_corte=True).modelspace():
        pts = [(v.x, v.y) for v in ezpath.make_path(e).flattening(0.005)]
        pg = Polygon(pts).buffer(0)
        geo = pg if geo is None else geo.symmetric_difference(pg)
    return geo.area if geo is not None else 0.0


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python tools/volcar_casos.py RUTA/nesting-cnc")
    sys.path.insert(0, os.path.abspath(sys.argv[1]))
    import importlib
    salida = {}
    for gid, casos in CASOS.items():
        g = importlib.import_module(f"desarrollos.{gid}").GENERADORES[0]
        lista = []
        for params, esp in casos:
            crudo = {k: str(v) for k, v in params.items()}
            item = {"params": params, "espesor": esp}
            try:
                v = g.leer(crudo)
                piezas = g.generar(v, esp)
                item["piezas"] = [{"nombre": p.nombre, "cantidad": p.cantidad,
                                   "ents": [[c, t, d] for c, t, d in p.ents], "area": area_corte(p)} for p in piezas]
            except ValueError as e:
                item["error"] = str(e)
            lista.append(item)
        salida[gid] = lista
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "casos.json")
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False)
    for gid, lista in salida.items():
        err = sum("error" in c for c in lista)
        print(f"{gid}: {len(lista)} casos ({err} con error)")


if __name__ == "__main__":
    main()
