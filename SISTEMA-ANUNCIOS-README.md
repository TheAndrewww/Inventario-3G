# 🎨 Sistema de Anuncios Automáticos con IA

Sistema integrado para generar y mostrar anuncios automáticamente desde el calendario de proyectos de 3G Velarias.

## 📋 Descripción

El sistema genera automáticamente anuncios publicitarios todos los días a las **7:00 AM** utilizando:
- ✅ Datos del calendario de Google Sheets
- ✅ Inteligencia Artificial (Gemini API)
- ✅ Almacenamiento en Cloudinary
- ✅ Visualización en pantallas públicas 24/7

---

## 🗂️ Estructura del Proyecto

```
backend/
├── src/
│   ├── services/
│   │   ├── geminiAnuncios.service.js      ← Generación con IA
│   │   └── cloudinaryAnuncios.service.js  ← Subida de imágenes
│   ├── controllers/
│   │   └── anuncios.controller.js         ← Lógica de negocio
│   ├── routes/
│   │   └── anuncios.routes.js             ← Endpoints API
│   └── jobs/
│       └── generarAnunciosDiarios.js      ← Cron job 7 AM
└── migrations/
    └── create-tabla-anuncios.sql          ← Migración SQL

frontend/
├── src/
│   ├── pages/
│   │   └── AnunciosPublicosPage.jsx       ← Pantalla pública
│   ├── components/
│   │   └── anuncios/
│   │       └── CarouselAnuncios.jsx       ← Componente carousel
│   └── services/
│       └── anuncios.service.js            ← Cliente API
```

---

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Agregar al archivo `.env` del backend:

```bash
# API de Gemini (Google AI)
GEMINI_API_KEY=tu_api_key_de_gemini

# Cloudinary (ya configurado)
CLOUDINARY_CLOUD_NAME=dd93jrilg
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Google Sheets (ya configurado)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

**Obtener API Key de Gemini:**
1. Ir a: https://ai.google.dev/
2. Click en "Get API Key"
3. Crear proyecto o usar existente
4. Generar API Key
5. Copiar y pegar en `.env`

### 2. Instalar Dependencias

```bash
cd backend
npm install
```

**Nueva dependencia agregada:**
- `@google/generative-ai`: Para generación de contenido con IA

### 3. Ejecutar Migración de Base de Datos

```bash
# Opción 1: Ejecutar el archivo SQL directamente
psql -U postgres -d inventario3g -f backend/migrations/create-tabla-anuncios.sql

# Opción 2: En producción (Railway)
# El sistema creará la tabla automáticamente en el primer deploy
```

---

## 🎯 Endpoints de API

### Endpoints Públicos (sin autenticación)

```http
GET /api/anuncios/publico/activos?dias=7
```
Obtener anuncios activos de los últimos N días

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fecha": "2026-01-07",
      "frase": "CASA JUÁREZ - INSTALACIÓN | EQUIPO I EN ACCIÓN",
      "imagen_url": "https://res.cloudinary.com/...",
      "proyecto_nombre": "Casa Juárez - Instalación",
      "equipo": "EQUIPO I",
      "vistas": 45
    }
  ],
  "total": 1
}
```

---

```http
GET /api/anuncios/publico/hoy
```
Obtener anuncios del día actual

---

```http
POST /api/anuncios/publico/:id/vista
```
Incrementar contador de vistas (analytics)

---

### Endpoints Privados (requieren autenticación)

```http
POST /api/anuncios/generar
Authorization: Bearer {token}
Content-Type: application/json

{
  "frase": "FELIZ AÑO NUEVO 2026",
  "fecha": "2026-01-01",
  "proyectoNombre": "Evento Especial",
  "equipo": "MANUFACTURA"
}
```
Generar anuncio manualmente

---

```http
POST /api/anuncios/generar-desde-calendario
Authorization: Bearer {token}
```
Generar anuncios automáticamente desde proyectos del día

---

```http
GET /api/anuncios/stats
Authorization: Bearer {token}
```
Obtener estadísticas de anuncios

---

## ⏰ Job Automático (Cron)

### Horario de Ejecución

- **Hora:** 7:00 AM (hora de México)
- **Frecuencia:** Diario
- **Zona horaria:** America/Mexico_City

### Funcionamiento

1. **7:00 AM:** Job se ejecuta automáticamente
2. **Consulta calendario:** Lee proyectos del día desde Google Sheets
3. **Genera frases:** Crea textos publicitarios desde proyectos
4. **IA (Gemini):** Genera descripciones/prompts para imágenes
5. **Almacena:** Guarda en PostgreSQL y Cloudinary
6. **Disponible:** Anuncios listos para visualización

### Logs del Job

```bash
🤖 ========================================
🤖 JOB AUTOMÁTICO: Generación de Anuncios
🤖 Hora: 07:00:00 AM
🤖 ========================================
📅 Generando anuncios para: 7 de ENERO (2026-01-07)
📊 Consultando calendario de proyectos...
✅ Proyectos encontrados: 3
🎨 Generando 3 anuncios...
   1/3: Casa Juárez
      ✅ Anuncio ID 1 creado
   2/3: Oficina González
      ✅ Anuncio ID 2 creado
   3/3: Almacén Industrial
      ✅ Anuncio ID 3 creado

🎉 Resumen:
   - Proyectos procesados: 3
   - Anuncios creados: 3
   - Fecha: 2026-01-07
✅ Job completado exitosamente
🤖 ========================================
```

---

## 🖥️ Uso en Pantallas

### URL Pública

```
https://inventario-3g.vercel.app/anuncios
```

### Características

- ✅ **Auto-fullscreen:** Se activa automáticamente
- ✅ **Auto-refresh:** Actualiza cada 5 minutos
- ✅ **Carousel:** Rota anuncios cada 8 segundos
- ✅ **Efectos:** Transiciones suaves y animaciones
- ✅ **24/7:** Diseñado para uso continuo
- ✅ **Responsive:** Adaptable a cualquier pantalla

### Configurar Pantalla

1. Abrir navegador en modo kiosko/fullscreen
2. Navegar a: `https://inventario-3g.vercel.app/anuncios`
3. La pantalla se pondrá en fullscreen automáticamente
4. Los anuncios rotarán automáticamente

**Modo Kiosko (Chromium):**
```bash
chromium-browser --kiosk --app=https://inventario-3g.vercel.app/anuncios
```

---

## 📊 Base de Datos

### Tabla: `anuncios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | SERIAL | ID único |
| fecha | DATE | Fecha del anuncio |
| frase | TEXT | Texto del anuncio |
| imagen_url | TEXT | URL en Cloudinary |
| proyecto_nombre | TEXT | Nombre del proyecto |
| equipo | VARCHAR(50) | Equipo asignado |
| tipo_anuncio | VARCHAR(50) | proyecto / generico / manual |
| activo | BOOLEAN | Si está activo |
| vistas | INTEGER | Contador de visualizaciones |
| created_at | TIMESTAMP | Fecha de creación |

### Vistas SQL

```sql
-- Ver anuncios activos de hoy
SELECT * FROM anuncios_activos_hoy;

-- Ver todos los anuncios del día
SELECT * FROM obtener_anuncios_dia_actual();
```

---

## 🧪 Testing Manual

### 1. Generar Anuncio de Prueba

```bash
curl -X POST http://localhost:5001/api/anuncios/generar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "frase": "PROYECTO DE PRUEBA - 3G VELARIAS",
    "proyectoNombre": "Prueba Sistema",
    "equipo": "EQUIPO I"
  }'
```

### 2. Generar desde Calendario

```bash
curl -X POST http://localhost:5001/api/anuncios/generar-desde-calendario \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Ver Anuncios Públicos

```bash
curl http://localhost:5001/api/anuncios/publico/hoy
```

### 4. Ver Estadísticas

```bash
curl http://localhost:5001/api/anuncios/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 Mantenimiento

### Limpiar Anuncios Antiguos

```sql
-- Desactivar anuncios de hace más de 30 días
UPDATE anuncios
SET activo = false
WHERE fecha < CURRENT_DATE - INTERVAL '30 days';
```

### Ver Logs del Cron Job

```bash
# En producción (Railway)
railway logs --filter="JOB AUTOMÁTICO"

# En desarrollo
# Los logs aparecen en la consola del servidor
```

### Forzar Generación Manual

```javascript
// En la consola del backend
import { generarAnunciosManual } from './src/jobs/generarAnunciosDiarios.js';
await generarAnunciosManual();
```

---

## 📈 Métricas y Analytics

### Contador de Vistas

Cada vez que se visualiza un anuncio en pantalla, se incrementa automáticamente el contador de vistas para analytics.

### Consultar Estadísticas

```sql
SELECT
  COUNT(*) as total_anuncios,
  SUM(vistas) as vistas_totales,
  AVG(vistas) as promedio_vistas,
  COUNT(DISTINCT fecha) as dias_activos
FROM anuncios
WHERE activo = true;
```

---

## 🚨 Solución de Problemas

### Problema: No se generan anuncios automáticamente

**Verificar:**
1. ✅ Cron job está iniciado en server.js
2. ✅ Zona horaria correcta en el cron
3. ✅ Hay proyectos en el calendario de Google Sheets

### Problema: Error de Gemini API

**Causa:** API Key no válida o no configurada

**Solución:**
1. Verificar variable `GEMINI_API_KEY` en `.env`
2. Verificar cuota de API en Google AI Studio
3. El sistema funciona sin Gemini (usa placeholders)

### Problema: Imágenes no se muestran

**Verificar:**
1. ✅ Cloudinary configurado correctamente
2. ✅ URLs de imágenes accesibles
3. ✅ CORS habilitado en Cloudinary

---

## 🔐 Seguridad

- ✅ Endpoints públicos sin datos sensibles
- ✅ Endpoints admin protegidos con JWT
- ✅ API Keys en variables de entorno
- ✅ Validación de inputs
- ✅ Rate limiting en producción

---

## 🎉 ¡Listo!

El sistema de anuncios está completamente integrado y listo para usar.

**URLs importantes:**
- Pantalla pública: `/anuncios`
- Calendario público: `/calendario-publico`
- API docs: `/api`

**Siguiente paso:** Configurar Gemini API Key y hacer primera prueba.
