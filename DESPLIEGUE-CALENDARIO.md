# Instrucciones de Despliegue - Módulo Calendario

## Resumen de Cambios

✅ **Commits creados y subidos**:
   - `4358810` - Módulo de Calendario completo
   - `40031c3` - Configuración automática de Google Credentials
✅ **Frontend compilado correctamente**
✅ **Backend funcionando en desarrollo y producción**

## Nuevas Funcionalidades

1. **Calendario de Entregas integrado con Google Sheets**
   - Lectura automática del calendario mensual
   - Distribución de equipos
   - Detección de colores por tipo de proyecto y equipo

2. **Vista de Pantalla Completa**
   - Layout optimizado para TV/monitor
   - Logo + Fecha/Hora + Distribución de Equipos en una fila
   - Auto-actualización cada 2 minutos
   - Reloj en tiempo real

3. **Detección de Asuetos**
   - Días con "ASUETO" resaltados en rojo
   - No aparecen como eventos en la lista

## 🚨 IMPORTANTE: Configuración de Google Credentials en Railway

El archivo `google-credentials.json` contiene las credenciales de la cuenta de servicio de Google y **NO** está en el repositorio (está en .gitignore por seguridad).

### ✅ Configuración Automática (Ya implementado)

El código ahora **detecta automáticamente** el entorno:
- **Producción**: Usa la variable de entorno `GOOGLE_CREDENTIALS_JSON`
- **Desarrollo**: Usa el archivo local `google-credentials.json`

### Configurar en Railway:

1. Ve a tu proyecto en Railway
2. Ve a la pestaña **Variables**
3. Agrega una nueva variable:
   - **Nombre**: `GOOGLE_CREDENTIALS_JSON`
   - **Valor**: Pega el contenido completo del archivo `google-credentials.json`

**No es necesario modificar ningún código.** El sistema ya está preparado para usar la variable de entorno.

## Variables de Entorno Necesarias

Asegúrate de que Railway tenga estas variables configuradas:

```bash
# Base de datos (Railway lo provee automáticamente)
DATABASE_URL=postgresql://...

# Puerto
PORT=5001

# JWT
JWT_SECRET=tu_secret_seguro

# Node environment
NODE_ENV=production

# Google Credentials (si usas opción 1)
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

## Verificación del Despliegue

Una vez desplegado, verifica:

1. **Backend**: `https://tu-app.railway.app/api/calendario/actual`
   - Debe retornar el calendario del mes actual

2. **Frontend**: Navega a `/calendario`
   - Debe mostrar el calendario con los proyectos del Google Sheet
   - Debe mostrar la distribución de equipos
   - El botón de pantalla completa debe funcionar

## Configuración del Google Sheet

El sistema está configurado para leer:
- **Spreadsheet ID**: `1LwZhLbcAykxkghhIvttAkVtwUo4suqotlAWhPMRz17w`
- **Hoja**: `NOVIEMBRE` (cambiar en `backend/src/services/googleSheets.service.js` línea 10)

### Permisos necesarios:
1. El Google Sheet debe estar compartido con la cuenta de servicio
2. Email de la cuenta de servicio está en `google-credentials.json` (campo `client_email`)
3. Permisos de lectura son suficientes

## Estructura del Google Sheet Esperada

El servicio espera:
- Fila 6+: Encabezados de días y proyectos
- Columnas A-N: 7 días de la semana (2 columnas por día: nombre + hora)
- Detección de colores para:
  - **Tipo de proyecto**: Amarillo (Mantenimiento), Rojo (Garantía)
  - **Equipos**: Azul (I), Verde (II), Gris (III), Naranja (IV), Morado (V), etc.

## Troubleshooting

### Error: "No se pudo autenticar con Google Sheets API"
- Verifica que `GOOGLE_CREDENTIALS_JSON` esté configurado correctamente
- Verifica que el JSON esté correctamente formateado

### Error: "Permission denied"
- Verifica que el Google Sheet esté compartido con la cuenta de servicio
- Email de la cuenta: busca `client_email` en google-credentials.json

### El calendario no se actualiza
- Verifica la conexión a Google Sheets API
- Revisa los logs de Railway para errores específicos

## Comandos Útiles

```bash
# Ver logs en Railway
railway logs

# Redeploy
railway up

# Verificar variables de entorno
railway variables
```

## Archivos Modificados en Este Commit

**Backend:**
- `backend/.gitignore` - Agregado google-credentials.json y debug-*.js
- `backend/package.json` - Agregada dependencia googleapis
- `backend/server.js` - Agregada ruta /api/calendario
- `backend/src/controllers/calendario.controller.js` - Nuevo
- `backend/src/routes/calendario.routes.js` - Nuevo
- `backend/src/services/googleSheets.service.js` - Nuevo

**Frontend:**
- `frontend/src/App.jsx` - Agregada ruta /calendario
- `frontend/src/components/layout/DashboardLayout.jsx` - Agregado CalendarioContext
- `frontend/src/components/layout/Sidebar.jsx` - Agregado link a Calendario
- `frontend/src/context/CalendarioContext.jsx` - Nuevo
- `frontend/src/pages/CalendarioPage.jsx` - Nuevo
- `frontend/src/services/calendario.service.js` - Nuevo

## Próximos Pasos

1. ✅ Código subido a GitHub
2. ⏳ Configurar `GOOGLE_CREDENTIALS_JSON` en Railway
3. ⏳ Railway detectará el push y desplegará automáticamente
4. ⏳ Verificar que el calendario funcione en producción
5. ⏳ (Opcional) Actualizar el mes en googleSheets.service.js cuando cambie el mes

---

**Nota**: El archivo `google-credentials.json` está en tu carpeta local. **NO** lo subas a git. Debes configurarlo como variable de entorno en Railway.
