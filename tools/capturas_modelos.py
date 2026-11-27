#!/usr/bin/env python3
"""
Imágenes de la galería de modelos de Rejas y portones (27-nov, Max): la vista 3D de la app con cada modelo, los
portones en batiente 2 hojas de 3000 × 2000 entre paredes de ladrillo con piso de adoquín y la reja de ventana de
800 × 800 en su pared, con los perfiles de ejemplo. Guarda img/modelos/<porton|reja>-<id>.webp (720 × 540).

    python tools/capturas_modelos.py [--chrome RUTA] [--solo ID]

Necesita el código PRO de desarrollo en pro/ (enlace al repo privado; los portones son PRO) y Playwright + Pillow.
Volver a correrlo si cambia el 3D (colores, paredes, piso) o la lista de modelos (portones/modelos.js).
"""
import argparse
import io
import json
import os
import subprocess
import sys
import time

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUERTO = 8793
ANCHO, ALTO = 720, 540
ACERCAR = {"porton": 3, "reja": 3}                       # vueltas de la rueda hacia adentro
# lo que no va en la foto: barras y avisos de la vista, el cartel de instalar
OCULTAR = (".p-completa-barra, .p-3d-ayuda, .p-3d-aviso, .p-3d-entorno, .instalar { display: none !important; }"
           " .p-3d-lienzo { position: fixed !important; inset: 0 !important; }")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default="/usr/bin/google-chrome")
    ap.add_argument("--solo", help="un modelo (id)")
    a = ap.parse_args()
    if not os.path.exists(os.path.join(RAIZ, "pro", "portones", "tipos.js")):
        sys.exit("Falta pro/ (el repo privado): los portones son PRO.")
    destino = os.path.join(RAIZ, "img", "modelos")
    os.makedirs(destino, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PUERTO), "-d", RAIZ],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    base = f"http://localhost:{PUERTO}/"
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=a.chrome, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            ctx = b.new_context(viewport={"width": ANCHO, "height": ALTO}, device_scale_factor=1)
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(base + "?pro=1#inicio")
            lista = pg.evaluate("""async () => {
              const M = await import('./portones/modelos.js');
              return M.MODELOS.flatMap((m) => m.para.map((para) => [m.id, para]));
            }""")
            hechas = 0
            for mid, para in lista:
                if a.solo and mid != a.solo:
                    continue
                item = pg.evaluate("""async ([id, para]) => {
                  const P = await import('./portones/motor.js'), M = await import('./portones/modelos.js');
                  const tipo = para === 'porton' ? M.TIPO_PORTON : 'reja_ventana';
                  const [ancho, alto] = P.MEDIDAS_MUESTRA[tipo];
                  return M.aplicarModelo({ ...P.ITEM_DEF, tipo, ancho, alto, nombre: P.TEXTO[tipo],
                    perfil_marco: 'Tubo cuadrado 40×40×2', perfil_relleno: 'Tubo cuadrado 20×20×1,5' }, id, para);
                }""", [mid, para])
                pg.evaluate("(it) => localStorage.setItem('optimax-portones', JSON.stringify({ item: it }))", item)
                pg.goto("about:blank")                              # página nueva: sin la vista 3D anterior
                pg.goto(base + "?pro=1#portones")
                pg.wait_for_selector("#p-dibujo svg", timeout=15000)
                pg.add_style_tag(content=OCULTAR)
                pg.click("#p-3d")
                pg.wait_for_selector(".p-3d[data-piezas] canvas", timeout=30000)
                pg.wait_for_timeout(800)
                pg.mouse.move(ANCHO / 2, ALTO / 2)                   # un poco más cerca (rueda = acercar)
                for _ in range(ACERCAR[para]):
                    pg.mouse.wheel(0, -100)
                    pg.wait_for_timeout(120)
                pg.wait_for_timeout(1200)
                png = pg.locator(".p-3d-lienzo canvas").screenshot()
                img = Image.open(io.BytesIO(png)).convert("RGB")
                if img.size != (ANCHO, ALTO):
                    img = img.resize((ANCHO, ALTO), Image.LANCZOS)
                ruta = os.path.join(destino, f"{para}-{mid}.webp")
                img.save(ruta, "WEBP", quality=78, method=6)
                print(f"{para}-{mid}.webp  {os.path.getsize(ruta) // 1024} KB  ({pg.get_attribute('.p-3d', 'data-entorno')})")
                hechas += 1
            if errs:
                print("Errores de JS:", json.dumps(errs, ensure_ascii=False))
            print(f"{hechas} imágenes en {destino}")
            b.close()
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
