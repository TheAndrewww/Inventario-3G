import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Movimiento = sequelize.define('Movimiento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'ID único del ticket (formato: DDMMYY-HHMM-NN)'
    },
    tipo: {
        type: DataTypes.ENUM('retiro', 'devolucion', 'ajuste_entrada', 'ajuste_salida', 'transferencia', 'pedido', 'entrada_orden_compra'),
        allowNull: false,
        comment: 'Tipo de movimiento. pedido = solicitud de materiales por diseñador, entrada_orden_compra = recepción de mercancía desde orden de compra'
    },
    fecha_hora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Usuario que realiza el movimiento'
    },
    supervisor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Supervisor que autoriza (opcional)'
    },
    proyecto: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'DEPRECATED: Nombre del proyecto (usar proyecto_id). Mantener para compatibilidad temporal'
    },
    proyecto_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proyectos',
            key: 'id'
        },
        comment: 'Referencia al proyecto normalizado'
    },
    tipo_pedido: {
        type: DataTypes.ENUM('proyecto', 'equipo'),
        allowNull: true,
        comment: 'Tipo de pedido: proyecto (diseñador) o equipo (almacenista)'
    },
    equipo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'equipos',
            key: 'id'
        },
        comment: 'ID del equipo para pedidos de tipo equipo'
    },
    camioneta_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'camionetas',
            key: 'id'
        },
        comment: 'ID de la camioneta para pedidos de tipo equipo (opcional)'
    },
    ubicacion_destino_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ubicaciones',
            key: 'id'
        },
        comment: 'ID de la ubicación destino para pedidos (ej: camionetas, almacenes específicos)'
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'listo_para_entrega', 'entregado', 'completado', 'cancelado'),
        defaultValue: 'completado',
        allowNull: false,
        comment: 'pendiente = dispersión en proceso, pendiente_aprobacion = requiere aprobación supervisor, aprobado = aprobado para dispersar, listo_para_entrega = 100% dispersado esperando recepción, entregado = recibido y validado por supervisor'
    },
    aprobado_por_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Usuario (supervisor) que aprobó el pedido'
    },
    fecha_aprobacion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora de aprobación del pedido'
    },
    motivo_rechazo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo si el pedido fue rechazado'
    },
    recibido_por_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Supervisor que recibió y validó el pedido'
    },
    fecha_recepcion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora de recepción del pedido por el supervisor'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    total_piezas: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Total de piezas en el movimiento'
    },
    orden_compra_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ordenes_compra',
            key: 'id'
        },
        comment: 'ID de la orden de compra asociada (para entradas desde órdenes de compra)'
    }
}, {
    tableName: 'movimientos',
    timestamps: true,
    indexes: [
        {
            fields: ['ticket_id']
        },
        {
            fields: ['tipo']
        },
        {
            fields: ['usuario_id']
        },
        {
            fields: ['fecha_hora']
        },
        {
            fields: ['estado']
        }
    ]
});

export default Movimiento;
