# ✅ Checklist de Deploy a Producción

## 📋 Lista de Verificación Paso a Paso

Sigue esta lista en orden. Marca cada item cuando lo completes.

---

## FASE 1: PREPARACIÓN DEL CÓDIGO ⚙️

### [ ] 1.1 Revisar Cambios Locales
```bash
git status
```
**Verificar que aparezcan:**
- ✅ 9 archivos modificados
- ✅ 14 archivos nuevos sin rastrear

### [ ] 1.2 Agregar Todos los Archivos al Staging
```bash
git add .
```

### [ ] 1.3 Crear Commit
```bash
git commit -m "Feat: Sistema completo de herramientas de renta con migración a producción

- Implementado modal de detalle de unidades de herramientas
- Integración de unidades en página de inventario
- Sistema de etiquetas mixtas (artículos + unidades)
- Scripts de migración segura a producción
- Documentación completa de migración y deployment"
```

### [ ] 1.4 Push al Repositorio
```bash
git push origin main
```

### [ ] 1.5 Verificar Push Exitoso
- Ir a GitHub y verificar que el commit esté visible
- Verificar que todos los archivos nuevos estén en el repositorio

---

## FASE 2: DEPLOY AUTOMÁTICO 🚀

### [ ] 2.1 Verificar Deploy de Frontend (Vercel)
- Ir a https://vercel.com
- Buscar tu proyecto "inventario-3g-frontend" (o nombre similar)
- Verificar que el deployment se inicie automáticamente
- **Esperar a que termine** (2-3 minutos)
- Estado debe ser: ✅ Ready

### [ ] 2.2 Verificar Deploy de Backend (Railway)
- Ir a https://railway.app
- Buscar tu proyecto "inventario-3g-backend" (o nombre similar)
- Verificar que el deployment se inicie automáticamente
- **Esperar a que termine** (3-5 minutos)
- Estado debe ser: ✅ Active

### [ ] 2.3 Verificar Logs de Backend
En Railway:
- Click en "Deployments"
- Click en el último deployment
- Click en "View Logs"
- **Buscar errores** - no debería haber ninguno
- Debe aparecer: "✅ Conexión a base de datos establecida correctamente"

---

## FASE 3: MIGRACIÓN DE BASE DE DATOS 🗄️

### [ ] 3.1 Conectar a Railway Shell
```bash
railway login
railway link
railway shell
```

### [ ] 3.2 Verificar Estado ANTES de Migrar
```bash
node scripts/verificar-estado-db.js
```

**Salida esperada:**
```
❌ tipos_herramienta_renta
❌ unidades_herramienta_renta
❌ historial_asignaciones_herramienta
❌ Campo es_herramienta en articulos NO existe
```

### [ ] 3.3 **CRÍTICO: HACER BACKUP**
```bash
pg_dump -U postgres railway > backup_$(date +%Y%m%d_%H%M%S).sql
```

### [ ] 3.4 Verificar que el Backup se Creó
```bash
ls -lh backup_*.sql
```
- Debe mostrar un archivo con tamaño > 0 KB

### [ ] 3.5 **DESCARGAR BACKUP A TU COMPUTADORA**
En otra terminal (fuera de railway shell):
```bash
railway run pg_dump -U postgres railway > backup_produccion_$(date +%Y%m%d_%H%M%S).sql
```
- **Guardar este archivo en un lugar seguro** (Google Drive, Dropbox, etc.)

### [ ] 3.6 Ejecutar Migración
Dentro de railway shell:
```bash
node scripts/migrar-produccion.js
```

**Respuestas que darás:**
1. ¿Has hecho un BACKUP? → Escribir: `si`
2. ¿Confirmas ejecutar la migración? → Escribir: `CONFIRMAR`

### [ ] 3.7 Verificar Migración Exitosa
```bash
node scripts/verificar-estado-db.js
```

**Salida esperada:**
```
✅ tipos_herramienta_renta
✅ unidades_herramienta_renta
✅ historial_asignaciones_herramienta
✅ Campo es_herramienta en articulos existe
✅ Todas las tablas necesarias están presentes
```

### [ ] 3.8 Salir de Railway Shell
```bash
exit
```

---

## FASE 4: REINICIAR BACKEND 🔄

### [ ] 4.1 Reiniciar Servicio de Backend
En Railway dashboard:
- Click en tu servicio de backend
- Click en ⋮ (tres puntos)
- Click en "Restart"
- **Esperar 1-2 minutos**

### [ ] 4.2 Verificar Logs Después del Reinicio
- Click en "View Logs"
- Buscar: "✅ Conexión a base de datos establecida correctamente"
- **No deben aparecer errores de Sequelize** relacionados con tablas

---

## FASE 5: VERIFICACIÓN FUNCIONAL ✅

### [ ] 5.1 Acceder a la Aplicación en Producción
- Abrir URL de producción (Vercel)
- Login con usuario de prueba

### [ ] 5.2 Verificar Inventario
- Ir a "Inventario"
- ✅ La página debe cargar sin errores
- ✅ Los artículos deben aparecer
- ✅ No debe haber errores en consola del navegador

### [ ] 5.3 Verificar Herramientas de Renta
- Ir a "Herramientas de Renta"
- ✅ La página debe cargar sin errores
- ✅ Debe mostrar tabla vacía (o con datos si ya tenías)

### [ ] 5.4 Probar Crear Tipo de Herramienta (PRUEBA)
- Click en "Nueva Herramienta"
- Llenar formulario:
  - Nombre: "Prueba Deploy"
  - Prefijo: "PD"
  - Cantidad: 1
  - Categoría: Cualquiera
  - Ubicación: Cualquiera
- Click en "Guardar"
- ✅ Debe crearse exitosamente

### [ ] 5.5 Verificar que se Creó la Unidad
- Debe aparecer la herramienta "Prueba Deploy"
- Click en "Ver Unidades"
- ✅ Debe aparecer 1 unidad con código "PD-001"

### [ ] 5.6 Probar Código de Barras
- Click en la unidad "PD-001"
- ✅ Debe abrir modal con detalles
- ✅ Debe mostrar código de barras
- ✅ Botón "Descargar" debe funcionar
- ✅ Botón "Imprimir" debe abrir ventana de impresión

### [ ] 5.7 Probar Etiquetas Mixtas desde Inventario
- Ir a "Inventario"
- Buscar un artículo que sea herramienta de renta
- Click en el artículo
- ✅ Debe expandir mostrando las unidades
- Click en checkbox del artículo
- Click en "Generar Etiquetas"
- ✅ Debe aparecer modal con artículos Y herramientas
- ✅ Las herramientas deben ser expandibles
- ✅ Debe poder seleccionar unidades individuales
- Click en "Generar PDF"
- ✅ Debe descargar PDF con etiquetas

### [ ] 5.8 Eliminar Herramienta de Prueba (Opcional)
- Ir a "Herramientas de Renta"
- Buscar "Prueba Deploy"
- Click en ⋮ (tres puntos)
- Click en "Eliminar"
- Confirmar

---

## FASE 6: VERIFICACIÓN DE SEGURIDAD 🔒

### [ ] 6.1 Verificar Variables de Entorno
En Railway:
- Click en tu servicio de backend
- Click en "Variables"
- ✅ Verificar que existan:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `PORT`

### [ ] 6.2 Verificar CORS
- Abrir DevTools del navegador (F12)
- Ir a Network
- Hacer una petición (crear artículo, etc.)
- ✅ No debe aparecer error de CORS

### [ ] 6.3 Verificar Autenticación
- Logout
- ✅ Debe redirigir a login
- Login nuevamente
- ✅ Debe funcionar correctamente

---

## FASE 7: MONITOREO POST-DEPLOY 📊

### [ ] 7.1 Monitorear Logs (30 minutos)
- Dejar abiertos los logs de Railway
- Observar por 30 minutos
- ✅ No deben aparecer errores

### [ ] 7.2 Notificar a Usuarios (Opcional)
- Enviar mensaje a usuarios:
  > "Se ha actualizado el sistema de inventario con nuevas funcionalidades:
  > - Sistema de herramientas de renta con unidades individuales
  > - Códigos de barras para cada unidad
  > - Impresión de etiquetas mejorada
  >
  > Si encuentran algún problema, por favor reportarlo."

### [ ] 7.3 Crear Backup Post-Deploy
```bash
railway run pg_dump -U postgres railway > backup_post_deploy_$(date +%Y%m%d_%H%M%S).sql
```
- Guardar en lugar seguro

---

## 🆘 QUÉ HACER SI ALGO SALE MAL

### Si la migración falla:

1. **NO PÁNICO**
2. Revisar el error en los logs
3. Si es crítico:
   ```bash
   railway shell
   psql -U postgres railway < backup_YYYYMMDD_HHMMSS.sql
   exit
   ```
4. Reiniciar backend en Railway
5. Contactar soporte

### Si el frontend no carga:

1. Verificar logs en Vercel
2. Ir a Vercel → Tu proyecto → Deployments
3. Click en el deployment fallido
4. Revisar logs de build
5. Si es necesario, hacer rollback en Vercel

### Si el backend no carga:

1. Verificar logs en Railway
2. Verificar que DATABASE_URL esté configurado
3. Si es necesario, hacer rollback en Railway

---

## ✅ DEPLOY COMPLETADO

**Fecha de deploy:** _________________

**Hora de inicio:** _________________

**Hora de finalización:** _________________

**Deploy exitoso:** [ ] SÍ  [ ] NO

**Notas adicionales:**
_________________________________________________
_________________________________________________
_________________________________________________

---

**¡Felicidades! Sistema de herramientas de renta desplegado exitosamente en producción. 🎉**
