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
    },
    destino_tipo: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Destino de un movimiento rápido: camioneta | area'
    },
    destino_area: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Área destino cuando destino_tipo = area (manufactura, herreria, pintura)'
    },
    // A6 · PLA-05: al cerrar la obra, un ticket con material ya entregado o compras ya recibidas no se anula
    // (con CIERRE_OBRA_RESPETA_ENTREGADO): queda abierto y marcado «Por revisar · cierre de obra».
    // Las columnas se agregan al arrancar con ADD COLUMN IF NOT EXISTS (server.js).
    revision_requerida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Ticket abierto que quedó por revisar al cerrar su obra (no se anuló solo)'
    },
    revision_motivo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Por qué quedó por revisar, p. ej. «Obra cerrada el 12-nov: 3 artículos ya entregados, 1 compra recibida»'
    },
    revision_desde: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo quedó por revisar'
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

// A6 · PLA-05: al resolver el ticket (entregado, cancelado, rechazado…) la marca «Por revisar» se limpia.
// El motivo y la fecha se quedan como historia. Con la marca en false (lo normal) no hace nada.
const ESTADOS_TICKET_ABIERTO = ['pendiente', 'pendiente_aprobacion', 'aprobado', 'listo_para_entrega'];
Movimiento.addHook('beforeUpdate', (movimiento) => {
    if (movimiento.revision_requerida && movimiento.changed('estado') && !ESTADOS_TICKET_ABIERTO.includes(movimiento.estado)) {
        movimiento.revision_requerida = false;
    }
});

export default Movimiento;
