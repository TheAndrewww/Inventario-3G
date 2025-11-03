# 🚀 Inicio Rápido - 3 Pasos

¿Quieres probar cambios antes de hacer commit? ¡Solo sigue estos 3 pasos!

---

## 📍 Paso 1: Verificar Setup

```bash
cd /Users/andrewww/Documents/Inventario-3G
./test-local.sh
```

### ¿Qué verás?

```
🧪 Ejecutando pruebas de ambiente local...

[TEST 1/7] Verificando PostgreSQL...
✅ PostgreSQL está corriendo

[TEST 2/7] Verificando base de datos 'inventario3g'...
✅ Base de datos existe

[TEST 3/7] Verificando backend/.env...
✅ backend/.env existe

[TEST 4/7] Verificando frontend/.env...
✅ frontend/.env existe

[TEST 5/7] Verificando si el backend está corriendo...
⚠️  Backend no está corriendo
   Inícialo con: cd backend && npm run dev

[TEST 6/7] Verificando si el frontend está corriendo...
⚠️  Frontend no está corriendo
   Inícialo con: cd frontend && npm run dev

[TEST 7/7] Verificando API del backend...
⚠️  API no responde o backend no está corriendo

════════════════════════════════════════
⚠️  5 tests pasaron, 2 fallaron
════════════════════════════════════════
```

Si algo falla, el script te dice exactamente qué hacer.

---

## 🚀 Paso 2: Iniciar Servidores

### Opción A: Inicio Automático (Más Fácil)

```bash
./start-local.sh
```

Esto hace **TODO** automáticamente:
- ✅ Verifica PostgreSQL
- ✅ Crea la base de datos
- ✅ Instala dependencias
- ✅ Inicia backend
- ✅ Inicia frontend
- ✅ Abre el navegador

**Verás algo como:**

```
🚀 Iniciando Inventario 3G en modo desarrollo local...

🔍 Verificando PostgreSQL...
✅ PostgreSQL está corriendo

🔍 Verificando base de datos...
✅ Base de datos 'inventario3g' existe

🔍 Verificando archivos de configuración...
✅ Archivos .env encontrados

📦 Verificando dependencias...
✅ Dependencias instaladas

🚀 Iniciando Backend en http://localhost:5001
✅ Backend corriendo (PID: 12345)

🚀 Iniciando Frontend en http://localhost:5173
✅ Frontend corriendo (PID: 12346)

═══════════════════════════════════════
🎉 ¡Todo está listo!
═══════════════════════════════════════

📍 Backend:  http://localhost:5001
📍 Frontend: http://localhost:5173

🛑 Para detener: presiona Ctrl+C
```

### Opción B: Inicio Manual (Más Control)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## 🎨 Paso 3: Desarrollar y Probar

1. **Abre el navegador:** http://localhost:5173

2. **Login:**
   ```
   Email: admin@3g.com
   Password: admin123
   ```

3. **Haz tus cambios** en el código

4. **Los cambios se reflejan automáticamente** (Hot Reload)

5. **Verifica que funcione:**
   - ✅ Sin errores en consola del navegador (F12)
   - ✅ Sin errores en terminal del backend
   - ✅ La funcionalidad hace lo que esperas

6. **Si todo funciona, haz commit:**
   ```bash
   git add .
   git commit -m "descripción de tus cambios"
   git push
   ```

---

## 🛑 Detener Servidores

### Si usaste start-local.sh:
Simplemente presiona **Ctrl+C** en la terminal

### Si iniciaste manualmente:
Presiona **Ctrl+C** en cada terminal

---

## 📊 Monitorear Logs

Ver logs en tiempo real:

```bash
# Backend
tail -f backend.log

# Frontend
tail -f frontend.log

# Ambos al mismo tiempo
tail -f backend.log frontend.log
```

---

## 🐛 ¿Algo no funciona?

### Error: "Port 5001 already in use"

```bash
# Ver qué está usando el puerto
lsof -i :5001

# Matar el proceso
kill -9 [PID]
```

### Error: "Cannot connect to database"

```bash
# Verificar PostgreSQL
brew services list | grep postgresql

# Iniciarlo si está detenido
brew services start postgresql@14

# Crear base de datos si no existe
createdb inventario3g
```

### Frontend no se conecta al backend

Verifica que `frontend/.env` tenga:
```env
VITE_BASE_URL=http://localhost:5001
VITE_API_URL=http://localhost:5001/api
```

O si prefieres acceder desde otros dispositivos en tu red:
```env
VITE_BASE_URL=http://192.168.100.26:5001
VITE_API_URL=http://192.168.100.26:5001/api
```

---

## 📖 Más Información

Para una guía más detallada, consulta:

📘 **[DESARROLLO_LOCAL.md](./DESARROLLO_LOCAL.md)** - Guía completa con:
- Instalación desde cero
- Configuración detallada
- Solución de problemas
- Comandos útiles
- Mejores prácticas

---

## ✅ Checklist Pre-Commit

Antes de hacer `git commit`, verifica:

- [ ] Backend corre sin errores
- [ ] Frontend corre sin errores
- [ ] Login funciona
- [ ] La nueva funcionalidad funciona como se espera
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs del backend
- [ ] Probaste con diferentes roles (si aplica)
- [ ] Los datos se guardan correctamente en la BD

**Si todos los ✅ están marcados, ¡es seguro hacer commit!**

---

## 🎯 Flujo de Trabajo Típico

```
1. ./test-local.sh          → Verificar que todo esté ok
2. ./start-local.sh          → Iniciar servidores
3. [Hacer cambios]           → Editar código
4. [Ver cambios en browser]  → http://localhost:5173
5. [Probar funcionalidad]    → Verificar que funciona
6. git add .                 → Agregar cambios
7. git commit -m "..."       → Hacer commit
8. git push                  → Subir a GitHub
9. Ctrl+C                    → Detener servidores
```

---

## 💡 Tips

- 💾 **Auto-save:** Guarda tu editor en modo auto-save para ver cambios al instante
- 🔄 **Hot Reload:** No necesitas recargar el navegador, se actualiza solo
- 👀 **DevTools:** Mantén la consola abierta (F12) para ver errores
- 📝 **Logs:** Abre `tail -f backend.log` en otra terminal para ver logs en tiempo real
- 🧪 **Testing:** Prueba con diferentes roles antes de hacer commit
- 🎯 **Focus:** Trabaja en una funcionalidad a la vez
- ✨ **Commit:** Haz commits pequeños y frecuentes

---

¡Feliz desarrollo! 🚀✨
