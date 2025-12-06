# Guía de Configuración PM2

Esta guía te permite ejecutar servicios en segundo plano en tu Mac Mini.

## 1. Instalar PM2 (solo una vez)

```bash
npm install -g pm2
```

## 2. Iniciar los servicios

```bash
cd /Users/andrewww/Documents/Inventario-3G
pm2 start ecosystem.config.cjs
```

## 3. Configurar inicio automático al encender la Mac

```bash
pm2 startup
# Esto mostrará un comando. Cópialo y ejecútalo.
# Ejemplo: sudo env PATH=$PATH:/usr/local/bin pm2 startup launchd -u andrewww --hp /Users/andrewww

# Después, guarda la configuración actual:
pm2 save
```

## 4. Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `pm2 status` | Ver estado de todos los servicios |
| `pm2 logs` | Ver logs en tiempo real |
| `pm2 logs print-agent` | Ver logs de un servicio específico |
| `pm2 restart all` | Reiniciar todos los servicios |
| `pm2 stop all` | Detener todos los servicios |
| `pm2 monit` | Monitor interactivo |

## 5. Agregar nuevos servicios

Edita el archivo `ecosystem.config.cjs` y descomenta o agrega nuevos servicios siguiendo el formato existente.

## 6. Estructura de logs

Los logs se guardan en:
- `logs/print-agent-out.log` - Salida normal
- `logs/print-agent-error.log` - Errores

## 7. Verificar que todo funciona

```bash
pm2 status
```

Deberías ver algo como:
```
┌─────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ print-agent    │ default     │ 1.0.0   │ fork    │ 12345    │ 5m     │ 0    │ online    │ 0%       │ 40.0mb   │ andrewww │ disabled │
└─────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```
