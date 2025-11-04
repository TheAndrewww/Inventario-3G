# Verificar que Cloudinary está funcionando en producción

## ✅ Checklist de verificación

### 1. Variables de entorno configuradas en Railway
- [ ] `CLOUDINARY_CLOUD_NAME` configurada
- [ ] `CLOUDINARY_API_KEY` configurada
- [ ] `CLOUDINARY_API_SECRET` configurada

### 2. Backend desplegado correctamente
```bash
# Ver logs de Railway
railway logs

# Buscar confirmación de Cloudinary
# Deberías ver que el servidor inició sin errores
```

### 3. Probar subida de imagen

1. Ve a tu aplicación en producción
2. Edita un artículo o crea uno nuevo
3. Sube una imagen
4. Verifica que aparezca correctamente

### 4. Verificar en Cloudinary Dashboard

1. Ve a https://cloudinary.com/console
2. Click en **Media Library**
3. Deberías ver la carpeta: `inventario-3g/articulos/`
4. Ahí aparecerán todas las imágenes subidas

### 5. Verificar URL de la imagen

La URL de las imágenes debe verse así:
```
https://res.cloudinary.com/TU_CLOUD_NAME/image/upload/v1234567/inventario-3g/articulos/articulo_123456789.jpg
```

Si ves una URL como esta, ¡todo está funcionando! ✅

## 🔍 Solución de problemas

### Error: "No se pudo subir imagen"
1. Verifica que las 3 variables estén en Railway
2. Revisa que no haya espacios extra al copiar/pegar
3. Verifica los logs: `railway logs`

### Imágenes no aparecen
1. Revisa la consola del navegador (F12) para errores
2. Verifica que la URL empiece con `https://res.cloudinary.com/`
3. Asegúrate de que el backend redesplegó después de agregar variables

### Ver logs en tiempo real
```bash
railway logs --follow
```

## 🎯 Resultado esperado

Una vez configurado correctamente:
- ✅ Las imágenes se suben a Cloudinary
- ✅ Se muestran correctamente en la aplicación
- ✅ NO se pierden al redesplegar
- ✅ Cargan rápido desde cualquier ubicación
- ✅ URLs permanentes y seguras (HTTPS)
