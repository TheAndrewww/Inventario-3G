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

    // ===== Sub-etapas de Producción (Paralelas) =====
    // Manufactura y Herrería trabajan en paralelo
    // Solo cuando ambas están completadas, el proyecto puede avanzar a Instalación

    manufactura_completado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si Manufactura completó su parte'
    },
    manufactura_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando Manufactura completó'
    },
    manufactura_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Manufactura como completado'
    },

    herreria_completado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si Herrería completó su parte'
    },
    herreria_completado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando Herrería completó'
    },
    herreria_completado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        comment: 'Usuario que marcó Herrería como completado'
    },

    // ===== Integración con Google Drive =====
    drive_folder_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'ID de la carpeta del proyecto en Google Drive'
    },
    tiene_manufactura: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si se encontraron PDFs de Manufactura en Drive'
    },
    tiene_herreria: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si se encontraron PDFs de Herrería en Drive'
    },
    archivos_manufactura: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array de archivos PDF de Manufactura [{id, nombre, link}]'
    },
    archivos_herreria: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array de archivos PDF de Herrería [{id, nombre, link}]'
    },
    drive_sync_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última sincronización con Google Drive'
    },

    // ===== Tipo de proyecto (para color de cards) =====
    tipo_proyecto: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Tipo de proyecto: MTO, GTIA, A, B, C, etc. Para determinar color de card'
    },

    // ===== Flag para MTO extensivo =====
    es_extensivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si el proyecto MTO es EXTENSIVO (columna J del spreadsheet)'
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
 * Completar una sub-etapa de Producción (Manufactura o Herrería)
 * @param {string} subEtapa - 'manufactura' o 'herreria'
 * @param {number} usuarioId - ID del usuario que completa
 */
ProduccionProyecto.prototype.completarSubEtapaProduccion = async function (subEtapa, usuarioId) {
    if (this.etapa_actual !== 'produccion') {
        throw new Error('El proyecto no está en la etapa de Producción');
    }

    const ahora = new Date();

    if (subEtapa === 'manufactura') {
        if (this.manufactura_completado) {
            throw new Error('Manufactura ya está completada');
        }
        this.manufactura_completado = true;
        this.manufactura_completado_en = ahora;
        this.manufactura_completado_por = usuarioId;
    } else if (subEtapa === 'herreria') {
        if (this.herreria_completado) {
            throw new Error('Herrería ya está completada');
        }
        this.herreria_completado = true;
        this.herreria_completado_en = ahora;
        this.herreria_completado_por = usuarioId;
    } else {
        throw new Error('Sub-etapa inválida. Use "manufactura" o "herreria"');
    }

    await this.save();

    // Verificar si ambas sub-etapas están completas para auto-avanzar
    const puedeAvanzar = this.manufactura_completado && this.herreria_completado;

    return {
        proyecto: this,
        subEtapaCompletada: subEtapa,
        puedeAvanzarAInstalacion: puedeAvanzar,
        estadoSubEtapas: {
            manufactura: this.manufactura_completado,
            herreria: this.herreria_completado
        }
    };
};

/**
 * Verifica si el proyecto puede avanzar de Producción a Instalación
 * Requiere que Manufactura Y Herrería estén completadas
 */
ProduccionProyecto.prototype.puedeAvanzarDeProduccion = function () {
    if (this.etapa_actual !== 'produccion') return false;
    return this.manufactura_completado && this.herreria_completado;
};

/**
 * Obtiene el estado de las sub-etapas de producción
 */
ProduccionProyecto.prototype.getEstadoSubEtapas = function () {
    return {
        manufactura: {
            completado: this.manufactura_completado || false,
            completadoEn: this.manufactura_completado_en,
            completadoPor: this.manufactura_completado_por
        },
        herreria: {
            completado: this.herreria_completado || false,
            completadoEn: this.herreria_completado_en,
            completadoPor: this.herreria_completado_por
        },
        ambosCompletados: (this.manufactura_completado || false) && (this.herreria_completado || false)
    };
};

/**
 * Obtiene el porcentaje de avance
 * Ahora considera las sub-etapas de Producción
 */
ProduccionProyecto.prototype.getPorcentajeAvance = function () {
    const porcentajesBase = {
        'pendiente': 0,
        'diseno': 20,
        'compras': 40,
        'produccion': 60,  // Base, se ajusta con sub-etapas
        'instalacion': 90,
        'completado': 100
    };

    let porcentaje = porcentajesBase[this.etapa_actual] || 0;

    // Si está en producción, ajustar según sub-etapas completadas
    if (this.etapa_actual === 'produccion') {
        // Base 60%, +10% por cada sub-etapa completada (máx 80%)
        if (this.manufactura_completado) porcentaje += 10;
        if (this.herreria_completado) porcentaje += 10;
    }

    return porcentaje;
};

/**
 * Calcula días restantes hasta fecha límite
 */
ProduccionProyecto.prototype.getDiasRestantes = function () {
    if (!this.fecha_limite) return null;

    // Parsear la fecha límite de forma independiente a timezone
    // formato: YYYY-MM-DD
    const [year, month, day] = this.fecha_limite.split('-').map(Number);

    // Obtener fecha de hoy en hora de México (CST -6)
    const now = new Date();
    const mexicoOffset = -6 * 60; // -6 horas en minutos
    const mexicoTime = new Date(now.getTime() + (now.getTimezoneOffset() + mexicoOffset) * 60 * 1000);
    const hoyYear = mexicoTime.getFullYear();
    const hoyMonth = mexicoTime.getMonth() + 1;
    const hoyDay = mexicoTime.getDate();

    // Calcular diferencia en días usando UTC para evitar problemas de DST
    const limiteUTC = Date.UTC(year, month - 1, day);
    const hoyUTC = Date.UTC(hoyYear, hoyMonth - 1, hoyDay);

    const diffMs = limiteUTC - hoyUTC;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// ===== Tiempos máximos por tipo de proyecto (en días) =====
const TIEMPOS_POR_TIPO = {
    'C': { diseno: 1, compras: 2, produccion: 5, instalacion: 6 },   // Acumulados: 1, 1+1=2, 2+3=5, 5+1=6
    'B': { diseno: 2, compras: 5, produccion: 10, instalacion: 13 }, // Acumulados: 2, 2+3=5, 5+5=10, 10+3=13
    'A': { diseno: 5, compras: 10, produccion: 20, instalacion: 25 } // Acumulados: 5, 5+5=10, 10+10=20, 20+5=25
};

/**
 * Calcula si el proyecto está en retraso según su tipo (A, B, C)
 * Usa fecha_entrada y compara con el tiempo acumulado permitido para la etapa actual
 * @returns {{ enRetraso: boolean, diasEnProyecto: number, tiempoPermitido: number | null }}
 */
ProduccionProyecto.prototype.getEstadoRetraso = function () {
    // Solo aplica para tipos A, B, C
    const tipo = this.tipo_proyecto?.toUpperCase();
    if (!tipo || !TIEMPOS_POR_TIPO[tipo]) {
        return { enRetraso: false, diasEnProyecto: 0, tiempoPermitido: null };
    }

    // Si no hay fecha de entrada, no podemos calcular
    if (!this.fecha_entrada) {
        return { enRetraso: false, diasEnProyecto: 0, tiempoPermitido: null };
    }

    // Si ya está completado, no hay retraso
    if (this.etapa_actual === 'completado' || this.etapa_actual === 'pendiente') {
        return { enRetraso: false, diasEnProyecto: 0, tiempoPermitido: null };
    }

    // Calcular días desde fecha_entrada hasta hoy (usando hora de México)
    const [year, month, day] = this.fecha_entrada.split('-').map(Number);
    const now = new Date();
    const mexicoOffset = -6 * 60;
    const mexicoTime = new Date(now.getTime() + (now.getTimezoneOffset() + mexicoOffset) * 60 * 1000);
    const hoyYear = mexicoTime.getFullYear();
    const hoyMonth = mexicoTime.getMonth() + 1;
    const hoyDay = mexicoTime.getDate();

    const entradaUTC = Date.UTC(year, month - 1, day);
    const hoyUTC = Date.UTC(hoyYear, hoyMonth - 1, hoyDay);
    const diasEnProyecto = Math.round((hoyUTC - entradaUTC) / (1000 * 60 * 60 * 24));

    // Obtener tiempo permitido acumulado para la etapa actual
    const tiemposAcumulados = TIEMPOS_POR_TIPO[tipo];
    const tiempoPermitido = tiemposAcumulados[this.etapa_actual] || null;

    // Si no hay tiempo definido para esta etapa, no hay retraso
    if (tiempoPermitido === null) {
        return { enRetraso: false, diasEnProyecto, tiempoPermitido: null };
    }

    const enRetraso = diasEnProyecto > tiempoPermitido;

    return {
        enRetraso,
        diasEnProyecto,
        tiempoPermitido,
        diasRetraso: enRetraso ? diasEnProyecto - tiempoPermitido : 0
    };
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
    const sequelize = await import('sequelize');
    const { literal } = sequelize;

    const proyectos = await this.findAll({
        where: { activo: true },
        order: [
            // GTIA (garantías) primero
            [literal("CASE WHEN tipo_proyecto = 'GTIA' THEN 0 ELSE 1 END"), 'ASC'],
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
