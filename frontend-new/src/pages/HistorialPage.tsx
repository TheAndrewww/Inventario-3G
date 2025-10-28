import React, { useEffect, useState } from 'react';
import { Search, History as HistoryIcon } from 'lucide-react';
import type { Movimiento } from '../types';
import movimientosService from '../services/movimientos.service';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

const HistorialPage: React.FC = () => {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMovimientos();
  }, []);

  const loadMovimientos = async () => {
    try {
      const data = await movimientosService.getAll();
      setMovimientos(data);
    } catch (error) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const filteredMovimientos = movimientos.filter(item =>
    item.ticket_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.usuario?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatHora = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const getTotalPiezas = (movimiento: Movimiento) => {
    return movimiento.detalles?.reduce((sum, detalle) => sum + detalle.cantidad, 0) || 0;
  };

  const getEstadoBadge = (tipo: string) => {
    const colors = {
      retiro: 'bg-green-100 text-green-800',
      devolucion: 'bg-blue-100 text-blue-800',
      ajuste: 'bg-yellow-100 text-yellow-800',
    };
    return colors[tipo as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
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
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
        />
        <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          Filtros
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Ticket</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piezas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMovimientos.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">
                  {item.ticket_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatFecha(item.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatHora(item.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.usuario?.nombre || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{getTotalPiezas(item)} pzas</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadge(item.tipo)}`}>
                    {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button className="text-red-700 hover:text-red-900 font-medium">
                    Ver Detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMovimientos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <HistoryIcon size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No se encontraron movimientos</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorialPage;
