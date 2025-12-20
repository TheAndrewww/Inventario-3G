import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { getImageUrl } from './imageUtils';

/**
 * Función para cargar imagen desde URL y obtener base64 + dimensiones
 */
const loadImageWithDimensions = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Crear imagen para obtener dimensiones
        const img = new Image();
        img.onload = () => {
          resolve({
            base64: reader.result,
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height
          });
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error cargando imagen:', error);
    return null;
  }
};

/**
 * Genera un PDF en formato ticket (80mm) para pedidos/movimientos
 * @param {Object} pedido - Objeto del pedido o movimiento con detalles
 * @returns {Promise<void>}
 */
export const generateTicketPDF = async (pedido) => {
  try {
    console.log('📄 Generando PDF para pedido:', pedido.ticket_id);
    console.log('📦 Total de detalles:', pedido.detalles?.length || 0);

    // URLs de los logos
    const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
    const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

    // Cargar imágenes
    const [logoData, marcaAguaData] = await Promise.all([
      loadImageWithDimensions(logoCompletoUrl),
      loadImageWithDimensions(marcaAguaUrl)
    ]);

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

    // Cargar imágenes de artículos
    console.log('🖼️ Cargando imágenes de artículos...');
    const imagenesArticulos = {};
    for (const detalle of articulos) {
      const imagenUrlOriginal = detalle.articulo?.imagen_url;
      const imagenUrlCompleta = getImageUrl(imagenUrlOriginal);

      console.log(`  Artículo ${detalle.articulo_id}: ${detalle.articulo?.nombre}`, {
        tieneImagenUrl: !!imagenUrlOriginal,
        imagen_url_original: imagenUrlOriginal,
        imagen_url_completa: imagenUrlCompleta
      });

      if (imagenUrlCompleta) {
        try {
          const imagenData = await loadImageWithDimensions(imagenUrlCompleta);
          if (imagenData) {
            imagenesArticulos[detalle.articulo_id] = imagenData;
            console.log(`  ✅ Imagen cargada para artículo ${detalle.articulo_id}`);
          } else {
            console.log(`  ❌ No se pudo cargar imagen para artículo ${detalle.articulo_id}`);
          }
        } catch (error) {
          console.error(`  ❌ Error cargando imagen del artículo ${detalle.articulo_id}:`, error);
        }
      }
    }

    console.log(`📊 Total de imágenes cargadas: ${Object.keys(imagenesArticulos).length}/${articulos.length}`);
    console.log('Imágenes cargadas por artículo_id:', Object.keys(imagenesArticulos));

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
    alturaEstimada += 10; // Margen final

    // Crear documento con formato ticket (80mm de ancho, altura dinámica)
    const anchoTicket = 80; // mm
    const altoTicket = Math.max(200, alturaEstimada); // Mínimo 200mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [anchoTicket, altoTicket]
    });

    let yPos = 5;
    const margen = 5;
    const anchoUtil = anchoTicket - (margen * 2);

    // === HEADER ===
    // Logo completo centrado
    if (logoData) {
      const logoWidth = 60;
      const logoHeight = logoWidth / logoData.aspectRatio;
      const logoX = (anchoTicket - logoWidth) / 2;
      doc.addImage(logoData.base64, 'PNG', logoX, yPos, logoWidth, logoHeight);
      yPos += logoHeight + 5;
    }

    // Información del pedido (centrada)
    doc.setFontSize(8);

    // Supervisor
    doc.setFont(undefined, 'bold');
    doc.text('SUPERVISOR', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont(undefined, 'normal');
    const supervisor = pedido.aprobadoPor?.nombre || pedido.usuario?.nombre || 'N/A';
    const supervisorLines = doc.splitTextToSize(supervisor, anchoUtil);
    supervisorLines.forEach(line => {
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

    // Fecha
    doc.setFont(undefined, 'bold');
    doc.text('FECHA DE SALIDA', anchoTicket / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont(undefined, 'normal');
    const fechaPedido = pedido.created_at || pedido.createdAt;
    doc.text(
      fechaPedido ? new Date(fechaPedido).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
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
          doc.addImage(imagenArticulo.base64, 'JPEG', margen, yPos, imgWidth, imgHeight);
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

    // === MARCA DE AGUA ===
    if (marcaAguaData) {
      const gState = doc.GState({ opacity: 0.05 });
      doc.setGState(gState);

      const watermarkWidth = 60;
      const watermarkHeight = watermarkWidth / marcaAguaData.aspectRatio;
      const watermarkX = (anchoTicket - watermarkWidth) / 2;
      const watermarkY = altoTicket / 2 - watermarkHeight / 2;

      doc.addImage(marcaAguaData.base64, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight, undefined, 'NONE', 0);
      doc.setGState(doc.GState({ opacity: 1 }));
    }

    // Descargar PDF
    doc.save(`Ticket-${pedido.ticket_id}.pdf`);
    toast.success('Ticket descargado correctamente');
  } catch (error) {
    console.error('Error al generar PDF:', error);
    toast.error('Error al generar el PDF');
  }
};
