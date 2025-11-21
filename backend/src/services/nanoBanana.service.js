/**
 * Servicio para integración con Gemini 3 Image Generation (Google AI)
 * Procesa imágenes de artículos para mejorar su calidad usando IA generativa
 */

import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Modelos disponibles:
// - gemini-2.5-flash-image: Rápido, 1024px (Nano Banana)
// - gemini-3-pro-image-preview: Profesional, hasta 4K
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Genera un prompt personalizado incluyendo metadata del artículo
 * @param {Object} metadata - Información del artículo
 * @returns {string} - Prompt optimizado
 */
const generarPrompt = (metadata = {}) => {
    const { nombre, descripcion } = metadata;

    let prompt = `Genera una imagen de catálogo profesional basada en esta foto de producto.`;

    // Agregar contexto del artículo para mejor precisión
    if (nombre) {
        prompt += ` El producto es: "${nombre}".`;
    }

    if (descripcion) {
        prompt += ` Descripción: "${descripcion}".`;
    }

    prompt += `\n\nInstrucciones:
- Si la imagen original contiene múltiples piezas idénticas del mismo artículo, muestra solo una unidad representativa centrada
- Mantén el objeto exactamente igual, respetando fielmente su forma, color, textura y proporciones originales
- Mejora la iluminación y la nitidez para que parezca una fotografía de producto de alta calidad tipo e-commerce
- Fondo completamente blanco (#FFFFFF), limpio y uniforme, sin sombras duras ni ruido
- Estilo fotorrealista con acabado nítido, enfoque perfecto y calidad fotográfica tipo estudio profesional
- NO modifiques el diseño del artículo ni agregues elementos extras (sin textos, sin líneas, sin anotaciones)
- Solo mejora la presentación fotográfica como producto profesional para inventario
- Genera la imagen en alta resolución con calidad de catálogo profesional`;

    return prompt;
};

/**
 * Verifica si Gemini 3 está configurado
 */
export const isNanoBananaEnabled = () => {
    const enabled = !!GEMINI_API_KEY;
    if (!enabled) {
        console.log('⚠️ Gemini (Nano Banana) no está configurado. Agrega GEMINI_API_KEY en .env');
    }
    return enabled;
};

/**
 * Procesa una imagen usando Gemini Image Generation
 * @param {Buffer} imageBuffer - Buffer de la imagen a procesar
 * @param {Object} options - Opciones de procesamiento
 * @param {string} options.imageName - Nombre del archivo (opcional)
 * @param {string} options.nombre - Nombre del artículo (opcional)
 * @param {string} options.descripcion - Descripción del artículo (opcional)
 * @returns {Promise<Buffer>} - Buffer de la imagen procesada
 */
export const procesarImagenConNanoBanana = async (imageBuffer, options = {}) => {
    if (!isNanoBananaEnabled()) {
        throw new Error('Gemini no está configurado. Agrega GEMINI_API_KEY en las variables de entorno.');
    }

    try {
        const { imageName = 'image.jpg', nombre, descripcion } = options;

        console.log(`✨ Iniciando procesamiento con Gemini (${GEMINI_MODEL}): ${imageName}`);
        if (nombre) {
            console.log(`   📦 Artículo: ${nombre}`);
        }

        // Generar prompt personalizado con metadata del artículo
        const prompt = generarPrompt({ nombre, descripcion });

        // Convertir buffer to base64
        const base64Image = imageBuffer.toString('base64');

        // Construir payload para Gemini
        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                // IMPORTANTE: responseModalities debe incluir "IMAGE" para que Gemini genere imágenes
                responseModalities: ["IMAGE"],
                temperature: 0.4,
                topK: 32,
                topP: 1,
                maxOutputTokens: 4096,
            }
        };

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

        // Debug: Ver estructura de la respuesta
        console.log('📋 Estructura de respuesta:', JSON.stringify(response.data, null, 2).substring(0, 1000));

        // Gemini devuelve la imagen en base64 en la respuesta
        // Puede estar en diferentes formatos: inlineData o inline_data
        const candidate = response.data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Buscar la imagen en todas las partes de la respuesta
        let imageData = null;
        for (const part of parts) {
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
            console.log(`✅ Imagen procesada exitosamente con Gemini (${GEMINI_MODEL})`);
            return Buffer.from(imageData, 'base64');
        }

        // Si no se encontró imagen, verificar si hay texto
        const textPart = parts.find(p => p.text);
        if (textPart) {
            console.log('⚠️ Gemini devolvió texto en lugar de imagen:', textPart.text.substring(0, 200));
            console.log('💡 Tip: Verifica que responseModalities incluya "IMAGE" en generationConfig');
            throw new Error('Gemini devolvió descripción de texto en lugar de imagen generada');
        }

        // No se encontró ni imagen ni texto
        console.error('❌ Formato de respuesta inesperado. Estructura completa:', JSON.stringify(response.data, null, 2));
        throw new Error('Gemini no devolvió una imagen en el formato esperado');

    } catch (error) {
        console.error('❌ Error al procesar con Gemini:', error.message);

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }

        throw new Error(`Error al procesar imagen con Gemini: ${error.message}`);
    }
};

/**
 * Procesa una imagen desde una URL usando Gemini
 * @param {string} imageUrl - URL de la imagen a procesar
 * @param {Object} options - Opciones de procesamiento (opcional)
 * @param {string} options.nombre - Nombre del artículo para logs (opcional)
 * @returns {Promise<Buffer>} - Buffer de la imagen procesada
 */
export const procesarImagenDesdeUrl = async (imageUrl, options = {}) => {
    if (!isNanoBananaEnabled()) {
        throw new Error('Gemini no está configurado. Agrega GEMINI_API_KEY en las variables de entorno.');
    }

    try {
        console.log(`✨ Descargando imagen desde URL para procesar: ${imageUrl}`);

        // Descargar imagen
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const imageBuffer = Buffer.from(imageResponse.data);

        // Procesar con Gemini
        return await procesarImagenConNanoBanana(imageBuffer, {
            imageName: 'existing-image.jpg',
            ...options
        });

    } catch (error) {
        console.error('❌ Error al procesar imagen desde URL:', error.message);
        throw new Error(`Error al procesar imagen desde URL: ${error.message}`);
    }
};

export default {
    procesarImagenConNanoBanana,
    procesarImagenDesdeUrl,
    isNanoBananaEnabled
};
