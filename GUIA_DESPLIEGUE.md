# 🚀 Guía Completa de Despliegue - Sistema Inventario 3G

Esta guía te explica paso a paso cómo subir tu sistema a producción y cómo actualizarlo.

## 📋 Índice

1. [Preparación Inicial](#preparación-inicial)
2. [Opción 1: Railway + Vercel (Recomendada)](#opción-1-railway--vercel)
3. [Opción 2: Servidor VPS](#opción-2-servidor-vps)
4. [Cómo Actualizar el Sistema](#cómo-actualizar-el-sistema)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Preparación Inicial

### 1. Crear Repositorio en GitHub

```bash
# Si aún no tienes un repositorio remoto
# Ve a GitHub y crea un nuevo repositorio llamado "inventario-3g"

# En tu proyecto local, agrega el remoto
git remote add origin https://github.com/tu-usuario/inventario-3g.git

# Verifica que todo esté limpio
git status

# Agrega todos los cambios
git add .

# Haz el commit inicial
git commit -m "Preparación para producción - Sistema limpio"

# Sube a GitHub
git push -u origin main
```

### 2. Verificar que .gitignore esté correcto

El archivo `.gitignore` debe incluir:
```
node_modules/
.env
.env.local
uploads/
barcodes/
*.log
.DS_Store
```

### 3. Asegurarte de tener archivos .env.example

Ya están creados:
- `backend/.env.example`
- `backend/.env.production`
- `frontend/.env.example`
- `frontend/.env.production`

---

## 🚂 Opción 1: Railway + Vercel (Recomendada)

Esta es la opción más fácil con despliegue automático.

### Parte A: Desplegar Backend en Railway

#### 1. Crear cuenta en Railway
- Ve a [railway.app](https://railway.app)
- Crea cuenta con GitHub

#### 2. Crear nuevo proyecto
- Click en "New Project"
- Selecciona "Deploy from GitHub repo"
- Autoriza acceso a tu repositorio
- Selecciona el repo "inventario-3g"

#### 3. Agregar PostgreSQL
- En tu proyecto Railway, click en "+ New"
- Selecciona "Database" → "PostgreSQL"
- Railway creará automáticamente la base de datos

#### 4. Configurar variables de entorno del Backend

En Railway, ve a tu servicio backend → Variables:

```env
PORT=5001
NODE_ENV=production

# Railway te proporciona estas automáticamente al conectar PostgreSQL
# Solo necesitas copiarlas desde la pestaña de PostgreSQL
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=xxxxxxxxxxxxxxxxx

# Genera un JWT_SECRET seguro (puedes usar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=tu-jwt-secret-super-seguro-generado

JWT_EXPIRE=7d

# La URL de tu frontend en Vercel (la agregarás después)
FRONTEND_URL=https://tu-app.vercel.app
```

#### 5. Configurar Root Directory

En Railway → Settings:
- **Root Directory**: `backend`
- **Start Command**: `node server.js`
- **Build Command**: `npm install`

#### 6. Generar Domain

- En Railway → Settings → Networking
- Click en "Generate Domain"
- Copia la URL generada (ej: `https://inventario-3g-backend.up.railway.app`)

#### 7. Ejecutar migraciones (si es necesario)

Railway ejecutará automáticamente las migraciones si tienes scripts configurados. Si no:
- Ve a la consola de Railway (pestaña "Deployments")
- Puedes ejecutar comandos manualmente

---

### Parte B: Desplegar Frontend en Vercel

#### 1. Crear cuenta en Vercel
- Ve a [vercel.com](https://vercel.com)
- Crea cuenta con GitHub

#### 2. Importar proyecto
- Click en "Add New..." → "Project"
- Selecciona tu repositorio "inventario-3g"
- Vercel lo detectará automáticamente

#### 3. Configurar proyecto

**Framework Preset**: Vite
**Root Directory**: `frontend`
**Build Command**: `npm run build`
**Output Directory**: `dist`

#### 4. Configurar variables de entorno

En Vercel → Settings → Environment Variables:

```env
VITE_API_URL=https://inventario-3g-backend.up.railway.app/api
VITE_BASE_URL=https://inventario-3g-backend.up.railway.app
```

**IMPORTANTE**: Usa la URL que copiaste de Railway en el paso A.6

#### 5. Desplegar

- Click en "Deploy"
- Vercel construirá y desplegará tu app
- Te dará una URL (ej: `https://inventario-3g.vercel.app`)

#### 6. Actualizar CORS en Railway

Vuelve a Railway y actualiza la variable `FRONTEND_URL`:
```env
FRONTEND_URL=https://inventario-3g.vercel.app
```

Railway redesplegará automáticamente.

---

## 🖥️ Opción 2: Servidor VPS (DigitalOcean, AWS, etc.)

### 1. Preparar servidor

```bash
# Conectarse al servidor
ssh root@tu-servidor-ip

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 (gestor de procesos)
sudo npm install -g pm2

# Instalar Nginx (servidor web)
sudo apt install nginx -y
```

### 2. Configurar PostgreSQL

```bash
# Entrar a PostgreSQL
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE inventario3g;
CREATE USER inventario_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE inventario3g TO inventario_user;
\q
```

### 3. Clonar proyecto

```bash
# Ir a directorio de apps
cd /var/www

# Clonar repositorio
git clone https://github.com/tu-usuario/inventario-3g.git
cd inventario-3g
```

### 4. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
nano .env
```

Contenido del `.env`:
```env
PORT=5001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario3g
DB_USER=inventario_user
DB_PASSWORD=tu_password_seguro
JWT_SECRET=tu-jwt-secret-generado
JWT_EXPIRE=7d
FRONTEND_URL=https://tu-dominio.com
```

```bash
# Ejecutar migraciones
node migrations/run-migration.js

# Crear usuarios iniciales
node scripts/crear-usuarios-prueba.js

# Iniciar con PM2
pm2 start server.js --name inventario-backend
pm2 save
pm2 startup
```

### 5. Configurar Frontend

```bash
cd ../frontend

# Crear archivo .env
nano .env
```

Contenido:
```env
VITE_API_URL=https://tu-dominio.com/api
VITE_BASE_URL=https://tu-dominio.com
```

```bash
# Instalar dependencias
npm install

# Construir para producción
npm run build

# Los archivos estarán en /var/www/inventario-3g/frontend/dist
```

### 6. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/inventario3g
```

Contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Frontend
    location / {
        root /var/www/inventario-3g/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Archivos estáticos (imágenes, PDFs, etc)
    location /uploads {
        proxy_pass http://localhost:5001;
    }
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/inventario3g /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 7. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# El certificado se renovará automáticamente
```

---

## 🔄 Cómo Actualizar el Sistema

### Con Railway + Vercel (Automático)

Es súper simple:

```bash
# 1. Hacer cambios en tu código local

# 2. Commit y push
git add .
git commit -m "Descripción de tus cambios"
git push origin main

# 3. ¡Listo! Railway y Vercel detectan el push y redesplegan automáticamente
```

**Monitorear el despliegue:**
- Railway: Ve a la pestaña "Deployments" para ver el progreso
- Vercel: Ve a la pestaña "Deployments" para ver el progreso

### Con Servidor VPS (Manual)

```bash
# 1. Conectarse al servidor
ssh root@tu-servidor-ip

# 2. Ir al directorio del proyecto
cd /var/www/inventario-3g

# 3. Detener servicios
pm2 stop inventario-backend

# 4. Actualizar código
git pull origin main

# 5. Actualizar backend
cd backend
npm install
# Si hay migraciones nuevas:
node migrations/run-migration.js

# 6. Actualizar frontend
cd ../frontend
npm install
npm run build

# 7. Reiniciar servicios
pm2 restart inventario-backend

# 8. Verificar que todo funcione
pm2 logs inventario-backend
```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to database"

**Railway:**
- Verifica que las variables de entorno estén correctas
- Verifica que PostgreSQL esté corriendo
- Ve a PostgreSQL → Connect y copia las credenciales exactas

**VPS:**
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -U inventario_user -d inventario3g -h localhost
```

### Error: "CORS policy blocked"

Verifica que en el backend:
- La variable `FRONTEND_URL` coincida exactamente con la URL del frontend
- En `server.js` la URL esté en el array de `allowedOrigins`

```javascript
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173', // desarrollo
];
```

### Error: "Failed to fetch" o conexión rechazada

- Verifica que la URL del backend en el frontend sea correcta
- Verifica que el backend esté corriendo
- Verifica que no haya firewall bloqueando

**Railway:**
```bash
# Ver logs
# Ve a Railway → Deployments → View Logs
```

**VPS:**
```bash
# Ver logs del backend
pm2 logs inventario-backend

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

### El frontend se ve pero no carga datos

- Abre las Developer Tools del navegador (F12)
- Ve a la pestaña "Network"
- Verifica si hay errores en las peticiones
- Verifica que `VITE_API_URL` esté correcta

### Cambios no se reflejan después de hacer push

**Railway/Vercel:**
- Ve a la pestaña Deployments
- Verifica que el build haya sido exitoso
- Si falló, lee los logs para ver el error
- Puedes forzar redeploy con "Redeploy"

**VPS:**
- Asegúrate de haber ejecutado `git pull`
- Asegúrate de haber ejecutado `npm run build` en frontend
- Limpia caché del navegador (Ctrl+Shift+R)

---

## ✅ Checklist Final

### Antes del primer despliegue:

- [ ] Código está en GitHub
- [ ] `.gitignore` configurado correctamente
- [ ] Variables de entorno documentadas
- [ ] Migraciones preparadas
- [ ] Scripts de inicialización listos

### Después del despliegue:

- [ ] Backend responde en su URL
- [ ] Frontend carga correctamente
- [ ] Login funciona
- [ ] Se pueden crear artículos
- [ ] Imágenes se cargan correctamente
- [ ] Notificaciones funcionan
- [ ] QR/Barcodes se generan

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs (Railway/Vercel console o `pm2 logs`)
2. Verifica las variables de entorno
3. Consulta la sección de Troubleshooting

**¡Tu sistema está listo para producción!** 🎉
