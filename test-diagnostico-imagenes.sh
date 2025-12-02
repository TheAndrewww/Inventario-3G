#!/bin/bash

# Script para diagnosticar problemas con imágenes de artículos
# Uso: ./test-diagnostico-imagenes.sh

echo "🔍 Diagnóstico de Imágenes de Artículos"
echo "======================================="
echo ""

# Primero, obtener un token de autenticación
echo "🔐 Obteniendo token de autenticación..."
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener el token de autenticación"
  echo "   Verifica que el backend esté corriendo y las credenciales sean correctas"
  exit 1
fi

echo "✅ Token obtenido"
echo ""

# Listar artículos activos para que el usuario vea los IDs
echo "📋 Artículos activos en el sistema:"
echo "-----------------------------------"
curl -s -X GET "http://localhost:5001/api/articulos?activo=true" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
articulos = data['data']['articulos']
print(f'Total: {len(articulos)} artículos\n')
for i, a in enumerate(articulos[:20], 1):
    img_status = '✅' if a.get('imagen_url') else '⚠️'
    print(f'{i}. ID: {a[\"id\"]:3} {img_status} | {a[\"nombre\"][:50]}')
if len(articulos) > 20:
    print(f'\n... y {len(articulos) - 20} artículos más')
"

echo ""
echo ""
echo "🔬 DIAGNOSTICANDO IMÁGENES DE LOS PRIMEROS 10 ARTÍCULOS"
echo "========================================================"
echo ""

# Obtener IDs de los primeros 10 artículos
ARTICULOS_IDS=$(curl -s -X GET "http://localhost:5001/api/articulos?activo=true&limit=10" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps([a['id'] for a in data['data']['articulos']]))")

# Diagnosticar imágenes
curl -s -X POST "http://localhost:5001/api/articulos/diagnosticar-imagenes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"articulos_ids\": $ARTICULOS_IDS}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)

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
        url_preview = r['imagen_url'][:60] + '...' if len(r['imagen_url']) > 60 else r['imagen_url']
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

echo ""
echo "✨ Diagnóstico completado!"
echo ""
echo "💡 CONSEJOS:"
echo "   - Si ves artículos con error_descarga o timeout, sus URLs pueden estar rotas"
echo "   - Si ves sin_imagen, el artículo no tiene foto cargada"
echo "   - Para artículos con errores, considera re-subir la imagen o usar el procesamiento IA"
