#!/bin/bash

# Script para diagnosticar problemas con imágenes de artículos en PRODUCCIÓN
# Uso: ./test-diagnostico-imagenes-produccion.sh

# ⚙️ CONFIGURACIÓN
# Cambia esta URL por la URL de tu backend en Railway
BACKEND_URL="https://tu-app-backend.railway.app"
# O si usas variables de entorno:
# BACKEND_URL="${RAILWAY_BACKEND_URL:-https://tu-app-backend.railway.app}"

# Credenciales de administrador (asegúrate de que estas credenciales existan en producción)
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@3g.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo "🔍 Diagnóstico de Imágenes de Artículos - PRODUCCIÓN"
echo "====================================================="
echo "Backend: $BACKEND_URL"
echo ""

# Verificar que la URL del backend esté configurada
if [[ "$BACKEND_URL" == *"tu-app-backend"* ]]; then
  echo "⚠️  IMPORTANTE: Configura la URL de tu backend en Railway"
  echo "   Edita este archivo y cambia BACKEND_URL por tu URL de producción"
  echo ""
  echo "   Ejemplo: BACKEND_URL=\"https://inventario-3g-backend.railway.app\""
  echo ""
  exit 1
fi

# Verificar conectividad al backend
echo "🌐 Verificando conectividad al backend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  echo "❌ Error: No se puede conectar al backend en $BACKEND_URL"
  echo "   Verifica que:"
  echo "   1. La URL sea correcta"
  echo "   2. El backend esté desplegado y corriendo en Railway"
  echo "   3. Tengas conexión a internet"
  exit 1
fi

echo "✅ Backend accesible (HTTP $HTTP_CODE)"
echo ""

# Obtener token de autenticación
echo "🔐 Obteniendo token de autenticación..."
AUTH_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener el token de autenticación"
  echo ""
  echo "Respuesta del servidor:"
  echo "$AUTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AUTH_RESPONSE"
  echo ""
  echo "Verifica que:"
  echo "1. Las credenciales sean correctas (email: $ADMIN_EMAIL)"
  echo "2. El usuario administrador exista en la base de datos de producción"
  exit 1
fi

echo "✅ Token obtenido"
echo ""

# Listar artículos activos
echo "📋 Artículos activos en el sistema:"
echo "-----------------------------------"
curl -s -X GET "${BACKEND_URL}/api/articulos?activo=true" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if not data.get('success'):
        print(f'❌ Error: {data.get(\"message\")}')
        sys.exit(1)

    articulos = data['data']['articulos']
    print(f'Total: {len(articulos)} artículos\n')
    for i, a in enumerate(articulos[:20], 1):
        img_status = '✅' if a.get('imagen_url') else '⚠️'
        print(f'{i}. ID: {a[\"id\"]:3} {img_status} | {a[\"nombre\"][:50]}')
    if len(articulos) > 20:
        print(f'\n... y {len(articulos) - 20} artículos más')
except json.JSONDecodeError:
    print('❌ Error al parsear respuesta JSON')
    sys.exit(1)
"

echo ""
echo ""
echo "🔬 DIAGNOSTICANDO IMÁGENES DE LOS PRIMEROS 10 ARTÍCULOS"
echo "========================================================"
echo ""

# Obtener IDs de los primeros 10 artículos
ARTICULOS_IDS=$(curl -s -X GET "${BACKEND_URL}/api/articulos?activo=true&limit=10" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps([a['id'] for a in data['data']['articulos']]))")

if [ -z "$ARTICULOS_IDS" ] || [ "$ARTICULOS_IDS" = "[]" ]; then
  echo "⚠️  No se encontraron artículos para diagnosticar"
  exit 0
fi

echo "🔍 Analizando artículos con IDs: $ARTICULOS_IDS"
echo ""

# Diagnosticar imágenes
DIAGNOSTIC_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/articulos/diagnosticar-imagenes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articulos_ids\": $ARTICULOS_IDS}")

echo "$DIAGNOSTIC_RESPONSE" | python3 -c "
import sys, json

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f'❌ Error al parsear respuesta: {e}')
    sys.exit(1)

if not data.get('success'):
    print(f'❌ Error: {data.get(\"message\")}')
    sys.exit(1)

resumen = data['data']['resumen']
resultados = data['data']['resultados']

# Mostrar resumen
print('📊 RESUMEN:')
print(f'   Total artículos: {resumen[\"total\"]}')
print(f'   ✅ OK: {resumen[\"ok\"]}')
print(f'   ⚠️  Sin imagen: {resumen[\"sin_imagen\"]}')
print(f'   ❌ Errores: {resumen[\"errores\"]}')
print()

# Mostrar detalles
print('📋 DETALLES POR ARTÍCULO:')
print('=' * 80)
for r in resultados:
    estado_emoji = {
        'ok': '✅',
        'sin_imagen': '⚠️',
        'error_http': '❌',
        'error_descarga': '❌',
        'error_archivo': '❌'
    }.get(r['estado'], '❓')

    print(f'\n{estado_emoji} [{r[\"id\"]}] {r[\"nombre\"]}')
    print(f'   Estado: {r[\"estado\"]}')
    print(f'   Mensaje: {r[\"mensaje\"]}')

    if r.get('imagen_url'):
        url_preview = r['imagen_url'][:70] + '...' if len(r['imagen_url']) > 70 else r['imagen_url']
        print(f'   URL: {url_preview}')

    if r.get('detalles'):
        detalles = r['detalles']
        if detalles.get('loadTime'):
            print(f'   Tiempo de carga: {detalles[\"loadTime\"]}')
        if detalles.get('contentType'):
            print(f'   Tipo: {detalles[\"contentType\"]}')
        if detalles.get('status'):
            print(f'   HTTP Status: {detalles[\"status\"]}')
        if detalles.get('timeout'):
            print(f'   ⏱️  TIMEOUT detectado!')

print()
print('=' * 80)
"

DIAGNOSTIC_EXIT_CODE=$?

echo ""
echo "✨ Diagnóstico completado!"
echo ""
echo "💡 CONSEJOS:"
echo "   - Si ves artículos con error_descarga o timeout, sus URLs pueden estar rotas"
echo "   - Si ves sin_imagen, el artículo no tiene foto cargada"
echo "   - Para artículos con errores, considera re-subir la imagen o usar el procesamiento IA"
echo ""
echo "📝 Para ver los logs detallados del servidor en Railway, ejecuta:"
echo "   railway logs --service backend"

exit $DIAGNOSTIC_EXIT_CODE
