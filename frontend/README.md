# 🎨 Frontend - Sistema de Inventario 3G

Frontend del sistema de inventario para 3G Textil, construido con React, Vite y Tailwind CSS.

## 🚀 Stack Tecnológico

- **React 18** - Biblioteca de UI
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **React Router** - Navegación
- **Axios** - Cliente HTTP
- **Lucide React** - Iconos
- **React Hot Toast** - Notificaciones
- **HTML5 QRCode** - Scanner QR
- **QRCode** - Generador QR

## 📦 Instalación

```bash
# Instalar dependencias
npm install
```

## 🔧 Configuración

1. Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

2. Configura la URL de la API en el archivo `.env`:
```env
VITE_API_URL=http://localhost:5001/api
```

## 🏃 Ejecutar el Proyecto

### Modo Desarrollo
```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### Build de Producción
```bash
npm run build
```

### Preview del Build
```bash
npm run preview
```

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/         # Componentes reutilizables
│   │   ├── common/        # Componentes básicos (Button, Input, Modal, etc.)
│   │   ├── layout/        # Layout principal (Sidebar, Header)
│   │   ├── auth/          # Componentes de autenticación
│   │   ├── articulos/     # Componentes de artículos
│   │   ├── pedido/        # Componentes del pedido
│   │   └── scanner/       # Componente del scanner QR
│   ├── pages/             # Páginas de la aplicación
│   │   ├── LoginPage.jsx
│   │   ├── InventarioPage.jsx
│   │   ├── PedidoPage.jsx
│   │   ├── HistorialPage.jsx
│   │   └── PerfilPage.jsx
│   ├── context/           # Contextos de React
│   │   ├── AuthContext.jsx
│   │   └── PedidoContext.jsx
│   ├── services/          # Servicios de API
│   │   ├── api.js
│   │   ├── auth.service.js
│   │   ├── articulos.service.js
│   │   └── movimientos.service.js
│   ├── utils/             # Utilidades
│   ├── hooks/             # Custom hooks
│   ├── App.jsx            # Componente principal
│   ├── main.jsx           # Punto de entrada
│   └── index.css          # Estilos globales
├── public/                # Archivos estáticos
├── .env                   # Variables de entorno
├── .env.example           # Ejemplo de variables de entorno
├── tailwind.config.js     # Configuración de Tailwind
├── vite.config.js         # Configuración de Vite
└── package.json
```

## 🎨 Características

### ✅ Implementado
- **Autenticación** - Login con JWT
- **Inventario** - Listado y búsqueda de artículos
- **Pedidos** - Carrito de pedido con gestión de cantidades
- **Historial** - Visualización de movimientos
- **Perfil** - Información del usuario y logout
- **Layout Responsive** - Sidebar colapsable
- **Notificaciones** - Toast notifications
- **Rutas Protegidas** - PrivateRoute con verificación de auth

### 🚧 Por Implementar (Sprint 3-4)
- Scanner QR funcional
- Crear/Editar artículos
- Vista detallada de artículos
- Vista de ticket después de finalizar pedido
- Búsqueda avanzada con filtros
- Reportes y estadísticas

## 🔐 Autenticación

El sistema utiliza JWT (JSON Web Tokens) para la autenticación:

1. El token se guarda en `localStorage` al hacer login
2. Se agrega automáticamente a todas las peticiones mediante interceptor de Axios
3. Si el token expira, el usuario es redirigido a `/login`

## 🎨 Diseño

El diseño está basado en el mockup `web-inventario-mockup.tsx` con:

- **Colores principales**: Rojo (#DC2626 - red-700) y tonos de gris
- **Logo**: 3G en fondo rojo
- **Tipografía**: System fonts
- **Componentes**: Diseño limpio y moderno con Tailwind

## 📱 Responsive

El frontend está optimizado para:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## 🔄 Flujo de Trabajo

### Usuario Regular
1. Login → Inventario
2. Buscar/Escanear artículos
3. Agregar al pedido
4. Ajustar cantidades
5. Finalizar pedido
6. Ver historial

### Administrador
1. Todas las funciones de usuario regular
2. Crear/Editar/Eliminar artículos
3. Ver reportes
4. Gestionar usuarios (próximamente)

## 🧪 Testing (Pendiente)

```bash
# Ejecutar tests (cuando estén implementados)
npm test
```

## 📝 Credenciales de Prueba

```
Email: admin@3g.com
Password: admin123
```

## 🤝 Contribuir

1. Crea una rama para tu feature: `git checkout -b feature/nueva-funcionalidad`
2. Commit tus cambios: `git commit -m 'Add: nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Abre un Pull Request

## 📄 Licencia

© 2025 3G Textil. Todos los derechos reservados.
