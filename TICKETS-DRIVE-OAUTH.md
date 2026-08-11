# Subida de tickets a Drive (Orden de Salida)

## El problema

Al crear un ticket en Orden de Salida, la subida del PDF a la carpeta del
proyecto fallaba siempre con:

```
403 storageQuotaExceeded
"Service Accounts do not have storage quota"
```

La carpeta `PRODUCCION` está en **Mi unidad** de `vircjr.3g@gmail.com`.
Las cuentas de servicio de Google **no tienen cuota de almacenamiento**: pueden
leer la carpeta (por eso la sincronización de PDFs de manufactura/herrería sí
funciona) pero **nunca** pueden crear un archivo ahí.

Las dos salidas que da Google son Unidad compartida u OAuth de usuario. Como la
cuenta es Gmail personal, **no puede crear Unidades compartidas** → se usa OAuth.

## La solución

Las **lecturas** siguen usando la cuenta de servicio (`google-credentials.json`).
La **subida del ticket** usa OAuth de la cuenta dueña de la carpeta, así el
archivo consume la cuota de esa cuenta.

Archivos involucrados:
- `backend/src/services/googleDrive.service.js` → `authenticateEscritura()` y `uploadTicket()`
- `backend/scripts/autorizar-drive.mjs` → genera el refresh token (una sola vez)

## Configuración (una sola vez)

1. **Google Cloud Console**, proyecto `calendario-3g`:
   - *Pantalla de consentimiento OAuth*: tipo **Externo**, agregar
     `vircjr.3g@gmail.com` y **PUBLICAR la app** ("En producción").
     ⚠️ Si se queda en "Prueba", el permiso **caduca cada 7 días**.
   - *Credenciales → Crear credenciales → ID de cliente OAuth →
     Aplicación de escritorio*. Copiar **Client ID** y **Client Secret**.

2. En la Mac:
   ```bash
   cd backend
   node scripts/autorizar-drive.mjs
   ```
   Pega Client ID y Secret, abre el link e inicia sesión **con
   `vircjr.3g@gmail.com`** (la dueña de la carpeta). Si sale "Google no ha
   verificado esta app" → *Configuración avanzada → Ir a ...*.

   Guarda `backend/google-oauth-token.json` (ya está en `.gitignore`).

3. En **Railway** (producción), agregar las variables que imprime el script:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REFRESH_TOKEN=...
   ```
   y redesplegar.

## Si vuelve a fallar

| Mensaje en pantalla | Qué pasó |
|---|---|
| "el permiso de Google Drive caducó" | `invalid_grant`: repetir el paso 2 y actualizar `GOOGLE_OAUTH_REFRESH_TOKEN`. Si pasa cada semana, la app OAuth quedó en "Prueba" (paso 1). |
| "Drive no está autorizado con la cuenta dueña..." | Faltan las variables `GOOGLE_OAUTH_*` en Railway. |
| "Carpeta del proyecto ... no encontrada en Drive" | Ese proyecto todavía no tiene carpeta en `PRODUCCION/<MES>/`. |

Nota: si el ticket ya existe en la carpeta, se **reemplaza** el archivo en lugar
de duplicarlo.
