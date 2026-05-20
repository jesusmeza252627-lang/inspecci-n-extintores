// ============================================================
//  config.js  —  Configuración del proyecto
//
//  ⚠️  PASO 1: Pega aquí la URL de tu Google Apps Script
//       después de desplegarlo como "Web App".
//       Ver instrucciones en: docs/SETUP.md
// ============================================================

const CONFIG = {

  // URL del Google Apps Script desplegado como Web App.
  // Reemplaza la cadena vacía con tu URL real.
  // Ejemplo: "https://script.google.com/macros/s/AKfycb.../exec"
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwr9mpwnxsM8b78i7IkpvhXIr_2eiU0uhAyLEUp7ylSvXYQtHWNOa4VR3HEaTVp7sx-jQ/exec",

  // Si en true, usa localStorage como respaldo cuando
  // no hay conexión o la URL está vacía.
  USE_LOCAL_FALLBACK: true,

  // Nombre de la hoja dentro del Google Sheet
  SHEET_NAME: "Inspecciones"

};

// ── Mapa de códigos SHK → nombre de cliente ──
const CLIENTES_MAP = {
  "100": "Siviack",
  "101": "CCH",
  "102": "QARA",
  "103": "4OS",
  "104": "UTM",
  "105": "SDB",
  "106": "KDC",
  "107": "NTM",
  "108": "NGT",
  "109": "CSC",
  "110": "SSR"
};

// ── Configuración visual por cliente ──
const CLIENT_CONFIG = {
  "105": { nombre:"SDB",    color:"#0b2c74", logo:"assets/clientes/105/logo.png", footer:"Documento Controlado" },
  "100": { nombre:"Siviack",color:"#1b5e20", logo:"assets/clientes/100/logo.png", footer:"Uso Interno" },
  "default": { nombre:"Cliente", color:"#1e3c72", logo:"", footer:"Documento SST" }
};

// ── Detalle de no conformidades ──
const detalleNC = {
  1:"Ubicación incorrecta",  2:"Acceso obstruido",      3:"Zona no delimitada",
  4:"Señalización ausente",  5:"Capacidad ilegible",    6:"Colgador ausente",
  7:"Gabinete dañado",       8:"Altura incorrecta",     9:"Manómetro dañado",
  10:"Palanca dañada",       11:"Manguera dañada",      12:"Tobera dañada",
  13:"Abrazadera dañada",    14:"Cilindro dañado",      15:"Pintura deteriorada",
  16:"Pictograma ilegible",  17:"Forma de uso ilegible",18:"Etiqueta ilegible",
  19:"Precinto roto",        20:"Otros"
};

const STORAGE_KEY = "modulo_extintores_registros";

