import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import articulosService from '../../services/articulos.service';
import proveedoresService from '../../services/proveedores.service';
import ordenesCompraService from '../../services/ordenesCompra.service';
import CajonEditarOrdenR2 from '../../rediseno2/compras/CajonEditarOrden';

const EditarOrdenModal = ({ isOpen, onClose, orden, onSuccess }) => {
  const [articulos, setArticulos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaLlegadaEstimada, setFechaLlegadaEstimada] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  useEffect(() => {
    if (isOpen && orden) {
      cargarDatos();
    }
  }, [isOpen, orden]);

  const cargarDatos = async () => {
    try {
      // Cargar catálogos
      const [artResult, provResult] = await Promise.allSettled([
        articulosService.getAll(),
        proveedoresService.listar()
      ]);

      // Procesar artículos
      if (artResult.status === 'fulfilled') {
        const artData = artResult.value;
        const articulosArray = Array.isArray(artData) ? artData : [];
        setArticulos(articulosArray);
      }

      // Procesar proveedores
      if (provResult.status === 'fulfilled') {
        const provData = provResult.value;
        const proveedoresArray = Array.isArray(provData)
          ? provData
          : (provData?.data?.proveedores || provData?.data || []);
        setProveedores(proveedoresArray);
      }

      // Pre-cargar datos de la orden
      setProveedorId(orden.proveedor_id || '');
      setObservaciones(orden.observaciones || '');
      setFechaLlegadaEstimada(orden.fecha_llegada_estimada ?
        orden.fecha_llegada_estimada.split('T')[0] : '');

      // Pre-cargar artículos de la orden
      const articulosOrden = orden.detalles.map(detalle => ({
        articulo_id: detalle.articulo.id,
        articulo: detalle.articulo,
        cantidad: parseFloat(detalle.cantidad_solicitada),
        costo_unitario: parseFloat(detalle.costo_unitario)
      }));
      setArticulosSeleccionados(articulosOrden);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    }
  };

  const articulosFiltrados = articulos.filter((art) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      art.nombre?.toLowerCase().includes(searchLower) ||
      art.codigo_ean13?.includes(searchTerm)
    );
  });

  const handleSeleccionarArticulo = (articulo) => {
    const yaExiste = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

    if (yaExiste) {
      toast.error('Este artículo ya está en la lista');
      return;
    }

    setArticulosSeleccionados([
      ...articulosSeleccionados,
      {
        articulo_id: articulo.id,
        articulo: articulo,
        cantidad: 1,
        costo_unitario: articulo.costo_unitario || 0
      }
    ]);

    setSearchTerm('');
    setMostrarCatalogo(false);
    toast.success(`${articulo.nombre} agregado`);
  };

  const handleRemoverArticulo = (index) => {
    setArticulosSeleccionados(articulosSeleccionados.filter((_, i) => i !== index));
  };

  const handleCantidadChange = (index, cantidad) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].cantidad = cantidad;
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleCostoChange = (index, costo) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].costo_unitario = costo;
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (articulosSeleccionados.length === 0) {
      toast.error('Debe agregar al menos un artículo');
      return;
    }

    try {
      setLoading(true);
      const ordenData = {
        articulos: articulosSeleccionados.map(item => ({
          articulo_id: parseInt(item.articulo_id),
          cantidad: parseFloat(item.cantidad),
          costo_unitario: parseFloat(item.costo_unitario)
        })),
        proveedor_id: proveedorId ? parseInt(proveedorId) : undefined,
        observaciones: observaciones.trim() || undefined,
        fecha_llegada_estimada: fechaLlegadaEstimada || undefined
      };

      const response = await ordenesCompraService.actualizarOrden(orden.id, ordenData);

      toast.success('Orden de compra actualizada exitosamente');

      if (onSuccess) {
        onSuccess(response.data?.orden);
      }

      onClose();
    } catch (error) {
      console.error('Error al actualizar orden:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar la orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotal = () => {
    return articulosSeleccionados.reduce((sum, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const costo = parseFloat(item.costo_unitario) || 0;
      return sum + (cantidad * costo);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <CajonEditarOrdenR2
      onClose={onClose}
      orden={orden}
      proveedores={proveedores}
      proveedorId={proveedorId}
      setProveedorId={setProveedorId}
      fechaLlegadaEstimada={fechaLlegadaEstimada}
      setFechaLlegadaEstimada={setFechaLlegadaEstimada}
      observaciones={observaciones}
      setObservaciones={setObservaciones}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      mostrarCatalogo={mostrarCatalogo}
      setMostrarCatalogo={setMostrarCatalogo}
      articulosFiltrados={articulosFiltrados}
      handleSeleccionarArticulo={handleSeleccionarArticulo}
      articulosSeleccionados={articulosSeleccionados}
      handleRemoverArticulo={handleRemoverArticulo}
      handleCantidadChange={handleCantidadChange}
      handleCostoChange={handleCostoChange}
      loading={loading}
      handleSubmit={handleSubmit}
      calcularTotal={calcularTotal}
    />
  );
};

export default EditarOrdenModal;
