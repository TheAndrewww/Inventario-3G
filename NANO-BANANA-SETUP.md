# Configuración de Nano Banana - Mejora de Imágenes con IA

Esta guía explica cómo configurar y utilizar la integración con Nano Banana para mejorar automáticamente la calidad de las fotos de productos en el inventario.

## ¿Qué es Nano Banana?

Nano Banana es una API de inteligencia artificial que procesa imágenes para mejorar su calidad. En este sistema:

- **Convierte fotos casuales en imágenes profesionales de catálogo**
- **Elimina fondos y los reemplaza con fondo blanco**
- **Mejora iluminación, nitidez y colores**
- **Si hay múltiples objetos idénticos, muestra solo uno**

## Configuración

### 1. Obtener API Key de Nano Banana

1. Regístrate en [https://nanobanana.com](https://nanobanana.com)
2. Obtén tu API key desde el panel de control
3. Copia la API key

### 2. Configurar Variables de Entorno

#### Desarrollo Local

Agrega las siguientes variables a tu archivo `.env` en `/backend/`:

```env
NANO_BANANA_API_KEY=tu_api_key_aqui
NANO_BANANA_API_URL=https://api.nanobanana.com/v1/process
```

#### Producción (Railway)

Agrega las variables de entorno en el panel de Railway:

1. Ve a tu proyecto en Railway
2. Click en "Variables"
3. Agrega las variables:
   - `NANO_BANANA_API_KEY`: tu API key
   - `NANO_BANANA_API_URL`: `https://api.nanobanana.com/v1/process`

## Cómo Funciona

### Procesamiento Automático

**Fotos de Cámara**: Se procesan automáticamente con IA
- Cuando tomas una foto con la cámara del dispositivo
- El sistema detecta que es de cámara
- La procesa con Nano Banana antes de guardarla
- Tiempo estimado: 5-15 segundos

**Archivos Subidos**: NO se procesan automáticamente
- Cuando subes un archivo desde tu computadora
- Se guarda directamente sin procesamiento
- Asumimos que ya están editadas o son de mejor calidad

### Reprocesar Imágenes Existentes

Puedes reprocesar manualmente cualquier imagen existente:

1. Abre el modal de detalles del artículo
2. Verás un botón **"Mejorar IA"** debajo de la imagen
3. Haz clic en el botón
4. Confirma la acción
5. Espera 5-15 segundos
6. La imagen se actualiza automáticamente

## Prompt de Procesamiento

El sistema utiliza este prompt optimizado para artículos de inventario:

```
Convierte esta foto en una imagen de catálogo profesional. Si la imagen contiene
múltiples piezas idénticas del mismo artículo, muestra solo una unidad representativa
centrada. Mantén el objeto exactamente igual, respetando su forma, color, textura y
proporciones originales. Mejora la iluminación y la nitidez para que parezca una
fotografía de producto de alta calidad. El fondo debe ser completamente blanco
(#FFFFFF), limpio y uniforme, sin sombras duras ni ruido. El estilo debe ser
realista, con acabado nítido, enfoque perfecto y calidad fotográfica tipo estudio
profesional. No modificar el diseño del artículo ni agregar elementos extras, solo
mejorar la presentación fotográfica como producto profesional para inventario.
```

## Manejo de Errores

El sistema tiene múltiples fallbacks:

1. **Si Nano Banana no está configurado**: Las fotos se suben normalmente sin procesamiento
2. **Si la API falla**: Se guarda la imagen original
3. **Si hay timeout**: Se guarda la imagen original

Los errores se registran en la consola del servidor para debugging.

## Costos

- **Nano Banana cobra por procesamiento de imagen**
- Revisa la página de precios de Nano Banana para calcular costos
- Solo se procesa cuando:
  - Se toma una foto con la cámara (automático)
  - Se hace clic en "Mejorar IA" (manual)

## Permisos

Solo usuarios con permisos de edición pueden:
- Reprocesar imágenes existentes
- Ver el botón "Mejorar IA"

Roles con permiso:
- Administrador
- Supervisor/Encargado
- Almacenista

## Ejemplos de Uso

### Escenario 1: Nueva Foto de Producto
```
1. Usuario abre formulario de crear/editar artículo
2. Hace clic en "Tomar fotografía"
3. Toma foto del producto con su teléfono
4. Sistema detecta que es de cámara
5. Procesa con Nano Banana (5-15 seg)
6. Guarda imagen mejorada en Cloudinary
7. Usuario ve resultado final
```

### Escenario 2: Subir Foto Existente
```
1. Usuario sube archivo desde computadora
2. Sistema detecta que es archivo subido
3. NO procesa con IA
4. Guarda directamente en Cloudinary
5. Imagen disponible inmediatamente
```

### Escenario 3: Mejorar Foto Anterior
```
1. Usuario abre modal de detalles
2. Ve imagen existente
3. Hace clic en botón "Mejorar IA"
4. Sistema procesa con Nano Banana
5. Reemplaza imagen anterior
6. Nueva imagen se muestra automáticamente
```

## Troubleshooting

### La imagen no se procesa
- Verifica que `NANO_BANANA_API_KEY` esté configurada
- Revisa los logs del servidor para ver errores
- Verifica que la API key sea válida

### El procesamiento tarda mucho
- Nano Banana puede tardar 5-15 segundos
- Si tarda más, puede ser problema de conexión
- Revisa timeout en el código (actualmente 30 segundos)

### Error de API
- Verifica cuota de Nano Banana
- Revisa límites de uso de tu plan
- Consulta logs para ver el error exacto

## Soporte Técnico

Para problemas o dudas:
1. Revisa logs del servidor (`console.log`)
2. Verifica configuración de variables
3. Consulta documentación de Nano Banana
4. Contacta soporte si el problema persiste

---

**Última actualización**: 2025-01-20
