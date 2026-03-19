import { Router } from 'express';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import {
    importarItems,
    listarItems,
    editarItem,
    eliminarItem,
    enlazarArticulos,
    sugerirArticulos,
    buscarArticulos,
    obtenerChecklistEquipo,
    asignarItemsAEquipo,
    quitarItemDeEquipo
} from '../controllers/checklist.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// ─── Ítems de checklist (catálogo global) ───
router.post('/importar', verificarRol('admin'), importarItems);
router.get('/items', listarItems);
router.put('/items/:id', verificarRol('admin'), editarItem);
router.delete('/items/:id', verificarRol('admin'), eliminarItem);

// ─── Enlazar artículos del inventario ───
router.post('/items/:id/articulos', verificarRol('admin'), enlazarArticulos);
router.get('/items/:id/sugerencias', sugerirArticulos);
router.get('/buscar-articulos', buscarArticulos);

// ─── Checklist por equipo ───
router.get('/equipo/:equipoId', obtenerChecklistEquipo);
router.post('/equipo/:equipoId/asignar', verificarRol('admin'), asignarItemsAEquipo);
router.delete('/equipo/:equipoId/items/:itemId', verificarRol('admin'), quitarItemDeEquipo);

export default router;
