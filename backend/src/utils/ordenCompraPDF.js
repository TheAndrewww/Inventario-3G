import PDFDocument from 'pdfkit';
import axios from 'axios';

/**
 * Cargar imagen desde URL y convertir a buffer
 */
async function cargarImagen(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error cargando imagen ${url}:`, error.message);
    return null;
  }
}

/**
 * Calcular altura estimada del PDF
 */
function calcularAlturaEstimada(articulosPorCategoria) {
  let altura = 100; // Header inicial
  Object.keys(articulosPorCategoria).forEach(categoria => {
    altura += 8; // Título de categoría
    articulosPorCategoria[categoria].forEach(detalle => {
      altura += 20; // Espacio por artículo con imagen
      const descripcion = detalle.articulo?.descripcion || '';
      if (descripcion) {
        const lineasDesc = Math.ceil(descripcion.length / 50);
        altura += lineasDesc * 4;
      }
    });
    altura += 5; // Espacio entre categorías
  });
  altura += 10; // Margen final
  return altura;
}

/**
 * Generar PDF de orden de compra (IDÉNTICO al frontend)
 * @param {Object} orden - Orden completa con detalles, proveedor y creador
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generarPDFOrdenCompra(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      // URLs de los logos (MISMO que frontend)
      const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
      const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

      // Agrupar artículos por categoría
      const articulos = orden.detalles || [];
      const articulosPorCategoria = {};
      articulos.forEach(detalle => {
        const categoria = detalle.articulo?.categoria?.nombre || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
          articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(detalle);
      });

      // Calcular altura dinámica
      const alturaEstimada = calcularAlturaEstimada(articulosPorCategoria);
      const anchoTicket = 226.77; // 80mm en puntos
      const altoTicket = Math.max(566.93, alturaEstimada * 2.83465); // Mínimo 200mm, convertir mm a puntos

      // Crear documento con formato ticket (MISMO que frontend)
      const doc = new PDFDocument({
        size: [anchoTicket, altoTicket],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      // Constantes (convertir mm a puntos: 1mm = 2.83465 puntos)
      const margen = 5 * 2.83465; // 5mm
      const anchoUtil = anchoTicket - (margen * 2);
      let yPos = 5 * 2.83465; // 5mm

      // === CARGAR IMÁGENES ===
      const [logoBuffer, marcaAguaBuffer] = await Promise.all([
        cargarImagen(logoCompletoUrl),
        cargarImagen(marcaAguaUrl)
      ]);

      // Cargar imágenes de artículos
      const imagenesArticulos = {};
      for (const detalle of articulos) {
        if (detalle.articulo?.imagen_url) {
          const imgBuffer = await cargarImagen(detalle.articulo.imagen_url);
          if (imgBuffer) {
            imagenesArticulos[detalle.articulo_id] = imgBuffer;
          }
        }
      }

      // === HEADER ===
      // Logo completo centrado (MISMO que frontend: 60mm width)
      if (logoBuffer) {
        const logoWidth = 60 * 2.83465; // 60mm
        const logoHeight = logoWidth * 0.3; // Ajustar según aspect ratio aproximado
        const logoX = (anchoTicket - logoWidth) / 2;
        doc.image(logoBuffer, logoX, yPos, { width: logoWidth, height: logoHeight });
        yPos += logoHeight + (5 * 2.83465);
      }

      // === INFORMACIÓN DE LA ORDEN (centrada) ===
      doc.fontSize(8);

      // PROVEEDOR
      doc.font('Helvetica-Bold');
      doc.text('PROVEEDOR', margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 4 * 2.83465;
      doc.font('Helvetica');
      const proveedor = orden.proveedor?.nombre || 'Sin proveedor';
      doc.text(proveedor, margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 3.5 * 2.83465 + 2 * 2.83465;

      // CREADO POR
      doc.font('Helvetica-Bold');
      doc.text('CREADO POR', margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 4 * 2.83465;
      doc.font('Helvetica');
      const creador = orden.creador?.nombre || 'N/A';
      doc.text(creador, margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 3.5 * 2.83465 + 2 * 2.83465;

      // FECHA DE PEDIDO
      doc.font('Helvetica-Bold');
      doc.text('FECHA DE PEDIDO', margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 4 * 2.83465;
      doc.font('Helvetica');
      const fechaPedido = orden.created_at
        ? new Date(orden.created_at).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'N/A';
      doc.text(fechaPedido, margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 4 * 2.83465;

      // FECHA DE LLEGADA
      doc.font('Helvetica-Bold');
      doc.text('FECHA DE LLEGADA', margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 4 * 2.83465;
      doc.font('Helvetica');
      const fechaLlegada = orden.fecha_llegada_estimada
        ? new Date(orden.fecha_llegada_estimada).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'Sin definir';
      doc.text(fechaLlegada, margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 6 * 2.83465;

      // === TÍTULO PRINCIPAL ===
      doc.fontSize(10);
      doc.font('Helvetica-Bold');
      doc.text('ORDEN DE COMPRA', margen, yPos, { width: anchoUtil, align: 'center' });
      yPos += 6 * 2.83465;

      // Línea divisoria
      doc.strokeColor('#c8c8c8')
         .lineWidth(0.3 * 2.83465)
         .moveTo(margen, yPos)
         .lineTo(anchoTicket - margen, yPos)
         .stroke();
      yPos += 5 * 2.83465;

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      doc.fontSize(8);
      Object.keys(articulosPorCategoria).forEach(categoria => {
        // Nombre de categoría
        doc.font('Helvetica-Bold');
        doc.text(categoria.toUpperCase(), margen, yPos, { width: anchoUtil });
        yPos += 4 * 2.83465;

        // Lista de artículos
        doc.font('Helvetica');
        articulosPorCategoria[categoria].forEach(detalle => {
          const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const descripcion = detalle.articulo?.descripcion || '';
          const cantidad = detalle.cantidad_solicitada;
          const unidad = detalle.articulo?.unidad || 'uds';
          const imagenArticulo = imagenesArticulos[detalle.articulo_id];

          // Dibujar imagen del artículo si existe (12mm de tamaño)
          const imgSize = 12 * 2.83465; // 12mm
          let textX = margen;
          let textStartY = yPos;

          if (imagenArticulo) {
            const imgWidth = imgSize;
            const imgHeight = imgSize; // Mantener cuadrado

            // Borde de imagen
            doc.strokeColor('#c8c8c8')
               .lineWidth(0.2 * 2.83465)
               .rect(margen, yPos, imgWidth, imgHeight)
               .stroke();

            // Agregar imagen
            doc.image(imagenArticulo, margen, yPos, {
              width: imgWidth,
              height: imgHeight,
              fit: [imgWidth, imgHeight]
            });

            textX = margen + imgWidth + (2 * 2.83465);
            textStartY = yPos + (3 * 2.83465);
            yPos = Math.max(yPos + imgHeight, textStartY);
          } else {
            textStartY = yPos + (3 * 2.83465);
          }

          // Nombre y cantidad en negrita
          doc.font('Helvetica-Bold');
          const texto = `• ${nombreArticulo} - ${cantidad} ${unidad}`;
          const textoWidth = imagenArticulo ? anchoUtil - imgSize - (2 * 2.83465) : anchoUtil;
          doc.text(texto, textX, textStartY, {
            width: textoWidth,
            lineGap: 3.5 * 2.83465 - doc.currentLineHeight()
          });
          const altoTexto = doc.y - textStartY;

          // Descripción si existe
          if (descripcion) {
            doc.font('Helvetica');
            doc.fontSize(7);
            doc.text(`  ${descripcion}`, textX, doc.y, {
              width: textoWidth,
              lineGap: 3 * 2.83465 - doc.currentLineHeight()
            });
            yPos = Math.max(yPos, doc.y);
            doc.fontSize(8);
          } else {
            yPos = Math.max(yPos, textStartY + altoTexto);
          }

          yPos += 3 * 2.83465;
        });

        yPos += 3 * 2.83465; // Espacio entre categorías
      });

      // === MARCA DE AGUA ===
      if (marcaAguaBuffer) {
        doc.save();
        doc.opacity(0.05);

        const watermarkWidth = 60 * 2.83465; // 60mm
        const watermarkHeight = watermarkWidth; // Mantener proporción aproximada
        const watermarkX = (anchoTicket - watermarkWidth) / 2;
        const watermarkY = (altoTicket / 2) - (watermarkHeight / 2);

        doc.image(marcaAguaBuffer, watermarkX, watermarkY, {
          width: watermarkWidth,
          height: watermarkHeight,
          fit: [watermarkWidth, watermarkHeight]
        });

        doc.restore();
      }

      doc.end();
    } catch (error) {
      console.error('Error generando PDF:', error);
      reject(error);
    }
  });
}
