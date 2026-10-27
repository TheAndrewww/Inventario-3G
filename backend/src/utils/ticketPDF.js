/**
 * PDF del ticket de Orden de salida, armado en el servidor (27-oct-2026, pedido del dueño: que el ticket se suba solo a
 * la carpeta de Drive del proyecto, sin depender del navegador de quien creó la orden).
 *
 * Es el MISMO diseño que frontend/src/utils/pdfGenerator.js › generateTicketPDF (el que se descarga al finalizar la
 * orden): 80 mm de ancho, logo, encargado, proyecto, fecha de salida, artículos agrupados por categoría con su foto,
 * observaciones y la marca de agua. Si se cambia uno, hay que cambiar el otro.
 *
 * Lo que cambia por correr en el servidor:
 * - Las imágenes se bajan con fetch y pasan por sharp (PNG para los logos, JPEG para las fotos) para saber su tamaño
 *   sin navegador. Una imagen que no baja en 8 s se omite, como hace el navegador cuando una falla.
 * - La fecha se escribe con la hora de México (el servidor corre en UTC).
 * - Va comprimido (documento y marca de agua), para que la copia de Drive pese ~100 KB y no ~6 MB. Se ve igual.
 */
import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LOGO_COMPLETO_URL = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
const MARCA_AGUA_URL = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';
const ESPERA_IMAGEN_MS = 8000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Las fotos del sistema viejo son rutas «/uploads/…» que sirve express.static('uploads') desde la raíz del backend.
const CARPETA_UPLOADS = path.join(__dirname, '../../uploads');

/** Bytes de una imagen: URL completa (Cloudinary) o ruta «/uploads/…» del sistema viejo. null si no hay. */
const leerImagen = async (url, { fetch: traer = globalThis.fetch } = {}) => {
    if (/^https?:\/\//i.test(url)) {
        const respuesta = await traer(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS) });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return Buffer.from(await respuesta.arrayBuffer());
    }
    const ruta = path.join(CARPETA_UPLOADS, url.replace(/^\/?uploads\//, ''));
    if (!ruta.startsWith(CARPETA_UPLOADS + path.sep)) return null; // nada fuera de uploads/
    return fs.existsSync(ruta) ? fs.promises.readFile(ruta) : null;
};

/**
 * Imagen lista para jsPDF: { base64 (data URL), formato: 'PNG' | 'JPEG', aspectRatio } o null si no se pudo.
 * PNG conserva la transparencia (logo y marca de agua, a lo más 900 px de ancho); las fotos van en JPEG con fondo
 * blanco y a lo más 600 px, que en el ticket miden 12 mm.
 */
export const cargarImagenTicket = async (url, { formato = 'JPEG', fetch } = {}) => {
    if (!url) return null;
    try {
        const crudo = await leerImagen(url, { fetch });
        if (!crudo) return null;
        let imagen = sharp(crudo, { failOn: 'none' }).rotate();
        if (formato === 'PNG') {
            // El logo mide 60 mm en el ticket: 900 px sobran para imprimirlo nítido
            imagen = imagen.resize({ width: 900, withoutEnlargement: true }).png();
        } else {
            imagen = imagen
                .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 85 });
        }
        const { data, info } = await imagen.toBuffer({ resolveWithObject: true });
        if (!info.width || !info.height) return null;
        return {
            base64: `data:image/${formato === 'PNG' ? 'png' : 'jpeg'};base64,${data.toString('base64')}`,
            formato,
            aspectRatio: info.width / info.height
        };
    } catch (error) {
        console.error(`⚠️ Ticket: no se pudo cargar la imagen ${url}: ${error.message}`);
        return null;
    }
};

/** Logo, marca de agua y la foto de cada artículo del pedido: { logo, marcaAgua, articulos: { [articulo_id]: imagen } }. */
export const cargarImagenesTicket = async (pedido, opciones = {}) => {
    const [logo, marcaAgua] = await Promise.all([
        cargarImagenTicket(LOGO_COMPLETO_URL, { ...opciones, formato: 'PNG' }),
        cargarImagenTicket(MARCA_AGUA_URL, { ...opciones, formato: 'PNG' })
    ]);
    const articulos = {};
    for (const detalle of pedido.detalles || []) {
        const url = detalle.articulo?.imagen_url;
        if (!url || detalle.articulo_id in articulos) continue;
        const imagen = await cargarImagenTicket(url, opciones);
        if (imagen) articulos[detalle.articulo_id] = imagen;
    }
    return { logo, marcaAgua, articulos };
};

/**
 * Arma el PDF con el pedido (la forma de GET /api/pedidos/:id: detalles → articulo → categoria, supervisor) y las
 * imágenes ya cargadas. Sin red. Regresa un Buffer.
 */
export const armarTicketPDF = (pedido, { logo = null, marcaAgua = null, articulos: imagenesArticulos = {} } = {}) => {
    // === CALCULAR ALTURA NECESARIA DEL DOCUMENTO ===
    const articulos = pedido.detalles || [];

    // Agrupar artículos por categoría
    const articulosPorCategoria = {};
    articulos.forEach(detalle => {
        const categoria = detalle.articulo?.categoria?.nombre || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
            articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(detalle);
    });

    // Calcular altura aproximada necesaria
    let alturaEstimada = 100; // Header inicial
    Object.keys(articulosPorCategoria).forEach(categoria => {
        alturaEstimada += 8; // Título de categoría
        articulosPorCategoria[categoria].forEach(detalle => {
            alturaEstimada += 20; // Espacio por artículo con imagen
            const descripcion = detalle.articulo?.descripcion || '';
            if (descripcion) {
                const lineasDesc = Math.ceil(descripcion.length / 50);
                alturaEstimada += lineasDesc * 4;
            }
        });
        alturaEstimada += 5; // Espacio entre categorías
    });
    // Espacio reservado para observaciones (si existen)
    const observacionesTexto = (pedido.observaciones || '').trim();
    if (observacionesTexto) {
        const lineasObs = Math.ceil(observacionesTexto.length / 45);
        alturaEstimada += 12 + lineasObs * 4;
    }
    alturaEstimada += 10; // Margen final

    // Crear documento con formato ticket (80mm de ancho, altura dinámica)
    const anchoTicket = 80; // mm
    const altoTicket = Math.max(200, alturaEstimada); // Mínimo 200mm
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [anchoTicket, altoTicket],
        // Comprimido: sin esto el logo (1958×717 con transparencia) entra sin comprimir y el ticket pesa ~6 MB. Se ve igual.
        compress: true
    });

    let yPos = 5;
    const margen = 5;
    const anchoUtil = anchoTicket - (margen * 2);

    // === HEADER ===
    // Logo completo centrado
    if (logo) {
        const logoWidth = 60;
        const logoHeight = logoWidth / logo.aspectRatio;
        const logoX = (anchoTicket - logoWidth) / 2;
        doc.addImage(logo.base64, 'PNG', logoX, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 5;
    }

    // Información del pedido (centrada)
    doc.setFontSize(8);

    // Encargado (el seleccionado al crear el ticket). Sin el creador como respaldo, igual que en la pantalla.
    doc.setFont(undefined, 'bold');
    doc.text('ENCARGADO', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont(undefined, 'normal');
    const encargado = pedido.supervisor?.nombre || pedido.aprobadoPor?.nombre || 'Sin encargado';
    const encargadoLines = doc.splitTextToSize(encargado, anchoUtil);
    encargadoLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
    });
    yPos += 2;

    // Proyecto
    doc.setFont(undefined, 'bold');
    doc.text('PROYECTO', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont(undefined, 'normal');
    const proyecto = pedido.proyecto || pedido.equipo?.nombre || 'Sin proyecto';
    const proyectoLines = doc.splitTextToSize(proyecto, anchoUtil);
    proyectoLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
    });
    yPos += 2;

    // Fecha (con la hora de México: el servidor corre en UTC)
    doc.setFont(undefined, 'bold');
    doc.text('FECHA DE SALIDA', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont(undefined, 'normal');
    const fechaPedido = pedido.created_at || pedido.createdAt;
    doc.text(
        fechaPedido ? new Date(fechaPedido).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Mexico_City'
        }) : 'N/A',
        anchoTicket / 2,
        yPos,
        { align: 'center' }
    );
    yPos += 6;

    // === TÍTULO PRINCIPAL ===
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('ORDEN DE SALIDA', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 6;

    // Línea divisoria
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margen, yPos, anchoTicket - margen, yPos);
    yPos += 5;

    // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
    doc.setFontSize(8);
    Object.keys(articulosPorCategoria).forEach(categoria => {
        // Nombre de categoría
        doc.setFont(undefined, 'bold');
        doc.text(categoria.toUpperCase(), margen, yPos);
        yPos += 4;

        // Lista de artículos
        doc.setFont(undefined, 'normal');
        articulosPorCategoria[categoria].forEach(detalle => {
            const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
            const descripcion = detalle.articulo?.descripcion || '';
            const cantidad = detalle.cantidad;
            const unidad = detalle.articulo?.unidad || 'uds';
            const imagenArticulo = imagenesArticulos[detalle.articulo_id];

            // Dibujar imagen del artículo si existe
            const imgSize = 12; // Tamaño de imagen en mm
            let textX = margen;
            let textStartY = yPos;

            if (imagenArticulo) {
                const imgWidth = imgSize;
                const imgHeight = imgSize / imagenArticulo.aspectRatio;

                // Borde de imagen
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.rect(margen, yPos, imgWidth, imgHeight);

                // Agregar imagen
                doc.addImage(imagenArticulo.base64, imagenArticulo.formato, margen, yPos, imgWidth, imgHeight);
                textX = margen + imgWidth + 2;
                textStartY = yPos + 3;
                yPos = Math.max(yPos + imgHeight, textStartY);
            } else {
                textStartY = yPos + 3;
            }

            // Nombre y cantidad en negrita
            doc.setFont(undefined, 'bold');
            const texto = `• ${nombreArticulo} - ${cantidad} ${unidad}`;
            const textoLines = doc.splitTextToSize(texto, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
            doc.text(textoLines, textX, textStartY);
            const altoTexto = textoLines.length * 3.5;

            // Descripción si existe
            if (descripcion) {
                doc.setFont(undefined, 'normal');
                doc.setFontSize(7);
                const descLines = doc.splitTextToSize(`  ${descripcion}`, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
                doc.text(descLines, textX, textStartY + altoTexto);
                yPos = Math.max(yPos, textStartY + altoTexto + (descLines.length * 3));
                doc.setFontSize(8);
            } else {
                yPos = Math.max(yPos, textStartY + altoTexto);
            }

            yPos += 3;
        });

        yPos += 3; // Espacio entre categorías
    });

    // === OBSERVACIONES ===
    if (observacionesTexto) {
        yPos += 2;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margen, yPos, anchoTicket - margen, yPos);
        yPos += 4;

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('OBSERVACIONES', margen, yPos);
        yPos += 4;

        doc.setFont(undefined, 'normal');
        const obsLines = doc.splitTextToSize(observacionesTexto, anchoUtil);
        obsLines.forEach(line => {
            doc.text(line, margen, yPos);
            yPos += 3.5;
        });
        yPos += 3;
    }

    // === MARCA DE AGUA ===
    if (marcaAgua) {
        const gState = doc.GState({ opacity: 0.05 });
        doc.setGState(gState);

        const watermarkWidth = 60;
        const watermarkHeight = watermarkWidth / marcaAgua.aspectRatio;
        const watermarkX = (anchoTicket - watermarkWidth) / 2;
        const watermarkY = altoTicket / 2 - watermarkHeight / 2;

        // 'FAST' y no 'NONE' como en la pantalla: sin comprimir, la marca de agua sola pesa ~350 KB. Se ve igual.
        doc.addImage(marcaAgua.base64, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight, undefined, 'FAST', 0);
        doc.setGState(doc.GState({ opacity: 1 }));
    }

    return Buffer.from(doc.output('arraybuffer'));
};

/** Baja las imágenes y arma el PDF del ticket. Regresa un Buffer. */
export const generarTicketPDF = async (pedido, opciones = {}) =>
    armarTicketPDF(pedido, await cargarImagenesTicket(pedido, opciones));

export default { generarTicketPDF, armarTicketPDF, cargarImagenesTicket, cargarImagenTicket };
