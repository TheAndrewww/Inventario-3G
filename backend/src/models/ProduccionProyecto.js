import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { esFestivoUTC } from '../utils/calendarioLaboral.js';

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
    compras_en_proceso: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'True si hay órdenes de compra pendientes para este proyecto'
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

    // ===== Estado de pausa (Congelado) =====
    pausado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Proyecto en pausa/congelado - no muestra como atrasado'
    },
    pausado_en: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp cuando se pausó el proyecto'
    },
    pausado_motivo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo de la pausa'
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

    // Sub-sub-etapas de Herrería: Armado y Pintado.
    // herreria_completado pasa a true automáticamente cuando ambos están en true.
    herreria_armado_completado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si Herrería - Armado completó'
    },
    herreria_pintado_completado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si Herrería - Pintado completó'
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
    archivos_ticket: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Tickets de salida ya vistos en la carpeta [{id, nombre}]. No son producción: se guardan solo para no repetir el aviso al grupo'
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

    // ===== Flag para MTO premium =====
    // Los MTO PREMIUM no tienen producción (manufactura/herrería); se tratan como GTIA
    // para el sync con Drive y los dashboards de sub-áreas.
    es_premium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si el proyecto MTO es PREMIUM (columna J del spreadsheet)'
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

// Hook: al cerrarse un proyecto (etapa_actual → 'completado'), anular sus
// pedidos abiertos para revertir stock reservado y cancelar solicitudes de compra.
ProduccionProyecto.addHook('afterUpdate', async (proyecto, options) => {
    const previa = proyecto.previous('etapa_actual');
    if (previa === 'completado' || proyecto.etapa_actual !== 'completado') return;
    try {
        const { anularPedidosDeProyecto } = await import('../services/pedidosCleanup.service.js');
        const resultado = await anularPedidosDeProyecto({
            proyectoNombre: proyecto.nombre,
            proyectoId: proyecto.id, // C1 · PLA-19: con EMPATE_POR_OBRA busca primero por el ID 3G de la obra
            motivo: `Proyecto "${proyecto.nombre}" marcado como completado`,
            transaction: options?.transaction || null
        });
        if (resultado.anulados > 0) {
            console.log(`🧹 Auto-anulados ${resultado.anulados} pedido(s) del proyecto "${proyecto.nombre}": ${resultado.ticketIds.join(', ')}`);
        }
        // A6 · PLA-05 (CIERRE_OBRA_RESPETA_ENTREGADO): los que ya tenían material entregado o compras recibidas
        if (resultado.porRevisar > 0) {
            console.log(`🔎 Por revisar (cierre de obra) ${resultado.porRevisar} pedido(s) del proyecto "${proyecto.nombre}": ${resultado.ticketIdsPorRevisar.join(', ')}`);
        }
    } catch (err) {
        console.error('[ProduccionProyecto afterUpdate] Error al limpiar pedidos:', err);
    }
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

    // Detectar si usa timeline simplificado: MTO o GTIA que NO son EXTENSIVO
    // pasan directo a Preparado sin producción.
    const tipoProyecto = this.tipo_proyecto?.toUpperCase();
    const esMTOoGTIA = tipoProyecto === 'MTO' || tipoProyecto === 'GTIA';
    const usaTimelineSimplificado = esMTOoGTIA && !this.es_extensivo;

    // Para MTO/GTIA con timeline simplificado: van a instalacion (Preparado), luego a completado
    if (usaTimelineSimplificado) {
        if (etapaActual === 'instalacion') {
            // Si ya están en Preparado, completar el proyecto
            this.etapa_actual = 'completado';
            this.fecha_completado = ahora;
            await this.save();
            return this;
        } else if (etapaActual !== 'completado') {
            // Si están en cualquier otra etapa, moverlos a Preparado
            this.etapa_actual = 'instalacion';
            this.instalacion_completado_en = ahora;
            this.instalacion_completado_por = usuarioId;
            // Auto-marcar sub-etapas para que no sigan apareciendo en las TV de manufactura/herrería
            if (!this.manufactura_completado) {
                this.manufactura_completado = true;
                this.manufactura_completado_en = ahora;
                this.manufactura_completado_por = usuarioId;
            }
            if (!this.herreria_completado) {
                this.herreria_completado = true;
                this.herreria_completado_en = ahora;
                this.herreria_completado_por = usuarioId;
            }
            await this.save();
            return this;
        }
    }

    // Flujo normal para proyectos A, B, C y MTO extensivo
    // Diseño y Compras sellan SU PROPIO «completado_en», como el tablero (toggleEtapa), la línea de tiempo
    // y regresarEtapa. Antes cerrar Diseño sellaba Compras y cerrar Compras sellaba Producción.
    const flujo = {
        'pendiente': { siguiente: 'diseno', campo: 'diseno_completado_en', campoPor: 'diseno_completado_por', obs: 'observaciones_diseno' },
        'diseno': { siguiente: 'compras', campo: 'diseno_completado_en', campoPor: 'diseno_completado_por', obs: 'observaciones_diseno' },
        'compras': { siguiente: 'produccion', campo: 'compras_completado_en', campoPor: 'compras_completado_por', obs: 'observaciones_compras' },
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

    // Al avanzar de produccion → instalacion, auto-marcar las sub-etapas paralelas
    // para que los dashboards de manufactura/herrería dejen de mostrar el proyecto.
    if (etapaActual === 'produccion' && config.siguiente === 'instalacion') {
        if (!this.manufactura_completado) {
            this.manufactura_completado = true;
            this.manufactura_completado_en = ahora;
            this.manufactura_completado_por = usuarioId;
        }
        if (!this.herreria_completado) {
            this.herreria_completado = true;
            this.herreria_completado_en = ahora;
            this.herreria_completado_por = usuarioId;
        }
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
 * Regresa a la etapa anterior
 * @param {number} usuarioId - ID del usuario que revierte la etapa
 * @param {object} [opcionesGuardar] - Opciones del save (la transacción de Calidad cuando un defecto la regresa)
 */
ProduccionProyecto.prototype.regresarEtapa = async function (usuarioId, opcionesGuardar = {}) {
    const etapaActual = this.etapa_actual;

    // Flujo inverso: etapa actual → etapa anterior + campos a limpiar
    const flujoInverso = {
        'compras': { anterior: 'diseno', limpiarCampo: 'diseno_completado_en', limpiarPor: 'diseno_completado_por' },
        'produccion': { anterior: 'compras', limpiarCampo: 'compras_completado_en', limpiarPor: 'compras_completado_por' },
        'instalacion': { anterior: 'produccion', limpiarCampo: 'produccion_completado_en', limpiarPor: 'produccion_completado_por' },
        'completado': { anterior: 'instalacion', limpiarCampo: 'instalacion_completado_en', limpiarPor: 'instalacion_completado_por' }
    };

    const config = flujoInverso[etapaActual];
    if (!config) {
        throw new Error(`No se puede regresar desde la etapa "${etapaActual}"`);
    }

    // Limpiar campo de completado de la etapa anterior (ya que ahora vuelve a estar activa)
    if (config.limpiarCampo) {
        this[config.limpiarCampo] = null;
        this[config.limpiarPor] = null;
    }

    // Si estaba completado, limpiar fecha de completado
    if (etapaActual === 'completado') {
        this.fecha_completado = null;
    }

    // Al regresar de instalacion → produccion, también limpiar las sub-etapas paralelas
    // que quedaron auto-marcadas al avanzar, para que vuelvan a mostrarse en las TV.
    if (etapaActual === 'instalacion' && config.anterior === 'produccion') {
        this.manufactura_completado = false;
        this.manufactura_completado_en = null;
        this.manufactura_completado_por = null;
        this.herreria_completado = false;
        this.herreria_completado_en = null;
        this.herreria_completado_por = null;
        this.instalacion_completado_en = null;
        this.instalacion_completado_por = null;
    }

    // Regresar a la etapa anterior
    this.etapa_actual = config.anterior;

    await this.save(opcionesGuardar);
    return this;
};

/**
 * Completar una sub-etapa de Producción (Manufactura o Herrería)
 * @param {string} subEtapa - 'manufactura' o 'herreria'
 * @param {number} usuarioId - ID del usuario que completa
 */
ProduccionProyecto.prototype.completarSubEtapaProduccion = async function (subEtapa, usuarioId) {
    // ETAPAS PARALELAS: se permite completar manufactura/herrería aunque el proyecto
    // aún no esté formalmente en 'produccion' (archivos pueden subirse antes).

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
        // Asegurar consistencia con sub-sub-etapas
        this.herreria_armado_completado = true;
        this.herreria_pintado_completado = true;
    } else if (subEtapa === 'herreria_armado' || subEtapa === 'herreria_pintado') {
        const campo = subEtapa === 'herreria_armado' ? 'herreria_armado_completado' : 'herreria_pintado_completado';
        if (this[campo]) {
            const nombre = subEtapa === 'herreria_armado' ? 'Soldadura' : 'Pintura';
            throw new Error(`Herrería - ${nombre} ya está completado`);
        }
        this[campo] = true;
        // Auto-marcar herrería completa cuando ambos sub-sub-pasos están listos
        if (this.herreria_armado_completado && this.herreria_pintado_completado && !this.herreria_completado) {
            this.herreria_completado = true;
            this.herreria_completado_en = ahora;
            this.herreria_completado_por = usuarioId;
        }
    } else {
        throw new Error('Sub-etapa inválida. Use "manufactura", "herreria", "herreria_armado" o "herreria_pintado"');
    }

    await this.save();

    // Verificar si las sub-etapas aplicables están completas para auto-avanzar.
    // Un proyecto puede tener solo manufactura, solo herrería, o ambas: solo
    // exigimos completar las áreas que realmente tiene (tiene_manufactura /
    // tiene_herreria). Coincide con la lógica del frontend (isEtapaActiva).
    const manufacturaOk = !this.tiene_manufactura || this.manufactura_completado;
    const herreriaOk = !this.tiene_herreria || this.herreria_completado;
    const tieneProduccion = this.tiene_manufactura || this.tiene_herreria;
    const puedeAvanzar = tieneProduccion && manufacturaOk && herreriaOk;

    // Auto-avanzar a 'instalacion' (= "Completado" en UI, vive en la pantalla
    // de Completados) cuando ambas sub-etapas están completas. NO usamos
    // etapa='completado' porque ese estado está reservado para los proyectos
    // cerrados desde el índice (casilla E del Excel) y queda oculto del dashboard.
    let autoAvanzado = false;
    let esperaCalidad = false;
    if (puedeAvanzar && this.etapa_actual !== 'instalacion' && this.etapa_actual !== 'completado') {
        // 28-oct · CALIDAD_AVAL_CIERRA: con la bandera la obra espera el aval de Calidad en producción («Espera
        // calidad») y la pasa el aval. Apagada, calidadDetieneCierre contesta false sin tocar la base: como hoy.
        const { calidadDetieneCierre, proyectoCerradoPorElAval } = await import('../services/calidad.service.js');
        if (await calidadDetieneCierre(this)) {
            esperaCalidad = true;
            if (this.etapa_actual !== 'produccion') {
                this.etapa_actual = 'produccion';
                await this.save();
            }
        } else if (await proyectoCerradoPorElAval(this)) {
            // 29-oct · el aval la pasó a Preparado mientras esta terminal esperaba: no se cierra ni se avisa otra vez
            await this.reload();
        } else {
            this.etapa_actual = 'instalacion';
            this.instalacion_completado_en = ahora;
            this.instalacion_completado_por = usuarioId;
            await this.save();
            autoAvanzado = true;
        }
    }

    return {
        proyecto: this,
        subEtapaCompletada: subEtapa,
        puedeAvanzarAInstalacion: puedeAvanzar,
        autoAvanzado,
        ...(esperaCalidad ? { esperaCalidad: true } : {}),
        estadoSubEtapas: {
            manufactura: this.manufactura_completado,
            herreria: this.herreria_completado
        }
    };
};

/**
 * «Preparado» (etapa interna 'instalacion') con la misma lógica que el interruptor «Lista» de la oficina (toggleEtapa
 * con etapa 'instalacion' y completado = true): sella instalacion_completado_en/_por, marca terminadas manufactura y
 * herrería (y soldadura y pintura) si faltaban y pasa la etapa a 'instalacion'. Lo usa el aval de Calidad con
 * CALIDAD_AVAL_CIERRA (28-oct); el aviso al grupo lo manda quien lo llama, igual que toggleEtapa. `opcionesGuardar`
 * lleva la transacción del aval (29-oct).
 */
ProduccionProyecto.prototype.marcarPreparado = async function (usuarioId = null, opcionesGuardar = {}) {
    const ahora = new Date();
    this.instalacion_completado_en = ahora;
    this.instalacion_completado_por = usuarioId;
    if (!this.manufactura_completado) {
        this.manufactura_completado = true;
        this.manufactura_completado_en = ahora;
        this.manufactura_completado_por = usuarioId;
    }
    if (!this.herreria_completado) {
        this.herreria_completado = true;
        this.herreria_completado_en = ahora;
        this.herreria_completado_por = usuarioId;
    }
    this.herreria_armado_completado = true;
    this.herreria_pintado_completado = true;
    this.etapa_actual = 'instalacion';
    this.fecha_completado = null;
    await this.save(opcionesGuardar);
    return this;
};

/**
 * Verifica si el proyecto puede avanzar de Producción a Instalación
 * Requiere que Manufactura Y Herrería estén completadas
 */
ProduccionProyecto.prototype.puedeAvanzarDeProduccion = function () {
    if (this.etapa_actual !== 'produccion') return false;
    const manufacturaOk = !this.tiene_manufactura || this.manufactura_completado;
    const herreriaOk = !this.tiene_herreria || this.herreria_completado;
    const tieneProduccion = this.tiene_manufactura || this.tiene_herreria;
    return tieneProduccion && manufacturaOk && herreriaOk;
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
 * Helper: Calcula días hábiles (Lunes a Sábado) entre dos fechas
 * Excluye los domingos y los festivos (C9 · PLA-07: oficiales calculados y, si Operación los da, los del negocio;
 * los mismos que usa la pantalla en frontend/src/utils/produccion.js).
 * Retorna negativo si fechaInicio > fechaFin.
 */
function calcularDiasHabiles(timestampInicio, timestampFin) {
    let start = new Date(Math.min(timestampInicio, timestampFin));
    let end = new Date(Math.max(timestampInicio, timestampFin));
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    let diasHabiles = 0;
    let current = new Date(start);

    while (current.getTime() < end.getTime()) {
        current.setUTCDate(current.getUTCDate() + 1);
        const day = current.getUTCDay();
        if (day !== 0 && !esFestivoUTC(current)) { // 0 = Domingo. Excluir Domingo y festivos.
            diasHabiles++;
        }
    }

    return timestampInicio <= timestampFin ? diasHabiles : -diasHabiles;
}

/**
 * Calcula días restantes hasta fecha límite (Días Hábiles)
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

    // Calcular diferencia en días hábiles
    const limiteUTC = Date.UTC(year, month - 1, day);
    const hoyUTC = Date.UTC(hoyYear, hoyMonth - 1, hoyDay);

    return calcularDiasHabiles(hoyUTC, limiteUTC);
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

    // Usar días hábiles (excluyendo domingos)
    // Restamos 1 día para dar margen de "subida de medidas" al inicio del proyecto
    const diasEnProyectoRaw = calcularDiasHabiles(entradaUTC, hoyUTC);
    const diasEnProyecto = Math.max(0, diasEnProyectoRaw - 1);

    // Obtener tiempo permitido acumulado para la etapa actual
    const tiemposAcumulados = TIEMPOS_POR_TIPO[tipo];
    const tiempoPermitido = tiemposAcumulados[this.etapa_actual] || null;

    // Si no hay tiempo definido para esta etapa, no hay retraso
    if (tiempoPermitido === null) {
        return { enRetraso: false, diasEnProyecto, tiempoPermitido: null, diasRestantesEtapa: null };
    }

    const enRetraso = diasEnProyecto > tiempoPermitido;
    const diasRestantesEtapa = tiempoPermitido - diasEnProyecto; // Positivo = días que faltan, Negativo = días de retraso

    return {
        enRetraso,
        diasEnProyecto,
        tiempoPermitido,
        diasRetraso: enRetraso ? diasEnProyecto - tiempoPermitido : 0,
        diasRestantesEtapa // Para ordenamiento: menor = más urgente
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
    const { literal, Op } = sequelize;

    const proyectos = await this.findAll({
        where: {
            activo: true,
            // Ocultar proyectos cerrados desde el índice (casilla E del Excel marcada
            // → sync los pone en etapa='completado'). Se mantienen en la DB como
            // histórico pero no aparecen en ningún dashboard.
            etapa_actual: { [Op.ne]: 'completado' },
            // Excluir proyectos cancelados
            [Op.or]: [
                { tipo_proyecto: null },
                { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }
            ]
        },
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

    // Contadores para estadísticas (considerando regla MTO/GTIA)
    const estadisticas = {
        total: proyectos.length,
        pendiente: 0,
        diseno: 0,
        compras: 0,
        produccion: 0,
        instalacion: 0,
        completado: 0,
        enProceso: 0
    };

    proyectos.forEach(p => {
        const tipoProyecto = p.tipo_proyecto?.toUpperCase();
        const esMTOoGTIA = tipoProyecto === 'MTO' || tipoProyecto === 'GTIA';
        const usaTimelineSimplificado = esMTOoGTIA && !p.es_extensivo;

        // Agrupar en resumen según etapa real
        resumen[p.etapa_actual].push(p);

        // Para estadísticas: MTO/GTIA no EXTENSIVO cuentan como instalación
        // (excepto si ya están completados)
        let etapaParaEstadistica = p.etapa_actual;

        if (usaTimelineSimplificado && p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente') {
            etapaParaEstadistica = 'instalacion';
        }

        estadisticas[etapaParaEstadistica]++;
    });

    estadisticas.enProceso = estadisticas.total - estadisticas.pendiente - estadisticas.completado;

    return {
        proyectos,
        resumen,
        estadisticas
    };
};

/**
 * C7 · PLA-17 — El sí o el no de Producción por WhatsApp, en el proyecto.
 *
 * Julia (Finanzas, FIN-11, bandera PRONOSTICO_A_PLANTA) le pregunta a Producción a las 14:40 si se completa hoy lo que
 * se instala mañana y manda la respuesta a POST /api/sistemas/v1/produccion/pronostico. Se guarda en
 * produccion_proyectos.pronostico_whatsapp (JSONB, la última respuesta). La columna se crea al arrancar con
 * ADD COLUMN IF NOT EXISTS y NO es atributo del modelo: el JSON de los proyectos (terminal, tablero, Ventas) no cambia;
 * solo el tablero (dashboard y dashboard-publico) suma el campo `pronostico_whatsapp` en los proyectos que tienen una
 * respuesta vigente. Guardarla NO cierra nada ni mueve etapas (UPDATE directo, sin los ganchos del modelo); el
 * encargado decide.
 */
export const PRONOSTICO_VIGENCIA_DIAS = 7;

/** Guarda la respuesta si es más nueva que la que había (las respuestas pueden llegar fuera de orden). */
ProduccionProyecto.guardarPronostico = async function (id, pronostico) {
    const [filas] = await sequelize.query(
        `UPDATE produccion_proyectos SET pronostico_whatsapp = CAST(:p AS JSONB)
          WHERE id = :id AND (pronostico_whatsapp IS NULL
             OR (pronostico_whatsapp->>'contestadoEn')::timestamptz <= CAST(:c AS timestamptz))
          RETURNING id`,
        { replacements: { id, p: JSON.stringify(pronostico), c: pronostico.contestadoEn } }
    );
    return filas.length > 0;
};

/** Map(id → pronóstico) de los proyectos con respuesta de los últimos PRONOSTICO_VIGENCIA_DIAS días. */
ProduccionProyecto.pronosticosVigentes = async function (ids) {
    const mapa = new Map();
    const lista = [...new Set((ids || []).filter(Number.isInteger))];
    if (!lista.length) return mapa;
    try {
        const [filas] = await sequelize.query(
            `SELECT id, pronostico_whatsapp AS p FROM produccion_proyectos
              WHERE id IN (:ids) AND pronostico_whatsapp IS NOT NULL
                AND (pronostico_whatsapp->>'contestadoEn')::timestamptz >= NOW() - (:dias || ' days')::interval`,
            { replacements: { ids: lista, dias: String(PRONOSTICO_VIGENCIA_DIAS) } }
        );
        for (const f of filas) mapa.set(f.id, f.p);
    } catch (e) {
        // Sin la columna (o con un dato raro) el tablero sale como siempre
        console.error('[pronostico] no se pudieron leer los pronósticos:', e.message);
    }
    return mapa;
};

export default ProduccionProyecto;
