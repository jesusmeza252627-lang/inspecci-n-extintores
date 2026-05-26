// ============================================================
//  app.js  —  Lógica principal de la aplicación
// ============================================================

let registros = [];
let editId = null;
let estadoChart = null;
let anomaliaChart = null;
let prioridadChart = null;
let eliminarImagenes = false;

// ── Inicialización ──
async function init() {
  if (!cargarDatosSesion()) return; // Redirige si no hay sesión
  agregarAnomalia();
  await sincronizarDesdeSheets();
}

function cargarDatosSesion() {
  const datos = localStorage.getItem("datosInspeccion");
  if (!datos) {
    console.warn("No hay datos de sesión. Redirigiendo al login...");
    window.location.href = "login_sistema_inspecciones.html";
    return false;
  }

  const sesion = JSON.parse(datos);
  document.getElementById("codigoSHK").value = sesion.codigoSHK || "";
  document.getElementById("cliente").value = sesion.cliente || "";
  document.getElementById("Sede").value = sesion.sede || "";
  document.getElementById("fechaInspeccion").value = sesion.fecha || "";
  document.getElementById("codigoFormato").value = sesion.codigoFormato || "";

  // Opcional: mostrar en algún lugar el inspector
  console.log(`Inspector: ${sesion.nombre} (${sesion.rol})`);
  return true;
}

async function sincronizarDesdeSheets() {
  registros = await sheetsObtenerTodos();
  renderTabla();
  actualizarDashboard();
  await actualizarInforme();
}

// ── Tabs ──
async function switchTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  btn.classList.add("active");
  if (tab === "dashboard") actualizarDashboard();
  if (tab === "informe") await actualizarInforme();
  if (tab === "seguimiento") {
    cargarSeguimiento();
  }
}

// ── Autocompletar cliente ──
function autocompletarCliente() {
  const codigo = document.getElementById("codigoSHK").value;
  document.getElementById("cliente").value = CLIENTES_MAP[codigo] || "";
}

// ── Anomalías ──
function agregarAnomalia(valor = { codigo: "", prioridad: "Pendiente" }) {
  const container = document.getElementById("anomaliasGrid");
  const div = document.createElement("div");
  div.className = "anomalia-item";
  div.innerHTML = `
    <div>
      <label>Anomalía / No Conformidad</label>
      <select class="codigo">
        <option value="">Seleccione</option>
        ${Object.entries(detalleNC).map(([key, val]) =>
          `<option value="${key}">${key} - ${val}</option>`
        ).join("")}
      </select>
    </div>
    <div>
      <label>Nivel de prioridad: AC/OM</label>
      <select class="prioridad">
        <option value="Urgente">Urgente</option>
        <option value="Importante">Importante</option>
        <option value="Pendiente">Pendiente</option>
      </select>
    </div>
    <div>
      <button type="button" class="mini-btn danger" onclick="this.closest('.anomalia-item').remove()">✖</button>
    </div>
  `;
  container.appendChild(div);
  div.querySelector(".codigo").value = valor.codigo;
  div.querySelector(".prioridad").value = valor.prioridad;
}

// ── Helpers ──

// Convierte el registro al formato de la interfaz:
// a1-a20 como true/false (internamente), detallesNC y prioridades como texto compacto
function contarAnomaliasRegistro(reg) {
  let total = 0;
  for (let i = 1; i <= 20; i++) { if (reg["a" + i]) total++; }
  return total;
}

function esConforme(reg) { return contarAnomaliasRegistro(reg) === 0; }

// "A1 | A2 | A13"
function obtenerDetallesNC(reg) {
  const detalles = [];
  for (let i = 1; i <= 20; i++) { if (reg["a" + i]) detalles.push("A" + i); }
  return detalles.join(" | ");
}

// "A1-Pendiente | A2-Importante | A13-Urgente"
function obtenerPrioridadesTexto(reg) {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    if (reg["a" + i]) {
      items.push(`A${i}-${reg["p" + i] || "Pendiente"}`);
    }
  }
  return items.join(" | ");
}

function obtenerDescripcionNC(reg, html = false) {
  const detalles = [];
  for (let i = 1; i <= 20; i++) {
    if (reg["a" + i]) detalles.push(`<li><strong>A${i}</strong> - ${detalleNC[i]}</li>`);
  }
  if (!detalles.length) return "Sin NC";
  if (html) return `<ul style="padding-left:18px;margin:0;">${detalles.join("")}</ul>`;
  return detalles.map(x => x.replace(/<[^>]*>/g, "")).join(" | ");
}
function formatearObservaciones(obs) {
  if (!obs || obs.trim() === "") return "-";

  // Dividir por líneas
  let lineas = obs.split("\n").map(l => l.trim()).filter(l => l !== "");

  // Limpiar numeración manual (1., 2., etc.) y viñetas (-, *, •)
  lineas = lineas.map(linea => {
    // Elimina patrones como "1. ", "2. ", "1) ", "2) ", "- ", "* ", "• "
    return linea.replace(/^(\d+[\.\)]\s*|[\-\*\•]\s*)/, "");
  });

  // Generar HTML con lista ordenada
  return `
    <ol style="margin:0;padding-left:18px;">
      ${lineas.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
    </ol>
  `;
}

// Función auxiliar para evitar XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function iniciarNumeracion() {
  const txt = document.getElementById("observaciones");

  if (txt.value.trim() === "") {
    txt.value = "1. ";
  }
}

function numerarObservaciones(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const txt = e.target;
    const cursorPos = txt.selectionStart;
    const textBefore = txt.value.substring(0, cursorPos);
    const textAfter = txt.value.substring(cursorPos);
    txt.value = textBefore + "\n" + textAfter;
    txt.selectionStart = txt.selectionEnd = cursorPos + 1;
  }
}

function iniciarNumeracion() {
  const txt = document.getElementById("observaciones");
  if (txt.value.trim() === "") {
    txt.value = ""; // Ya no ponemos "1. " automáticamente
  }
}

function actualizarUnidadesCapacidad() {
  const tipoAgente = document.getElementById("tipoAgente").value;
  const unidadSelect = document.getElementById("unidadCapacidad");

    // Si no hay agente seleccionado
  if (!tipoAgente) {
    unidadSelect.innerHTML = '<option value="" disabled selected>Unidad</option>';;
    return;
  }

  unidadSelect.innerHTML = '<option value="" disabled selected>Unidad</option>';;

  let unidades = [];

  switch (tipoAgente) {
    case "PQS":
      unidades = ["Kg."];
      break;

    case "CO2":
      unidades = ["Lb."];
      break;

    case "H2O-P":
      unidades = ["L.", "Gal."];
      break;

    case "H2O-DI":
      unidades = ["L.", "Gal."];
      break;

    case "ADP/PK":
      unidades = ["Kg."];
      break;

    case "Otros":
      unidades = ["Kg.", "Lb.", "L.", "Gal.", "ml."];
      break;
  }

  unidades.forEach(unidad => {
    const option = document.createElement("option");
    option.value = unidad;
    option.textContent = unidad;
    unidadSelect.appendChild(option);
  });

  // Si solo existe una opción válida, seleccionarla automáticamente
  if (unidades.length === 1) {
    unidadSelect.value = unidades[0];
  }
}

async function filesToDataUrls(files) {
  const arr = Array.from(files || []);
  return Promise.all(arr.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

async function getFormulario() {

  const anoms = {};
  for (let i = 1; i <= 20; i++) {
    anoms["a" + i] = false;
    anoms["p" + i] = "";
  }

  document.querySelectorAll("#anomaliasGrid .anomalia-item").forEach(el => {
    const codigo = el.querySelector(".codigo").value;
    const prioridad = el.querySelector(".prioridad").value;

    if (codigo) {
      anoms["a" + codigo] = true;
      anoms["p" + codigo] = prioridad;
    }
  });

  let imagenes = [];
  const inputImgs = document.getElementById("imagenObservacion");

  if (inputImgs.files && inputImgs.files.length) {

    if (inputImgs.files.length > 2) {
      alert("Solo se permiten máximo 2 imágenes.");
      throw new Error("Límite de imágenes excedido");
    }

    imagenes = await Promise.all(
      Array.from(inputImgs.files).map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      })
    );

  } else if (editId) {
    const anterior = registros.find(x => x.id === editId);
    imagenes = eliminarImagenes ? [] : (anterior?.imagenes || []);
  }

  const reg = {
    id: editId || Date.now().toString(),
    codigoSHK: document.getElementById("codigoSHK").value,
    fecha: document.getElementById("fechaInspeccion").value,
    tipoAgente: document.getElementById("tipoAgente").value,
    numeroExtintor: document.getElementById("numeroExtintor").value,
    capacidad: `${document.getElementById("capacidad").value} ${document.getElementById("unidadCapacidad").value}`.trim(),
    ubicacion: document.getElementById("ubicacion").value,
    referencia: document.getElementById("referencia").value,
    zonaRiesgo: document.getElementById("zonaRiesgo").value,
    fechaCarga: document.getElementById("fechaCarga").value,
    pruebaHidrostatica: document.getElementById("pruebaHidrostatica").value,
    observaciones: document.getElementById("observaciones").value,
    imagenes,
    ...anoms
  };

  reg.detallesNC = obtenerDetallesNC(reg);
  reg.prioridades = obtenerPrioridadesTexto(reg);

  return reg;
}

function cambiarColorRiesgo(select){

  if(select.value==="Alta"){
    select.style.background="#dc2626";
    select.style.color="white";
  }
  else if(select.value==="Media"){
    select.style.background="#facc15";
    select.style.color="black";
  }
  else if(select.value==="Baja"){
    select.style.background="#16a34a";
    select.style.color="white";
  }
  else{
    select.style.background="white";
    select.style.color="black";
  }
}

function cambiarColorZona() {
  const select = document.getElementById("zonaRiesgo");

  switch (select.value) {
    case "Alta":
      select.style.backgroundColor = "#dc2626";
      select.style.color = "white";
      break;

    case "Media":
      select.style.backgroundColor = "#f59e0b";
      select.style.color = "black";
      break;

    case "Baja":
      select.style.backgroundColor = "#16a34a";
      select.style.color = "white";
      break;

    default:
      select.style.backgroundColor = "";
      select.style.color = "";
  }
}

// ── GUARDAR ──
async function guardarRegistro() {
  if (inspeccionFinalizada) {
    alert("⚠️ Esta inspección ya fue finalizada. No se pueden agregar más registros.");
    return;
  }
  
  const reg = await getFormulario();
  if (!reg) return;
  
  if (!validarFormulario(reg)) {
    alert("Debe completar todos los campos.");
    return;
  }
  
  // Agregar ID de inspección al registro
  reg.idInspeccion = inspeccionActual.id;
  
  const regGuardar = { ...reg };
  for (let i = 1; i <= 20; i++) {
    delete regGuardar["a" + i];
    delete regGuardar["p" + i];
  }
  
  try {
    const res = await sheetsGuardar(regGuardar);
    
    const regFinal = { ...reg };
    if (res.imagenes && res.imagenes.length > 0) {
      regFinal.imagenes = res.imagenes;
    }
    
    const idx = registros.findIndex(x => x.id === reg.id);
    if (idx === -1) registros.push(regFinal);
    else registros[idx] = regFinal;
    
    // Actualizar la inspección actual
    inspeccionActual.registros = [...registros];
    inspeccionActual.fechaModificacion = new Date().toISOString();
    await sheetsGuardarInspeccion(inspeccionActual);
    
    limpiarFormulario();
    renderTabla();
    actualizarDashboard();
    await actualizarInforme();
    
  } catch (e) {
    console.error("Error al guardar:", e);
    alert("⚠️ Error al guardar el registro");
  }
}

function validarFormulario(reg) {
  const capacidadNumero = parseFloat(document.getElementById("capacidad").value);
  if (isNaN(capacidadNumero) || capacidadNumero <= 0) {
    alert("La capacidad debe ser un número positivo.");
    return false;
  }
  return !!(
    reg.fecha && reg.tipoAgente && reg.numeroExtintor &&
    reg.capacidad && reg.ubicacion && reg.referencia &&
    reg.zonaRiesgo && reg.fechaCarga && reg.pruebaHidrostatica && reg.observaciones
  );
}

function limpiarFormulario() {
  editId = null; 
  eliminarImagenes = false; 
  document.getElementById("tipoAgente").value = "";
  actualizarUnidadesCapacidad();
  document.getElementById("numeroExtintor").value = "";
  document.getElementById("capacidad").value = "";
  document.getElementById("ubicacion").value = "";
  document.getElementById("referencia").value = "";
  document.getElementById("zonaRiesgo").value = "";
  cambiarColorRiesgo(document.getElementById("zonaRiesgo"));
  document.getElementById("fechaCarga").value = "";
  document.getElementById("pruebaHidrostatica").value = "";
  document.getElementById("observaciones").value = "";
  document.getElementById("imagenObservacion").value = "";
  document.getElementById("anomaliasGrid").innerHTML = "";
  agregarAnomalia();
}

function nuevoRegistro() { editId = null; limpiarFormulario(); }

function eliminarImagenesActuales() {
  eliminarImagenes = true;
  document.getElementById("imagenObservacion").value = "";
  alert("Las imágenes serán eliminadas al guardar.");
}

function editarRegistro(id) {
  const r = registros.find(x => x.id === id);
  if (!r) return;
  editId = id;

  document.getElementById("codigoSHK").value = r.codigoSHK || "";
  autocompletarCliente();
  document.getElementById("fechaInspeccion").value = r.fecha;
  document.getElementById("tipoAgente").value = r.tipoAgente;
  actualizarUnidadesCapacidad();
  document.getElementById("numeroExtintor").value = r.numeroExtintor;
  const capacidadSplit = r.capacidad.split(" ");
  document.getElementById("capacidad").value = capacidadSplit[0] || "";
  document.getElementById("unidadCapacidad").value = capacidadSplit[1] || "";
  document.getElementById("ubicacion").value = r.ubicacion;
  document.getElementById("referencia").value = r.referencia;
  document.getElementById("zonaRiesgo").value = r.zonaRiesgo;
  cambiarColorRiesgo(document.getElementById("zonaRiesgo"));
  document.getElementById("fechaCarga").value = r.fechaCarga;
  document.getElementById("pruebaHidrostatica").value = r.pruebaHidrostatica;
  document.getElementById("observaciones").value = r.observaciones;

  const container = document.getElementById("anomaliasGrid");
  container.innerHTML = "";
  let tiene = false;
  for (let i = 1; i <= 20; i++) {
    if (r["a" + i]) {
      tiene = true;
      agregarAnomalia({ codigo: String(i), prioridad: r["p" + i] || "Pendiente" });
    }
  }
  if (!tiene) agregarAnomalia();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function eliminarRegistro(id) {
  console.log("🗑️ Eliminando registro:", id);
  
  const registro = registros.find(r => r.id === id);
  if (!registro) {
    notif("❌ Registro no encontrado", "error");
    return;
  }
  
  const confirmar = confirm(`¿Eliminar el registro del extintor ${registro.numeroExtintor || id}?\n\nEsta acción no se puede deshacer.`);
  
  if (!confirmar) return;
  
  // Eliminar de la lista local inmediatamente
  registros = registros.filter(r => r.id !== id);
  
  // Intentar eliminar (fallará por CORS pero ya está eliminado localmente)
  try {
    await sheetsEliminar(id);
  } catch(e) {
    console.log("Error al eliminar en Sheets, pero local ya se eliminó");
  }
  
  // Actualizar UI
  renderTabla();
  actualizarDashboard();
  await actualizarInforme();
  
  notif("✅ Registro eliminado correctamente", "success");
}

// ── Render Tabla ──
function okNc(flag) { return flag ? "✖" : "✔"; }
function obtenerPrioridades(reg) {
  const prioridades = [];

  for (let i = 1; i <= 20; i++) {
    if (reg["a" + i]) {

      const prioridad = reg["p" + i] || "Pendiente";

      let color = "#16a34a";

      if (prioridad === "Urgente") color = "#dc2626";
      if (prioridad === "Importante") color = "#f59e0b";

      prioridades.push(`
        <div style="margin-bottom:4px;">
          <span style="
            background:${color};
            color:#fff;
            padding:4px 8px;
            border-radius:12px;
            font-weight:bold;
            display:inline-block;
          ">
            A${i} - ${prioridad}
          </span>
        </div>
      `);
    }
  }

  return prioridades.join("");
}

function renderTabla() {
  const tbody = document.querySelector("#tablaInspeccion tbody");
  tbody.innerHTML = "";
  
  registros.forEach((r, i) => {
    const tr = document.createElement("tr");
    
    // Generar HTML de anomalías (A1 a A20)
    let anomaliasHtml = "";
    for (let a = 1; a <= 20; a++) {
      const tieneAnomalia = r["a" + a];
      anomaliasHtml += `
        <td class="anomalia-cell" style="text-align:center;">
            ${tieneAnomalia
                ? '<span style="color:red;font-size:12px;">❌</span>'
                : '<span style="color:green;font-size:16px;">✔</span>'}
        </td>`;
    }
    
    // Obtener estado de seguimiento para este registro
    const seguimiento = obtenerSeguimientoRegistro(r.id);
    
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.numeroExtintor}</td>
      <td>${r.tipoAgente}</td>
      <td>${r.capacidad}</td>
      <td class="left">${r.ubicacion}</td>
      <td class="left">${r.referencia || ""}</td>
      <td>${r.zonaRiesgo}</td>
      <td>${r.fechaCarga}</td>
      <td>${r.pruebaHidrostatica}</td>
      ${anomaliasHtml}
      <td class="left">${obtenerDetallesNC(r) || "Sin NC"}</td>
      <td class="left">${obtenerPrioridades(r) || "-"}</td>
      <td class="left">
        ${formatearObservaciones(r.observaciones)}
        <div class="thumbs">${(r.imagenes || []).map(img => `<img src="${img}">`).join("")}</div>
      </td>
      <td class="seguimiento-cell" style="text-align:center; background:#fef3c7;">
        <div class="seguimiento-estado" id="seguimiento-${i}">
          ${renderSeguimientoEstado(r.id, seguimiento)}
        </div>
      </td>
      <td class="acciones-cell" style="white-space:nowrap; text-align:center;">
        <button class="mini-btn warning btn-editar-reg" data-id="${r.id}" title="Editar registro" style="cursor:pointer;">✏️</button>
        <button class="mini-btn danger btn-eliminar-reg" data-id="${r.id}" title="Eliminar registro" style="cursor:pointer; margin-left:4px;">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Asignar eventos con addEventListener — más robusto que onclick inline
  tbody.querySelectorAll(".btn-editar-reg").forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      editarRegistro(this.dataset.id);
    });
  });
  tbody.querySelectorAll(".btn-eliminar-reg").forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      eliminarRegistro(this.dataset.id);
    });
  });
  
  if (!registros.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="33">No hay registros.</td>`;
    tbody.appendChild(tr);
  }
}

function renderSeguimientoEstado(idRegistro, seguimiento) {
  if (!seguimiento) {
    return `<button class="btn-seguimiento" onclick="iniciarSeguimiento('${idRegistro}')">📋 Iniciar</button>`;
  }
  
  const fecha = seguimiento.fechaLevantamiento ? new Date(seguimiento.fechaLevantamiento).toLocaleDateString() : "-";
  const estadoClass = {
    'pendiente': 'estado-pendiente',
    'proceso': 'estado-proceso',
    'levantado': 'estado-levantado',
    'verificado': 'estado-verificado'
  }[seguimiento.estado] || 'estado-pendiente';
  
  const estadoIcono = {
    'pendiente': '⏳',
    'proceso': '🔄',
    'levantado': '✅',
    'verificado': '🔍'
  }[seguimiento.estado] || '⏳';
  
  const estadoTexto = {
    'pendiente': 'Pendiente',
    'proceso': 'En proceso',
    'levantado': 'Levantado',
    'verificado': 'Verificado'
  }[seguimiento.estado] || 'Pendiente';
  
  return `
    <div class="seguimiento-info" style="font-size:0.75rem;">
      <div class="seguimiento-estado-badge ${estadoClass}">
        ${estadoIcono} ${estadoTexto}
      </div>
      <div class="seguimiento-fecha" style="font-size:0.7rem; color:#666;">${fecha}</div>
      <div class="seguimiento-responsable" style="font-size:0.7rem;">${seguimiento.responsable || ""}</div>
      <button class="btn-seguimiento-small" onclick="editarSeguimiento('${idRegistro}')" style="margin-top:4px;">📝 Editar</button>
    </div>
  `;
}

// ── Dashboard ──
// ========== DASHBOARD POR CLIENTE ==========

let zonaChartCliente = null;
let agenteChartCliente = null;
let actividadesMesChart = null;

function actualizarDashboard() {
  if (!registros.length) {
    mostrarDashboardVacio();
    return;
  }
  
  // Filtrar solo registros del cliente actual (ya deberían estar filtrados)
  const total = registros.length;
  const conformes = registros.filter(esConforme).length;
  const anomalias = total - conformes;
  const pctConforme = total ? Math.round((conformes / total) * 100) : 0;
  
  // Contar anomalías por prioridad
  let urgente = 0, importante = 0, pendiente = 0;
  registros.forEach(r => {
    for (let i = 1; i <= 20; i++) {
      if (r["a" + i]) {
        const p = r["p" + i];
        if (p === "Urgente") urgente++;
        else if (p === "Importante") importante++;
        else if (p === "Pendiente") pendiente++;
      }
    }
  });
  
  // Contar críticos (extintores con al menos una anomalía urgente)
  const criticos = registros.filter(r => {
    for (let i = 1; i <= 20; i++) {
      if (r["a" + i] && r["p" + i] === "Urgente") return true;
    }
    return false;
  }).length;
  
  const observados = anomalias - criticos;
  
  // Actualizar KPIs
  document.getElementById("kpi-total-extintores").textContent = total;
  document.getElementById("kpi-conformes").textContent = conformes;
  document.getElementById("kpi-pct-conformes").textContent = `${pctConforme}%`;
  document.getElementById("kpi-anomalias").textContent = anomalias;
  document.getElementById("kpi-pct-anomalias").textContent = `${Math.round((anomalias/total)*100)}%`;
  document.getElementById("kpi-urgentes").textContent = urgente;
  
  // Estado de extintores
  document.getElementById("estado-conformes").textContent = conformes;
  document.getElementById("estado-observado").textContent = observados;
  document.getElementById("estado-critico").textContent = criticos;
  
  // Prioridades
  document.getElementById("prioridad-urgente").textContent = urgente;
  document.getElementById("prioridad-importante").textContent = importante;
  document.getElementById("prioridad-pendiente").textContent = pendiente;
  
  // Gráfico por zona de riesgo
  renderZonaClienteChart();
  
  // Gráfico por tipo de agente
  renderAgenteClienteChart();
  
  // Gráfico de actividades por mes
  renderActividadesMesChart();
  
  // Top 5 anomalías
  renderTopAnomalias();
  
  // Resumen por ubicación
  renderResumenUbicaciones();
  
  // Alertas de mantenimiento
  renderAlertasMantenimiento();
  
  // Actualizar información del cliente en el dashboard
  actualizarInfoClienteDashboard();
}

function mostrarDashboardVacio() {
  const contenedores = ["kpi-total-extintores", "kpi-conformes", "kpi-anomalias", "kpi-urgentes"];
  contenedores.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  
  const estadoContenedores = ["estado-conformes", "estado-observado", "estado-critico"];
  estadoContenedores.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  
  const prioridadContenedores = ["prioridad-urgente", "prioridad-importante", "prioridad-pendiente"];
  prioridadContenedores.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });
  
  document.getElementById("top-anomalias-lista").innerHTML = '<div style="text-align:center; padding:20px;">No hay registros para mostrar</div>';
  document.getElementById("resumen-ubicaciones").innerHTML = '<div style="text-align:center; padding:20px;">No hay ubicaciones registradas</div>';
  document.getElementById("alertas-mantenimiento").innerHTML = '<div style="text-align:center; padding:20px;">No hay alertas pendientes</div>';
}

function renderZonaClienteChart() {
  const zonas = { Alta: 0, Media: 0, Baja: 0 };
  registros.forEach(r => {
    if (zonas[r.zonaRiesgo] !== undefined) zonas[r.zonaRiesgo]++;
  });
  
  const ctx = document.getElementById("chartZonaCliente");
  if (!ctx) return;
  
  if (zonaChartCliente) zonaChartCliente.destroy();
  zonaChartCliente = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["🔥 Alta", "🟡 Media", "🟢 Baja"],
      datasets: [{
        data: [zonas.Alta, zonas.Media, zonas.Baja],
        backgroundColor: ["#dc2626", "#f59e0b", "#16a34a"],
        borderWidth: 0
      }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

function renderAgenteClienteChart() {
  const agentes = {};
  registros.forEach(r => {
    const tipo = r.tipoAgente || "Otros";
    agentes[tipo] = (agentes[tipo] || 0) + 1;
  });
  
  const ctx = document.getElementById("chartAgenteCliente");
  if (!ctx) return;
  
  if (agenteChartCliente) agenteChartCliente.destroy();
  agenteChartCliente = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(agentes),
      datasets: [{
        label: "Cantidad",
        data: Object.values(agentes),
        backgroundColor: "#3b82f6",
        borderRadius: 8
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function renderActividadesMesChart() {
  const meses = {};
  const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  registros.forEach(r => {
    if (r.fecha) {
      const mes = new Date(r.fecha).getMonth();
      meses[mes] = (meses[mes] || 0) + 1;
    }
  });
  
  const datos = nombresMeses.map((_, i) => meses[i] || 0);
  
  const ctx = document.getElementById("chartActividadesMes");
  if (!ctx) return;
  
  if (actividadesMesChart) actividadesMesChart.destroy();
  actividadesMesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: nombresMeses,
      datasets: [{
        label: "Extintores inspeccionados",
        data: datos,
        borderColor: "#1e3c72",
        backgroundColor: "rgba(30, 60, 114, 0.1)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#2a5298",
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: { responsive: true, plugins: { legend: { position: "top" } } }
  });
}

function renderTopAnomalias() {
  const anomCounts = {};
  for (let i = 1; i <= 20; i++) {
    const count = registros.filter(r => r["a" + i]).length;
    if (count > 0) {
      anomCounts[i] = count;
    }
  }
  
  const sorted = Object.entries(anomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = sorted[0]?.[1] || 1;
  
  const container = document.getElementById("top-anomalias-lista");
  if (!container) return;
  
  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">✅ Sin anomalías registradas</div>';
    return;
  }
  
  container.innerHTML = sorted.map(([anom, count], idx) => {
    const porcentaje = (count / maxCount) * 100;
    return `
      <div class="top-anomalia-item">
        <div class="top-anomalia-numero">${idx + 1}</div>
        <div class="top-anomalia-info">
          <span class="top-anomalia-nombre">A${anom} - ${detalleNC[anom]?.substring(0, 35)}</span>
          <div class="top-anomalia-barra">
            <div class="top-anomalia-barra-fill" style="width: ${porcentaje}%;"></div>
          </div>
          <span class="top-anomalia-count">${count} vez/veces</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderResumenUbicaciones() {
  const ubicaciones = {};
  registros.forEach(r => {
    const ub = r.ubicacion || "No especificada";
    if (!ubicaciones[ub]) {
      ubicaciones[ub] = { total: 0, conformes: 0 };
    }
    ubicaciones[ub].total++;
    if (esConforme(r)) ubicaciones[ub].conformes++;
  });
  
  const container = document.getElementById("resumen-ubicaciones");
  if (!container) return;
  
  if (Object.keys(ubicaciones).length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px;">No hay ubicaciones registradas</div>';
    return;
  }
  
  container.innerHTML = Object.entries(ubicaciones).map(([nombre, data]) => {
    const pct = Math.round((data.conformes / data.total) * 100);
    return `
      <div class="ubicacion-card">
        <div class="ubicacion-nombre">📍 ${nombre}</div>
        <div class="ubicacion-stats">
          <div class="ubicacion-stat">
            <div class="ubicacion-stat-num">${data.total}</div>
            <div class="ubicacion-stat-label">Total</div>
          </div>
          <div class="ubicacion-stat">
            <div class="ubicacion-stat-num" style="color:#16a34a;">${data.conformes}</div>
            <div class="ubicacion-stat-label">Conformes</div>
          </div>
          <div class="ubicacion-stat">
            <div class="ubicacion-stat-num" style="color:${pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626'};">${pct}%</div>
            <div class="ubicacion-stat-label">Eficacia</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAlertasMantenimiento() {
  const hoy = new Date();
  const unMes = new Date();
  unMes.setMonth(unMes.getMonth() + 1);
  
  const alertas = [];
  
  registros.forEach(r => {
    if (r.pruebaHidrostatica) {
      const fechaPH = new Date(r.pruebaHidrostatica);
      const diasRestantes = Math.ceil((fechaPH - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes <= 30 && diasRestantes > 0) {
        alertas.push({
          tipo: "urgente",
          icono: "⚠️",
          titulo: `Prueba hidrostática próxima`,
          detalle: `EEP ${r.numeroExtintor} - ${r.ubicacion}`,
          fecha: `Vence en ${diasRestantes} días`,
          extintor: r.numeroExtintor
        });
      }
    }
    
    if (r.fechaCarga) {
      const fechaCarga = new Date(r.fechaCarga);
      const unAnio = new Date(fechaCarga);
      unAnio.setFullYear(unAnio.getFullYear() + 1);
      
      if (unAnio <= hoy) {
        alertas.push({
          tipo: "urgente",
          icono: "🔄",
          titulo: `Recarga vencida`,
          detalle: `EEP ${r.numeroExtintor} - ${r.ubicacion}`,
          fecha: `Vencida desde ${unAnio.toLocaleDateString()}`,
          extintor: r.numeroExtintor
        });
      }
    }
  });
  
  const container = document.getElementById("alertas-mantenimiento");
  if (!container) return;
  
  if (alertas.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#16a34a;">✅ Todas las fechas de mantenimiento están al día</div>';
    return;
  }
  
  container.innerHTML = alertas.slice(0, 5).map(a => `
    <div class="alerta-item ${a.tipo}">
      <div class="alerta-icono">${a.icono}</div>
      <div class="alerta-info">
        <div class="alerta-titulo">${a.titulo}</div>
        <div class="alerta-detalle">${a.detalle}</div>
      </div>
      <div class="alerta-fecha">${a.fecha}</div>
    </div>
  `).join("");
}

function actualizarInfoClienteDashboard() {
  const datosSesion = localStorage.getItem("datosInspeccion");
  if (datosSesion) {
    const sesion = JSON.parse(datosSesion);
    document.getElementById("dashboard-cliente-nombre").innerHTML = `${sesion.cliente || "Cliente"} <span style="font-size:0.85rem; opacity:0.8;">- ${sesion.codigoSHK || "SHK"}</span>`;
    document.getElementById("dashboard-codigo").textContent = sesion.codigoSHK || "---";
    document.getElementById("dashboard-ultima-fecha").textContent = sesion.fecha || new Date().toLocaleDateString();
  }
  
  const hoy = new Date();
  document.getElementById("dashboard-fecha-actual").textContent = hoy.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
}

// ========== SEGUIMIENTO DE NO CONFORMIDADES ==========

// Estructura de seguimiento (se guarda en localStorage/Sheets)
let seguimientoNC = [];

// Cargar seguimiento guardado
function cargarSeguimiento() {
  const guardado = localStorage.getItem(`seguimiento_nc_${getClienteActual()}`);
  if (guardado) {
    seguimientoNC = JSON.parse(guardado);
  } else {
    // Inicializar seguimiento desde los registros actuales
    inicializarSeguimientoDesdeRegistros();
  }
  renderSeguimiento();
  actualizarKPISeguimiento();
}

function getClienteActual() {
  const datos = localStorage.getItem("datosInspeccion");
  if (datos) {
    const sesion = JSON.parse(datos);
    return sesion.codigoSHK || "default";
  }
  return "default";
}

function inicializarSeguimientoDesdeRegistros() {
  seguimientoNC = [];
  
  registros.forEach(registro => {
    for (let i = 1; i <= 20; i++) {
      if (registro["a" + i]) {
        seguimientoNC.push({
          id: `${registro.id}_A${i}`,
          idRegistro: registro.id,
          numeroExtintor: registro.numeroExtintor,
          codigoAnomalia: `A${i}`,
          descripcion: detalleNC[i],
          prioridad: registro["p" + i] || "Pendiente",
          ubicacion: registro.ubicacion,
          fechaInspeccion: registro.fecha,
          estado: "pendiente",
          fechaLevantamiento: null,
          responsable: null,
          accionRealizada: null,
          evidencia: null
        });
      }
    }
  });
  
  guardarSeguimiento();
}

function guardarSeguimiento() {
  localStorage.setItem(`seguimiento_nc_${getClienteActual()}`, JSON.stringify(seguimientoNC));
}

function renderSeguimiento() {
  const tbody = document.getElementById("tbody-seguimiento");
  if (!tbody) return;
  
  const filtroEstado = document.getElementById("filtro-estado-nc")?.value || "todos";
  const filtroExtintor = document.getElementById("filtro-extintor-nc")?.value.toLowerCase() || "";
  
  let filtrados = seguimientoNC;
  
  if (filtroEstado !== "todos") {
    filtrados = filtrados.filter(nc => nc.estado === filtroEstado);
  }
  if (filtroExtintor) {
    filtrados = filtrados.filter(nc => nc.numeroExtintor?.toLowerCase().includes(filtroExtintor));
  }
  
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:40px;">📭 No hay no conformidades para mostrar</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtrados.map(nc => {
    const estadoClass = {
      pendiente: "estado-pendiente",
      proceso: "estado-proceso", 
      corregida: "estado-corregida",
      verificada: "estado-verificada"
    }[nc.estado] || "estado-pendiente";
    
    const estadoTexto = {
      pendiente: "⏳ Pendiente",
      proceso: "🔄 En proceso",
      corregida: "✅ Corregida",
      verificada: "🔍 Verificada"
    }[nc.estado] || nc.estado;
    
    const prioridadClass = nc.prioridad === "Urgente" ? "badge-urgente" : 
                          (nc.prioridad === "Importante" ? "badge-importante" : "badge-pendiente");
    
    return `
      <tr>
        <td><strong>${nc.numeroExtintor || "-"}</strong></td>
        <td>${nc.codigoAnomalia}</td>
        <td>${nc.descripcion}</td>
        <td><span class="badge ${prioridadClass}">${nc.prioridad}</span></td>
        <td>${nc.ubicacion || "-"}</td>
        <td>${nc.fechaInspeccion || "-"}</td>
        <td><span class="estado-nc ${estadoClass}">${estadoTexto}</span></td>
        <td>${nc.fechaLevantamiento || "-"}</td>
        <td>${nc.responsable || "-"}</td>
        <td style="max-width:200px; white-space:normal;">${nc.accionRealizada || "-"}</td>
        <td>
          <button class="btn-levantar" onclick="abrirModalLevantar('${nc.id}')">
            ${nc.estado === 'corregida' || nc.estado === 'verificada' ? '📝 Editar' : '🔧 Levantar'}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function actualizarKPISeguimiento() {
  const total = seguimientoNC.length;
  const pendientes = seguimientoNC.filter(nc => nc.estado === "pendiente").length;
  const proceso = seguimientoNC.filter(nc => nc.estado === "proceso").length;
  const corregidas = seguimientoNC.filter(nc => nc.estado === "corregida").length;
  const verificadas = seguimientoNC.filter(nc => nc.estado === "verificada").length;
  
  document.getElementById("seguimiento-total-nc").textContent = total;
  document.getElementById("seguimiento-pendientes").textContent = pendientes;
  document.getElementById("seguimiento-proceso").textContent = proceso;
  document.getElementById("seguimiento-corregidas").textContent = corregidas;
  document.getElementById("seguimiento-verificadas").textContent = verificadas;
}

let ncActual = null;

function abrirModalLevantar(id) {
  ncActual = seguimientoNC.find(nc => nc.id === id);
  if (!ncActual) return;
  
  document.getElementById("modal-info-nc").innerHTML = `
    <strong>EEP: ${ncActual.numeroExtintor}</strong><br>
    <strong>Anomalía:</strong> ${ncActual.codigoAnomalia} - ${ncActual.descripcion}<br>
    <strong>Prioridad:</strong> <span class="badge ${ncActual.prioridad === 'Urgente' ? 'badge-urgente' : (ncActual.prioridad === 'Importante' ? 'badge-importante' : 'badge-pendiente')}">${ncActual.prioridad}</span><br>
    <strong>Ubicación:</strong> ${ncActual.ubicacion || "-"}
  `;
  
  document.getElementById("modal-estado-nc").value = ncActual.estado;
  document.getElementById("modal-fecha-levantamiento").value = ncActual.fechaLevantamiento || new Date().toISOString().split("T")[0];
  document.getElementById("modal-responsable").value = ncActual.responsable || "";
  document.getElementById("modal-accion-realizada").value = ncActual.accionRealizada || "";
  document.getElementById("modal-evidencia").value = "";
  
  document.getElementById("modal-levantar-nc").style.display = "flex";
}

function cerrarModalLevantar() {
  document.getElementById("modal-levantar-nc").style.display = "none";
  ncActual = null;
}

async function guardarLevantamientoNC() {
  if (!ncActual) return;
  
  const nuevoEstado = document.getElementById("modal-estado-nc").value;
  const fechaLev = document.getElementById("modal-fecha-levantamiento").value;
  const responsable = document.getElementById("modal-responsable").value;
  const accion = document.getElementById("modal-accion-realizada").value;
  const evidenciaFile = document.getElementById("modal-evidencia").files[0];
  
  // Validar campos requeridos según estado
  if (nuevoEstado !== "pendiente" && !responsable) {
    notif("⚠️ Debe ingresar el responsable del levantamiento", "warn");
    return;
  }
  
  if ((nuevoEstado === "corregida" || nuevoEstado === "verificada") && !accion) {
    notif("⚠️ Debe describir la acción correctiva realizada", "warn");
    return;
  }
  
  ncActual.estado = nuevoEstado;
  ncActual.fechaLevantamiento = fechaLev;
  ncActual.responsable = responsable;
  ncActual.accionRealizada = accion;
  
  // Procesar evidencia si existe
  if (evidenciaFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
      ncActual.evidencia = e.target.result;
      finalizarGuardado();
    };
    reader.readAsDataURL(evidenciaFile);
  } else {
    finalizarGuardado();
  }
  
  function finalizarGuardado() {
    guardarSeguimiento();
    renderSeguimiento();
    actualizarKPISeguimiento();
    cerrarModalLevantar();
    notif(`✅ NC ${ncActual.codigoAnomalia} actualizada a ${getEstadoTexto(nuevoEstado)}`, "success");
    
    // Registrar en trazabilidad
    if (typeof registrarTrazabilidad !== 'undefined') {
      registrarTrazabilidad(
        document.getElementById("banner-inspector")?.textContent || "usuario",
        "tecnico",
        `Levantamiento NC ${ncActual.codigoAnomalia} - ${getEstadoTexto(nuevoEstado)} - EEP ${ncActual.numeroExtintor}`
      );
    }
  }
}

function getEstadoTexto(estado) {
  const textos = {
    pendiente: "Pendiente",
    proceso: "En proceso",
    corregida: "Corregida",
    verificada: "Verificada"
  };
  return textos[estado] || estado;
}

function filtrarSeguimiento() {
  renderSeguimiento();
}

function exportarSeguimientoExcel() {
  if (seguimientoNC.length === 0) {
    notif("No hay datos para exportar", "warn");
    return;
  }
  
  const encabezados = ["EEP", "Código", "Anomalía", "Prioridad", "Ubicación", "Fecha Inspección", "Estado", "Fecha Levantamiento", "Responsable", "Acción Realizada"];
  
  const filas = seguimientoNC.map(nc => [
    nc.numeroExtintor,
    nc.codigoAnomalia,
    nc.descripcion,
    nc.prioridad,
    nc.ubicacion,
    nc.fechaInspeccion,
    getEstadoTexto(nc.estado),
    nc.fechaLevantamiento || "",
    nc.responsable || "",
    nc.accionRealizada || ""
  ]);
  
  const csvContent = [encabezados, ...filas].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Seguimiento_NC_${getClienteActual()}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notif("✅ Exportado correctamente", "success");
}

// Modificar la función switchTab para incluir seguimiento
// Reemplazar la función switchTab existente
async function switchTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  btn.classList.add("active");
  
  if (tab === "dashboard") actualizarDashboard();
  if (tab === "informe") await actualizarInforme();
  if (tab === "seguimiento") {
    cargarSeguimiento();
  }
}

// Modificar init() para cargar seguimiento
// Agregar al final de init():
async function init() {
  if (!cargarDatosSesion()) return;
  await cargarInspeccionActual();
  agregarAnomalia();
  await sincronizarDesdeSheets();
  cargarSeguimiento(); // <-- Agregar esta línea
}

async function logoABase64(ruta) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = ruta + "?t=" + Date.now(); // evita caché
  });
}

// ── Informe ──
async function actualizarInforme() {
    let codigoSHK = document.getElementById("codigoSHK").value || "-";
    let cliente = document.getElementById("cliente").value || "-";
    let sede = document.getElementById("Sede").value || "-";
    let fechaInspeccion = document.getElementById("fechaInspeccion").value || new Date().toLocaleDateString();
    let rutaLogoCompleta;

    if ((cliente === "-" || cliente === "") && registros.length > 0) {
      const primerRegistro = registros[0];
      if (primerRegistro.codigoSHK && CLIENTES_MAP[primerRegistro.codigoSHK]) {
        codigoSHK = primerRegistro.codigoSHK;
        cliente = CLIENTES_MAP[primerRegistro.codigoSHK];
      }
    }

    const clienteConfig = CLIENT_CONFIG[codigoSHK] || CLIENT_CONFIG["default"];
    const inspector = JSON.parse(localStorage.getItem("datosInspeccion"))?.nombre || "No especificado";
    const total = registros.length;
    const conformes = registros.filter(esConforme).length;
    const observados = total - conformes;

    if (registros.length === 0) {
      document.getElementById("contenidoInforme").innerHTML = `
        <div class="a4-sheet" style="padding:20mm;text-align:center;">
          <h3>No hay registros de inspección</h3>
          <p>Agregue registros en la pestaña "Inspección" para generar un informe.</p>
        </div>
      `;
      return;
    }
  // Detectar si estamos en GitHub Pages
  const esGitHubPages = window.location.hostname.includes('github.io');
  const rutaLogo = esGitHubPages 
      ? '/inspecci-n-extintores/assets/clientes/100/Siviack_logo.png'
      : 'assets/clientes/100/Siviack_logo.png';
  const logoBase64 = await logoABase64(rutaLogo);
    // ── Encabezado institucional (se repite en cada hoja) ──


      // ── Función para generar tabla de cada registro ──
    function tablaRegistro(r, numRegistro) {
      const conforme = esConforme(r);
      const xConforme = conforme ? "X" : "";
      const xNoConforme = conforme ? "" : "X";

      function formatearFecha(f) {
        if (!f) return "-";
        const s = String(f);
        if (s.includes("T")) return s.split("T")[0];
        return s;
      }

      return `
        <div class="bloque-inspeccion">

          <h3>Inspección N° ${numRegistro}</h3>


          <!-- TABLA 2: Datos del extintor (con pequeño espacio arriba) -->
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;margin-bottom:20px;table-layout:fixed;">
            <tr style="background:#d9d9d9;">
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                Fecha de Inspección
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                N° de EEP
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                Tipo de Agente
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                Cap.
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                Fecha Carga
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:16.67%;">
                Fecha PH
              </td>
            </tr>

            <tr>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${formatearFecha(r.fecha)}
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${r.numeroExtintor || "-"}
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${r.tipoAgente || "-"}
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${r.capacidad || "-"}
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${formatearFecha(r.fechaCarga)}
              </td>
              <td style="border:1px solid #000;padding:5px;text-align:center;width:16.67%;">
                ${formatearFecha(r.pruebaHidrostatica)}
              </td>
            </tr>
            
            <tr style="background:#d9d9d9;">
              <td colspan="3"
                  style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:50%;">
                  Ubicación
              </td>

              <td colspan="3"
                  style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;width:50%;">
                  Referencia
              </td>
            </tr>

            <tr>
              <td colspan="3"
                  style="border:1px solid #000;padding:5px;width:50%;">
                  ${r.ubicacion || "-"}
              </td>

              <td colspan="3"
                  style="border:1px solid #000;padding:5px;width:50%;">
                  ${r.referencia || "-"}
              </td>
            </tr>
            <tr style="background:#d9d9d9;">
              <td colspan="2"
                  style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">
                  Anomalías / NC
              </td>

              <td colspan="1"
                  style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">
                  Prioridad
              </td>

              <td colspan="3"
                  style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">
                  Observaciones
              </td>
            </tr>

            <tr>
              <td colspan="2"
                  style="border:1px solid #000;padding:5px;vertical-align:top;text-align:left;">
                  ${obtenerDescripcionNC(r, true)}
              </td>

              <td colspan="1"
                  style="border:1px solid #000;padding:5px;vertical-align:top;">
                  ${obtenerPrioridades(r) || "-"}
              </td>

              <td colspan="3" style="border:1px solid #000;padding:5px;vertical-align:top;text-align:left;">
                
                ${formatearObservaciones(r.observaciones)}

                <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                  ${(r.imagenes || []).map(img =>
                    `<img src="${img}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">`
                  ).join("")}
                </div>

              </td>
            </tr>

          </table>


          <!-- TABLA 1: Resultado conforme/no conforme -->
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <tr>
              <td rowspan="2" style="border:1px solid #000;padding:6px;width:22%;vertical-align:middle;font-weight:bold;">
                Resultados de la Inspección
              </td>
              <td colspan="2" style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;">
                Conforme
              </td>
              <td colspan="2" style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;">
                No Conforme
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border:1px solid #000;padding:6px;text-align:center;font-size:14px;font-weight:bold;">
                ${xConforme}
              </td>
              <td colspan="2" style="border:1px solid #000;padding:6px;text-align:center;font-size:14px;font-weight:bold;">
                ${xNoConforme}
              </td>
            </tr>
          </table>


        </div>
      `;
    }

    // ── Armar páginas ──
    const registrosPorPagina = 3;
    const numeroPaginas = Math.ceil(registros.length / registrosPorPagina);
    let informeHTML = "";

   
  for (let pagina = 0; pagina < numeroPaginas; pagina++) {
      const encabezadoHTML = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">

      <tr>
          <td rowspan="3" style="border:1px solid #000;width:180px;padding:0;vertical-align:middle;">
            ${logoBase64 ? `
              <img src="${logoBase64}"
                  style="width:100%;height:100%;object-fit:contain;display:block;">
            ` : ""}
          </td>
          <td colspan="4" style="border:1px solid #000; padding:0; height:70px; position:relative;">
            
            <div style="position:absolute; top:5px; left:5px; font-size:12px;">
              ESTANDAR:
            </div>

            <div style="height:70px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:15px;">
              Informe de Equipos de Extintores Portátiles
            </div>

          </td>
              <td rowspan="3" style="width:180px;padding:0;vertical-align:top;border:1px solid #000;background:#fff;">
              <table style="width:100%;height:100%;border-collapse:collapse;border-spacing:0;margin:0;background:#fff;">
              <tr>
                <td colspan="2" style="border-bottom:1.5px solid #000;text-align:center;padding:4px;box-sizing:border-box;">
                  SISTEMAS VITALES DE GESTIÓN 
                </td>
              </tr>

              <tr>
                <td colspan="2" style="border-bottom:1.5px solid #000;text-align:center;padding:4px;box-sizing:border-box;">
                  <strong>Cód.:</strong> IN-SG-SST-SVG-DG-02
                </td>
              </tr>

              <tr>
                <td style="border-right:1px solid #000;border-bottom:1px solid #000;text-align:center;padding:4px;box-sizing:border-box;">
                  <strong>Versión:</strong> 01
                </td>
                <td style="border-bottom:1px solid #000;text-align:center;padding:4px;box-sizing:border-box;">
                  <strong>Revisión:</strong> 01
                </td>
              </tr>

              <tr>
                <td style="border-right:1px solid #000;text-align:center;padding:4px;box-sizing:border-box;">
                 <strong>A:</strong> ${fechaInspeccion}
                </td>
                <td style="text-align:center;padding:4px;box-sizing:border-box;">
                  Pág. ${pagina + 1} / ${numeroPaginas}
                </td>
              </tr>

            </table>

          </td>
        </tr>



      </table>
    `;


      const inicio = pagina * registrosPorPagina;
      const registrosPagina = registros.slice(inicio, inicio + registrosPorPagina);

      const resumenHTML = pagina === 0 ? `
        <div style="margin-bottom:16px;">
          <h3 style="color:#1e3c72;margin-bottom:8px;">Resumen ejecutivo</h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #000000;padding:6px;text-align:left;color:#000000;">Total inspeccionados</th>
              <td style="border:1px solid #000000;padding:6px;"><strong>${total}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #000000;padding:6px;text-align:left;color:#000000;">Conformes</th>
              <td style="border:1px solid #000000;padding:6px;"><strong style="color:green;">${conformes}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #000000;padding:6px;text-align:left;color:#000000;">Con anomalías</th>
              <td style="border:1px solid #000000;padding:6px;"><strong style="color:#d97706;">${observados}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #000000;padding:6px;text-align:left;color:#000000;">% Conformidad</th>
              <td style="border:1px solid #000000;padding:6px;"><strong>${total > 0 ? Math.round((conformes/total)*100) : 0}%</strong></td>
            </tr>
          </table>
        </div>
      ` : "";

      informeHTML += `
        <div class="a4-sheet" style="padding:10mm;">
          ${encabezadoHTML}
          <div style="margin-bottom:12px;font-size:11px;">
            <strong>Cliente:</strong> ${cliente} &nbsp;|&nbsp;
            <strong>Sede:</strong> ${sede} &nbsp;|&nbsp;
          </div>
          ${resumenHTML}
          ${registrosPagina.map((r, idx) => tablaRegistro(r, inicio + idx + 1)).join("")}
          <div style="margin-top:20px;border-top:1px solid #ccc;padding-top:6px;text-align:center;font-size:9px;color:#666;">
            Documento Controlado | SVG/SG-SST/SDB &nbsp;|&nbsp; Pág. ${pagina + 1} / ${numeroPaginas}
          </div>
        </div>
      `;
  }
    document.getElementById("contenidoInforme").innerHTML = informeHTML;
}
// ── Exportar Excel ──
function exportarExcel() {
  if (!registros.length) { alert("No hay registros para exportar."); return; }
  const cliente = document.getElementById("cliente").value || "";
  const sede = document.getElementById("Sede").value || "";
  const codigoSHK = document.getElementById("codigoSHK").value || "";
  const encabezados = [
    "N°","Código SHK","Cliente","Sede/Proceso","Fecha","N° de EEP","Tipo de Agente",
    "Capacidad","Ubicación","Referencia","Zona Riesgo","Fecha Carga","Prueba Hidrostática",
    ...Array.from({ length: 20 }, (_, i) => `A${i + 1}`),
    "Detalles NC","Prioridades","Observaciones"
  ];
  const filas = registros.map((r, i) => {
    const anomalias = Array.from({ length: 20 }, (_, j) => r["a" + (j + 1)] ? "✖" : "✔");
    return [
      i + 1, codigoSHK, cliente, sede, r.fecha, r.numeroExtintor, r.tipoAgente, r.capacidad,
      r.ubicacion, r.referencia || "", r.zonaRiesgo, r.fechaCarga, r.pruebaHidrostatica,
      ...anomalias,
      obtenerDetallesNC(r) || "Sin NC",
      obtenerPrioridadesTexto(r) || "-",
      r.observaciones
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });
  const csvContent = [encabezados, ...filas].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Inspeccion_Extintores_${codigoSHK || "SHK"}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function descargarPDF() {
  const cliente = document.getElementById("cliente").value || "Cliente";
  const hojas = document.querySelectorAll("#contenidoInforme .a4-sheet");

  if (!hojas.length) {
    alert("No hay contenido para exportar.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const A4_W = 210;
  const A4_H = 297;

  for (let i = 0; i < hojas.length; i++) {
    const hoja = hojas[i];

    // Guardar estilos originales
    const prevMargin = hoja.style.margin;
    const prevBoxShadow = hoja.style.boxShadow;
    const prevOverflow = hoja.style.overflow;
    const prevBackground = hoja.style.background;
    
    // Forzar estilos para la captura
    hoja.style.margin = "0";
    hoja.style.boxShadow = "none";
    hoja.style.overflow = "hidden";
    hoja.style.background = "white";
    hoja.style.backgroundColor = "white";

    // Esperar a que se rendericen las imágenes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Crear canvas con configuración mejorada
    const canvas = await html2canvas(hoja, {
      scale: 3,  // Mayor calidad
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",  // Forzar fondo blanco
      logging: false,
      width: 794,
      windowWidth: 794,
      onclone: (clonedDoc, element) => {
        // Forzar fondo blanco en el clon
        const sheets = clonedDoc.querySelectorAll('.a4-sheet');
        sheets.forEach(sheet => {
          sheet.style.backgroundColor = '#ffffff';
          sheet.style.background = 'white';
        });
      }
    });

    // Restaurar estilos originales
    hoja.style.margin = prevMargin;
    hoja.style.boxShadow = prevBoxShadow;
    hoja.style.overflow = prevOverflow;
    hoja.style.background = prevBackground;

    // Verificar si el canvas salió correcto
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    
    // Verificar si la imagen está en blanco/negro
    if (imgData === canvas.toDataURL("image/jpeg", 0.98)) {
      console.log("Canvas generado correctamente");
    }

    const canvasRatio = canvas.height / canvas.width;
    const imgH = A4_W * canvasRatio;

    if (i > 0) pdf.addPage();

    // Forzar que la imagen se añada correctamente
    pdf.addImage(imgData, "JPEG", 0, 0, A4_W, Math.min(imgH, A4_H), undefined, 'FAST');
  }

  pdf.save(`Informe_${cliente}.pdf`);
}

// Variables globales
let inspeccionActual = null;
let inspeccionFinalizada = false;

// Al iniciar, cargar o crear inspección actual
async function init() {
  if (!cargarDatosSesion()) return;
  
  // Verificar si ya existe una inspección en progreso para este cliente+fecha
  await cargarInspeccionActual();
  
  agregarAnomalia();
  await sincronizarDesdeSheets();
  cargarSeguimientoRegistros(); 
}

async function cargarInspeccionActual() {
  const sesion = JSON.parse(localStorage.getItem("datosInspeccion"));
  if (!sesion) return;
  
  const inspecciones = await sheetsObtenerInspecciones();
  const idInspeccion = generarIdInspeccion(sesion);
  
  const existente = inspecciones.find(i => i.id === idInspeccion && i.estado === "en_progreso");
  
  if (existente) {
    inspeccionActual = existente;
    registros = existente.registros || [];
    renderTabla();
    actualizarDashboard();
    mostrarNotificacion("Inspección en progreso cargada", "info");
  } else {
    // Crear nueva inspección
    inspeccionActual = {
      id: idInspeccion,
      ...sesion,
      estado: "en_progreso",
      registros: [],
      fechaCreacion: new Date().toISOString(),
      fechaModificacion: new Date().toISOString()
    };
  }
  inspeccionFinalizada = false;
}

function generarIdInspeccion(sesion) {
  const fecha = sesion.fecha.replace(/-/g, "");
  const timestamp = Date.now();
  return `INS-${sesion.codigoSHK}-${fecha}-${timestamp}`;
}

// Finalizar inspección
async function finalizarInspeccion() {
  if (inspeccionFinalizada) {
    alert("⚠️ Esta inspección ya fue finalizada.");
    return;
  }
  
  if (registros.length === 0) {
    alert("❌ No hay registros para finalizar la inspección.");
    return;
  }
  
  const confirmar = confirm(`¿Finalizar inspección de ${inspeccionActual.cliente} - ${inspeccionActual.sede}?\n\nSe guardarán ${registros.length} registros y no se podrán modificar después.`);
  
  if (!confirmar) return;
  
  inspeccionActual.estado = "completada";
  inspeccionActual.registros = [...registros];
  inspeccionActual.fechaModificacion = new Date().toISOString();
  inspeccionActual.totalRegistros = registros.length;
  inspeccionActual.totalConformes = registros.filter(esConforme).length;
  
  await sheetsGuardarInspeccion(inspeccionActual);
  
  inspeccionFinalizada = true;
  
  // Bloquear edición
  bloquearEdicion(true);
  
  mostrarNotificacion(`✅ Inspección finalizada guardada con ID: ${inspeccionActual.id}`, "success");
  
  // Registrar en trazabilidad (si existe la función)
  if (typeof registrarTrazabilidad !== 'undefined') {
    registrarTrazabilidad(
      sesionActual?.usuario || "tecnico",
      sesionActual?.rol || "tecnico",
      `Finalizó inspección ${inspeccionActual.id} - ${registros.length} registros`
    );
  }
}

function bloquearEdicion(bloquear) {
  const botones = document.querySelectorAll(".action:not(.btn-volver):not(.btn-salir)");
  botones.forEach(btn => {
    if (bloquear) btn.disabled = true;
    else btn.disabled = false;
  });
  
  const inputs = document.querySelectorAll(".field input, .field select, .field textarea");
  inputs.forEach(input => {
    if (bloquear) input.readOnly = true;
    else input.readOnly = false;
  });
  
  document.getElementById("anomaliasGrid").style.pointerEvents = bloquear ? "none" : "auto";
}

// ========== SEGUIMIENTO DE INSPECCIONES ==========

// Estructura de seguimiento por registro
let seguimientoRegistros = {};

function cargarSeguimientoRegistros() {
  const clienteId = getClienteActual();
  const guardado = localStorage.getItem(`seguimiento_inspeccion_${clienteId}`);
  if (guardado) {
    seguimientoRegistros = JSON.parse(guardado);
  } else {
    seguimientoRegistros = {};
  }
}

function guardarSeguimientoRegistros() {
  const clienteId = getClienteActual();
  localStorage.setItem(`seguimiento_inspeccion_${clienteId}`, JSON.stringify(seguimientoRegistros));
}

function obtenerSeguimientoRegistro(idRegistro) {
  return seguimientoRegistros[idRegistro] || null;
}

function iniciarSeguimiento(idRegistro) {
  const registro = registros.find(r => r.id === idRegistro);
  if (!registro) return;
  
  // Verificar si el registro tiene anomalías
  let tieneAnomalias = false;
  for (let i = 1; i <= 20; i++) {
    if (registro["a" + i]) {
      tieneAnomalias = true;
      break;
    }
  }
  
  if (!tieneAnomalias) {
    notif("✅ Este equipo no tiene anomalías para levantar", "info");
    return;
  }
  
  seguimientoRegistros[idRegistro] = {
    idRegistro: idRegistro,
    estado: "proceso",
    fechaInicio: new Date().toISOString(),
    fechaLevantamiento: null,
    responsable: "",
    observaciones: "",
    anomaliasLevantadas: [],
    imagenes: []
  };
  
  guardarSeguimientoRegistros();
  renderTabla();
  abrirModalSeguimiento(idRegistro);
}

function editarSeguimiento(idRegistro) {
  abrirModalSeguimiento(idRegistro);
}

function abrirModalSeguimiento(idRegistro) {
  const registro = registros.find(r => r.id === idRegistro);
  const seguimiento = seguimientoRegistros[idRegistro] || {
    idRegistro: idRegistro,
    estado: "pendiente",
    fechaInicio: null,
    fechaLevantamiento: null,
    responsable: "",
    observaciones: "",
    anomaliasLevantadas: [],
    imagenes: []
  };
  
  // Crear modal si no existe
  let modal = document.getElementById("modal-seguimiento");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-seguimiento";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  
  // Generar lista de anomalías del registro
  const anomaliasLista = [];
  for (let i = 1; i <= 20; i++) {
    if (registro["a" + i]) {
      const levantada = seguimiento.anomaliasLevantadas?.includes(i) || false;
      anomaliasLista.push(`
        <div class="anomalia-seguimiento-item">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" class="anomalia-check" data-anomalia="${i}" ${levantada ? "checked" : ""}>
            <strong>A${i}</strong> - ${detalleNC[i]}
            <span class="prioridad-badge ${registro["p" + i] === "Urgente" ? "urgente" : (registro["p" + i] === "Importante" ? "importante" : "pendiente")}">
              ${registro["p" + i] || "Pendiente"}
            </span>
          </label>
        </div>
      `);
    }
  }
  
  modal.innerHTML = `
    <div class="modal-contenido" style="max-width: 600px;">
      <div class="modal-header" style="background:#1e3c72;">
        <h3>📋 Seguimiento de Inspección</h3>
        <button class="modal-cerrar" onclick="cerrarModalSeguimiento()">&times;</button>
      </div>
      <div class="modal-cuerpo">
        <div class="info-registro" style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px;">
          <p><strong>EEP:</strong> ${registro.numeroExtintor}</p>
          <p><strong>Ubicación:</strong> ${registro.ubicacion}</p>
          <p><strong>Tipo:</strong> ${registro.tipoAgente} | <strong>Capacidad:</strong> ${registro.capacidad}</p>
        </div>
        
        <div class="campo-form">
          <label>Estado del seguimiento:</label>
          <select id="modal-seguimiento-estado">
            <option value="pendiente" ${seguimiento.estado === "pendiente" ? "selected" : ""}>⏳ Pendiente - No iniciado</option>
            <option value="proceso" ${seguimiento.estado === "proceso" ? "selected" : ""}>🔄 En proceso - Trabajando en corrección</option>
            <option value="levantado" ${seguimiento.estado === "levantado" ? "selected" : ""}>✅ Levantado - Corregido y verificado</option>
            <option value="verificado" ${seguimiento.estado === "verificado" ? "selected" : ""}>🔍 Verificado - Validado por supervisor</option>
          </select>
        </div>
        
        <div class="campo-form">
          <label>Responsable del levantamiento:</label>
          <input type="text" id="modal-seguimiento-responsable" value="${seguimiento.responsable || ""}" placeholder="Nombre del responsable">
        </div>
        
        <div class="campo-form">
          <label>Fecha de levantamiento:</label>
          <input type="date" id="modal-seguimiento-fecha" value="${seguimiento.fechaLevantamiento || new Date().toISOString().split("T")[0]}">
        </div>
        
        <div class="campo-form">
          <label>Anomalías levantadas (marque las corregidas):</label>
          <div class="anomalias-seguimiento-lista">
            ${anomaliasLista.join("")}
          </div>
        </div>
        
        <div class="campo-form">
          <label>Observaciones / Acción correctiva:</label>
          <textarea id="modal-seguimiento-obs" rows="3" placeholder="Describa las acciones realizadas...">${seguimiento.observaciones || ""}</textarea>
        </div>
        
        <div class="campo-form">
          <label>Evidencia (foto):</label>
          <input type="file" id="modal-seguimiento-evidencia" accept="image/*">
          ${seguimiento.imagenes && seguimiento.imagenes.length ? '<div class="evidencia-preview"><img src="' + seguimiento.imagenes[0] + '" style="width:80px; margin-top:8px; border-radius:8px;"></div>' : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="action secondary" onclick="cerrarModalSeguimiento()">Cancelar</button>
        <button class="action success" onclick="guardarSeguimientoRegistro('${idRegistro}')">💾 Guardar seguimiento</button>
      </div>
    </div>
  `;
  
  modal.style.display = "flex";
}

function cerrarModalSeguimiento() {
  const modal = document.getElementById("modal-seguimiento");
  if (modal) modal.style.display = "none";
}

async function guardarSeguimientoRegistro(idRegistro) {
  const registro = registros.find(r => r.id === idRegistro);
  if (!registro) return;
  
  const nuevoEstado = document.getElementById("modal-seguimiento-estado").value;
  const responsable = document.getElementById("modal-seguimiento-responsable").value;
  const fecha = document.getElementById("modal-seguimiento-fecha").value;
  const observaciones = document.getElementById("modal-seguimiento-obs").value;
  
  // Recoger anomalías levantadas
  const anomaliasLevantadas = [];
  document.querySelectorAll(".anomalia-check").forEach(check => {
    if (check.checked) {
      anomaliasLevantadas.push(parseInt(check.dataset.anomalia));
    }
  });
  
  // Validar que si está levantado/verificado, se haya marcado al menos una anomalía
  if ((nuevoEstado === "levantado" || nuevoEstado === "verificado") && anomaliasLevantadas.length === 0) {
    notif("⚠️ Debe marcar al menos una anomalía como levantada", "warn");
    return;
  }
  
  if ((nuevoEstado === "levantado" || nuevoEstado === "verificado") && !responsable) {
    notif("⚠️ Debe ingresar el responsable", "warn");
    return;
  }
  
  let imagenes = [];
  const evidenciaFile = document.getElementById("modal-seguimiento-evidencia").files[0];
  if (evidenciaFile) {
    imagenes = await filesToDataUrls([evidenciaFile]);
  } else if (seguimientoRegistros[idRegistro]?.imagenes) {
    imagenes = seguimientoRegistros[idRegistro].imagenes;
  }
  
  seguimientoRegistros[idRegistro] = {
    idRegistro: idRegistro,
    estado: nuevoEstado,
    fechaInicio: seguimientoRegistros[idRegistro]?.fechaInicio || new Date().toISOString(),
    fechaLevantamiento: fecha,
    responsable: responsable,
    observaciones: observaciones,
    anomaliasLevantadas: anomaliasLevantadas,
    imagenes: imagenes
  };
  
  guardarSeguimientoRegistros();
  cerrarModalSeguimiento();
  renderTabla();
  
  notif(`✅ Seguimiento guardado - ${getEstadoSeguimientoTexto(nuevoEstado)}`, "success");
  
  // Registrar en trazabilidad
  registrarTrazabilidadSeguimiento(registro, nuevoEstado, anomaliasLevantadas);
}

function getEstadoSeguimientoTexto(estado) {
  const textos = {
    pendiente: "Pendiente",
    proceso: "En proceso",
    levantado: "Levantado",
    verificado: "Verificado"
  };
  return textos[estado] || estado;
}

function registrarTrazabilidadSeguimiento(registro, estado, anomaliasLevantadas) {
  // Verificar si existe la función global
  if (typeof window.parent.registrarTrazabilidad === 'function') {
    window.parent.registrarTrazabilidad(
      document.getElementById("banner-inspector")?.textContent || "tecnico",
      "tecnico",
      `Seguimiento - EEP ${registro.numeroExtintor} - ${getEstadoSeguimientoTexto(estado)} - Anomalías levantadas: ${anomaliasLevantadas.map(a => `A${a}`).join(", ")}`
    );
  }
}

function toggleAnomaliaSeguimiento(idRegistro, anomaliaNum) {
  // Esta función permite marcar/desmarcar anomalías directamente desde la tabla
  let seguimiento = seguimientoRegistros[idRegistro];
  if (!seguimiento) {
    // Iniciar seguimiento automáticamente
    iniciarSeguimiento(idRegistro);
    seguimiento = seguimientoRegistros[idRegistro];
    if (!seguimiento) return;
  }
  
  if (!seguimiento.anomaliasLevantadas) seguimiento.anomaliasLevantadas = [];
  
  const index = seguimiento.anomaliasLevantadas.indexOf(anomaliaNum);
  if (index === -1) {
    seguimiento.anomaliasLevantadas.push(anomaliaNum);
    notif(`✅ Anomalía A${anomaliaNum} marcada como levantada`, "success");
  } else {
    seguimiento.anomaliasLevantadas.splice(index, 1);
    notif(`⚠️ Anomalía A${anomaliaNum} desmarcada`, "warn");
  }
  
  guardarSeguimientoRegistros();
  renderTabla();
}

// Ver inspecciones históricas
async function verInspeccionesHistoricas() {
  const inspecciones = await sheetsObtenerInspecciones();
  const completadas = inspecciones.filter(i => i.estado === "completada");
  
  const container = document.getElementById("lista-inspecciones");
  const modal = document.getElementById("modal-historial");
  
  if (completadas.length === 0) {
    container.innerHTML = "<p style='text-align:center; padding:40px;'>📭 No hay inspecciones finalizadas</p>";
  } else {
    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#1e3c72; color:white;">
            <th style="padding:10px;">ID</th>
            <th>Cliente</th>
            <th>Sede</th>
            <th>Fecha</th>
            <th>Registros</th>
            <th>Conformidad</th>
            <th>Inspector</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${completadas.map(ins => `
            <tr style="border-bottom:1px solid #ddd;">
              <td style="padding:8px;"><small>${ins.id}</small></td>
              <td>${ins.cliente}</td>
              <td>${ins.sede}</td>
              <td>${ins.fecha}</td>
              <td>${ins.totalRegistros}</td>
              <td>${Math.round((ins.totalConformes/ins.totalRegistros)*100)}%</td>
              <td>${ins.nombre}</td>
              <td>
                <button onclick="verDetalleInspeccion('${ins.id}')" style="background:#3b82f6; color:white; border:none; border-radius:6px; padding:5px 10px; cursor:pointer;">👁️ Ver</button>
                <button onclick="exportarInspeccionPDF('${ins.id}')" style="background:#dc2626; color:white; border:none; border-radius:6px; padding:5px 10px; cursor:pointer;">📄 PDF</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
  
  modal.style.display = "flex";
}

function cerrarModalHistorial() {
  document.getElementById("modal-historial").style.display = "none";
}

async function verDetalleInspeccion(id) {
  const inspecciones = await sheetsObtenerInspecciones();
  const inspeccion = inspecciones.find(i => i.id === id);
  
  if (!inspeccion) return;
  
  // Mostrar los registros en un modal o cargarlos temporalmente
  const registrosTemp = inspeccion.registros;
  
  // Opcional: abrir un modal con los detalles
  alert(`Inspección ${id}\nRegistros: ${registrosTemp.length}\nConformes: ${inspeccion.totalConformes}`);
  
  // O podrías cargarlos en la tabla principal para visualización
  // (pero sin permitir edición)
}

async function exportarInspeccionPDF(id) {
  const inspecciones = await sheetsObtenerInspecciones();
  const inspeccion = inspecciones.find(i => i.id === id);
  
  if (!inspeccion) return;
  
  // Guardar temporalmente los registros y generar PDF
  const registrosOriginales = [...registros];
  registros = [...inspeccion.registros];
  await actualizarInforme();
  await descargarPDF();
  registros = registrosOriginales;
  await actualizarInforme();
}

function mostrarNotificacion(msg, tipo) {
  // Usar tu sistema de notificaciones existente o crear uno
  if (typeof notif === 'function') {
    notif(msg, tipo);
  } else {
    alert(msg);
  }
}

function volverAClientes() {
  // Preguntar si hay registros sin finalizar
  if (!inspeccionFinalizada && registros.length > 0) {
    const confirmar = confirm("⚠️ Hay " + registros.length + " registro(s) sin finalizar.\n\n¿Deseas guardar la inspección antes de volver?");
    if (confirmar) {
      finalizarInspeccionConRetorno();
      return;
    }
  }
  
  // Limpiar datos de inspección actual
  localStorage.removeItem('datosInspeccion');
  
  // Redirigir al login mostrando clientes
  window.location.href = "login_sistema_inspecciones.html?mostrar=clientes";
}

async function finalizarInspeccionConRetorno() {
  if (registros.length === 0) {
    volverDirecto();
    return;
  }
  
  inspeccionActual.estado = "completada";
  inspeccionActual.registros = [...registros];
  inspeccionActual.fechaModificacion = new Date().toISOString();
  inspeccionActual.totalRegistros = registros.length;
  inspeccionActual.totalConformes = registros.filter(esConforme).length;
  
  await sheetsGuardarInspeccion(inspeccionActual);
  inspeccionFinalizada = true;
  
  mostrarNotificacion("✅ Inspección guardada correctamente", "success");
  
  setTimeout(() => {
    window.location.href = "login_sistema_inspecciones.html?mostrar=clientes";
  }, 1000);
}

function volverDirecto() {
  window.location.href = "login_sistema_inspecciones.html?mostrar=clientes";
}

// ── Arrancar ──
init();