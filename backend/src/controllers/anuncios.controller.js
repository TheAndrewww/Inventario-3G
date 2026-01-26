import db from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { generarImagenAnuncio, generarFrasesDesdeProyectos, obtenerImagenTensito } from '../services/geminiAnuncios.service.js';
import { subirImagenAnuncio, eliminarImagenAnuncio } from '../services/cloudinaryAnuncios.service.js';
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
 * Generar anuncios desde calendario (detección automática)
 * POST /api/anuncios/generar-desde-calendario
 * Busca automáticamente la palabra "ANUNCIOS" en columnas W-Z
 */
export const generarAnunciosDesdeCalendario = async (req, res) => {
  try {
    const hoy = new Date();
    const mes = MESES[hoy.getMonth()];

    console.log(`🎯 Generando anuncios desde calendario para ${mes} (detección automática)`);

    // Leer anuncios buscando la palabra "ANUNCIOS"
    const resultado = await leerAnunciosCalendario(mes);
    const anunciosCalendario = resultado.data.anuncios;

    if (anunciosCalendario.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: resultado.warning || 'No hay anuncios en el calendario',
        anunciosEncontrados: 0,
        filaEncontrada: resultado.data.filaEncontrada || null
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

        // Subir imagen a Cloudinary para respaldo
        console.log(`☁️ Subiendo imagen a Cloudinary...`);
        const cloudinaryUrl = await subirImagenAnuncio(imagenDataUrl, {
          folder: 'anuncios',
          public_id: `anuncio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        console.log(`✅ Imagen subida a Cloudinary: ${cloudinaryUrl}`);

        // Insertar en base de datos con la URL de Cloudinary
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
            imagenUrl: cloudinaryUrl, // Usar URL de Cloudinary en lugar de data URL
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

/**
 * Regenerar un anuncio individual
 * POST /api/anuncios/:id/regenerar
 * Genera una nueva imagen para un anuncio existente usando la misma frase
 */
export const regenerarAnuncio = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el anuncio actual
    const [anuncioActual] = await db.query(
      'SELECT * FROM anuncios WHERE id = :id',
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    if (!anuncioActual) {
      return res.status(404).json({
        success: false,
        message: 'Anuncio no encontrado'
      });
    }

    console.log(`🔄 Regenerando anuncio ID ${id}: "${anuncioActual.frase}"`);

    // Descargar imagen de Tensito
    console.log('🤖 Descargando imagen de Tensito...');
    const tensito = await obtenerImagenTensito();

    // Generar nueva imagen con la misma frase
    console.log(`🎨 Generando nueva imagen para: "${anuncioActual.frase}"`);
    const imagenDataUrl = await generarImagenAnuncio(
      anuncioActual.frase,
      tensito.base64,
      tensito.mimeType
    );
    console.log(`✅ Nueva imagen generada para anuncio ID ${id}`);

    // Subir nueva imagen a Cloudinary
    console.log(`☁️ Subiendo nueva imagen a Cloudinary...`);
    const cloudinaryUrl = await subirImagenAnuncio(imagenDataUrl, {
      folder: 'anuncios',
      public_id: `anuncio_${id}_regen_${Date.now()}`
    });
    console.log(`✅ Nueva imagen subida a Cloudinary: ${cloudinaryUrl}`);

    // Intentar eliminar imagen anterior de Cloudinary si era una URL de Cloudinary
    if (anuncioActual.imagen_url && anuncioActual.imagen_url.includes('cloudinary.com')) {
      try {
        // Extraer public_id de la URL de Cloudinary
        const urlParts = anuncioActual.imagen_url.split('/');
        const publicIdWithExt = urlParts.slice(-2).join('/').replace('/anuncios/', 'anuncios/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
        console.log(`🗑️ Eliminando imagen anterior de Cloudinary: ${publicId}`);
        await eliminarImagenAnuncio(publicId);
      } catch (deleteError) {
        console.warn(`⚠️ No se pudo eliminar imagen anterior: ${deleteError.message}`);
      }
    }

    // Actualizar el anuncio con la nueva URL de Cloudinary
    const updateQuery = `
      UPDATE anuncios 
      SET imagen_url = :imagenUrl, updated_at = NOW()
      WHERE id = :id
      RETURNING *
    `;

    const [result] = await db.query(updateQuery, {
      replacements: { id, imagenUrl: cloudinaryUrl },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: result[0] || anuncioActual,
      message: 'Anuncio regenerado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al regenerar anuncio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al regenerar anuncio',
      error: error.message
    });
  }
};

/**
 * Leer anuncios del calendario SIN generar imágenes
 * GET /api/anuncios/leer-calendario
 * Retorna los anuncios del spreadsheet y los compara con los ya generados en BD
 * También DESACTIVA anuncios de BD que ya no estén en el spreadsheet
 */
export const leerAnunciosDelCalendario = async (req, res) => {
  try {
    const hoy = new Date();
    const mes = MESES[hoy.getMonth()];
    const fechaHoy = hoy.toISOString().split('T')[0];

    console.log(`📖 Leyendo anuncios del calendario para ${mes} (solo lectura)`);
    console.log(`📅 Fecha de hoy: ${fechaHoy}`);

    // Leer anuncios del spreadsheet
    const resultado = await leerAnunciosCalendario(mes);
    const anunciosCalendario = resultado.data.anuncios || [];
    console.log(`📋 Anuncios en spreadsheet: ${anunciosCalendario.length}`);

    // Obtener anuncios ya generados de hoy de la BD
    const anunciosGenerados = await db.query(
      `SELECT id, frase, imagen_url, proyecto_nombre, equipo, fecha, activo 
       FROM anuncios 
       WHERE fecha = :fecha AND activo = true
       ORDER BY created_at DESC`,
      {
        replacements: { fecha: fechaHoy },
        type: QueryTypes.SELECT
      }
    );

    console.log(`💾 Anuncios activos en BD para hoy: ${anunciosGenerados?.length || 0}`);

    // Debug: mostrar frases de BD
    if (anunciosGenerados && anunciosGenerados.length > 0) {
      console.log('📝 Frases en BD:');
      anunciosGenerados.forEach((a, i) => {
        console.log(`   ${i + 1}. "${a.frase?.substring(0, 50)}..."`);
      });
    }

    // Crear set de frases del calendario (COMPARACIÓN EXACTA)
    const frasesEnCalendario = new Set();
    anunciosCalendario.forEach(a => {
      if (a.textoAnuncio) {
        frasesEnCalendario.add(a.textoAnuncio.trim());
      }
    });

    console.log(`📋 Frases únicas en calendario: ${frasesEnCalendario.size}`);

    // Crear un mapa de frases generadas para comparar (EXACTO)
    const frasesGeneradas = new Map();
    const anunciosADesactivar = [];

    if (Array.isArray(anunciosGenerados) && anunciosGenerados.length > 0) {
      anunciosGenerados.forEach(a => {
        if (a.frase) {
          const fraseExacta = a.frase.trim();
          frasesGeneradas.set(fraseExacta, a);

          // Si el anuncio generado NO está EXACTAMENTE en el calendario, desactivar
          if (!frasesEnCalendario.has(fraseExacta)) {
            console.log(`❌ Frase en BD no encontrada en calendario: "${fraseExacta.substring(0, 40)}..."`);
            anunciosADesactivar.push(a.id);
          } else {
            console.log(`✅ Frase coincide exactamente: "${fraseExacta.substring(0, 40)}..."`);
          }
        }
      });
    }

    // Desactivar anuncios que ya no están en el calendario
    if (anunciosADesactivar.length > 0) {
      console.log(`🗑️ Desactivando ${anunciosADesactivar.length} anuncios que ya no coinciden`);
      await db.query(
        `UPDATE anuncios SET activo = false WHERE id IN (:ids)`,
        {
          replacements: { ids: anunciosADesactivar },
          type: QueryTypes.UPDATE
        }
      );
      console.log(`✅ Anuncios desactivados correctamente`);
    } else {
      console.log(`ℹ️ No hay anuncios para desactivar`);
    }

    // Combinar: marcar cuáles están generados y cuáles no (EXACTO)
    const anunciosCombinados = anunciosCalendario.map(anuncioSheet => {
      const fraseExacta = anuncioSheet.textoAnuncio?.trim() || '';
      const generado = frasesGeneradas.get(fraseExacta);

      return {
        textoAnuncio: anuncioSheet.textoAnuncio,
        proyecto: anuncioSheet.proyecto,
        equipo: anuncioSheet.equipo,
        categoria: anuncioSheet.categoria,
        generado: !!generado,
        id: generado?.id || null,
        imagen_url: generado?.imagen_url || null
      };
    });

    const pendientes = anunciosCombinados.filter(a => !a.generado).length;
    console.log(`📊 Resumen: ${anunciosCombinados.length} total, ${anunciosCombinados.length - pendientes} generados, ${pendientes} pendientes`);

    const totalGeneradosActivos = Array.isArray(anunciosGenerados)
      ? anunciosGenerados.length - anunciosADesactivar.length
      : 0;

    res.json({
      success: true,
      data: {
        anunciosCalendario: anunciosCombinados,
        totalEnCalendario: anunciosCalendario.length,
        totalGenerados: totalGeneradosActivos,
        anunciosDesactivados: anunciosADesactivar.length,
        filaEncontrada: resultado.data.filaEncontrada
      },
      mes: mes
    });

  } catch (error) {
    console.error('❌ Error al leer anuncios del calendario:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error al leer anuncios del calendario',
      error: error.message
    });
  }
};

/**
 * Generar un solo anuncio desde texto (con Tensito)
 * POST /api/anuncios/generar-individual
 * Body: { textoAnuncio, proyecto, equipo }
 */
export const generarAnuncioIndividual = async (req, res) => {
  try {
    const { textoAnuncio, proyecto, equipo } = req.body;

    if (!textoAnuncio) {
      return res.status(400).json({
        success: false,
        message: 'El texto del anuncio es requerido'
      });
    }

    console.log(`🎨 Generando anuncio individual: "${textoAnuncio}"`);

    // Descargar imagen de Tensito
    console.log('🤖 Descargando imagen de Tensito...');
    const tensito = await obtenerImagenTensito();
    console.log('✅ Tensito descargado');

    // Generar imagen con IA
    console.log('🖼️ Generando imagen con IA...');
    const imagenDataUrl = await generarImagenAnuncio(
      textoAnuncio,
      tensito.base64,
      tensito.mimeType
    );
    console.log(`✅ Imagen generada para: "${textoAnuncio}"`);

    // Subir imagen a Cloudinary para respaldo
    console.log(`☁️ Subiendo imagen a Cloudinary...`);
    const cloudinaryUrl = await subirImagenAnuncio(imagenDataUrl, {
      folder: 'anuncios',
      public_id: `anuncio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    console.log(`✅ Imagen subida a Cloudinary: ${cloudinaryUrl}`);

    // Insertar en base de datos con URL de Cloudinary
    const hoy = new Date();
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

    console.log('💾 Guardando en base de datos...');
    const result = await db.query(query, {
      replacements: {
        fecha: hoy.toISOString().split('T')[0],
        frase: textoAnuncio,
        imagenUrl: cloudinaryUrl, // Usar URL de Cloudinary en lugar de data URL
        proyectoNombre: proyecto || null,
        equipo: equipo || null,
        tipoAnuncio: 'calendario'
      },
      type: QueryTypes.INSERT
    });

    console.log('✅ Anuncio guardado en BD');

    res.json({
      success: true,
      data: result[0] ? result[0][0] : null,
      message: 'Anuncio generado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al generar anuncio individual:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error al generar anuncio',
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
  obtenerEstadisticas,
  regenerarAnuncio,
  leerAnunciosDelCalendario,
  generarAnuncioIndividual
};


