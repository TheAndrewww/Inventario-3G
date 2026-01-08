# 📱 Cambio de Códigos de Barras a QR para Herramientas

## 🎯 Objetivo
Cambiar el sistema de identificación de herramientas de **código de barras EAN-13** a **código QR** para mejorar la trazabilidad y facilitar el escaneo.

---

## ✅ Cambios Implementados

### 1. **Controller: articulos.controller.js**
Modificada la función `generarEtiquetasMixtas()` (línea ~909-920):

**Antes:**
```javascript
unidades.forEach(u => {
    etiquetas.push({
        nombre: `${u.tipoHerramienta.nombre} - ${u.codigo_unico}`,
        codigo_ean13: u.codigo_ean13,
        codigo_tipo: u.codigo_tipo || 'EAN13', // ❌ Código de barras
        imagen_url: u.tipoHerramienta?.imagen_url,
        tipo: 'unidad'
    });
});
```

**Después:**
```javascript
unidades.forEach(u => {
    const codigoQR = u.codigo_unico; // Ej: PP-001, CP-005

    etiquetas.push({
        nombre: `${u.tipoHerramienta.nombre} - ${u.codigo_unico}`,
        codigo_ean13: codigoQR, // ✅ Código único en el QR
        codigo_tipo: 'QRCODE', // ✅ Cambiado a QR
        imagen_url: u.tipoHerramienta?.imagen_url,
        tipo: 'unidad'
    });
});
```

### 2. **Generator: label-generator.js**
Mejorada la generación de códigos QR (línea ~71-75):

**Cambios:**
- ✅ Tamaño aumentado de 50x50 a 60x60 pixeles
- ✅ Nivel de corrección de errores 'M' (15% de redundancia)
- ✅ Logging para identificar cuándo se genera un QR

```javascript
if (bcid === 'qrcode') {
    config.eclevel = 'M'; // Nivel de corrección de errores
    config.width = 60; // ✅ Aumentado para mejor escaneo
    config.height = 60; // ✅ QR cuadrado más grande
    console.log(`📱 Generando QR code para: ${codigo.substring(0, 30)}...`);
}
```

---

## 📊 Comparación: Código de Barras vs QR

| Aspecto | Código de Barras EAN-13 | Código QR |
|---------|------------------------|-----------|
| **Formato** | Líneas verticales | Matriz cuadrada |
| **Capacidad** | Solo números (13 dígitos) | Alfanumérico (hasta 4,296 caracteres) |
| **Tamaño** | Requiere espacio horizontal | Compacto y cuadrado |
| **Escaneo** | Requiere scanner láser o app específica | Cualquier cámara de celular |
| **Contenido** | Solo código numérico | Código único descriptivo (PP-001) |
| **Orientación** | Debe estar horizontal | Cualquier orientación |
| **Durabilidad** | Sensible a daños | Resistente (corrección de errores) |

---

## 🔍 Contenido del Código QR

Los códigos QR de las herramientas ahora contienen el **código único** de la unidad:

**Ejemplos:**
- `PP-001` - Pistola de pintar #001
- `CP-005` - Compresor #005
- `TA-012` - Taladro #012

**Ventajas:**
✅ Código legible por humanos
✅ Fácil de identificar sin escanear
✅ Único por unidad de herramienta
✅ No requiere base de datos para lectura básica

---

## 🧪 Cómo Probar

### Localmente:

```bash
# Terminal 1: Iniciar backend
cd backend
npm run dev

# Terminal 2: Ejecutar prueba
./test-herramientas-qr.sh
```

**El script:**
1. Lista las herramientas disponibles
2. Genera un PDF con etiquetas QR
3. Abre el PDF automáticamente
4. Muestra instrucciones de verificación

### Verificar en la consola del backend:

Busca líneas como:
```
📱 Generando QR code para: PP-001
📱 Generando QR code para: CP-005
```

### Escanear los QR:

1. Abre la app de cámara de tu celular
2. Apunta al código QR en el PDF
3. Deberías ver el código único (ej: `PP-001`)

---

## 📱 Compatibilidad

### Escaneo de QR soportado en:
- ✅ App de Cámara nativa (iOS 11+, Android 9+)
- ✅ Google Lens
- ✅ Apps de escaneo de QR (QR Code Reader, etc.)
- ✅ Navegadores modernos (con permiso de cámara)

### No requiere:
- ❌ Scanner láser dedicado
- ❌ Apps especializadas de código de barras
- ❌ Configuración especial

---

## 🔄 Migración

### Herramientas Existentes

Las herramientas que ya tienen códigos EAN-13 **no se ven afectadas**:
- El campo `codigo_ean13` sigue existiendo en la base de datos
- Las nuevas etiquetas usarán QR con `codigo_unico`
- No se requiere migración de datos

### Recomendación:

1. **Generar nuevas etiquetas QR** para todas las herramientas
2. **Reemplazar etiquetas físicas** cuando sea conveniente
3. **Opcionalmente**: Limpiar campo `codigo_ean13` de herramientas

---

## 📦 Archivos Modificados

1. ✅ `backend/src/controllers/articulos.controller.js`
   - Función `generarEtiquetasMixtas()` actualizada

2. ✅ `backend/src/utils/label-generator.js`
   - Tamaño de QR aumentado
   - Logging agregado

3. ✅ `test-herramientas-qr.sh` (nuevo)
   - Script de prueba

4. ✅ `CAMBIO-HERRAMIENTAS-QR.md` (este archivo)
   - Documentación del cambio

---

## 🚀 Despliegue a Producción

```bash
# 1. Commit de cambios
git add backend/src/controllers/articulos.controller.js
git add backend/src/utils/label-generator.js
git add test-herramientas-qr.sh CAMBIO-HERRAMIENTAS-QR.md

git commit -m "Feat: Cambiar herramientas a códigos QR

- Cambiar de código de barras EAN-13 a código QR para herramientas
- Usar codigo_unico (ej: PP-001) como contenido del QR
- Aumentar tamaño de QR a 60x60 para mejor escaneo
- Agregar logging para identificar generación de QR
- Crear script de prueba test-herramientas-qr.sh

Beneficios:
- Escaneo más fácil con cualquier cámara de celular
- No requiere scanner láser dedicado
- Código legible por humanos (PP-001)
- Mayor capacidad de almacenamiento de información"

# 2. Push a GitHub
git push origin main

# 3. Railway desplegará automáticamente
```

### Verificar en producción:

```bash
# Ver logs
railway logs

# Buscar generación de QR
railway logs | grep "QR code"
```

---

## 💡 Futuras Mejoras

### Posibles extensiones:

1. **QR con URL completa**:
   ```
   https://inventario-3g.com/herramientas/PP-001
   ```
   - Redirección directa al detalle de la herramienta
   - Acceso rápido desde cualquier dispositivo

2. **Información adicional en QR**:
   ```json
   {
     "codigo": "PP-001",
     "tipo": "Pistola de Pintar",
     "ubicacion": "Almacén Central"
   }
   ```
   - Datos contextuales sin conexión

3. **Versionamiento de QR**:
   - Actualizar QR sin reimprimir etiquetas
   - Usar sistema de redirección

4. **Integración con app móvil**:
   - Escaneo directo para asignación/devolución
   - Historial de escaneos
   - Geolocalización de equipos

---

## 📞 Soporte

Si algo no funciona:

1. Revisa la consola del backend para logs
2. Ejecuta `./test-herramientas-qr.sh` localmente
3. Verifica que las herramientas tengan `codigo_unico` definido
4. Prueba escaneando el QR con tu celular

---

**Actualizado:** 2 de Diciembre, 2025 - 11:58 PM
**Estado:** ✅ Implementado y listo para desplegar
