import { ProduccionProyecto, Usuario, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import produccionSheetsService from '../services/produccionSheets.service.js';

// Colores por área (del sistema de calendario existente)
const COLORES_AREAS = {
    diseno: { nombre: 'Diseño', color: '#8E99EB', bgClass: 'bg-indigo-500' },
    compras: { nombre: 'Compras', color: '#10B981', bgClass: 'bg-emerald-500' },
    produccion: { nombre: 'Producción', color: '#F59E0B', bgClass: 'bg-amber-500' },
    instalacion: { nombre: 'Instalación', color: '#3B82F6', bgClass: 'bg-blue-500' }
};

// Códigos de acceso por área (para terminales)
const CODIGOS_AREA = {
    'DIS-2026': 'diseno',
    'COM-2026': 'compras',
    'PRO-2026': 'produccion',
    'INS-2026': 'instalacion'
};

/**
 * GET /api/produccion/dashboard
 * Obtener todos los proyectos agrupados por etapa para el dashboard
 */
export const obtenerDashboard = async (req, res) => {
    try {
        const resultado = await ProduccionProyecto.obtenerResumenDashboard();

        // Agregar información de colores
        const resumenConColores = {};
        Object.keys(resultado.resumen).forEach(etapa => {
            resumenConColores[etapa] = {
                proyectos: resultado.resumen[etapa].map(p => ({
                    ...p.toJSON(),
                    diasRestantes: p.getDiasRestantes(),
                    porcentaje: p.getPorcentajeAvance()
                })),
                info: COLORES_AREAS[etapa] || { nombre: etapa, color: '#6B7280' }
            };
        });

        res.json({
            success: true,
            data: {
                resumen: resumenConColores,
                estadisticas: resultado.estadisticas,
                coloresAreas: COLORES_AREAS
            }
        });
    } catch (error) {
        console.error('Error al obtener dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener dashboard de producción',
            error: error.message
        });
    }
};

/**
 * GET /api/produccion/area/:area
 * Obtener proyectos de un área específica (para terminales)
 */
export const obtenerPorArea = async (req, res) => {
    try {
        const { area } = req.params;

        // Mapear área a etapa
        // En la terminal de cada área se muestran los proyectos que ESTÁN en esa etapa
        // (es decir, esperando ser completados por esa área)
        const etapasValidas = ['diseno', 'compras', 'produccion', 'instalacion'];

        if (!etapasValidas.includes(area)) {
            return res.status(400).json({
                success: false,
                message: `Área inválida. Use: ${etapasValidas.join(', ')}`
            });
        }

        const proyectos = await ProduccionProyecto.obtenerPorEtapa(area);

        res.json({
            success: true,
            data: {
                area,
                info: COLORES_AREAS[area],
                proyectos: proyectos.map(p => ({
                    ...p.toJSON(),
                    diasRestantes: p.getDiasRestantes(),
                    porcentaje: p.getPorcentajeAvance()
                })),
                total: proyectos.length
            }
        });
    } catch (error) {
        console.error('Error al obtener área:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener proyectos del área',
            error: error.message
        });
    }
};

/**
 * POST /api/produccion/:id/completar-etapa
 * Marcar la etapa actual como completada y avanzar
 */
export const completarEtapa = async (req, res) => {
    try {
        const { id } = req.params;
        const { observaciones, codigo_area } = req.body;

        // Si hay código de área, validarlo
        let usuarioId = null;
        if (req.usuario) {
            usuarioId = req.usuario.id;
        }

        const proyecto = await ProduccionProyecto.findByPk(id);

        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        if (proyecto.etapa_actual === 'completado') {
            return res.status(400).json({
                success: false,
                message: 'El proyecto ya está completado'
            });
        }

        const etapaAnterior = proyecto.etapa_actual;
        await proyecto.completarEtapaActual(usuarioId, observaciones);

        console.log(`✅ Proyecto "${proyecto.nombre}" avanzó de ${etapaAnterior} a ${proyecto.etapa_actual}`);

        res.json({
            success: true,
            message: `Etapa "${etapaAnterior}" completada`,
            data: {
                proyecto: {
                    ...proyecto.toJSON(),
                    diasRestantes: proyecto.getDiasRestantes(),
                    porcentaje: proyecto.getPorcentajeAvance()
                },
                etapaAnterior,
                etapaNueva: proyecto.etapa_actual
            }
        });
    } catch (error) {
        console.error('Error al completar etapa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al completar etapa',
            error: error.message
        });
    }
};

/**
 * POST /api/produccion/validar-codigo
 * Validar código de área para terminales
 */
export const validarCodigoArea = async (req, res) => {
    try {
        const { codigo } = req.body;

        const area = CODIGOS_AREA[codigo?.toUpperCase()];

        if (!area) {
            return res.status(401).json({
                success: false,
                message: 'Código de área inválido'
            });
        }

        res.json({
            success: true,
            data: {
                area,
                info: COLORES_AREAS[area]
            }
        });
    } catch (error) {
        console.error('Error al validar código:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar código',
            error: error.message
        });
    }
};

/**
 * POST /api/produccion/crear
 * Crear nuevo proyecto de producción
 */
export const crearProyecto = async (req, res) => {
    try {
        const { nombre, cliente, descripcion, prioridad, fecha_entrada, fecha_limite } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del proyecto es requerido'
            });
        }

        const proyecto = await ProduccionProyecto.create({
            nombre: nombre.trim(),
            cliente: cliente?.trim() || null,
            descripcion: descripcion?.trim() || null,
            prioridad: prioridad || 3,
            fecha_entrada: fecha_entrada || new Date(),
            fecha_limite: fecha_limite || null,
            etapa_actual: 'diseno'
        });

        console.log(`📦 Nuevo proyecto creado: "${proyecto.nombre}"`);

        res.status(201).json({
            success: true,
            message: 'Proyecto creado exitosamente',
            data: { proyecto }
        });
    } catch (error) {
        console.error('Error al crear proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear proyecto',
            error: error.message
        });
    }
};

/**
 * PUT /api/produccion/:id
 * Actualizar proyecto
 */
export const actualizarProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        const proyecto = await ProduccionProyecto.findByPk(id);

        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        await proyecto.update(datos);

        res.json({
            success: true,
            message: 'Proyecto actualizado',
            data: { proyecto }
        });
    } catch (error) {
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar proyecto',
            error: error.message
        });
    }
};

/**
 * DELETE /api/produccion/:id
 * Eliminar proyecto (soft delete)
 */
export const eliminarProyecto = async (req, res) => {
    try {
        const { id } = req.params;

        const proyecto = await ProduccionProyecto.findByPk(id);

        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        await proyecto.update({ activo: false });

        res.json({
            success: true,
            message: 'Proyecto eliminado'
        });
    } catch (error) {
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar proyecto',
            error: error.message
        });
    }
};

/**
 * GET /api/produccion/estadisticas
 * Obtener estadísticas generales
 */
export const obtenerEstadisticas = async (req, res) => {
    try {
        const totales = await ProduccionProyecto.findAll({
            where: { activo: true },
            attributes: [
                'etapa_actual',
                [sequelize.fn('COUNT', sequelize.col('id')), 'total']
            ],
            group: ['etapa_actual'],
            raw: true
        });

        // Convertir a objeto
        const porEtapa = {};
        totales.forEach(t => {
            porEtapa[t.etapa_actual] = parseInt(t.total);
        });

        // Proyectos urgentes (prioridad 1 o fecha límite próxima)
        const hoy = new Date();
        const en3Dias = new Date();
        en3Dias.setDate(en3Dias.getDate() + 3);

        const urgentes = await ProduccionProyecto.count({
            where: {
                activo: true,
                etapa_actual: { [Op.notIn]: ['completado', 'pendiente'] },
                [Op.or]: [
                    { prioridad: 1 },
                    { fecha_limite: { [Op.between]: [hoy, en3Dias] } }
                ]
            }
        });

        res.json({
            success: true,
            data: {
                porEtapa,
                urgentes,
                total: Object.values(porEtapa).reduce((a, b) => a + b, 0)
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

/**
 * POST /api/produccion/sincronizar
 * Sincronizar proyectos desde Google Sheets
 */
export const sincronizarConSheets = async (req, res) => {
    try {
        const { mes } = req.body; // Opcional, si no se especifica usa el mes actual

        console.log(`🔄 Iniciando sincronización con Google Sheets ${mes ? `(mes: ${mes})` : '(mes actual)'}...`);

        const resultado = await produccionSheetsService.sincronizarConDB(mes);

        res.json({
            success: true,
            message: resultado.message,
            data: {
                mes: resultado.mes,
                creados: resultado.creados,
                actualizados: resultado.actualizados,
                total: resultado.total
            }
        });
    } catch (error) {
        console.error('Error al sincronizar con Sheets:', error);
        res.status(500).json({
            success: false,
            message: 'Error al sincronizar con Google Sheets',
            error: error.message
        });
    }
};

/**
 * GET /api/produccion/meses-disponibles
 * Obtener lista de meses disponibles en el spreadsheet
 */
export const obtenerMesesDisponibles = async (req, res) => {
    try {
        const resultado = await produccionSheetsService.obtenerMesesDisponibles();

        res.json({
            success: true,
            data: resultado.data,
            todasLasHojas: resultado.todasLasHojas
        });
    } catch (error) {
        console.error('Error al obtener meses:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener meses disponibles',
            error: error.message
        });
    }
};

/**
 * GET /api/produccion/preview-sheets/:mes
 * Vista previa de proyectos en el spreadsheet (sin guardar)
 */
export const previewProyectosSheets = async (req, res) => {
    try {
        const { mes } = req.params;

        const resultado = await produccionSheetsService.leerProyectosProduccion(mes);

        res.json({
            success: true,
            data: resultado.data,
            mes: resultado.mes,
            total: resultado.total
        });
    } catch (error) {
        console.error('Error al obtener preview:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener vista previa',
            error: error.message
        });
    }
};
