#!/usr/bin/env python3
"""
Recorridos de la PWA en Chrome sin pantalla (Playwright), en celular (390 × 844, táctil) y PC (1366 × 820).

    python tests/navegador.py [--capturas CARPETA] [--chrome RUTA]

Levanta un servidor local en la raíz del repo. Si existe pro/ (el repo privado), prueba también la PRO de
desarrollo (?pro=1). Requiere: pip install playwright (usa el Chrome instalado; --chrome para otro).
"""
import argparse
import json
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


def bajar_pdf(pg, boton, que, opcion=None, cap=None):
    """Toca el botón de PDF (PRO), arma el PDF y lo descarga. Devuelve la cantidad de páginas (o 0 si falló)."""
    pg.click(boton)
    pg.wait_for_selector("#hoja-salida[open]")
    if opcion:
        pg.check(f"#hoja-salida input[value={opcion}]")
    pg.click("#s-armar")
    pg.wait_for_selector("#s-listo", state="visible", timeout=30000)
    with pg.expect_download() as d:
        pg.click("#s-descargar")
    ruta = d.value.path()
    with open(ruta, "rb") as fh:
        datos = fh.read()
    valido = datos.startswith(b"%PDF-1.4") and subprocess.run(["qpdf", "--check", ruta], capture_output=True).returncode == 0
    paginas = int(pg.get_attribute("#hoja-salida", "data-paginas") or 0)
    control(valido and paginas > 0, f"{que}: PDF descargado y válido ({paginas} páginas, {d.value.suggested_filename})")
    if cap:
        import shutil
        shutil.copy(ruta, os.path.join(cap, d.value.suggested_filename.replace(" ", "_")))
    pg.keyboard.press("Escape")
    return paginas


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
    control(pg.locator(".mod").count() == 4, "inicio: 4 módulos (Escaleras oculta)")
    control(pg.locator("a.mod").count() == 4, "inicio: se abren Chapa, Portones, Barras y Guillotina")
    control(pg.locator(".abrir").count() == 0 and pg.locator("a.mod .mod-img img").count() == 4,
            "inicio: sin botón «Abrir», cada tarjeta con su foto")
    control(pg.evaluate("[...document.querySelectorAll('.mod-img img')].every((i) => i.complete && i.naturalWidth > 0)"),
            "inicio: las 4 fotos cargan")
    control([pg.locator(".mod").nth(k).get_attribute("href") for k in range(4)] ==
            ["#chapa", "#portones", "#barras", "#guillotina"], "inicio: orden chapa, portones, barras, guillotina")
    control(pg.locator(".mod-desc").count() == 4 and "Lista de corte" in pg.inner_text(".inicio"),
            "inicio: cada tarjeta con su descripción")
    caja = [pg.locator(".mod").nth(k).bounding_box() for k in range(4)]
    control(abs(caja[0]["y"] - caja[1]["y"]) < 1 and caja[2]["y"] > caja[0]["y"] + 100,
            "inicio: de a 2 en el celular")
    control(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), "inicio: sin desborde a lo ancho")
    control("Escaleras" not in pg.inner_text(".inicio"), "inicio: Escaleras no aparece")
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
    # 3D de las piezas armadas (25-nov): las 4 DEMO, una pieza 3D por chapa a cortar
    for fid, extra in (("t_cil_cil", None), ("codo_sectores", None), ("tronco_cono", None), ("tronco_piramide", None),
                       ("t_cil_cil", "ppal")):
        pg.click("#fig-actual")
        pg.wait_for_selector("#hoja-figuras[open]")
        pg.click(f".grilla-figs .fig[data-id={fid}]")
        pg.wait_for_timeout(500)
        if extra == "ppal":
            pg.check("input[name=ppal][value='Sí']")
            pg.wait_for_timeout(500)
        chapas = sum(int(t.strip("×")) for t in pg.locator("#chapas li .ch-cant").all_inner_texts())
        control(pg.is_visible("#z-3d"), f"chapa 3D: botón en {fid}")
        pg.click("#z-3d")
        pg.wait_for_selector(".p-3d[data-triangulos]", timeout=15000)
        pg.wait_for_timeout(700)
        n = int(pg.get_attribute(".p-3d", "data-piezas"))
        refs = int(pg.get_attribute(".p-3d", "data-refs"))
        control(n == chapas and pg.locator(".p-3d canvas").count() == 1 and pg.locator(".p-3d .error-txt").count() == 0,
                f"chapa 3D {fid}{' con principal' if extra else ''}: {n} piezas de {chapas} chapas, {refs} de referencia")
        if fid == "t_cil_cil":
            control(refs == (0 if extra else 1), f"chapa 3D T: principal {'como chapa' if extra else 'de referencia'}")
        if cap:
            pg.screenshot(path=f"{cap}/c_chapa3d_{fid}{'_ppal' if extra else ''}.png")
        pg.click(".p-3d .p-c-cerrar")
        control(pg.locator(".p-3d").count() == 0, f"chapa 3D {fid}: cerrar")
    pg.click("#fig-actual")
    pg.wait_for_selector("#hoja-figuras[open]")
    pg.click(".grilla-figs .fig[data-id=tronco_cono]")
    pg.wait_for_timeout(400)
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
    pg.click("#btn-imprimir")
    pg.wait_for_selector("#hoja-pro[open]")
    control("PDF de la pieza" in pg.inner_text("#pro-motivo"), "chapa DEMO: PDF → hoja de compra")
    pg.keyboard.press("Escape")
    barras_demo(pg, base, cap)
    guillotina_demo(pg, base, cap)
    portones_demo(pg, base, cap)
    pg.goto(base + "#escaleras")
    pg.wait_for_selector(".inicio")
    control(not pg.url.endswith("#escaleras"), "módulo no disponible → inicio")
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


def ver_3d(pg, que, cap=None, nombre=None, entorno=None):
    """Abre la vista 3D del portón, controla que dibuje todas las piezas y la cierra. entorno = opción a elegir
    («Nada / Columnas / Paredes», solo portones) o None (reja de ventana: sin esos botones)."""
    n2d = pg.evaluate("document.querySelectorAll('#p-dibujo svg polygon, #p-dibujo svg path.p-forma').length")
    pg.click("#p-3d")
    pg.wait_for_selector(".p-3d[data-piezas]", timeout=15000)
    pg.wait_for_timeout(700)
    n3d = int(pg.get_attribute(".p-3d", "data-piezas"))
    control(n3d > 0 and pg.locator(".p-3d canvas").count() == 1 and pg.locator(".p-3d .error-txt").count() == 0 and
            "null" not in (pg.get_attribute(".p-3d", "data-planos") or ""), f"{que}: vista 3D con {n3d} piezas")
    if entorno is None:
        control(pg.locator(".p-3d-entorno").count() == 0, f"{que}: sin columnas ni paredes")
    else:
        control(pg.locator(".p-3d-entorno label").count() == (2 if entorno in ("Pared",) else 3) and
                pg.get_attribute(".p-3d", "data-entorno") in ("Nada", "Columnas", "Paredes", "Pared"), f"{que}: botones del alrededor")
        tx = pg.get_attribute(".p-3d", "data-texturas") or ""
        if entorno == "Pared":
            control(tx == "Pared:ladrillo" and pg.get_attribute(".p-3d", "data-piso") is None,
                    f"{que}: pared de ladrillo, sin piso ({tx})")
        else:
            control("Paredes:ladrillo" in tx and "Columnas:cemento" in tx and pg.get_attribute(".p-3d", "data-piso") == "adoquin",
                    f"{que}: paredes de ladrillo, columnas de cemento, piso de adoquín ({tx})")
        pg.click(f".p-3d-entorno label:has-text('{entorno}')")
        control(pg.get_attribute(".p-3d", "data-entorno") == entorno and pg.locator(".p-3d .error-txt").count() == 0 and
                (entorno == "Nada" or entorno in (pg.get_attribute(".p-3d", "data-armados") or "").split(",")),
                f"{que}: alrededor «{entorno}» dibujado")
    pg.click(".p-3d-frente")
    pg.mouse.move(195, 420)
    pg.mouse.down()
    pg.mouse.move(250, 470, steps=6)
    pg.mouse.up()
    pg.wait_for_timeout(400)
    if cap and nombre:
        pg.screenshot(path=f"{cap}/{nombre}.png")
    pg.click(".p-3d .p-c-cerrar")
    control(pg.locator(".p-3d").count() == 0, f"{que}: cerrar la vista 3D")
    return n3d, n2d


def guillotina_demo(pg, base, cap):
    pg.evaluate("localStorage.removeItem('optimax-guillotina')")
    pg.goto(base + "#guillotina")
    pg.wait_for_selector("#g-resumen .dato")
    control(pg.locator(".pieza").count() == 3, "guillotina: 3 renglones de ejemplo")
    control(pg.inner_text("#g-resumen .dato-v >> nth=0") == "1" and pg.is_hidden("#g-demo"), "guillotina: el ejemplo en 1 plancha")
    control(pg.locator("#t-btn .candado").count() == 1, "trabajos DEMO: barra con candado")
    pg.click("#t-btn")
    pg.wait_for_selector("#hoja-pro[open]")
    control("trabajos" in pg.inner_text("#pro-motivo"), "trabajos DEMO: abre la compra")
    pg.keyboard.press("Escape")
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
    # planchas: lista de materiales con nombre automático, elegir, otra medida, editar y borrar con confirmación
    control(pg.input_value("#g-plancha") == "Melamina 2440×1220×18 mm" and pg.is_hidden("#g-otra"), "planchas: arranca en melamina 18")
    control(pg.locator("#g-plancha option").count() == 12, "planchas: 11 de ejemplo + otra medida")
    control(pg.is_hidden("#g-pl-res"), "planchas DEMO: sin renglón de precio")
    pg.select_option("#g-plancha", "Plancha negra 2000×1000×2 mm")
    pg.wait_for_timeout(600)
    control("2.000 × 1.000" in pg.inner_text("#g-resumen"), "planchas: elegir otra recalcula con su medida")
    pg.select_option("#g-plancha", "")
    pg.wait_for_timeout(300)
    control(pg.is_visible("#g-largo") and pg.input_value("#g-largo") == "2000", "planchas: otra medida arranca con la de la elegida")
    pg.click("#g-admin")
    pg.wait_for_selector("#hoja-planchas[open]")
    ed = lambda i: f"#planchas .perfil-ed >> nth={i}"
    control(pg.locator("#planchas .perfil-ed").count() == 11 and pg.locator("#planchas .pe-cuerpo:visible").count() == 0, "planchas: 11 tarjetas cerradas")
    pg.click("#plancha-nueva")
    control(pg.evaluate("document.activeElement.dataset.c") == "material", "planchas: la nueva abre con el cursor en material")
    pg.fill(ed(11) + " >> [data-c=material]", "Melamina blanca")
    pg.fill(ed(11) + " >> [data-c=ancho]", "1830")
    pg.fill(ed(11) + " >> [data-c=espesor]", "18")
    pg.wait_for_timeout(300)
    control(pg.inner_text(ed(11) + " >> .pe-tit") == "Melamina blanca 2440×1830×18 mm", "planchas: nombre automático")
    pg.fill(ed(11) + " >> [data-c=material]", "Melamina")
    pg.fill(ed(11) + " >> [data-c=ancho]", "1220")
    pg.wait_for_timeout(300)
    control("Repetida" in pg.inner_text(ed(11) + " >> .pe-res"), "planchas: repetida")
    pg.fill(ed(11) + " >> [data-c=material]", "Melamina blanca")
    pg.click(ed(11) + " >> [data-acc=borrar]")
    control(pg.is_visible(".pe-confirma") and pg.locator("#planchas .perfil-ed").count() == 12, "planchas: borrar pide confirmación")
    pg.click(".pe-confirma [data-acc=si]")
    control(pg.locator("#planchas .perfil-ed").count() == 11, "planchas: borrar")
    pg.click("#plancha-nueva")
    pg.click("#hoja-planchas button[value=listo]")
    pg.wait_for_timeout(300)
    control(pg.locator("#g-plancha option").count() == 12, "planchas: la nueva vacía se descarta")
    control(pg.is_disabled("#g-precio"), "planchas DEMO: precio bloqueado")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")


def portones_demo(pg, base, cap):
    pg.evaluate("localStorage.removeItem('optimax-portones')")
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    pg.click("a.mod[href='#portones']")
    pg.wait_for_selector("#p-lista li")
    control(pg.locator("#p-lista li").count() == 4, "portones: la reja de muestra con 4 marcas (marco ×2, travesaño, barrote)")
    control(pg.inner_text("#p-resumen .dato-v >> nth=0") == "23", "portones: 23 piezas")
    control(pg.locator("#p-dibujo polygon").count() >= 20, "portones: elevación dibujada")
    control(pg.locator(".p-tarjeta[data-clave=tipo] .tag").count() == 3, "portones DEMO: los 3 portones con PRO")
    if cap:
        pg.screenshot(path=f"{cap}/c_portones.png", full_page=True)
    # tocar un renglón marca la pieza en el dibujo
    pg.click("#p-lista li[data-m=D]")
    control(pg.locator("#p-lista li.sel").count() == 1 and pg.locator("#p-dibujo g[data-m]").count() == 1,
            "portones: tocar un renglón resalta esa marca")
    pg.click("#p-dibujo polygon[data-m=A] >> nth=0", force=True)
    control(pg.get_attribute("#p-lista li.sel", "data-m") == "A", "portones: tocar el dibujo marca el renglón")
    # portón en la DEMO → hoja de compra
    pg.click(".p-tarjeta[data-v=batiente_2]")
    pg.wait_for_selector("#hoja-pro[open]")
    control("portones" in pg.inner_text("#pro-motivo"), "portones DEMO: portón → hoja de compra")
    pg.keyboard.press("Escape")
    # tope de la DEMO
    pg.fill("#p-ancho", "2000")
    pg.wait_for_timeout(500)
    control(pg.is_visible("#p-demo") and "1.500" in pg.inner_text("#p-demo"), "portones DEMO: más de 1500 avisa")
    pg.locator("#p-ancho").blur()
    pg.wait_for_timeout(100)
    control(pg.input_value("#p-ancho") == "1500", "portones DEMO: el ancho vuelve al tope")
    # reja de ventana: hueco + sobresale / holgura (25-nov, Max)
    control(pg.inner_text("label[for=p-ancho]") == "Ancho del hueco" and pg.is_visible(".campo[data-k=sob_lat]") and
            pg.is_visible(".campo[data-k=holg_hueco]") and "adentro del hueco" in pg.inner_text("#p-reja-medida"),
            "reja: medidas del hueco, sobresale y holgura")
    pg.fill("#p-sob_lat", "100")
    pg.wait_for_timeout(500)
    pg.locator("#p-sob_lat").blur()
    pg.wait_for_timeout(100)
    control(pg.input_value("#p-sob_lat") == "0" and pg.is_visible("#p-demo"), "reja DEMO: con el hueco al tope no puede sobresalir")
    pg.fill("#p-ancho", "1200")
    pg.locator("#p-ancho").blur()
    pg.fill("#p-alto", "900")
    pg.locator("#p-alto").blur()
    pg.fill("#p-sob_lat", "100")
    pg.fill("#p-sob_abj", "50")
    pg.locator("#p-sob_abj").blur()
    pg.wait_for_timeout(600)
    control("1.400 × 950" in pg.inner_text("#p-reja-medida") and "sobrepuesta" in pg.inner_text("#p-reja-medida") and
            pg.is_hidden(".campo[data-k=holg_hueco]"), f"reja: sobrepuesta 1400 × 950, sin holgura ({pg.inner_text('#p-reja-medida')} · "
            f"{pg.input_value('#p-ancho')} {pg.input_value('#p-alto')} {pg.input_value('#p-sob_lat')} {pg.input_value('#p-sob_abj')})")
    control("1.400" in pg.inner_text("#p-lista"), "reja: la lista de corte sale de la reja (1400)")
    for k in ("sob_lat", "sob_abj"):
        pg.fill(f"#p-{k}", "0")
        pg.locator(f"#p-{k}").blur()
    pg.fill("#p-alto", "1000")
    pg.locator("#p-alto").blur()
    pg.fill("#p-ancho", "1500")
    pg.locator("#p-ancho").blur()
    pg.wait_for_timeout(500)
    control(pg.is_visible(".campo[data-k=holg_hueco]"), "reja: en 0 vuelve la holgura")
    # relleno chapa: sin luz, con espesor
    pg.click(".p-tarjeta[data-v=chapa]")
    pg.wait_for_timeout(500)
    control(pg.is_hidden(".campo[data-k=luz_max]") and pg.is_visible(".campo[data-k=esp_chapa]"), "portones: chapa ciega cambia los campos")
    control("chapa" in pg.inner_text("#p-datos"), "portones: peso de la chapa")
    pg.click(".p-tarjeta[data-v=rombos]")
    pg.wait_for_timeout(500)
    control(pg.is_visible(".campo[data-k=angulo]") and "trapecio" in pg.inner_text("#p-lista") or "paralelos" in pg.inner_text("#p-lista") or "punta" in pg.inner_text("#p-lista"),
            "portones: rombos con piezas en ángulo")
    # cotas y pantalla completa
    pg.check("#p-cotas")
    pg.wait_for_timeout(200)
    control(pg.locator("#p-dibujo .p-cota").count() > 3, "portones: cotas")
    pg.click("#p-ampliar")
    pg.wait_for_selector(".p-completa")
    pg.click(".p-completa [data-z='1']")
    control(pg.locator(".p-completa svg").count() == 1, "portones: pantalla completa")
    pg.click(".p-c-cerrar")
    control(pg.locator(".p-completa").count() == 0, "portones: cerrar la pantalla completa")
    ver_3d(pg, "portones DEMO", cap, "c_portones_3d", "Pared")
    # pasantes: travesaño adelante / atrás (ejemplo de Max: marco ángulo 40×40×3, travesaños y barrotes 20×20)
    pg.click(".p-tarjeta[data-v=verticales]")
    pg.select_option("#p-perfil_marco", "Ángulo 40×40×3")
    pg.select_option("#p-perfil_trav", "Tubo cuadrado 20×20×1,5")
    pg.select_option("#p-perfil_relleno", "Tubo cuadrado 20×20×1,5")
    control(pg.is_hidden(".campo[data-k=trav_lado]"), "pasantes: «Travesaños adelante / atrás» oculto a tope")
    pg.check("input[name=p-armado][value=pasantes]")
    pg.wait_for_timeout(600)
    control(pg.is_visible(".campo[data-k=trav_lado]") and pg.is_checked("input[name=p-trav_lado][value=adelante]"), "pasantes: travesaño adelante por defecto")
    def planos3d():
        pg.click("#p-3d")
        pg.wait_for_selector(".p-3d[data-planos]", timeout=15000)
        pl = json.loads(pg.get_attribute(".p-3d", "data-planos"))
        av = pg.is_visible(".p-3d-aviso")
        cu, pz = int(pg.get_attribute(".p-3d", "data-cuerpos")), int(pg.get_attribute(".p-3d", "data-piezas"))
        return pl, av, cu, pz
    pl, av, cu, pz = planos3d()
    if cap:
        pg.wait_for_timeout(500)
        pg.screenshot(path=f"{cap}/c_pasantes_adelante_3d.png")
        pg.mouse.move(100, 500)
        pg.mouse.down()
        pg.mouse.move(330, 470, steps=12)                   # gira para verlo desde atrás (ala del ángulo)
        pg.mouse.up()
        pg.wait_for_timeout(800)
        pg.screenshot(path=f"{cap}/c_pasantes_atras_vista_3d.png")
    pg.click(".p-3d .p-c-cerrar")
    cerca = lambda a, b: abs(a - b) < 0.01
    # marco de ángulo: el relleno va detrás de la cara (20 − 3 = 17); 20 + 20 no entra en los 37 mm de adentro → aviso
    control(cerca(pl["MARCO"][1], 20) and cerca(pl["TRAVESANO"][1], 17) and cerca(pl["TRAVESANO"][0], -3)
            and cerca(pl["BARRA"][1], -3) and cerca(pl["BARRA"][0], -23) and av, f"3D pasantes con ángulo: travesaño detrás de la cara, barrotes detrás ({pl})")
    control(cu == pz + 4, f"3D: el marco de ángulo con su ala ({cu} cuerpos, {pz} piezas)")
    pg.check("input[name=p-trav_lado][value=atras]")
    pg.wait_for_timeout(400)
    pl, av, cu, pz = planos3d()
    if cap:
        pg.wait_for_timeout(500)
        pg.screenshot(path=f"{cap}/c_pasantes_atras_3d.png")
    pg.click(".p-3d .p-c-cerrar")
    control(cerca(pl["BARRA"][1], 17) and cerca(pl["TRAVESANO"][1], -3) and cerca(pl["TRAVESANO"][0], -23),
            "3D pasantes con ángulo: barrotes adelante, travesaño detrás")
    pg.select_option("#p-perfil_marco", "Tubo cuadrado 40×40×2")
    pg.check("input[name=p-trav_lado][value=adelante]")
    pg.wait_for_timeout(600)
    pl, av, cu, pz = planos3d()
    pg.click(".p-3d .p-c-cerrar")
    control(cerca(pl["TRAVESANO"][1], 20) and cerca(pl["BARRA"][1], 0) and cerca(pl["BARRA"][0], -20) and not av and cu == pz,
            "3D pasantes con tubo de 40: al ras del frente, entran justo")
    pg.select_option("#p-perfil_marco", "Tubo cuadrado 30×30×1,5")
    pg.wait_for_timeout(600)
    pl, av, cu, pz = planos3d()
    control(av and "sobresalen" in pg.inner_text(".p-3d-aviso"), "3D pasantes: avisa si no entran en el marco")
    pg.click(".p-3d .p-c-cerrar")
    pg.check("input[name=p-armado][value=a_tope]")
    pg.select_option("#p-perfil_marco", "Tubo cuadrado 40×40×2")
    # chapa ciega: travesaños atrás (una chapa) o a tope (paños)
    pg.click(".p-tarjeta[data-v=chapa]")
    pg.wait_for_timeout(600)
    control(pg.is_visible(".campo[data-k=chapa_trav]") and pg.is_checked("input[name=p-chapa_trav][value=atras]")
            and pg.is_hidden(".campo[data-k=cruce]"), "chapa: «Travesaños: atrás de la chapa / a tope», atrás por defecto")
    control("Chapas a cortar: 1 de" in pg.inner_text("#p-datos"), f"chapa atrás: una chapa ({pg.inner_text('#p-datos')[:200]})")
    pl, av, cu, pz = planos3d()
    pg.click(".p-3d .p-c-cerrar")
    control(cerca(pl["CHAPA"][1], 20) and cerca(pl["TRAVESANO"][1], 18.5) and not av, f"3D chapa atrás: la chapa adelante y el travesaño detrás ({pl})")
    pg.check("input[name=p-chapa_trav][value=a_tope]")
    pg.wait_for_timeout(600)
    control("Chapas a cortar: 2 de" in pg.inner_text("#p-datos"), "chapa a tope: dos paños")
    pl, av, cu, pz = planos3d()
    pg.click(".p-3d .p-c-cerrar")
    control(cerca(pl["CHAPA"][1], 20) and cerca(pl["TRAVESANO"][1], 20), f"3D chapa a tope: paños y travesaño en el mismo plano ({pl})")
    # cuadrícula: cruzadas (por defecto) o en el mismo plano
    pg.click(".p-tarjeta[data-v=cuadricula]")
    pg.wait_for_timeout(600)
    control(pg.is_visible(".campo[data-k=cruce]") and pg.is_checked("input[name=p-cruce][value=cruzadas]") and pg.is_hidden(".campo[data-k=chapa_trav]"),
            "cuadrícula: «Cruce: cruzadas / mismo plano», cruzadas por defecto")
    n_cr = pg.locator("#p-lista li").count()
    pl, av, cu, pz = planos3d()
    if cap:
        pg.wait_for_timeout(400)
        pg.screenshot(path=f"{cap}/c_cuadricula_3d.png")
    pg.click(".p-3d .p-c-cerrar")
    control(pl["BARRA"][0] < -1, f"3D cuadrícula cruzada: una familia detrás de la otra ({pl})")
    pg.check("input[name=p-cruce][value=plano]")
    pg.wait_for_timeout(800)
    control(pg.locator("#p-lista li").count() > n_cr and "tramos" in pg.inner_text("#p-lista"), "cuadrícula en el mismo plano: horizontales en tramos")
    pl, av, cu, pz = planos3d()
    pg.click(".p-3d .p-c-cerrar")
    control(pl["BARRA"][0] > -0.01, f"3D cuadrícula en el mismo plano: una sola capa ({pl})")
    pg.check("input[name=p-cruce][value=cruzadas]")
    # vuelve como estaba (lo que sigue usa el marco 40×40×2)
    pg.select_option("#p-perfil_trav", "")
    pg.click(".p-tarjeta[data-v=rombos]")
    pg.wait_for_timeout(600)
    # botón «Frente» y listas por tipo (25-nov, Max)
    grupos = pg.eval_on_selector_all("#p-perfil_marco optgroup", "gs => gs.map((g) => g.label)")
    control(grupos[:3] == ["Tubo cuadrado", "Tubo rectangular", "Tubo redondo"], f"perfiles: listas agrupadas por tipo ({grupos})")
    control(pg.is_hidden(".p-frente[data-f=frente_marco]"), "frente: oculto con el marco cuadrado")
    pg.select_option("#p-perfil_marco", "Tubo rectangular 60×40×2")
    pg.wait_for_timeout(800)
    caja = ".p-frente[data-f=frente_marco]"
    control(pg.is_visible(caja) and pg.locator(caja + " span:not(.p-frente-rot)").all_inner_texts() == ["60", "40"]
            and pg.is_checked("input[name=p-frente_marco][value=a]"), "frente: marco rectangular → «Frente: 60 | 40», 60 por defecto")
    control("de frente" not in pg.inner_text("#p-lista"), "frente: sin girar, la lista como siempre")
    pg.check("input[name=p-frente_marco][value=b]")
    pg.wait_for_timeout(900)
    if cap:
        pg.locator(".campo[data-k=perfil_marco]").screenshot(path=f"{cap}/frente_boton.png")
        pg.locator("#p-lista").screenshot(path=f"{cap}/frente_lista.png")
    control("60×40×2 · 40 de frente" in pg.inner_text("#p-lista"), "frente: la lista dice «40 de frente»")
    control(pg.evaluate("JSON.parse(localStorage['optimax-portones']).item.frente_marco") == "b", "frente: se guarda en el trabajo")
    pl, av, cu, pz = planos3d()
    if cap:
        pg.wait_for_timeout(400)
        pg.screenshot(path=f"{cap}/frente_3d.png")
    pg.click(".p-3d .p-c-cerrar")
    control(abs((pl["MARCO"][1] - pl["MARCO"][0]) - 60) < 0.01, f"frente 3D: marco 60×40 con 40 de frente → 60 de profundidad ({pl['MARCO']})")
    pg.check("input[name=p-frente_marco][value=a]")
    pg.select_option("#p-perfil_marco", "Tubo cuadrado 40×40×2")
    pg.wait_for_timeout(800)
    control(pg.is_hidden(caja) and "de frente" not in pg.inner_text("#p-lista"), "frente: vuelve al marco cuadrado")
    # perfiles: tarjetas plegables, nombre automático, medidas que no se entienden → el marco queda sin perfil válido
    pg.click("#p-admin")
    pg.wait_for_selector("#hoja-perfiles[open]")
    ed = lambda i: f".perfil-ed >> nth={i}"
    control(pg.locator(".perfil-ed").count() == 9, "portones: 9 perfiles de ejemplo")
    control(pg.locator(".pe-cuerpo:visible").count() == 0, "perfiles: arrancan cerrados")
    # ordenados por tipo al abrir (25-nov, Max): cuadrados juntos, rectangulares juntos, de menor a mayor
    tits = pg.locator(".perfil-ed .pe-tit").all_inner_texts()
    control(tits[:4] == ["Tubo cuadrado 20×20×1,5", "Tubo cuadrado 30×30×1,5", "Tubo cuadrado 40×40×2", "Tubo rectangular 60×40×2"]
            and tits[4].startswith("Tubo redondo"), f"perfiles: ordenados por tipo al abrir ({tits})")
    im = tits.index("Tubo cuadrado 40×40×2")             # el del marco
    control(pg.inner_text(ed(3) + " >> .pe-tit") == "Tubo rectangular 60×40×2", "perfiles: nombre automático")
    pg.click(ed(im) + " >> .pe-cab")
    control(pg.locator(".pe-cuerpo:visible").count() == 1, "perfiles: tocar abre uno solo")
    pg.fill(ed(im) + " >> [data-c=medidas]", "abc")
    pg.wait_for_timeout(500)
    control("mal cargadas" in pg.inner_text(ed(im) + " >> .pe-res"), "perfiles: medidas inválidas avisan en la cabecera")
    control(pg.locator(ed(im) + " >> .pe-estado.perfil-mal").count() == 0, "perfiles: sin aviso rojo mientras se escribe")
    pg.locator(ed(im) + " >> [data-c=medidas]").blur()
    control(pg.locator(ed(im) + " >> .pe-estado.perfil-mal").count() == 1, "perfiles: aviso rojo al salir del campo")
    control(pg.is_visible("#p-error") and "medidas" in pg.inner_text("#p-error"), "portones: marco sin medidas → error")
    pg.fill(ed(im) + " >> [data-c=medidas]", "50x50x2")
    pg.wait_for_timeout(300)
    control(pg.inner_text(ed(im) + " >> .pe-tit") == "Tubo cuadrado 50×50×2", "perfiles: el nombre sigue a las medidas")
    # repetido: mismo perfil con otra barra → los dos llevan el largo; con la misma barra → «Ya tenés ese perfil»
    pg.click("#perfil-nuevo")
    control(pg.locator(".perfil-ed").count() == 10, "perfiles: agregar")
    control(pg.evaluate("document.activeElement.dataset.c") == "medidas", "perfiles: el nuevo abre con el cursor en medidas")
    control(pg.locator(ed(9) + " >> .pe-estado.perfil-mal").count() == 0, "perfiles: el nuevo vacío no avisa en rojo")
    pg.fill(ed(9) + " >> [data-c=medidas]", "50 x 50 x 2")
    pg.wait_for_timeout(300)
    control("Repetido" in pg.inner_text(ed(9) + " >> .pe-res"), "perfiles: repetido")
    pg.fill(ed(9) + " >> [data-c=largo]", "12000")
    pg.wait_for_timeout(300)
    control(pg.inner_text(ed(9) + " >> .pe-tit") == "Tubo cuadrado 50×50×2 · 12 m"
            and pg.inner_text(ed(im) + " >> .pe-tit") == "Tubo cuadrado 50×50×2 · 6 m", "perfiles: mismo perfil, otra barra → con el largo")
    # borrar pide confirmación
    pg.click(ed(9) + " >> [data-acc=borrar]")
    control(pg.locator(".perfil-ed").count() == 10 and pg.is_visible(".pe-confirma"), "perfiles: borrar pide confirmación")
    pg.click(".pe-confirma [data-acc=no]")
    control(pg.locator(".perfil-ed").count() == 10 and pg.locator(".pe-confirma").count() == 0, "perfiles: cancelar no borra")
    pg.click(ed(9) + " >> [data-acc=borrar]")
    pg.click(".pe-confirma [data-acc=si]")
    control(pg.locator(".perfil-ed").count() == 9, "perfiles: borrar")
    control(pg.inner_text(ed(im) + " >> .pe-tit") == "Tubo cuadrado 50×50×2", "perfiles: sin el repetido vuelve el nombre corto")
    pg.click(ed(im) + " >> .pe-cab")
    pg.click(ed(im) + " >> [data-acc=borrar]")
    control("marco" in pg.inner_text(".pe-confirma"), "perfiles: avisa que lo usa el marco")
    pg.click(".pe-confirma [data-acc=no]")
    # el nuevo sin medidas se descarta al tocar «Listo»
    pg.click("#perfil-nuevo")
    pg.click("#hoja-perfiles button[value=listo]")
    pg.wait_for_timeout(500)
    control(pg.is_hidden("#p-error") and pg.locator("#p-lista li").count() >= 3, "perfiles: corregir las medidas recalcula")
    control(pg.evaluate("JSON.parse(localStorage['optimax-portones']).perfiles.length") == 9, "perfiles: el nuevo vacío se descarta")
    control(pg.input_value("#p-perfil_marco") == "Tubo cuadrado 50×50×2", "perfiles: el marco sigue al nombre nuevo")
    pg.click("#p-pdf")
    pg.wait_for_selector("#hoja-pro[open]")
    control("PDF" in pg.inner_text("#pro-motivo"), "portones DEMO: PDF → hoja de compra")
    pg.keyboard.press("Escape")
    control(pg.locator("#p-perfil_marco option").count() == 9, "perfiles: los 9 se ofrecen")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")


ANDROID_FB = ("Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 "
              "Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.0;]")
IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 "
          "Mobile/15E148 Safari/604.1")
IPHONE_IG = IPHONE.replace("Safari/604.1", "Instagram 320.0.0.0 (iPhone14,5; iOS 17_4)")
AVISO_CHROME = """() => { const e = new Event("beforeinstallprompt", { cancelable: true }); window._prompts = 0;
  e.prompt = () => { window._prompts++; }; e.userChoice = Promise.resolve({ outcome: "dismissed" }); dispatchEvent(e); }"""


def instalar(b, base, cap):
    """Instalar (instalar.js): Chrome con beforeinstallprompt, iPhone, Facebook / Instagram, ya instalada."""
    def abrir(**kw):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, **kw)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        return ctx, pg, errs

    # Chrome (Android): sin aviso del navegador no se ve nada; con el aviso, tarjeta en el inicio y no en la cabecera
    ctx, pg, errs = abrir()
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    control(pg.is_hidden("#instalar") and pg.is_hidden("#btn-instalar"), "instalar: sin aviso de Chrome, no se ofrece")
    pg.evaluate(AVISO_CHROME)
    control(pg.is_visible("#instalar") and pg.is_hidden("#btn-instalar"), "instalar: aviso de Chrome → tarjeta en el inicio")
    caja_t, caja_m = pg.locator("#instalar").bounding_box(), pg.locator(".mod").first.bounding_box()
    control(caja_t["y"] < caja_m["y"], "instalar: la tarjeta va arriba de los módulos")
    if cap:
        pg.screenshot(path=f"{cap}/i_tarjeta.png")
    pg.click("#instalar-ok")
    control(pg.evaluate("window._prompts") == 1, "instalar: «Instalar» abre el de Chrome")
    pg.evaluate(AVISO_CHROME)
    pg.click("a.mod[href='#barras']")
    pg.wait_for_selector("#piezas")
    control(pg.is_hidden("#instalar") and pg.is_visible("#btn-instalar"), "instalar: en un módulo, el botón de la cabecera")
    pg.click("#migas .volver")
    pg.wait_for_selector(".inicio")
    pg.click("#instalar-cerrar")
    control(pg.is_hidden("#instalar") and pg.is_visible("#btn-instalar"), "instalar: × → queda el botón al lado de Comprar PRO")
    cab = pg.locator(".cabecera").bounding_box()
    bi, bp = pg.locator("#btn-instalar").bounding_box(), pg.locator(".btn-pro").bounding_box()
    control(bi["x"] + bi["width"] <= bp["x"] and abs(bi["y"] - bp["y"]) < 4 and bp["x"] + bp["width"] <= cab["width"],
            "instalar: botón al lado de Comprar PRO, sin desbordar")
    if cap:
        pg.screenshot(path=f"{cap}/i_cabecera.png")
    pg.click("#btn-instalar")
    control(pg.evaluate("window._prompts") == 1, "instalar: el de la cabecera también instala")
    pg.reload()
    pg.wait_for_selector(".inicio")
    pg.evaluate(AVISO_CHROME)
    control(pg.is_hidden("#instalar") and pg.is_visible("#btn-instalar"), "instalar: cerrada, no vuelve al recargar")
    pg.evaluate("dispatchEvent(new Event('appinstalled'))")
    control(pg.is_hidden("#instalar") and pg.is_hidden("#btn-instalar"), "instalar: instalada → se va")
    control(not errs, f"instalar Chrome: errores de JS {errs}")
    ctx.close()

    # celular angosto (360): la cabecera con los dos botones entra
    ctx = b.new_context(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.goto(base + "#barras")
    pg.wait_for_selector("#piezas")
    pg.evaluate(AVISO_CHROME)
    bp = pg.locator(".btn-pro").bounding_box()
    control(pg.is_visible("#btn-instalar") and bp["x"] + bp["width"] <= 360 and
            pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), "instalar: en 360 px la cabecera entra")
    ctx.close()

    # iPhone (Safari): tarjeta de entrada; los pasos de Compartir
    ctx, pg, errs = abrir(user_agent=IPHONE)
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    control(pg.is_visible("#instalar"), "instalar iPhone: tarjeta sin aviso del navegador")
    pg.click("#instalar-ok")
    pg.wait_for_selector("#hoja-instalar[open]")
    control(pg.is_visible("#inst-ios") and pg.is_hidden("#inst-app") and "Agregar a inicio" in pg.inner_text("#inst-ios"),
            "instalar iPhone: pasos de Compartir → Agregar a inicio")
    if cap:
        pg.screenshot(path=f"{cap}/i_iphone.png")
    pg.keyboard.press("Escape")
    control(not errs, f"instalar iPhone: errores de JS {errs}")
    ctx.close()

    # Facebook en Android: abrir en Chrome (intent) + pasos + copiar
    ctx, pg, errs = abrir(user_agent=ANDROID_FB, permissions=["clipboard-read", "clipboard-write"])
    pg.goto(base + "#portones")
    pg.wait_for_selector("#p-lista li")
    control(pg.is_visible("#btn-instalar") and pg.is_hidden("#instalar"), "instalar Facebook: en un módulo, botón de la cabecera")
    pg.click("#btn-instalar")
    pg.wait_for_selector("#hoja-instalar[open]")
    href = pg.get_attribute("#inst-chrome", "href") or ""
    control(pg.is_visible("#inst-app") and pg.is_visible("#inst-chrome") and
            href.startswith("intent://localhost:") and "package=com.android.chrome" in href and "#portones" in href,
            f"instalar Facebook: «Abrir en Chrome» ({href[:60]}…)")
    control("Chrome" in pg.inner_text("#inst-nav"), "instalar Facebook: pasos con «Abrir en el navegador (Chrome)»")
    pg.click("#inst-copiar")
    pg.wait_for_selector("#inst-copiado", state="visible")
    control(pg.evaluate("navigator.clipboard.readText()") == base, "instalar Facebook: copia el enlace de la app")
    if cap:
        pg.screenshot(path=f"{cap}/i_facebook.png")
    control(not errs, f"instalar Facebook: errores de JS {errs}")
    ctx.close()

    # Instagram en iPhone: sin «Abrir en Chrome», pasos a Safari
    ctx, pg, errs = abrir(user_agent=IPHONE_IG)
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    pg.click("#instalar-ok")
    pg.wait_for_selector("#hoja-instalar[open]")
    control(pg.is_visible("#inst-app") and pg.is_hidden("#inst-chrome") and "Safari" in pg.inner_text("#inst-nav"),
            "instalar Instagram (iPhone): pasos para abrir en Safari, sin el botón de Chrome")
    ctx.close()

    # ya instalada (pantalla completa): nada, aunque sea iPhone
    ctx, pg, errs = abrir(user_agent=IPHONE)
    pg.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true })")
    pg.goto(base)
    pg.wait_for_selector(".inicio")
    control(pg.is_hidden("#instalar") and pg.is_hidden("#btn-instalar"), "instalar: ya instalada, no se ofrece")
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
    ys = {round(pg.locator(".mod").nth(k).bounding_box()["y"]) for k in range(4)}
    control(len(ys) == 1, "PC: inicio con las 4 tarjetas en una fila")
    control(not errs, f"PC: errores de JS {errs}")
    ctx.close()
    # precio de la PRO (25-nov): 250 Bs en Bolivia, 20 USDT afuera; nombre «optiMAX Taller»
    for zona, precio in (("America/La_Paz", "250 Bs"), ("America/Sao_Paulo", "20 USDT")):
        ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id=zona)
        pg = ctx.new_page()
        pg.goto(base + "#portones")
        pg.wait_for_selector("#p-lista li")
        pg.click(".p-tarjeta[data-v=batiente_2]")
        pg.wait_for_selector("#hoja-pro[open]")
        href = pg.get_attribute("#btn-whatsapp", "href") or ""
        from urllib.parse import unquote
        texto = unquote(href)
        control("optiMAX Taller" in texto and f"({precio})" in texto and pg.inner_text("#pro-titulo") == "optiMAX Taller PRO",
                f"PRO en {zona}: {precio} ({texto[-70:]})")
        ctx.close()


def pro(b, base, cap):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        accept_downloads=True)
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
        # 3D (Tarea B, 25-nov): una pieza 3D por chapa a cortar
        chapas = sum(int(t.strip("×")) for t in pg.locator("#chapas li .ch-cant").all_inner_texts())
        control(pg.is_visible("#z-3d"), f"PRO: {fid} con botón 3D")
        pg.click("#z-3d")
        pg.wait_for_selector(".p-3d[data-triangulos]", timeout=15000)
        pg.wait_for_timeout(600)
        n3 = int(pg.get_attribute(".p-3d", "data-piezas"))
        control(n3 == chapas and pg.locator(".p-3d .error-txt").count() == 0, f"PRO 3D {fid}: {n3} piezas de {chapas} chapas")
        if cap:
            pg.screenshot(path=f"{cap}/pro_3d_{fid}.png")
        pg.click(".p-3d .p-c-cerrar")
        if cap:
            pg.locator(".plancha").screenshot(path=f"{cap}/pro_{fid}.png")
    # imprimir a escala (la última figura: helicoide): hojas A4 y una sola hoja
    control(pg.is_hidden("#btn-imprimir .candado"), "PRO: imprimir a escala sin candado")
    pg.click("#btn-imprimir")
    pg.wait_for_selector("#hoja-salida[open]")
    control("página" in pg.inner_text("#s-desc"), "PRO: el PDF dice cuántas páginas salen")
    pg.keyboard.press("Escape")
    n1 = bajar_pdf(pg, "#btn-imprimir", "PRO chapa: plantilla en hojas A4", "hojas", cap)
    n2 = bajar_pdf(pg, "#btn-imprimir", "PRO chapa: plantilla en una hoja", "una", cap)
    control(n1 > n2 >= 2, f"PRO chapa: en hojas A4 salen más páginas que en una sola hoja ({n1} / {n2})")
    n3 = bajar_pdf(pg, "#btn-imprimir", "PRO chapa: plano en A4", "plano", cap)
    control(n3 == pg.locator("#chapas li").count(), f"PRO chapa: plano = una página por chapa ({n3})")
    pg.click("#btn-imprimir")
    pg.wait_for_selector("#hoja-salida[open]")
    control(pg.is_checked("#hoja-salida input[value=plano]"), "PRO chapa: el PDF abre en «Plano en A4»")
    pg.keyboard.press("Escape")
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
    bajar_pdf(pg, "#b-pdf", "PRO barras: lista de corte", None, cap)
    # guillotina con PRO: búsqueda completa sin trabar, precio por pieza
    pg.evaluate("localStorage.setItem('optimax-guillotina', JSON.stringify({largo:'2440',ancho:'1220',corte:'3',refilado:'5',max:'0',rotar:true,filas:[['720','560',6],['350','560',8],['720','300',4],['400','400',5]],precio:'',reparto:false}))")
    pg.goto(base + "#guillotina")
    pg.wait_for_selector("#g-resumen .dato", timeout=10000)
    pg.wait_for_selector("#g-calc", state="hidden", timeout=10000)
    control(pg.is_hidden("#g-demo"), "guillotina PRO: 23 piezas sin aviso")
    control(any(u.endswith("/pro/guillotina/optimizar.js") for u in pedidos), "guillotina PRO: carga la búsqueda completa")
    control(pg.input_value("#g-plancha") == "" and pg.is_visible("#g-largo"), "guillotina PRO: lo guardado de antes sigue con su medida a mano")
    pg.fill("#g-precio", "450")
    pg.wait_for_timeout(2500)
    pg.wait_for_selector("#g-calc", state="hidden", timeout=10000)
    control(pg.locator("#g-costo tbody tr").count() == 4, "guillotina PRO: precio de cada pieza")
    # precio desde la plancha elegida (editor)
    pg.select_option("#g-plancha", "Melamina 2440×1220×18 mm")
    pg.wait_for_timeout(300)
    control(pg.is_visible("#g-sin-precio"), "guillotina PRO: plancha sin precio avisa")
    pg.click("#g-admin")
    pg.wait_for_selector("#hoja-planchas[open]")
    pg.click("#planchas .perfil-ed >> nth=8 >> .pe-cab")
    pg.fill("#planchas .perfil-ed >> nth=8 >> [data-c=precio]", "520")
    pg.click("#hoja-planchas button[value=listo]")
    pg.wait_for_timeout(2500)
    pg.wait_for_selector("#g-calc", state="hidden", timeout=10000)
    control(pg.locator("#g-costo tbody tr").count() == 4 and "520" in pg.inner_text("#g-pl-res"), "guillotina PRO: precio desde la plancha")
    if cap:
        pg.screenshot(path=f"{cap}/pro_guillotina.png", full_page=True)
    bajar_pdf(pg, "#g-pdf", "PRO guillotina: plan de cortes", None, cap)
    # portones con PRO: batiente de 2 hojas, barras con el optimizador completo (Worker) y costos
    pg.evaluate("localStorage.removeItem('optimax-portones')")
    pg.goto(base + "#portones")
    pg.wait_for_selector("#p-lista li")
    control(pg.locator(".p-tarjeta[data-clave=tipo] .tag").count() == 0, "portones PRO: los portones sin «PRO»")
    pg.click(".p-tarjeta[data-v=batiente_2]")
    pg.fill("#p-ancho", "4600")
    pg.fill("#p-alto", "1800")
    pg.wait_for_timeout(600)
    pg.wait_for_selector("#p-opt", state="hidden", timeout=20000)
    control(pg.is_hidden("#p-demo") and pg.is_hidden("#p-error"), "portones PRO: portón de 4600 × 1800 sin tope")
    control(any(u.endswith("/pro/portones/tipos.js") for u in pedidos), "portones PRO: carga los tipos de portón")
    control(pg.inner_text("#p-resumen .dato-v >> nth=1") == "15", "portones PRO: 15 barras con el optimizador completo (el rápido da 16)")
    control("Pasador de piso" in pg.inner_text("#p-datos"), "portones PRO: herrajes del portón")
    ver_3d(pg, "portones PRO (batiente 2 hojas)", cap, "pro_portones_3d", "Columnas")
    pg.click("summary:has-text('Corte y costos')")
    pg.fill("#p-sold", "15")
    pg.fill("#p-pint", "40")
    pg.fill("#p-margen", "1,3")
    pg.wait_for_timeout(600)
    control(pg.locator("#p-costo tbody tr").count() == 3, "portones PRO: costo y precio")
    pg.click("#p-admin")
    control(pg.is_enabled(".perfil-ed >> nth=0 >> [data-c=precio]"), "portones PRO: precio de los perfiles")
    pg.keyboard.press("Escape")
    if cap:
        pg.screenshot(path=f"{cap}/pro_portones.png", full_page=True)
    bajar_pdf(pg, "#p-pdf", "PRO portones: lista de corte", None, cap)
    # 3D: corredizo con barrotes de macizo redondo (cilindros) y batiente con chapa ciega
    pg.click(".p-tarjeta[data-v=corredizo]")
    pg.select_option("#p-perfil_relleno", "Macizo redondo Ø12")
    pg.wait_for_timeout(1500)
    ver_3d(pg, "portones PRO (corredizo, macizo redondo)", cap, "pro_corredizo_3d", "Paredes")
    pg.click(".p-tarjeta[data-v=chapa]")
    pg.wait_for_timeout(1500)
    ver_3d(pg, "portones PRO (chapa ciega)", cap, "pro_chapa_3d", "Nada")
    # travesaño doble y paños a lo ancho (solo PWA, 26-nov)
    pg.click(".p-tarjeta[data-v=batiente_2]")
    pg.click(".p-tarjeta[data-v=verticales]")
    pg.wait_for_timeout(800)
    control(pg.is_visible(".campo[data-k=trav_modo]") and pg.is_checked("input[name=p-trav_modo][value=repartidos]")
            and pg.is_hidden(".campo[data-k=franja]") and pg.is_hidden(".campo[data-k=n_panos]"),
            "doble: «Repartidos / Doble al centro», repartidos por defecto")
    pg.check("input[name=p-trav_modo][value=doble]")
    pg.wait_for_timeout(800)
    control(pg.is_hidden(".campo[data-k=n_trav]") and pg.is_visible(".campo[data-k=franja]") and
            pg.is_visible(".campo[data-k=n_franja]") and pg.is_hidden(".campo[data-k=armado]") and
            pg.is_hidden(".campo[data-k=trav_lado]"), "doble: franja y barrotes; sin cantidad ni armado")
    pg.fill("#p-franja", "250")
    for _ in range(4):
        pg.click("[data-paso=n_franja][data-d='1']")
    pg.wait_for_timeout(1500)
    pg.wait_for_selector("#p-opt", state="hidden", timeout=20000)
    control(pg.inner_text("#p-n_franja") == "4" and "barrote de la franja" in pg.inner_text("#p-lista") and
            pg.is_hidden("#p-error"), "doble: 4 barrotes en la franja en la lista")
    item = pg.evaluate("JSON.parse(localStorage['optimax-portones']).item")
    control(item["trav_modo"] == "doble" and item["franja"] == 250 and item["n_franja"] == 4 and item["n_trav"] == 2,
            "doble: se guarda (2 travesaños para la PC)")
    ver_3d(pg, "portones PRO (travesaño doble)", cap, "pro_doble_3d", "Columnas")
    pg.click(".p-tarjeta[data-v=chapa]")
    pg.wait_for_timeout(800)
    control(pg.is_visible(".campo[data-k=n_panos]") and pg.is_hidden(".campo[data-k=chapa_trav]") and
            pg.is_visible(".campo[data-k=perfil_relleno]"), "paños: «Paños a lo ancho»; relleno por los barrotes de la franja")
    for _ in range(2):
        pg.click("[data-paso=n_panos][data-d='1']")
    pg.wait_for_timeout(1500)
    pg.wait_for_selector("#p-opt", state="hidden", timeout=20000)
    control(pg.inner_text("#p-n_panos") == "3" and "parante" in pg.inner_text("#p-lista") and pg.is_hidden("#p-error")
            and pg.inner_text("label[for=p-perfil_trav]") == "Travesaños y parantes", "paños: 3 paños con parantes")
    ver_3d(pg, "portones PRO (paños de chapa)", cap, "pro_panos_3d", "Nada")
    pg.click(".p-tarjeta[data-v=horizontales]")
    pg.wait_for_timeout(500)
    control(pg.is_hidden(".campo[data-k=trav_modo]") and pg.is_visible(".campo[data-k=n_trav]") and
            pg.is_hidden(".campo[data-k=n_panos]"), "horizontales: sin doble ni paños")
    pg.goto(base + "?pro=0")
    pg.wait_for_selector(".inicio")
    control(pg.is_visible(".btn-pro"), "?pro=0: vuelve la DEMO")
    control(not errs, f"PRO: errores de JS {errs}")
    ctx.close()


# ------------------------------------------------------------------ trabajos (PRO) e ida y vuelta con la PC
def py_pc(pcdir, codigo):
    """Corre código Python con el programa de la PC (cwd = repo nesting-cnc). Devuelve la salida (o '' si falló)."""
    r = subprocess.run([sys.executable, "-c", codigo], cwd=pcdir, env={**os.environ, "OPTIMAX_IDIOMA": "es"},
                       capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-1500:])
    return r.stdout.strip()


def bajar_nesting(pg, ruta):
    pg.click("#t-btn")
    pg.wait_for_selector("#hoja-trabajos[open]")
    with pg.expect_download() as d:
        pg.click("#t-bajar")
    d.value.save_as(ruta)
    pg.keyboard.press("Escape")


def abrir_nesting(pg, ruta):
    if not pg.locator("#hoja-trabajos[open]").count():
        pg.click("#t-btn")
        pg.wait_for_selector("#hoja-trabajos[open]")
    pg.set_input_files("#t-file", ruta)
    pg.wait_for_timeout(1200)


def trabajos(b, base, pcdir, cap=None):
    import tempfile
    tmp = tempfile.mkdtemp(prefix="trabajos_")
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "?pro=1#guillotina")
    pg.wait_for_selector("#g-resumen .dato", timeout=10000)
    # guardar en el equipo, «sin guardar», nuevo con confirmación, abrir de la lista
    control(pg.locator("#t-btn .candado").count() == 0 and "Sin guardar" in pg.inner_text("#t-nom-actual"), "trabajos PRO: barra sin candado")
    pg.click("#t-btn")
    pg.wait_for_selector("#hoja-trabajos[open]")
    control(pg.input_value("#t-nombre") == "Melamina", "trabajos: nombre sugerido (material)")
    pg.fill("#t-nombre", "Cocina Pérez")
    pg.click("#t-guardar")
    control("Guardado" in pg.inner_text("#t-aviso") and pg.locator(".t-item").count() == 1, "trabajos: guardar en el equipo")
    pg.keyboard.press("Escape")
    control(pg.inner_text("#t-nom-actual") == "Cocina Pérez", "trabajos: nombre del trabajo actual")
    pg.click(".pieza >> nth=0 >> .mas")
    pg.wait_for_timeout(300)
    control("(sin guardar)" in pg.inner_text("#t-nom-actual"), "trabajos: cambio sin guardar")
    pg.click("#t-btn")
    pg.click("#t-nuevo")
    control(pg.is_visible("#t-confirma"), "trabajos: nuevo con cambios pide confirmación")
    pg.click("#t-conf-si")
    pg.wait_for_timeout(600)
    control(pg.locator(".pieza").count() == 1 and pg.inner_text("#t-nom-actual") == "Sin guardar", "trabajos: nuevo")
    pg.click("#t-btn")
    pg.click(".t-abrir >> nth=0")
    pg.wait_for_timeout(800)
    control(pg.locator(".pieza").count() == 3 and pg.inner_text("#t-nom-actual") == "Cocina Pérez", "trabajos: abrir de la lista")
    control(pg.inner_text(".pieza >> nth=0 >> .cant") == "2", "trabajos: abre lo guardado, no lo cambiado")
    if cap:
        pg.screenshot(path=f"{cap}/t_barra.png")
        pg.click("#t-btn")
        pg.wait_for_selector("#hoja-trabajos[open]")
        pg.wait_for_timeout(500)                          # termina la animación de la hoja
        pg.screenshot(path=f"{cap}/t_hoja.png")
        pg.keyboard.press("Escape")
    # precio en la plancha elegida y .nesting para la PC
    pg.click("#g-admin")
    pg.click("#planchas .perfil-ed >> nth=8 >> .pe-cab")
    pg.fill("#planchas .perfil-ed >> nth=8 >> [data-c=precio]", "520")
    pg.click("#hoja-planchas button[value=listo]")
    pg.wait_for_timeout(300)
    g_pwa = os.path.join(tmp, "g_pwa.nesting")
    bajar_nesting(pg, g_pwa)
    control(os.path.getsize(g_pwa) > 100, "trabajos: descarga el .nesting de la guillotina")
    if pcdir:
        out = py_pc(pcdir, f"""
import nesting as N, guillotina as G
_, op, _ = N.cargar_proyecto({g_pwa!r})
g = op["guillotina"]
pz, _ = G.leer_texto(g["lista"])
ok = op["tipo"] == "guillotina" and g["material"] == "Melamina 2440×1220×18 mm" and abs(float(g["precio_m2"].replace(",", ".")) * 2.44 * 1.22 - 520) < 0.05
ok = ok and sorted(pz) == sorted([(600.0, 400.0, 2), (300.0, 1200.0, 2), (450.0, 450.0, 1)]) and g["rotar"] == "1"
print("OK" if ok else ("MAL", g, pz))""")
        control(out == "OK", f"PC: lee el .nesting de guillotina de la PWA ({out[:200]})")
        g_pc = os.path.join(tmp, "Chapa de la PC.nesting")
        py_pc(pcdir, f"""
import nesting as N
N.guardar_proyecto({g_pc!r}, [], {{"tipo": "guillotina", "guillotina": {{"largo": "3000", "ancho": "1500", "corte": "3",
  "refilado": "5", "max_corte": "0", "rotar": "0", "material": "Chapa negra 1,5 mm", "precio_m2": "100", "kg_m2": "11,775",
  "reparto": "1", "lista": "500\\t250\\t4\\n300\\t300\\t2"}}}}, None)""")
        abrir_nesting(pg, g_pc)
        control(pg.input_value("#g-plancha") == "" and pg.input_value("#g-largo") == "3000" and pg.input_value("#g-precio") == "450",
                "PWA: abre el .nesting de guillotina de la PC (otra medida, precio por m² → por plancha)")
        control(pg.locator(".pieza").count() == 2 and not pg.is_checked("#g-rotar") and pg.is_checked("#g-reparto"), "PWA: piezas y opciones de la PC")
        control("no está en tu lista" in pg.inner_text("#t-aviso") and pg.inner_text("#t-nom-actual") == "Chapa de la PC",
                "PWA: avisa la plancha que no está y toma el nombre del archivo")
        b_pc = os.path.join(tmp, "barras_pc.nesting")
        py_pc(pcdir, f"""
import nesting as N
N.guardar_proyecto({b_pc!r}, [], {{"tipo": "barras", "barras": {{"largo": "6000", "corte": "3", "material": "Tubo 40x40",
  "perfil": "Tubo 40x40", "precio": "180", "kg_m": "2,4", "reparto": "0", "lista": "1200\\t5\\n850\\t3"}}}}, None)""")
        abrir_nesting(pg, b_pc)
        control("barras y tubos" in pg.inner_text("#t-aviso") and pg.locator(".pieza").count() == 2,
                "PWA: un .nesting de otro módulo avisa y no cambia nada")
        pg.keyboard.press("Escape")
        # barras
        pg.goto(base + "?pro=1#barras")
        pg.wait_for_selector("#b-resumen .dato", timeout=10000)
        abrir_nesting(pg, b_pc)
        control(pg.locator(".pieza").count() == 2 and pg.input_value("#b-precio") == "180" and pg.input_value("#b-largo") == "6000",
                "PWA: abre el .nesting de barras de la PC")
        pg.keyboard.press("Escape")
        b_pwa = os.path.join(tmp, "b_pwa.nesting")
        bajar_nesting(pg, b_pwa)
        out = py_pc(pcdir, f"""
import nesting as N, barras
_, op, _ = N.cargar_proyecto({b_pwa!r})
b = op["barras"]
pz, _ = barras.leer_texto(b["lista"])
print("OK" if op["tipo"] == "barras" and sorted(pz) == [(850.0, 3), (1200.0, 5)] and b["precio"] == "180" and b["material"] == "Barra de 6000 mm" else ("MAL", b, pz))""")
        control(out == "OK", f"PC: lee el .nesting de barras de la PWA ({out[:200]})")
        # portones: la PC calcula lo mismo que la PWA
        pg.goto(base + "?pro=1#portones")
        pg.wait_for_selector("#p-lista li", timeout=10000)
        pg.wait_for_timeout(1500)
        n_pwa = pg.locator("#p-lista li").count()
        p_pwa = os.path.join(tmp, "p_pwa.nesting")
        bajar_nesting(pg, p_pwa)
        out = py_pc(pcdir, f"""
import nesting as N, portones as P
_, op, _ = N.cargar_proyecto({p_pwa!r})
p = op["portones"]
items = [P.normalizar_item(x) for x in p["items"]]
c = P.calcular(items, P.perfiles_de(p["perfiles"]), 3.0)
print(len(c["filas"]))""")
        control(out == str(n_pwa) and n_pwa > 0, f"PC: calcula el portón de la PWA con la misma lista de corte ({out} y {n_pwa} renglones)")
        p_pc = os.path.join(tmp, "portones_pc.nesting")
        py_pc(pcdir, f"""
import nesting as N, portones as P
mats = [{{"nombre": "Tubo 50 de la PC", "forma": "tubo", "medidas": "50x50x2", "largo": 6000, "precio": 150, "kg_m": 3}},
        {{"nombre": "Mi tubo 20", "forma": "tubo", "medidas": "20x20x1,5", "largo": 6000, "precio": 40, "kg_m": 0.9}}]
it = dict(P.ITEM_DEF, tipo="reja_ventana", nombre="Reja cocina", ancho=1200, alto=1000, perfil_marco="Tubo 50 de la PC", perfil_relleno="Mi tubo 20")
it2 = dict(it, nombre="Reja baño", ancho=600)
N.guardar_proyecto({p_pc!r}, [], {{"tipo": "portones", "portones": {{"version": 1, "items": [it, it2], "corte": "4",
  "colorear": True, "cotas": True, "filtro": "Todos", "costos": {{"soldadura_m": 12, "pintura_m2": 30}}, "perfiles": mats}}}}, None)""")
        abrir_nesting(pg, p_pc)
        av = pg.inner_text("#t-aviso")
        control("2 rejas o portones" in av and "Reja cocina" in av and "1 perfil" in av, f"PWA: abre el .nesting de portones de la PC con avisos ({av[:160]})")
        control(pg.input_value("#p-perfil_marco") == "Tubo cuadrado 50×50×2" and pg.input_value("#p-perfil_relleno") == "Tubo cuadrado 20×20×1,5",
                "PWA: el portón usa los perfiles (nuevo agregado, el igual de la lista)")
        pg.keyboard.press("Escape")
    # chapa: solo en el equipo
    pg.goto(base + "?pro=1#chapa")
    pg.wait_for_selector("#chapas li")
    pg.click("#t-btn")
    control(pg.locator("#t-bajar").count() == 0, "trabajos chapa: sin .nesting")
    pg.fill("#t-nombre", "Codo prueba")
    pg.click("#t-guardar")
    pg.keyboard.press("Escape")
    inp = pg.locator("#form input >> nth=0")
    antes = inp.input_value()
    inp.fill("777")
    pg.wait_for_timeout(500)
    pg.click("#t-btn")
    pg.click(".t-abrir >> nth=0")
    control(pg.is_visible("#t-confirma"), "trabajos chapa: abrir con cambios pide confirmación")
    pg.click("#t-conf-si")
    pg.wait_for_timeout(800)
    control(pg.locator("#form input >> nth=0").input_value() == antes, "trabajos chapa: abre lo guardado")
    control(not errs, f"trabajos: errores de JS {errs}")
    ctx.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--capturas")
    ap.add_argument("--chrome", default="/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    ap.add_argument("--pc", help="repo del programa de la PC (nesting-cnc): prueba los .nesting de ida y vuelta")
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
            instalar(b, base, a.capturas)
            pc(b, base, a.capturas)
            if os.path.isdir(os.path.join(RAIZ, "pro")):
                pro(b, base, a.capturas)
                trabajos(b, base, a.pc, a.capturas)
            b.close()
    finally:
        srv.terminate()
    print(f"\n{ok} de {ok + mal} OK")
    sys.exit(1 if mal else 0)


if __name__ == "__main__":
    main()
