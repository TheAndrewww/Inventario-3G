import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Modelo: ProduccionProyecto
 * Descripción: Tracking de proyectos a través de las etapas de producción
 * Etapas: Diseño → Compras → Producción → Instalación
 */
const ProduccionProyecto = sequelize.define('ProduccionProyecto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },

    // ===== Datos del proyecto =====
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Nombre del proyecto'
    },
    cliente: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Nombre del cliente'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción o notas del proyecto'
    },

    // ===== Prioridad y fechas =====
    prioridad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        validate: {
            min: 1,
            max: 5
        },
        comment: 'Prioridad 1-5 (1 = más urgente)'
    },
    fecha_entrada: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha de entrada a producción'
    },
    fecha_limite: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha límite de entrega'
    },
    fecha_completado: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha en que se completó todo'
    },

    // ===== Etapa actual =====
    etapa_actual: {
        type: DataTypes.ENUM('pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'),
        defaultValue: 'pendiente',
        allowNull: false,
        comment: 'Etapa actual del proyecto en producción'
    },

    // ===== Tracking de etapas completadas =====
    diseno_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando se completó Diseño'
    },
    diseno_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Diseño como completado'
    },

    compras_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando se completó Compras'
    },
    compras_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Compras como completado'
    },

    produccion_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando se completó Producción'
    },
    produccion_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Producción como completado'
    },

    instalacion_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando se completó Instalación'
    },
    instalacion_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Instalación como completado'
    },

    // ===== Referencia externa =====
    spreadsheet_row_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Referencia a fila en Google Sheets para sincronización'
    },

    // ===== Observaciones por etapa =====
    observaciones_diseno: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observaciones_compras: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observaciones_produccion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observaciones_instalacion: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    // ===== Estado general =====
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Si el proyecto está activo (soft delete)'
    }
}, {
    tableName: 'produccion_proyectos',
    timestamps: true,
    underscored: true,
    indexes: [
        { name: 'idx_produccion_etapa', fields: ['etapa_actual'] },
        { name: 'idx_produccion_prioridad', fields: ['prioridad'] },
        { name: 'idx_produccion_activo', fields: ['activo'] },
        { name: 'idx_produccion_fecha_limite', fields: ['fecha_limite'] }
    ]
});

// ===== Métodos de instancia =====

/**
 * Avanza a la siguiente etapa
 * @param {number} usuarioId - ID del usuario que completa la etapa
 * @param {string} observaciones - Observaciones opcionales
 */
ProduccionProyecto.prototype.completarEtapaActual = async function (usuarioId, observaciones = null) {
    const ahora = new Date();
    const etapaActual = this.etapa_actual;

    const flujo = {
        'pendiente': { siguiente: 'diseno', campo: 'diseno_completado_en', campoPor: 'diseno_completado_por', obs: 'observaciones_diseno' },
        'diseno': { siguiente: 'compras', campo: 'compras_completado_en', campoPor: 'compras_completado_por', obs: 'observaciones_compras' },
        'compras': { siguiente: 'produccion', campo: 'produccion_completado_en', campoPor: 'produccion_completado_por', obs: 'observaciones_produccion' },
        'produccion': { siguiente: 'instalacion', campo: 'instalacion_completado_en', campoPor: 'instalacion_completado_por', obs: 'observaciones_instalacion' },
        'instalacion': { siguiente: 'completado', campo: null, campoPor: null, obs: null }
    };

    const config = flujo[etapaActual];
    if (!config) {
        throw new Error(`Etapa ${etapaActual} no puede avanzar`);
    }

    // Marcar la etapa actual como completada
    if (config.campo) {
        this[config.campo] = ahora;
        this[config.campoPor] = usuarioId;
    }
    if (config.obs && observaciones) {
        this[config.obs] = observaciones;
    }

    // Avanzar a siguiente etapa
    this.etapa_actual = config.siguiente;

    // Si se completó todo
    if (config.siguiente === 'completado') {
        this.fecha_completado = ahora;
    }

    await this.save();
    return this;
};

/**
 * Obtiene el porcentaje de avance (25% por etapa completada)
 */
ProduccionProyecto.prototype.getPorcentajeAvance = function () {
    const porcentajes = {
        'pendiente': 0,
        'diseno': 25,
        'compras': 50,
        'produccion': 75,
        'instalacion': 90,
        'completado': 100
    };
    return porcentajes[this.etapa_actual] || 0;
};

/**
 * Calcula días restantes hasta fecha límite
 */
ProduccionProyecto.prototype.getDiasRestantes = function () {
    if (!this.fecha_limite) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(this.fecha_limite);
    limite.setHours(0, 0, 0, 0);
    const diff = limite - hoy;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ===== Métodos estáticos =====

/**
 * Obtener proyectos por área/etapa
 */
ProduccionProyecto.obtenerPorEtapa = async function (etapa) {
    return await this.findAll({
        where: {
            etapa_actual: etapa,
            activo: true
        },
        order: [
            ['prioridad', 'ASC'],
            ['fecha_limite', 'ASC']
        ]
    });
};

/**
 * Obtener resumen para dashboard
 */
ProduccionProyecto.obtenerResumenDashboard = async function () {
    const { Op } = await import('sequelize');

    const proyectos = await this.findAll({
        where: { activo: true },
        order: [
            ['prioridad', 'ASC'],
            ['fecha_limite', 'ASC']
        ]
    });

    const resumen = {
        pendiente: [],
        diseno: [],
        compras: [],
        produccion: [],
        instalacion: [],
        completado: []
    };

    proyectos.forEach(p => {
        resumen[p.etapa_actual].push(p);
    });

    return {
        proyectos,
        resumen,
        estadisticas: {
            total: proyectos.length,
            pendiente: resumen.pendiente.length,
            diseno: resumen.diseno.length,
            compras: resumen.compras.length,
            produccion: resumen.produccion.length,
            instalacion: resumen.instalacion.length,
            completado: resumen.completado.length,
            enProceso: proyectos.length - resumen.pendiente.length - resumen.completado.length
        }
    };
};

export default ProduccionProyecto;
