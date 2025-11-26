import React, { useState, useEffect } from 'react';
import { Search, Download } from 'lucide-react';
import movimientosService from '../services/movimientos.service';
import { Loader, Modal } from '../components/common';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';

const HistorialPage = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchHistorial();
  }, []);

  const handleVerDetalles = (movimiento) => {
    setSelectedMovimiento(movimiento);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedMovimiento(null);
  };

  // Función para cargar imagen desde URL y obtener base64 + dimensiones
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

  const generatePDF = async (movimiento) => {
    try {
      const doc = new jsPDF();

      // URLs de los logos
      const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
      const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

      // Cargar imágenes con dimensiones
      const [logoData, marcaAguaData] = await Promise.all([
        loadImageWithDimensions(logoCompletoUrl),
        loadImageWithDimensions(marcaAguaUrl)
      ]);

      // === HEADER ===
      // Logo completo arriba a la izquierda (respetando relación de aspecto)
      if (logoData) {
        const logoWidth = 70; // Ancho deseado en mm
        const logoHeight = logoWidth / logoData.aspectRatio; // Alto calculado
        doc.addImage(logoData.base64, 'PNG', 15, 10, logoWidth, logoHeight);
      }

      // Información a la derecha
      let rightX = 120;
      let rightY = 15;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('SUPERVISOR', rightX, rightY);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.aprobadoPor?.nombre || movimiento.usuario?.nombre || 'N/A', rightX, rightY + 5);

      rightY += 15;
      doc.setFont(undefined, 'bold');
      doc.text('NOMBRE DE PROYECTO', rightX, rightY);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.proyecto || movimiento.equipo?.nombre || 'Sin proyecto', rightX, rightY + 5);

      rightY += 15;
      doc.setFont(undefined, 'bold');
      doc.text('FECHA DE SALIDA:', rightX, rightY);
      doc.setFont(undefined, 'normal');
      const fechaMovimiento = movimiento.created_at || movimiento.createdAt;
      doc.text(
        fechaMovimiento ? new Date(fechaMovimiento).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        rightX,
        rightY + 5
      );

      // === TÍTULO PRINCIPAL ===
      let yPos = 60;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ORDEN DE SALIDA DE PRODUCTOS', 15, yPos);

      yPos += 10;

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      const articulos = movimiento.detalles || [];

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
      const imagenesArticulos = {};
      for (const detalle of articulos) {
        if (detalle.articulo?.imagen_url) {
          try {
            const imagenData = await loadImageWithDimensions(detalle.articulo.imagen_url);
            if (imagenData) {
              imagenesArticulos[detalle.articulo_id] = imagenData;
            }
          } catch (error) {
            console.error(`Error cargando imagen del artículo ${detalle.articulo_id}:`, error);
          }
        }
      }

      // Mostrar artículos por categoría
      doc.setFontSize(10);
      Object.keys(articulosPorCategoria).forEach(categoria => {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        // Nombre de categoría
        doc.setFont(undefined, 'bold');
        doc.text(categoria.toUpperCase(), 15, yPos);
        yPos += 6;

        // Lista de artículos
        doc.setFont(undefined, 'normal');
        articulosPorCategoria[categoria].forEach(detalle => {
          const articuloHeight = 20; // Altura reservada para cada artículo con imagen

          if (yPos + articuloHeight > 240) {
            doc.addPage();
            yPos = 20;
          }

          const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const descripcion = detalle.articulo?.descripcion || '';
          const cantidad = detalle.cantidad;
          const unidad = detalle.articulo?.unidad || 'uds';
          const imagenArticulo = imagenesArticulos[detalle.articulo_id];

          // Dibujar imagen del artículo si existe
          const imgX = 15;
          const imgY = yPos - 2;
          const imgSize = 15; // Tamaño de la imagen en mm
          let textX = 20; // Posición X del texto (sin imagen)

          if (imagenArticulo) {
            // Calcular dimensiones manteniendo aspecto
            const imgWidth = imgSize;
            const imgHeight = imgSize / imagenArticulo.aspectRatio;

            // Dibujar borde alrededor de la imagen
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.rect(imgX, imgY, imgWidth, imgHeight);

            // Agregar imagen
            doc.addImage(imagenArticulo.base64, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            textX = imgX + imgWidth + 3; // Ajustar posición del texto
          }

          // Bullet point con nombre y cantidad
          doc.setFont(undefined, 'bold');
          doc.text(`• ${nombreArticulo} - ${cantidad} ${unidad}`, textX, yPos + 5);
          yPos += 10; // Aumentar espacio después del nombre

          // Descripción en línea separada si existe
          if (descripcion) {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            const maxWidth = 180 - textX;
            const descripcionLines = doc.splitTextToSize(`  ${descripcion}`, maxWidth);
            doc.text(descripcionLines, textX + 2, yPos);
            yPos += descripcionLines.length * 4.5; // Aumentar espacio entre líneas de descripción
            doc.setFontSize(10);
          }

          yPos += imagenArticulo ? Math.max(5, imgSize - 5) : 4; // Más espacio entre artículos
        });

        yPos += 4;
      });

      // === MARCA DE AGUA ===
      if (marcaAguaData) {
        // Configurar opacidad para la marca de agua (efecto difuminado)
        const gState = doc.GState({ opacity: 0.08 });
        doc.setGState(gState);

        // Calcular dimensiones respetando relación de aspecto
        const watermarkWidth = 160; // Ancho más grande
        const watermarkHeight = watermarkWidth / marcaAguaData.aspectRatio;

        // Agregar marca de agua grande, más abajo y a la derecha (cortada)
        doc.addImage(marcaAguaData.base64, 'PNG', 60, 180, watermarkWidth, watermarkHeight, undefined, 'NONE', 0);

        // Restaurar opacidad normal
        doc.setGState(doc.GState({ opacity: 1 }));
      }

      // === FOOTER CON BARRA ROJA ===
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Barra roja
        doc.setFillColor(185, 28, 28); // Rojo oscuro
        doc.rect(0, 280, 210, 17, 'F');

        // Texto en la barra
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('4621302459 | admin@3gvelarias.com', 105, 289, { align: 'center' });
      }

      // Descargar PDF
      doc.save(`Orden-Salida-${movimiento.ticket_id}.pdf`);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const data = await movimientosService.getHistorial();
      // Extraer el array de movimientos de la respuesta
      const movimientosArray = data?.data?.movimientos || data?.movimientos || data || [];
      setMovimientos(Array.isArray(movimientosArray) ? movimientosArray : []);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar el historial');
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovimientos = Array.isArray(movimientos) ? movimientos.filter((item) =>
    item.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.usuario?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.proyecto?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      {/* Barra de búsqueda */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por ID de ticket, usuario o proyecto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
        <input
          type="date"
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
        />
        <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          Filtros
        </button>
      </div>

      {/* Tabla de historial */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Ticket</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMovimientos.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  No se encontraron movimientos
                </td>
              </tr>
            ) : (
              filteredMovimientos.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">
                    {item.ticket_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.created_at || item.createdAt).toLocaleDateString('es-MX')} {new Date(item.created_at || item.createdAt).toLocaleTimeString('es-MX')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.usuario?.nombre || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.proyecto || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.tipo === 'retiro'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.estado === 'completado' ? 'bg-green-100 text-green-800' :
                      item.estado === 'pendiente_aprobacion' ? 'bg-yellow-100 text-yellow-800' :
                      item.estado === 'aprobado' ? 'bg-blue-100 text-blue-800' :
                      item.estado === 'rechazado' ? 'bg-red-100 text-red-800' :
                      item.estado === 'pendiente' ? 'bg-gray-100 text-gray-800' :
                      item.estado === 'cancelado' ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.estado === 'pendiente_aprobacion' ? 'Pendiente Aprobación' : item.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleVerDetalles(item)}
                        className="text-red-700 hover:text-red-900 font-medium"
                      >
                        Ver Detalles
                      </button>
                      <button
                        onClick={() => generatePDF(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
                        title="Descargar PDF"
                      >
                        <Download size={16} />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de detalles */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Detalles del Movimiento"
        size="lg"
      >
        {selectedMovimiento && (
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">ID Ticket</label>
                <p className="text-lg font-mono font-semibold text-gray-900">{selectedMovimiento.ticket_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo</label>
                <p className="text-lg">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedMovimiento.tipo === 'retiro'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedMovimiento.tipo}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Usuario</label>
                <p className="text-lg font-semibold text-gray-900">{selectedMovimiento.usuario?.nombre || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Fecha</label>
                <p className="text-lg text-gray-900">
                  {new Date(selectedMovimiento.created_at || selectedMovimiento.createdAt).toLocaleDateString('es-MX')} {new Date(selectedMovimiento.created_at || selectedMovimiento.createdAt).toLocaleTimeString('es-MX')}
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-500">Estado</label>
                <p className="text-lg">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedMovimiento.estado === 'completado' ? 'bg-green-100 text-green-800' :
                    selectedMovimiento.estado === 'pendiente_aprobacion' ? 'bg-yellow-100 text-yellow-800' :
                    selectedMovimiento.estado === 'aprobado' ? 'bg-blue-100 text-blue-800' :
                    selectedMovimiento.estado === 'rechazado' ? 'bg-red-100 text-red-800' :
                    selectedMovimiento.estado === 'pendiente' ? 'bg-gray-100 text-gray-800' :
                    selectedMovimiento.estado === 'cancelado' ? 'bg-gray-100 text-gray-600' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedMovimiento.estado === 'pendiente_aprobacion' ? 'Pendiente Aprobación' : selectedMovimiento.estado}
                  </span>
                </p>
              </div>
              {selectedMovimiento.tipo_pedido && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Tipo de Pedido</label>
                  <p className="text-lg text-gray-900 capitalize">{selectedMovimiento.tipo_pedido}</p>
                </div>
              )}
              {selectedMovimiento.equipo && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Equipo</label>
                  <p className="text-lg text-gray-900">{selectedMovimiento.equipo.nombre}</p>
                </div>
              )}
              {selectedMovimiento.proyecto && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Proyecto</label>
                  <p className="text-lg text-gray-900">{selectedMovimiento.proyecto}</p>
                </div>
              )}
              {selectedMovimiento.aprobadoPor && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Aprobado/Rechazado por</label>
                  <p className="text-lg text-gray-900">{selectedMovimiento.aprobadoPor.nombre}</p>
                </div>
              )}
              {selectedMovimiento.fecha_aprobacion && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Fecha de Aprobación</label>
                  <p className="text-lg text-gray-900">
                    {new Date(selectedMovimiento.fecha_aprobacion).toLocaleDateString('es-MX')} {new Date(selectedMovimiento.fecha_aprobacion).toLocaleTimeString('es-MX')}
                  </p>
                </div>
              )}
            </div>

            {/* Observaciones */}
            {selectedMovimiento.observaciones && (
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">Observaciones</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedMovimiento.observaciones}</p>
              </div>
            )}

            {/* Motivo de rechazo */}
            {selectedMovimiento.motivo_rechazo && (
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">Motivo de Rechazo</label>
                <p className="text-gray-900 bg-red-50 p-3 rounded-lg border border-red-200">{selectedMovimiento.motivo_rechazo}</p>
              </div>
            )}

            {/* Artículos */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Artículos</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedMovimiento.detalles?.map((detalle, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {detalle.cantidad} {detalle.articulo?.unidad || 'uds'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {detalle.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HistorialPage;
