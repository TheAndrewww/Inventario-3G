/**
 * Generador de imágenes de códigos de barras EAN-13
 * Usa la librería bwip-js para generar códigos de barras en formato PNG
 */

import bwipjs from 'bwip-js';

/**
 * Genera una imagen PNG de código de barras EAN-13
 * @param {string} ean13 - Código EAN-13 (13 dígitos)
 * @param {Object} options - Opciones de generación
 * @returns {Promise<Buffer>} - Buffer con la imagen PNG
 */
export const generarImagenCodigoBarras = async (ean13, options = {}) => {
    try {
        // Validar que sea EAN-13
        if (!/^[0-9]{13}$/.test(ean13)) {
            throw new Error('El código debe tener exactamente 13 dígitos numéricos');
        }

        // Opciones por defecto
        const defaultOptions = {
            bcid: 'ean13',           // Tipo de código de barras
            text: ean13,             // El código a codificar
            scale: 3,                // Factor de escala (3x)
            height: 10,              // Altura de las barras en mm
            includetext: true,       // Incluir texto debajo del código
            textxalign: 'center',    // Alinear texto al centro
            textsize: 13,            // Tamaño del texto
        };

        // Combinar opciones
        const finalOptions = { ...defaultOptions, ...options };

        // Generar código de barras
        const png = await bwipjs.toBuffer(finalOptions);

        return png;
    } catch (error) {
        console.error('Error generando código de barras:', error);
        throw new Error(`No se pudo generar el código de barras: ${error.message}`);
    }
};

/**
 * Genera una imagen de código de barras con información adicional del artículo
 * Incluye nombre y otros datos en la etiqueta
 * @param {string} ean13 - Código EAN-13
 * @param {Object} articuloInfo - Información del artículo
 * @returns {Promise<Buffer>} - Buffer con la imagen PNG
 */
export const generarEtiquetaArticulo = async (ean13, articuloInfo = {}) => {
    try {
        const options = {
            bcid: 'ean13',
            text: ean13,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
            textsize: 13,
        };

        // Si hay información adicional, podemos agregarla
        // Por ahora, solo generamos el código de barras básico
        // En el futuro, se podría usar canvas para agregar más info

        const png = await bwipjs.toBuffer(options);
        return png;
    } catch (error) {
        console.error('Error generando etiqueta:', error);
        throw new Error(`No se pudo generar la etiqueta: ${error.message}`);
    }
};

/**
 * Genera imagen de código de barras en formato SVG
 * @param {string} ean13 - Código EAN-13
 * @returns {Promise<string>} - String con SVG
 */
export const generarSVGCodigoBarras = async (ean13) => {
    try {
        if (!/^[0-9]{13}$/.test(ean13)) {
            throw new Error('El código debe tener exactamente 13 dígitos numéricos');
        }

        const svg = bwipjs.toSVG({
            bcid: 'ean13',
            text: ean13,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });

        return svg;
    } catch (error) {
        console.error('Error generando SVG:', error);
        throw new Error(`No se pudo generar el código de barras SVG: ${error.message}`);
    }
};

export default {
    generarImagenCodigoBarras,
    generarEtiquetaArticulo,
    generarSVGCodigoBarras
};
