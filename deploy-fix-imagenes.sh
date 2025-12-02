#!/bin/bash

# Script para desplegar el fix de imágenes a producción
# Uso: ./deploy-fix-imagenes.sh

echo "🚀 Desplegando Fix de Imágenes a Producción"
echo "==========================================="
echo ""

# Verificar que estamos en la rama correcta
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Rama actual: $CURRENT_BRANCH"
echo ""

# Verificar estado de git
echo "📊 Estado de Git:"
git status --short
echo ""

# Confirmar con el usuario
read -p "¿Deseas continuar con el deploy? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Deploy cancelado"
    exit 1
fi

echo ""
echo "📦 Agregando archivos modificados..."
git add backend/package.json backend/package-lock.json
git add backend/src/utils/label-generator.js
git add backend/src/controllers/articulos.controller.js
git add backend/src/routes/articulos.routes.js

echo ""
echo "✅ Archivos agregados. Creando commit..."
git commit -m "Fix: Agregar conversión automática de imágenes a PNG con sharp

- Instalar sharp@0.33.5 para procesamiento de imágenes
- Convertir automáticamente WebP, AVIF y otros formatos a PNG
- Mejorar logging con detalles de formato y tamaño de imagen
- Agregar endpoint diagnosticarImagenes para debug
- Solucionar error 'Unknown image format' en generación de etiquetas

Esto permite que las etiquetas masivas funcionen con cualquier formato
de imagen que Cloudinary devuelva, no solo JPEG/PNG."

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  No hay cambios para commitear o el commit falló"
    echo "   Los archivos ya podrían estar commiteados previamente"
    echo ""
    read -p "¿Deseas hacer push de los commits existentes? (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "❌ Deploy cancelado"
        exit 1
    fi
fi

echo ""
echo "🚢 Haciendo push a GitHub..."
git push origin $CURRENT_BRANCH

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Error al hacer push"
    echo "   Verifica que tengas permisos y conexión a internet"
    exit 1
fi

echo ""
echo "✅ Push completado exitosamente!"
echo ""
echo "📡 Railway detectará los cambios automáticamente y:"
echo "   1. Instalará las nuevas dependencias (sharp)"
echo "   2. Reconstruirá el proyecto"
echo "   3. Reiniciará el servicio"
echo ""
echo "⏱️  Esto tomará aproximadamente 2-3 minutos"
echo ""
echo "💡 Para ver el progreso del deploy:"
echo "   railway logs --service backend"
echo ""
echo "🧪 Para probar que funcionó:"
echo "   ./test-diagnostico-imagenes-produccion.sh"
echo ""
echo "✨ Deploy iniciado con éxito!"
