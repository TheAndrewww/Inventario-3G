# 🚀 Guía de Desarrollo Local - Inventario 3G

Esta guía te ayudará a ejecutar el proyecto completo en tu máquina local para probar cambios antes de hacer commits.

---

## 📋 Requisitos Previos

- **Node.js** v18 o superior
- **PostgreSQL** v14 o superior
- **npm** (viene con Node.js)

---

## 🗄️ 1. Configurar la Base de Datos Local

### Opción A: Instalar PostgreSQL con Homebrew (macOS)

```bash
# Instalar PostgreSQL
brew install postgresql@14

# Iniciar el servicio
brew services start postgresql@14

# Crear base de datos
createdb inventario_3g

# Crear usuario (opcional)
psql postgres
CREATE USER inventario_user WITH PASSWORD 'tu_password_local';
GRANT ALL PRIVILEGES ON DATABASE inventario_3g TO inventario_user;
\q
```

### Opción B: Usar PostgreSQL existente

Si ya tienes PostgreSQL instalado, simplemente crea una base de datos nueva:

```bash
createdb inventario_3g
```

---

## ⚙️ 2. Configurar el Backend

### 2.1 Verificar archivo `.env`

Navega a la carpeta del backend:

```bash
cd /Users/andrewww/Documents/Inventario-3G/backend
```

Verifica que tu archivo `.env` tenga estas variables (ajusta según tu configuración):

```env
# Base de datos local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario_3g
DB_USER=tu_usuario
DB_PASSWORD=tu_password

# Puerto del servidor
PORT=5001

# JWT Secret
JWT_SECRET=tu_secreto_jwt_local_seguro

# Node environment
NODE_ENV=development
```

### 2.2 Instalar dependencias del backend

```bash
npm install
```

### 2.3 Inicializar la base de datos

```bash
# Ejecutar migraciones (si existen)
npm run migrate

# O ejecutar el script de inicialización
node scripts/init-db.js
```

### 2.4 Iniciar el servidor backend

```bash
npm run dev
```

El backend debería estar corriendo en: **http://localhost:5001**

Verifica que funcione:
```bash
curl http://localhost:5001/api/health
```

---

## 🎨 3. Configurar el Frontend

### 3.1 Abrir una nueva terminal

Deja el backend corriendo y abre otra terminal.

### 3.2 Verificar archivo `.env`

Navega a la carpeta del frontend:

```bash
cd /Users/andrewww/Documents/Inventario-3G/frontend
```

Verifica que tu archivo `.env` tenga:

```env
# URL del backend local
VITE_BASE_URL=http://localhost:5001

# Otras variables (si las necesitas)
VITE_API_URL=http://localhost:5001/api
```

### 3.3 Instalar dependencias del frontend

```bash
npm install
```

### 3.4 Iniciar el servidor frontend

```bash
npm run dev
```

El frontend debería estar corriendo en: **http://localhost:5173**

---

## 🧪 4. Probar la Aplicación Localmente

### 4.1 Abrir el navegador

Ve a: **http://localhost:5173**

### 4.2 Credenciales de prueba

Si ya ejecutaste el script de inicialización, puedes usar:

```
Usuario: admin@3g.com
Contraseña: admin123

Usuario: almacen@3g.com
Contraseña: almacen123

Usuario: supervisor@3g.com
Contraseña: supervisor123
```

### 4.3 Verificar que todo funciona

- ✅ Puedes iniciar sesión
- ✅ Puedes ver el inventario
- ✅ Puedes crear artículos (según tu rol)
- ✅ Los cambios se guardan en tu base de datos local

---

## 🔄 5. Flujo de Trabajo Recomendado

### Antes de hacer cambios:

1. **Asegúrate de que el backend esté corriendo**
   ```bash
   cd backend
   npm run dev
   ```

2. **Asegúrate de que el frontend esté corriendo**
   ```bash
   cd frontend
   npm run dev
   ```

### Mientras desarrollas:

1. **Haz tus cambios** en el código
2. **El frontend se recarga automáticamente** (Hot Reload)
3. **El backend también se recarga** si usas `nodemon`
4. **Prueba la funcionalidad** en http://localhost:5173
5. **Verifica la consola** del navegador y del servidor para errores

### Cuando termines de probar:

1. **Si todo funciona bien**, haz tu commit:
   ```bash
   git add .
   git commit -m "tu mensaje descriptivo"
   git push
   ```

2. **Si algo no funciona**, arréglalo antes de hacer commit

---

## 🛠️ 6. Comandos Útiles

### Backend

```bash
# Iniciar en modo desarrollo (con auto-reload)
npm run dev

# Ver logs de la base de datos
tail -f logs/app.log

# Ejecutar migraciones
npm run migrate

# Crear usuario de prueba
node scripts/crear-usuarios-prueba.js
```

### Frontend

```bash
# Iniciar en modo desarrollo
npm run dev

# Construir para producción (prueba)
npm run build

# Vista previa de la build
npm run preview
```

### Base de datos

```bash
# Conectar a PostgreSQL
psql inventario_3g

# Ver tablas
\dt

# Ver usuarios
SELECT * FROM usuarios;

# Salir de psql
\q

# Backup de la base de datos
pg_dump inventario_3g > backup.sql

# Restaurar backup
psql inventario_3g < backup.sql
```

---

## 🐛 7. Solución de Problemas Comunes

### ❌ Error: "Cannot connect to database"

**Solución:**
```bash
# Verificar que PostgreSQL esté corriendo
brew services list | grep postgresql

# Si no está corriendo, iniciarlo
brew services start postgresql@14

# Verificar credenciales en backend/.env
```

### ❌ Error: "Port 5001 is already in use"

**Solución:**
```bash
# Ver qué proceso está usando el puerto
lsof -i :5001

# Matar el proceso (reemplaza PID con el número que viste)
kill -9 PID

# O cambiar el puerto en backend/.env
PORT=5002
```

### ❌ Error: "CORS error" en el frontend

**Solución:**

Asegúrate de que en `backend/server.js` esté configurado CORS:

```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### ❌ Frontend no se conecta al backend

**Solución:**

Verifica que `frontend/.env` tenga:
```env
VITE_BASE_URL=http://localhost:5001
```

Y reinicia el servidor frontend:
```bash
# Ctrl+C para detener
npm run dev
```

---

## 📊 8. Verificar que Todo Esté Funcionando

Ejecuta este script de prueba rápida:

```bash
# Backend health check
curl http://localhost:5001/api/health

# Obtener token de prueba
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@3g.com","password":"admin123"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

# Probar endpoint de artículos
curl -s -X GET "http://localhost:5001/api/articulos" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30
```

Si ves datos JSON, ¡todo está funcionando! 🎉

---

## 🎯 9. Checklist Antes de Hacer Commit

- [ ] Backend corriendo sin errores
- [ ] Frontend corriendo sin errores
- [ ] Login funciona correctamente
- [ ] La funcionalidad nueva funciona como se espera
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en la consola del servidor
- [ ] Probaste con diferentes roles (admin, almacén, etc.)
- [ ] La base de datos local tiene los datos correctos

**Si todos los puntos están ✅, entonces es seguro hacer commit!**

---

## 📝 10. Notas Adicionales

### Diferencias Local vs Producción

| Aspecto | Local | Producción |
|---------|-------|------------|
| Base de Datos | PostgreSQL local | Railway PostgreSQL |
| Backend URL | http://localhost:5001 | https://inventario-3g-production.up.railway.app |
| Frontend URL | http://localhost:5173 | https://inventario-3g-frontend.vercel.app |
| Variables ENV | `.env` | Railway/Vercel dashboard |
| Hot Reload | ✅ Activo | ❌ Desactivado |

### Mantener Sincronizados Local y Producción

1. **Siempre prueba en local primero**
2. **Solo haz push cuando funcione en local**
3. **Vercel y Railway desplegarán automáticamente**
4. **Monitorea los logs de producción después del deploy**

---

## 🚀 ¡Listo para Desarrollar!

Ahora puedes:

1. **Hacer cambios en local**
2. **Probar inmediatamente** sin esperar deploys
3. **Iterar rápidamente** hasta que funcione perfecto
4. **Hacer commit con confianza** sabiendo que funciona

---

## 📞 ¿Necesitas Ayuda?

Si algo no funciona, revisa:
- Logs del backend: Terminal donde corre `npm run dev` (backend)
- Logs del frontend: Terminal donde corre `npm run dev` (frontend)
- Consola del navegador: F12 → Console
- Base de datos: `psql inventario_3g` → `\dt` → `SELECT * FROM ...`

¡Happy coding! 🎨👨‍💻
