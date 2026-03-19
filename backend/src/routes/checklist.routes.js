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
router.post('/importar', verificarRol('administrador'), importarItems);
router.get('/items', listarItems);
router.put('/items/:id', verificarRol('administrador'), editarItem);
router.delete('/items/:id', verificarRol('administrador'), eliminarItem);

// ─── Enlazar artículos del inventario ───
router.post('/items/:id/articulos', verificarRol('administrador'), enlazarArticulos);
router.get('/items/:id/sugerencias', sugerirArticulos);
router.get('/buscar-articulos', buscarArticulos);

// ─── Checklist por equipo ───
router.get('/equipo/:equipoId', obtenerChecklistEquipo);
router.post('/equipo/:equipoId/asignar', verificarRol('administrador'), asignarItemsAEquipo);
router.delete('/equipo/:equipoId/items/:itemId', verificarRol('administrador'), quitarItemDeEquipo);

export default router;
