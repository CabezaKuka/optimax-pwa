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
    control(pg.locator("a.mod").count() == 3, "inicio: se abren Chapa, Barras y Guillotina")
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
    barras_demo(pg, base, cap)
    guillotina_demo(pg, base, cap)
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


def resumen_barras(pg):
    return pg.inner_text("#b-resumen .dato-v >> nth=0")


def barras_demo(pg, base, cap):
    pg.evaluate("localStorage.removeItem('optimax-barras')")
    pg.goto(base + "#barras")
    pg.wait_for_selector("#b-resumen .dato")
    control(pg.locator(".pieza").count() == 3, "barras: 3 renglones de ejemplo")
    control(resumen_barras(pg) == "1" and pg.is_hidden("#b-demo"), "barras: el ejemplo entra en 1 barra, sin aviso")
    control(pg.is_visible(".precio-pro") and pg.is_hidden("#b-precio"), "barras DEMO: precio bloqueado")
    if cap:
        pg.screenshot(path=f"{cap}/c_barras.png", full_page=True)
    pg.click(".pieza >> nth=0 >> .mas")
    pg.wait_for_timeout(300)
    control(pg.is_visible("#b-demo") and "1 afuera" in pg.inner_text("#b-demo").replace("quedaron ", ""),
            "barras DEMO: con 6 piezas avisa que calcula 5")
    # pegar lista
    pg.click("#b-pegar")
    pg.wait_for_selector("#hoja-pegar[open]")
    pg.fill("#pegar-txt", "Largo\tCantidad\n2500\t3\n1200\t1\n")
    pg.click("#pegar-ok")
    pg.wait_for_timeout(400)
    control(pg.locator(".pieza").count() == 4, "barras: pegar suma la cantidad al largo repetido y agrega el nuevo")
    control(pg.input_value(".pieza >> nth=3 >> input") == "2500", "barras: el largo pegado queda en la lista")
    # largo inválido
    pg.fill(".pieza >> nth=1 >> input", "8o0")
    pg.wait_for_timeout(400)
    control(pg.is_visible("#b-error") and "Pieza 2" in pg.inner_text("#b-error"), "barras: largo inválido")
    pg.fill(".pieza >> nth=1 >> input", "800")
    pg.fill("#b-largo", "1000")
    pg.wait_for_timeout(400)
    control("no entra" in pg.inner_text("#b-error"), "barras: pieza más larga que la barra")
    pg.fill("#b-largo", "6000")
    pg.wait_for_timeout(400)
    control(pg.is_hidden("#b-error"), "barras: se corrige")
    pg.reload()
    pg.wait_for_selector("#b-resumen .dato")
    control(pg.locator(".pieza").count() == 4, "barras: recuerda la lista")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")


def guillotina_demo(pg, base, cap):
    pg.evaluate("localStorage.removeItem('optimax-guillotina')")
    pg.goto(base + "#guillotina")
    pg.wait_for_selector("#g-resumen .dato")
    control(pg.locator(".pieza").count() == 3, "guillotina: 3 renglones de ejemplo")
    control(pg.inner_text("#g-resumen .dato-v >> nth=0") == "1" and pg.is_hidden("#g-demo"), "guillotina: el ejemplo en 1 plancha")
    control(pg.locator(".g-plancha").count() == 1 and pg.locator(".g-plancha rect").count() >= 6, "guillotina: plancha dibujada")
    if cap:
        pg.screenshot(path=f"{cap}/c_guillotina.png", full_page=True)
    pg.click(".pieza >> nth=0 >> .mas")
    pg.wait_for_timeout(500)
    control(pg.is_visible("#g-demo"), "guillotina DEMO: con 6 piezas avisa que calcula 5")
    pg.click("#g-pegar")
    pg.wait_for_selector("#hoja-pegar[open]")
    pg.fill("#pegar-txt", "300 x 1200  1\n700;500;2\n")
    pg.click("#pegar-ok")
    pg.wait_for_timeout(500)
    control(pg.locator(".pieza").count() == 4, "guillotina: pegar suma y agrega")
    pg.fill("#g-max", "900")
    pg.wait_for_timeout(600)
    control(pg.is_visible("#g-error") and "cizalla" in pg.inner_text("#g-error"), "guillotina: corte más largo que la cizalla")
    pg.fill("#g-max", "0")
    pg.uncheck("#g-rotar")
    pg.wait_for_timeout(600)
    control(pg.is_hidden("#g-error"), "guillotina: sin girar también entra")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")


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


def pro(b, base, cap):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pedidos = []
    pg.on("request", lambda r: pedidos.append(r.url) if "/pro/" in r.url else None)
    pg.goto(base + "?pro=1#chapa")
    pg.wait_for_selector("#chapas li")
    control(any(u.endswith("/pro/chapa/figuras.js") for u in pedidos), "PRO de desarrollo: carga pro/chapa/figuras.js")
    control(pg.is_hidden(".btn-pro"), "PRO: sin «Comprar PRO»")
    # las 12 figuras habilitadas; cada PRO se calcula y se dibuja sin error
    pg.click("#fig-actual")
    pg.wait_for_selector("#hoja-figuras[open]")
    control(pg.locator(".grilla-figs .fig-bloq").count() == 0, "PRO: ninguna figura bloqueada")
    pg.keyboard.press("Escape")
    for fid in ("t_rect_cil", "t_cil_rect", "codo_rect", "curva_directa_90", "curva_directa", "desvio_paralelo",
                "transicion_rect_red", "helicoide"):
        pg.click("#fig-actual")
        pg.wait_for_selector("#hoja-figuras[open]")
        pg.click(f".grilla-figs .fig[data-id={fid}]")
        pg.wait_for_timeout(400)
        n = pg.locator("#chapas li").count()
        trazos = pg.evaluate("document.querySelector('#vista .corte')?.getAttribute('d').length || 0")
        control(n >= 1 and trazos > 50 and pg.is_hidden("#error"), f"PRO: {fid} se calcula y se dibuja")
        if cap:
            pg.locator(".plancha").screenshot(path=f"{cap}/pro_{fid}.png")
    # barras con PRO: sin tope, optimizador completo y precio por pieza
    pg.evaluate("localStorage.setItem('optimax-barras', JSON.stringify({largo:'6000',corte:'3',filas:[['1200',8],['800',12],['450',20]],precio:'',reparto:false}))")
    pg.goto(base + "#barras")
    pg.wait_for_selector("#b-resumen .dato")
    control(pg.is_hidden("#b-demo"), "barras PRO: 40 piezas sin aviso")
    control(any(u.endswith("/pro/barras/optimizar.js") for u in pedidos), "barras PRO: carga el optimizador completo")
    control(pg.is_visible("#b-precio") and pg.is_hidden(".precio-pro"), "barras PRO: precio habilitado")
    pg.fill("#b-precio", "120")
    pg.wait_for_timeout(400)
    control(pg.locator("#b-costo tbody tr").count() == 3, "barras PRO: precio de cada pieza")
    if cap:
        pg.screenshot(path=f"{cap}/pro_barras.png", full_page=True)
    # guillotina con PRO: búsqueda completa sin trabar, precio por pieza
    pg.evaluate("localStorage.setItem('optimax-guillotina', JSON.stringify({largo:'2440',ancho:'1220',corte:'3',refilado:'5',max:'0',rotar:true,filas:[['720','560',6],['350','560',8],['720','300',4],['400','400',5]],precio:'',reparto:false}))")
    pg.goto(base + "#guillotina")
    pg.wait_for_selector("#g-resumen .dato", timeout=10000)
    pg.wait_for_selector("#g-calc", state="hidden", timeout=10000)
    control(pg.is_hidden("#g-demo"), "guillotina PRO: 23 piezas sin aviso")
    control(any(u.endswith("/pro/guillotina/optimizar.js") for u in pedidos), "guillotina PRO: carga la búsqueda completa")
    pg.fill("#g-precio", "450")
    pg.wait_for_timeout(2500)
    pg.wait_for_selector("#g-calc", state="hidden", timeout=10000)
    control(pg.locator("#g-costo tbody tr").count() == 4, "guillotina PRO: precio de cada pieza")
    if cap:
        pg.screenshot(path=f"{cap}/pro_guillotina.png", full_page=True)
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
                pro(b, base, a.capturas)
            b.close()
    finally:
        srv.terminate()
    print(f"\n{ok} de {ok + mal} OK")
    sys.exit(1 if mal else 0)


if __name__ == "__main__":
    main()
