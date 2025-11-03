import { sequelize } from '../config/database.js';
import Usuario from './Usuario.js';
import Categoria from './Categoria.js';
import Ubicacion from './Ubicacion.js';
import Proveedor from './Proveedor.js';
import Articulo from './Articulo.js';
import Movimiento from './Movimiento.js';
import DetalleMovimiento from './DetalleMovimiento.js';
import Equipo from './Equipo.js';
import OrdenCompra from './OrdenCompra.js';
import DetalleOrdenCompra from './DetalleOrdenCompra.js';
import SolicitudCompra from './SolicitudCompra.js';
import Notificacion from './Notificacion.js';

// Definir relaciones

// Artículo - Categoría (Muchos a Uno)
Articulo.belongsTo(Categoria, {
    foreignKey: 'categoria_id',
    as: 'categoria'
});
Categoria.hasMany(Articulo, {
    foreignKey: 'categoria_id',
    as: 'articulos'
});

// Artículo - Ubicación (Muchos a Uno)
Articulo.belongsTo(Ubicacion, {
    foreignKey: 'ubicacion_id',
    as: 'ubicacion'
});
Ubicacion.hasMany(Articulo, {
    foreignKey: 'ubicacion_id',
    as: 'articulos'
});

// Artículo - Proveedor (Muchos a Uno)
Articulo.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(Articulo, {
    foreignKey: 'proveedor_id',
    as: 'articulos'
});

// Movimiento - Usuario (Muchos a Uno) - Usuario que realiza
Movimiento.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
Usuario.hasMany(Movimiento, {
    foreignKey: 'usuario_id',
    as: 'movimientos'
});

// Movimiento - Usuario (Muchos a Uno) - Supervisor que autoriza
Movimiento.belongsTo(Usuario, {
    foreignKey: 'supervisor_id',
    as: 'supervisor'
});
Usuario.hasMany(Movimiento, {
    foreignKey: 'supervisor_id',
    as: 'movimientos_supervisados'
});

// Movimiento - Usuario (Muchos a Uno) - Usuario que aprobó
Movimiento.belongsTo(Usuario, {
    foreignKey: 'aprobado_por_id',
    as: 'aprobadoPor'
});
Usuario.hasMany(Movimiento, {
    foreignKey: 'aprobado_por_id',
    as: 'movimientos_aprobados'
});

// Movimiento - Usuario (Muchos a Uno) - Usuario que recibió
Movimiento.belongsTo(Usuario, {
    foreignKey: 'recibido_por_id',
    as: 'recibidoPor'
});
Usuario.hasMany(Movimiento, {
    foreignKey: 'recibido_por_id',
    as: 'movimientos_recibidos'
});

// DetalleMovimiento - Movimiento (Muchos a Uno)
DetalleMovimiento.belongsTo(Movimiento, {
    foreignKey: 'movimiento_id',
    as: 'movimiento'
});
Movimiento.hasMany(DetalleMovimiento, {
    foreignKey: 'movimiento_id',
    as: 'detalles'
});

// DetalleMovimiento - Artículo (Muchos a Uno)
DetalleMovimiento.belongsTo(Articulo, {
    foreignKey: 'articulo_id',
    as: 'articulo'
});
Articulo.hasMany(DetalleMovimiento, {
    foreignKey: 'articulo_id',
    as: 'movimientos'
});

// DetalleMovimiento - Usuario (Muchos a Uno) - Usuario que dispersó
DetalleMovimiento.belongsTo(Usuario, {
    foreignKey: 'dispersado_por_id',
    as: 'dispersadoPor'
});
Usuario.hasMany(DetalleMovimiento, {
    foreignKey: 'dispersado_por_id',
    as: 'detalles_dispersados'
});

// Equipo - Usuario (Muchos a Uno) - Supervisor del equipo
Equipo.belongsTo(Usuario, {
    foreignKey: 'supervisor_id',
    as: 'supervisor'
});
Usuario.hasMany(Equipo, {
    foreignKey: 'supervisor_id',
    as: 'equipos_supervisados'
});

// Movimiento - Equipo (Muchos a Uno) - Equipo al que se asigna el pedido
Movimiento.belongsTo(Equipo, {
    foreignKey: 'equipo_id',
    as: 'equipo'
});
Equipo.hasMany(Movimiento, {
    foreignKey: 'equipo_id',
    as: 'pedidos'
});

// Movimiento - Ubicacion (Muchos a Uno) - Ubicación destino del pedido
Movimiento.belongsTo(Ubicacion, {
    foreignKey: 'ubicacion_destino_id',
    as: 'ubicacionDestino'
});
Ubicacion.hasMany(Movimiento, {
    foreignKey: 'ubicacion_destino_id',
    as: 'pedidos_destino'
});

// OrdenCompra - Proveedor (Muchos a Uno)
OrdenCompra.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(OrdenCompra, {
    foreignKey: 'proveedor_id',
    as: 'ordenes_compra'
});

// OrdenCompra - Usuario (Muchos a Uno) - Usuario creador
OrdenCompra.belongsTo(Usuario, {
    foreignKey: 'usuario_creador_id',
    as: 'creador'
});
Usuario.hasMany(OrdenCompra, {
    foreignKey: 'usuario_creador_id',
    as: 'ordenes_compra_creadas'
});

// DetalleOrdenCompra - OrdenCompra (Muchos a Uno)
DetalleOrdenCompra.belongsTo(OrdenCompra, {
    foreignKey: 'orden_compra_id',
    as: 'ordenCompra'
});
OrdenCompra.hasMany(DetalleOrdenCompra, {
    foreignKey: 'orden_compra_id',
    as: 'detalles'
});

// DetalleOrdenCompra - Articulo (Muchos a Uno)
DetalleOrdenCompra.belongsTo(Articulo, {
    foreignKey: 'articulo_id',
    as: 'articulo'
});
Articulo.hasMany(DetalleOrdenCompra, {
    foreignKey: 'articulo_id',
    as: 'detalles_ordenes_compra'
});

// SolicitudCompra - Articulo (Muchos a Uno)
SolicitudCompra.belongsTo(Articulo, {
    foreignKey: 'articulo_id',
    as: 'articulo'
});
Articulo.hasMany(SolicitudCompra, {
    foreignKey: 'articulo_id',
    as: 'solicitudes_compra'
});

// SolicitudCompra - Movimiento (Muchos a Uno) - Pedido origen
SolicitudCompra.belongsTo(Movimiento, {
    foreignKey: 'pedido_origen_id',
    as: 'pedidoOrigen'
});
Movimiento.hasMany(SolicitudCompra, {
    foreignKey: 'pedido_origen_id',
    as: 'solicitudes_compra'
});

// SolicitudCompra - Usuario (Muchos a Uno) - Usuario solicitante
SolicitudCompra.belongsTo(Usuario, {
    foreignKey: 'usuario_solicitante_id',
    as: 'solicitante'
});
Usuario.hasMany(SolicitudCompra, {
    foreignKey: 'usuario_solicitante_id',
    as: 'solicitudes_compra'
});

// SolicitudCompra - OrdenCompra (Muchos a Uno)
SolicitudCompra.belongsTo(OrdenCompra, {
    foreignKey: 'orden_compra_id',
    as: 'ordenCompra'
});
OrdenCompra.hasMany(SolicitudCompra, {
    foreignKey: 'orden_compra_id',
    as: 'solicitudes_origen'
});

// Notificacion - Usuario (Muchos a Uno)
Notificacion.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
Usuario.hasMany(Notificacion, {
    foreignKey: 'usuario_id',
    as: 'notificaciones'
});

// Exportar todos los modelos
export {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Proveedor,
    Articulo,
    Movimiento,
    DetalleMovimiento,
    Equipo,
    OrdenCompra,
    DetalleOrdenCompra,
    SolicitudCompra,
    Notificacion
};

export default {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Proveedor,
    Articulo,
    Movimiento,
    DetalleMovimiento,
    Equipo,
    OrdenCompra,
    DetalleOrdenCompra,
    SolicitudCompra,
    Notificacion
};
