# 📦 MÓDULO 1: GESTIÓN DE INVENTARIO
## Especificación Completa y Detallada

---

## 🎯 Descripción General

El **Módulo 1 - Inventario** es el corazón del sistema ERP 3G. Permite controlar, rastrear y gestionar todos los materiales, herramientas y equipos de 3G Arquitectura Textil en tiempo real.

**Objetivo Principal:** Eliminar el control manual de inventario, reducir pérdidas y optimizar el uso de materiales.

**Prioridad:** CRÍTICA - Primera fase de implementación  
**Tiempo de desarrollo:** 6-8 semanas  
**Usuarios principales:** Administradores, Supervisores, Empleados de campo  

---

## 📋 FUNCIONALIDADES PRINCIPALES

### 1️⃣ GESTIÓN DE ARTÍCULOS

#### 1.1 Catálogo de Artículos

**Información de cada artículo:**
- ✅ **ID único** - Generado automáticamente (ej: 09843)
- ✅ **Código QR** - Generado automáticamente al crear
- ✅ **Nombre** - Nombre descriptivo del artículo
- ✅ **Descripción** - Detalles adicionales
- ✅ **Categoría** - Clasificación (Ferretería, Soldadura, Eléctrico, Pintura, etc.)
- ✅ **Unidad de medida** - Piezas, kg, metros, litros, cajas, etc.
- ✅ **Stock actual** - Cantidad disponible en tiempo real
- ✅ **Stock mínimo** - Nivel de alerta para reabastecimiento
- ✅ **Costo unitario** - Precio por unidad
- ✅ **Ubicación física** - Dónde está almacenado (ej: A-12, B-05)
- ✅ **Imagen/foto** - Foto del artículo (opcional)
- ✅ **Estado** - Activo/Inactivo
- ✅ **Fecha de creación** - Cuándo se agregó al sistema
- ✅ **Última modificación** - Última actualización

#### 1.2 Operaciones CRUD de Artículos

**Crear Nuevo Artículo:**
- Formulario con todos los campos
- Generación automática de ID
- Generación automática de código QR
- Vista previa de etiqueta
- Descarga de QR y etiqueta PDF
- Opción de imprimir directamente

**Consultar Artículos:**
- Vista de tabla completa (web)
- Vista de cards (móvil)
- Búsqueda en tiempo real por:
  - Nombre
  - ID
  - Categoría
  - Ubicación
- Filtros por:
  - Categoría
  - Stock bajo
  - Estado (activo/inactivo)
- Ordenamiento por:
  - Nombre (A-Z)
  - Stock (mayor/menor)
  - Última modificación

**Actualizar Artículo:**
- Editar todos los campos excepto ID
- Regenerar QR si es necesario
- Historial de cambios
- Registro de quién modificó

**Eliminar/Desactivar Artículo:**
- No se elimina físicamente
- Se marca como "inactivo"
- Mantiene historial
- Puede reactivarse

#### 1.3 Categorías

**Categorías predefinidas:**
- 🔧 Ferretería
- 🔥 Soldadura
- ⚡ Eléctrico
- 🎨 Pintura
- 🛠️ Herramientas
- 🧵 Textil
- 🏗️ Construcción
- 📦 Otros

**Gestión de categorías:**
- Crear nuevas categorías
- Editar existentes
- Asignar colores
- Asignar iconos
- Estadísticas por categoría

#### 1.4 Ubicaciones

**Sistema de ubicaciones:**
- Almacén principal
- Almacenes secundarios
- Pasillo (A, B, C, D, E)
- Estante (01-20)
- Nivel (1-5)

**Ejemplo:** A-12 = Pasillo A, Estante 12

**Funciones:**
- Crear nuevas ubicaciones
- Mapa visual de almacén (futuro)
- Búsqueda por ubicación
- Reubicación de artículos

---

### 2️⃣ CONTROL DE STOCK

#### 2.1 Stock en Tiempo Real

**Visualización:**
- Stock actual de cada artículo
- Indicador visual de nivel:
  - 🟢 Verde: Stock suficiente (>stock mínimo)
  - 🟡 Amarillo: Stock bajo (=stock mínimo)
  - 🔴 Rojo: Stock crítico (<stock mínimo)

**Alertas automáticas:**
- Notificación cuando stock llega a mínimo
- Email a responsables de compras
- Dashboard con artículos críticos

#### 2.2 Ajustes de Inventario

**Tipos de ajustes:**
- ➕ **Entrada** - Agregar stock (compras, devoluciones)
- ➖ **Salida** - Reducir stock (pérdidas, daños)
- 🔄 **Ajuste** - Corrección por inventario físico

**Información del ajuste:**
- Artículo afectado
- Cantidad ajustada
- Tipo de ajuste
- Razón/motivo
- Usuario que realiza
- Fecha y hora
- Observaciones

#### 2.3 Inventario Físico

**Proceso:**
- Generar lista de conteo
- Registrar conteo físico
- Comparar con sistema
- Generar ajustes automáticos
- Reporte de diferencias

---

### 3️⃣ MOVIMIENTOS DE INVENTARIO

#### 3.1 Retiros (Pedidos)

**Flujo completo de retiro:**

```
1. Empleado crea pedido
   ├─ Escanea QR o busca artículo
   ├─ Agrega al carrito
   ├─ Define cantidad
   └─ Puede agregar múltiples artículos

2. Supervisor revisa pedido (opcional)
   ├─ Aprueba o rechaza
   └─ Puede modificar cantidades

3. Almacén entrega material
   ├─ Confirma retiro
   └─ Actualiza stock automáticamente

4. Sistema genera ticket
   ├─ ID único del retiro
   ├─ Fecha y hora
   ├─ Responsable
   ├─ Supervisor que autorizó
   ├─ Lista de artículos y cantidades
   └─ PDF descargable
```

**Información del retiro:**
- ID de ticket único (formato: DDMMYY-HHMM-NN)
- Fecha y hora exacta
- Usuario que retira
- Supervisor que autoriza
- Proyecto/obra (si aplica)
- Lista de artículos con cantidades
- Observaciones
- Estado (pendiente, aprobado, completado, cancelado)

**Estados del retiro:**
- 📝 Pendiente - Creado pero no autorizado
- ✅ Aprobado - Autorizado por supervisor
- ✔️ Completado - Material entregado
- ❌ Cancelado - Retiro cancelado

#### 3.2 Devoluciones

**Proceso de devolución:**
- Empleado indica qué devuelve
- Escanea QR del artículo
- Especifica cantidad
- Estado del material (bueno/dañado)
- Sistema actualiza stock
- Genera ticket de devolución

**Información:**
- Referencia al retiro original
- Artículos devueltos
- Cantidades
- Estado de cada artículo
- Observaciones

#### 3.3 Transferencias

**Entre ubicaciones:**
- Origen y destino
- Artículos transferidos
- Cantidades
- Motivo
- Responsable
- Actualización automática

---

### 4️⃣ SCANNER QR

#### 4.1 Funcionalidad Principal

**Uso del scanner:**
- Abrir cámara desde la app
- Apuntar al código QR del artículo
- Sistema lee y decodifica QR
- Muestra información completa del artículo
- Opciones:
  - Agregar al pedido
  - Ver detalles
  - Ver historial
  - Ver ubicación

**Plataformas:**
- 📱 Móvil - Cámara nativa
- 💻 Web - Webcam o subir imagen
- 🖥️ Desktop - Webcam

#### 4.2 Generación de QR

**Automático al crear artículo:**
- ID único del artículo
- Formato: JSON con validación
- Nivel de corrección: Alto (H)
- Tamaño: 300x300px (impresión)
- Formato: PNG, SVG
- Descargable individualmente
- Descarga masiva en PDF

**Contenido del QR:**
```json
{
  "id": "09843",
  "type": "articulo",
  "timestamp": "2025-10-10T12:30:15Z",
  "checksum": "a3f2c1"
}
```

#### 4.3 Etiquetas Personalizadas

**Diseño de etiqueta:**
- Logo de 3G
- Código QR grande
- Nombre del artículo
- ID del artículo
- Ubicación
- Categoría (con color)
- Stock actual
- Fecha de generación

**Formatos:**
- PNG individual
- PDF individual
- PDF con múltiples etiquetas (30 por hoja)
- Listo para impresora térmica

---

### 5️⃣ HISTORIAL COMPLETO

#### 5.1 Registro de Movimientos

**Cada movimiento registra:**
- ID del movimiento
- Tipo (retiro, devolución, ajuste, transferencia)
- Fecha y hora exacta
- Artículo(s) involucrado(s)
- Cantidad
- Usuario responsable
- Supervisor (si aplica)
- Proyecto/obra
- Estado final
- Observaciones

#### 5.2 Consultas de Historial

**Filtros disponibles:**
- Por fecha (rango)
- Por artículo
- Por usuario
- Por tipo de movimiento
- Por proyecto
- Por estado

**Visualización:**
- Vista de tabla completa
- Vista de timeline
- Exportar a Excel/PDF
- Gráficas de tendencias

#### 5.3 Auditoría

**Trazabilidad completa:**
- Quién hizo qué y cuándo
- Valores antes y después
- IP y dispositivo usado
- Imposible modificar historial
- Logs permanentes

---

### 6️⃣ REPORTES Y ESTADÍSTICAS

#### 6.1 Reportes Básicos

**Reportes incluidos:**

**Reporte de Inventario Actual**
- Lista completa de artículos
- Stock actual de cada uno
- Valuación total
- Por categoría
- Por ubicación

**Reporte de Movimientos**
- Rango de fechas
- Por tipo de movimiento
- Por usuario
- Por proyecto
- Totales y subtotales

**Reporte de Stock Bajo**
- Artículos en nivel crítico
- Cantidad actual vs mínima
- Sugerencia de compra
- Prioridad de reabastecimiento

**Reporte de Rotación**
- Artículos más usados
- Artículos sin movimiento
- Frecuencia de uso
- Tendencias

**Reporte de Valuación**
- Valor total del inventario
- Por categoría
- Por ubicación
- Evolución en el tiempo

#### 6.2 Estadísticas

**Métricas principales:**
- Total de artículos
- Valor total del inventario
- Artículos en stock bajo
- Movimientos hoy/semana/mes
- Usuarios más activos
- Artículos más retirados

**Gráficas:**
- Movimientos por día (líneas)
- Distribución por categoría (dona)
- Stock vs Stock mínimo (barras)
- Valuación en el tiempo (área)

#### 6.3 Exportación

**Formatos disponibles:**
- 📊 Excel (.xlsx)
- 📄 PDF
- 📋 CSV
- 🖨️ Impresión directa

**Opciones:**
- Programar reportes automáticos
- Envío por email
- Almacenar en Google Drive

---

### 7️⃣ BÚSQUEDA Y FILTROS

#### 7.1 Búsqueda Inteligente

**Búsqueda por:**
- Nombre del artículo
- ID
- Código QR
- Categoría
- Ubicación
- Descripción

**Características:**
- Búsqueda en tiempo real
- Sugerencias automáticas
- Búsqueda difusa (permite errores de tipeo)
- Búsqueda por voz (móvil)

#### 7.2 Filtros Avanzados

**Filtrar por:**
- Categoría (múltiple)
- Ubicación
- Rango de stock
- Stock bajo/normal/alto
- Estado (activo/inactivo)
- Fecha de creación
- Última modificación

**Guardar filtros:**
- Filtros favoritos
- Aplicar rápidamente
- Compartir con equipo

---

### 8️⃣ INTERFACES

#### 8.1 Interfaz Móvil

**Pantallas móviles:**
1. **Inventario** - Lista de artículos disponibles
2. **Pedido** - Carrito de retiro actual
3. **Scanner** - Escanear códigos QR
4. **Historial** - Movimientos anteriores
5. **Perfil** - Configuración de usuario

**Características móviles:**
- Bottom navigation
- Gestos (swipe, long press)
- Modo offline
- Notificaciones push
- Cámara integrada
- GPS para ubicación

#### 8.2 Interfaz Web/Desktop

**Pantallas web:**
1. **Dashboard** - Vista general y KPIs
2. **Inventario** - Tabla completa de artículos
3. **Pedido Actual** - Gestión de retiros
4. **Historial** - Tabla de movimientos
5. **Reportes** - Generación de reportes
6. **Configuración** - Ajustes del sistema

**Características web:**
- Sidebar navigation
- Tablas con paginación
- Exportación de datos
- Impresión optimizada
- Multi-ventana
- Atajos de teclado

---

## 👥 ROLES Y PERMISOS

### Empleado

**Puede:**
- ✅ Ver inventario disponible
- ✅ Buscar artículos
- ✅ Escanear QR
- ✅ Crear pedidos/retiros
- ✅ Ver su propio historial
- ✅ Devolver materiales
- ❌ NO puede editar artículos
- ❌ NO puede hacer ajustes
- ❌ NO puede ver reportes completos

### Supervisor

**Puede hacer TODO lo de Empleado, más:**
- ✅ Aprobar/rechazar pedidos
- ✅ Ver historial completo
- ✅ Hacer ajustes de inventario
- ✅ Ver reportes completos
- ✅ Exportar datos
- ✅ Asignar materiales a proyectos
- ❌ NO puede crear artículos
- ❌ NO puede eliminar registros

### Administrador

**Puede hacer TODO, incluyendo:**
- ✅ Crear/editar/eliminar artículos
- ✅ Gestionar categorías
- ✅ Gestionar ubicaciones
- ✅ Generar códigos QR
- ✅ Configurar alertas
- ✅ Ver toda la auditoría
- ✅ Gestionar usuarios
- ✅ Exportar todo
- ✅ Acceso completo al sistema

---

## 📊 INDICADORES CLAVE (KPIs)

### KPIs del Módulo Inventario:

1. **Valor Total del Inventario** - $XXX,XXX MXN
2. **Total de Artículos** - XXX artículos
3. **Artículos en Stock Bajo** - XX artículos
4. **Movimientos Hoy** - XX retiros
5. **Tasa de Rotación** - X veces/mes
6. **Precisión de Inventario** - XX% (físico vs sistema)
7. **Tiempo Promedio de Retiro** - X minutos
8. **Artículos Más Retirados** - Top 10

---

## 🔄 FLUJOS DE TRABAJO

### Flujo 1: Retiro Simple

```
1. Empleado abre app móvil
2. Va a sección "Pedido"
3. Escanea QR del artículo
4. Sistema muestra info del artículo
5. Empleado ajusta cantidad (ej: 10 pzas)
6. Agrega al carrito
7. Repite para más artículos
8. Toca "Finalizar pedido"
9. Sistema genera ticket
10. Supervisor aprueba desde su dispositivo
11. Almacén entrega material
12. Stock se actualiza automáticamente
13. Ticket queda en historial
```

### Flujo 2: Nuevo Artículo con QR

```
1. Admin abre panel web
2. Clic en "Nuevo Artículo"
3. Llena formulario:
   - Nombre: "Tuerca 1/4"
   - Categoría: Ferretería
   - Stock: 500
   - Ubicación: A-12
   - etc.
4. Clic en "Guardar"
5. Sistema asigna ID: 09843
6. Sistema genera QR automáticamente
7. Muestra pantalla de éxito:
   - Info del artículo
   - QR generado
   - Vista previa de etiqueta
8. Admin descarga etiqueta PDF
9. Imprime etiqueta
10. Pega en producto físico
11. ¡Listo para usar!
```

### Flujo 3: Control de Stock Bajo

```
1. Sistema revisa stock cada hora
2. Detecta: "Soldadura 6013" = 45 pzas (mínimo: 50)
3. Genera alerta automática
4. Envía notificación a:
   - Supervisor (push)
   - Compras (email)
5. Aparece en dashboard con indicador rojo
6. Compras crea orden de compra
7. Cuando llega material:
   - Escanea QR
   - Indica cantidad recibida: 100 pzas
8. Sistema actualiza stock: 145 pzas
9. Alerta se cierra automáticamente
```

---

## 🔧 INTEGRACIONES

### Con otros módulos del ERP:

**→ Módulo 2 (Proyectos):**
- Asignar materiales a proyectos específicos
- Rastrear consumo por proyecto
- Costos de materiales por obra

**→ Módulo 4 (Compras):**
- Generar órdenes de compra automáticas
- Actualizar stock al recibir material
- Control de proveedores

**→ Módulo 5 (Notificaciones):**
- Alertas de stock bajo
- Aprobaciones pendientes
- Recordatorios de devolución

**→ Módulo 6 (Reportes):**
- Datos para analytics
- Dashboards ejecutivos
- Exportación de información

---

## 📱 TECNOLOGÍA

### Stack Técnico:

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- html5-qrcode (scanner)
- React Router
- Axios

**Backend:**
- Node.js + Express
- PostgreSQL
- Sequelize ORM
- JWT (autenticación)
- QRCode library
- PDFKit

**Infraestructura:**
- Mac Mini M4 (servidor local)
- Nginx (web server)
- PM2 (process manager)

---

## 💾 BASE DE DATOS

### Tablas Principales:

**articulos**
- id, codigo_qr, nombre, descripcion
- categoria_id, ubicacion_id
- stock_actual, stock_minimo, unidad
- costo_unitario, imagen, activo
- created_at, updated_at

**categorias**
- id, nombre, descripcion, color, icono

**ubicaciones**
- id, almacen, pasillo, estante, nivel

**movimientos**
- id, ticket_id, tipo, fecha_hora
- usuario_id, supervisor_id, proyecto_id
- estado, observaciones

**detalle_movimientos**
- id, movimiento_id, articulo_id
- cantidad, costo_unitario, observaciones

**auditoria**
- id, tabla, registro_id, usuario_id
- accion, valores_antes, valores_despues
- ip_address, fecha_hora

---

## 📦 ENTREGABLES

### Al finalizar el Módulo 1:

**Software:**
- ✅ Sistema web completo y funcional
- ✅ App móvil (PWA instalable)
- ✅ Scanner QR operativo
- ✅ Generador de QR automático
- ✅ Generador de etiquetas PDF
- ✅ Sistema de reportes básicos

**Documentación:**
- ✅ Manual de usuario
- ✅ Manual de administrador
- ✅ Guía de impresión de etiquetas
- ✅ FAQ

**Capacitación:**
- ✅ Capacitación para administradores
- ✅ Capacitación para supervisores
- ✅ Capacitación para empleados
- ✅ Videos tutoriales

**Materiales:**
- ✅ Etiquetas QR impresas para inventario actual
- ✅ Plantillas de etiquetas personalizadas

---

## ⏱️ TIMELINE

### Semana 1-2: Preparación
- Definir catálogo de artículos
- Categorizar inventario actual
- Configurar servidor

### Semana 3-4: Desarrollo Backend
- Base de datos
- APIs REST
- Autenticación
- Generador de QR

### Semana 5-6: Desarrollo Frontend
- Interfaces móvil y web
- Scanner QR
- Formularios
- Reportes básicos

### Semana 7: Pruebas
- Testing funcional
- Testing de usuario
- Ajustes

### Semana 8: Despliegue
- Instalación en servidor
- Carga de datos iniciales
- Generación de QRs
- Capacitación
- Go-live

---

## 💰 INVERSIÓN

**Total Módulo 1:** $300 USD

- Etiquetas adhesivas: $150-200
- Desarrollo: $0 (interno)
- Servidor: $0 (Mac Mini existente)
- Software: $0 (open source)

**Opcional:**
- Impresora térmica: $250 USD

---

## 🎯 OBJETIVOS Y MÉTRICAS DE ÉXITO

### Objetivos:

1. ✅ Reducir pérdidas de inventario en 80%
2. ✅ Reducir tiempo de retiro de material en 70%
3. ✅ Alcanzar 95% de precisión en inventario
4. ✅ Eliminar 100% del papeleo
5. ✅ 100% de trazabilidad de materiales

### Métricas de éxito después de 3 meses:

- Precisión inventario >95%
- Tiempo promedio de retiro <5 min
- Stock outs reducidos >60%
- Satisfacción usuarios >4.5/5
- Adopción del sistema >90%

---

## 🚀 PRÓXIMAS MEJORAS (Futuras)

### Funcionalidades adicionales:

- 📍 **Geolocalización** - Rastrear herramientas en campo
- 📷 **Reconocimiento de imagen** - Identificar artículos por foto
- 🤖 **Predicción de demanda** - IA para anticipar necesidades
- 🔔 **Alertas inteligentes** - Notificaciones personalizadas
- 📊 **Analytics avanzado** - Machine learning para insights
- 🗺️ **Mapa de almacén** - Visualización interactiva
- 📱 **App nativa** - iOS y Android nativo
- 🔗 **API pública** - Integración con otros sistemas

---

## 📞 SOPORTE

**Durante implementación:**
- Soporte técnico diario
- Resolución de dudas
- Ajustes según feedback

**Post-implementación:**
- Soporte por email
- Actualizaciones mensuales
- Mejoras continuas

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Servidor configurado
- [ ] Base de datos creada
- [ ] Backend desplegado
- [ ] Frontend desplegado
- [ ] Usuarios creados
- [ ] Categorías configuradas
- [ ] Ubicaciones definidas
- [ ] Inventario inicial cargado
- [ ] QRs generados
- [ ] Etiquetas impresas
- [ ] Etiquetas pegadas
- [ ] Capacitación completada
- [ ] Pruebas realizadas
- [ ] Sistema en producción
- [ ] Monitoreo activo

---

## 📋 RESUMEN EJECUTIVO

**El Módulo 1 - Inventario proporciona:**

✅ Control total del inventario en tiempo real  
✅ Trazabilidad completa de materiales  
✅ Reducción drástica de pérdidas  
✅ Eficiencia en retiros de material  
✅ Alertas automáticas de reabastecimiento  
✅ Reportes y estadísticas completas  
✅ Scanner QR para acceso instantáneo  
✅ Generación automática de códigos QR  
✅ Interfaces móvil y web  
✅ Sistema escalable y preparado para crecimiento  

**Base sólida para los siguientes módulos del ERP 3G.**