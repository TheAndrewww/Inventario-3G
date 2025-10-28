import { createContext, useState, useContext, useCallback } from 'react';
import articulosService from '../services/articulos.service';

const InventarioContext = createContext(null);

export const useInventario = () => {
  const context = useContext(InventarioContext);
  if (!context) {
    throw new Error('useInventario debe ser usado dentro de InventarioProvider');
  }
  return context;
};

export const InventarioProvider = ({ children }) => {
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });

  // Obtener todos los artículos
  const fetchArticulos = useCallback(async (params = {}) => {
    console.log('Context: fetchArticulos llamado con params:', params);
    setLoading(true);
    setError(null);
    try {
      const response = await articulosService.getAll(params);
      console.log('Context: fetchArticulos respuesta:', response);
      if (response.success) {
        console.log('Context: Actualizando artículos, cantidad:', response.data.articulos.length);
        setArticulos(response.data.articulos);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error al obtener artículos:', err);
      setError(err.message || 'Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar artículos
  const searchArticulos = useCallback(async (filtros) => {
    setLoading(true);
    setError(null);
    try {
      const response = await articulosService.search(filtros);
      if (response.success) {
        setArticulos(response.data.articulos);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error al buscar artículos:', err);
      setError(err.message || 'Error al buscar artículos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear artículo
  const crearArticulo = async (articuloData) => {
    try {
      const response = await articulosService.create(articuloData);
      if (response.success) {
        // Recargar la lista
        await fetchArticulos();
        return response.data;
      }
    } catch (err) {
      console.error('Error al crear artículo:', err);
      throw err;
    }
  };

  // Actualizar artículo
  const actualizarArticulo = async (id, articuloData) => {
    try {
      const response = await articulosService.update(id, articuloData);
      if (response.success) {
        // Actualizar el artículo en la lista
        setArticulos((prev) =>
          prev.map((art) =>
            art.id === id ? response.data.articulo : art
          )
        );
        return response.data;
      }
    } catch (err) {
      console.error('Error al actualizar artículo:', err);
      throw err;
    }
  };

  // Eliminar artículo
  const eliminarArticulo = async (id) => {
    try {
      console.log('Context: Eliminando artículo con ID:', id);
      const response = await articulosService.delete(id);
      console.log('Context: Respuesta del servicio:', response);

      if (response.success) {
        console.log('Context: Recargando lista de artículos...');
        await fetchArticulos();
        console.log('Context: Lista recargada, artículos actuales:', articulos.length);
        return response;
      } else {
        console.error('Context: Response.success es false');
      }
    } catch (err) {
      console.error('Context: Error al eliminar artículo:', err);
      throw err;
    }
  };

  // Obtener artículo por ID
  const getArticuloById = async (id) => {
    try {
      const response = await articulosService.getById(id);
      if (response.success) {
        return response.data.articulo;
      }
    } catch (err) {
      console.error('Error al obtener artículo:', err);
      throw err;
    }
  };

  // Regenerar QR
  const regenerarQR = async (id) => {
    try {
      const response = await articulosService.regenerarQR(id);
      if (response.success) {
        // Actualizar el artículo en la lista
        await fetchArticulos();
        return response.data;
      }
    } catch (err) {
      console.error('Error al regenerar QR:', err);
      throw err;
    }
  };

  const value = {
    articulos,
    loading,
    error,
    pagination,
    fetchArticulos,
    searchArticulos,
    crearArticulo,
    actualizarArticulo,
    eliminarArticulo,
    getArticuloById,
    regenerarQR,
  };

  return (
    <InventarioContext.Provider value={value}>
      {children}
    </InventarioContext.Provider>
  );
};

export default InventarioContext;
