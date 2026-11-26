// Módulos de la PWA, agrupados por oficio (pantalla de inicio). Cada uno tiene su dirección (#id) para que un
// anuncio entre directo. disponible = false: se muestra en el inicio como «Próximamente» y no se abre.
// oculto = true: no aparece en el inicio (Escaleras, hasta validarla en el taller).
// imagen: la foto de la tarjeta del inicio (img/inicio/, sacada de la app); llena = la foto cubre todo el recuadro.
export const OFICIOS = ["Chapa", "Herrería", "Carpintería"];

export const MODULOS = [
  {
    id: "chapa", oficio: "Chapa", icono: "chapa", disponible: true,
    imagen: "img/inicio/chapa.webp",
    nombre: "Desarrollos de chapa",
    descripcion: "T de caño, codos, conos, fondos de tolva, transiciones y hélices: la plantilla con sus medidas.",
    cargar: () => import("./modulos/chapa.js"),
  },
  {
    id: "portones", oficio: "Herrería", icono: "portones", disponible: true,
    imagen: "img/inicio/portones.webp", llena: true,
    nombre: "Rejas y portones",
    descripcion: "Lista de corte de cada perfil con sus ángulos, barras a comprar, peso y croquis.",
    cargar: () => import("./modulos/portones.js"),
  },
  {
    id: "escaleras", oficio: "Herrería", icono: "escaleras", disponible: false, oculto: true,
    nombre: "Escaleras",
    descripcion: "Largueros, peldaños y baranda, con su lista de corte.",
  },
  {
    id: "barras", oficio: "Herrería", icono: "barras", disponible: true,
    imagen: "img/inicio/barras.webp",
    nombre: "Barras y tubos",
    descripcion: "Cómo cortar las barras para aprovecharlas mejor, con la lista de corte.",
    cargar: () => import("./modulos/barras.js"),
  },
  {
    id: "guillotina", oficio: "Carpintería", icono: "guillotina", disponible: true,
    imagen: "img/inicio/guillotina.webp",
    nombre: "Guillotina y melamina",
    descripcion: "Cortes de lado a lado para tableros de melamina o chapa, con el orden de los cortes.",
    cargar: () => import("./modulos/guillotina.js"),
  },
];

export const moduloPorId = (id) => MODULOS.find((m) => m.id === id);
