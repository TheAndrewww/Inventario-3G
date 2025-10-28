import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Modal } from '../components/common';
import movimientosService from '../services/movimientos.service';
import toast from 'react-hot-toast';
import { Search, History as HistoryIcon } from 'lucide-react';

const HistorialPage = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modalDetalle, setModalDetalle] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);

  useEffect(() => {
    fetchMovimientos();
  }, [fechaDesde, fechaHasta]);

  const fetchMovimientos = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;

      const response = await movimientosService.getAll(params);
      const data = response.success && response.data?.movimientos
        ? response.data.movimientos
        : response.movimientos || response || [];
      setMovimientos(data);
    } catch (err) {
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  const filteredMovimientos = movimientos.filter(mov => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      mov.ticket_id?.toLowerCase().includes(search) ||
      mov.usuario?.nombre?.toLowerCase().includes(search)
    );
  });

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Barra de búsqueda */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por ID, usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-700"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Piezas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMovimientos.map((item) => {
                  const fecha = new Date(item.created_at);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">
                        {item.ticket_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {fecha.toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.usuario?.nombre || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{item.detalles?.length || 0} pzas</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Completado
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => {
                            setMovimientoSeleccionado(item);
                            setModalDetalle(true);
                          }}
                          className="text-red-700 hover:text-red-900 font-medium"
                        >
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Detalle */}
      <Modal
        isOpen={modalDetalle}
        onClose={() => setModalDetalle(false)}
        title={`Movimiento #${movimientoSeleccionado?.id}`}
        size="lg"
      >
        {movimientoSeleccionado && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Ticket: <span className="font-mono font-bold">{movimientoSeleccionado.ticket_id}</span></p>
              <p className="text-sm text-gray-600">Usuario: <span className="font-medium">{movimientoSeleccionado.usuario?.nombre}</span></p>
              <p className="text-sm text-gray-600">Fecha: <span className="font-medium">{new Date(movimientoSeleccionado.created_at).toLocaleString('es-MX')}</span></p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Artículos:</h4>
              <div className="space-y-2">
                {movimientoSeleccionado.detalles?.map((det, idx) => (
                  <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span>{det.articulo?.nombre || 'N/A'}</span>
                    <span className="font-medium">{det.cantidad} pzas</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default HistorialPage;
