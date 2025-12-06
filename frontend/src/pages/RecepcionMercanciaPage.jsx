import React, { useState, useEffect } from 'react';
import { PackageCheck, Search, AlertCircle, Eye, History, Package } from 'lucide-react';
import ordenesCompraService from '../services/ordenesCompra.service';
import { Loader } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import RecibirOrdenModal from '../components/ordenes/RecibirOrdenModal';
import HistorialRecepcionesOrden from '../components/ordenes/HistorialRecepcionesOrden';

const RecepcionMercanciaPage = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalRecibirOrden, setModalRecibirOrden] = useState(false);
  const [ordenARecibir, setOrdenARecibir] = useState(null);
  const [modalHistorialRecepciones, setModalHistorialRecepciones] = useState(false);
  const [ordenParaHistorial, setOrdenParaHistorial] = useState(null);
  const { user: usuario } = useAuth();

  useEffect(() => {
    cargarOrdenesPendientes();
  }, []);

  const cargarOrdenesPendientes = async () => {
    try {
      setLoading(true);
      const response = await ordenesCompraService.listarOrdenes();
      const todasOrdenes = response?.data?.ordenes || [];
      // Filtrar solo órdenes enviadas o parciales
      const ordenesPendientes = todasOrdenes.filter(orden =>
        orden.estado === 'enviada' || orden.estado === 'parcial'
      );
      setOrdenes(ordenesPendientes);
    } catch (error) {
      console.error('Error al cargar órdenes:', error);
      toast.error('Error al cargar las órdenes pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirModalRecibir = (orden) => {
    setOrdenARecibir(orden);
    setModalRecibirOrden(true);
  };

  const handleCerrarModalRecibir = () => {
    setModalRecibirOrden(false);
    setOrdenARecibir(null);
  };

  const handleRecepcionExitosa = (ordenActualizada) => {
    // Actualizar la orden en la lista
    setOrdenes(prevOrdenes => {
      const nuevasOrdenes = prevOrdenes.map(o =>
        o.id === ordenActualizada.id ? ordenActualizada : o
      );
      // Si la orden se completó, eliminarla de la lista
      return nuevasOrdenes.filter(o => o.estado !== 'recibida');
    });
    handleCerrarModalRecibir();
  };

  const handleAbrirHistorial = (orden) => {
    setOrdenParaHistorial(orden);
    setModalHistorialRecepciones(true);
  };

  const handleCerrarHistorial = () => {
    setModalHistorialRecepciones(false);
    setOrdenParaHistorial(null);
  };

  const filteredOrdenes = ordenes.filter((orden) => {
    const matchesSearch =
      orden.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.proveedor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.observaciones?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getEstadoBadge = (estado) => {
    const badges = {
      enviada: 'bg-blue-100 text-blue-800',
      parcial: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      enviada: 'Enviada',
      parcial: 'Parcial',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[estado]}`}>
        {labels[estado]}
      </span>
    );
  };

  // Verificar permisos
  console.log('DEBUG ROL:', usuario?.rol, 'Usuario completo:', usuario);
  const puedeRecibir = ['administrador', 'admin', 'almacen', 'compras'].includes(usuario?.rol);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <PackageCheck className="text-green-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Recepción de Mercancía</h1>
          </div>
          <p className="text-gray-600">
            Recibe y registra la mercancía de las órdenes de compra enviadas
          </p>
        </div>

        {/* Barra de búsqueda */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por ticket, proveedor u observaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        {/* Lista de órdenes */}
        {filteredOrdenes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No hay órdenes pendientes de recibir
            </h3>
            <p className="text-gray-500">
              {searchTerm
                ? 'No se encontraron órdenes con esos criterios de búsqueda'
                : 'Todas las órdenes han sido recibidas o están en borrador'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Envío
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artículos
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrdenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{orden.ticket_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {orden.proveedor?.nombre || 'Sin proveedor'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEstadoBadge(orden.estado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {orden.fecha_envio
                            ? new Date(orden.fecha_envio).toLocaleDateString('es-MX')
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${parseFloat(orden.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {orden.detalles?.length || 0} artículo(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {puedeRecibir && (
                            <button
                              onClick={() => handleAbrirModalRecibir(orden)}
                              className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                              title="Recibir mercancía"
                            >
                              <PackageCheck size={16} />
                              Recibir
                            </button>
                          )}
                          <button
                            onClick={() => handleAbrirHistorial(orden)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Ver historial de recepciones"
                          >
                            <History size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Sobre la recepción de mercancía:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Las órdenes aquí mostradas están esperando ser recibidas</li>
                <li>Puedes recibir mercancía de forma parcial o total</li>
                <li>El stock se actualizará automáticamente al registrar cada recepción</li>
                <li>Consulta el historial para ver todas las recepciones de una orden</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      {modalRecibirOrden && ordenARecibir && (
        <RecibirOrdenModal
          isOpen={modalRecibirOrden}
          onClose={handleCerrarModalRecibir}
          orden={ordenARecibir}
          onSuccess={handleRecepcionExitosa}
        />
      )}

      {modalHistorialRecepciones && ordenParaHistorial && (
        <HistorialRecepcionesOrden
          isOpen={modalHistorialRecepciones}
          onClose={handleCerrarHistorial}
          orden={ordenParaHistorial}
        />
      )}
    </div>
  );
};

export default RecepcionMercanciaPage;
