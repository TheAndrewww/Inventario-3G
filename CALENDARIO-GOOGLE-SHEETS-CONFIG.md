# 📅 Configuración: Dashboard de Calendario desde Google Sheets

## 🎯 Objetivo
Dashboard visual en tiempo real que lee directamente de Google Sheets para mostrar en pantalla el calendario de proyectos y equipos del mes.

## 📋 Información Necesaria del Usuario

### 1. Google Sheet ID
**URL del Sheet:** `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

**Sheet ID:** [PENDIENTE - Usuario debe proporcionar]

### 2. Estructura del Sheet

**Nombre de la hoja/pestaña:** [PENDIENTE]

**Columnas esperadas (ejemplo):**
```
| Fecha      | Proyecto          | Equipo        | Cliente    | Estado      | Ubicación |
|------------|-------------------|---------------|------------|-------------|-----------|
| 15/11/2025 | Casa Juarez       | Equipo A      | Sr. Juarez | En curso    | GDL       |
| 15/11/2025 | Oficina González  | Equipo B      | Empresa X  | Planificado | Zapopan   |
| 16/11/2025 | Casa Juarez       | Equipo A      | Sr. Juarez | En curso    | GDL       |
```

**Columnas confirmadas por usuario:**
- [ ] Fecha
- [ ] Proyecto/Obra
- [ ] Equipo asignado
- [ ] Cliente
- [ ] Estado
- [ ] Ubicación/Dirección
- [ ] Otras: _____________

### 3. Configuración de Acceso

**Opciones de acceso a Google Sheets:**

**Opción A: Public Sheet (Más simple)**
- Sheet público con link de "cualquiera con el enlace puede ver"
- No requiere autenticación
- ⚠️ Menos seguro pero más fácil de configurar

**Opción B: Service Account (Recomendado)**
- Crear Service Account en Google Cloud
- Compartir Sheet con email del service account
- ✅ Más seguro y profesional
- Requiere archivo de credenciales JSON

**Opción elegida:** [PENDIENTE]

## 🎨 Diseño del Dashboard

### Vista Principal: Calendario Mensual

```
┌────────────────────────────────────────────────────────────┐
│  📅 CALENDARIO DE PROYECTOS - NOVIEMBRE 2025               │
│                                               🔄 Actualizado │
├────────────────────────────────────────────────────────────┤
│  LUN        MAR        MIÉ        JUE        VIE        SÁB│
│                                                              │
│           15         16         17         18         19    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │      │ │🏗️ 3  │ │🏗️ 2  │ │🏗️ 2  │ │🏗️ 1  │ │      │   │
│  │      │ │obras │ │obras │ │obras │ │obra  │ │      │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│                                                              │
│  22         23         24         25         26         27  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │🏗️ 4  │ │🏗️ 3  │ │🏗️ 2  │ │      │ │      │ │      │   │
│  │obras │ │obras │ │obras │ │      │ │      │ │      │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  📋 PROYECTOS DE HOY - Viernes 15 de Noviembre             │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  🟢 Casa Juarez                        [Equipo A]           │
│     📍 Guadalajara, Jalisco            👤 Sr. Juarez        │
│     ⏰ En curso                                              │
│                                                              │
│  🟡 Oficina González                   [Equipo B]           │
│     📍 Zapopan, Jalisco                👤 Empresa X         │
│     ⏰ Planificado                                           │
│                                                              │
│  🔴 Centro Comercial ABC               [Equipo C]           │
│     📍 Tlaquepaque, Jalisco            👤 Corp. XYZ         │
│     ⏰ Retrasado                                             │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

### Códigos de color por estado:
- 🟢 Verde: En curso / Activo
- 🟡 Amarillo: Planificado / Pendiente
- 🔴 Rojo: Retrasado / Urgente
- ⚪ Gris: Completado / Cancelado

## ⚙️ Configuración Técnica

### Backend: Endpoint de lectura

**Ruta:** `GET /api/calendario/mes/:year/:month`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "mes": 11,
    "año": 2025,
    "proyectos": [
      {
        "fecha": "2025-11-15",
        "proyecto": "Casa Juarez",
        "equipo": "Equipo A",
        "cliente": "Sr. Juarez",
        "estado": "En curso",
        "ubicacion": "Guadalajara, Jalisco"
      }
    ],
    "ultima_actualizacion": "2025-11-15T10:30:00Z"
  }
}
```

### Frontend: Auto-actualización

**Polling cada 5 minutos:**
```javascript
useEffect(() => {
  const fetchCalendario = async () => {
    const response = await fetch('/api/calendario/mes/2025/11');
    const data = await response.json();
    setProyectos(data.proyectos);
  };

  fetchCalendario(); // Inicial
  const interval = setInterval(fetchCalendario, 5 * 60 * 1000); // 5 min

  return () => clearInterval(interval);
}, []);
```

## 🔐 Pasos de Configuración (Service Account)

### 1. Crear proyecto en Google Cloud Console
1. Ir a https://console.cloud.google.com/
2. Crear nuevo proyecto: "Inventario-3G-Calendario"
3. Habilitar Google Sheets API

### 2. Crear Service Account
1. IAM & Admin → Service Accounts → Create Service Account
2. Nombre: "inventario-calendar-reader"
3. Role: None (solo lectura)
4. Crear Key → JSON → Descargar

### 3. Compartir Google Sheet
1. Abrir el Google Sheet
2. Click en "Compartir"
3. Agregar email del service account (ej: inventario-calendar-reader@proyecto.iam.gserviceaccount.com)
4. Permisos: "Viewer" (solo lectura)

### 4. Configurar Backend
```bash
# Variables de entorno (.env)
GOOGLE_SHEET_ID=1abc...xyz
GOOGLE_SHEET_NAME=Calendario
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## 📦 Dependencias Necesarias

### Backend
```bash
npm install googleapis
```

### Frontend
```bash
npm install date-fns
# (ya instalado en el proyecto)
```

## 🚀 Modo Pantalla Completa (Kiosko)

### Características:
- ✅ Auto-fullscreen al cargar
- ✅ Ocultar barra de navegación
- ✅ Ocultar cursor después de 5s de inactividad
- ✅ Prevenir sleep mode
- ✅ Actualización visual del timestamp

### URL dedicada:
```
http://localhost:5173/calendario/display
```

## 📊 Métricas y Monitoreo

### Logs del sistema:
- Timestamp de última actualización
- Número de proyectos leídos
- Errores de lectura del Sheet
- Estado de conexión a Google API

---

**Estado:** 🟡 PENDIENTE - Esperando información del usuario

**Próximos pasos:**
1. Usuario proporciona Sheet ID
2. Usuario describe estructura de columnas
3. Usuario elige método de autenticación
4. Implementar backend + frontend
