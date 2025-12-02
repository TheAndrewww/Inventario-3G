# 🔧 Solución al Error "Unknown image format" en Etiquetas

## ❌ Problema
Cuando se generan etiquetas masivas con fotos, algunos artículos muestran el error:
```
Error: Unknown image format
```

## 🔍 Causa
PDFKit (la librería que genera los PDFs) solo soporta **JPEG** y **PNG**. Cloudinary puede estar devolviendo imágenes en otros formatos como **WebP** (más eficiente pero no compatible con PDFKit).

## ✅ Solución Implementada
Se agregó la librería `sharp` que:
- Detecta automáticamente el formato de la imagen
- Convierte **cualquier formato** (WebP, AVIF, GIF, etc.) a PNG
- Valida que la imagen sea correcta antes de insertarla en el PDF
- Agrega logging detallado para diagnosticar problemas

---

## 📦 Instalación

### 1️⃣ Instalación Local (Desarrollo)

```bash
cd backend
npm install sharp@^0.33.5
```

### 2️⃣ Desplegar a Producción (Railway)

#### Opción A: Usando Git (Recomendado)

```bash
# Desde la raíz del proyecto
git add backend/package.json backend/src/utils/label-generator.js
git commit -m "Fix: Agregar soporte para conversión de imágenes con sharp en etiquetas"
git push

# Railway detectará los cambios y reinstalará las dependencias automáticamente
```

#### Opción B: Usando Railway CLI

```bash
cd backend
railway up
```

### 3️⃣ Verificar Instalación en Railway

```bash
# Ver logs del deploy
railway logs

# Deberías ver algo como:
# "added 1 package, and audited XXX packages in Xs"
# "sharp@0.33.5"
```

---

## 🧪 Probar la Solución

### Localmente:

```bash
# Terminal 1: Iniciar backend
cd backend
npm run dev

# Terminal 2: Generar etiquetas desde el frontend
# Observa la consola del backend, ahora verás:
# 📥 [Nombre Artículo] Intentando cargar imagen: https://...
# ✅ [Nombre Artículo] Imagen descargada (45234 bytes)
# 📋 [Nombre Artículo] Formato detectado: webp (800x600)
# ✅ [Nombre Artículo] Imagen convertida a PNG (123456 bytes)
```

### En Producción:

```bash
# Ver logs en tiempo real
railway logs --service backend

# Buscar las líneas de conversión de imágenes
railway logs --service backend | grep "Formato detectado"
```

---

## 📊 Logs Mejorados

Ahora verás logs detallados en la consola al generar etiquetas:

### ✅ Ejemplo de éxito:
```
📥 [Cable THHN #12] Intentando cargar imagen: https://res.cloudinary.com/...
✅ [Cable THHN #12] Imagen descargada (45234 bytes)
📋 [Cable THHN #12] Formato detectado: webp (800x600)
✅ [Cable THHN #12] Imagen convertida a PNG (87654 bytes)
```

### ⚠️ Ejemplo sin imagen:
```
⚠️  [Tornillo 1/4"] No tiene imagen_url definida
```

### ❌ Ejemplo de error:
```
❌ [Tuerca 3/8"] Error cargando imagen https://...
   Tipo: AxiosError
   Mensaje: timeout of 30000ms exceeded
   Código: ECONNABORTED
```

---

## 🚀 Beneficios de la Solución

1. **Compatibilidad Universal**: Ahora soporta WebP, AVIF, GIF, TIFF, y cualquier formato que sharp pueda leer
2. **Validación Automática**: Detecta imágenes corruptas o inválidas antes de intentar insertarlas
3. **Logging Detallado**: Identifica exactamente qué artículos tienen problemas
4. **Mejor Rendimiento**: Sharp es muy rápido y eficiente
5. **Sin Cambios en el Frontend**: Todo funciona transparentemente

---

## 🐛 Solución de Problemas

### Si sharp falla al instalar en Railway:

Sharp necesita compilarse para el sistema operativo. Railway debería hacerlo automáticamente, pero si hay errores:

1. Verifica que el `package.json` tenga `"engines"` especificado:
   ```json
   "engines": {
     "node": ">=16.0.0",
     "npm": ">=8.0.0"
   }
   ```

2. Railway usará una imagen de Node.js compatible con sharp automáticamente

### Si algunas imágenes siguen fallando:

Usa el endpoint de diagnóstico:
```bash
# Localmente
./test-diagnostico-imagenes.sh

# En producción
./test-diagnostico-imagenes-produccion.sh
```

Esto te mostrará exactamente qué artículos tienen problemas con sus URLs de imágenes.

---

## 📝 Cambios Realizados

### Archivos Modificados:

1. **backend/package.json**
   - ✅ Agregada dependencia: `"sharp": "^0.33.5"`

2. **backend/src/utils/label-generator.js**
   - ✅ Importado sharp
   - ✅ Función `cargarImagenBuffer()` mejorada:
     - Detecta formato de imagen automáticamente
     - Convierte todas las imágenes a PNG
     - Logging detallado por artículo
     - Mejor manejo de errores

3. **backend/src/controllers/articulos.controller.js**
   - ✅ Nuevo endpoint `diagnosticarImagenes()` para verificar URLs

4. **backend/src/routes/articulos.routes.js**
   - ✅ Ruta agregada: `POST /api/articulos/diagnosticar-imagenes`

---

## ✨ Resultado Final

Ahora al generar etiquetas masivas:
- ✅ Todas las imágenes se convertirán automáticamente a PNG
- ✅ Los artículos sin imagen mostrarán un placeholder con emoji
- ✅ Los artículos con errores de red se manejarán correctamente
- ✅ Verás logs detallados de cada conversión
- ✅ El PDF se generará exitosamente incluso si algunas imágenes fallan
