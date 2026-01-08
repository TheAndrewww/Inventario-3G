#!/usr/bin/env python3
import requests
import json

# Login
login_response = requests.post(
    'https://inventario-3g-production.up.railway.app/api/auth/login',
    json={'email': 'admin@3g.com', 'password': 'admin123'}
)

token = login_response.json()['data']['token']
print(f'✅ Token obtenido\n')

# Obtener tipos de herramienta
headers = {'Authorization': f'Bearer {token}'}
tipos_response = requests.get(
    'https://inventario-3g-production.up.railway.app/api/herramientas-renta/tipos',
    headers=headers
)

data = tipos_response.json()
tipos = data.get('data', {}).get('tipos', [])

# Buscar VARILLA PARA ANCLAJE
varillas = [t for t in tipos if 'VARILLA' in t['nombre'] and 'ANCLAJE' in t['nombre'] and '1"' in t['nombre']]

print(f'📋 Tipos encontrados: {len(varillas)}\n')

for tipo in varillas:
    print('=' * 60)
    print(f"Nombre: {tipo['nombre']}")
    print(f"ID: {tipo['id']}")
    print(f"Imagen del tipo: {tipo.get('imagen_url', 'Sin imagen')}")
    print(f"ArticuloOrigen presente en respuesta: {'articuloOrigen' in tipo}")

    if 'articuloOrigen' in tipo:
        ao = tipo['articuloOrigen']
        if ao:
            print(f"\n✅ ArticuloOrigen encontrado:")
            print(f"   ID: {ao.get('id')}")
            print(f"   Nombre: {ao.get('nombre')}")
            print(f"   Imagen: {ao.get('imagen_url', 'Sin imagen')}")
        else:
            print(f"\n⚠️  ArticuloOrigen es null")
    else:
        print(f"\n❌ ArticuloOrigen NO está incluido en la respuesta")
        print(f"   🔧 Esto significa que el backend aún no se ha desplegado con los cambios")

    print('=' * 60)
    print()
