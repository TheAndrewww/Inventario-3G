import cloudinary from '../config/cloudinary.js';

/**
 * Servicio para manejar imágenes de anuncios en Cloudinary
 */

/**
 * Subir imagen de anuncio a Cloudinary
 * @param {string} imageBase64 - Imagen en formato base64 o data URL
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - URL de la imagen en Cloudinary
 */
export const subirImagenAnuncio = async (imageBase64, options = {}) => {
  try {
    // Asegurar que tenemos el formato correcto de data URL
    let dataUrl = imageBase64;
    if (!imageBase64.startsWith('data:')) {
      dataUrl = `data:image/png;base64,${imageBase64}`;
    }

    const uploadOptions = {
      folder: options.folder || 'anuncios',
      public_id: options.public_id || undefined,
      transformation: [
        {
          width: 1920,
          height: 1080,
          crop: 'fill',
          quality: 'auto:best',
          fetch_format: 'auto'
        }
      ],
      ...options
    };

    const result = await cloudinary.uploader.upload(dataUrl, uploadOptions);

    console.log(`✅ Imagen subida a Cloudinary: ${result.public_id}`);

    return result.secure_url;

  } catch (error) {
    console.error('❌ Error al subir imagen a Cloudinary:', error);
    throw new Error(`Error en Cloudinary: ${error.message}`);
  }
};

/**
 * Eliminar imagen de anuncio de Cloudinary
 * @param {string} publicId - ID público de la imagen en Cloudinary
 * @returns {Promise<Object>} - Resultado de la eliminación
 */
export const eliminarImagenAnuncio = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️ Imagen eliminada de Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error('❌ Error al eliminar imagen de Cloudinary:', error);
    throw error;
  }
};

/**
 * Obtener todas las imágenes de anuncios
 * @param {number} max_results - Máximo de resultados
 * @returns {Promise<Array>} - Lista de imágenes
 */
export const obtenerImagenesAnuncios = async (max_results = 100) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'anuncios/',
      max_results,
      resource_type: 'image'
    });

    return result.resources;
  } catch (error) {
    console.error('❌ Error al obtener imágenes de Cloudinary:', error);
    throw error;
  }
};

/**
 * Limpiar imágenes antiguas de anuncios (más de 30 días)
 * @returns {Promise<number>} - Cantidad de imágenes eliminadas
 */
export const limpiarImagenesAntiguas = async () => {
  try {
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const imagenes = await obtenerImagenesAnuncios(500);
    let eliminadas = 0;

    for (const imagen of imagenes) {
      const fechaCreacion = new Date(imagen.created_at);

      if (fechaCreacion < hace30Dias) {
        await eliminarImagenAnuncio(imagen.public_id);
        eliminadas++;
      }
    }

    console.log(`🧹 Limpieza completada: ${eliminadas} imágenes antiguas eliminadas`);
    return eliminadas;

  } catch (error) {
    console.error('❌ Error al limpiar imágenes antiguas:', error);
    throw error;
  }
};

export default {
  subirImagenAnuncio,
  eliminarImagenAnuncio,
  obtenerImagenesAnuncios,
  limpiarImagenesAntiguas
};
