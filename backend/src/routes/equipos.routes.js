import express from 'express';
import {
    obtenerEquipos,
    obtenerEquipoPorId,
    crearEquipo,
    actualizarEquipo,
    eliminarEquipo,
    obtenerEquiposPorSupervisor
} from '../controllers/equipos.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/equipos - Obtener todos los equipos
router.get('/', obtenerEquipos);

// GET /api/equipos/supervisor/:supervisorId - Obtener equipos de un supervisor
router.get('/supervisor/:supervisorId', obtenerEquiposPorSupervisor);

// GET /api/equipos/:id - Obtener un equipo por ID
router.get('/:id', obtenerEquipoPorId);

// POST /api/equipos - Crear un nuevo equipo (solo admin y encargado)
router.post('/', verificarRol(['administrador', 'encargado']), crearEquipo);

// PUT /api/equipos/:id - Actualizar un equipo (solo admin y encargado)
router.put('/:id', verificarRol(['administrador', 'encargado']), actualizarEquipo);

// DELETE /api/equipos/:id - Eliminar (desactivar) un equipo (solo admin)
router.delete('/:id', verificarRol(['administrador']), eliminarEquipo);

export default router;
