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
  const hoy = new Date();
  document.getElementById("fechaInspeccion").value = hoy.toISOString().split("T")[0];
  agregarAnomalia();
  await sincronizarDesdeSheets();
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
      <label>Anomalía / NC</label>
      <select class="codigo">
        <option value="">Seleccione</option>
        ${Object.entries(detalleNC).map(([key, val]) =>
          `<option value="${key}">${key} - ${val}</option>`
        ).join("")}
      </select>
    </div>
    <div>
      <label>Nivel de prioridad</label>
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

// ── GUARDAR ──
async function guardarRegistro() {

  const reg = await getFormulario();
  if (!reg) return;

    // 🔍 LOG A: ¿las imágenes llegan desde el formulario?
  console.log("=== LOG A: imagenes en el formulario ===");
  console.log("cantidad:", reg.imagenes?.length);
  console.log("primer elemento (primeros 80 chars):", reg.imagenes?.[0]?.substring(0, 80));


  if (!validarFormulario(reg)) {
    alert("Debe completar todos los campos.");
    return;
  }

  console.log("IMAGENES QUE SE ENVIAN:");
  console.log(reg.imagenes);

  const regGuardar = { ...reg };

  for (let i = 1; i <= 20; i++) {
    delete regGuardar["a" + i];
    delete regGuardar["p" + i];
  }

  try {
    const res = await sheetsGuardar(regGuardar);

    console.log("RESPUESTA BACKEND:", JSON.stringify(res));

    if (!res || res.status === "error") {
      alert("⚠️ Error Sheets — guardado local");
      return;
    }

    const idx = registros.findIndex(x => x.id === reg.id);
    if (idx === -1) registros.push(reg);
    else registros[idx] = reg;

    limpiarFormulario();
    renderTabla();
    actualizarDashboard();
    await actualizarInforme();

  } catch (e) {
    console.error("FALLA CON SHEETS:", e);
    alert("⚠️ Error Sheets — guardado local");
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
  document.getElementById("tipoAgente").value = "";
  document.getElementById("numeroExtintor").value = "";
  document.getElementById("capacidad").value = "";
  document.getElementById("unidadCapacidad").value = "";
  document.getElementById("ubicacion").value = "";
  document.getElementById("referencia").value = "";
  document.getElementById("zonaRiesgo").value = "";
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
  document.getElementById("numeroExtintor").value = r.numeroExtintor;
  const capacidadSplit = r.capacidad.split(" ");
  document.getElementById("capacidad").value = capacidadSplit[0] || "";
  document.getElementById("unidadCapacidad").value = capacidadSplit[1] || "";
  document.getElementById("ubicacion").value = r.ubicacion;
  document.getElementById("referencia").value = r.referencia;
  document.getElementById("zonaRiesgo").value = r.zonaRiesgo;
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
  if (!confirm("¿Eliminar registro?")) return;
  await sheetsEliminar(id);
  registros = registros.filter(x => x.id !== id);
  renderTabla();
  actualizarDashboard();
  await actualizarInforme();
}

// ── Render Tabla ──
function okNc(flag) { return flag ? "✖" : "✔"; }

function obtenerPrioridades(reg) {
  const prioridades = [];
  for (let i = 1; i <= 20; i++) {
    if (reg["a" + i]) {
      const prioridad = reg["p" + i] || "Pendiente";
      let clase = "badge-pendiente";
      if (prioridad === "Urgente") clase = "badge-urgente";
      if (prioridad === "Importante") clase = "badge-importante";
      prioridades.push(`<div style="margin-bottom:4px;"><span class="badge ${clase}">A${i} - ${prioridad}</span></div>`);
    }
  }
  return prioridades.join("");
}

function renderTabla() {
  const tbody = document.querySelector("#tablaInspeccion tbody");
  tbody.innerHTML = "";
  registros.forEach((r, i) => {
    const tr = document.createElement("tr");
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
      <td>${okNc(r.a1)}</td><td>${okNc(r.a2)}</td><td>${okNc(r.a3)}</td><td>${okNc(r.a4)}</td>
      <td>${okNc(r.a5)}</td><td>${okNc(r.a6)}</td><td>${okNc(r.a7)}</td><td>${okNc(r.a8)}</td>
      <td>${okNc(r.a9)}</td><td>${okNc(r.a10)}</td><td>${okNc(r.a11)}</td><td>${okNc(r.a12)}</td>
      <td>${okNc(r.a13)}</td><td>${okNc(r.a14)}</td><td>${okNc(r.a15)}</td><td>${okNc(r.a16)}</td>
      <td>${okNc(r.a17)}</td><td>${okNc(r.a18)}</td><td>${okNc(r.a19)}</td><td>${okNc(r.a20)}</td>
      <td class="left">${obtenerDetallesNC(r) || "Sin NC"}</td>
      <td>${obtenerPrioridades(r) || "-"}</td>
      <td class="left">
        ${r.observaciones}
        <div class="thumbs">${(r.imagenes || []).map(img => `<img src="${img}">`).join("")}</div>
      </td>
      <td>
        <button class="mini-btn warning" onclick="editarRegistro('${r.id}')">✏️</button>
        <button class="mini-btn danger" onclick="eliminarRegistro('${r.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (!registros.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="33">No hay registros.</td>`;
    tbody.appendChild(tr);
  }
}

// ── Dashboard ──
function actualizarDashboard() {
  const total = registros.length;
  const conformes = registros.filter(esConforme).length;
  const observados = total - conformes;
  const pctConforme = total ? Math.round((conformes / total) * 100) : 0;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiConforme").textContent = pctConforme + "%";
  const sem = document.getElementById("semaforo");
  sem.textContent = pctConforme + "%";
  sem.className = "semaphore " + (pctConforme >= 80 ? "green" : pctConforme >= 50 ? "yellow" : "red");

  if (estadoChart) estadoChart.destroy();
  estadoChart = new Chart(document.getElementById("chartEstados"), {
    type: "doughnut",
    data: { labels: ["Conformes", "Con anomalías"], datasets: [{ data: [conformes, observados] }] }
  });

  const anomCounts = [];
  for (let i = 1; i <= 20; i++) anomCounts.push(registros.filter(x => x["a" + i]).length);
  if (anomaliaChart) anomaliaChart.destroy();
  anomaliaChart = new Chart(document.getElementById("chartAnomalias"), {
    type: "bar",
    data: { labels: Array.from({ length: 20 }, (_, i) => "A" + (i + 1)), datasets: [{ label: "Frecuencia", data: anomCounts }] }
  });

  let urgente = 0, importante = 0, pendiente = 0;
  registros.forEach(r => {
    for (let i = 1; i <= 20; i++) {
      if (r["a" + i]) {
        const p = r["p" + i];
        if (p === "Urgente") urgente++;
        else if (p === "Importante") importante++;
        else pendiente++;
      }
    }
  });
  if (prioridadChart) prioridadChart.destroy();
  prioridadChart = new Chart(document.getElementById("chartPrioridades"), {
    type: "pie",
    data: { labels: ["Urgente", "Importante", "Pendiente"], datasets: [{ data: [urgente, importante, pendiente], backgroundColor: ["#dc2626", "#f59e0b", "#16a34a"] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
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

    if ((cliente === "-" || cliente === "") && registros.length > 0) {
      const primerRegistro = registros[0];
      if (primerRegistro.codigoSHK && CLIENTES_MAP[primerRegistro.codigoSHK]) {
        codigoSHK = primerRegistro.codigoSHK;
        cliente = CLIENTES_MAP[primerRegistro.codigoSHK];
      }
    }

    const clienteConfig = CLIENT_CONFIG[codigoSHK] || CLIENT_CONFIG["default"];
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
    const logoBase64 = await logoABase64("assets/clientes/105/LOGO SDB.png");

    // ── Encabezado institucional (se repite en cada hoja) ──
  const encabezadoHTML = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tr>
          <td rowspan="3" style="border:1px solid #000;width:110px;text-align:center;vertical-align:middle;padding:4px;">
            ${logoBase64 ? `<img src="${logoBase64}" style="width:90px;height:auto;">` : ""}
          </td>
          <td colspan="4" style="border:1px solid #000;text-align:center;font-weight:bold;padding:6px;font-size:12px;">
            SISTEMA DE GESTIÓN DE SEGURIDAD Y SALUD EN EL TRABAJO
          </td>
          <td rowspan="3" style="border:1px solid #000;width:130px;text-align:center;vertical-align:middle;padding:4px;">
           ${logoBase64 ? `<img src="${logoBase64}" style="width:90px;height:auto;">` : ""}
          </td>
        </tr>
        <tr>
          <td colspan="4" style="border:1px solid #000;text-align:center;vertical-align:middle;padding:6px;font-size:15px;height:70px;">
            Informe de Inspección de Extintores
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:5px;text-align:center;width:25%;"><strong>Versión:</strong> 01</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;width:25%;"><strong>A:</strong> ${fechaInspeccion}</td>
          <td style="border:1px solid #000;padding:5px;text-align:center;width:25%;"><strong>Cód.:</strong> IN-SG-SST-SVG-DG-02</td>
        </tr>
      </table>
    `;

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

          <!-- TABLA 2: Datos del extintor (con pequeño espacio arriba) -->
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;margin-bottom:20px;">

            <tr style="background:#d9d9d9;">
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Fecha de Inspección</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">N° de EEP</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Tipo de Agente</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Cap.</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Fecha Carga</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Fecha PH</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${formatearFecha(r.fecha)}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${r.numeroExtintor || "-"}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${r.tipoAgente || "-"}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${r.capacidad || "-"}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${formatearFecha(r.fechaCarga)}</td>
              <td style="border:1px solid #000;padding:5px;text-align:center;">${formatearFecha(r.pruebaHidrostatica)}</td>
            </tr>

            <tr style="background:#d9d9d9;">
              <td colspan="3" style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Ubicación</td>
              <td colspan="3" style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Referencia</td>
            </tr>
            <tr>
              <td colspan="3" style="border:1px solid #000;padding:5px;">${r.ubicacion || "-"}</td>
              <td colspan="3" style="border:1px solid #000;padding:5px;">${r.referencia || "-"}</td>
            </tr>

            <tr style="background:#d9d9d9;">
              <td colspan="2" style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Anomalías / NC</td>
              <td colspan="2" style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Prioridad</td>
              <td colspan="2" style="border:1px solid #000;padding:5px;text-align:center;font-weight:bold;">Observaciones</td>
            </tr>
            <tr>
              <td colspan="2" style="border:1px solid #000;padding:5px;vertical-align:top;text-align:right">
                ${obtenerDescripcionNC(r, true)}
              </td>
              <td colspan="2" style="border:1px solid #000;padding:5px;vertical-align:top;">
                ${obtenerPrioridades(r) || "-"}
              </td>
              <td colspan="2" style="border:1px solid #000;padding:5px;vertical-align:top;">
                ${r.observaciones || "-"}
                <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                  ${(r.imagenes || []).map(img =>
                    `<img src="${img}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">`
                  ).join("")}
                </div>
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
      const inicio = pagina * registrosPorPagina;
      const registrosPagina = registros.slice(inicio, inicio + registrosPorPagina);

      const resumenHTML = pagina === 0 ? `
        <div style="margin-bottom:16px;">
          <h3 style="color:#1e3c72;margin-bottom:8px;">Resumen ejecutivo</h3>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #ccc;padding:6px;text-align:left;">Total inspeccionados</th>
              <td style="border:1px solid #ccc;padding:6px;"><strong>${total}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #ccc;padding:6px;text-align:left;">Conformes</th>
              <td style="border:1px solid #ccc;padding:6px;"><strong style="color:green;">${conformes}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #ccc;padding:6px;text-align:left;">Con anomalías</th>
              <td style="border:1px solid #ccc;padding:6px;"><strong style="color:#d97706;">${observados}</strong></td>
            </tr>
            <tr>
              <th style="border:1px solid #ccc;padding:6px;text-align:left;">% Conformidad</th>
              <td style="border:1px solid #ccc;padding:6px;"><strong>${total > 0 ? Math.round((conformes/total)*100) : 0}%</strong></td>
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

// ── Arrancar ──
init();
