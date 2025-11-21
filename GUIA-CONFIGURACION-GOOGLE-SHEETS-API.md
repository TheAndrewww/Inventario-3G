# 🔧 Guía Paso a Paso: Configurar Google Sheets API

## 📋 Índice
1. [Crear proyecto en Google Cloud](#paso-1-crear-proyecto-en-google-cloud)
2. [Habilitar Google Sheets API](#paso-2-habilitar-google-sheets-api)
3. [Crear Service Account](#paso-3-crear-service-account)
4. [Descargar credenciales](#paso-4-descargar-credenciales)
5. [Compartir Google Sheet](#paso-5-compartir-google-sheet)
6. [Configurar en el proyecto](#paso-6-configurar-en-el-proyecto)

---

## Paso 1: Crear proyecto en Google Cloud

### 1.1 Ir a Google Cloud Console
Abre tu navegador y ve a:
```
https://console.cloud.google.com/
```

### 1.2 Crear nuevo proyecto
1. Click en el selector de proyectos (arriba a la izquierda, al lado del logo de Google Cloud)
2. Click en **"Nuevo Proyecto"** / **"New Project"**
3. Llena los datos:
   - **Nombre del proyecto:** `Inventario-3G-Calendario`
   - **Ubicación:** Dejar por defecto
4. Click en **"Crear"** / **"Create"**
5. ⏳ Espera 10-20 segundos a que se cree

### 1.3 Seleccionar el proyecto
1. Una vez creado, asegúrate de que está seleccionado
2. Debes ver "Inventario-3G-Calendario" en la parte superior

✅ **Checkpoint:** Tienes el proyecto creado y seleccionado

---

## Paso 2: Habilitar Google Sheets API

### 2.1 Buscar la API
1. En el menú de búsqueda superior (🔍), escribe: `Google Sheets API`
2. Click en el resultado **"Google Sheets API"**

### 2.2 Habilitar la API
1. Click en el botón azul **"HABILITAR"** / **"ENABLE"**
2. ⏳ Espera 5-10 segundos

✅ **Checkpoint:** Google Sheets API está habilitada

---

## Paso 3: Crear Service Account

### 3.1 Ir a Service Accounts
1. En el menú lateral (☰), busca: **"IAM y administración"** → **"Cuentas de servicio"**
   - O en inglés: **"IAM & Admin"** → **"Service Accounts"**
2. Click en **"+ CREAR CUENTA DE SERVICIO"** / **"+ CREATE SERVICE ACCOUNT"**

### 3.2 Configurar la cuenta
**Pantalla 1 - Detalles:**
- **Nombre:** `inventario-calendar-reader`
- **ID:** (se genera automáticamente)
- **Descripción:** `Lee el calendario de Google Sheets para el dashboard`
- Click **"CREAR Y CONTINUAR"** / **"CREATE AND CONTINUE"**

**Pantalla 2 - Permisos:**
- **Rol:** NO seleccionar ninguno (dejar vacío)
- Click **"CONTINUAR"** / **"CONTINUE"**

**Pantalla 3 - Acceso:**
- Dejar todo vacío
- Click **"LISTO"** / **"DONE"**

### 3.3 Copiar el email del Service Account
Verás una tabla con tu Service Account recién creado.

**IMPORTANTE:** Copia el email completo, se ve así:
```
inventario-calendar-reader@inventario-3g-calendario-123456.iam.gserviceaccount.com
```

📋 **Guárdalo en un lugar seguro** (lo necesitarás en el Paso 5)

✅ **Checkpoint:** Service Account creado, email copiado

---

## Paso 4: Descargar credenciales

### 4.1 Crear llave JSON
1. En la tabla de Service Accounts, click en el email del Service Account que acabas de crear
2. Ve a la pestaña **"LLAVES"** / **"KEYS"** (arriba)
3. Click en **"AGREGAR LLAVE"** / **"ADD KEY"** → **"Crear llave nueva"** / **"Create new key"**
4. Selecciona **"JSON"**
5. Click **"CREAR"** / **"CREATE"**

### 4.2 Guardar el archivo
Se descargará automáticamente un archivo JSON con un nombre largo como:
```
inventario-3g-calendario-123456-abc123def456.json
```

**IMPORTANTE:**
- Renómbralo a: `google-credentials.json`
- Guárdalo en un lugar seguro

✅ **Checkpoint:** Archivo `google-credentials.json` descargado

---

## Paso 5: Compartir Google Sheet

### 5.1 Abrir tu Google Sheet
1. Abre el Google Sheet que contiene tu calendario
2. Click en el botón **"Compartir"** (arriba a la derecha)

### 5.2 Compartir con el Service Account
1. En el campo "Agregar personas, grupos o email de calendario", pega el **email del Service Account** que copiaste en el Paso 3.3
2. **Permisos:** Asegúrate de que diga **"Lector"** / **"Viewer"** (NO "Editor")
3. **Desmarcar** la casilla "Notificar a las personas" (no es necesario)
4. Click **"Compartir"** / **"Share"**

✅ **Checkpoint:** Sheet compartido con el Service Account

---

## Paso 6: Configurar en el proyecto

### 6.1 Copiar ID del Google Sheet
1. En tu Google Sheet, mira la URL en el navegador:
```
https://docs.google.com/spreadsheets/d/[ESTA_ES_LA_PARTE_QUE_NECESITAS]/edit
```

Ejemplo:
```
https://docs.google.com/spreadsheets/d/1abc_DEF-ghi123JKL456/edit
                                      ↑
                            COPIA ESTA PARTE
```

📋 El ID es la parte larga entre `/d/` y `/edit`

### 6.2 Nombre de la hoja/pestaña
Mira las pestañas en la parte inferior de tu Google Sheet.

📋 Copia el nombre exacto (ej: "Calendario", "Noviembre 2025", "Hoja1")

✅ **Checkpoint:** Tienes el Sheet ID y nombre de la hoja

---

## 📊 Verificación Final

Antes de continuar, asegúrate de tener:

- [ ] Archivo `google-credentials.json` descargado
- [ ] Email del Service Account copiado
- [ ] Google Sheet compartido con ese email (permisos de Lector)
- [ ] ID del Google Sheet copiado
- [ ] Nombre de la hoja/pestaña copiado

---

## 🎯 Siguiente Paso

Una vez tengas todo esto, me lo pasas y yo configuro:

1. ✅ Backend para leer el Google Sheet
2. ✅ Endpoint API que devuelve los datos
3. ✅ Frontend con calendario visual
4. ✅ Auto-actualización cada 5 minutos
5. ✅ Modo pantalla completa para display

---

## ❓ Troubleshooting

### "No puedo crear proyecto en Google Cloud"
**Solución:** Asegúrate de estar usando una cuenta de Google que tenga permisos. Si es cuenta corporativa, puede que necesites permisos de administrador.

### "No veo el botón 'Crear Service Account'"
**Solución:** Verifica que estás en la sección correcta: IAM y administración → Cuentas de servicio

### "El archivo JSON no se descargó"
**Solución:** Revisa tu carpeta de descargas. Si no está, repite el Paso 4.1

### "No puedo compartir el Sheet"
**Solución:** Asegúrate de copiar el email completo del Service Account (incluye @...iam.gserviceaccount.com)

---

## 🔒 Seguridad

**IMPORTANTE:**
- ⚠️ El archivo `google-credentials.json` es como una contraseña
- ⚠️ NO lo subas a GitHub ni lo compartas públicamente
- ⚠️ Lo agregaremos al `.gitignore`
- ✅ Solo el backend lo usará (no el frontend)

---

**¿Listo para empezar?** 🚀

Avísame cuando tengas todo y continuamos con la configuración del código.
