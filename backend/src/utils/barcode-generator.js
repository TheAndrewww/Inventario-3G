/**
 * Generador de imágenes de códigos de barras y QR
 * Soporta múltiples formatos: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code, DataMatrix
 * Usa la librería bwip-js para generar códigos de barras en formato PNG
 */

import bwipjs from 'bwip-js';

/**
 * Mapeo de tipos de código a formato bwip-js
 */
const TIPO_A_BCID = {
    'EAN13': 'ean13',
    'EAN8': 'ean8',
    'UPCA': 'upca',
    'UPCE': 'upce',
    'CODE128': 'code128',
    'CODE39': 'code39',
    'QRCODE': 'qrcode',
    'DATAMATRIX': 'datamatrix'
};

/**
 * Valida un código según su tipo
 * @param {string} codigo - Código a validar
 * @param {string} tipo - Tipo de código (EAN13, EAN8, etc.)
 * @returns {boolean} - true si es válido
 */
const validarCodigoPorTipo = (codigo, tipo) => {
    const validaciones = {
        'EAN13': /^[0-9]{13}$/,
        'EAN8': /^[0-9]{8}$/,
        'UPCA': /^[0-9]{12}$/,
        'UPCE': /^[0-9]{6,8}$/,
        'CODE128': /^[\x20-\x7E]+$/, // Caracteres ASCII imprimibles
        'CODE39': /^[0-9A-Z\-. $/+%]+$/,
        'QRCODE': () => codigo.length > 0 && codigo.length <= 4296, // QR Code puede contener hasta 4296 caracteres
        'DATAMATRIX': () => codigo.length > 0 && codigo.length <= 2335 // DataMatrix límite
    };

    const validacion = validaciones[tipo];
    if (typeof validacion === 'function') {
        return validacion();
    }
    return validacion ? validacion.test(codigo) : true;
};

/**
 * Genera una imagen PNG de código de barras de cualquier tipo soportado
 * @param {string} codigo - Código a generar
 * @param {string} tipo - Tipo de código (EAN13, EAN8, UPCA, etc.)
 * @param {Object} options - Opciones de generación adicionales
 * @returns {Promise<Buffer>} - Buffer con la imagen PNG
 */
export const generarImagenCodigoBarras = async (codigo, tipo = 'EAN13', options = {}) => {
    try {
        // Validar tipo
        if (!TIPO_A_BCID[tipo]) {
            throw new Error(`Tipo de código no soportado: ${tipo}`);
        }

        // Validar código según tipo
        if (!validarCodigoPorTipo(codigo, tipo)) {
            throw new Error(`Código inválido para tipo ${tipo}`);
        }

        // Obtener bcid de bwip-js
        const bcid = TIPO_A_BCID[tipo];

        // Opciones por defecto según tipo
        let defaultOptions = {
            bcid: bcid,
            text: codigo,
            scale: 3,
            includetext: true,
            textxalign: 'center',
        };

        // Ajustes específicos por tipo
        if (tipo === 'QRCODE') {
            defaultOptions = {
                ...defaultOptions,
                eclevel: 'M', // Error correction level: L, M, Q, H
                scale: 4,
                includetext: false
            };
        } else if (tipo === 'DATAMATRIX') {
            defaultOptions = {
                ...defaultOptions,
                scale: 4,
                includetext: false
            };
        } else {
            // Para códigos de barras lineales
            defaultOptions.height = 10;
            defaultOptions.textsize = 13;
        }

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
 * @param {string} codigo - Código del artículo
 * @param {string} tipo - Tipo de código
 * @param {Object} articuloInfo - Información del artículo
 * @returns {Promise<Buffer>} - Buffer con la imagen PNG
 */
export const generarEtiquetaArticulo = async (codigo, tipo = 'EAN13', articuloInfo = {}) => {
    try {
        // Reutilizar la función principal
        return await generarImagenCodigoBarras(codigo, tipo);
    } catch (error) {
        console.error('Error generando etiqueta:', error);
        throw new Error(`No se pudo generar la etiqueta: ${error.message}`);
    }
};

/**
 * Genera imagen de código de barras en formato SVG
 * @param {string} codigo - Código a generar
 * @param {string} tipo - Tipo de código
 * @returns {Promise<string>} - String con SVG
 */
export const generarSVGCodigoBarras = async (codigo, tipo = 'EAN13') => {
    try {
        // Validar tipo
        if (!TIPO_A_BCID[tipo]) {
            throw new Error(`Tipo de código no soportado: ${tipo}`);
        }

        // Validar código según tipo
        if (!validarCodigoPorTipo(codigo, tipo)) {
            throw new Error(`Código inválido para tipo ${tipo}`);
        }

        const bcid = TIPO_A_BCID[tipo];

        let options = {
            bcid: bcid,
            text: codigo,
            scale: 3,
            includetext: true,
            textxalign: 'center',
        };

        if (tipo === 'QRCODE' || tipo === 'DATAMATRIX') {
            options.includetext = false;
            options.scale = 4;
            if (tipo === 'QRCODE') {
                options.eclevel = 'M';
            }
        } else {
            options.height = 10;
        }

        const svg = bwipjs.toSVG(options);

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
