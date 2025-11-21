# Guía de Pruebas - Integración Nano Banana

Esta guía te ayudará a probar la integración paso a paso en local.

## Pre-requisitos

✅ Dependencias instaladas (form-data ya está instalado)
✅ Backend corriendo en `localhost:5001`
✅ Frontend corriendo en `localhost:5173`

## Prueba 1: Sin Nano Banana Configurado (Fallback)

**Objetivo**: Verificar que el sistema funciona normalmente sin API key

### Pasos:

1. **NO configures** `NANO_BANANA_API_KEY` en tu `.env`
2. Reinicia el backend si está corriendo
3. Ve al inventario
4. Crea/edita un artículo
5. Toma una foto con la cámara

**Resultado esperado:**
- ✅ La foto se sube normalmente
- ✅ En consola del backend verás: `⚠️ Nano Banana no está configurado, usando imagen original`
- ✅ La imagen se guarda en Cloudinary sin procesamiento
- ✅ No hay errores

---

## Prueba 2: Subir Archivo (NO debe procesar con IA)

**Objetivo**: Verificar que archivos subidos NO se procesan

### Pasos:

1. Crea/edita un artículo
2. Click en "Subir desde archivo"
3. Selecciona una imagen de tu computadora

**Resultado esperado:**
- ✅ La imagen se sube inmediatamente
- ✅ En consola del backend verás: `📁 Archivo subido, sin procesamiento de Nano Banana`
- ✅ No intenta procesar con IA
- ✅ Se guarda directamente en Cloudinary

---

## Prueba 3: Con Nano Banana Configurado (Procesamiento IA)

**Objetivo**: Verificar procesamiento con IA

### Configuración previa:

1. Obtén API key de Nano Banana (si la tienes)
2. Agrega a `/backend/.env`:
   ```env
   NANO_BANANA_API_KEY=tu_api_key_aqui
   NANO_BANANA_API_URL=https://api.nanobanana.com/v1/process
   ```
3. Reinicia el backend

### Prueba 3.1: Foto de Cámara con IA

1. Crea/edita un artículo
2. Click en "Tomar fotografía"
3. Toma foto de un producto
4. Observa la consola del backend

**Resultado esperado:**
- ✅ Verás: `📸 Foto de cámara detectada, procesando con Nano Banana...`
- ✅ Verás: `🍌 Iniciando procesamiento con Nano Banana...`
- ✅ Espera 5-15 segundos
- ✅ Verás: `✅ Imagen procesada exitosamente con Nano Banana`
- ✅ Verás: `☁️ Imagen subida a Cloudinary`
- ✅ Frontend muestra mensaje: "Imagen subida exitosamente (procesada con IA)"
- ✅ La imagen tiene fondo blanco y mejor calidad

### Prueba 3.2: Reprocesar Imagen Existente

1. Ve a un artículo que YA tenga imagen
2. Abre el modal de detalles
3. Verás botón "Mejorar IA" debajo de la imagen
4. Click en el botón
5. Confirma la acción
6. Espera 5-15 segundos

**Resultado esperado:**
- ✅ Botón muestra loading spinner
- ✅ En consola del backend:
  - `🔄 Reprocesando imagen del artículo X...`
  - `🍌 Descargando imagen desde URL...`
  - `✅ Imagen procesada con Nano Banana`
  - `🗑️ Imagen anterior eliminada de Cloudinary`
  - `☁️ Nueva imagen subida a Cloudinary`
- ✅ Mensaje de éxito: "Imagen reprocesada exitosamente con IA"
- ✅ La imagen se actualiza automáticamente en el modal

---

## Prueba 4: Permisos

**Objetivo**: Verificar que solo usuarios autorizados ven el botón

### Como Diseñador (sin permisos):
1. Login como diseñador
2. Abre modal de detalles de artículo con imagen
3. **NO debes ver** el botón "Mejorar IA"

### Como Admin/Almacenista (con permisos):
1. Login como admin o almacenista
2. Abre modal de detalles de artículo con imagen
3. **SÍ debes ver** el botón "Mejorar IA"

---

## Verificación de Logs

### Backend - Lo que debes ver en consola:

#### Foto de cámara SIN Nano Banana configurado:
```
📸 Foto de cámara detectada, procesando con Nano Banana...
⚠️ Nano Banana no está configurado, usando imagen original
☁️ Imagen subida a Cloudinary: https://...
```

#### Foto de cámara CON Nano Banana configurado:
```
📸 Foto de cámara detectada, procesando con Nano Banana...
🍌 Iniciando procesamiento con Nano Banana: image.jpg
✅ Imagen procesada exitosamente con Nano Banana
☁️ Imagen subida a Cloudinary: https://...
```

#### Archivo subido:
```
📁 Archivo subido, sin procesamiento de Nano Banana
☁️ Imagen subida a Cloudinary: https://...
```

#### Reprocesar imagen existente:
```
🔄 Reprocesando imagen del artículo 123...
🍌 Descargando imagen desde URL para procesar: https://...
✅ Imagen procesada exitosamente con Nano Banana
🗑️ Imagen anterior eliminada de Cloudinary
☁️ Nueva imagen subida a Cloudinary: https://...
```

---

## Casos de Error a Probar

### Error 1: API Key Inválida
- Configura un API key falso
- Intenta tomar foto
- **Debe**: Continuar y subir imagen original sin procesamiento

### Error 2: Sin conexión a Nano Banana
- (Difícil de simular, pero el sistema tiene fallback)
- Si falla la API, debe subir imagen original

### Error 3: Timeout
- Si Nano Banana tarda más de 30 segundos
- Debe lanzar error de timeout
- Imagen original se guarda

---

## Checklist Final

Antes de subir a producción, verifica:

- [ ] ✅ Dependencia form-data instalada
- [ ] ✅ Fotos de cámara se marcan como `isFromCamera: true`
- [ ] ✅ Archivos subidos se marcan como `isFromCamera: false`
- [ ] ✅ Sin API key: fotos se suben normalmente
- [ ] ✅ Con API key: fotos de cámara se procesan con IA
- [ ] ✅ Con API key: archivos subidos NO se procesan
- [ ] ✅ Botón "Mejorar IA" visible solo para usuarios autorizados
- [ ] ✅ Botón "Mejorar IA" funciona correctamente
- [ ] ✅ Loading states funcionan
- [ ] ✅ Mensajes de error son claros
- [ ] ✅ Logs del backend son informativos

---

## Próximo Paso

Una vez todas las pruebas pasen:
1. ✅ Hacer commit de los cambios
2. ✅ Push a GitHub
3. ✅ Configurar variables en Railway
4. ✅ Deploy automático
5. ✅ Probar en producción

---

## Troubleshooting

### "Cannot find module 'form-data'"
```bash
cd backend
npm install form-data
```

### Backend no reconoce NANO_BANANA_API_KEY
- Verifica que esté en `/backend/.env`
- Reinicia el servidor backend

### Imagen no se procesa
- Revisa consola del backend para ver logs
- Verifica que API key sea válida
- Asegúrate de que estás usando "Tomar fotografía" no "Subir archivo"

### Botón "Mejorar IA" no aparece
- Verifica que tu usuario tenga permisos (admin/almacenista)
- Verifica que el artículo tenga imagen

---

**¿Listo para empezar las pruebas?** Empieza con la Prueba 1 (sin API key) para verificar el fallback.
