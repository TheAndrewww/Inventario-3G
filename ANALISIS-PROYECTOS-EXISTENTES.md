# 📊 Análisis: Campo "Proyecto" Existente en el Sistema

**Fecha:** 2025-11-11
**Descubrimiento:** El sistema YA tiene un campo para proyectos

---

## ✅ Situación Actual

### **Campo Existente en Tabla `movimientos`:**

```javascript
movimientos {
  id: INTEGER
  ticket_id: STRING(50)          // Ej: "111125-1315-01"
  tipo: ENUM                     // 'pedido', 'retiro', etc.
  proyecto: STRING(200)          // ✅ NOMBRE DEL PROYECTO (texto libre)
  tipo_pedido: ENUM              // 'proyecto' o 'equipo'
  equipo_id: INTEGER             // Equipo asignado
  estado: ENUM                   // 'pendiente', 'aprobado', etc.
  fecha_hora: DATE
  ...
}
```

### **Cómo Se Usa Actualmente:**

1. **Cuando un diseñador crea un pedido:**
   - Selecciona `tipo_pedido = 'proyecto'`
   - Escribe el nombre del proyecto en campo `proyecto` (texto libre)
   - Ejemplo: "Instalación Casa Juárez", "Obra Centro Comercial"

2. **Cuando almacenista crea pedido para equipo:**
   - Selecciona `tipo_pedido = 'equipo'`
   - Selecciona el `equipo_id`
   - Campo `proyecto` queda vacío o con nombre opcional

---

## 🔍 Análisis del Problema Actual

### ❌ **Problemas con el Diseño Actual:**

1. **Campo de Texto Libre (Sin Normalización)**
   ```
   Movimiento 1: proyecto = "Casa Juarez"
   Movimiento 2: proyecto = "casa juarez"
   Movimiento 3: proyecto = "Casa Juárez"
   Movimiento 4: proyecto = "CASA JUAREZ"
   ```
   ❌ Son el mismo proyecto pero se registran como 4 diferentes

2. **No Hay Información Adicional del Proyecto**
   - Sin fecha de inicio/fin
   - Sin cliente
   - Sin estado (activo, completado, etc.)
   - Sin presupuesto
   - Sin ubicación de obra

3. **No Hay Trazabilidad Completa**
   - No puedes ver fácilmente "todos los movimientos del Proyecto X"
   - No puedes calcular costos totales por proyecto
   - No puedes ver timeline del proyecto

4. **Duplicación y Errores**
   - Typos: "Casa Juaraz" en lugar de "Juárez"
   - Inconsistencias: "Proyecto ABC" vs "ABC" vs "Obra ABC"
   - Sin autocompletado

---

## 🎯 Solución Propuesta: Migrar a Tabla Normalizada

### **Transformación:**

```
ANTES:
movimientos {
  proyecto: STRING(200)  ← Texto libre
}

DESPUÉS:
movimientos {
  proyecto_id: INTEGER   ← Relación con tabla proyectos
  proyecto: STRING(200)  ← (Mantener temporalmente para migración)
}

proyectos {  ← Nueva tabla
  id: INTEGER
  nombre: STRING(200)
  descripcion: TEXT
  cliente: STRING
  ubicacion_obra: STRING
  fecha_inicio: DATE
  fecha_fin: DATE
  estado: ENUM
  presupuesto_estimado: DECIMAL
  ...
}
```

---

## 📋 Plan de Migración SIN Pérdida de Datos

### **Fase 1: Crear Tabla Proyectos (Sin Tocar Nada)**

```sql
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL UNIQUE,
  descripcion TEXT,
  cliente VARCHAR(200),
  ubicacion_obra VARCHAR(200),
  fecha_inicio DATE,
  fecha_fin DATE,
  fecha_fin_real DATE,
  estado VARCHAR(50) DEFAULT 'activo',
  presupuesto_estimado DECIMAL(15,2),
  presupuesto_real DECIMAL(15,2),
  supervisor_id INTEGER REFERENCES usuarios(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Fase 2: Agregar Campo `proyecto_id` (Sin Romper Nada)**

```sql
-- Agregar columna nueva (nullable por ahora)
ALTER TABLE movimientos
ADD COLUMN proyecto_id INTEGER REFERENCES proyectos(id);

-- Mantener el campo 'proyecto' existente temporalmente
-- NO eliminar aún para no perder datos
```

### **Fase 3: Migrar Datos Existentes**

```sql
-- Paso 1: Extraer proyectos únicos (normalizados)
INSERT INTO proyectos (nombre, fecha_inicio, estado, created_at)
SELECT DISTINCT
  UPPER(TRIM(proyecto)) as nombre,  -- Normalizar: mayúsculas, sin espacios
  MIN(fecha_hora) as fecha_inicio,  -- Primera vez que apareció
  CASE
    WHEN MAX(fecha_hora) > NOW() - INTERVAL '30 days' THEN 'activo'
    ELSE 'completado'
  END as estado,
  NOW() as created_at
FROM movimientos
WHERE proyecto IS NOT NULL
  AND TRIM(proyecto) != ''
GROUP BY UPPER(TRIM(proyecto))
ORDER BY MIN(fecha_hora) DESC;

-- Paso 2: Actualizar movimientos con proyecto_id
UPDATE movimientos m
SET proyecto_id = p.id
FROM proyectos p
WHERE UPPER(TRIM(m.proyecto)) = p.nombre
  AND m.proyecto IS NOT NULL
  AND TRIM(m.proyecto) != '';
```

### **Fase 4: Actualizar Backend (Gradual)**

**Modificar modelo Movimiento.js:**
```javascript
Movimiento.define({
  // ... campos existentes ...

  proyecto: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'DEPRECATED: Usar proyecto_id. Mantener para compatibilidad'
  },

  proyecto_id: {  // ← NUEVO
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'proyectos',
      key: 'id'
    },
    comment: 'Referencia a proyecto normalizado'
  }
});

// Agregar relación
Movimiento.belongsTo(Proyecto, {
  foreignKey: 'proyecto_id',
  as: 'proyectoInfo'
});
```

### **Fase 5: Actualizar Frontend (Gradual)**

**En PedidoFormModal.jsx:**
```jsx
// ANTES:
<input
  name="proyecto"
  type="text"
  placeholder="Nombre del proyecto"
/>

// DESPUÉS:
<AutocompleteProyectos
  value={formData.proyecto_id}
  onChange={(proyectoId) => setFormData({...formData, proyecto_id: proyectoId})}
  placeholder="Buscar o crear proyecto"
/>
```

### **Fase 6: Eliminar Campo Viejo (Después de 2-3 meses)**

```sql
-- Solo después de validar que todo funciona
-- Y que no hay movimientos nuevos usando el campo viejo
ALTER TABLE movimientos DROP COLUMN proyecto;
```

---

## 💡 Ventajas de Esta Migración

### **1. Autocomplete Inteligente**
```
Usuario escribe: "casa"
Sistema muestra:
  ✓ Casa Juárez (Activo - Inicio: 15/10/2025)
  ✓ Casa Rodríguez (Completado - 2024)
  + Crear nuevo proyecto "Casa..."
```

### **2. Trazabilidad Completa**
```sql
-- Ver todos los movimientos de un proyecto
SELECT * FROM movimientos
WHERE proyecto_id = 5;

-- Calcular costo total de materiales del proyecto
SELECT
  p.nombre as proyecto,
  SUM(dm.cantidad * a.costo_unitario) as costo_total
FROM proyectos p
JOIN movimientos m ON m.proyecto_id = p.id
JOIN detalle_movimientos dm ON dm.movimiento_id = m.id
JOIN articulos a ON a.id = dm.articulo_id
WHERE p.id = 5
GROUP BY p.id, p.nombre;
```

### **3. Reportes Potentes**
- Proyectos activos del mes
- Costos por proyecto
- Materiales más usados por proyecto
- Eficiencia de equipos por proyecto

### **4. Calendario Visual**
```
Noviembre 2025
─────────────────────────────────────
15 Nov | Casa Juárez        [Equipo A]
18 Nov | Centro Comercial   [Equipo B]
20 Nov | Casa Rodríguez     [Equipo A]
25 Nov | Obra Industrial    [Equipo C]
```

---

## 🚦 Comparativa: Antes vs Después

| Característica | ANTES (texto libre) | DESPUÉS (normalizado) |
|----------------|---------------------|----------------------|
| **Consistencia** | ❌ "casa juarez" vs "Casa Juárez" | ✅ Un solo proyecto |
| **Autocomplete** | ❌ No existe | ✅ Búsqueda inteligente |
| **Trazabilidad** | ❌ Difícil (queries complejos) | ✅ JOIN simple |
| **Reportes** | ❌ Requiere normalización manual | ✅ Directo desde DB |
| **Información adicional** | ❌ Solo nombre | ✅ Fecha, cliente, estado, etc. |
| **Calendario** | ❌ Imposible | ✅ Nativo |
| **Validación** | ❌ Cualquier texto | ✅ Solo proyectos existentes |
| **Migración** | - | ✅ Sin pérdida de datos |

---

## 📊 Estadísticas de Proyectos Actuales

```
Movimientos analizados: [verificar en producción]
Proyectos únicos encontrados: [verificar]
Movimientos con proyecto: [X]%
Movimientos sin proyecto: [Y]%
```

---

## ✅ Recomendación Final

### **SÍ, migrar a tabla normalizada porque:**

1. ✅ **No pierdes datos** - Migración conserva todo
2. ✅ **Mejora UX** - Autocomplete, sin typos
3. ✅ **Habilita calendario** - Base para módulo de calendario
4. ✅ **Reportes potentes** - Costos, trazabilidad
5. ✅ **Escalable** - Preparado para crecimiento
6. ✅ **Migración gradual** - Sin riesgos

### **Flujo de Implementación:**

```
Semana 1: Crear tabla proyectos + proyecto_id
Semana 2: Migrar datos existentes
Semana 3: Actualizar backend (API)
Semana 4: Actualizar frontend (autocomplete)
Semana 5: Agregar módulo calendario
```

### **Compatibilidad hacia atrás:**

- ✅ Campo `proyecto` se mantiene temporalmente
- ✅ APIs existentes siguen funcionando
- ✅ Frontend antiguo sigue funcionando
- ✅ Migración transparente para usuarios

---

## 🚀 Siguiente Paso Sugerido

**Opción A: Empezar con migración ahora**
- Crear tabla proyectos
- Agregar campo proyecto_id
- Migrar datos existentes
- Luego agregar calendario

**Opción B: Primero validar datos**
- Hacer query de proyectos actuales
- Ver cuántos movimientos tienen proyecto
- Identificar proyectos duplicados
- Planear limpieza antes de migrar

**¿Cuál prefieres?** 🤔
