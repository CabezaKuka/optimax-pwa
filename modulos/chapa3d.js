// Vista 3D de la pieza de chapa armada (DEMO y PRO; 25-nov, Max: superficie fina, como el 3D de portones).
// Sale de fig.armado3D(v, t) (geo/arma3d.js): la plantilla vuelta a enrollar. Colores (Max: «no gris»): lo que se
// corta en tonos del azul de chapa (una pieza de cada tono); lo que no se corta (el caño principal) en ámbar suave.
import { abrirVisor, cerrarVisor } from "./visor3d.js";
import { malla, tamano } from "../geo/arma3d.js";

const TONOS = ["#3b82f6", "#1d4ed8", "#60a5fa", "#2563eb", "#93c5fd"];
const BORDE = "#1e3a8a";
const REF = "#f3d19c", BORDE_REF = "#b7791f";

/** Abre la vista 3D de la figura con sus medidas (v ya leídas) y el espesor t. */
export async function abrir3DChapa(fig, v, t) {
  const piezas = fig.armado3D(v, t);
  const tam = tamano(piezas) || 100;
  const paso = tam / 90;                                   // largo máximo de cada tramo de la malla
  await abrirVisor({ zArriba: true, margen: tam * 0.04, fondo: "#eef2f8", armar: (T, grupo, basura) => {
    const lineas = new T.LineBasicMaterial({ color: BORDE }), lineasRef = new T.LineBasicMaterial({ color: BORDE_REF });
    basura.push(lineas, lineasRef);
    let n = 0, tri = 0;
    for (const p of piezas) {
      const { pos, idx, bordes } = malla(p, paso);
      if (!idx.length) continue;
      const ref = p.tono === "ref";
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new T.MeshStandardMaterial({ color: ref ? REF : TONOS[n % TONOS.length], metalness: 0.15, roughness: 0.55,
        side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: ref ? 2 : 1, polygonOffsetUnits: 1 });
      const lg = new T.BufferGeometry();
      lg.setAttribute("position", new T.Float32BufferAttribute(bordes.flat(2), 3));
      basura.push(geo, mat, lg);
      grupo.add(new T.Mesh(geo, mat), new T.LineSegments(lg, ref ? lineasRef : lineas));
      if (!ref) n++;
      tri += idx.length / 3;
    }
    const refs = piezas.filter((p) => p.tono === "ref").length;
    return { datos: { piezas: String(n), refs: String(refs), triangulos: String(tri) } };
  } });
}

export const cerrar3DChapa = cerrarVisor;
