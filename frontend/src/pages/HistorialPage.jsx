import React, { useState, useEffect } from 'react';
import { Search, Download } from 'lucide-react';
import movimientosService from '../services/movimientos.service';
import { Loader, Modal } from '../components/common';
import toast from 'react-hot-toast';
import { generateTicketPDF } from '../utils/pdfGenerator';

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
                        onClick={() => generateTicketPDF(item)}
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
