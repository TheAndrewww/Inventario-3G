# 🔄 Migrar Artículos de Herramientas Existentes

## 📋 Introducción

Si ya tienes artículos de herramientas en tu sistema y necesitas migrarlos al nuevo modelo de herramientas de renta, usa estos scripts.

---

## 🎯 ¿Qué hacen estos scripts?

1. **Identifican** qué artículos son herramientas
2. **Los marcan** con `es_herramienta = true`
3. **Los migran** al nuevo sistema:
   - Crean un `tipo_herramienta_renta`
   - Generan unidades individuales basándose en el stock
   - Asignan códigos únicos (ej: PP-001, PP-002)

---

## 📝 Métodos Disponibles

### **Método 1: Interactivo (Recomendado para primera vez)**

Lista todos los artículos y te permite seleccionar manualmente cuáles son herramientas.

```bash
railway run node scripts/identificar-y-migrar-herramientas.js
```

**Proceso:**
1. Muestra todos los artículos activos
2. Tú ingresas los números de los que son herramientas (ej: 1,3,5)
3. Confirmas
4. Migra automáticamente

---

### **Método 2: Automático por Palabras Clave**

Busca artículos que contengan palabras clave en el nombre.

```bash
# Ejemplo: Migrar todas las pistolas y compresores
railway run node scripts/migrar-herramientas-auto.js --keywords "pistola,compresor"

# Ejemplo: Migrar taladros, sierras y amoladoras
railway run node scripts/migrar-herramientas-auto.js --keywords "taladro,sierra,amoladora"
```

**Palabras clave predefinidas:**
- pistola, compresor, taladro, sierra, amoladora
- lijadora, pulidora, martillo, esmeril, cortadora
- soldadora, generador, escalera, andamio

---

### **Método 3: Automático por Categoría**

Migra todos los artículos de una categoría específica.

```bash
# Ejemplo: Migrar todo de categoría "Herramientas"
railway run node scripts/migrar-herramientas-auto.js --categoria "Herramientas"

# Ejemplo: Migrar todo de categoría "Equipos de Pintura"
railway run node scripts/migrar-herramientas-auto.js --categoria "Equipos de Pintura"
```

---

### **Método 4: Por IDs Específicos**

Si sabes exactamente qué artículos migrar por su ID.

```bash
# Ejemplo: Migrar artículos con IDs 5, 12, 18, 23
railway run node scripts/migrar-herramientas-auto.js --ids "5,12,18,23"
```

---

### **Método 5: Migrar Todos**

⚠️ **CUIDADO**: Migra TODOS los artículos activos.

```bash
railway run node scripts/migrar-herramientas-auto.js --todos
```

---

## 🚀 Proceso Paso a Paso

### **PASO 1: Conectar a Railway**

```bash
railway login
railway link  # Selecciona tu proyecto
```

### **PASO 2: Ver qué artículos tienes**

```bash
# Opcional: Ver todos los artículos primero
railway run node -e "
const { Articulo, Categoria } = require('./src/models/index.js');
Articulo.findAll({ include: [{ model: Categoria, as: 'categoria' }] })
  .then(arts => arts.forEach((a, i) => console.log(\`\${i+1}. \${a.nombre} (\${a.categoria?.nombre})\`)))
  .then(() => process.exit());
"
```

### **PASO 3: Ejecutar Migración**

**Opción A: Interactivo (Primera vez)**
```bash
railway run node scripts/identificar-y-migrar-herramientas.js
```

**Opción B: Por palabras clave**
```bash
railway run node scripts/migrar-herramientas-auto.js --keywords "pistola,compresor"
```

### **PASO 4: Verificar Migración**

```bash
# Ver tipos de herramientas creados
railway run node -e "
const { TipoHerramientaRenta } = require('./src/models/index.js');
TipoHerramientaRenta.findAll()
  .then(tipos => {
    console.log('Tipos creados:', tipos.length);
    tipos.forEach(t => console.log(\`  - \${t.nombre} [\${t.prefijo_codigo}] - \${t.total_unidades} unidades\`));
  })
  .then(() => process.exit());
"
```

---

## 📊 Ejemplo Completo

### **Escenario:** Tienes 3 pistolas de pintura en artículos y quieres migrarlas

**1. Ver artículos actuales:**
```bash
railway shell
node -e "require('./src/models/index.js').Articulo.findAll().then(a => a.forEach(x => console.log(x.id, x.nombre)))"
```

**Salida:**
```
1 Pistola de Pintura HVLP
2 Pistola de Pintura Airless
3 Pistola de Pintura Gravedad
4 Tornillos
5 Tuercas
```

**2. Migrar solo las pistolas:**
```bash
node scripts/migrar-herramientas-auto.js --ids "1,2,3"
```

**O por palabra clave:**
```bash
node scripts/migrar-herramientas-auto.js --keywords "pistola"
```

**3. Resultado:**
```
✅ Migración completada
📊 Artículos migrados: 3

Tipos creados:
1. Pistola de Pintura HVLP → PH (Stock: 5 → 5 unidades)
   Códigos: PH-001, PH-002, PH-003, PH-004, PH-005

2. Pistola de Pintura Airless → PA (Stock: 3 → 3 unidades)
   Códigos: PA-001, PA-002, PA-003

3. Pistola de Pintura Gravedad → PG (Stock: 2 → 2 unidades)
   Códigos: PG-001, PG-002
```

---

## ⚠️ Consideraciones Importantes

### **Stock y Unidades**
- Si un artículo tiene `stock_actual = 5`, se crearán 5 unidades
- Si tiene `stock_actual = 0`, se creará 1 unidad mínimo
- Cada unidad tendrá su propio código único

### **Artículos Originales**
- Los artículos originales NO se eliminan
- Se mantienen vinculados con `articulo_origen_id`
- Se marca en observaciones que fueron migrados

### **Reversibilidad**
- La migración NO es reversible automáticamente
- Haz backup antes de migrar (Railway hace backups automáticos)
- En caso de error, restaura desde backup

### **Verificación**
Después de migrar, verifica en la aplicación:
1. Ve a "Herramientas de Renta"
2. Debes ver los tipos creados
3. Click en "Ver Unidades" para ver las unidades individuales
4. Cada unidad debe tener su código único

---

## 🆘 Solución de Problemas

### **Error: "No se encontraron artículos"**
- Verifica que existan artículos con `activo = true`
- Verifica que no estén ya marcados con `es_herramienta = true`

### **Error: "Prefijo duplicado"**
- El script automáticamente genera prefijos únicos
- Si hay conflicto, agrega un número (PP1, PP2, etc.)

### **Error de conexión**
```bash
# Verifica que estés conectado
railway whoami

# Verifica el proyecto
railway status
```

---

## 📞 Ayuda

Si tienes problemas:
1. Revisa los logs: `railway logs`
2. Verifica la base de datos en Railway Dashboard
3. Restaura desde backup si es necesario

---

## ✅ Checklist

- [ ] Hice backup de la base de datos
- [ ] Identifiqué qué artículos son herramientas
- [ ] Elegí el método de migración apropiado
- [ ] Ejecuté el script de migración
- [ ] Verifiqué en la aplicación que se crearon los tipos
- [ ] Verifiqué que se crearon las unidades correctas
- [ ] Probé generar códigos de barras de las unidades

---

**¡Listo! Tus herramientas ahora están en el nuevo sistema con unidades individuales rastreables.** 🎉
