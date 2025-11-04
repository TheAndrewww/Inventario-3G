# Configuración de Cloudinary para Imágenes

Las imágenes de los artículos ahora se almacenan en Cloudinary en lugar del sistema de archivos local. Esto resuelve el problema de pérdida de imágenes en Railway.

## Pasos para Configurar Cloudinary

### 1. Crear Cuenta en Cloudinary (GRATIS)

1. Ve a https://cloudinary.com/users/register/free
2. Regístrate con tu email o cuenta de Google/GitHub
3. Verifica tu email

### 2. Obtener Credenciales

Una vez dentro del dashboard de Cloudinary:

1. Ve a **Dashboard** (página principal)
2. Encontrarás tus credenciales en la sección **Account Details**:
   - **Cloud Name**: `dxxxxxxxx`
   - **API Key**: `123456789012345`
   - **API Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3. Configurar Variables de Entorno

#### En Local (.env)

Edita el archivo `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

#### En Railway (Producción)

1. Ve a tu proyecto en Railway
2. Selecciona el servicio del backend
3. Ve a la pestaña **Variables**
4. Agrega estas tres variables:
   - `CLOUDINARY_CLOUD_NAME` = tu cloud name
   - `CLOUDINARY_API_KEY` = tu API key
   - `CLOUDINARY_API_SECRET` = tu API secret
5. Railway redesplegará automáticamente

### 4. Verificar Funcionamiento

1. Sube una imagen de un artículo
2. La imagen aparecerá en tu dashboard de Cloudinary en:
   - **Media Library** → Carpeta `inventario-3g/articulos`
3. La URL será algo como:
   ```
   https://res.cloudinary.com/TU_CLOUD_NAME/image/upload/v1234567/inventario-3g/articulos/articulo_123.jpg
   ```

## Características

✅ **Almacenamiento persistente**: Las imágenes NO se pierden al redesplegar
✅ **CDN global**: Carga rápida desde cualquier lugar del mundo
✅ **Optimización automática**: Las imágenes se redimensionan a máximo 800x800px
✅ **Formatos soportados**: JPG, JPEG, PNG, WEBP
✅ **Límite de tamaño**: 5MB por imagen
✅ **Plan gratuito**: 25 GB de almacenamiento, 25 GB de ancho de banda/mes

## Plan Gratuito de Cloudinary

- **Almacenamiento**: 25 GB
- **Bandwidth**: 25 GB/mes
- **Transformaciones**: 25,000/mes
- **Imágenes**: Ilimitadas
- Perfecto para proyectos pequeños y medianos

## Migrar Imágenes Existentes (Opcional)

Si ya tienes imágenes en el sistema local y quieres migrarlas a Cloudinary:

1. Las nuevas imágenes automáticamente irán a Cloudinary
2. Las imágenes antiguas (con URLs `/uploads/articulos/...`) dejarán de funcionar
3. Tendrás que re-subir las imágenes de esos artículos

## Solución de Problemas

### Error: "No se pudo subir imagen"
- Verifica que las credenciales en Railway estén correctas
- Asegúrate de que el API Secret no tiene espacios extra

### Imágenes no aparecen
- Verifica que la URL empiece con `https://res.cloudinary.com/`
- Revisa los logs del backend para errores de Cloudinary

### Límite de plan gratuito excedido
- Monitorea tu uso en el dashboard de Cloudinary
- Considera upgrader al plan Pro ($99/mes) si es necesario
