# ERP 3G - Sistema de Inventario Frontend

Frontend web moderno desarrollado con React + TypeScript + Vite, siguiendo exactamente el diseño del mockup proporcionado.

## Tecnologías Utilizadas

- **React 18** - Framework UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **React Router DOM** - Enrutamiento
- **Axios** - Cliente HTTP
- **React Hot Toast** - Notificaciones
- **Lucide React** - Iconos
- **HTML5 QRCode** - Escáner QR
- **QRCode.React** - Generador de códigos QR

## Estructura del Proyecto

```
src/
├── components/
│   ├── common/
│   │   ├── Loader.tsx          # Componente de carga
│   │   └── Modal.tsx           # Modal reutilizable
│   ├── layout/
│   │   ├── DashboardLayout.tsx # Layout principal
│   │   ├── Header.tsx          # Header con botón QR
│   │   └── Sidebar.tsx         # Sidebar colapsable
│   └── QRScannerModal.tsx      # Modal para escanear QR
├── context/
│   ├── AuthContext.tsx         # Contexto de autenticación
│   └── PedidoContext.tsx       # Contexto del carrito/pedido
├── pages/
│   ├── HistorialPage.tsx       # Historial de movimientos
│   ├── InventarioPage.tsx      # Tabla de inventario
│   ├── LoginPage.tsx           # Página de login
│   ├── PedidoPage.tsx          # Carrito de pedido
│   └── PerfilPage.tsx          # Perfil de usuario
├── services/
│   ├── api.ts                  # Configuración base de Axios
│   ├── articulos.service.ts    # API de artículos
│   ├── auth.service.ts         # API de autenticación
│   └── movimientos.service.ts  # API de movimientos
├── types/
│   └── index.ts                # Tipos TypeScript
├── App.tsx                     # Componente principal con router
└── main.tsx                    # Punto de entrada

```

## Características Implementadas

### Autenticación
- Login con email y contraseña
- Contexto de autenticación global
- Rutas protegidas
- Redirección automática según estado de autenticación
- Persistencia de sesión en localStorage

### Gestión de Inventario
- Tabla completa de artículos
- Búsqueda por nombre, ID o categoría
- Indicadores de stock bajo
- Agregar artículos al pedido
- Diseño exacto del mockup

### Pedido Actual (Carrito)
- Vista de 2 columnas (artículos + resumen)
- Incrementar/decrementar cantidades
- Eliminar artículos
- Cálculo automático de totales
- Finalizar pedido
- Vaciar carrito

### Historial de Movimientos
- Tabla de movimientos históricos
- Búsqueda y filtros
- Badges de estado por tipo de movimiento
- Formato de fecha y hora en español

### Perfil de Usuario
- Información del usuario actual
- Avatar con iniciales
- Opciones de configuración
- Cerrar sesión

### Interfaz de Usuario
- Diseño exacto del mockup
- Sidebar colapsable con logo 3G
- Badge de cantidad en carrito
- Colores corporativos (rojo #b91c1c)
- Notificaciones toast
- Componentes responsivos
- Estados de carga

## Configuración e Instalación

### Prerrequisitos
- Node.js 18+ instalado
- Backend corriendo en `http://localhost:5001`

### Instalación

```bash
# Las dependencias ya están instaladas, pero si necesitas reinstalar:
npm install
```

### Variables de Entorno

La URL del API está configurada en `src/services/api.ts`:
```typescript
const API_URL = 'http://localhost:5001/api';
```

Si necesitas cambiarla, crea un archivo `.env`:
```
VITE_API_URL=http://localhost:5001/api
```

Y actualiza `src/services/api.ts`:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
```

## Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

El servidor estará disponible en: **http://localhost:5173**

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia el servidor de desarrollo

# Producción
npm run build        # Compila para producción
npm run preview      # Vista previa de la build de producción

# Linting
npm run lint         # Ejecuta ESLint
```

## Credenciales de Prueba

Para iniciar sesión, usa las credenciales configuradas en tu backend. Ejemplo:

```
Email: admin@3gtextil.com
Password: tu_password
```

## Endpoints del Backend

El frontend se conecta a los siguientes endpoints:

### Autenticación
- `POST /api/auth/login` - Login

### Artículos
- `GET /api/articulos` - Listar todos
- `GET /api/articulos/:id` - Obtener por ID
- `GET /api/articulos/qr/:qrCode` - Buscar por QR
- `POST /api/articulos` - Crear nuevo
- `PUT /api/articulos/:id` - Actualizar
- `DELETE /api/articulos/:id` - Eliminar

### Movimientos
- `GET /api/movimientos` - Listar todos
- `GET /api/movimientos/:id` - Obtener por ID
- `GET /api/movimientos/ticket/:ticketId` - Buscar por ticket
- `POST /api/movimientos` - Crear nuevo

## Diseño y Estilos

El diseño sigue **EXACTAMENTE** el mockup proporcionado en `/Users/andrewww/Documents/Inventario-3G/web-inventario-mockup.tsx`:

- Fondo: `bg-gray-50`
- Sidebar: `bg-white`, ancho `w-64` (abierto), `w-20` (cerrado)
- Logo 3G: Cuadro rojo `bg-red-700`
- Botones principales: `bg-red-700`, `hover:bg-red-800`
- Tablas: `bg-white`, `rounded-xl`, `shadow-sm`
- Headers de tabla: `bg-gray-50`
- Badge de carrito: Círculo rojo con contador

## Próximos Pasos

Para extender la funcionalidad:

1. **Implementar escáner QR real** usando `html5-qrcode`
2. **Agregar página de ticket/recibo** después de finalizar pedido
3. **Implementar generación de PDF** para tickets
4. **Agregar página de reportes** con gráficos
5. **Implementar gestión de categorías y ubicaciones**
6. **Agregar modal para crear/editar artículos**
7. **Implementar paginación** en tablas grandes
8. **Agregar filtros avanzados** en historial

## Notas Importantes

- El token JWT se guarda en `localStorage`
- Los interceptores de Axios añaden automáticamente el token a las peticiones
- Las rutas están protegidas y redirigen al login si no hay sesión
- El contexto de pedido mantiene el carrito en memoria (se pierde al refrescar)
- Para persistir el carrito, considera usar `localStorage` en el contexto

## Soporte

Para problemas o preguntas, contacta al equipo de desarrollo de 3G Textil.
