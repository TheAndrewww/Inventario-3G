import db from '../config/database.js';
import { generarImagenAnuncio, generarFrasesDesdeProyectos } from '../services/geminiAnuncios.service.js';
import { subirImagenAnuncio } from '../services/cloudinaryAnuncios.service.js';
import { leerCalendarioMes, obtenerProyectosDia } from '../services/googleSheets.service.js';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Obtener anuncios activos
 * GET /api/anuncios/publico/activos
 */
export const obtenerAnunciosActivos = async (req, res) => {
  try {
    const { dias = 7 } = req.query;

    const query = `
      SELECT
        id,
        fecha,
        frase,
        imagen_url,
        proyecto_nombre,
        equipo,
        tipo_anuncio,
        vistas,
        created_at
      FROM anuncios
      WHERE activo = true
        AND fecha >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
      ORDER BY fecha DESC, created_at DESC
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error al obtener anuncios activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener anuncios',
      error: error.message
    });
  }
};

/**
 * Obtener anuncios del día actual
 * GET /api/anuncios/publico/hoy
 */
export const obtenerAnunciosHoy = async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        fecha,
        frase,
        imagen_url,
        proyecto_nombre,
        equipo,
        tipo_anuncio,
        vistas
      FROM anuncios
      WHERE activo = true
        AND fecha = CURRENT_DATE
      ORDER BY created_at DESC
    `;

    const result = await db.query(query);

    // Si no hay anuncios de hoy, devolver los más recientes
    if (result.rows.length === 0) {
      const queryRecientes = `
        SELECT
          id,
          fecha,
          frase,
          imagen_url,
          proyecto_nombre,
          equipo,
          tipo_anuncio,
          vistas
        FROM anuncios
        WHERE activo = true
        ORDER BY fecha DESC, created_at DESC
        LIMIT 5
      `;

      const resultRecientes = await db.query(queryRecientes);

      return res.json({
        success: true,
        data: resultRecientes.rows,
        total: resultRecientes.rows.length,
        mensaje: 'No hay anuncios de hoy, mostrando recientes'
      });
    }

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error al obtener anuncios de hoy:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener anuncios de hoy',
      error: error.message
    });
  }
};

/**
 * Generar anuncio manualmente
 * POST /api/anuncios/generar
 */
export const generarAnuncioManual = async (req, res) => {
  try {
    const { frase, fecha, mascotBase64, proyectoNombre, equipo } = req.body;

    if (!frase) {
      return res.status(400).json({
        success: false,
        message: 'La frase es requerida'
      });
    }

    // Generar descripción/prompt con Gemini
    const descripcion = await generarImagenAnuncio(frase, mascotBase64);

    // Por ahora, usar una imagen placeholder o generar con otro servicio
    // TODO: Integrar con servicio de generación de imágenes real
    const imagenUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png';

    // Guardar en base de datos
    const query = `
      INSERT INTO anuncios (
        fecha,
        frase,
        imagen_url,
        proyecto_nombre,
        equipo,
        tipo_anuncio,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `;

    const fechaAnuncio = fecha || new Date().toISOString().split('T')[0];
    const values = [fechaAnuncio, frase, imagenUrl, proyectoNombre, equipo, 'manual'];

    const result = await db.query(query, values);

    res.json({
      success: true,
      data: {
        anuncio: result.rows[0],
        descripcionIA: descripcion
      },
      message: 'Anuncio generado exitosamente'
    });

  } catch (error) {
    console.error('Error al generar anuncio manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar anuncio',
      error: error.message
    });
  }
};

/**
 * Generar anuncios desde calendario
 * POST /api/anuncios/generar-desde-calendario
 */
export const generarAnunciosDesdeCalendario = async (req, res) => {
  try {
    const hoy = new Date();
    const mes = MESES[hoy.getMonth()];
    const dia = hoy.getDate();

    // Obtener proyectos del día desde Google Sheets
    const resultado = await obtenerProyectosDia(mes, dia);
    const proyectos = resultado.data.proyectos;

    if (proyectos.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No hay proyectos para hoy en el calendario',
        proyectosEncontrados: 0
      });
    }

    // Generar frases para anuncios
    const frases = generarFrasesDesdeProyectos(proyectos);

    const anunciosGenerados = [];

    for (let i = 0; i < frases.length; i++) {
      const frase = frases[i];
      const proyecto = proyectos[i];

      // Insertar en BD (sin imagen por ahora, se generará con el job)
      const query = `
        INSERT INTO anuncios (
          fecha,
          frase,
          imagen_url,
          proyecto_nombre,
          equipo,
          tipo_anuncio,
          activo
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;

      const placeholderUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763171532/logo_web_blanco_j8xeyh.png';
      const values = [
        hoy.toISOString().split('T')[0],
        frase,
        placeholderUrl,
        proyecto.nombre,
        proyecto.equipoHora,
        'proyecto'
      ];

      const result = await db.query(query, values);
      anunciosGenerados.push(result.rows[0]);
    }

    res.json({
      success: true,
      data: anunciosGenerados,
      proyectosEncontrados: proyectos.length,
      message: `${anunciosGenerados.length} anuncios generados desde el calendario`
    });

  } catch (error) {
    console.error('Error al generar anuncios desde calendario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar anuncios desde calendario',
      error: error.message
    });
  }
};

/**
 * Incrementar contador de vistas
 * POST /api/anuncios/:id/vista
 */
export const incrementarVista = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('SELECT incrementar_vistas_anuncio($1)', [id]);

    res.json({
      success: true,
      message: 'Vista registrada'
    });

  } catch (error) {
    console.error('Error al incrementar vista:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar vista',
      error: error.message
    });
  }
};

/**
 * Desactivar anuncio
 * PUT /api/anuncios/:id/desactivar
 */
export const desactivarAnuncio = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'UPDATE anuncios SET activo = false WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Anuncio no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Anuncio desactivado'
    });

  } catch (error) {
    console.error('Error al desactivar anuncio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar anuncio',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de anuncios
 * GET /api/anuncios/stats
 */
export const obtenerEstadisticas = async (req, res) => {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE activo = true) as activos,
        COUNT(*) FILTER (WHERE fecha = CURRENT_DATE) as hoy,
        SUM(vistas) as vistas_totales,
        COUNT(DISTINCT fecha) as dias_con_anuncios
      FROM anuncios
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows[0]
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

export default {
  obtenerAnunciosActivos,
  obtenerAnunciosHoy,
  generarAnuncioManual,
  generarAnunciosDesdeCalendario,
  incrementarVista,
  desactivarAnuncio,
  obtenerEstadisticas
};
