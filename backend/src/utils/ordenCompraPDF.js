import PDFDocument from 'pdfkit';
import axios from 'axios';

/**
 * Generar PDF de orden de compra
 * @param {Object} orden - Orden completa con detalles, proveedor y creador
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generarPDFOrdenCompra(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [226.77, 800], // 80mm width, height variable (aprox)
        margins: { top: 20, bottom: 20, left: 15, right: 15 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      // === HEADER ===
      // Logo (intentar cargar, si falla continuar sin él)
      try {
        const logoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
        const logoResponse = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 5000 });
        const logoBuffer = Buffer.from(logoResponse.data);
        doc.image(logoBuffer, (doc.page.width - 150) / 2, doc.y, { width: 150 });
        doc.moveDown(0.5);
      } catch (error) {
        console.log('⚠️ No se pudo cargar el logo para el PDF');
      }

      // Información de la orden
      doc.fontSize(8).font('Helvetica-Bold');

      // Proveedor
      doc.text('PROVEEDOR', { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      doc.text(orden.proveedor?.nombre || 'Sin proveedor', { align: 'center' });
      doc.moveDown(0.3);

      // Creado por
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('CREADO POR', { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      doc.text(orden.creador?.nombre || 'N/A', { align: 'center' });
      doc.moveDown(0.3);

      // Fecha de pedido
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('FECHA DE PEDIDO', { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      const fechaPedido = orden.created_at ? new Date(orden.created_at).toLocaleDateString('es-MX') : 'N/A';
      doc.text(fechaPedido, { align: 'center' });
      doc.moveDown(0.3);

      // Fecha de llegada estimada
      if (orden.fecha_llegada_estimada) {
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('FECHA DE LLEGADA', { align: 'center' });
        doc.font('Helvetica').fontSize(7);
        const fechaLlegada = new Date(orden.fecha_llegada_estimada).toLocaleDateString('es-MX');
        doc.text(fechaLlegada, { align: 'center' });
        doc.moveDown(0.3);
      }

      // Título principal
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('ORDEN DE COMPRA', { align: 'center' });
      doc.text(orden.ticket_id, { align: 'center' });
      doc.moveDown(0.5);

      // Línea divisoria
      doc.moveTo(15, doc.y).lineTo(doc.page.width - 15, doc.y).stroke();
      doc.moveDown(0.5);

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      const articulos = orden.detalles || [];

      // Agrupar por categoría
      const articulosPorCategoria = {};
      articulos.forEach(detalle => {
        const categoria = detalle.articulo?.categoria?.nombre || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
          articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(detalle);
      });

      // Renderizar artículos por categoría
      Object.keys(articulosPorCategoria).forEach(categoria => {
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text(categoria.toUpperCase(), 15, doc.y);
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(7);
        articulosPorCategoria[categoria].forEach(detalle => {
          const nombre = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const cantidad = detalle.cantidad_solicitada;
          const unidad = detalle.articulo?.unidad || 'uds';
          const descripcion = detalle.articulo?.descripcion || '';

          // Nombre y cantidad
          doc.font('Helvetica-Bold').fontSize(7);
          doc.text(`• ${nombre} - ${cantidad} ${unidad}`, 20, doc.y, { width: doc.page.width - 40 });

          // Descripción si existe
          if (descripcion) {
            doc.font('Helvetica').fontSize(6);
            doc.text(`  ${descripcion}`, 25, doc.y, { width: doc.page.width - 45 });
          }

          doc.moveDown(0.3);
        });

        doc.moveDown(0.3);
      });

      // === FOOTER ===
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(6).fillColor('#999999');
      doc.text('3G Arquitectura Textil', { align: 'center' });
      doc.text('Sistema de Inventario', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
