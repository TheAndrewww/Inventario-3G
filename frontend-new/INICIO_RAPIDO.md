# Inicio Rapido - ERP 3G Frontend

## Pasos para iniciar el servidor de desarrollo

### 1. Asegurate de que el backend este corriendo

El backend debe estar corriendo en: `http://localhost:5001`

```bash
# En el directorio del backend
cd /Users/andrewww/Documents/Inventario-3G/backend
node server.js
```

### 2. Inicia el servidor de desarrollo del frontend

```bash
# En el directorio del frontend
cd /Users/andrewww/Documents/Inventario-3G/frontend-new
npm run dev
```

### 3. Abre el navegador

El servidor estara disponible en: **http://localhost:5173**

### 4. Inicia sesion

Usa las credenciales configuradas en tu base de datos. Por ejemplo:
```
Email: admin@3gtextil.com
Password: (tu password configurado)
```

## Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Compilar para produccion
npm run preview  # Vista previa de la build
npm run lint     # Linter
```

## Estructura de Navegacion

Una vez dentro del sistema:

- **Inventario**: Ver y buscar articulos, agregar al pedido
- **Pedido Actual**: Gestionar el carrito, ajustar cantidades, finalizar pedido
- **Historial**: Ver movimientos historicos
- **Perfil**: Ver informacion de usuario y cerrar sesion

## Funcionalidades Principales

### En la pagina de Inventario:
- Buscar articulos por nombre, ID o categoria
- Ver stock actual y alertas de stock bajo
- Agregar articulos al pedido con un clic

### En la pagina de Pedido:
- Ver articulos agregados
- Incrementar/decrementar cantidades
- Eliminar articulos
- Ver resumen con totales
- Finalizar pedido (crea un movimiento de retiro)

### En la pagina de Historial:
- Ver todos los movimientos registrados
- Buscar por ID de ticket o usuario
- Filtrar por fecha

## Notas

- El proyecto esta configurado para conectarse al backend en `http://localhost:5001/api`
- Los tokens de autenticacion se guardan en localStorage
- El carrito se mantiene en memoria (se pierde al refrescar)
- El diseño sigue exactamente el mockup proporcionado

## Proximos pasos

Para implementar funcionalidades adicionales:
1. Implementar escaner QR real con html5-qrcode
2. Agregar pagina de ticket/recibo despues de finalizar
3. Implementar generacion de PDF
4. Agregar pagina de reportes

Para mas informacion, consulta el archivo README.md
