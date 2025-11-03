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

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

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
