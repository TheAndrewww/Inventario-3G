import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { ItemCarrito, Articulo } from '../types';

interface PedidoContextType {
  carrito: ItemCarrito[];
  agregarArticulo: (articulo: Articulo, cantidad?: number) => void;
  incrementarCantidad: (articuloId: number) => void;
  decrementarCantidad: (articuloId: number) => void;
  eliminarArticulo: (articuloId: number) => void;
  actualizarCantidad: (articuloId: number, cantidad: number) => void;
  vaciarCarrito: () => void;
  totalPiezas: number;
  totalCosto: number;
}

const PedidoContext = createContext<PedidoContextType | undefined>(undefined);

export const usePedido = () => {
  const context = useContext(PedidoContext);
  if (!context) {
    throw new Error('usePedido must be used within a PedidoProvider');
  }
  return context;
};

interface PedidoProviderProps {
  children: ReactNode;
}

export const PedidoProvider: React.FC<PedidoProviderProps> = ({ children }) => {
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  const agregarArticulo = (articulo: Articulo, cantidad: number = 1) => {
    setCarrito((prevCarrito) => {
      const existente = prevCarrito.find(item => item.articulo_id === articulo.id);
      if (existente) {
        return prevCarrito.map(item =>
          item.articulo_id === articulo.id
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        );
      } else {
        return [...prevCarrito, { articulo_id: articulo.id, articulo, cantidad }];
      }
    });
  };

  const incrementarCantidad = (articuloId: number) => {
    setCarrito((prevCarrito) =>
      prevCarrito.map(item =>
        item.articulo_id === articuloId
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      )
    );
  };

  const decrementarCantidad = (articuloId: number) => {
    setCarrito((prevCarrito) =>
      prevCarrito.map(item =>
        item.articulo_id === articuloId && item.cantidad > 1
          ? { ...item, cantidad: item.cantidad - 1 }
          : item
      )
    );
  };

  const eliminarArticulo = (articuloId: number) => {
    setCarrito((prevCarrito) => prevCarrito.filter(item => item.articulo_id !== articuloId));
  };

  const actualizarCantidad = (articuloId: number, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarArticulo(articuloId);
    } else {
      setCarrito((prevCarrito) =>
        prevCarrito.map(item =>
          item.articulo_id === articuloId
            ? { ...item, cantidad }
            : item
        )
      );
    }
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const totalPiezas = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCosto = carrito.reduce((sum, item) => sum + (item.cantidad * item.articulo.costo_unitario), 0);

  const value: PedidoContextType = {
    carrito,
    agregarArticulo,
    incrementarCantidad,
    decrementarCantidad,
    eliminarArticulo,
    actualizarCantidad,
    vaciarCarrito,
    totalPiezas,
    totalCosto,
  };

  return <PedidoContext.Provider value={value}>{children}</PedidoContext.Provider>;
};
