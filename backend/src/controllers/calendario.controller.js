import {
  leerCalendarioMes,
  obtenerProyectosDia,
  obtenerDistribucionEquipos
} from '../services/googleSheets.service.js';

/**
 * Obtener calendario completo del mes
 * GET /api/calendario/mes/:mes
 */
export const obtenerCalendarioMes = async (req, res) => {
  try {
    const { mes } = req.params;
    const mesNormalizado = mes.toUpperCase();

    console.log(`📅 Leyendo calendario del mes: ${mesNormalizado}`);

    const resultado = await leerCalendarioMes(mesNormalizado);

    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerCalendarioMes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener calendario',
      error: error.message
    });
  }
};

/**
 * Obtener proyectos de un día específico
 * GET /api/calendario/mes/:mes/dia/:dia
 */
export const obtenerProyectosDelDia = async (req, res) => {
  try {
    const { mes, dia } = req.params;
    const mesNormalizado = mes.toUpperCase();

    console.log(`📋 Leyendo proyectos del día ${dia} de ${mesNormalizado}`);

    const resultado = await obtenerProyectosDia(mesNormalizado, dia);

    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerProyectosDelDia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos del día',
      error: error.message
    });
  }
};

/**
 * Obtener distribución de equipos del mes
 * GET /api/calendario/mes/:mes/equipos
 */
export const obtenerDistribucionEquiposMes = async (req, res) => {
  try {
    const { mes } = req.params;
    const mesNormalizado = mes.toUpperCase();

    console.log(`👥 Obteniendo distribución de equipos para ${mesNormalizado}`);

    const resultado = await obtenerDistribucionEquipos(mesNormalizado);

    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerDistribucionEquiposMes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución de equipos',
      error: error.message
    });
  }
};

/**
 * Obtener calendario del mes actual (helper)
 * GET /api/calendario/actual
 */
export const obtenerCalendarioActual = async (req, res) => {
  try {
    const meses = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];

    const mesActual = meses[new Date().getMonth()];

    console.log(`📅 Leyendo calendario del mes actual: ${mesActual}`);

    const resultado = await leerCalendarioMes(mesActual);

    res.json(resultado);
  } catch (error) {
    console.error('Error en obtenerCalendarioActual:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener calendario actual',
      error: error.message
    });
  }
};

export default {
  obtenerCalendarioMes,
  obtenerProyectosDelDia,
  obtenerDistribucionEquiposMes,
  obtenerCalendarioActual
};
