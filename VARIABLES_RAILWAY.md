# 🔐 Variables de Entorno para Railway

## Backend - Variables a configurar en Railway

Cuando llegues al paso de configurar variables de entorno en Railway, copia y pega estas:

### Variables del Servidor
```
PORT=5001
NODE_ENV=production
```

### Variables de Base de Datos
**IMPORTANTE**: Railway te proporciona estas automáticamente cuando agregas PostgreSQL.
Para copiarlas:
1. Click en el servicio "PostgreSQL" en Railway
2. Ve a la pestaña "Variables"
3. Copia cada una de estas variables (Railway ya las tiene configuradas):

```
DATABASE_URL=postgresql://postgres:xxxxx@xxxx.railway.app:5432/railway
```

**ALTERNATIVA**: Si prefieres configurarlas individualmente:
```
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=xxxxxxxxxxxxxxxxx
```

### Variables de Autenticación
**JWT_SECRET** (IMPORTANTE - Usar este valor seguro generado):
```
JWT_SECRET=68ae337349e3a73f4d55b14db251b4625e8948cb45eb764cf10ca10cbc0989b2
```

```
JWT_EXPIRE=7d
```

### Variable de CORS (ACTUALIZAR DESPUÉS)
**FRONTEND_URL** - Esta la configurarás DESPUÉS de desplegar en Vercel:
```
FRONTEND_URL=https://tu-app.vercel.app
```

**IMPORTANTE**:
- **NO la agregues todavía** (no tienes la URL de Vercel aún)
- La agregarás después del Paso 5 cuando tengas el dominio de Railway
- Por ahora, el backend funcionará sin ella para desarrollo

---

## 📋 Resumen de Variables (para copiar directo en Railway AHORA)

```env
PORT=5001
NODE_ENV=production
JWT_SECRET=68ae337349e3a73f4d55b14db251b4625e8948cb45eb764cf10ca10cbc0989b2
JWT_EXPIRE=7d
```

**Recuerda**:
- Las variables de base de datos (DB_HOST, DB_PORT, etc.) Railway las configura automáticamente al agregar PostgreSQL
- **NO agregues FRONTEND_URL todavía** - la agregarás después de configurar Vercel

---

## 🎯 Siguiente paso después de configurar variables

1. Railway desplegará automáticamente tu backend
2. Genera un dominio público (Settings → Networking → Generate Domain)
3. Copia esa URL para usarla en Vercel

---

## ✅ Checklist

- [ ] PORT configurado
- [ ] NODE_ENV configurado
- [ ] JWT_SECRET configurado (usar el generado arriba)
- [ ] JWT_EXPIRE configurado
- [ ] PostgreSQL agregado y conectado
- [ ] Variables de DB configuradas (automático)
- [ ] FRONTEND_URL configurado (actualizar después)
- [ ] Dominio generado en Railway
