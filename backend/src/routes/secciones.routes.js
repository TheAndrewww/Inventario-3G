import express from 'express';
import { getSecciones, crearSeccion, actualizarSeccion, eliminarSeccion } from '../controllers/secciones.controller.js';
import { verificarToken, accesoInventario } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', verificarToken, getSecciones);
router.post('/', verificarToken, accesoInventario, crearSeccion);
router.put('/:id', verificarToken, accesoInventario, actualizarSeccion);
router.delete('/:id', verificarToken, accesoInventario, eliminarSeccion);

export default router;
