# Sistema de Inventario 3G 📦

Sistema completo de gestión de inventario con control de artículos, pedidos, órdenes de compra y notificaciones en tiempo real.

## 🚀 Características

- ✅ Gestión completa de inventario (artículos, categorías, ubicaciones)
- ✅ Sistema de pedidos con aprobación jerárquica
- ✅ Órdenes de compra con seguimiento
- ✅ Notificaciones en tiempo real
- ✅ Control de equipos y asignación de materiales
- ✅ Generación automática de códigos EAN-13
- ✅ Escaneo de códigos de barras
- ✅ Sistema de roles (Administrador, Almacenista, Diseñador, Compras, Supervisor)
- ✅ Historial completo de movimientos
- ✅ Carga de imágenes para artículos

## 📋 Requisitos Previos

- Node.js v16+ y npm v8+
- PostgreSQL 14+
- Git

## 🛠️ Instalación y Desarrollo Local

### 🚀 Inicio Rápido (Recomendado)

Si quieres empezar a desarrollar rápidamente, usa el script de inicio automático:

```bash
# 1. Asegúrate de estar en la raíz del proyecto
cd /Users/andrewww/Documents/Inventario-3G

# 2. Ejecuta el script de inicio
./start-local.sh
```

Este script automáticamente:
- ✅ Verifica PostgreSQL
- ✅ Crea la base de datos si no existe
- ✅ Instala dependencias
- ✅ Inicia backend y frontend
- ✅ Abre el navegador

### 🧪 Verificar Ambiente Local

Para verificar que todo esté configurado correctamente:

```bash
./test-local.sh
```

### 📖 Guía Completa de Desarrollo

Para una guía detallada con todos los pasos manuales, consulta:

**[📘 DESARROLLO_LOCAL.md](./DESARROLLO_LOCAL.md)**

Esta guía incluye:
- Instalación paso a paso de PostgreSQL
- Configuración de variables de entorno
- Resolución de problemas comunes
- Comandos útiles para desarrollo
- Checklist antes de hacer commits

### 1. Clonar el repositorio

```bash
git clone <url-repositorio>
cd Inventario-3G
```

### 2. Instalar dependencias

```bash
# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

### 3. Configurar variables de entorno

**Backend** (`backend/.env`):
```env
PORT=5001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario3g
DB_USER=tu_usuario
DB_PASSWORD=tu_password
JWT_SECRET=tu-secret-key-super-seguro
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5001/api
VITE_BASE_URL=http://localhost:5001
```

### 4. Crear base de datos

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE inventario3g;
\q
```

### 5. Ejecutar migraciones (si las hay)

```bash
cd backend
node migrations/run-migration.js
```

### 6. Crear usuario administrador inicial

```bash
cd backend
node scripts/crear-usuarios-prueba.js
```

Credenciales por defecto:
- **Email**: admin@3g.com
- **Password**: admin123

### 7. Ejecutar en desarrollo

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

El sistema estará disponible en:
- Frontend: http://localhost:5173
- Backend: http://localhost:5001

## 🚢 Despliegue a Producción

Ver guía completa en [GUIA_DESPLIEGUE.md](./GUIA_DESPLIEGUE.md)

### Opción recomendada: Railway + Vercel

1. **Backend en Railway**
   - Conectar repositorio
   - Agregar PostgreSQL
   - Configurar variables de entorno

2. **Frontend en Vercel**
   - Conectar repositorio
   - Configurar variables de entorno
   - Despliegue automático

## 📁 Estructura del Proyecto

```
Inventario-3G/
├── backend/              # API REST con Node.js + Express
│   ├── src/
│   │   ├── config/      # Configuraciones
│   │   ├── controllers/ # Controladores
│   │   ├── middleware/  # Middlewares
│   │   ├── models/      # Modelos Sequelize
│   │   ├── routes/      # Rutas API
│   │   └── utils/       # Utilidades
│   ├── uploads/         # Archivos subidos
│   └── server.js        # Punto de entrada
├── frontend/            # App React + Vite
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── context/     # Context API
│   │   ├── pages/       # Páginas
│   │   └── services/    # Servicios API
│   └── public/          # Archivos estáticos
└── README.md
```

## 🔐 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Administrador** | Acceso total al sistema |
| **Almacenista** | Gestión de inventario, pedidos y movimientos |
| **Diseñador** | Crear pedidos y consultar inventario |
| **Compras** | Gestión de órdenes de compra y proveedores |
| **Supervisor** | Aprobar/rechazar pedidos de equipos |

## 🔄 Flujo de Actualización

### Para actualizar el sistema en producción:

1. **Hacer cambios localmente**
```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

2. **Railway y Vercel detectan automáticamente el push y redesplegan**

### Para actualizar en servidor propio (VPS):

```bash
# Conectarse al servidor
ssh user@tu-servidor

# Ir al directorio del proyecto
cd /ruta/inventario-3g

# Actualizar código
git pull origin main

# Actualizar dependencias si es necesario
cd backend && npm install
cd ../frontend && npm install && npm run build

# Reiniciar servicios
pm2 restart backend
pm2 restart frontend
```

## 🐛 Solución de Problemas

### Error de conexión a base de datos
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `.env`
- Verificar que la base de datos exista

### Error de CORS
- Verificar que `FRONTEND_URL` en backend coincida con la URL del frontend
- Verificar configuración de CORS en `backend/server.js`

### Error de autenticación
- Verificar que `JWT_SECRET` esté configurado
- Limpiar localStorage del navegador y volver a iniciar sesión

## 📝 Scripts Disponibles

### Backend
```bash
npm run dev      # Modo desarrollo con nodemon
npm start        # Modo producción
```

### Frontend
```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run preview  # Preview del build
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch para feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es propietario y confidencial.

## 👨‍💻 Autor

**3G Sistemas**

---

Para más información, consulta la documentación en la carpeta `docs/` o contacta al equipo de desarrollo.
