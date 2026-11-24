#!/usr/bin/env python3
"""
Recorridos de la PWA en Chrome sin pantalla (Playwright), en celular (390 × 844, táctil) y PC (1366 × 820).

    python tests/navegador.py [--capturas CARPETA] [--chrome RUTA]

Levanta un servidor local en la raíz del repo. Si existe pro/ (el repo privado), prueba también la PRO de
desarrollo (?pro=1). Requiere: pip install playwright (usa el Chrome instalado; --chrome para otro).
"""
import argparse
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUERTO = 8791
ok = mal = 0


def control(cond, que):
    global ok, mal
    if cond:
        ok += 1
    else:
        mal += 1
        print(f"MAL  {que}")


def completa(pg):
    return pg.evaluate("!!document.querySelector('.plancha.completa')")


def arrastrar(cdp, x, y0, y1, n=12):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y0}]})
    for k in range(1, n + 1):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y0 + (y1 - y0) * k / n}]})
        time.sleep(0.016)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def celular(b, base, cap):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    control(pg.locator(".mod").count() == 5, "inicio: 5 módulos")
    control(pg.locator("a.mod").count() == 1, "inicio: solo Chapa se abre")
    control(pg.is_hidden("#migas"), "inicio: sin «← Inicio»")
    if cap:
        pg.screenshot(path=f"{cap}/c_inicio.png", full_page=True)
    pg.click("a.mod[href='#chapa']")
    pg.wait_for_selector("#chapas li")
    control(pg.url.endswith("#chapa"), "chapa: dirección #chapa")
    control(pg.is_visible("#migas"), "chapa: «← Inicio» visible")
    control(pg.inner_text("#fig-nom") == "T de caño", "chapa: figura por defecto")
    if cap:
        pg.screenshot(path=f"{cap}/c_chapa.png")
    # grilla de figuras
    pg.click("#fig-actual")
    pg.wait_for_selector("#hoja-figuras[open]")
    control(pg.locator(".grilla-figs .fig").count() == 12, "grilla: 12 figuras")
    control(pg.locator(".grilla-figs .fig-bloq").count() == 8, "grilla: 8 PRO bloqueadas")
    if cap:
        pg.screenshot(path=f"{cap}/c_grilla.png")
    pg.click(".grilla-figs .fig[data-id=tronco_cono]")
    pg.wait_for_timeout(500)
    control(pg.inner_text("#fig-nom") == "Cono / reducción", "grilla: elegir cono")
    control("Cono" in pg.inner_text("#chapas"), "grilla: lista del cono")
    pg.click("#fig-actual")
    pg.wait_for_selector("#hoja-figuras[open]")
    pg.click(".grilla-figs .fig[data-id=helicoide]")
    pg.wait_for_selector("#hoja-pro[open]")
    control("figura es de la versión PRO" in pg.inner_text("#pro-motivo"), "figura PRO → hoja de compra")
    control(pg.locator("#pro-extra .pro-figuras li").count() == 8, "hoja PRO: 8 figuras")
    href = pg.get_attribute("#btn-whatsapp", "href")
    control("Tronco%20de%20cono" in href, "WhatsApp con la figura que estaba usando")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    # un dedo sobre la plancha baja la página; un toque abre la pantalla completa; atrás la cierra
    cdp = ctx.new_cdp_session(pg)
    pg.evaluate("scrollTo(0,0)")
    caja = pg.locator("#vista").bounding_box()
    arrastrar(cdp, 200, caja["y"] + 150, caja["y"] - 150)
    pg.wait_for_timeout(500)
    control(pg.evaluate("scrollY") > 100 and not completa(pg), "un dedo sobre la plancha baja la página")
    pg.evaluate("scrollTo(0,0)")
    pg.wait_for_timeout(200)
    caja = pg.locator("#vista").bounding_box()
    pg.touchscreen.tap(caja["x"] + 50, caja["y"] + 50)
    pg.wait_for_timeout(400)
    control(completa(pg), "toque → pantalla completa")
    pg.go_back()
    pg.wait_for_timeout(400)
    control(not completa(pg) and pg.url.endswith("#chapa"), "atrás cierra la pantalla completa y sigue en Chapa")
    # atrás otra vez → inicio; adelante → chapa; ← Inicio
    pg.go_back()
    pg.wait_for_selector(".inicio")
    control(True, "atrás → inicio")
    pg.go_forward()
    pg.wait_for_selector("#chapas li")
    control(pg.inner_text("#fig-nom") == "Cono / reducción", "adelante → Chapa recuerda la figura")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")
    control(True, "«← Inicio»")
    # dirección directa y módulo que no hay
    pg.goto(base + "#chapa")
    pg.wait_for_selector("#chapas li")
    control(True, "entrar directo a #chapa")
    pg.goto(base + "#portones")
    pg.wait_for_selector(".inicio")
    control(not pg.url.endswith("#portones"), "módulo no disponible → inicio")
    # sin internet
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    pg.wait_for_timeout(1500)                                  # que el service worker termine de guardar
    ctx.set_offline(True)
    pg.goto(base + "#chapa")
    pg.wait_for_selector("#chapas li", timeout=8000)
    control(True, "sin internet: abre Chapa")
    ctx.set_offline(False)
    control(not errs, f"celular: errores de JS {errs}")
    ctx.close()


def pc(b, base, cap):
    ctx = b.new_context(viewport={"width": 1366, "height": 820})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "#chapa")
    pg.wait_for_selector("#chapas li")
    if cap:
        pg.screenshot(path=f"{cap}/p_chapa.png")
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    if cap:
        pg.screenshot(path=f"{cap}/p_inicio.png")
    control(not errs, f"PC: errores de JS {errs}")
    ctx.close()


def pro(b, base):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pedidos = []
    pg.on("request", lambda r: pedidos.append(r.url) if "/pro/" in r.url else None)
    pg.goto(base + "?pro=1#chapa")
    pg.wait_for_selector("#chapas li")
    control(any(u.endswith("/pro/chapa/figuras.js") for u in pedidos), "PRO de desarrollo: carga pro/chapa/figuras.js")
    control(pg.is_hidden(".btn-pro"), "PRO: sin «Comprar PRO»")
    pg.goto(base + "?pro=0")
    pg.wait_for_selector(".inicio")
    control(pg.is_visible(".btn-pro"), "?pro=0: vuelve la DEMO")
    control(not errs, f"PRO: errores de JS {errs}")
    ctx.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--capturas")
    ap.add_argument("--chrome", default="/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    a = ap.parse_args()
    if a.capturas:
        os.makedirs(a.capturas, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PUERTO), "-d", RAIZ],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    base = f"http://localhost:{PUERTO}/"
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=a.chrome, args=["--no-sandbox"])
            celular(b, base, a.capturas)
            pc(b, base, a.capturas)
            if os.path.isdir(os.path.join(RAIZ, "pro")):
                pro(b, base)
            b.close()
    finally:
        srv.terminate()
    print(f"\n{ok} de {ok + mal} OK")
    sys.exit(1 if mal else 0)


if __name__ == "__main__":
    main()
