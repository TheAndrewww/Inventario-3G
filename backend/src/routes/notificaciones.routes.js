import express from 'express';
import {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  registerFCMToken,
  unregisterFCMToken
} from '../controllers/notificaciones.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Rutas de notificaciones
router.get('/notificaciones', obtenerNotificaciones);
router.get('/notificaciones/count', contarNoLeidas);
router.put('/notificaciones/:id/leer', marcarComoLeida);
router.put('/notificaciones/leer-todas', marcarTodasComoLeidas);
router.delete('/notificaciones/:id', eliminarNotificacion);

// Rutas de FCM (Firebase Cloud Messaging)
router.post('/notificaciones/register-device', registerFCMToken);
router.post('/notificaciones/unregister-device', unregisterFCMToken);

export default router;
