import { sequelize } from '../config/database.js';
import Usuario from './Usuario.js';
import Categoria from './Categoria.js';
import Ubicacion from './Ubicacion.js';
import Proveedor from './Proveedor.js';
import Articulo from './Articulo.js';
import ArticuloProveedor from './ArticuloProveedor.js';
import Movimiento from './Movimiento.js';
import DetalleMovimiento from './DetalleMovimiento.js';
import Equipo from './Equipo.js';
import Camioneta from './Camioneta.js';
import StockMinimoCamioneta from './StockMinimoCamioneta.js';
import OrdenCompra from './OrdenCompra.js';
import DetalleOrdenCompra from './DetalleOrdenCompra.js';
import SolicitudCompra from './SolicitudCompra.js';
import Notificacion from './Notificacion.js';
import FCMToken from './FCMToken.js';
import Proyecto from './Proyecto.js';
import TipoHerramientaRenta from './TipoHerramientaRenta.js';
import UnidadHerramientaRenta from './UnidadHerramientaRenta.js';
import HistorialAsignacionHerramienta from './HistorialAsignacionHerramienta.js';

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

// Artículo - Proveedor (Muchos a Uno) - Legacy, se mantiene por compatibilidad
Articulo.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(Articulo, {
    foreignKey: 'proveedor_id',
    as: 'articulos'
});

// Artículo - Proveedor (Muchos a Muchos a través de ArticuloProveedor)
Articulo.belongsToMany(Proveedor, {
    through: ArticuloProveedor,
    foreignKey: 'articulo_id',
    otherKey: 'proveedor_id',
    as: 'proveedores'
});
Proveedor.belongsToMany(Articulo, {
    through: ArticuloProveedor,
    foreignKey: 'proveedor_id',
    otherKey: 'articulo_id',
    as: 'articulosProveedor'
});

// ArticuloProveedor - Articulo (Muchos a Uno)
ArticuloProveedor.belongsTo(Articulo, {
    foreignKey: 'articulo_id',
    as: 'articulo'
});
Articulo.hasMany(ArticuloProveedor, {
    foreignKey: 'articulo_id',
    as: 'articuloProveedores'
});

// ArticuloProveedor - Proveedor (Muchos a Uno)
ArticuloProveedor.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(ArticuloProveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedorArticulos'
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

// Movimiento - Camioneta (Muchos a Uno) - Camioneta asociada al pedido
Movimiento.belongsTo(Camioneta, {
    foreignKey: 'camioneta_id',
    as: 'camioneta'
});
Camioneta.hasMany(Movimiento, {
    foreignKey: 'camioneta_id',
    as: 'pedidos'
});

// ========== RELACIONES CAMIONETAS ==========

// Camioneta - Usuario (Muchos a Uno) - Encargado de la camioneta
Camioneta.belongsTo(Usuario, {
    foreignKey: 'encargado_id',
    as: 'encargado'
});
Usuario.hasMany(Camioneta, {
    foreignKey: 'encargado_id',
    as: 'camionetas_a_cargo'
});

// Camioneta - Ubicacion (Muchos a Uno) - Almacén base de la camioneta
Camioneta.belongsTo(Ubicacion, {
    foreignKey: 'almacen_base_id',
    as: 'almacenBase'
});
Ubicacion.hasMany(Camioneta, {
    foreignKey: 'almacen_base_id',
    as: 'camionetas'
});

// StockMinimoCamioneta - Camioneta (Muchos a Uno)
StockMinimoCamioneta.belongsTo(Camioneta, {
    foreignKey: 'camioneta_id',
    as: 'camioneta'
});
Camioneta.hasMany(StockMinimoCamioneta, {
    foreignKey: 'camioneta_id',
    as: 'stocksMinimos'
});

// StockMinimoCamioneta - TipoHerramientaRenta (Muchos a Uno)
StockMinimoCamioneta.belongsTo(TipoHerramientaRenta, {
    foreignKey: 'tipo_herramienta_id',
    as: 'tipoHerramienta'
});
TipoHerramientaRenta.hasMany(StockMinimoCamioneta, {
    foreignKey: 'tipo_herramienta_id',
    as: 'stocksMinimos'
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

// SolicitudCompra - Proveedor (Muchos a Uno) - Proveedor sugerido
SolicitudCompra.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(SolicitudCompra, {
    foreignKey: 'proveedor_id',
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

// Movimiento - OrdenCompra (Muchos a Uno) - Movimientos de recepción de mercancía
Movimiento.belongsTo(OrdenCompra, {
    foreignKey: 'orden_compra_id',
    as: 'ordenCompra'
});
OrdenCompra.hasMany(Movimiento, {
    foreignKey: 'orden_compra_id',
    as: 'recepciones'
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

// FCMToken - Usuario (Muchos a Uno)
FCMToken.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
Usuario.hasMany(FCMToken, {
    foreignKey: 'usuario_id',
    as: 'fcmTokens'
});

// Proyecto - Usuario (Muchos a Uno) - Supervisor del proyecto
Proyecto.belongsTo(Usuario, {
    foreignKey: 'supervisor_id',
    as: 'supervisor'
});
Usuario.hasMany(Proyecto, {
    foreignKey: 'supervisor_id',
    as: 'proyectos_supervisados'
});

// Movimiento - Proyecto (Muchos a Uno) - Proyecto al que pertenece el movimiento
Movimiento.belongsTo(Proyecto, {
    foreignKey: 'proyecto_id',
    as: 'proyectoInfo'
});
Proyecto.hasMany(Movimiento, {
    foreignKey: 'proyecto_id',
    as: 'movimientos'
});

// ========== RELACIONES HERRAMIENTAS DE RENTA ==========

// TipoHerramientaRenta - Categoria (Muchos a Uno)
TipoHerramientaRenta.belongsTo(Categoria, {
    foreignKey: 'categoria_id',
    as: 'categoria'
});
Categoria.hasMany(TipoHerramientaRenta, {
    foreignKey: 'categoria_id',
    as: 'tipos_herramienta_renta'
});

// TipoHerramientaRenta - Ubicacion (Muchos a Uno)
TipoHerramientaRenta.belongsTo(Ubicacion, {
    foreignKey: 'ubicacion_id',
    as: 'ubicacion'
});
Ubicacion.hasMany(TipoHerramientaRenta, {
    foreignKey: 'ubicacion_id',
    as: 'tipos_herramienta_renta'
});

// TipoHerramientaRenta - Proveedor (Muchos a Uno)
TipoHerramientaRenta.belongsTo(Proveedor, {
    foreignKey: 'proveedor_id',
    as: 'proveedor'
});
Proveedor.hasMany(TipoHerramientaRenta, {
    foreignKey: 'proveedor_id',
    as: 'tipos_herramienta_renta'
});

// TipoHerramientaRenta - Articulo (Muchos a Uno) - Artículo origen si fue migrado
TipoHerramientaRenta.belongsTo(Articulo, {
    foreignKey: 'articulo_origen_id',
    as: 'articuloOrigen'
});
Articulo.hasOne(TipoHerramientaRenta, {
    foreignKey: 'articulo_origen_id',
    as: 'tipo_herramienta_migrado'
});

// UnidadHerramientaRenta - TipoHerramientaRenta (Muchos a Uno)
UnidadHerramientaRenta.belongsTo(TipoHerramientaRenta, {
    foreignKey: 'tipo_herramienta_id',
    as: 'tipoHerramienta'
});
TipoHerramientaRenta.hasMany(UnidadHerramientaRenta, {
    foreignKey: 'tipo_herramienta_id',
    as: 'unidades'
});

// UnidadHerramientaRenta - Usuario (Muchos a Uno) - Usuario asignado
UnidadHerramientaRenta.belongsTo(Usuario, {
    foreignKey: 'usuario_asignado_id',
    as: 'usuarioAsignado'
});
Usuario.hasMany(UnidadHerramientaRenta, {
    foreignKey: 'usuario_asignado_id',
    as: 'herramientas_asignadas'
});

// UnidadHerramientaRenta - Equipo (Muchos a Uno) - Equipo asignado
UnidadHerramientaRenta.belongsTo(Equipo, {
    foreignKey: 'equipo_asignado_id',
    as: 'equipoAsignado'
});
Equipo.hasMany(UnidadHerramientaRenta, {
    foreignKey: 'equipo_asignado_id',
    as: 'herramientas_asignadas'
});

// UnidadHerramientaRenta - Camioneta (Muchos a Uno) - Camioneta donde está ubicada
UnidadHerramientaRenta.belongsTo(Camioneta, {
    foreignKey: 'camioneta_id',
    as: 'camioneta'
});
Camioneta.hasMany(UnidadHerramientaRenta, {
    foreignKey: 'camioneta_id',
    as: 'herramientas'
});

// UnidadHerramientaRenta - Usuario (Muchos a Uno) - Empleado propietario (herramientas personales)
UnidadHerramientaRenta.belongsTo(Usuario, {
    foreignKey: 'empleado_propietario_id',
    as: 'empleadoPropietario'
});
Usuario.hasMany(UnidadHerramientaRenta, {
    foreignKey: 'empleado_propietario_id',
    as: 'herramientas_personales'
});

// HistorialAsignacionHerramienta - UnidadHerramientaRenta (Muchos a Uno)
HistorialAsignacionHerramienta.belongsTo(UnidadHerramientaRenta, {
    foreignKey: 'unidad_herramienta_id',
    as: 'unidadHerramienta'
});
UnidadHerramientaRenta.hasMany(HistorialAsignacionHerramienta, {
    foreignKey: 'unidad_herramienta_id',
    as: 'historial'
});

// HistorialAsignacionHerramienta - Usuario (Muchos a Uno) - Usuario asignado
HistorialAsignacionHerramienta.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
Usuario.hasMany(HistorialAsignacionHerramienta, {
    foreignKey: 'usuario_id',
    as: 'historial_asignaciones_herramienta'
});

// HistorialAsignacionHerramienta - Equipo (Muchos a Uno) - Equipo asignado
HistorialAsignacionHerramienta.belongsTo(Equipo, {
    foreignKey: 'equipo_id',
    as: 'equipo'
});
Equipo.hasMany(HistorialAsignacionHerramienta, {
    foreignKey: 'equipo_id',
    as: 'historial_asignaciones_herramienta'
});

// HistorialAsignacionHerramienta - Usuario (Muchos a Uno) - Usuario que registró
HistorialAsignacionHerramienta.belongsTo(Usuario, {
    foreignKey: 'registrado_por_usuario_id',
    as: 'registradoPor'
});
Usuario.hasMany(HistorialAsignacionHerramienta, {
    foreignKey: 'registrado_por_usuario_id',
    as: 'historial_asignaciones_registradas'
});

// Exportar todos los modelos
export {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Proveedor,
    Articulo,
    ArticuloProveedor,
    Movimiento,
    DetalleMovimiento,
    Equipo,
    OrdenCompra,
    DetalleOrdenCompra,
    SolicitudCompra,
    Notificacion,
    FCMToken,
    Proyecto,
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    HistorialAsignacionHerramienta,
    Camioneta,
    StockMinimoCamioneta
};

export default {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Proveedor,
    Articulo,
    ArticuloProveedor,
    Movimiento,
    DetalleMovimiento,
    Equipo,
    Camioneta,
    StockMinimoCamioneta,
    OrdenCompra,
    DetalleOrdenCompra,
    SolicitudCompra,
    Notificacion,
    FCMToken,
    Proyecto,
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    HistorialAsignacionHerramienta
};
