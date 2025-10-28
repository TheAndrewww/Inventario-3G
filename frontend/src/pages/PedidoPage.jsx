import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePedido } from '../context/PedidoContext';
import { InventarioProvider } from '../context/InventarioContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Modal } from '../components/common';
import AgregarArticulo from '../components/pedido/AgregarArticulo';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Search,
} from 'lucide-react';

const PedidoContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    carrito,
    infoPedido,
    loading,
    actualizarCantidad,
    eliminarArticulo,
    limpiarCarrito,
    actualizarInfoPedido,
    finalizarPedido,
    getTotalArticulos,
    getTotalUnidades,
    getValorTotal,
  } = usePedido();

  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);

  const handleFinalizar = async () => {
    try {
      const response = await finalizarPedido();
      setModalFinalizar(false);
      toast.success(`Pedido ${response.movimiento.ticket_id} creado exitosamente`);
      navigate('/historial');
    } catch (error) {
      toast.error(error.message || 'Error al crear el pedido');
    }
  };

  const totalPiezas = getTotalUnidades();
  const totalCosto = getValorTotal();

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Columna principal - Artículos */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Artículos en el Pedido
                </h3>
                <button
                  onClick={() => setModalAgregar(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
                >
                  <Search size={16} />
                  Buscar Artículo
                </button>
              </div>

              {carrito.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">No hay artículos en el pedido</p>
                  <button
                    onClick={() => setModalAgregar(true)}
                    className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
                  >
                    Agregar Artículos
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrito.map((item) => (
                    <div
                      key={item.articulo_id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.articulo.nombre}</h4>
                        <p className="text-sm text-gray-500">
                          ID: {item.articulo.id} • ${parseFloat(item.articulo.costo_unitario).toFixed(2)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => actualizarCantidad(item.articulo_id, item.cantidad - 1)}
                          className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-lg font-bold w-12 text-center">{item.cantidad}</span>
                        <button
                          onClick={() => actualizarCantidad(item.articulo_id, item.cantidad + 1)}
                          className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="font-bold text-gray-900">
                          ${(item.cantidad * parseFloat(item.articulo.costo_unitario)).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => eliminarArticulo(item.articulo_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna lateral - Resumen */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Total de artículos:</span>
                  <span className="font-medium">{getTotalArticulos()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total de piezas:</span>
                  <span className="font-medium">{totalPiezas.toFixed(0)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Costo Total:</span>
                  <span className="font-bold text-xl text-red-700">${totalCosto.toFixed(2)}</span>
                </div>
              </div>

              {/* Tipo de movimiento */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de movimiento
                </label>
                <select
                  value={infoPedido.tipo}
                  onChange={(e) => actualizarInfoPedido({ tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                >
                  <option value="retiro">Retiro</option>
                  <option value="devolucion">Devolución</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>

              <div className="space-y-3">
                <button
                  disabled={carrito.length === 0 || loading}
                  onClick={() => setModalFinalizar(true)}
                  className="w-full py-3 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Finalizar Pedido
                </button>
                <button
                  disabled={carrito.length === 0}
                  onClick={limpiarCarrito}
                  className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Vaciar Carrito
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Información</h4>
                <p className="text-sm text-gray-600">
                  Usuario: <span className="font-medium">{user?.nombre}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-MX')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Finalizar */}
      <Modal
        isOpen={modalFinalizar}
        onClose={() => setModalFinalizar(false)}
        title="Finalizar Pedido"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">¿Estás seguro de que deseas finalizar este pedido?</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones generales
            </label>
            <textarea
              value={infoPedido.observaciones}
              onChange={(e) => actualizarInfoPedido({ observaciones: e.target.value })}
              rows={3}
              placeholder="Notas adicionales sobre el pedido..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Resumen:</h4>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700">
                Tipo: <span className="font-medium capitalize">{infoPedido.tipo}</span>
              </p>
              <p className="text-gray-700">
                Artículos: <span className="font-medium">{getTotalArticulos()}</span>
              </p>
              <p className="text-gray-700">
                Total: <span className="font-medium">${getValorTotal().toFixed(2)} MXN</span>
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => setModalFinalizar(false)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleFinalizar}
              disabled={loading}
              className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-300 flex items-center gap-2"
            >
              <CheckCircle size={20} />
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Agregar */}
      <Modal
        isOpen={modalAgregar}
        onClose={() => setModalAgregar(false)}
        title="Agregar Artículo al Pedido"
        size="lg"
      >
        <AgregarArticulo onClose={() => setModalAgregar(false)} />
      </Modal>
    </DashboardLayout>
  );
};

const PedidoPage = () => {
  return (
    <InventarioProvider>
      <PedidoContent />
    </InventarioProvider>
  );
};

export default PedidoPage;
