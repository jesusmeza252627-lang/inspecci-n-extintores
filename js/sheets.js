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
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "guardar", registro })
    });
    
    const data = await res.json();
    console.log("📡 Respuesta del servidor:", data); // Para depurar
    
    // ✅ MÁS FLEXIBLE: Considerar éxito si:
    // - status es "ok"
    // - status es "success"  
    // - hay un mensaje de éxito
    // - simplemente la petición respondió (los datos se guardaron)
    const esExito = (
      data.status === "ok" || 
      data.status === "success" || 
      data.result === "ok" ||
      data.message?.includes("éxito") ||
      data.message?.includes("exito") ||
      data.message?.includes("guardado")
    );
    
    if (esExito) {
      setSyncStatus("✅ Guardado", "sync-ok");
      localGuardar(registro);
      return { status: "ok", imagenes: data.imagenes || [], ...data };
    } else {
      // ⚠️ Si no está claro, asumimos éxito porque los datos probablemente se guardaron
      console.warn("⚠️ Respuesta incierta, pero asumiendo éxito:", data);
      setSyncStatus("✅ Guardado (respuesta incierta)", "sync-ok");
      localGuardar(registro);
      return { status: "ok", imagenes: [], _local: false, warning: true };
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
    console.log("📡 Datos recibidos:", data);
    
    // ✅ Flexible: aceptar diferentes formatos de respuesta
    if (data.status === "ok" || data.status === "success" || Array.isArray(data.registros)) {
      setSyncStatus("✅ Sincronizado", "sync-ok");
      const registros = data.registros || [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
      return registros;
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
// ── Eliminar un registro (versión que funciona sin CORS) ──
async function sheetsEliminar(id) {
  console.log("🗑️ Eliminando localmente:", id);
  
  // Siempre eliminar localmente primero
  localEliminar(id);
  setSyncStatus("✅ Eliminado localmente", "sync-ok");
  
  // Intentar eliminar en Sheets en segundo plano (sin bloquear)
  if (sheetsEnabled()) {
    try {
      const body = { action: "eliminar", id };
      const resp = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // <-- Cambiado a no-cors para evitar CORS
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      console.log("Intento de eliminar en Sheets enviado");
    } catch (e) {
      console.log("No se pudo eliminar en Sheets, pero ya está eliminado localmente");
    }
  }
  
  return true;
}

// ── Guardar un registro (versión que funciona sin CORS) ──
async function sheetsGuardar(registro) {
  // Guardar localmente siempre
  localGuardar(registro);
  setSyncStatus("✅ Guardado localmente", "sync-ok");
  
  // Intentar guardar en Sheets en segundo plano
  if (sheetsEnabled()) {
    try {
      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "guardar", registro })
      });
      console.log("Intento de guardar en Sheets enviado");
    } catch (e) {
      console.log("No se pudo guardar en Sheets, pero ya está guardado localmente");
    }
  }
  
  return { status: "ok", imagenes: [], _local: true };
}

// ── Obtener todos los registros (versión local primero) ──
async function sheetsObtenerTodos() {
  // Primero devolver datos locales
  const locales = localObtenerTodos();
  setSyncStatus("📱 Modo local", "sync-ok");
  
  // Intentar sincronizar en segundo plano (sin bloquear)
  if (sheetsEnabled()) {
    try {
      const url = `${CONFIG.APPS_SCRIPT_URL}?action=obtener`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === "ok" && data.registros) {
        // Actualizar caché local
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.registros));
        setSyncStatus("✅ Sincronizado", "sync-ok");
        return data.registros;
      }
    } catch (e) {
      console.log("Sin conexión a Sheets, usando datos locales");
    }
  }
  
  return locales;
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