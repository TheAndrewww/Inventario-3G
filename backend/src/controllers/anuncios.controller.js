import db from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { generarImagenAnuncio, generarFrasesDesdeProyectos, obtenerImagenTensito } from '../services/geminiAnuncios.service.js';
import { subirImagenAnuncio } from '../services/cloudinaryAnuncios.service.js';
import { leerCalendarioMes, obtenerProyectosDia, leerAnunciosCalendario } from '../services/googleSheets.service.js';

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

    const [results] = await db.query(query);

    res.json({
      success: true,
      data: results,
      total: results.length
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

    const [results] = await db.query(query);

    // Si no hay anuncios de hoy, devolver los más recientes
    if (results.length === 0) {
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

      const [resultsRecientes] = await db.query(queryRecientes);

      return res.json({
        success: true,
        data: resultsRecientes,
        total: resultsRecientes.length,
        mensaje: 'No hay anuncios de hoy, mostrando recientes'
      });
    }

    res.json({
      success: true,
      data: results,
      total: results.length
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
      ) VALUES (:fecha, :frase, :imagenUrl, :proyectoNombre, :equipo, :tipoAnuncio, true)
      RETURNING *
    `;

    const fechaAnuncio = fecha || new Date().toISOString().split('T')[0];

    const [result] = await db.query(query, {
      replacements: {
        fecha: fechaAnuncio,
        frase,
        imagenUrl,
        proyectoNombre,
        equipo,
        tipoAnuncio: 'manual'
      },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: {
        anuncio: result[0],
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
 * Generar anuncios desde calendario (rango dinámico)
 * POST /api/anuncios/generar-desde-calendario
 * Body: { rango: "W50:Z52" } (opcional, default: W20:Z23)
 */
export const generarAnunciosDesdeCalendario = async (req, res) => {
  try {
    const hoy = new Date();
    const mes = MESES[hoy.getMonth()];
    const { rango = 'W20:Z23' } = req.body;

    console.log(`🎯 Generando anuncios desde calendario para ${mes}, rango: ${rango}`);

    // Leer anuncios del rango especificado
    const resultado = await leerAnunciosCalendario(mes, rango);
    const anunciosCalendario = resultado.data.anuncios;

    if (anunciosCalendario.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: `No hay anuncios en el rango ${rango} del calendario`,
        anunciosEncontrados: 0
      });
    }

    // Descargar imagen de Tensito UNA SOLA VEZ para usarla en todos los anuncios
    console.log('🤖 Descargando imagen de Tensito para incluirla en todos los anuncios...');
    const tensito = await obtenerImagenTensito();

    // Desactivar anuncios viejos antes de generar nuevos
    console.log('🧹 Desactivando anuncios viejos del calendario...');
    await db.query(
      `UPDATE anuncios SET activo = false WHERE tipo_anuncio = 'calendario' AND activo = true`,
      { type: QueryTypes.UPDATE }
    );

    const anunciosGenerados = [];

    // Generar imagen para cada anuncio con IA
    for (const anuncio of anunciosCalendario) {
      console.log(`🎨 Generando imagen para: "${anuncio.textoAnuncio}" con Tensito`);

      try {
        // Generar imagen con Gemini 3 Pro (Nano Banana Pro) CON TENSITO
        // La función ahora retorna la imagen generada como data URL
        const imagenDataUrl = await generarImagenAnuncio(
          anuncio.textoAnuncio,
          tensito.base64,  // Pasar imagen de Tensito
          tensito.mimeType // Pasar MIME type de Tensito
        );
        console.log(`✅ Imagen generada con IA para: "${anuncio.textoAnuncio}"`);

        // Insertar en base de datos con la imagen generada
        const query = `
          INSERT INTO anuncios (
            fecha,
            frase,
            imagen_url,
            proyecto_nombre,
            equipo,
            tipo_anuncio,
            activo
          ) VALUES (:fecha, :frase, :imagenUrl, :proyectoNombre, :equipo, :tipoAnuncio, true)
          RETURNING *
        `;

        const [result] = await db.query(query, {
          replacements: {
            fecha: hoy.toISOString().split('T')[0],
            frase: anuncio.textoAnuncio,
            imagenUrl: imagenDataUrl, // Usar imagen generada por IA
            proyectoNombre: anuncio.proyecto || null,
            equipo: anuncio.equipo || null,
            tipoAnuncio: 'calendario'
          },
          type: QueryTypes.SELECT
        });

        anunciosGenerados.push(result[0]);

      } catch (errorAnuncio) {
        console.error(`❌ Error generando anuncio "${anuncio.textoAnuncio}":`, errorAnuncio.message);
        // Continuar con el siguiente anuncio
      }
    }

    res.json({
      success: true,
      data: anunciosGenerados,
      anunciosEncontrados: anunciosCalendario.length,
      anunciosGenerados: anunciosGenerados.length,
      message: `${anunciosGenerados.length} anuncios generados desde el calendario con Tensito`
    });

  } catch (error) {
    console.error('❌ Error al generar anuncios desde calendario:', error);
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

    await db.query('SELECT incrementar_vistas_anuncio(:id)', {
      replacements: { id },
      type: QueryTypes.SELECT
    });

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

    const query = 'UPDATE anuncios SET activo = false WHERE id = :id RETURNING *';
    const [result] = await db.query(query, {
      replacements: { id },
      type: QueryTypes.SELECT
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Anuncio no encontrado'
      });
    }

    res.json({
      success: true,
      data: result[0],
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

    const [result] = await db.query(query);

    res.json({
      success: true,
      data: result[0]
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
