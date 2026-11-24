// Vista de la plancha: dibuja las piezas en SVG con sus cotas (ancho y alto de cada chapa) y deja mover y
// acercar con el dedo, la rueda o los botones.
import { arcoBulge, corto } from "./geo/base.js";

const MARGEN = 24;          // px alrededor del dibujo

const num = (v) => corto(v, 1);

const GX = 64;               // px entre piezas de una fila (cota vertical + aire)
const GY = 74;              // px entre filas (cota horizontal abajo + nombre arriba)
const NOMBRE = 26;          // px del nombre arriba de cada pieza
const COTA_DER = 40;        // px de la cota vertical de la última pieza de la fila
const BOTONES = 44;         // px de abajo que tapan los botones de zoom

/** Reparte las cajas (en orden) en 'filas' filas de ancho parecido. */
function partir(cajas, filas) {
  const total = cajas.reduce((s, b) => s + b[2] - b[0], 0);
  const out = [[]];
  let acum = 0;
  cajas.forEach((b, i) => {
    const bw = b[2] - b[0];
    if (out[out.length - 1].length && out.length < filas && acum + bw / 2 > (total * out.length) / filas) out.push([]);
    out[out.length - 1].push(i);
    acum += bw;
  });
  return out;
}

/** Ubica las piezas en filas, con lugar en píxeles para las cotas y los nombres, y elige la cantidad de filas que
 * deja el dibujo más grande. Devuelve {s (px por mm), pos: [[x, y] px de la esquina superior izquierda de cada
 * caja]}. */
function disponer(cajas, w, h) {
  let mejor = null;
  for (let filas = 1; filas <= cajas.length; filas++) {
    const fs = partir(cajas, filas);
    const sumW = fs.map((f) => f.reduce((s, i) => s + cajas[i][2] - cajas[i][0], 0));
    const altos = fs.map((f) => Math.max(...f.map((i) => cajas[i][3] - cajas[i][1])));
    const sW = Math.min(...fs.map((f, k) => (w - 2 * MARGEN - (f.length - 1) * GX - COTA_DER) / Math.max(sumW[k], 1e-9)));
    const sH = (h - 2 * MARGEN - BOTONES - fs.length * (GY + NOMBRE)) / Math.max(altos.reduce((a, b) => a + b, 0), 1e-9);
    const s = Math.min(sW, sH);
    if (!mejor || s > mejor.s * 1.001) mejor = { s, fs, sumW, altos };
  }
  const { s, fs, sumW, altos } = mejor;
  const altoTot = altos.reduce((a, b) => a + b, 0) * s + fs.length * (GY + NOMBRE);   // con la cota de abajo
  let y = (h - BOTONES - altoTot) / 2 + NOMBRE;
  const pos = [];
  fs.forEach((f, k) => {
    let x = (w - (sumW[k] * s + (f.length - 1) * GX + COTA_DER)) / 2;
    for (const i of f) {
      pos[i] = [x, y];
      x += (cajas[i][2] - cajas[i][0]) * s + GX;
    }
    y += altos[k] * s + GY + NOMBRE;
  });
  return { s, pos };
}

export class Vista {
  constructor(svg) {
    this.svg = svg;
    this.piezas = [];
    this.zoom = 1;
    this.pan = [0, 0];
    this._punteros = new Map();
    this._pendiente = false;
    this._eventos();
    new ResizeObserver(() => this.dibujar()).observe(svg);
  }

  mostrar(piezas, { ajustar = false } = {}) {
    const antes = this.piezas.length;
    this.piezas = piezas || [];
    if (ajustar || antes !== this.piezas.length) this.ajustar(false);   // otra cantidad de piezas: ver todo
    this.dibujar();
  }

  ajustar(dibujar = true) {
    this.zoom = 1;
    this.pan = [0, 0];
    if (dibujar) this.dibujar();
  }

  acercar(f, cx, cy) {
    const r = this.svg.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const z = Math.min(40, Math.max(0.3, this.zoom * f));
    const k = z / this.zoom;
    // el punto (cx, cy) queda quieto
    this.pan = [cx - (cx - this.pan[0]) * k, cy - (cy - this.pan[1]) * k];
    this.zoom = z;
    this._pedir();
  }

  _pedir() {
    if (this._pendiente) return;
    this._pendiente = true;
    requestAnimationFrame(() => { this._pendiente = false; this.dibujar(); });
  }

  dibujar() {
    const { width: w, height: h } = this.svg.getBoundingClientRect();
    if (w < 20 || h < 20) return;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    if (!this.piezas.length) { this.svg.innerHTML = ""; return; }

    const cajas = this.piezas.map((p) => p.limites());
    const { s: s0, pos } = disponer(cajas, w, h);
    const s = s0 * this.zoom;
    const f = (v) => v.toFixed(1);
    const varias = this.piezas.length > 1;

    const capas = { CORTE: [], MARCAS: [], PLEGADO: [] };
    const cotas = [];
    this.piezas.forEach((pieza, i) => {
      const caja = cajas[i];
      // pieza i: mm → px (con zoom y desplazamiento)
      const X = (x) => (pos[i][0] + (x - caja[0]) * s0) * this.zoom + this.pan[0];
      const Y = (y) => (pos[i][1] + (caja[3] - y) * s0) * this.zoom + this.pan[1];
      for (const [capa, tipo, d] of pieza.ents) {
        let path = "";
        if (tipo === "poly") {
          path = d[0].map((p, i) => `${i ? "L" : "M"}${f(X(p[0]))} ${f(Y(p[1]))}`).join("") + (d[1] ? "Z" : "");
        } else if (tipo === "lwbulge") {
          d.forEach((p, i) => {
            const q = d[(i + 1) % d.length];
            if (!i) path += `M${f(X(p[0]))} ${f(Y(p[1]))}`;
            const a = Math.abs(p[2]) > 1e-12 ? arcoBulge(p, q, p[2]) : null;
            if (a) {
              path += `A${f(a.r * s)} ${f(a.r * s)} 0 ${Math.abs(a.th) > Math.PI ? 1 : 0} ${p[2] > 0 ? 0 : 1} ${f(X(q[0]))} ${f(Y(q[1]))}`;
            } else {
              path += `L${f(X(q[0]))} ${f(Y(q[1]))}`;
            }
          });
          path += "Z";
        } else if (tipo === "circle") {
          const [cx, cy, r] = d;
          path = `M${f(X(cx - r))} ${f(Y(cy))}a${f(r * s)} ${f(r * s)} 0 1 0 ${f(2 * r * s)} 0a${f(r * s)} ${f(r * s)} 0 1 0 ${f(-2 * r * s)} 0Z`;
        } else if (tipo === "line") {
          path = `M${f(X(d[0][0]))} ${f(Y(d[0][1]))}L${f(X(d[1][0]))} ${f(Y(d[1][1]))}`;
        }
        (capas[capa] || capas.CORTE).push(path);
      }
      cotas.push(this._cotas(pieza, [X(caja[0]), Y(caja[3]), X(caja[2]), Y(caja[1])], caja, varias));
    });
    const capa = (nom, cls) => (capas[nom].length ? `<path class="${cls}" d="${capas[nom].join("")}"/>` : "");
    this.svg.innerHTML =
      capa("CORTE", "corte") + capa("PLEGADO", "plegado") + capa("MARCAS", "marcas") + cotas.join("");
  }

  /** Cota horizontal abajo y vertical a la derecha de la pieza, con el nombre arriba. r = [izq, arriba, der, abajo]
   * en px; caja en mm. */
  _cotas(pieza, r, caja, varias) {
    const [L, T, R, B] = r;
    const ancho = caja[2] - caja[0], alto = caja[3] - caja[1];
    const yc = B + 22, xc = R + 22, t = 5;
    // nombre corto: «ramal», «extremo 1/2»; sin « - », con varias piezas, la parte («2/4»)
    let nom = pieza.nombre;
    if (nom.includes(" - ")) nom = nom.split(" - ").pop();
    else if (varias && / \d+\/\d+$/.test(nom)) nom = `parte ${nom.split(" ").pop()}`;
    const g = [];
    g.push(`<path class="aux" d="M${L} ${B + 6}V${yc + 6}M${R} ${B + 6}V${yc + 6}M${R + 6} ${T}H${xc + 6}M${R + 6} ${B}H${xc + 6}"/>`);
    g.push(`<path class="cota" d="M${L} ${yc}H${R}M${L - t} ${yc + t}L${L + t} ${yc - t}M${R - t} ${yc + t}L${R + t} ${yc - t}` +
      `M${xc} ${T}V${B}M${xc - t} ${T + t}L${xc + t} ${T - t}M${xc - t} ${B + t}L${xc + t} ${B - t}"/>`);
    g.push(`<text class="txt-cota" x="${(L + R) / 2}" y="${yc + 17}" text-anchor="middle">${num(ancho)}</text>`);
    g.push(`<text class="txt-cota" x="${xc + 7}" y="${(T + B) / 2}" dominant-baseline="middle" ` +
      `transform="rotate(-90 ${xc + 7} ${(T + B) / 2})" text-anchor="middle" dy="-0.2em">${num(alto)}</text>`);
    g.push(`<text class="txt-nombre" x="${L}" y="${T - 10}">${escapar(nom)}<tspan class="txt-cant"> ×${pieza.cantidad}</tspan></text>`);
    return g.join("");
  }

  /**
   * Gestos. En la página (completa = false) la plancha no se apropia del dedo: un dedo baja por la página y un
   * toque corto llama a alTocar (abre la pantalla completa); el mouse sí arrastra y Ctrl + rueda acerca.
   * En pantalla completa: un dedo mueve, dos dedos acercan, la rueda acerca.
   */
  _eventos() {
    const sv = this.svg;
    this.completo = false;
    this.alTocar = null;
    const pos = (e) => { const r = sv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let toque = null;                                    // dedo en la página: ¿fue un toque o un desplazamiento?
    sv.addEventListener("pointerdown", (e) => {
      if (!this.completo && e.pointerType !== "mouse") {
        toque = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
        return;
      }
      if (e.pointerType === "mouse" && e.button !== 0) return;
      sv.setPointerCapture(e.pointerId);
      this._punteros.set(e.pointerId, pos(e));
    });
    sv.addEventListener("pointermove", (e) => {
      if (toque && e.pointerId === toque.id && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 10) toque = null;
      if (!this._punteros.has(e.pointerId)) return;
      const ant = this._punteros.get(e.pointerId), nue = pos(e);
      if (this._punteros.size === 1) {
        this.pan = [this.pan[0] + nue[0] - ant[0], this.pan[1] + nue[1] - ant[1]];
        this._punteros.set(e.pointerId, nue);
        this._pedir();
      } else if (this._punteros.size === 2) {
        const otro = [...this._punteros.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(ant[0] - otro[0], ant[1] - otro[1]), d1 = Math.hypot(nue[0] - otro[0], nue[1] - otro[1]);
        this._punteros.set(e.pointerId, nue);
        if (d0 > 4) this.acercar(d1 / d0, (nue[0] + otro[0]) / 2, (nue[1] + otro[1]) / 2);
      }
    });
    sv.addEventListener("pointerup", (e) => {
      this._punteros.delete(e.pointerId);
      if (toque && e.pointerId === toque.id && performance.now() - toque.t < 500) this.alTocar?.();
      toque = null;
    });
    sv.addEventListener("pointercancel", (e) => {          // el navegador tomó el dedo para desplazar la página
      this._punteros.delete(e.pointerId);
      toque = null;
    });
    sv.addEventListener("wheel", (e) => {
      if (!this.completo && !e.ctrlKey) return;          // en la página, la rueda baja por la página
      e.preventDefault();
      const [x, y] = pos(e);
      this.acercar(Math.exp(-e.deltaY * 0.0015), x, y);
    }, { passive: false });
    sv.addEventListener("dblclick", () => this.ajustar());
  }

  /** Pantalla completa sí / no (lo pone la interfaz; cambia los gestos). */
  modoCompleto(si) {
    this.completo = si;
    this._punteros.clear();
    this.ajustar(false);
  }
}

function escapar(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
