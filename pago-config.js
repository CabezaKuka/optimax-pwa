// Formas de pago de la PRO (26-nov, Max). Solo datos: la pantalla los arma hoja-pro.js.
// Al cambiar un precio o una forma de pago, cambiarlo también en el bot (agente-whatsapp/licencias_pwa.js →
// METODOS_PAGO, el aviso al dueño), en weboptimax/taller y subir VERSION en sw.js.
// Una forma de pago sin dirección / ID no se muestra (ej. BEP-20 hasta tener la dirección).
export const PRECIO_BS = "250 Bs";
export const PRECIO_USDT = "20 USDT";

export const METODOS = [
  {
    id: "qr", icono: "qr", titulo: "QR bancario", sub: "Todos los bancos de Bolivia", precio: PRECIO_BS,
    qr: "img/pago/qr-bnb.jpg", archivo: "optimax-taller-pro-qr-250bs.jpg", bolivia: true,
  },
  {
    id: "binance", icono: "billetera", titulo: "Binance Pay", sub: "Pago directo desde Binance", precio: PRECIO_USDT,
    payId: "211223373", titular: "GMSoftware",
  },
  {
    id: "bep20", icono: "moneda", titulo: "USDT — BNB Smart Chain", sub: "Red BEP-20", precio: PRECIO_USDT,
    red: "BNB Smart Chain (BEP-20)", direccion: "",
  },
  {
    id: "trc20", icono: "moneda", titulo: "USDT — TRON", sub: "Red TRC-20", precio: PRECIO_USDT,
    red: "TRON (TRC-20)", direccion: "TDgsY9n73Ezv5FBXPe951HSTDZ3v65PRdm",
    qr: "img/pago/usdt-trc20.png", archivo: "optimax-taller-pro-usdt-trc20.png",
  },
];
