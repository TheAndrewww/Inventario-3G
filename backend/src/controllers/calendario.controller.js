import {
  leerCalendarioMes,
  obtenerProyectosDia,
  obtenerDistribucionEquipos
} from '../services/googleSheets.service.js';
import {
  buscarCarpetaVentas,
  listarArchivosVentas,
  obtenerArchivoVentas
} from '../services/driveVentas.service.js';
import { ProduccionProyecto } from '../models/index.js';

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

/**
 * Normalizar un nombre de proyecto para comparar (sin acentos, sin dobles
 * espacios, en mayúsculas).
 */
const normalizarNombre = (texto = '') =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Buscar el proyecto de producción que corresponde a un renglón del calendario.
 * El calendario viene de Google Sheets y no trae id, así que se cruza por
 * nombre normalizado: primero exacto, luego el mejor substring.
 */
const buscarProyectoProduccion = async (nombreCalendario) => {
  const objetivo = normalizarNombre(nombreCalendario);
  if (objetivo.length < 4) return null;

  const proyectos = await ProduccionProyecto.findAll({
    where: { activo: true },
    order: [['fecha_entrada', 'DESC']],
    limit: 800
  });

  let mejor = null;
  for (const proyecto of proyectos) {
    const norm = normalizarNombre(proyecto.nombre);
    if (norm === objetivo) return proyecto;

    let score = 0;
    if (norm.includes(objetivo)) score = 500 - (norm.length - objetivo.length);
    else if (objetivo.includes(norm) && norm.length >= 8) score = 100 + norm.length;

    if (score > 0 && (!mejor || score > mejor.score)) mejor = { proyecto, score };
  }

  return mejor ? mejor.proyecto : null;
};

/**
 * Obtener la información de la carpeta de VENTAS de un proyecto del calendario.
 *
 * Para que almacén/calidad pueda dar click a un proyecto en el calendario y ver
 * lo que ventas dejó en Drive (planos, detalles, fotos), SIN el pedido, nada
 * con importes, ni los formatos de cierre (garantía, control de calidad, check).
 *
 * GET /api/calendario/proyecto/ventas?nombre=...&mes=...
 */
export const obtenerCarpetaVentasProyecto = async (req, res) => {
  try {
    const { nombre, mes } = req.query;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Falta el nombre del proyecto'
      });
    }

    const mesHint = mes ? mes.toUpperCase() : null;
    console.log(`📁 Carpeta de ventas solicitada: "${nombre}"${mesHint ? ` [${mesHint}]` : ''}`);

    // Los datos del proyecto salen de producción; los archivos, de Drive.
    // Se piden en paralelo y ninguno tumba al otro si falla.
    const [resProyecto, resCarpeta] = await Promise.allSettled([
      buscarProyectoProduccion(nombre),
      buscarCarpetaVentas(nombre, mesHint)
    ]);

    if (resProyecto.status === 'rejected') {
      console.error('⚠️ No se pudo cruzar con producción:', resProyecto.reason?.message);
    }

    const proyecto = resProyecto.status === 'fulfilled' ? resProyecto.value : null;

    if (resCarpeta.status === 'rejected') {
      return res.status(500).json({
        success: false,
        message: resCarpeta.reason?.message || 'Error al leer la carpeta de ventas'
      });
    }

    const carpeta = resCarpeta.value;

    const datosProyecto = proyecto
      ? {
          id: proyecto.id,
          nombre: proyecto.nombre,
          cliente: proyecto.cliente,
          descripcion: proyecto.descripcion,
          tipo_proyecto: proyecto.tipo_proyecto,
          etapa_actual: proyecto.etapa_actual,
          fecha_limite: proyecto.fecha_limite,
          fecha_entrada: proyecto.fecha_entrada,
          pausado: proyecto.pausado,
          pausado_motivo: proyecto.pausado_motivo,
          es_premium: proyecto.es_premium,
          es_extensivo: proyecto.es_extensivo,
          tiene_manufactura: proyecto.tiene_manufactura,
          tiene_herreria: proyecto.tiene_herreria,
          manufactura_completado: proyecto.manufactura_completado,
          herreria_completado: proyecto.herreria_completado
        }
      : null;

    if (!carpeta) {
      return res.json({
        success: true,
        data: {
          proyecto: datosProyecto,
          carpeta: null,
          archivos: [],
          ocultos: 0,
          mensaje: 'Todavía no hay carpeta de ventas para este proyecto en Drive'
        }
      });
    }

    const { archivos, ocultos } = await listarArchivosVentas(carpeta.id);

    res.json({
      success: true,
      data: {
        proyecto: datosProyecto,
        carpeta: {
          id: carpeta.id,
          nombre: carpeta.name,
          ruta: carpeta.ruta,
          link: carpeta.link
        },
        archivos,
        ocultos
      }
    });
  } catch (error) {
    console.error('Error en obtenerCarpetaVentasProyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la carpeta de ventas',
      error: error.message
    });
  }
};

/**
 * Servir un archivo de la carpeta de VENTAS, solo para verlo (nunca como
 * descarga).
 *
 * Almacén/calidad no tiene acceso a Drive, así que el archivo se entrega desde
 * el backend. El servicio valida que el archivo cuelgue de VENTAS y que no sea
 * de los excluidos (pedido, cotizaciones, importes).
 *
 * GET /api/calendario/proyecto/ventas/archivo/:archivoId
 */
export const obtenerArchivoCarpetaVentas = async (req, res) => {
  try {
    const { archivoId } = req.params;

    const archivo = await obtenerArchivoVentas(archivoId);

    if (!archivo) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no disponible'
      });
    }

    res.setHeader('Content-Type', archivo.mimeType || 'application/octet-stream');
    // Siempre inline: estos archivos se consultan, no se descargan.
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`
    );
    res.setHeader('Cache-Control', 'private, max-age=300');

    archivo.stream.on('error', (error) => {
      console.error('Error al transmitir archivo de ventas:', error);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });

    archivo.stream.pipe(res);
  } catch (error) {
    console.error('Error en obtenerArchivoCarpetaVentas:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener el archivo',
        error: error.message
      });
    }
  }
};

export default {
  obtenerCalendarioMes,
  obtenerProyectosDelDia,
  obtenerDistribucionEquiposMes,
  obtenerCalendarioActual,
  obtenerCarpetaVentasProyecto,
  obtenerArchivoCarpetaVentas
};
