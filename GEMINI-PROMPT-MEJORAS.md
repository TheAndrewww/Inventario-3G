# 🎨 Mejoras al Prompt de Gemini - Procesamiento Contextual

## 🎯 Objetivo

Mejorar la generación de imágenes de productos usando IA generativa (Gemini) mediante:

1. **Contexto del artículo**: Usar nombre, descripción y unidad en el prompt
2. **Detección de dimensiones**: Identificar automáticamente artículos con variaciones de tamaño
3. **Líneas de señalamiento**: Agregar cotas/acotaciones cuando el artículo tiene medidas

## ✨ Características Implementadas

### 1. **Detección Automática de Dimensiones**

El sistema detecta automáticamente si un artículo tiene dimensiones/medidas usando patrones como:

- **Fracciones**: `1/4"`, `3/8"`, `5/16"`
- **Unidades métricas**: `20mm`, `5cm`, `10m`
- **Unidades imperiales**: `3"`, `2 pulg`
- **Roscas métricas**: `M10`, `M8`, `M12`
- **Dimensiones**: `10x20`, `5x8x10`
- **Calibres**: `#8`, `#10`, `#12`
- **Pesos**: `5kg`, `10lb`, `500g`

### 2. **Prompt Dinámico Contextual**

El prompt ahora incluye información del artículo para generar imágenes más precisas:

```javascript
// Ejemplo de artículo SIN dimensiones
{
    nombre: "Cable eléctrico",
    descripcion: "Cable de cobre para instalaciones eléctricas"
}
```

**Prompt generado:**
```
Genera una imagen de catálogo profesional de alta calidad basada en esta foto de producto.
El producto es: "Cable eléctrico". Descripción: "Cable de cobre para instalaciones eléctricas".

Instrucciones generales:
- Si la imagen contiene múltiples piezas idénticas, muestra SOLO UNA UNIDAD representativa centrada
- Mantén el objeto EXACTAMENTE igual: misma forma, color, textura y proporciones originales
- Mejora la iluminación para que parezca fotografía de estudio profesional
- Fondo completamente blanco puro (#FFFFFF), limpio, uniforme, sin sombras duras
...
```

---

```javascript
// Ejemplo de artículo CON dimensiones
{
    nombre: "Tornillo hexagonal 3/8\"",
    descripcion: "Tornillo de acero inoxidable grado 8",
    unidad: "piezas"
}
```

**Prompt generado:**
```
Genera una imagen de catálogo profesional de alta calidad basada en esta foto de producto.
El producto es: "Tornillo hexagonal 3/8"". Descripción: "Tornillo de acero inoxidable grado 8".

Este artículo tiene especificaciones de tamaño/medidas. IMPORTANTE: Agrega líneas de señalamiento
(líneas de acotación o cotas) sutiles y profesionales que indiquen las dimensiones principales del
producto. Las líneas deben ser finas, en color gris oscuro (#333333), con flechas pequeñas en los
extremos, ubicadas estratégicamente sin obstruir el producto. Estilo técnico de dibujo industrial
pero minimalista.

Instrucciones generales:
- Si la imagen contiene múltiples piezas idénticas, muestra SOLO UNA UNIDAD representativa centrada
- Mantén el objeto EXACTAMENTE igual: misma forma, color, textura y proporciones originales
...
- Unidad de medida del producto: piezas
```

## 📊 Ejemplos de Artículos Detectados

### ✅ SE DETECTAN (con líneas de señalamiento):

| Nombre | Descripción | ¿Detectado? |
|--------|-------------|-------------|
| Tornillo Allen 1/4" | Tornillo de acero | ✅ Sí (1/4) |
| Tuerca hexagonal M10 | Tuerca galvanizada | ✅ Sí (M10) |
| Cable 20mm | Cable eléctrico | ✅ Sí (20mm) |
| Placa 10x20cm | Placa de acero | ✅ Sí (10x20cm) |
| Ancla #8 | Ancla de expansión | ✅ Sí (#8) |
| Varilla 5kg | Varilla de refuerzo | ✅ Sí (5kg) |

### ❌ NO SE DETECTAN (sin líneas de señalamiento):

| Nombre | Descripción | ¿Detectado? |
|--------|-------------|-------------|
| Cable eléctrico | Cable de cobre | ❌ No |
| Pintura blanca | Pintura látex | ❌ No |
| Martillo | Herramienta manual | ❌ No |
| Cinta adhesiva | Cinta doble cara | ❌ No |

## 🔧 Cambios Técnicos

### 1. **Servicio `nanoBanana.service.js`**

#### Antes:
```javascript
export const procesarImagenConNanoBanana = async (imageBuffer, imageName = 'image.jpg')
```

#### Ahora:
```javascript
export const procesarImagenConNanoBanana = async (imageBuffer, options = {})
// options: { imageName, nombre, descripcion, unidad }
```

### 2. **Controlador `articulos.controller.js`**

#### Al subir imagen desde cámara:
```javascript
const processedBuffer = await procesarImagenConNanoBanana(imageBuffer, {
    imageName: req.file.originalname,
    nombre: articulo.nombre,
    descripcion: articulo.descripcion,
    unidad: articulo.unidad
});
```

#### Al reprocesar imagen existente:
```javascript
const processedBuffer = await procesarImagenDesdeUrl(articulo.imagen_url, {
    nombre: articulo.nombre,
    descripcion: articulo.descripcion,
    unidad: articulo.unidad
});
```

## 🧪 Cómo Probar

### Paso 1: Crear artículos de prueba

```bash
# Iniciar el backend
cd backend
npm run dev
```

### Paso 2: Crear artículos con dimensiones

1. **Artículo con fracciones**: "Tornillo hexagonal 3/8"
2. **Artículo con unidades métricas**: "Tubo de PVC 20mm"
3. **Artículo con roscas**: "Tornillo M10"
4. **Artículo sin dimensiones**: "Cable eléctrico rojo"

### Paso 3: Subir fotos desde la app

1. Toma una foto del producto desde la app móvil
2. Revisa los logs del backend para ver el prompt generado
3. Verifica que la imagen procesada tenga las mejoras

### Logs esperados para artículo CON dimensiones:

```
📸 Foto de cámara detectada, procesando con Gemini...
✨ Iniciando procesamiento con Gemini (gemini-2.5-flash-image): photo.jpg
   📦 Artículo: Tornillo hexagonal 3/8"
   📝 Prompt generado: Genera una imagen de catálogo profesional de alta calidad basada en esta foto de producto. El producto es: "Tornillo hexagonal 3/8""...
✅ Respuesta recibida de Gemini
✅ Imagen encontrada en formato inlineData (mime: image/png)
✅ Imagen procesada exitosamente con Gemini (gemini-2.5-flash-image)
✅ Imagen procesada con Gemini usando contexto del artículo
☁️ Imagen subida a Cloudinary
```

## 📋 Casos de Uso

### Caso 1: Tornillos de diferentes tamaños

**Antes**: Todas las fotos de tornillos se veían similares, difícil distinguir el tamaño

**Ahora**:
- Tornillo 1/4" → Imagen con líneas mostrando el tamaño
- Tornillo 3/8" → Imagen con líneas mostrando el tamaño
- Tornillo 1/2" → Imagen con líneas mostrando el tamaño

Cada imagen tiene líneas de acotación que indican visualmente las dimensiones principales.

### Caso 2: Tubos de PVC de diferentes diámetros

**Antes**: Difícil saber el diámetro solo viendo la foto

**Ahora**:
- Tubo 20mm → Imagen con líneas de diámetro
- Tubo 32mm → Imagen con líneas de diámetro
- Tubo 50mm → Imagen con líneas de diámetro

### Caso 3: Productos sin dimensiones específicas

**Antes y Ahora**: Mismo comportamiento, solo mejora de calidad fotográfica

Ejemplo: "Cable eléctrico rojo" → Imagen limpia, fondo blanco, buena iluminación

## 🎨 Resultados Esperados

### Para artículos CON dimensiones:

```
┌────────────────────────────────┐
│                                │
│     ┌──────────────┐          │
│     │              │          │
│  ←──│   Tornillo   │──→       │  ← 3/8"
│     │              │          │
│     └──────────────┘          │
│          ↑                    │
│          │ 2"                 │
│          ↓                    │
│                                │
│     Fondo blanco puro          │
└────────────────────────────────┘
```

Características:
- ✅ Fondo blanco limpio
- ✅ Iluminación profesional
- ✅ Objeto centrado y único
- ✅ **Líneas de señalamiento con medidas**
- ✅ Estilo técnico pero elegante

### Para artículos SIN dimensiones:

```
┌────────────────────────────────┐
│                                │
│                                │
│      [Cable eléctrico]         │
│                                │
│                                │
│     Fondo blanco puro          │
└────────────────────────────────┘
```

Características:
- ✅ Fondo blanco limpio
- ✅ Iluminación profesional
- ✅ Objeto centrado y único
- ❌ Sin líneas de señalamiento

## 🔍 Patrones de Detección

### Expresiones Regulares Usadas:

```javascript
const patronesDimensiones = [
    /\d+\/\d+/,                    // 1/4, 3/8, 5/16
    /\d+\s*(mm|cm|m|pulg|"|')/i,  // 20mm, 5cm, 3"
    /m\d+/i,                       // M10, M8, M12
    /\d+x\d+/,                     // 10x20, 5x8
    /#\d+/,                        // #8, #10
    /\d+\s*(kg|g|lb)/i             // 5kg, 10lb
];
```

## ✅ Beneficios

1. **Mejor identificación visual**: Las líneas de señalamiento ayudan a distinguir artículos similares
2. **Contexto en el prompt**: Gemini entiende mejor qué tipo de producto es
3. **Automatización inteligente**: Detecta automáticamente cuándo agregar líneas
4. **Consistencia**: Mismo estilo profesional para todos los productos
5. **Escalabilidad**: Funciona para cualquier artículo con dimensiones en su nombre

## 🚀 Próximos Pasos

### Opcionales (futuras mejoras):

1. **Configuración de estilo de líneas**: Permitir al usuario elegir el color y estilo
2. **Detección de familias de productos**: Agrupar artículos similares automáticamente
3. **Múltiples vistas**: Generar imagen frontal, lateral y superior
4. **Metadatos en la imagen**: Incluir texto con las especificaciones técnicas
5. **Comparación visual**: Generar imagen con varios tamaños lado a lado

## 📝 Notas Importantes

- Las líneas de señalamiento son **automáticas** basadas en la detección de dimensiones
- Gemini decide **dónde** colocar las líneas basándose en el producto
- El sistema **no modifica** el objeto original, solo agrega las líneas de acotación
- Si Gemini falla, el sistema usa la imagen original sin procesamiento
- El procesamiento toma entre 10-30 segundos dependiendo del modelo usado

---

**Implementado el:** 2025-01-20
**Versión:** 1.0
**Estado:** ✅ Listo para pruebas
