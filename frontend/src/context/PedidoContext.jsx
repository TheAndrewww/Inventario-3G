import { createContext, useContext, useState, useCallback } from 'react';
import movimientosService from '../services/movimientos.service';

const PedidoContext = createContext();

export const usePedido = () => {
  const context = useContext(PedidoContext);
  if (!context) {
    throw new Error('usePedido debe usarse dentro de un PedidoProvider');
  }
  return context;
};

export const PedidoProvider = ({ children }) => {
  // Estado del carrito (artículos en el pedido)
  const [carrito, setCarrito] = useState([]);

  // Información adicional del pedido
  const [infoPedido, setInfoPedido] = useState({
    tipo: 'retiro', // 'retiro', 'devolucion', 'ajuste'
    observaciones: '',
    proyecto: '',
    supervisor_id: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Agregar artículo al carrito
   */
  const agregarArticulo = useCallback((articulo, cantidad = 1, observaciones = '') => {
    setCarrito((prev) => {
      // Verificar si el artículo ya existe en el carrito
      const existe = prev.find((item) => item.articulo_id === articulo.id);

      if (existe) {
        // Si existe, actualizar cantidad
        return prev.map((item) =>
          item.articulo_id === articulo.id
            ? {
                ...item,
                cantidad: parseFloat(item.cantidad) + parseFloat(cantidad),
                observaciones: observaciones || item.observaciones
              }
            : item
        );
      }

      // Si no existe, agregarlo
      return [
        ...prev,
        {
          articulo_id: articulo.id,
          articulo, // Guardamos el objeto completo para mostrar info
          cantidad: parseFloat(cantidad),
          observaciones,
        },
      ];
    });
  }, []);

  /**
   * Actualizar cantidad de un artículo
   */
  const actualizarCantidad = useCallback((articulo_id, cantidad) => {
    if (cantidad <= 0) {
      eliminarArticulo(articulo_id);
      return;
    }

    setCarrito((prev) =>
      prev.map((item) =>
        item.articulo_id === articulo_id
          ? { ...item, cantidad: parseFloat(cantidad) }
          : item
      )
    );
  }, []);

  /**
   * Actualizar observaciones de un artículo
   */
  const actualizarObservaciones = useCallback((articulo_id, observaciones) => {
    setCarrito((prev) =>
      prev.map((item) =>
        item.articulo_id === articulo_id
          ? { ...item, observaciones }
          : item
      )
    );
  }, []);

  /**
   * Eliminar artículo del carrito
   */
  const eliminarArticulo = useCallback((articulo_id) => {
    setCarrito((prev) => prev.filter((item) => item.articulo_id !== articulo_id));
  }, []);

  /**
   * Limpiar el carrito
   */
  const limpiarCarrito = useCallback(() => {
    setCarrito([]);
    setInfoPedido({
      tipo: 'retiro',
      observaciones: '',
      proyecto: '',
      supervisor_id: null,
    });
    setError(null);
  }, []);

  /**
   * Actualizar información del pedido
   */
  const actualizarInfoPedido = useCallback((info) => {
    setInfoPedido((prev) => ({ ...prev, ...info }));
  }, []);

  /**
   * Validar el pedido antes de finalizarlo
   */
  const validarPedido = useCallback(() => {
    if (carrito.length === 0) {
      throw new Error('El carrito está vacío. Agrega al menos un artículo.');
    }

    // Validar cantidades para retiros y ajustes negativos
    if (infoPedido.tipo === 'retiro' || infoPedido.tipo === 'ajuste') {
      for (const item of carrito) {
        if (item.cantidad > item.articulo.stock_actual) {
          throw new Error(
            `No hay suficiente stock de "${item.articulo.nombre}". ` +
            `Stock disponible: ${item.articulo.stock_actual} ${item.articulo.unidad}`
          );
        }
      }
    }

    // Validar cantidades positivas
    for (const item of carrito) {
      if (item.cantidad <= 0) {
        throw new Error(`La cantidad de "${item.articulo.nombre}" debe ser mayor a 0`);
      }
    }

    return true;
  }, [carrito, infoPedido]);

  /**
   * Finalizar pedido (crear movimiento)
   */
  const finalizarPedido = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Validar pedido
      validarPedido();

      // Preparar datos para el backend
      const movimientoData = {
        tipo: infoPedido.tipo,
        articulos: carrito.map((item) => ({
          articulo_id: item.articulo_id,
          cantidad: item.cantidad,
          observaciones: item.observaciones || '',
        })),
        observaciones: infoPedido.observaciones || '',
        proyecto: infoPedido.proyecto || null,
        supervisor_id: infoPedido.supervisor_id || null,
      };

      // Crear el movimiento
      const response = await movimientosService.create(movimientoData);

      // Limpiar el carrito después de crear el movimiento
      limpiarCarrito();

      return response;
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al crear el pedido';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [carrito, infoPedido, validarPedido, limpiarCarrito]);

  /**
   * Obtener el total de artículos en el carrito
   */
  const getTotalArticulos = useCallback(() => {
    return carrito.length;
  }, [carrito]);

  /**
   * Obtener el total de unidades en el carrito
   */
  const getTotalUnidades = useCallback(() => {
    return carrito.reduce((acc, item) => acc + parseFloat(item.cantidad), 0);
  }, [carrito]);

  /**
   * Obtener el valor total del carrito
   */
  const getValorTotal = useCallback(() => {
    return carrito.reduce((acc, item) => {
      return acc + parseFloat(item.cantidad) * parseFloat(item.articulo.costo_unitario);
    }, 0);
  }, [carrito]);

  /**
   * Verificar si un artículo está en el carrito
   */
  const estaEnCarrito = useCallback((articulo_id) => {
    return carrito.some((item) => item.articulo_id === articulo_id);
  }, [carrito]);

  /**
   * Obtener item del carrito por articulo_id
   */
  const getItemCarrito = useCallback((articulo_id) => {
    return carrito.find((item) => item.articulo_id === articulo_id);
  }, [carrito]);

  const value = {
    // Estado
    carrito,
    infoPedido,
    loading,
    error,

    // Acciones
    agregarArticulo,
    actualizarCantidad,
    actualizarObservaciones,
    eliminarArticulo,
    limpiarCarrito,
    actualizarInfoPedido,
    finalizarPedido,

    // Helpers
    getTotalArticulos,
    getTotalUnidades,
    getValorTotal,
    estaEnCarrito,
    getItemCarrito,
  };

  return <PedidoContext.Provider value={value}>{children}</PedidoContext.Provider>;
};

export default PedidoContext;
