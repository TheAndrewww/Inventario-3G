import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Genera un código QR para un artículo
 * @param {Object} articulo - Objeto con información del artículo
 * @param {string} articulo.id - ID del artículo
 * @param {string} articulo.nombre - Nombre del artículo
 * @returns {Promise<Object>} - Objeto con datos del QR y path del archivo
 */
export const generarQRArticulo = async (articulo) => {
    try {
        const { id, nombre } = articulo;

        // Crear objeto con datos del QR
        const qrData = {
            id: id.toString(),
            type: 'articulo',
            timestamp: new Date().toISOString(),
            checksum: generarChecksum(id)
        };

        // Convertir a JSON
        const qrString = JSON.stringify(qrData);

        // Generar código QR como Data URL (base64)
        const qrDataURL = await QRCode.toDataURL(qrString, {
            errorCorrectionLevel: 'H', // Alto nivel de corrección para impresión
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // También generar como archivo (opcional, para guardar en disco)
        const uploadsDir = join(__dirname, '../../uploads/qr');

        // Crear directorio si no existe
        await fs.mkdir(uploadsDir, { recursive: true });

        const fileName = `qr-${id}-${Date.now()}.png`;
        const filePath = join(uploadsDir, fileName);

        // Guardar QR como archivo PNG
        await QRCode.toFile(filePath, qrString, {
            errorCorrectionLevel: 'H',
            width: 300,
            margin: 2
        });

        return {
            success: true,
            qrData: qrString,
            qrDataURL, // Base64 data URL
            qrFilePath: `/uploads/qr/${fileName}`, // Path relativo para la API
            qrAbsolutePath: filePath // Path absoluto en el servidor
        };

    } catch (error) {
        console.error('Error generando QR:', error);
        throw new Error('No se pudo generar el código QR');
    }
};

/**
 * Genera un checksum simple para validar el QR
 * @param {string|number} id - ID del artículo
 * @returns {string} - Checksum de 6 caracteres
 */
const generarChecksum = (id) => {
    const str = id.toString() + new Date().getTime();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
};

/**
 * Valida que un código QR sea válido
 * @param {string} qrString - String JSON del QR
 * @returns {Object} - Datos validados del QR
 */
export const validarQR = (qrString) => {
    try {
        const qrData = JSON.parse(qrString);

        if (!qrData.id || !qrData.type || qrData.type !== 'articulo') {
            throw new Error('QR inválido');
        }

        return {
            valid: true,
            data: qrData
        };

    } catch (error) {
        return {
            valid: false,
            error: 'Código QR inválido o corrupto'
        };
    }
};

/**
 * Genera QR como buffer (útil para PDFs)
 * @param {Object} articulo - Objeto con información del artículo
 * @returns {Promise<Buffer>} - Buffer del QR
 */
export const generarQRBuffer = async (articulo) => {
    try {
        const qrData = {
            id: articulo.id.toString(),
            type: 'articulo',
            timestamp: new Date().toISOString(),
            checksum: generarChecksum(articulo.id)
        };

        const qrString = JSON.stringify(qrData);

        // Generar QR como buffer
        const buffer = await QRCode.toBuffer(qrString, {
            errorCorrectionLevel: 'H',
            width: 300,
            margin: 2
        });

        return buffer;

    } catch (error) {
        console.error('Error generando QR buffer:', error);
        throw new Error('No se pudo generar el código QR');
    }
};

export default {
    generarQRArticulo,
    validarQR,
    generarQRBuffer
};
