# 🔄 Estrategia: Integración con Calendario Excel Existente

**Fecha:** 2025-11-11
**Situación:** El calendario se maneja en Excel/Google Drive (fuente de verdad)
**Objetivo:** Integrar sin interrumpir el flujo actual

---

## 🎯 Nueva Estrategia: Sistema de Lectura (No de Gestión)

### **Filosofía:**
```
Excel/Drive = Fuente de Verdad (sigue siendo el master)
Sistema Inventario = Lector + Vinculador (consume la información)
```

### **Flujo Propuesto:**

```
┌─────────────────────────────────────────┐
│  GOOGLE SHEETS / EXCEL                  │
│  (Calendario Master - Lo siguen usando) │
│                                         │
│  • Proyectos y fechas                   │
│  • Equipos asignados por día            │
│  • Clientes, ubicaciones                │
└────────────┬────────────────────────────┘
             │
             │ (Sincronización automática)
             │ Google Sheets API / Import CSV
             │
             ▼
┌─────────────────────────────────────────┐
│  SISTEMA INVENTARIO 3G                  │
│  (Solo lectura del calendario)          │
│                                         │
│  ✅ Lee proyectos del Excel             │
│  ✅ Vincula pedidos con proyectos       │
│  ✅ Muestra vista de calendario         │
│  ✅ Genera reportes integrados          │
│                                         │
│  ❌ NO crea/edita proyectos aquí        │
│  ❌ NO modifica fechas                  │
└─────────────────────────────────────────┘
```

---

## 📋 Tres Enfoques Posibles

### **Opción 1: SOLO Vinculación Manual (Más Simple)**

**Cómo funciona:**
1. Excel sigue siendo el calendario maestro
2. En el sistema, agregamos SOLO autocomplete de proyectos
3. Los proyectos se ingresan manualmente UNA VEZ en el sistema
4. NO se sincroniza automáticamente

**Ventajas:**
- ✅ Súper simple de implementar (1 semana)
- ✅ Cero configuración técnica
- ✅ Sin dependencias de APIs
- ✅ Control total

**Desventajas:**
- ⚠️ Hay que ingresar proyectos manualmente al sistema
- ⚠️ Si cambia nombre en Excel, hay que actualizarlo en sistema

**Flujo:**
```
Excel:                    Sistema Inventario:
─────                     ──────────────────
Casa Juárez               1. Admin ingresa "Casa Juárez" en
Fecha: 15-Nov            tabla proyectos (una sola vez)
Equipo A
                          2. Diseñador crea pedido y selecciona
                          "Casa Juárez" del dropdown

                          3. Reportes y trazabilidad funcionan
```

**Implementación:**
```sql
-- Tabla simple de proyectos
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- En movimientos, agregar:
ALTER TABLE movimientos
ADD COLUMN proyecto_id INTEGER REFERENCES proyectos(id);
```

---

### **Opción 2: Importación Manual de CSV (Intermedio)**

**Cómo funciona:**
1. Excel/Google Sheets sigue siendo maestro
2. Cada semana/mes: Exportar CSV del calendario
3. Sistema tiene botón "Importar Proyectos desde CSV"
4. Se actualiza automáticamente la lista de proyectos

**Ventajas:**
- ✅ Sincronización relativamente fácil
- ✅ Sin APIs complejas
- ✅ Actualización batch cuando sea necesario
- ✅ Se mantiene Excel como master

**Desventajas:**
- ⚠️ Requiere acción manual periódica
- ⚠️ No es tiempo real

**Flujo:**
```
1. Excel/Sheets:
   Nombre Proyecto | Fecha Inicio | Cliente | Equipo
   Casa Juárez    | 15/11/2025   | Sr. J   | Equipo A

2. Exportar CSV → Subir al sistema → Click "Importar"

3. Sistema actualiza tabla proyectos automáticamente

4. Autocomplete refleja los proyectos del Excel
```

**Implementación:**
```javascript
// Backend: POST /api/proyectos/importar-csv
export const importarProyectosCSV = async (req, res) => {
  const csvFile = req.file;
  const proyectos = parseCSV(csvFile);

  // Insertar o actualizar proyectos
  for (const proyecto of proyectos) {
    await Proyecto.upsert({
      nombre: proyecto.nombre,
      fecha_inicio: proyecto.fecha_inicio,
      cliente: proyecto.cliente,
      activo: true
    });
  }
};

// Frontend: Botón de importación
<input type="file" accept=".csv" onChange={handleImportCSV} />
```

---

### **Opción 3: Sincronización Automática con Google Sheets (Avanzado)**

**Cómo funciona:**
1. Excel migra a Google Sheets (si no lo es ya)
2. Sistema se conecta a Google Sheets API
3. Sincronización automática cada X horas
4. Proyectos siempre actualizados

**Ventajas:**
- ✅ Totalmente automático
- ✅ Siempre sincronizado
- ✅ Tiempo real (o casi)
- ✅ Excel/Sheets sigue siendo master

**Desventagas:**
- ⚠️ Requiere Google Sheets API (complejidad técnica)
- ⚠️ Autenticación OAuth
- ⚠️ Más tiempo de desarrollo (2-3 semanas)

**Flujo:**
```
Google Sheets (Calendario)
           ↓
    (Google Sheets API)
           ↓
   Cron Job (cada 6 horas)
           ↓
  Actualiza tabla proyectos
           ↓
  Autocomplete actualizado
```

**Implementación:**
```javascript
// Backend: Cron job sincronización
import { google } from 'googleapis';

const syncGoogleSheets = async () => {
  const sheets = google.sheets('v4');
  const auth = await authorize(); // OAuth2

  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: process.env.SHEET_ID,
    range: 'Calendario!A2:E100',
  });

  const rows = response.data.values;

  for (const row of rows) {
    await Proyecto.upsert({
      nombre: row[0],
      fecha_inicio: row[1],
      cliente: row[2],
      equipo: row[3]
    });
  }
};

// Ejecutar cada 6 horas
cron.schedule('0 */6 * * *', syncGoogleSheets);
```

---

## 🎯 Mi Recomendación: Opción 1 + Migración Gradual

### **Fase 1: Vinculación Manual (Ahora - 1 semana)**

**Implementar:**
1. ✅ Crear tabla `proyectos` simple
2. ✅ Agregar campo `proyecto_id` a movimientos
3. ✅ Migrar proyectos existentes (del campo texto)
4. ✅ Agregar autocomplete en pedidos
5. ✅ CRUD básico de proyectos (crear/editar/desactivar)

**Resultado:**
- Admin ingresa proyectos del Excel manualmente (una vez)
- Usuarios seleccionan proyecto del dropdown al crear pedido
- Reportes y trazabilidad funcionan
- **Excel sigue siendo la fuente de verdad del calendario**

### **Fase 2: Vista de Calendario en Sistema (1-2 semanas después)**

**Implementar:**
1. ✅ Página de calendario visual
2. ✅ Mostrar proyectos por fecha
3. ✅ Ver equipos asignados
4. ✅ Filtros por mes, equipo, estado
5. ❌ NO permite crear/editar proyectos (solo visualización)

**Resultado:**
- Usuario ve calendario en el sistema
- **Pero sigue editando en Excel**
- Sistema solo muestra la información

### **Fase 3: Importación CSV (Opcional - Futuro)**

**Si quieren automatizar:**
1. ✅ Botón "Importar desde CSV"
2. ✅ Exportar Excel → Subir CSV → Actualizar proyectos
3. ✅ Se hace 1 vez por semana o mes

### **Fase 4: Sincronización Automática (Opcional - Futuro Lejano)**

**Si migran a Google Sheets:**
1. ✅ Conectar Google Sheets API
2. ✅ Sincronización automática
3. ✅ Sistema siempre actualizado

---

## 🏗️ Arquitectura Propuesta (Fase 1)

### **Base de Datos:**

```sql
-- Tabla proyectos (solo información básica)
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) UNIQUE NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  cliente VARCHAR(200),
  ubicacion_obra VARCHAR(200),
  estado VARCHAR(50) DEFAULT 'activo',
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vincular movimientos con proyectos
ALTER TABLE movimientos
ADD COLUMN proyecto_id INTEGER REFERENCES proyectos(id);

-- Índice para búsquedas rápidas
CREATE INDEX idx_proyectos_nombre ON proyectos(nombre);
CREATE INDEX idx_movimientos_proyecto_id ON movimientos(proyecto_id);
```

### **Backend API:**

```javascript
// Rutas básicas
GET    /api/proyectos              // Listar (para autocomplete)
GET    /api/proyectos/:id          // Ver detalle
POST   /api/proyectos              // Crear proyecto
PUT    /api/proyectos/:id          // Actualizar
DELETE /api/proyectos/:id          // Desactivar (soft delete)

// Rutas especiales
GET    /api/proyectos/:id/movimientos  // Ver movimientos del proyecto
GET    /api/proyectos/:id/costos       // Calcular costos del proyecto
```

### **Frontend:**

```jsx
// 1. Autocomplete en PedidoFormModal
<AutocompleteProyecto
  value={formData.proyecto_id}
  onChange={(id) => setFormData({...formData, proyecto_id: id})}
  onCreateNew={(nombre) => handleCrearProyecto(nombre)}
/>

// 2. Pantalla de gestión de proyectos (admin)
<ProyectosPage>
  <ListaProyectos />
  <ProyectoFormModal />  {/* Crear/editar manual */}
</ProyectosPage>

// 3. Vista de calendario (lectura)
<CalendarioPage>
  <VistaCalendario proyectos={proyectos} readonly />
</CalendarioPage>
```

---

## 📊 Comparativa de Opciones

| Característica | Opción 1 Manual | Opción 2 CSV | Opción 3 API |
|----------------|-----------------|--------------|--------------|
| **Tiempo desarrollo** | 1 semana | 2 semanas | 3-4 semanas |
| **Complejidad técnica** | ⭐ Baja | ⭐⭐ Media | ⭐⭐⭐⭐ Alta |
| **Esfuerzo de sync** | Manual inicial | Manual periódico | Automático |
| **Excel sigue siendo master** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Costo infraestructura** | $ | $ | $$ |
| **Riesgo** | Bajo | Bajo | Medio |
| **Actualización** | On-demand | Semanal/Mensual | Tiempo real |

---

## ✅ Plan de Acción Recomendado

### **Semana 1: Fundamentos**
```
✓ Crear tabla proyectos
✓ Agregar proyecto_id a movimientos
✓ Migrar proyectos existentes del campo texto
✓ Backend: CRUD básico de proyectos
```

### **Semana 2: Frontend Básico**
```
✓ Autocomplete en PedidoFormModal
✓ Página ProyectosPage (CRUD manual)
✓ Reportes: materiales por proyecto
```

### **Semana 3: Calendario Visual (Solo lectura)**
```
✓ CalendarioPage con vista mensual
✓ Mostrar proyectos por fecha
✓ Ver equipos asignados
✓ NO permite editar (solo visualizar)
```

### **Futuro (Opcional):**
```
⏸ Importación CSV (si lo solicitan)
⏸ Google Sheets API (si migran de Excel)
```

---

## 💡 Beneficios de Este Enfoque

### **Para el Usuario:**
1. ✅ Sigue usando Excel como siempre (no cambia flujo)
2. ✅ Autocomplete al crear pedidos (menos errores)
3. ✅ Reportes integrados (materiales por proyecto)
4. ✅ Trazabilidad (qué se usó en cada proyecto)

### **Para el Sistema:**
1. ✅ Datos normalizados (sin duplicados)
2. ✅ Reportes precisos
3. ✅ Queries eficientes
4. ✅ Preparado para futuro calendario completo

### **Para la Empresa:**
1. ✅ No interrumpe operaciones actuales
2. ✅ Migración gradual sin riesgos
3. ✅ Mejora progresiva
4. ✅ ROI inmediato (mejores reportes)

---

## 🚀 Siguiente Paso

**¿Empezamos con la Opción 1 (Vinculación Manual)?**

Puedo crear:
1. Tabla `proyectos` en backend
2. Migración de datos existentes
3. Backend API (CRUD proyectos)
4. Autocomplete en frontend
5. Página de gestión de proyectos (admin)

**Tiempo estimado:** 1 semana
**Riesgo:** Bajo
**Impacto:** Alto (mejora inmediata en reportes y trazabilidad)

¿Te parece bien este enfoque? 🤔
