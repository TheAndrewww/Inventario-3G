import express from 'express';
import { listarPedidosEncargados, contarPedidosEncargados, responderPedidoEncargado } from '../controllers/pedidosEncargados.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

// Pedidos de los encargados a Almacén (23-oct-2026): solo Almacén y el administrador
const router = express.Router();
router.use(verificarToken, verificarRol('administrador', 'almacen'));
router.get('/', listarPedidosEncargados);
router.get('/contador', contarPedidosEncargados);
router.patch('/:id', responderPedidoEncargado);

export default router;
