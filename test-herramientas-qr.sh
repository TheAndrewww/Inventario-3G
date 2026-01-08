#!/bin/bash

# Script para probar generación de etiquetas de herramientas con códigos QR
# Uso: ./test-herramientas-qr.sh

echo "🔧 Prueba de Etiquetas de Herramientas con Código QR"
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

# Listar unidades de herramientas disponibles
echo "🔧 Unidades de Herramientas Disponibles:"
echo "----------------------------------------"
UNIDADES=$(curl -s -X GET "http://localhost:5001/api/herramientas-renta/unidades-todas?activo=true&limit=10" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "⚠️  No se pudo obtener la lista de herramientas"
    echo "   Endpoint: GET /api/herramientas-renta/unidades-todas"
    exit 0
fi

# Extraer IDs de las primeras 5 unidades
UNIDADES_IDS=$(echo "$UNIDADES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if not data.get('success'):
        print('[]')
        sys.exit(0)

    unidades = data.get('data', {}).get('unidades', [])
    if not unidades:
        print('⚠️  No hay unidades disponibles en la BD', file=sys.stderr)
        print('[]')
        sys.exit(0)

    ids = [u['id'] for u in unidades[:5]]

    print(f'Total de unidades encontradas: {len(unidades)}\n', file=sys.stderr)
    for i, u in enumerate(unidades[:5], 1):
        tipo = u.get('tipoHerramienta', {})
        tipo_nombre = tipo.get('nombre', 'N/A') if tipo else 'N/A'
        print(f'{i}. ID: {u[\"id\"]:3} | {u[\"codigo_unico\"]:10} | {tipo_nombre}', file=sys.stderr)

    print(json.dumps(ids))
except Exception as e:
    print(f'Error procesando unidades: {e}', file=sys.stderr)
    print('[]')
")

if [ "$UNIDADES_IDS" = "[]" ]; then
    echo "⚠️  No se encontraron unidades de herramientas"
    echo ""
    echo "💡 Para probar este feature, primero crea algunas unidades de herramientas"
    exit 0
fi

echo ""
echo ""
echo "📱 Generando PDF de etiquetas con QR..."
echo "========================================"
echo ""
echo "📊 Observa la consola del backend para ver:"
echo "   - 📱 Generando QR code para: [codigo]"
echo "   - Los QR codes deben aparecer en las etiquetas"
echo ""

# Generar etiquetas mixtas (solo unidades de herramientas)
TIMESTAMP=$(date +%s)
RESPONSE=$(curl -s -X POST "http://localhost:5001/api/articulos/etiquetas/lote-mixto" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articulos_ids\": [], \"unidades_ids\": $UNIDADES_IDS}" \
  -o "/tmp/etiquetas-herramientas-qr-${TIMESTAMP}.pdf" \
  -w "%{http_code}")

if [ "$RESPONSE" = "200" ]; then
    echo ""
    echo "✅ PDF generado exitosamente!"
    echo ""
    echo "📄 Archivo guardado en: /tmp/etiquetas-herramientas-qr-${TIMESTAMP}.pdf"
    echo ""
    echo "🖼️  Abriendo PDF..."
    open "/tmp/etiquetas-herramientas-qr-${TIMESTAMP}.pdf"
    echo ""
    echo "📱 VERIFICA QUE:"
    echo "   1. Las etiquetas muestran códigos QR (cuadrados negros/blancos)"
    echo "   2. NO muestran códigos de barras lineales"
    echo "   3. Los QR contienen el código único de la herramienta (ej: PP-001)"
    echo ""
    echo "🧪 Para escanear los QR:"
    echo "   - Usa la app de cámara de tu celular"
    echo "   - O cualquier app de escaneo de QR"
    echo "   - Deberías ver el código único (ej: PP-001, CP-005)"
else
    echo ""
    echo "❌ Error generando PDF (HTTP $RESPONSE)"
    echo "   Revisa los logs del backend para más detalles"
fi

echo ""
echo "💡 Consejos:"
echo "   - Revisa la consola del backend"
echo "   - Busca líneas como '📱 Generando QR code para: PP-001'"
echo "   - Los QR deben ser cuadrados de 60x60 (más grandes que antes)"
