#!/usr/bin/env python3
"""
Casos de referencia para validar la geometría de la PWA contra el programa de escritorio (fuente de verdad).

    python tools/volcar_casos.py RUTA/nesting-cnc                       # figuras DEMO → tests/casos.json
    python tools/volcar_casos.py RUTA/nesting-cnc --casos pro/tests/casos_pro.py --salida pro/tests/casos.json

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


def _muestrear(ent, paso=0.02):
    """Puntos de un contorno de CORTE (arcos y círculos muestreados en ángulos de 'paso' rad, exactos sobre la
    curva). No usa ezdxf.path: ese aproxima los arcos con Béziers (≈ 3e-4 de error en el área)."""
    import math
    capa, tipo, d = ent
    if tipo == "poly":
        return list(d[0])
    if tipo == "circle":
        cx, cy, r = d
        n = max(16, int(2 * math.pi / paso))
        return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    pts = []
    for i, (x, y, b) in enumerate(d):
        x1, y1 = d[(i + 1) % len(d)][:2]
        pts.append((x, y))
        if abs(b) < 1e-12:
            continue
        th = 4 * math.atan(b)
        c = math.hypot(x1 - x, y1 - y)
        r = abs(c / (2 * math.sin(th / 2)))
        ux, uy = (x1 - x) / c, (y1 - y) / c
        h = r * math.cos(th / 2) * (1 if th > 0 else -1)
        cx, cy = (x + x1) / 2 - uy * h, (y + y1) / 2 + ux * h
        a0 = math.atan2(y - cy, x - cx)
        n = max(2, int(abs(th) / paso))
        pts += [(cx + r * math.cos(a0 + th * k / n), cy + r * math.sin(a0 + th * k / n)) for k in range(1, n)]
    return pts


def area_corte(p):
    """Superficie de chapa con shapely (contornos muestreados; agujeros por par / impar), para controlar el peso que
    muestra la PWA. El muestreo por cuerdas da un poco menos que el área exacta (< 1e-4 relativo con paso 0,02)."""
    from shapely.geometry import Polygon
    geo = None
    for ent in p.ents:
        if ent[0] != "CORTE" or (ent[1] == "poly" and not ent[2][1]):
            continue
        pg = Polygon(_muestrear(ent)).buffer(0)
        geo = pg if geo is None else geo.symmetric_difference(pg)
    return geo.area if geo is not None else 0.0


def generador(gid):
    """Generador del escritorio por id (busca en todos los módulos de desarrollos/)."""
    import desarrollos
    for g in desarrollos.cargar():
        if g.id == gid:
            return g
    raise KeyError(gid)


def main():
    import argparse
    import runpy
    ap = argparse.ArgumentParser()
    ap.add_argument("escritorio", help="carpeta del programa de escritorio (nesting-cnc)")
    ap.add_argument("--casos", help="archivo .py con un dict CASOS (por defecto, los de acá)")
    ap.add_argument("--salida", help="JSON de salida (por defecto tests/casos.json)")
    a = ap.parse_args()
    sys.path.insert(0, os.path.abspath(a.escritorio))
    casos_todos = runpy.run_path(a.casos)["CASOS"] if a.casos else CASOS
    salida = {}
    for gid, casos in casos_todos.items():
        g = generador(gid)
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
    ruta = a.salida or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "casos.json")
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False)
    for gid, lista in salida.items():
        err = sum("error" in c for c in lista)
        print(f"{gid}: {len(lista)} casos ({err} con error)")


if __name__ == "__main__":
    main()
