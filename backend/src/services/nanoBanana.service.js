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
 * Detecta si el artículo tiene dimensiones/medidas en su nombre o descripción
 * Ejemplos: "1/4", "3/8", "20cm", "5mm", "M10", etc.
 */
const tieneDimensiones = (nombre, descripcion) => {
    const texto = `${nombre} ${descripcion}`.toLowerCase();

    // Patrones comunes de dimensiones
    const patronesDimensiones = [
        /\d+\/\d+/,           // Fracciones: 1/4, 3/8, etc.
        /\d+\s*(mm|cm|m|pulg|"|')/i,  // Unidades: 20mm, 5cm, 3", etc.
        /m\d+/i,              // Roscas métricas: M10, M8, etc.
        /\d+x\d+/,            // Dimensiones: 10x20, 5x8, etc.
        /#\d+/,               // Números de calibre: #8, #10, etc.
        /\d+\s*(kg|g|lb)/i    // Pesos: 5kg, 10lb, etc.
    ];

    return patronesDimensiones.some(patron => patron.test(texto));
};

/**
 * Genera un prompt dinámico basado en la metadata del artículo
 * @param {Object} metadata - Información del artículo (nombre, descripción, unidad)
 * @returns {string} - Prompt personalizado
 */
const generarPrompt = (metadata = {}) => {
    const { nombre, descripcion, unidad } = metadata;

    // Prompt base
    let prompt = `Genera una imagen de catálogo profesional de alta calidad basada en esta foto de producto.`;

    // Agregar contexto del artículo si está disponible
    if (nombre) {
        prompt += ` El producto es: "${nombre}".`;
    }

    if (descripcion) {
        prompt += ` Descripción: "${descripcion}".`;
    }

    // Detectar si tiene dimensiones y agregar líneas de señalamiento
    const tieneMedidas = tieneDimensiones(nombre || '', descripcion || '');

    if (tieneMedidas) {
        prompt += `\n\nEste artículo tiene especificaciones de tamaño/medidas. IMPORTANTE: Agrega líneas de señalamiento (líneas de acotación o cotas) profesionales que indiquen las dimensiones principales del producto. Las líneas deben ser de grosor medio-grueso, en color rojo vibrante (#FF0000 o #E30613), con flechas pequeñas en los extremos, ubicadas estratégicamente sin obstruir el producto. Estilo técnico de dibujo industrial pero minimalista.`;
    }

    // Instrucciones generales
    prompt += `\n\nInstrucciones generales:
- Si la imagen contiene múltiples piezas idénticas, muestra SOLO UNA UNIDAD representativa centrada
- Mantén el objeto EXACTAMENTE igual: misma forma, color, textura y proporciones originales
- Mejora la iluminación para que parezca fotografía de estudio profesional de alta calidad tipo e-commerce
- Fondo completamente blanco puro (#FFFFFF), limpio, uniforme, sin sombras duras ni ruido
- Estilo fotorrealista con acabado nítido, enfoque perfecto y calidad fotográfica profesional
- NO modifiques el diseño del artículo ni agregues elementos decorativos
- Solo mejora la presentación fotográfica del producto para inventario/catálogo`;

    if (unidad) {
        prompt += `\n- Unidad de medida del producto: ${unidad}`;
    }

    prompt += `\n\nGenera la imagen en alta resolución con calidad de catálogo profesional.`;

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
 * @param {string} options.unidad - Unidad de medida del artículo (opcional)
 * @returns {Promise<Buffer>} - Buffer de la imagen procesada
 */
export const procesarImagenConNanoBanana = async (imageBuffer, options = {}) => {
    if (!isNanoBananaEnabled()) {
        throw new Error('Gemini no está configurado. Agrega GEMINI_API_KEY en las variables de entorno.');
    }

    try {
        const { imageName = 'image.jpg', nombre, descripcion, unidad } = options;

        console.log(`✨ Iniciando procesamiento con Gemini (${GEMINI_MODEL}): ${imageName}`);
        if (nombre) {
            console.log(`   📦 Artículo: ${nombre}`);
        }

        // Generar prompt dinámico basado en metadata
        const prompt = generarPrompt({ nombre, descripcion, unidad });

        // Log del prompt generado (solo primeros 200 caracteres)
        console.log(`   📝 Prompt generado: ${prompt.substring(0, 200)}...`);

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
 * @param {Object} metadata - Información del artículo (nombre, descripción, unidad)
 * @returns {Promise<Buffer>} - Buffer de la imagen procesada
 */
export const procesarImagenDesdeUrl = async (imageUrl, metadata = {}) => {
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

        // Procesar con Gemini usando metadata del artículo
        return await procesarImagenConNanoBanana(imageBuffer, {
            imageName: 'existing-image.jpg',
            ...metadata
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
