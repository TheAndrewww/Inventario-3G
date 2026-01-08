import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// URL de la imagen de Tensito en Cloudinary
const TENSITO_IMAGE_URL = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1767835739/ChatGPT_Image_23_dic_2025_02_55_06_p.m._n5xuul.png';

/**
 * Servicio para generar imágenes de anuncios usando Gemini AI
 */

/**
 * Descargar y convertir imagen de Tensito a base64
 * @returns {Promise<{base64: string, mimeType: string}>} - Imagen en base64 y su MIME type
 */
export const obtenerImagenTensito = async () => {
  try {
    console.log('📥 Descargando imagen de Tensito desde Cloudinary...');

    const response = await axios.get(TENSITO_IMAGE_URL, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 segundos
    });

    // Convertir a base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'] || 'image/png';

    console.log(`✅ Imagen de Tensito descargada exitosamente (${mimeType})`);

    return {
      base64,
      mimeType
    };
  } catch (error) {
    console.error('❌ Error al descargar imagen de Tensito:', error.message);
    throw new Error(`No se pudo descargar la imagen de Tensito: ${error.message}`);
  }
};

/**
 * Generar imagen de anuncio con IA
 * @param {string} frase - Texto del anuncio
 * @param {string} mascotBase64 - Imagen de mascota en base64 (opcional)
 * @param {string} mascotMimeType - MIME type de la imagen de mascota
 * @returns {Promise<string>} - Imagen generada en base64
 */
export const generarImagenAnuncio = async (frase, mascotBase64 = null, mascotMimeType = 'image/png') => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }

    console.log(`🎨 Generando imagen con Gemini (${GEMINI_MODEL}) para: "${frase}"`);

    // Prompt optimizado para generar anuncios de 3G Velarias
    const prompt = `
Genera una imagen publicitaria profesional de alta calidad en formato horizontal (16:9).

CONTEXTO:
Es un anuncio corporativo para 3G ARQUITECTURA TEXTIL, empresa mexicana líder en construcción de tensoestructuras, velarías y membranas arquitectónicas.

${mascotBase64 ? `PERSONAJE PRINCIPAL (MANDATORIO):
La imagen DEBE incluir al personaje mascota "Tensito" proporcionado en la imagen de referencia.
Es un robot plateado con chaleco naranja de seguridad y una gorra que dice "3G".
El personaje debe verse EXACTAMENTE como la referencia (Tensito), manteniendo su estilo 3D cartoon renderizado.
El personaje debe estar realizando una acción relacionada con la frase: "${frase}".` : ''}

TEXTO/TEMA:
El tema central es: "${frase}".
Si es posible, integra el texto "${frase}" de manera artística en el fondo o en un cartel dentro de la imagen, pero prioriza la calidad visual y la acción del personaje.

ESTILO:
Estilo de renderizado 3D vibrante, iluminación de estudio, fondo limpio o desenfocado relacionado con industria/oficina moderna.
Aspecto muy amigable y profesional.

El anuncio debe transmitir:
- Profesionalismo y calidad
- Innovación tecnológica
- Seguridad industrial
- Construcción moderna

COLORES CORPORATIVOS:
- ROJO (#C53131), Blanco, Gris

FORMATO:
- Aspecto: 16:9 (horizontal)
- Calidad: 2K o superior
- Uso: Pantallas digitales corporativas
`;

    // Construir partes del mensaje
    const parts = [
      {
        text: prompt
      }
    ];

    // Agregar imagen de mascota si está disponible
    if (mascotBase64) {
      parts.push({
        inline_data: {
          mime_type: mascotMimeType,
          data: mascotBase64
        }
      });
    }

    // Construir payload para Gemini (igual que nanoBanana.service.js)
    const payload = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        // CLAVE: responseModalities debe incluir "IMAGE" para generar imágenes
        responseModalities: ["IMAGE"],
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      }
    };

    // Llamar a Gemini con axios (igual que nanoBanana.service.js)
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 segundos para generación de imagen
      }
    );

    console.log(`✅ Respuesta recibida de Gemini`);

    // Extraer imagen de la respuesta (igual que nanoBanana.service.js)
    const candidate = response.data?.candidates?.[0];
    const responseParts = candidate?.content?.parts || [];

    // Buscar la imagen en todas las partes de la respuesta
    let imageData = null;
    for (const part of responseParts) {
      // Formato: inlineData (documentación oficial)
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        console.log(`✅ Imagen encontrada en formato inlineData (mime: ${part.inlineData.mimeType})`);
        break;
      }
      // Formato alternativo: inline_data
      if (part.inline_data?.data) {
        imageData = part.inline_data.data;
        console.log(`✅ Imagen encontrada en formato inline_data (mime: ${part.inline_data.mime_type})`);
        break;
      }
    }

    if (imageData) {
      console.log(`✅ Imagen generada exitosamente con Gemini (${GEMINI_MODEL})`);
      // Retornar como data URL para guardar en base de datos
      return `data:image/png;base64,${imageData}`;
    }

    // Si no se encontró imagen, verificar si hay texto
    const textPart = responseParts.find(p => p.text);
    if (textPart) {
      console.log('⚠️ Gemini devolvió texto en lugar de imagen:', textPart.text.substring(0, 200));
      console.log('💡 Tip: Verifica que responseModalities incluya "IMAGE" en generationConfig');
      throw new Error('Gemini devolvió descripción de texto en lugar de imagen generada');
    }

    // No se encontró ni imagen ni texto
    console.error('❌ Formato de respuesta inesperado. Estructura completa:', JSON.stringify(response.data, null, 2));
    throw new Error('Gemini no devolvió una imagen en el formato esperado');

  } catch (error) {
    console.error('❌ Error al generar imagen con Gemini:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    throw new Error(`Error en Gemini AI: ${error.message}`);
  }
};

/**
 * Generar múltiples variaciones de un anuncio
 * @param {string} frase - Texto base
 * @param {number} cantidad - Número de variaciones
 * @returns {Promise<Array>} - Array de descripciones
 */
export const generarVariacionesAnuncio = async (frase, cantidad = 3) => {
  const variaciones = [];

  for (let i = 0; i < cantidad; i++) {
    const descripcion = await generarImagenAnuncio(frase);
    variaciones.push({
      numero: i + 1,
      descripcion,
      frase
    });
  }

  return variaciones;
};

/**
 * Extraer frases de anuncios desde proyectos del calendario
 * @param {Array} proyectos - Array de proyectos del día
 * @returns {Array} - Frases para anuncios
 */
export const generarFrasesDesdeProyectos = (proyectos) => {
  if (!proyectos || proyectos.length === 0) {
    return ['3G VELARIAS - INNOVACIÓN EN TENSOESTRUCTURAS'];
  }

  return proyectos.map(proyecto => {
    const equipo = proyecto.equipoHora || 'I';
    const cliente = proyecto.cliente || '';
    const nombre = proyecto.nombre || '';

    if (cliente) {
      return `${nombre.toUpperCase()} - ${cliente.toUpperCase()} | EQUIPO ${equipo}`;
    }

    return `${nombre.toUpperCase()} | EQUIPO ${equipo} EN ACCIÓN`;
  });
};

export default {
  generarImagenAnuncio,
  generarVariacionesAnuncio,
  generarFrasesDesdeProyectos,
  obtenerImagenTensito
};
