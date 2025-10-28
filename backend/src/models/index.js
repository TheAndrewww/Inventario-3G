import { sequelize } from '../config/database.js';
import Usuario from './Usuario.js';
import Categoria from './Categoria.js';
import Ubicacion from './Ubicacion.js';
import Articulo from './Articulo.js';
import Movimiento from './Movimiento.js';
import DetalleMovimiento from './DetalleMovimiento.js';

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

// Exportar todos los modelos
export {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Articulo,
    Movimiento,
    DetalleMovimiento
};

export default {
    sequelize,
    Usuario,
    Categoria,
    Ubicacion,
    Articulo,
    Movimiento,
    DetalleMovimiento
};
