import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Servicio para generar imágenes de anuncios usando Gemini AI
 */

/**
 * Generar imagen de anuncio con IA
 * @param {string} frase - Texto del anuncio
 * @param {string} mascotBase64 - Imagen de mascota en base64 (opcional)
 * @param {string} mascotMimeType - MIME type de la imagen de mascota
 * @returns {Promise<string>} - Imagen generada en base64
 */
export const generarImagenAnuncio = async (frase, mascotBase64 = null, mascotMimeType = 'image/png') => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Usar modelo con capacidad de generación de imágenes
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro'
    });

    // Prompt optimizado para generar anuncios de 3G Velarias
    const prompt = `
Genera una imagen publicitaria profesional de alta calidad en formato horizontal (16:9).

CONTEXTO:
Es un anuncio corporativo para 3G VELARIAS, empresa mexicana líder en construcción de tensoestructuras, velarías y membranas arquitectónicas.

${mascotBase64 ? `PERSONAJE PRINCIPAL (MANDATORIO):
La imagen DEBE incluir al personaje mascota "Tensito" (un robot plateado con chaleco naranja de seguridad y gorra que dice "3G").
El personaje debe estar realizando una acción relacionada con: "${frase}".` : ''}

TEMA CENTRAL:
"${frase}"

El anuncio debe transmitir:
- Profesionalismo y calidad
- Innovación tecnológica
- Seguridad industrial
- Construcción moderna

ESTILO VISUAL:
- Renderizado 3D vibrante y moderno
- Iluminación profesional tipo estudio
- Colores corporativos: Naranja (#FF6B00), Blanco, Gris
- Fondo relacionado con construcción/arquitectura moderna
- Composición limpia y clara
- Tipografía moderna y legible para el texto "${frase}"

FORMATO:
- Aspecto: 16:9 (horizontal)
- Calidad: Alta resolución
- Uso: Pantallas digitales corporativas
`;

    const parts = [{ text: prompt }];

    // Agregar imagen de mascota si está disponible
    if (mascotBase64) {
      parts.push({
        inlineData: {
          mimeType: mascotMimeType,
          data: mascotBase64
        }
      });
    }

    const result = await model.generateContent({
      contents: [{ parts }]
    });

    const response = await result.response;
    const text = response.text();

    // Nota: Gemini 1.5 Pro genera descripciones de imágenes, no las imágenes directamente
    // Para generación de imágenes, necesitarías usar Imagen 3 o un servicio diferente
    // Por ahora, retornamos el texto descriptivo que podría usarse con otro servicio

    console.log('✅ Descripción de imagen generada con Gemini');
    return text;

  } catch (error) {
    console.error('❌ Error al generar imagen con Gemini:', error);
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
  generarFrasesDesdeProyectos
};
