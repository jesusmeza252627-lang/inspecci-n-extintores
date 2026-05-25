// ============================================================
//  sheets.js  —  Capa de integración con Google Sheets
//  Todas las operaciones CRUD pasan por aquí.
// ============================================================

function setSyncStatus(msg, cls = "") {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = "sync-status " + cls;
}

// ── ¿Está configurado el script? ──
function sheetsEnabled() {
  return CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim() !== "";
}

// ── Guardar un registro en Sheets ──
async function sheetsGuardar(registro) {
  if (!sheetsEnabled()) {
    localGuardar(registro);
    return { status: "ok", imagenes: [] };
  }
  setSyncStatus("⏳ Guardando...", "sync-loading");
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // Apps Script requiere text/plain para evitar preflight CORS
      body: JSON.stringify({ action: "guardar", registro })
    });
    const data = await res.json();
    if (data.status === "ok") {
      setSyncStatus("✅ Guardado", "sync-ok");
      localGuardar(registro); // caché local también
      return data;
    } else {
      throw new Error(data.message || "Error desconocido");
    }
  } catch (e) {
    console.error("Sheets error:", e);
    setSyncStatus("⚠️ Sin conexión — guardado local", "sync-error");
    localGuardar(registro);
    return { status: "ok", imagenes: [], _local: true };
  }
}

// ── Obtener todos los registros desde Sheets ──
async function sheetsObtenerTodos() {
  if (!sheetsEnabled()) return localObtenerTodos();
  setSyncStatus("⏳ Cargando...", "sync-loading");
  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=obtener`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === "ok") {
      setSyncStatus("✅ Sincronizado", "sync-ok");
      // Actualizar caché local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.registros));
      return data.registros;
    } else {
      throw new Error(data.message || "Error desconocido");
    }
  } catch (e) {
    console.error("Sheets error:", e);
    setSyncStatus("⚠️ Sin conexión — datos locales", "sync-error");
    return localObtenerTodos();
  }
}

// ── Eliminar un registro en Sheets ──
async function sheetsEliminar(id) {
  if (!sheetsEnabled()) return localEliminar(id);
  setSyncStatus("⏳ Eliminando...", "sync-loading");
  try {
    const body = { action: "eliminar", id };
    const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.status === "ok") {
      setSyncStatus("✅ Eliminado", "sync-ok");
      localEliminar(id);
      return true;
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    console.error("Sheets error:", e);
    setSyncStatus("⚠️ Error al eliminar", "sync-error");
    localEliminar(id);
    return false;
  }
}

// ── Capa LOCAL (fallback / caché) ──
function localGuardar(registro) {
  const todos = localObtenerTodos();
  const idx = todos.findIndex(x => x.id === registro.id);
  if (idx === -1) todos.push(registro);
  else todos[idx] = registro;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function localObtenerTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function localEliminar(id) {
  const todos = localObtenerTodos().filter(x => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// Guardar inspección completa
async function sheetsGuardarInspeccion(inspeccion) {
  if (!sheetsEnabled()) {
    localGuardarInspeccion(inspeccion);
    return { status: "ok" };
  }
  
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "guardarInspeccion", inspeccion })
    });
    const data = await res.json();
    if (data.status === "ok") {
      localGuardarInspeccion(inspeccion);
    }
    return data;
  } catch (e) {
    console.error("Error guardando inspección:", e);
    localGuardarInspeccion(inspeccion);
    return { status: "ok", _local: true };
  }
}

// Obtener todas las inspecciones
async function sheetsObtenerInspecciones() {
  if (!sheetsEnabled()) return localObtenerInspecciones();
  
  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=obtenerInspecciones`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status === "ok") {
      localStorage.setItem("inspecciones_historial", JSON.stringify(data.inspecciones));
      return data.inspecciones;
    }
  } catch (e) {
    console.error("Error obteniendo inspecciones:", e);
  }
  return localObtenerInspecciones();
}

// Capa local para inspecciones
function localGuardarInspeccion(inspeccion) {
  const inspecciones = localObtenerInspecciones();
  const index = inspecciones.findIndex(i => i.id === inspeccion.id);
  if (index === -1) inspecciones.push(inspeccion);
  else inspecciones[index] = inspeccion;
  localStorage.setItem("inspecciones_historial", JSON.stringify(inspecciones));
}

function localObtenerInspecciones() {
  try {
    return JSON.parse(localStorage.getItem("inspecciones_historial") || "[]");
  } catch {
    return [];
  }
}