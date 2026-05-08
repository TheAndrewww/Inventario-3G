import express from 'express';
import { deshacerConversionUnidades, listarSkusEnHerramientas } from '../controllers/limpiezaHerramientas.controller.js';
import { verificarToken, esAdministrador } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/deshacer-conversion-unidades', verificarToken, esAdministrador, deshacerConversionUnidades);
router.get('/skus-movidos-a-herramientas', verificarToken, esAdministrador, listarSkusEnHerramientas);

export default router;
