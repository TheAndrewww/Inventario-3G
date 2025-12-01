/**
 * Generador de etiquetas para artículos
 * Genera etiquetas de 3cm x 9cm con nombre del artículo y código de barras
 */

import pkg from 'pdfkit';
const PDFDocument = pkg;
import bwipjs from 'bwip-js';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

/**
 * Convierte cm a puntos (1 cm = 28.35 puntos)
 */
const cmToPoints = (cm) => cm * 28.35;

/**
 * Genera una imagen de código de barras según el tipo especificado
 * @param {string} codigo - El código a generar
 * @param {string} tipo - Tipo de código (EAN13, QRCODE, CODE128, CODE39, etc.)
 */
const generarCodigoBarrasBuffer = async (codigo, tipo = 'EAN13') => {
    try {
        if (!codigo) {
            console.error('⚠️  Código vacío, no se puede generar código de barras');
            return null;
        }

        // Mapear tipos de la BD a tipos de bwip-js
        const tipoMap = {
            'EAN13': 'ean13',
            'EAN8': 'ean8',
            'QRCODE': 'qrcode',
            'CODE128': 'code128',
            'CODE39': 'code39',
            'CODE93': 'code93',
            'DATAMATRIX': 'datamatrix',
            'PDF417': 'pdf417',
            'UPCA': 'upca',
            'UPCE': 'upce'
        };

        let bcid = tipoMap[tipo.toUpperCase()] || 'code128';

        // Validaciones específicas por tipo
        if (bcid === 'ean13') {
            const cleanCode = codigo.replace(/\D/g, ''); // Solo dígitos
            if (cleanCode.length !== 12 && cleanCode.length !== 13) {
                console.warn(`⚠️  Código EAN-13 inválido (${codigo}), usando CODE128 como fallback`);
                bcid = 'code128'; // Fallback a CODE128 que acepta cualquier texto
            }
        } else if (bcid === 'ean8') {
            const cleanCode = codigo.replace(/\D/g, '');
            if (cleanCode.length !== 7 && cleanCode.length !== 8) {
                console.warn(`⚠️  Código EAN-8 inválido (${codigo}), usando CODE128 como fallback`);
                bcid = 'code128';
            }
        }

        // Configuración base
        const config = {
            bcid: bcid,
            text: codigo,
            scale: 2,
            includetext: false
        };

        // Configuraciones específicas por tipo
        if (bcid === 'qrcode') {
            config.eclevel = 'M'; // Nivel de corrección de errores
            config.width = 50;
            config.height = 50;
        } else if (bcid === 'datamatrix') {
            config.width = 50;
            config.height = 50;
        } else {
            // Para códigos de barras lineales
            config.height = 8;
        }

        const png = await bwipjs.toBuffer(config);
        return png;
    } catch (error) {
        console.error(`⚠️  Error generando código ${tipo} con bwipjs:`, error.message);

        // Último intento: usar CODE128 como fallback universal
        try {
            const fallbackConfig = {
                bcid: 'code128',
                text: codigo,
                scale: 2,
                height: 8,
                includetext: false
            };
            console.warn(`🔄 Intentando con CODE128 como fallback para: ${codigo}`);
            const png = await bwipjs.toBuffer(fallbackConfig);
            return png;
        } catch (fallbackError) {
            console.error(`❌ Fallback CODE128 también falló:`, fallbackError.message);
            return null;
        }
    }
};

/**
 * Carga una imagen desde una URL o ruta local
 * @param {string} imageUrl - URL de la imagen o ruta relativa
 * @returns {Promise<Buffer|null>} - Buffer de la imagen o null si hay error
 */
const cargarImagenBuffer = async (imageUrl) => {
    try {
        if (!imageUrl) return null;

        // Si es una URL completa (http/https)
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000, // Timeout de 10 segundos
                maxContentLength: 10 * 1024 * 1024, // Máximo 10MB
                validateStatus: (status) => status === 200
            });
            return Buffer.from(response.data);
        }

        // Si es una ruta local relativa
        const uploadsDir = path.join(process.cwd(), 'uploads', 'articulos');
        const imagePath = path.join(uploadsDir, imageUrl);

        if (fs.existsSync(imagePath)) {
            return fs.readFileSync(imagePath);
        }

        return null;
    } catch (error) {
        console.error(`⚠️  Error cargando imagen ${imageUrl}:`, error.message);
        return null;
    }
};

/**
 * Genera una etiqueta individual de 3cm x 9cm con nombre y código de barras
 * @param {Object} articulo - Información del artículo
 * @returns {Promise<Buffer>} - Buffer con PDF de la etiqueta
 */
export const generarEtiquetaIndividual = async (articulo) => {
    return new Promise(async (resolve, reject) => {
        try {
            const anchoEtiqueta = cmToPoints(9); // 9cm de ancho
            const altoEtiqueta = cmToPoints(3);  // 3cm de alto

            // Crear documento PDF con tamaño de etiqueta
            const doc = new PDFDocument({
                size: [anchoEtiqueta, altoEtiqueta],
                margins: {
                    top: 5,
                    bottom: 5,
                    left: 5,
                    right: 5
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);

            // Generar código de barras según el tipo
            const barcodeBuffer = await generarCodigoBarrasBuffer(
                articulo.codigo_ean13,
                articulo.codigo_tipo || 'EAN13'
            );

            // LAYOUT DE LA ETIQUETA:
            // - Nombre del artículo (arriba, centrado, 2 líneas máximo, tamaño 16pt)
            // - Código de barras (centro, altura reducida para aprovechar espacio)

            let yPos = 5;

            // 1. NOMBRE DEL ARTÍCULO (arriba) - TIPOGRAFÍA MÁS GRANDE
            doc.fontSize(16);
            doc.font('Helvetica-Bold');

            // Ajustar nombre del artículo a 2 líneas máximo
            const nombreMaxWidth = anchoEtiqueta - 10;
            const nombre = articulo.nombre || 'Sin nombre';

            // Dividir en palabras y ajustar a 2 líneas
            const palabras = nombre.split(' ');
            let linea1 = '';
            let linea2 = '';

            for (const palabra of palabras) {
                const testLinea1 = linea1 ? `${linea1} ${palabra}` : palabra;
                const anchoLinea1 = doc.widthOfString(testLinea1);

                if (anchoLinea1 <= nombreMaxWidth) {
                    linea1 = testLinea1;
                } else {
                    if (!linea2) {
                        const testLinea2 = linea2 ? `${linea2} ${palabra}` : palabra;
                        const anchoLinea2 = doc.widthOfString(testLinea2);
                        if (anchoLinea2 <= nombreMaxWidth) {
                            linea2 = testLinea2;
                        } else {
                            // Si la palabra es muy larga, cortarla
                            linea2 = palabra.substring(0, 12) + '...';
                            break;
                        }
                    }
                }
            }

            // Centrar y escribir línea 1
            const xLinea1 = (anchoEtiqueta - doc.widthOfString(linea1)) / 2;
            doc.text(linea1, xLinea1, yPos);
            yPos += 17;

            // Centrar y escribir línea 2 si existe
            if (linea2) {
                const xLinea2 = (anchoEtiqueta - doc.widthOfString(linea2)) / 2;
                doc.text(linea2, xLinea2, yPos);
                yPos += 17;
            } else {
                yPos += 10; // Espacio extra si solo hay 1 línea
            }

            // 2. CÓDIGO DE BARRAS (centro)
            const barcodeWidth = anchoEtiqueta - 20;
            const barcodeHeight = 25;
            const xBarcode = 10;

            if (barcodeBuffer) {
                // Si se generó el código de barras correctamente
                doc.image(barcodeBuffer, xBarcode, yPos, {
                    width: barcodeWidth,
                    height: barcodeHeight,
                    align: 'center'
                });
            } else {
                // Fallback: rectángulo placeholder con texto
                doc.rect(xBarcode, yPos, barcodeWidth, barcodeHeight).stroke('#CCCCCC');
                doc.fontSize(9);
                doc.font('Helvetica');
                const placeholder = 'CÓDIGO DE BARRAS';
                const xPlaceholder = xBarcode + (barcodeWidth - doc.widthOfString(placeholder)) / 2;
                doc.text(placeholder, xPlaceholder, yPos + 12);
            }

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Genera un PDF con múltiples etiquetas organizadas en hojas A4
 * @param {Array} articulos - Array de objetos con información de artículos
 * @returns {Promise<Buffer>} - Buffer con PDF completo
 */
export const generarEtiquetasLote = async (articulos) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Crear documento PDF A4
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);

            // Dimensiones de etiqueta
            const anchoEtiqueta = cmToPoints(9);
            const altoEtiqueta = cmToPoints(3);

            // Dimensiones de página A4 en puntos (595 x 842)
            const anchoPagina = 595;
            const altoPagina = 842;

            // Calcular cuántas etiquetas caben por página
            const margen = 10;
            const espacioHorizontal = 5;
            const espacioVertical = 5;

            const etiquetasPorFila = Math.floor((anchoPagina - 2 * margen + espacioHorizontal) / (anchoEtiqueta + espacioHorizontal));
            const etiquetasPorColumna = Math.floor((altoPagina - 2 * margen + espacioVertical) / (altoEtiqueta + espacioVertical));
            const etiquetasPorPagina = etiquetasPorFila * etiquetasPorColumna;

            let etiquetaIndex = 0;
            let paginaActual = 0;

            for (const articulo of articulos) {
                // Generar código de barras para este artículo según su tipo
                const barcodeBuffer = await generarCodigoBarrasBuffer(
                    articulo.codigo_ean13,
                    articulo.codigo_tipo || 'EAN13'
                );

                // Calcular posición en la página
                const posicionEnPagina = etiquetaIndex % etiquetasPorPagina;

                // Si necesitamos nueva página
                if (etiquetaIndex > 0 && posicionEnPagina === 0) {
                    doc.addPage();
                    paginaActual++;
                }

                const fila = Math.floor(posicionEnPagina / etiquetasPorFila);
                const columna = posicionEnPagina % etiquetasPorFila;

                const x = margen + columna * (anchoEtiqueta + espacioHorizontal);
                const y = margen + fila * (altoEtiqueta + espacioVertical);

                // Dibujar borde de etiqueta (opcional, para guía de corte)
                doc.rect(x, y, anchoEtiqueta, altoEtiqueta).stroke('#CCCCCC');

                // Renderizar contenido de la etiqueta
                let yPos = y + 5;

                // 1. NOMBRE DEL ARTÍCULO - TIPOGRAFÍA MÁS GRANDE
                doc.fontSize(16);
                doc.font('Helvetica-Bold');

                const nombreMaxWidth = anchoEtiqueta - 10;
                const nombre = articulo.nombre || 'Sin nombre';

                const palabras = nombre.split(' ');
                let linea1 = '';
                let linea2 = '';

                for (const palabra of palabras) {
                    const testLinea1 = linea1 ? `${linea1} ${palabra}` : palabra;
                    const anchoLinea1 = doc.widthOfString(testLinea1);

                    if (anchoLinea1 <= nombreMaxWidth) {
                        linea1 = testLinea1;
                    } else {
                        if (!linea2) {
                            const testLinea2 = linea2 ? `${linea2} ${palabra}` : palabra;
                            const anchoLinea2 = doc.widthOfString(testLinea2);
                            if (anchoLinea2 <= nombreMaxWidth) {
                                linea2 = testLinea2;
                            } else {
                                linea2 = palabra.substring(0, 12) + '...';
                                break;
                            }
                        }
                    }
                }

                const xLinea1 = x + (anchoEtiqueta - doc.widthOfString(linea1)) / 2;
                doc.text(linea1, xLinea1, yPos);
                yPos += 17;

                if (linea2) {
                    const xLinea2 = x + (anchoEtiqueta - doc.widthOfString(linea2)) / 2;
                    doc.text(linea2, xLinea2, yPos);
                    yPos += 17;
                } else {
                    yPos += 10;
                }

                // 2. CÓDIGO DE BARRAS
                const barcodeWidth = anchoEtiqueta - 20;
                const barcodeHeight = 25;
                const xBarcode = x + 10;

                if (barcodeBuffer) {
                    // Si se generó el código de barras correctamente
                    doc.image(barcodeBuffer, xBarcode, yPos, {
                        width: barcodeWidth,
                        height: barcodeHeight
                    });
                } else {
                    // Fallback: rectángulo placeholder
                    doc.rect(xBarcode, yPos, barcodeWidth, barcodeHeight).stroke('#CCCCCC');
                    doc.fontSize(9);
                    doc.font('Helvetica');
                    const placeholder = 'CÓDIGO DE BARRAS';
                    const xPlaceholder = xBarcode + (barcodeWidth - doc.widthOfString(placeholder)) / 2;
                    doc.text(placeholder, xPlaceholder, yPos + 12);
                }

                etiquetaIndex++;
            }

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Genera un PDF con múltiples etiquetas organizadas en hojas A4 CON FOTOS
 * Layout: Foto a la izquierda, nombre arriba y código de barras más alto a la derecha
 * @param {Array} articulos - Array de objetos con información de artículos (incluye imagen_url)
 * @returns {Promise<Buffer>} - Buffer con PDF completo
 */
export const generarEtiquetasLoteConFoto = async (articulos) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Crear documento PDF A4
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);

            // Dimensiones de etiqueta
            const anchoEtiqueta = cmToPoints(9);
            const altoEtiqueta = cmToPoints(3);

            // Dimensiones de página A4 en puntos (595 x 842)
            const anchoPagina = 595;
            const altoPagina = 842;

            // Calcular cuántas etiquetas caben por página
            const margen = 10;
            const espacioHorizontal = 5;
            const espacioVertical = 5;

            const etiquetasPorFila = Math.floor((anchoPagina - 2 * margen + espacioHorizontal) / (anchoEtiqueta + espacioHorizontal));
            const etiquetasPorColumna = Math.floor((altoPagina - 2 * margen + espacioVertical) / (altoEtiqueta + espacioVertical));
            const etiquetasPorPagina = etiquetasPorFila * etiquetasPorColumna;

            let etiquetaIndex = 0;
            let paginaActual = 0;

            for (const articulo of articulos) {
                // Generar código de barras para este artículo según su tipo
                const barcodeBuffer = await generarCodigoBarrasBuffer(
                    articulo.codigo_ean13,
                    articulo.codigo_tipo || 'EAN13'
                );

                // Cargar imagen del artículo si existe
                const imagenBuffer = await cargarImagenBuffer(articulo.imagen_url);

                // Calcular posición en la página
                const posicionEnPagina = etiquetaIndex % etiquetasPorPagina;

                // Si necesitamos nueva página
                if (etiquetaIndex > 0 && posicionEnPagina === 0) {
                    doc.addPage();
                    paginaActual++;
                }

                const fila = Math.floor(posicionEnPagina / etiquetasPorFila);
                const columna = posicionEnPagina % etiquetasPorFila;

                const x = margen + columna * (anchoEtiqueta + espacioHorizontal);
                const y = margen + fila * (altoEtiqueta + espacioVertical);

                // Dibujar borde de etiqueta (opcional, para guía de corte)
                doc.rect(x, y, anchoEtiqueta, altoEtiqueta).stroke('#CCCCCC');

                // LAYOUT CON FOTO:
                // +------------------+
                // | [IMG] Nombre     |
                // | [IMG] |||||||||| |
                // +------------------+

                const paddingEtiqueta = 5;
                const imagenSize = altoEtiqueta - (2 * paddingEtiqueta); // Imagen cuadrada que ocupa todo el alto
                const imagenX = x + paddingEtiqueta;
                const imagenY = y + paddingEtiqueta;

                // Área disponible para texto y código de barras (a la derecha de la imagen)
                const areaDerechaX = imagenX + imagenSize + 5;
                const areaDerechaAncho = anchoEtiqueta - imagenSize - (3 * paddingEtiqueta);

                // 1. IMAGEN DEL ARTÍCULO (izquierda)
                if (imagenBuffer) {
                    try {
                        doc.image(imagenBuffer, imagenX, imagenY, {
                            width: imagenSize,
                            height: imagenSize,
                            fit: [imagenSize, imagenSize],
                            align: 'center',
                            valign: 'center'
                        });
                    } catch (error) {
                        console.error('Error al insertar imagen en PDF:', error);
                        // Fallback: rectángulo gris
                        doc.save();
                        doc.rect(imagenX, imagenY, imagenSize, imagenSize).fillAndStroke('#F0F0F0', '#CCCCCC');
                        doc.restore();
                    }
                } else {
                    // Placeholder: rectángulo con emoji
                    doc.save();
                    doc.rect(imagenX, imagenY, imagenSize, imagenSize).fillAndStroke('#F0F0F0', '#CCCCCC');
                    doc.fontSize(24);
                    const emoji = articulo.tipo === 'unidad' ? '🔧' : '📦';
                    const emojiWidth = doc.widthOfString(emoji);
                    doc.fillColor('#666666');
                    doc.text(emoji, imagenX + (imagenSize - emojiWidth) / 2, imagenY + imagenSize / 2 - 12);
                    doc.restore();
                }

                // 2. NOMBRE DEL ARTÍCULO (arriba derecha, adaptable a 1-2 líneas)
                // Resetear estilo completamente para asegurar texto negro
                doc.fillColor('#000000');
                doc.strokeColor('#000000');

                let yPos = y + paddingEtiqueta;
                doc.fontSize(11);
                doc.font('Helvetica-Bold');

                const nombre = articulo.nombre || 'Sin nombre';

                // Calcular cuántas líneas necesita el nombre
                const heightOfText = doc.heightOfString(nombre, {
                    width: areaDerechaAncho,
                    align: 'left'
                });

                doc.text(nombre, areaDerechaX, yPos, {
                    width: areaDerechaAncho,
                    align: 'left'
                });

                // Avanzar según el alto real del texto
                yPos += heightOfText + 3; // 3 puntos de separación

                // 3. CÓDIGO DE BARRAS (altura dinámica según espacio disponible)
                const barcodeWidth = areaDerechaAncho - 5;
                // Calcular altura restante desde yPos hasta el final de la etiqueta
                const espacioDisponible = (y + altoEtiqueta) - yPos - paddingEtiqueta;
                const barcodeHeight = Math.max(espacioDisponible, 15); // Mínimo 15 puntos
                const xBarcode = areaDerechaX;

                if (barcodeBuffer) {
                    try {
                        doc.image(barcodeBuffer, xBarcode, yPos, {
                            width: barcodeWidth,
                            height: barcodeHeight,
                            fit: [barcodeWidth, barcodeHeight]
                        });
                    } catch (error) {
                        console.error('Error al insertar código de barras:', error);
                        // Fallback
                        doc.rect(xBarcode, yPos, barcodeWidth, barcodeHeight).stroke('#CCCCCC');
                    }
                } else {
                    // Fallback: rectángulo placeholder
                    doc.rect(xBarcode, yPos, barcodeWidth, barcodeHeight).stroke('#CCCCCC');
                    doc.fontSize(8);
                    doc.font('Helvetica');
                    const placeholder = 'CÓDIGO';
                    const xPlaceholder = xBarcode + (barcodeWidth - doc.widthOfString(placeholder)) / 2;
                    doc.text(placeholder, xPlaceholder, yPos + barcodeHeight / 2);
                }

                etiquetaIndex++;
            }

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

export default {
    generarEtiquetaIndividual,
    generarEtiquetasLote,
    generarEtiquetasLoteConFoto
};
