#!/bin/bash

# Script para probar localmente la generación de etiquetas con el fix de imágenes
# Uso: ./test-local-etiquetas.sh

echo "🧪 Prueba Local de Generación de Etiquetas con Fotos"
echo "===================================================="
echo ""

# Verificar que el backend esté corriendo
echo "🔍 Verificando backend local..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5001/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
    echo "❌ Backend no está corriendo en http://localhost:5001"
    echo ""
    echo "Por favor, inicia el backend primero:"
    echo "  cd backend && npm run dev"
    echo ""
    exit 1
fi

echo "✅ Backend está corriendo (HTTP $HTTP_CODE)"
echo ""

# Obtener token
echo "🔐 Obteniendo token de autenticación..."
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ No se pudo obtener token"
    exit 1
fi

echo "✅ Token obtenido"
echo ""

# Listar primeros 5 artículos con imágenes
echo "📋 Artículos con imágenes (primeros 5):"
echo "---------------------------------------"
ARTICULOS_CON_IMAGEN=$(curl -s -X GET "http://localhost:5001/api/articulos?activo=true" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
articulos = [a for a in data['data']['articulos'] if a.get('imagen_url')][:5]
ids = [a['id'] for a in articulos]
for i, a in enumerate(articulos, 1):
    print(f'{i}. ID: {a[\"id\"]:3} | {a[\"nombre\"][:50]}')
print()
print(f'IDs seleccionados: {ids}')
print(json.dumps(ids))
" | tail -1)

if [ "$ARTICULOS_CON_IMAGEN" = "[]" ]; then
    echo "⚠️  No se encontraron artículos con imágenes"
    echo ""
    echo "💡 Prueba subiendo imágenes a algunos artículos primero"
    exit 0
fi

echo ""
echo ""
echo "🎨 Generando PDF de etiquetas..."
echo "================================"
echo ""
echo "📊 Observa la consola del backend para ver:"
echo "   - 📥 Descarga de imágenes"
echo "   - 📋 Detección de formato"
echo "   - ✅ Conversión a PNG"
echo ""

# Generar etiquetas
TIMESTAMP=$(date +%s)
curl -s -X POST "http://localhost:5001/api/articulos/etiquetas/lote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articulos_ids\": $ARTICULOS_CON_IMAGEN}" \
  -o "/tmp/etiquetas-test-${TIMESTAMP}.pdf"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ PDF generado exitosamente!"
    echo ""
    echo "📄 Archivo guardado en: /tmp/etiquetas-test-${TIMESTAMP}.pdf"
    echo ""
    echo "🖼️  Abriendo PDF..."
    open "/tmp/etiquetas-test-${TIMESTAMP}.pdf"
    echo ""
    echo "✨ Si ves las fotos en las etiquetas, ¡el fix funcionó!"
else
    echo ""
    echo "❌ Error generando PDF"
    echo "   Revisa los logs del backend para más detalles"
fi

echo ""
echo "💡 Consejos:"
echo "   - Revisa la consola del backend para ver los logs detallados"
echo "   - Busca líneas como '📋 Formato detectado: webp'"
echo "   - Si ves 'Imagen convertida a PNG', ¡el fix está funcionando!"
