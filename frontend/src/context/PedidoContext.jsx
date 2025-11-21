import React, { createContext, useContext, useState, useEffect } from 'react';

const PedidoContext = createContext();

export const usePedido = () => {
  const context = useContext(PedidoContext);
  if (!context) {
    throw new Error('usePedido debe ser usado dentro de un PedidoProvider');
  }
  return context;
};

export const PedidoProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  // Cargar pedido desde localStorage al iniciar
  useEffect(() => {
    const savedPedido = localStorage.getItem('pedido');
    if (savedPedido) {
      try {
        setItems(JSON.parse(savedPedido));
      } catch (error) {
        console.error('Error al cargar pedido:', error);
      }
    }
  }, []);

  // Guardar pedido en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('pedido', JSON.stringify(items));
  }, [items]);

  // Agregar artículo al pedido
  const agregarArticulo = (articulo, cantidad = 1) => {
    setItems((prevItems) => {
      const existe = prevItems.find((item) => item.id === articulo.id);
      if (existe) {
        return prevItems.map((item) =>
          item.id === articulo.id
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        );
      } else {
        // Agregar nuevo artículo al INICIO del array (arriba)
        return [{ ...articulo, cantidad }, ...prevItems];
      }
    });
  };

  // Eliminar artículo del pedido
  const eliminarArticulo = (id) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  // Actualizar cantidad de un artículo
  const actualizarCantidad = (id, cantidad) => {
    if (cantidad <= 0) {
      eliminarArticulo(id);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, cantidad } : item
      )
    );
  };

  // Incrementar cantidad
  const incrementar = (id) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
      )
    );
  };

  // Decrementar cantidad
  const decrementar = (id) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  };

  // Limpiar pedido
  const limpiarPedido = () => {
    setItems([]);
    localStorage.removeItem('pedido');
  };

  // Obtener total de artículos
  const getTotalItems = () => {
    return items.length;
  };

  // Obtener total de piezas
  const getTotalPiezas = () => {
    return items.reduce((sum, item) => sum + item.cantidad, 0);
  };

  // Obtener costo total
  const getCostoTotal = () => {
    return items.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0);
  };

  const value = {
    items,
    agregarArticulo,
    eliminarArticulo,
    actualizarCantidad,
    incrementar,
    decrementar,
    limpiarPedido,
    getTotalItems,
    getTotalPiezas,
    getCostoTotal,
  };

  return <PedidoContext.Provider value={value}>{children}</PedidoContext.Provider>;
};

export default PedidoContext;
