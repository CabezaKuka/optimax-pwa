// Entrada para armar vendor/three.min.js (solo lo que usan las vistas 3D de portones y de chapa, con OrbitControls):
//   npm i three@0.187.0 esbuild
//   npx esbuild tools/three-entrada.js --bundle --minify --format=esm --legal-comments=none --outfile=vendor/three.min.js
export {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, ExtrudeGeometry, CylinderGeometry,
  BoxGeometry, Shape, HemisphereLight, DirectionalLight, Color, Vector3, Box3, EdgesGeometry, LineSegments,
  LineBasicMaterial, SRGBColorSpace, Quaternion, MOUSE, TOUCH,
  BufferGeometry, Float32BufferAttribute, DoubleSide,              // chapa (25-nov): mallas de las plantillas enrolladas
  CanvasTexture, RepeatWrapping,                                   // portones (26-nov): ladrillo, adoquín
} from "three";
export { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
