# 🚀 MÓDULO 1: PLAN DE IMPLEMENTACIÓN EN 1 SEMANA
## Metodología: Sprints Diarios con MVP

---

## 🎯 ESTRATEGIA

### Enfoque MVP (Minimum Viable Product)

**Funcionalidades CORE (Incluidas):**
- ✅ CRUD de artículos
- ✅ Generación automática de QR
- ✅ Scanner QR básico
- ✅ Retiros/Pedidos simples
- ✅ Historial básico
- ✅ Stock en tiempo real
- ✅ Búsqueda simple
- ✅ Autenticación básica

**Funcionalidades DIFERIDAS (Fase 2):**
- ⏳ Aprobaciones de supervisor (se hace manual primero)
- ⏳ Reportes avanzados (solo básicos)
- ⏳ Alertas automáticas (se configuran después)
- ⏳ Exportación a Excel (solo PDF)
- ⏳ Gestión de ubicaciones complejas (ubicación simple)
- ⏳ Modo offline avanzado

### Equipo Requerido

**Ideal:**
- 1 Backend Developer (puede ser tú)
- 1 Frontend Developer (puede ser tú)
- 1 Tester (puede ser usuario final)

**Realista (solo tú):**
- Desarrollo full-stack
- Testing propio
- 8-10 horas/día

---

## 📅 DIVISIÓN DE SPRINTS

---

# 🏃 SPRINT 1 - LUNES
## "Fundación y Backend Core"

**Duración:** 8-10 horas  
**Objetivo:** Tener backend funcional con BD y APIs básicas

---

### 🌅 MAÑANA (4-5 horas)

#### 1. Configuración Inicial (1.5h)

**Backend:**
```bash
# Crear proyecto
mkdir inventario3g-backend
cd inventario3g-backend
npm init -y

# Instalar dependencias
npm install express pg sequelize cors dotenv bcrypt jsonwebtoken
npm install --save-dev nodemon

# Estructura de carpetas
mkdir -p src/{config,models,controllers,routes,middleware,utils}
```

**Tareas:**
- [ ] Crear estructura de carpetas
- [ ] Configurar package.json con scripts
- [ ] Configurar variables de entorno
- [ ] Setup de PostgreSQL
- [ ] Configurar Sequelize

**Archivos a crear:**
- `server.js`
- `src/config/database.js`
- `.env.example`
- `.gitignore`

#### 2. Base de Datos (1.5h)

**Modelos Sequelize:**

```javascript
// models/Usuario.js
// models/Articulo.js
// models/Categoria.js
// models/Movimiento.js
// models/DetalleMovimiento.js
```

**Tareas:**
- [ ] Crear modelo Usuario
- [ ] Crear modelo Articulo
- [ ] Crear modelo Categoria
- [ ] Crear modelo Movimiento
- [ ] Crear modelo DetalleMovimiento
- [ ] Definir relaciones
- [ ] Crear migraciones
- [ ] Ejecutar migraciones
- [ ] Crear seeders para datos iniciales

**SQL a ejecutar:**
```sql
CREATE DATABASE inventario3g;
-- Tablas se crean con Sequelize
```

#### 3. Autenticación (1.5h)

**Implementar:**
- [ ] Registro de usuarios
- [ ] Login con JWT
- [ ] Middleware de autenticación
- [ ] Middleware de roles

**Endpoints:**
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/verify
```

**Archivos:**
- `controllers/auth.controller.js`
- `routes/auth.routes.js`
- `middleware/auth.middleware.js`

---

### 🌆 TARDE (4-5 horas)

#### 4. APIs de Artículos (2h)

**Endpoints principales:**
```
GET    /api/articulos          # Listar todos
GET    /api/articulos/:id      # Ver uno
GET    /api/articulos/qr/:qr   # Buscar por QR
POST   /api/articulos          # Crear + generar QR
PUT    /api/articulos/:id      # Actualizar
DELETE /api/articulos/:id      # Eliminar (soft delete)
GET    /api/articulos/search   # Buscar
```

**Tareas:**
- [ ] Controller de artículos
- [ ] Routes de artículos
- [ ] Validaciones
- [ ] Generador de QR automático
- [ ] Upload de imágenes (opcional)

**Archivos:**
- `controllers/articulos.controller.js`
- `routes/articulos.routes.js`
- `utils/qr-generator.js`

#### 5. APIs de Movimientos (1.5h)

**Endpoints:**
```
GET  /api/movimientos           # Listar historial
GET  /api/movimientos/:id       # Ver detalle
POST /api/movimientos           # Crear retiro
PUT  /api/movimientos/:id       # Actualizar estado
```

**Tareas:**
- [ ] Controller de movimientos
- [ ] Routes de movimientos
- [ ] Lógica de actualización de stock
- [ ] Generación de ticket ID

**Archivos:**
- `controllers/movimientos.controller.js`
- `routes/movimientos.routes.js`
- `utils/ticket-generator.js`

#### 6. Testing Backend (1h)

**Probar con Postman/Thunder Client:**
- [ ] Auth: Register, Login
- [ ] Artículos: CRUD completo
- [ ] Movimientos: Crear retiro
- [ ] Stock: Verificar actualización
- [ ] QR: Verificar generación

---

### 📝 ENTREGABLES DEL DÍA 1

✅ Backend funcional con Express  
✅ Base de datos PostgreSQL configurada  
✅ Modelos y relaciones creadas  
✅ Autenticación JWT funcionando  
✅ APIs de artículos completas  
✅ APIs de movimientos básicas  
✅ Generador de QR funcionando  
✅ Stock se actualiza automáticamente  

---

# 🏃 SPRINT 2 - MARTES
## "Frontend Base y Autenticación"

**Duración:** 8-10 horas  
**Objetivo:** Estructura del frontend + Login funcionando

---

### 🌅 MAÑANA (4-5 horas)

#### 1. Setup Frontend (1h)

```bash
# Crear proyecto React
npm create vite@latest inventario3g-frontend -- --template react
cd inventario3g-frontend

# Instalar dependencias
npm install react-router-dom axios tailwindcss
npm install lucide-react date-fns
npm install html5-qrcode qrcode

# Configurar Tailwind
npx tailwindcss init -p
```

**Tareas:**
- [ ] Crear proyecto Vite + React
- [ ] Configurar Tailwind CSS
- [ ] Estructura de carpetas
- [ ] Configurar rutas
- [ ] Configurar Axios

**Estructura:**
```
src/
├── components/
│   ├── common/
│   ├── layout/
│   └── auth/
├── pages/
├── context/
├── services/
├── utils/
└── App.jsx
```

#### 2. Componentes Base (1.5h)

**Crear componentes comunes:**
- [ ] Button.jsx
- [ ] Input.jsx
- [ ] Modal.jsx
- [ ] Loader.jsx
- [ ] Card.jsx

**Archivos:**
```javascript
// components/common/Button.jsx
// components/common/Input.jsx
// components/common/Modal.jsx
// components/common/Loader.jsx
```

#### 3. Layout Principal (1.5h)

**Layouts:**
- [ ] MainLayout.jsx (con sidebar)
- [ ] MobileLayout.jsx (con bottom nav)
- [ ] AuthLayout.jsx (para login)

**Navegación:**
- [ ] Sidebar desktop
- [ ] Bottom navigation móvil
- [ ] Header con usuario

**Archivos:**
```javascript
// components/layout/MainLayout.jsx
// components/layout/BottomNav.jsx
// components/layout/Sidebar.jsx
```

---

### 🌆 TARDE (4-5 horas)

#### 4. Autenticación Frontend (2h)

**Context de Auth:**
- [ ] AuthContext.jsx
- [ ] AuthProvider
- [ ] useAuth hook
- [ ] PrivateRoute component

**Páginas:**
- [ ] Login.jsx
- [ ] Register.jsx (opcional)

**Servicios:**
- [ ] auth.service.js
- [ ] api.js (Axios configurado)

**Tareas:**
- [ ] Crear formulario de login
- [ ] Conectar con backend
- [ ] Guardar JWT en localStorage
- [ ] Verificar token al cargar app
- [ ] Redireccionar según auth

**Archivos:**
```javascript
// context/AuthContext.jsx
// pages/Login.jsx
// services/auth.service.js
// services/api.js
```

#### 5. Sistema de Rutas (1.5h)

**Router completo:**
```javascript
// router.jsx
- / → redirect to /inventario
- /login → Login page
- /inventario → Lista de artículos
- /pedido → Carrito de pedido
- /historial → Historial de movimientos
- /scanner → Scanner QR
- /cuenta → Perfil de usuario
```

**Tareas:**
- [ ] Configurar React Router
- [ ] Rutas públicas (login)
- [ ] Rutas privadas (requieren auth)
- [ ] Rutas por rol (admin vs empleado)
- [ ] Loading states
- [ ] 404 page

#### 6. Testing Frontend (1h)

**Probar:**
- [ ] Login funciona
- [ ] Token se guarda
- [ ] Redirección correcta
- [ ] Logout funciona
- [ ] Rutas protegidas funcionan
- [ ] Responsive design básico

---

### 📝 ENTREGABLES DEL DÍA 2

✅ Frontend configurado con Vite + React  
✅ Tailwind CSS funcionando  
✅ Componentes base creados  
✅ Layout principal con navegación  
✅ Login funcional conectado a backend  
✅ Sistema de rutas protegidas  
✅ Context de autenticación  
✅ Diseño responsive básico  

---

# 🏃 SPRINT 3 - MIÉRCOLES
## "Inventario y Artículos"

**Duración:** 8-10 horas  
**Objetivo:** CRUD completo de artículos funcionando

---

### 🌅 MAÑANA (4-5 horas)

#### 1. Servicio de Artículos (1h)

**API Client:**
```javascript
// services/articulos.service.js
- getAll()
- getById(id)
- getByQR(qr)
- create(data)
- update(id, data)
- delete(id)
- search(query)
```

**Tareas:**
- [ ] Crear service con todos los métodos
- [ ] Manejo de errores
- [ ] Loading states

#### 2. Vista de Inventario (2h)

**Página principal:**
- [ ] Tabla de artículos (web)
- [ ] Cards de artículos (móvil)
- [ ] Búsqueda en tiempo real
- [ ] Filtros básicos
- [ ] Indicadores de stock

**Componentes:**
```javascript
// pages/Inventario.jsx
// components/articulo/ArticuloCard.jsx
// components/articulo/ArticuloTable.jsx
```

**Tareas:**
- [ ] Fetch de artículos al cargar
- [ ] Renderizar lista/tabla
- [ ] Implementar búsqueda
- [ ] Indicadores visuales (stock bajo)
- [ ] Loading y error states

#### 3. Formulario de Nuevo Artículo (1.5h)

**Form completo:**
- [ ] Todos los campos
- [ ] Validaciones
- [ ] Submit a backend
- [ ] Mostrar QR generado
- [ ] Descarga de QR

**Componentes:**
```javascript
// components/articulo/ArticuloForm.jsx
// components/articulo/QRDisplay.jsx
```

**Campos:**
- Nombre, Descripción
- Categoría, Ubicación
- Stock inicial, Stock mínimo
- Costo unitario, Unidad
- Imagen (opcional)

---

### 🌆 TARDE (4-5 horas)

#### 4. Modal de Detalle de Artículo (1h)

**Ver detalles:**
- [ ] Información completa
- [ ] Código QR
- [ ] Historial de movimientos
- [ ] Botón editar
- [ ] Botón agregar a pedido

**Componente:**
```javascript
// components/articulo/ArticuloDetail.jsx
```

#### 5. Editar Artículo (1.5h)

**Funcionalidad:**
- [ ] Cargar datos actuales
- [ ] Form pre-llenado
- [ ] Actualizar artículo
- [ ] Regenerar QR (opcional)
- [ ] Volver a lista

**Reutilizar:**
- Mismo form de crear
- Modo "edit" vs "create"

#### 6. Context de Inventario (1h)

**State management:**
```javascript
// context/InventarioContext.jsx
- artículos
- loading
- error
- fetchArticulos()
- crearArticulo()
- actualizarArticulo()
- eliminarArticulo()
```

#### 7. Testing de Inventario (1h)

**Probar:**
- [ ] Lista carga correctamente
- [ ] Búsqueda funciona
- [ ] Crear artículo funciona
- [ ] QR se genera automáticamente
- [ ] Editar artículo funciona
- [ ] Ver detalle funciona
- [ ] Responsive en móvil

---

### 📝 ENTREGABLES DEL DÍA 3

✅ Lista de inventario funcional  
✅ Búsqueda en tiempo real  
✅ Crear artículo con QR automático  
✅ Editar artículo  
✅ Ver detalles de artículo  
✅ QR se genera y muestra  
✅ Context de inventario  
✅ Responsive design  

---

# 🏃 SPRINT 4 - JUEVES
## "Pedidos, Scanner y Movimientos"

**Duración:** 8-10 horas  
**Objetivo:** Sistema de retiros completo + Scanner QR

---

### 🌅 MAÑANA (4-5 horas)

#### 1. Context de Pedido (1h)

**Carrito de pedido:**
```javascript
// context/PedidoContext.jsx
- items []
- agregarArticulo()
- eliminarArticulo()
- actualizarCantidad()
- incrementar()
- decrementar()
- limpiarPedido()
- getTotalItems()
```

**Persistencia:**
- LocalStorage para no perder pedido

#### 2. Scanner QR (2h)

**Implementar scanner:**
- [ ] Componente QRScanner
- [ ] Usar html5-qrcode
- [ ] Activar cámara
- [ ] Leer QR
- [ ] Buscar artículo
- [ ] Agregar a pedido automáticamente

**Componentes:**
```javascript
// components/scanner/QRScanner.jsx
// pages/Scanner.jsx
```

**Funcionalidad:**
- Botón para abrir scanner
- Vista de cámara
- Marcos de escaneo
- Resultado del scan
- Agregar al pedido directo

#### 3. Vista de Pedido (1.5h)

**Página de carrito:**
- [ ] Lista de artículos en pedido
- [ ] Controles +/-
- [ ] Eliminar artículo
- [ ] Resumen (total piezas)
- [ ] Botón finalizar

**Componentes:**
```javascript
// pages/Pedido.jsx
// components/pedido/PedidoItem.jsx
// components/pedido/PedidoResumen.jsx
```

---

### 🌆 TARDE (4-5 horas)

#### 4. Finalizar Pedido (1.5h)

**Proceso:**
- [ ] Validar pedido no vacío
- [ ] Enviar a backend
- [ ] Crear movimiento
- [ ] Actualizar stock
- [ ] Generar ticket
- [ ] Limpiar carrito
- [ ] Mostrar confirmación

**Service:**
```javascript
// services/movimientos.service.js
- crearRetiro(items)
- getHistorial()
- getById(id)
```

#### 5. Vista de Ticket (1.5h)

**Pantalla de éxito:**
- [ ] Información del retiro
- [ ] ID de ticket
- [ ] Fecha y hora
- [ ] Usuario
- [ ] Lista de artículos
- [ ] Total de piezas
- [ ] Botón descargar PDF
- [ ] Botón nuevo pedido

**Componentes:**
```javascript
// pages/Ticket.jsx
// components/pedido/TicketDisplay.jsx
```

#### 6. Historial de Movimientos (1.5h)

**Vista de historial:**
- [ ] Lista de movimientos
- [ ] Filtro por fecha
- [ ] Ver detalle de ticket
- [ ] Estados visuales
- [ ] Búsqueda

**Componentes:**
```javascript
// pages/Historial.jsx
// components/historial/HistorialCard.jsx
// components/historial/MovimientoDetalle.jsx
```

#### 7. Testing Completo (1h)

**Probar flujo completo:**
- [ ] Escanear QR → Agregar a pedido
- [ ] Buscar artículo → Agregar a pedido
- [ ] Modificar cantidades
- [ ] Finalizar pedido
- [ ] Stock se actualiza
- [ ] Ticket se genera
- [ ] Ver en historial
- [ ] Mobile + Desktop

---

### 📝 ENTREGABLES DEL DÍA 4

✅ Scanner QR funcional  
✅ Carrito de pedido completo  
✅ Sistema de retiros funcionando  
✅ Stock se actualiza automáticamente  
✅ Tickets generados  
✅ Historial de movimientos  
✅ Flujo end-to-end completo  
✅ Pruebas en móvil y desktop  

---

# 🏃 SPRINT 5 - VIERNES
## "Pulido, Testing y Deployment"

**Duración:** 8-10 horas  
**Objetivo:** Sistema completo, testeado y desplegado

---

### 🌅 MAÑANA (4-5 horas)

#### 1. Perfil de Usuario (1h)

**Página de cuenta:**
- [ ] Información del usuario
- [ ] Cambiar contraseña
- [ ] Configuración
- [ ] Cerrar sesión

**Componente:**
```javascript
// pages/Cuenta.jsx
```

#### 2. Dashboard Simple (1h)

**Estadísticas básicas:**
- [ ] Total de artículos
- [ ] Total de movimientos hoy
- [ ] Artículos en stock bajo
- [ ] Último movimiento

**Componente:**
```javascript
// pages/Dashboard.jsx (opcional)
// components/dashboard/KPICard.jsx
```

#### 3. Mejoras de UX (1.5h)

**Pulir detalles:**
- [ ] Loading states en todas las páginas
- [ ] Error handling visual
- [ ] Mensajes de éxito/error (toasts)
- [ ] Animaciones suaves
- [ ] Confirmaciones de acciones
- [ ] Validaciones de formularios

**Instalar:**
```bash
npm install react-hot-toast
```

#### 4. Responsive Final (1h)

**Optimizar para móvil:**
- [ ] Verificar todas las pantallas
- [ ] Ajustar tamaños
- [ ] Touch targets adecuados
- [ ] Bottom nav funcional
- [ ] Scroll suave

---

### 🌆 TARDE (4-5 horas)

#### 5. Testing Integral (2h)

**Testing manual completo:**

**Como Empleado:**
- [ ] Login
- [ ] Ver inventario
- [ ] Buscar artículo
- [ ] Escanear QR
- [ ] Agregar a pedido
- [ ] Modificar cantidades
- [ ] Finalizar pedido
- [ ] Ver ticket
- [ ] Ver historial
- [ ] Logout

**Como Administrador:**
- [ ] Login
- [ ] Crear artículo nuevo
- [ ] QR se genera automáticamente
- [ ] Descargar QR
- [ ] Editar artículo
- [ ] Eliminar artículo
- [ ] Ver reportes básicos

**Cross-browser:**
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Safari
- [ ] Mobile Chrome

**Bug fixing:**
- [ ] Documentar bugs encontrados
- [ ] Fix críticos
- [ ] Priorizar nice-to-have

#### 6. Deployment (2h)

**Configurar Mac Mini:**

```bash
# Backend
cd ~/Sites/inventario3g-backend
npm install --production
pm2 start npm --name "inventario3g-api" -- start
pm2 save

# Frontend
cd ~/Sites/inventario3g-frontend
npm run build
# Copiar dist/ a Nginx
```

**Configurar Nginx:**
```nginx
server {
    listen 80;
    server_name inventario.local;
    
    root /Users/tu-usuario/Sites/inventario3g-frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

**Tareas deployment:**
- [ ] Configurar variables de entorno producción
- [ ] Build del frontend
- [ ] Deploy backend con PM2
- [ ] Configurar Nginx
- [ ] Configurar DNS local (inventario.local)
- [ ] Probar acceso desde otros dispositivos
- [ ] SSL (opcional, para después)

#### 7. Documentación y Capacitación (1h)

**Crear documentación básica:**
- [ ] README.md del proyecto
- [ ] Manual rápido de usuario
- [ ] Video tutorial corto (5 min)
- [ ] FAQ básico

**Preparar capacitación:**
- [ ] Slides simples
- [ ] Demo en vivo preparada
- [ ] Usuarios de prueba creados

---

### 📝 ENTREGABLES DEL DÍA 5

✅ Sistema completamente funcional  
✅ UX pulida y responsive  
✅ Testing completo realizado  
✅ Bugs críticos corregidos  
✅ Desplegado en Mac Mini  
✅ Accesible en red local  
✅ Documentación básica  
✅ Listo para capacitación  

---

## 📊 RESUMEN SEMANAL

| Día | Sprint | Entregable Principal | Horas |
|-----|--------|---------------------|-------|
| **L** | Backend Core | APIs + BD + Auth | 8-10h |
| **M** | Frontend Base | React + Login | 8-10h |
| **X** | Inventario | CRUD Artículos + QR | 8-10h |
| **J** | Pedidos | Scanner + Retiros | 8-10h |
| **V** | Deploy | Testing + Producción | 8-10h |

**Total:** 40-50 horas de desarrollo intensivo

---

## ✅ CHECKLIST FINAL

### Funcionalidades MVP

**Backend:**
- [x] Base de datos PostgreSQL
- [x] Autenticación JWT
- [x] CRUD Artículos
- [x] CRUD Movimientos
- [x] Generación automática de QR
- [x] Actualización de stock

**Frontend:**
- [x] Login/Logout
- [x] Lista de inventario
- [x] Búsqueda de artículos
- [x] Crear artículo con QR
- [x] Editar artículo
- [x] Scanner QR
- [x] Carrito de pedido
- [x] Finalizar retiro
- [x] Ver ticket
- [x] Historial

**Deployment:**
- [x] Backend en producción
- [x] Frontend en producción
- [x] Accesible en red local
- [x] Datos de prueba cargados

---

## 🎯 MÉTRICAS DE ÉXITO

Al finalizar la semana, debes poder:

✅ Crear un artículo y ver su QR generado automáticamente  
✅ Escanear el QR desde móvil  
✅ Agregar artículo al pedido  
✅ Finalizar pedido  
✅ Ver el stock actualizado  
✅ Ver el ticket generado  
✅ Consultar el historial  
✅ Todo funcionando en red local  

---

## ⚠️ RIESGOS Y MITIGACIONES

### Riesgos Principales:

1. **Tiempo insuficiente**
   - Mitigation: Priorizar MVP, diferir nice-to-have
   - Trabajar horas extra si es necesario
   - Pedir ayuda si es posible

2. **Bugs críticos en producción**
   - Mitigation: Testing exhaustivo día 5
   - Rollback plan
   - Logging adecuado

3. **Performance issues**
   - Mitigation: Optimizar queries
   - Indexar BD
   - Lazy loading en frontend

4. **Scanner QR no funciona**
   - Mitigation: Backup plan con input manual
   - Testing en múltiples dispositivos
   - Permisos de cámara correctos

---

## 💡 TIPS PARA ÉXITO

### Durante la Semana:

1. **Commitstempranos y frecuentes**
   ```bash
   git commit -m "feat: implement article CRUD"
   ```

2. **Testing continuo**
   - No esperar a viernes
   - Probar cada feature inmediatamente

3. **Documentar decisiones**
   - Por qué se tomó X decisión
   - TODOs para fase 2

4. **Mantener comunicación**
   - Daily standup (aunque seas solo)
   - Documentar blockers

5. **No perfeccionar, iterar**
   - MVP primero
   - Mejoras después
   - "Done is better than perfect"

### Code Standards:

```javascript
// Usar nombres descriptivos
const crearArticulo = () => {} // ✅
const fn1 = () => {}           // ❌

// Comentar código complejo
// Genera QR con alta corrección de errores para impresión
await QRCode.toFile(path, data, { errorCorrectionLevel: 'H' });

// Manejar errores
try {
  await api.post('/articulos', data);
} catch (error) {
  console.error('Error creando artículo:', error);
  toast.error('No se pudo crear el artículo');
}
```

---

## 📞 SOPORTE POST-SPRINT

### Semana 2 (Estabilización):
- Fix bugs reportados
- Optimizaciones
- Mejoras de UX
- Capacitación de usuarios

### Semana 3-4 (Mejoras):
- Agregar features diferidas
- Reportes avanzados
- Alertas automáticas
- Exportación Excel

---

## 🎉 PREPARACIÓN PREVIA (OPCIONAL)

### Antes del Lunes:

**Setup inicial:**
- [ ] Mac Mini listo y actualizado
- [ ] PostgreSQL instalado
- [ ] Node.js 20 instalado
- [ ] Git configurado
- [ ] Editor (VSCode) configurado
- [ ] Café/bebidas energéticas 😄

**Referencias:**
- [ ] Mockups en Figma abiertos
- [ ] Documentación técnica lista
- [ ] Este plan impreso/abierto

---

## 🚀 ¡ESTÁS LISTO!

**Este plan es agresivo pero factible.** 

La clave es:
1. ⏰ **Disciplina de tiempo** - 8-10h diarias
2. 🎯 **Enfoque en MVP** - No distraerse
3. 🧪 **Testing continuo** - No acumular bugs
4. 💪 **Persistencia** - Algunos días serán duros

**¡Vamos a hacerlo! 🔥**