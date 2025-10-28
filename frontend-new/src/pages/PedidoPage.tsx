import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { usePedido } from '../context/PedidoContext';
import { useAuth } from '../context/AuthContext';
import movimientosService from '../services/movimientos.service';
import toast from 'react-hot-toast';

const PedidoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { carrito, incrementarCantidad, decrementarCantidad, eliminarArticulo, vaciarCarrito, totalPiezas, totalCosto } = usePedido();
  const [loading, setLoading] = useState(false);

  const handleFinalizarPedido = async () => {
    if (carrito.length === 0) return;

    setLoading(true);
    try {
      const movimiento = await movimientosService.create({
        tipo: 'retiro',
        detalles: carrito.map(item => ({
          articulo_id: item.articulo_id,
          cantidad: item.cantidad,
          observaciones: item.observaciones,
        })),
      });

      toast.success('Pedido finalizado exitosamente');
      vaciarCarrito();
      navigate(`/ticket/${movimiento.ticket_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Articulos en el Pedido</h3>

            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg">No hay articulos en el pedido</p>
                <button
                  onClick={() => navigate('/inventario')}
                  className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
                >
                  Ver Inventario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {carrito.map((item) => (
                  <div key={item.articulo_id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                      📦
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.articulo.nombre}</h4>
                      <p className="text-sm text-gray-500">ID: {item.articulo.id} • ${item.articulo.costo_unitario.toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => decrementarCantidad(item.articulo_id)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-lg font-bold w-12 text-center">{item.cantidad}</span>
                      <button
                        onClick={() => incrementarCantidad(item.articulo_id)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="font-bold text-gray-900">${(item.cantidad * item.articulo.costo_unitario).toFixed(2)}</p>
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

        <div className="col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Total de articulos:</span>
                <span className="font-medium">{carrito.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total de piezas:</span>
                <span className="font-medium">{totalPiezas}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-bold text-gray-900">Costo Total:</span>
                <span className="font-bold text-xl text-red-700">${totalCosto.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                disabled={carrito.length === 0 || loading}
                onClick={handleFinalizarPedido}
                className="w-full py-3 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Procesando...' : 'Finalizar Pedido'}
              </button>
              <button
                disabled={carrito.length === 0}
                onClick={vaciarCarrito}
                className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vaciar Carrito
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Informacion</h4>
              <p className="text-sm text-gray-600">
                Usuario: <span className="font-medium">{user?.nombre || 'N/A'}</span>
              </p>
              <p className="text-sm text-gray-600">
                Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-MX')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidoPage;
