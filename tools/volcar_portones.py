#!/usr/bin/env python3
"""
Casos de referencia de Rejas y portones, desde el programa de escritorio (portones.py es la fuente de verdad).

    python tools/volcar_portones.py RUTA/nesting-cnc --salida tests/casos_portones.json            (solo rejas: DEMO)
    python tools/volcar_portones.py RUTA/nesting-cnc --todos --salida pro/tests/casos_portones.json (todo: PRO)

Lo comparan tests/portones.mjs (motor público, reja de ventana) y pro/tests/portones.mjs (portones, barras completas
y costos).
"""
import argparse
import json
import os
import random
import sys

os.environ["OPTIMAX_IDIOMA"] = "es"

MATERIALES = [
    {"nombre": "Tubo cuadrado 40×40×2", "forma": "tubo", "medidas": "40x40x2", "largo": 6000, "precio": 120.0, "kg_m": 0},
    {"nombre": "Tubo 60×40×2", "forma": "tubo", "medidas": "60x40x2", "largo": 6000, "precio": 150.0, "kg_m": 0},
    {"nombre": "Tubo cuadrado 20×20×1,5", "forma": "tubo", "medidas": "20x20x1,5", "largo": 6000, "precio": 45.0, "kg_m": 0},
    {"nombre": "Tubo 30×30×1,5", "forma": "tubo", "medidas": "30x30x1.5", "largo": 6400, "precio": 0, "kg_m": 0},
    {"nombre": "Macizo cuadrado 12", "forma": "macizo_cuad", "medidas": "12", "largo": 6000, "precio": 60.0, "kg_m": 0},
    {"nombre": "Macizo redondo Ø12", "forma": "macizo_red", "medidas": "Ø12", "largo": 6000, "precio": 55.0, "kg_m": 0.9},
    {"nombre": "Planchuela 1 1/2 x 3/16\"", "forma": "planchuela", "medidas": "1 1/2 x 3/16\"", "largo": 6000,
     "precio": 70.0, "kg_m": 0},
    {"nombre": "Ángulo 1 1/4\" × 1/8\"", "forma": "angulo", "medidas": "1 1/4 x 1/8\"", "largo": 6000, "precio": 80.0,
     "kg_m": 0},
    {"nombre": "Tubo redondo Ø1\" × 2", "forma": "tubo_red", "medidas": "Ø1\" × 2", "largo": 6000, "precio": 50.0,
     "kg_m": 0},
    {"nombre": "Tubo 100×50×2", "forma": "tubo", "medidas": "100x50x2", "largo": 3000, "precio": 90.0, "kg_m": 0},
]
TEXTOS_MEDIDA = [("tubo", "40x40x2"), ("tubo", "40×40×2"), ("tubo", "1 1/2\" cal.16"), ("tubo", "60 x 40"),
                 ("tubo", "Tubo 50x50x1,5 mm"), ("tubo", "20x20x12"), ("tubo_red", "Ø25,4x2"), ("tubo_red", "Ø1\" × 2"),
                 ("tubo_red", "3/4\" #18"), ("macizo_cuad", "12"), ("macizo_cuad", "1/2\""), ("macizo_red", "Ø16"),
                 ("planchuela", "1 1/2 x 3/16\""), ("planchuela", "38x5"), ("planchuela", "38"), ("angulo", "1 1/4 x 1/8\""),
                 ("angulo", "40x40x3"), ("angulo", "40x3"), ("angulo", "x"), ("tubo", ""), ("tubo", "3/0x2"),
                 ("macizo_red", "abc 12,7 def")]
NOMBRES = ["Tubo cuadrado 40×40×2", "Ángulo 40×40×3", "Planchuela 1 1/2 x 3/16\"", "Caño redondo Ø1\" × 2",
           "Macizo redondo Ø12", "Hierro cuadrado 12", "Perfil C 100", "Tubo 30x30x1,5", "Angular 1\" x 1/8\""]


def volcar_R(R, P):
    if R is None:
        return None
    return {
        "vano": list(R.vano), "hojas": [list(h) for h in R.hojas],
        "formas": [[cap, [list(p) for p in pts], [k[0], k[1], [list(k[2][0]), list(k[2][1]), k[2][2]]] if k else None]
                   for cap, pts, k in R.formas],
        "luces": R.luces, "u": R.u, "herrajes": [list(h) for h in R.herrajes],
        "soldadura_extra_mm": R.soldadura_extra_mm,
        "cotas": [{"eje": c.eje, "origen": c.origen, "puntos": list(c.puntos), "pos": c.pos, "base": c.base,
                   "tipo": c.tipo, "lado": c.lado, "general": c.general, "valores": [list(v) for v in c.valores()],
                   "trazos": [[list(l) for l in P.trazos_cota(c, 30.0, R.u, True)[0]],
                              [list(t) for t in P.trazos_cota(c, 30.0, R.u, True)[1]]],
                   "trazos_pdf": [list(t) for t in P.trazos_cota(c, 25.0, R.u, False)[1]]}
                  for c in R.cotas],
        "limites": list(P.limites(R)), "limites_cotas": list(P.limites(R, True)),
    }


def corte_json(k):
    return [list(k[0]), list(k[1]), k[2]]


def volcar_calc(c, P):
    return {
        "filas": [{"marca": f["marca"], "perfil": f["perfil"].nombre, "largo": f["largo"], "corte": corte_json(f["corte"]),
                   "cant": f["cant"], "usos": sorted(f["usos"]), "color": f["color"],
                   "texto_corte": P.texto_corte(f["corte"]), "croquis": [list(p) for p in P.croquis(f["corte"], 64, 10)]}
                  for f in c["filas"]],
        "grupos": [{"perfil": g["perfil"].nombre, "n_barras": g["n_barras"],
                    "barras": [[list(x) for x in b] for b in g["barras"]],
                    "patrones": [{"piezas": [list(x) for x in p["piezas"]], "n": p["n"], "sobrante": p["sobrante"]}
                                 for p in g["patrones"]],
                    "largas": [f["marca"] for f in g["largas"]], "pedidas": [list(p) for p in g["pedidas"]],
                    "mm_neto": g["mm_neto"], "mm_largas": g["mm_largas"], "kg_neto": g["kg_neto"],
                    "kg_compra": g["kg_compra"], "costo": g["costo"], "aprovechamiento": g["aprovechamiento"]}
                   for g in c["grupos"]],
        "errores": c["errores"], "avisos": c["avisos"], "herrajes": [list(h) for h in c["herrajes"]],
        "piezas": c["piezas"], "kg_chapa": c["kg_chapa"], "m2_chapa": c["m2_chapa"], "kg_neto": c["kg_neto"],
        "kg_compra": c["kg_compra"], "sold_m": c["sold_m"], "pint_m2": c["pint_m2"], "n_barras": c["n_barras"],
        "costos": c["costos"], "items": c["items"], "resultados": [volcar_R(R, P) for R in c["resultados"]],
        "verificar": P.verificar(c),
    }


def item_azar(rnd, tipos, nombres):
    tipo = rnd.choice(tipos)
    relleno = rnd.choice(["verticales", "horizontales", "diagonales", "rombos", "cuadricula", "cruz", "chapa",
                          "verticales", "diagonales"])
    if tipo == "reja_ventana":
        ancho, alto = rnd.choice([(1200, 1000), (1500, 1000), (800, 600), (1000, 1500), (950.5, 733)]), None
        ancho, alto = ancho
        if rnd.random() < 0.5:
            ancho, alto = float(rnd.randint(300, 1500)), float(rnd.randint(300, 1000))
            if rnd.random() < 0.5:
                ancho, alto = alto, ancho
    else:
        ancho, alto = float(rnd.randint(900, 5000)), float(rnd.randint(1200, 2600))
    marco = rnd.choice(["Tubo cuadrado 40×40×2", "Tubo 60×40×2", "Tubo 30×30×1,5", "Ángulo 1 1/4\" × 1/8\"",
                        "Tubo 100×50×2"])
    rell = rnd.choice(["Tubo cuadrado 20×20×1,5", "Macizo cuadrado 12", "Macizo redondo Ø12",
                       "Planchuela 1 1/2 x 3/16\"", "Tubo redondo Ø1\" × 2", "Tubo 30×30×1,5"])
    it = {"nombre": rnd.choice(["", "Reja frente", "Portón casa"]), "cantidad": rnd.randint(1, 3), "tipo": tipo,
          "ancho": ancho, "alto": alto, "perfil_marco": marco, "perfil_relleno": rell,
          "perfil_trav": rnd.choice(["", "", "Tubo 30×30×1,5", "Tubo cuadrado 20×20×1,5"]),
          "relleno": relleno, "luz_max": float(rnd.choice([100, 110, 120, 150, 90, 200, 127.5])),
          "angulo": float(rnd.choice([45, 30, 60, 37.5, 15, 75])), "n_trav": rnd.choice([0, 1, 1, 2, 3]),
          "armado": rnd.choice(["a_tope", "pasantes"]), "holg_lat": float(rnd.choice([10, 5, 20])),
          "holg_centro": float(rnd.choice([10, 5, 15])), "luz_piso": float(rnd.choice([30, 0, 50])),
          "solape": float(rnd.choice([100, 150, 0])), "esp_chapa": float(rnd.choice([1.5, 0.9, 2]))}
    return it


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("escritorio")
    ap.add_argument("--todos", action="store_true", help="también portones, barras completas y costos (PRO)")
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()
    sys.path.insert(0, os.path.abspath(a.escritorio))
    import portones as P
    perfiles = P.perfiles_de(MATERIALES)
    tipos = [t for t, _ in P.TIPOS] if a.todos else ["reja_ventana"]
    rnd = random.Random(2611 if a.todos else 2612)
    casos = []
    # fijos: la muestra de la DEMO con cada relleno, armados, travesaños, y errores
    fijos = []
    for tipo in tipos:
        for relleno, _ in P.RELLENOS:
            for n_trav, armado in ((0, "a_tope"), (1, "a_tope"), (2, "pasantes")):
                med = {"reja_ventana": (1200, 1000), "batiente_1": (1200, 1800), "batiente_2": (3000, 2000),
                       "corredizo": (4000, 1800)}[tipo]
                fijos.append([{"tipo": tipo, "relleno": relleno, "ancho": med[0], "alto": med[1], "n_trav": n_trav,
                               "armado": armado, "perfil_marco": "Tubo cuadrado 40×40×2",
                               "perfil_relleno": "Tubo cuadrado 20×20×1,5", "luz_max": 110}])
    base = {"tipo": "reja_ventana", "ancho": 1200, "alto": 1000, "perfil_marco": "Tubo cuadrado 40×40×2",
            "perfil_relleno": "Tubo cuadrado 20×20×1,5"}
    errores = [dict(base, perfil_marco=""), dict(base, perfil_marco="No existe"), dict(base, perfil_relleno=""),
               dict(base, relleno="chapa", perfil_relleno=""), dict(base, ancho=0), dict(base, luz_max=0),
               dict(base, relleno="rombos", angulo=85), dict(base, relleno="chapa", esp_chapa=0),
               dict(base, ancho=70), dict(base, n_trav=10, alto=400), dict(base, relleno="horizontales", n_trav=10, ancho=300),
               dict(base, perfil_trav="Nada", n_trav=1), dict(base, relleno="xx", armado="yy", tipo="panel_cerco"),
               dict(base, ancho="abc", cantidad=0, n_trav=40),
               dict(base, ancho=7000, perfil_relleno="Tubo 100×50×2", relleno="horizontales", luz_max=200)]
    fijos += [[e] for e in errores]
    if a.todos:
        fijos.append([dict(base, tipo="batiente_2", ancho=40, alto=2000, holg_lat=10, holg_centro=10)])
    for _ in range(120 if a.todos else 80):
        n = 1 if rnd.random() < 0.8 else 2
        fijos.append([item_azar(rnd, tipos, None) for _ in range(n)])
    for k, items in enumerate(fijos):
        corte = rnd.choice([3.0, 3.0, 2.0, 0.0, 4.5])
        costos = {"soldadura_m": rnd.choice([0, 12.5, 20]), "pintura_m2": rnd.choice([0, 35, 50.5]),
                  "chapa_m2": rnd.choice([0, 80])}
        margen = rnd.choice([1.0, 1.3, 1.45])
        c = P.calcular(items, perfiles, corte, costos if a.todos else None, margen)
        casos.append({"items": items, "corte": corte, "costos": costos, "margen": margen, "calc": volcar_calc(c, P)})
    out = {"materiales": MATERIALES, "casos": casos,
           "medidas": [[f, t, P.leer_medidas(f, t)] for f, t in TEXTOS_MEDIDA],
           "deducir": [[n, list(P.deducir_perfil(n))] for n in NOMBRES],
           "kg_m": [[m["forma"], m["medidas"], P.kg_m_medidas(m["forma"], m["medidas"])] for m in MATERIALES],
           "distribuir": [[l, b, m, list(P.distribuir(l, b, m))] for l, b, m in
                          ((1000, 20, 100), (100, 20, 100), (1120, 12, 110), (2920, 25.4, 127.5), (500, 40, 1))],
           "miniaturas": {f"{t}|{r}": (len(R.formas) if R else None) for t in tipos for r, _ in P.RELLENOS
                          for R in [P.miniatura(t, r)]},
           "demo": [[w, h, P.demo_max(h), P.demo_permite(P.normalizar_item({"tipo": "reja_ventana", "ancho": w, "alto": h}))]
                    for w, h in ((1500, 1000), (1000, 1500), (1501, 900), (1200, 1200), (900, 1500), (1500, 1000.1))]}
    with open(a.salida, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"{len(casos)} casos → {a.salida}")


if __name__ == "__main__":
    main()
