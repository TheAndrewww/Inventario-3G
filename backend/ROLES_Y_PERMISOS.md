# Roles y Permisos del Sistema de Inventario

## Roles Disponibles

El sistema cuenta con 5 roles diferentes, cada uno con permisos específicos:

### 1. **Administrador** (`administrador`)
- **Descripción**: Acceso total al sistema
- **Permisos**:
  - Gestión completa de usuarios
  - Gestión completa de inventario
  - Gestión completa de movimientos
  - Gestión de compras
  - Acceso a todos los reportes
  - Configuración del sistema
  - Gestión de categorías y ubicaciones

### 2. **Supervisor** (`supervisor`)
- **Descripción**: Supervisión general de operaciones
- **Permisos**:
  - Ver todos los módulos
  - Aprobar/rechazar movimientos
  - Acceso a reportes avanzados
  - Gestión de inventario
  - Gestión de compras
  - Supervisión de diseños
  - **NO puede**: Gestionar usuarios ni configuración del sistema

### 3. **Almacén** (`almacen`)
- **Descripción**: Gestión del inventario físico
- **Permisos**:
  - Agregar/editar/eliminar artículos
  - Registrar entradas y salidas de inventario
  - Generar códigos de barras
  - Consultar stock y ubicaciones
  - Ver historial de movimientos
  - **NO puede**: Aprobar compras, gestionar usuarios, ver módulos de diseño

### 4. **Compras** (`compras`)
- **Descripción**: Gestión de adquisiciones
- **Permisos**:
  - Crear órdenes de compra
  - Gestionar proveedores
  - Ver inventario (solo lectura)
  - Registrar entradas de inventario por compras
  - Ver reportes de compras
  - **NO puede**: Modificar inventario directamente, aprobar movimientos sin autorización

### 5. **Diseñador** (`diseñador`)
- **Descripción**: Diseño de productos
- **Permisos**:
  - Crear/editar especificaciones de productos
  - Ver inventario de materiales (solo lectura)
  - Gestionar diseños y planos
  - Solicitar materiales
  - **NO puede**: Modificar inventario, aprobar compras, gestionar movimientos

---

## Middlewares de Autorización

El sistema incluye los siguientes middlewares para controlar el acceso:

### Middlewares Básicos

- **`verificarToken`**: Verifica que el usuario tenga un token JWT válido
- **`verificarRol(...roles)`**: Verifica que el usuario tenga uno de los roles especificados

### Middlewares Específicos

```javascript
// Solo administrador
esAdministrador

// Supervisor o administrador
esSupervisorOAdmin

// Acceso a inventario (almacen, supervisor, administrador)
accesoInventario

// Acceso a compras (compras, supervisor, administrador)
accesoCompras

// Acceso a diseño (diseñador, supervisor, administrador)
accesoDiseño

// Acceso a gestión (supervisor, administrador)
accesoGestion
```

### Uso en Rutas

```javascript
// Ejemplo: Solo administradores
router.post('/usuarios', verificarToken, esAdministrador, crearUsuario);

// Ejemplo: Acceso a inventario
router.post('/articulos', verificarToken, accesoInventario, crearArticulo);

// Ejemplo: Múltiples roles específicos
router.get('/reportes', verificarToken, verificarRol('compras', 'supervisor', 'administrador'), getReportes);
```

---

## Migración de Roles Antiguos

Si tenías usuarios con roles antiguos, se realizó la siguiente migración automática:

| Rol Antiguo    | Rol Nuevo      |
|----------------|----------------|
| `empleado`     | `almacen`      |
| `supervisor`   | `supervisor`   |
| `administrador`| `administrador`|

---

## Crear Usuarios con Nuevos Roles

### Ejemplo API

```bash
POST /api/usuarios
{
  "nombre": "Juan Pérez",
  "email": "juan@3g.com",
  "password": "password123",
  "rol": "diseñador",  # Usar uno de: administrador, diseñador, compras, almacen, supervisor
  "puesto": "Diseñador Senior"
}
```

### Valores Válidos para `rol`

- `administrador`
- `diseñador`
- `compras`
- `almacen`
- `supervisor`

---

## Recomendaciones de Seguridad

1. **Principio de Menor Privilegio**: Asignar el rol mínimo necesario para cada usuario
2. **Revisión Periódica**: Auditar roles y permisos cada 3 meses
3. **Usuarios Inactivos**: Desactivar usuarios que ya no necesiten acceso
4. **Contraseñas Seguras**: Forzar contraseñas fuertes (mínimo 8 caracteres, mayúsculas, números)
5. **Tokens**: Los tokens JWT expiran después de 7 días

---

## Ejemplos de Casos de Uso

### Caso 1: Flujo de Compra
1. **Diseñador** crea especificación de producto
2. **Compras** genera orden de compra
3. **Compras** registra entrada cuando llega el material
4. **Almacén** verifica y actualiza ubicaciones
5. **Supervisor** revisa el proceso completo

### Caso 2: Salida de Inventario
1. **Almacén** registra salida de materiales
2. **Supervisor** aprueba la salida (si es alta cantidad)
3. Sistema actualiza stock automáticamente

### Caso 3: Reporte de Inventario
1. **Administrador** o **Supervisor** accede a reportes completos
2. **Compras** ve solo reportes relacionados con adquisiciones
3. **Almacén** ve reportes de stock y movimientos
4. **Diseñador** ve solo materiales disponibles

---

## Soporte

Para solicitar cambios de rol o permisos adicionales, contactar al administrador del sistema.
