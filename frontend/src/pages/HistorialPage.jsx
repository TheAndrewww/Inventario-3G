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

  const generatePDF = (movimiento) => {
    const doc = new jsPDF();

    // Logo y encabezado
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38); // Rojo de 3G
    doc.text('INVENTARIO 3G', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Ticket de Movimiento', 105, 30, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Información del ticket
    doc.setFontSize(11);
    let yPos = 45;

    doc.setFont(undefined, 'bold');
    doc.text('ID Ticket:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(movimiento.ticket_id || 'N/A', 60, yPos);

    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text('Fecha:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(
      `${new Date(movimiento.createdAt).toLocaleDateString('es-MX')} ${new Date(movimiento.createdAt).toLocaleTimeString('es-MX')}`,
      60,
      yPos
    );

    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text('Usuario:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(movimiento.usuario?.nombre || 'N/A', 60, yPos);

    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text('Tipo:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(movimiento.tipo || 'N/A', 60, yPos);

    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text('Estado:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(movimiento.estado === 'pendiente_aprobacion' ? 'Pendiente Aprobación' : movimiento.estado || 'N/A', 60, yPos);

    if (movimiento.proyecto) {
      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Proyecto:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.proyecto, 60, yPos);
    }

    if (movimiento.tipo_pedido) {
      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Tipo de Pedido:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.tipo_pedido, 60, yPos);
    }

    if (movimiento.equipo) {
      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Equipo:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.equipo.nombre, 60, yPos);
    }

    if (movimiento.aprobadoPor) {
      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Aprobado/Rechazado por:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(movimiento.aprobadoPor.nombre, 60, yPos);

      if (movimiento.fecha_aprobacion) {
        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text('Fecha Aprobación:', 20, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(
          `${new Date(movimiento.fecha_aprobacion).toLocaleDateString('es-MX')} ${new Date(movimiento.fecha_aprobacion).toLocaleTimeString('es-MX')}`,
          60,
          yPos
        );
      }
    }

    if (movimiento.observaciones) {
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text('Observaciones:', 20, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      const splitObservaciones = doc.splitTextToSize(movimiento.observaciones, 170);
      doc.text(splitObservaciones, 20, yPos);
      yPos += splitObservaciones.length * 5;
    }

    if (movimiento.motivo_rechazo) {
      yPos += 10;
      doc.setTextColor(220, 38, 38);
      doc.setFont(undefined, 'bold');
      doc.text('Motivo de Rechazo:', 20, yPos);
      yPos += 6;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      const splitMotivo = doc.splitTextToSize(movimiento.motivo_rechazo, 170);
      doc.text(splitMotivo, 20, yPos);
      yPos += splitMotivo.length * 5;
      doc.setTextColor(0, 0, 0);
    }

    // Tabla de artículos
    yPos += 15;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Artículos:', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);

    // Encabezados de tabla
    doc.setFillColor(220, 38, 38);
    doc.rect(20, yPos - 5, 170, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Artículo', 22, yPos);
    doc.text('Cantidad', 130, yPos);
    doc.text('Observaciones', 155, yPos);

    doc.setTextColor(0, 0, 0);
    yPos += 8;

    // Filas de artículos
    movimiento.detalles?.forEach((detalle, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const bgColor = index % 2 === 0 ? 245 : 255;
      doc.setFillColor(bgColor, bgColor, bgColor);
      doc.rect(20, yPos - 5, 170, 7, 'F');

      const articuloText = doc.splitTextToSize(
        detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`,
        100
      );
      doc.text(articuloText, 22, yPos);

      doc.text(`${detalle.cantidad} ${detalle.articulo?.unidad || 'uds'}`, 130, yPos);

      const obsText = detalle.observaciones || '-';
      const splitObs = doc.splitTextToSize(obsText, 30);
      doc.text(splitObs, 155, yPos);

      yPos += Math.max(articuloText.length * 5, splitObs.length * 5, 7);
    });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX')}`,
        105,
        285,
        { align: 'center' }
      );
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    // Descargar PDF
    doc.save(`Ticket-${movimiento.ticket_id}.pdf`);
    toast.success('PDF descargado correctamente');
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
                    {new Date(item.createdAt).toLocaleDateString('es-MX')} {new Date(item.createdAt).toLocaleTimeString('es-MX')}
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
                  {new Date(selectedMovimiento.createdAt).toLocaleDateString('es-MX')} {new Date(selectedMovimiento.createdAt).toLocaleTimeString('es-MX')}
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
