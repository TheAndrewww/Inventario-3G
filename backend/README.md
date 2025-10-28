# 📦 Inventario 3G - Backend

Backend del Sistema de Gestión de Inventario para 3G Arquitectura Textil

## 🚀 Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **PostgreSQL** - Base de datos
- **Sequelize** - ORM
- **JWT** - Autenticación
- **QRCode** - Generación de códigos QR
- **PDFKit** - Generación de PDFs

## 📋 Requisitos Previos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

## 🔧 Configuración Inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario3g
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=tu_secret_key
```

### 3. Crear base de datos

Conéctate a PostgreSQL y crea la base de datos:

```sql
CREATE DATABASE inventario3g;
```

### 4. Iniciar servidor

**Desarrollo:**
```bash
npm run dev
```

**Producción:**
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/         # Configuración (DB, etc.)
│   ├── models/         # Modelos de Sequelize
│   ├── controllers/    # Controladores de rutas
│   ├── routes/         # Definición de rutas
│   ├── middleware/     # Middlewares personalizados
│   └── utils/          # Utilidades (QR, PDF, etc.)
├── uploads/            # Archivos subidos
├── server.js           # Punto de entrada
├── .env                # Variables de entorno
└── package.json        # Dependencias
```

## 🔐 Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | 5000 |
| `NODE_ENV` | Entorno de ejecución | development |
| `DB_HOST` | Host de PostgreSQL | localhost |
| `DB_PORT` | Puerto de PostgreSQL | 5432 |
| `DB_NAME` | Nombre de la base de datos | inventario3g |
| `DB_USER` | Usuario de PostgreSQL | postgres |
| `DB_PASSWORD` | Contraseña de PostgreSQL | - |
| `JWT_SECRET` | Secret para JWT | - |
| `JWT_EXPIRE` | Tiempo de expiración JWT | 7d |
| `FRONTEND_URL` | URL del frontend | http://localhost:5173 |

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/verify` - Verificar token

### Artículos
- `GET /api/articulos` - Listar artículos
- `GET /api/articulos/:id` - Ver artículo
- `GET /api/articulos/qr/:qr` - Buscar por QR
- `POST /api/articulos` - Crear artículo
- `PUT /api/articulos/:id` - Actualizar artículo
- `DELETE /api/articulos/:id` - Eliminar artículo

### Movimientos
- `GET /api/movimientos` - Listar movimientos
- `GET /api/movimientos/:id` - Ver movimiento
- `POST /api/movimientos` - Crear retiro
- `PUT /api/movimientos/:id` - Actualizar estado

## 🧪 Testing

```bash
npm test
```

## 📝 Licencia

Privado - 3G Arquitectura Textil
