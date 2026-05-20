// ============================================================
//  Google Apps Script  —  Backend para Google Sheets
//
//  INSTRUCCIONES:
//  1. Abre: https://script.google.com
//  2. Crea un nuevo proyecto
//  3. Pega TODO este código en el editor
//  4. Cambia SPREADSHEET_ID por el ID de tu Google Sheet
//  5. Despliega como "Web App" → acceso: "Cualquier persona"
//  6. Copia la URL generada en js/config.js → CONFIG.APPS_SCRIPT_URL
// ============================================================

const SPREADSHEET_ID = "1GKzH_0AUCmIqLUwKXw_iQozZUMqrG7D1YW3c_Aej32E";
const SHEET_NAME = "Inspecciones";

// Cabeceras: igual que la interfaz visual
// a1-a20 → ✔ / ✖
// detallesNC → "A1 | A2 | A13"
// prioridades → "A1-Pendiente | A2-Importante | A13-Urgente"
const HEADERS = [
  "id",
  "codigoSHK",
  "fecha",
  "tipoAgente",
  "numeroExtintor",
  "capacidad",
  "ubicacion",
  "referencia",
  "zonaRiesgo",
  "fechaCarga",
  "pruebaHidrostatica",
  "observaciones",

  "detallesNC",
  "prioridades",

  "imagenes"
];

// ── GET → obtener todos los registros ──
function doGet(e) {
  const action = e.parameter.action || "obtener";
  if (action === "obtener") {
    return jsonResponse(obtenerRegistros());
  }
  return jsonResponse({ status: "error", message: "Acción no reconocida" });
}

// ── POST → guardar o eliminar ──
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ status: "error", message: "JSON inválido" });
  }

  if (body.action === "guardar") {
    return jsonResponse(guardarRegistro(body.registro));
  }
  if (body.action === "eliminar") {
    return jsonResponse(eliminarRegistro(body.id));
  }

  return jsonResponse({ status: "error", message: "Acción no reconocida" });
}

// ── Obtener hoja, crearla si no existe ──
function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground("#1e3c72").setFontColor("white").setFontWeight("bold");
  }
  return sheet;
}

// ── Leer todos los registros ──
function obtenerRegistros() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: "ok", registros: [] };

    const headers = data[0];
    const registros = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];

        // p1-p20: reconstruir desde la columna "prioridades" al cargar
        // (se hace abajo, después de parsear toda la fila)

        // imagenes: parsear JSON
        if (h === "imagenes") {
          try { val = JSON.parse(val || "[]"); } catch { val = []; }
        }

        obj[h] = val;
      });

      return obj;
    });

    return { status: "ok", registros };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// ── Guardar (upsert) un registro ──
function guardarRegistro(registro) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    const reg = Object.assign({}, registro);

    // Serializar imagenes
    if (Array.isArray(reg.imagenes)) {
      reg.imagenes = JSON.stringify(reg.imagenes);
    }

    // detallesNC y prioridades ya vienen calculados desde app.js
    // pero los validamos por si acaso
    if (!reg.detallesNC) reg.detallesNC = "Sin NC";
    if (!reg.prioridades) reg.prioridades = "-";

    // Buscar si ya existe por id
    let filaExistente = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(reg.id)) {
        filaExistente = i + 1;
        break;
      }
    }

    const row = HEADERS.map(h => (reg[h] !== undefined ? reg[h] : ""));

    if (filaExistente > 0) {
      sheet.getRange(filaExistente, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return { status: "ok" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// ── Eliminar un registro por id ──
function eliminarRegistro(id) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { status: "ok" };
      }
    }
    return { status: "error", message: "Registro no encontrado" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// ── Helper: respuesta JSON con CORS ──
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}