import CampanaControl from '../models/CampanaControl.js';
import { Op } from 'sequelize';

// Obtener todos los datos del control de campaña
export const getAllData = async (req, res) => {
    try {
        const { year = 2026 } = req.query;

        const data = await CampanaControl.findAll({
            where: { year: parseInt(year) },
            order: [['quarter', 'ASC'], ['area', 'ASC'], ['week', 'ASC']]
        });

        // Convertir a formato de objeto para el frontend
        const dataMap = {};
        data.forEach(item => {
            const key = `q${item.quarter}_${item.area}_s${item.week}`;
            dataMap[key] = {
                status: item.status,
                note: item.note
            };
        });

        res.json({
            success: true,
            data: dataMap,
            year: parseInt(year)
        });
    } catch (error) {
        console.error('Error obteniendo datos de campaña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos',
            error: error.message
        });
    }
};

// Actualizar o crear una celda
export const updateCell = async (req, res) => {
    try {
        const { quarter, area, week } = req.params;
        const { status, note, year = 2026 } = req.body;

        // Validaciones
        const quarterNum = parseInt(quarter);
        const weekNum = parseInt(week);
        const yearNum = parseInt(year);

        if (quarterNum < 1 || quarterNum > 4) {
            return res.status(400).json({
                success: false,
                message: 'Trimestre debe ser entre 1 y 4'
            });
        }

        if (weekNum < 1 || weekNum > 52) {
            return res.status(400).json({
                success: false,
                message: 'Semana debe ser entre 1 y 52'
            });
        }

        const validAreas = ['diseno', 'manufactura', 'herreria', 'equipo1', 'equipo2', 'equipo3', 'equipo4'];
        if (!validAreas.includes(area)) {
            return res.status(400).json({
                success: false,
                message: 'Área inválida'
            });
        }

        // Si no hay status ni note, eliminar el registro
        if (!status && !note) {
            await CampanaControl.destroy({
                where: {
                    year: yearNum,
                    quarter: quarterNum,
                    area,
                    week: weekNum
                }
            });
            return res.json({
                success: true,
                message: 'Celda eliminada',
                data: null
            });
        }

        // Upsert (crear o actualizar)
        const [record, created] = await CampanaControl.upsert({
            year: yearNum,
            quarter: quarterNum,
            area,
            week: weekNum,
            status: status || null,
            note: note || null
        }, {
            returning: true
        });

        res.json({
            success: true,
            message: created ? 'Celda creada' : 'Celda actualizada',
            data: {
                status: record.status,
                note: record.note
            }
        });
    } catch (error) {
        console.error('Error actualizando celda:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar celda',
            error: error.message
        });
    }
};

// Obtener totales por trimestre
export const getTotals = async (req, res) => {
    try {
        const { year = 2026 } = req.query;
        const yearNum = parseInt(year);

        const data = await CampanaControl.findAll({
            where: { year: yearNum }
        });

        // Calcular totales por trimestre y por área
        const totals = {
            byQuarter: {},
            byArea: {}
        };

        for (let q = 1; q <= 4; q++) {
            totals.byQuarter[q] = { good: 0, bad: 0 };
        }

        const areas = ['diseno', 'manufactura', 'herreria', 'equipo1', 'equipo2', 'equipo3', 'equipo4'];
        areas.forEach(area => {
            totals.byArea[area] = {};
            for (let q = 1; q <= 4; q++) {
                totals.byArea[area][q] = { good: 0, bad: 0 };
            }
        });

        data.forEach(item => {
            if (item.status === 'good') {
                totals.byQuarter[item.quarter].good++;
                totals.byArea[item.area][item.quarter].good++;
            } else if (item.status === 'bad') {
                totals.byQuarter[item.quarter].bad++;
                totals.byArea[item.area][item.quarter].bad++;
            }
        });

        res.json({
            success: true,
            totals,
            year: yearNum
        });
    } catch (error) {
        console.error('Error obteniendo totales:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener totales',
            error: error.message
        });
    }
};

// Eliminar una celda específica
export const deleteCell = async (req, res) => {
    try {
        const { quarter, area, week } = req.params;
        const { year = 2026 } = req.query;

        const deleted = await CampanaControl.destroy({
            where: {
                year: parseInt(year),
                quarter: parseInt(quarter),
                area,
                week: parseInt(week)
            }
        });

        res.json({
            success: true,
            message: deleted ? 'Celda eliminada' : 'Celda no encontrada'
        });
    } catch (error) {
        console.error('Error eliminando celda:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar celda',
            error: error.message
        });
    }
};

export default {
    getAllData,
    updateCell,
    getTotals,
    deleteCell
};
