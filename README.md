# 🧯 Módulo de Inspección de Extintores Portátiles

Aplicación web para registrar, controlar e inspeccionar extintores portátiles.  
Los datos se sincronizan con **Google Sheets** usando Google Apps Script como backend serverless.

---

## 📁 Estructura del proyecto

```
extintor-inspector/
├── index.html                    ← Página principal
├── css/
│   └── styles.css                ← Estilos
├── js/
│   ├── config.js                 ← ⚙️ Configuración (URL del script, clientes, etc.)
│   ├── sheets.js                 ← Capa de integración con Google Sheets
│   └── app.js                    ← Lógica principal
├── google-apps-script/
│   └── Code.gs                   ← Script a pegar en script.google.com
├── assets/
│   └── clientes/                 ← Logos por cliente (opcional)
│       ├── 100/logo.png
│       └── 105/logo.png
└── docs/
    └── SETUP.md                  ← Guía de configuración
```

---

## 🚀 Configuración paso a paso

### 1. Crear el Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una nueva hoja.
2. Copia el **ID** de la URL:  
   `https://docs.google.com/spreadsheets/d/ **ESTE_ES_EL_ID** /edit`

### 2. Configurar el Google Apps Script

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra el código por defecto y pega el contenido de `google-apps-script/Code.gs`.
3. En la línea `const SPREADSHEET_ID = "..."`, reemplaza con tu ID copiado.
4. Guarda (`Ctrl+S`).
5. Haz clic en **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién puede acceder: **Cualquier persona**
6. Haz clic en **Implementar** y copia la **URL** generada.

### 3. Configurar la aplicación

Abre `js/config.js` y pega la URL en:

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/TU_URL_AQUI/exec",
  ...
};
```

### 4. Subir a GitHub Pages (opcional, para acceso desde cualquier lugar)

1. Crea un repositorio en [github.com](https://github.com).
2. Sube todos los archivos del proyecto.
3. Ve a **Settings → Pages → Branch: main → / (root)** → Guardar.
4. En unos minutos la app estará en `https://TU_USUARIO.github.io/TU_REPO/`.

---

## ⚠️ Notas importantes

- Las **imágenes** se almacenan como Base64 dentro del JSON. Si subes muchas imágenes pesadas, el rendimiento puede verse afectado. Para producción considera usar Google Drive para las imágenes.
- Si la URL del script no está configurada, la app funciona **solo con localStorage** (datos en el navegador, no sincronizados).
- Cada vez que modifiques el `Code.gs`, debes hacer una **nueva implementación** (no editar la existente) para que los cambios surtan efecto.

---

## 🛠️ Tecnologías usadas

- HTML / CSS / JavaScript puro (sin frameworks)
- [Chart.js](https://www.chartjs.org/) para gráficos
- Google Apps Script como API REST
- Google Sheets como base de datos
