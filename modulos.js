// Módulos de la PWA, agrupados por oficio (pantalla de inicio). Cada uno tiene su dirección (#id) para que un
// anuncio entre directo. disponible = false: se muestra en el inicio como «Próximamente» y no se abre.
export const OFICIOS = ["Chapa", "Herrería", "Carpintería"];

export const MODULOS = [
  {
    id: "chapa", oficio: "Chapa", icono: "chapa", disponible: true,
    nombre: "Desarrollos de chapa",
    descripcion: "T de caño, codos por gajos, conos y fondos de tolva: la plantilla con sus medidas.",
    cargar: () => import("./modulos/chapa.js"),
  },
  {
    id: "portones", oficio: "Herrería", icono: "portones", disponible: false,
    nombre: "Rejas y portones",
    descripcion: "Lista de corte de cada perfil, barras a comprar y croquis.",
  },
  {
    id: "escaleras", oficio: "Herrería", icono: "escaleras", disponible: false,
    nombre: "Escaleras",
    descripcion: "Largueros, peldaños y baranda, con su lista de corte.",
  },
  {
    id: "barras", oficio: "Herrería", icono: "barras", disponible: false,
    nombre: "Barras y tubos",
    descripcion: "Cómo cortar las barras para aprovecharlas mejor.",
  },
  {
    id: "guillotina", oficio: "Carpintería", icono: "guillotina", disponible: false,
    nombre: "Guillotina y melamina",
    descripcion: "Cortes de lado a lado para tableros de melamina o chapa.",
  },
];

export const moduloPorId = (id) => MODULOS.find((m) => m.id === id);
