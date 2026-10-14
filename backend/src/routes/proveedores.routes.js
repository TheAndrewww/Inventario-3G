import express from 'express';
import {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    actualizarProveedor,
    eliminarProveedor,
    obtenerArticulosProveedor
} from '../controllers/proveedores.controller.js';
import { verificarToken, accesoCompras, accesoInventario } from '../middleware/auth.middleware.js';
import { fichasParaPantalla, reporteSinRfc, guardarFicha } from '../services/proveedoresFicha.service.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// B3 paso 3 · PLA-20: ficha maestra, crédito de CTAS CRÉDITO y reporte sin RFC (antes de «/:id»; solo los usa Diseño 3G)
const enviar = (fn) => async (req, res) => {
    try {
        res.json({ success: true, data: await fn(req) });
    } catch (error) {
        console.error('Error en la ficha de proveedores:', error);
        res.status(500).json({ success: false, message: 'Error al leer la ficha de proveedores' });
    }
};
router.get('/fichas', accesoInventario, enviar(() => fichasParaPantalla()));
router.get('/reporte-sin-rfc', accesoCompras, enviar(() => reporteSinRfc()));
router.put('/:id/ficha', accesoCompras, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Proveedor inválido' });
        const { codigo, cuerpo } = await guardarFicha(id, req.body, req.usuario?.id ?? null);
        res.status(codigo).json(cuerpo);
    } catch (error) {
        console.error('Error al guardar la ficha del proveedor:', error);
        res.status(500).json({ success: false, message: 'Error al guardar la ficha del proveedor' });
    }
});

// Listar proveedores (almacen, compras, supervisor, admin) - Solo lectura para almacen
router.get('/', accesoInventario, listarProveedores);

// Obtener proveedor por ID (almacen, compras, supervisor, admin) - Solo lectura para almacen
router.get('/:id', accesoInventario, obtenerProveedor);

// Crear proveedor (solo compras, supervisor, admin)
router.post('/', accesoCompras, crearProveedor);

// Actualizar proveedor
router.put('/:id', accesoCompras, actualizarProveedor);

// Eliminar (desactivar) proveedor
router.delete('/:id', accesoCompras, eliminarProveedor);

// Obtener artículos de un proveedor
router.get('/:id/articulos', accesoCompras, obtenerArticulosProveedor);

export default router;
