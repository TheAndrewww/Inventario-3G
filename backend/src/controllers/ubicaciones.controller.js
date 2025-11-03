import { Ubicacion } from '../models/index.js';

/**
 * GET /api/ubicaciones
 * Obtener todas las ubicaciones
 */
export const getUbicaciones = async (req, res) => {
    try {
        const ubicaciones = await Ubicacion.findAll({
            order: [['codigo', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: {
                ubicaciones
            }
        });

    } catch (error) {
        console.error('Error en getUbicaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener ubicaciones',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/ubicaciones
 * Crear una nueva ubicación
 */
export const crearUbicacion = async (req, res) => {
    try {
        const { codigo, descripcion } = req.body;

        // Validar campos requeridos
        if (!codigo || !codigo.trim()) {
            return res.status(400).json({
                success: false,
                message: 'El código de la ubicación es obligatorio'
            });
        }

        // Verificar si ya existe una ubicación con ese código
        const ubicacionExistente = await Ubicacion.findOne({
            where: { codigo: codigo.trim() }
        });

        if (ubicacionExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una ubicación con ese código'
            });
        }

        // Crear la ubicación
        const nuevaUbicacion = await Ubicacion.create({
            codigo: codigo.trim(),
            descripcion: descripcion ? descripcion.trim() : 'Sin descripción'
        });

        res.status(201).json({
            success: true,
            message: 'Ubicación creada exitosamente',
            data: nuevaUbicacion
        });

    } catch (error) {
        console.error('Error en crearUbicacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear ubicación',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getUbicaciones,
    crearUbicacion
};
