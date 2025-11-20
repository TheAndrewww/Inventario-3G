/**
 * Generador de etiquetas para artículos
 * Genera etiquetas de 3cm x 9cm con nombre del artículo y código de barras
 */

import pkg from 'pdfkit';
const PDFDocument = pkg;
import bwipjs from 'bwip-js';

/**
 * Convierte cm a puntos (1 cm = 28.35 puntos)
 */
const cmToPoints = (cm) => cm * 28.35;

/**
 * Genera una imagen de código de barras EAN-13
 */
const generarCodigoBarrasBuffer = async (codigo) => {
    try {
        const png = await bwipjs.toBuffer({
            bcid: 'ean13',
            text: codigo,
            scale: 2,
            height: 8,
            includetext: false, // No incluir texto porque lo pondremos manualmente
        });
        return png;
    } catch (error) {
        console.error('Error generando código de barras con bwipjs:', error);
        // Devolver null en caso de error (usaremos fallback visual)
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

            // Generar código de barras
            const barcodeBuffer = await generarCodigoBarrasBuffer(articulo.codigo_ean13);

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
                // Generar código de barras para este artículo
                const barcodeBuffer = await generarCodigoBarrasBuffer(articulo.codigo_ean13);

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

export default {
    generarEtiquetaIndividual,
    generarEtiquetasLote
};
