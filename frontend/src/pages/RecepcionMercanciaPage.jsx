import React, { useState, useEffect } from 'react';
import ordenesCompraService from '../services/ordenesCompra.service';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import HistorialRecepcionesOrden from '../components/ordenes/HistorialRecepcionesOrden';
import ConteoRecepcionModal from '../components/ordenes/ConteoRecepcionModal';
import VistaRecepcionR2 from '../rediseno2/compras/VistaRecepcion';

const RecepcionMercanciaPage = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalRecibirOrden, setModalRecibirOrden] = useState(false);
  const [ordenARecibir, setOrdenARecibir] = useState(null);
  const [modalHistorialRecepciones, setModalHistorialRecepciones] = useState(false);
  const [ordenParaHistorial, setOrdenParaHistorial] = useState(null);
  const [ordenConFactura, setOrdenConFactura] = useState(null);
  const [conteosAbiertos, setConteosAbiertos] = useState([]);
  const [conteoActivo, setConteoActivo] = useState(null);
  const { user: usuario } = useAuth();
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

  useEffect(() => {
    cargarOrdenesPendientes();
    cargarConteosAbiertos();
  }, []);

  const cargarConteosAbiertos = async () => {
    try {
      const conteos = await ordenesCompraService.listarConteosAbiertos();
      setConteosAbiertos(conteos || []);
    } catch (error) {
      console.error('Error al cargar conteos abiertos:', error);
    }
  };

  const cargarOrdenesPendientes = async () => {
    try {
      setLoading(true);
      // B6 · PLA-21: con OC_OCULTA_IMPORTES, almacén recibe importes solo en esta lista (como hoy); sin la bandera no cambia nada
      const response = await ordenesCompraService.listarOrdenes({ pantalla: 'recepcion' });
      const todasOrdenes = response?.data?.ordenes || [];
      // Filtrar solo órdenes enviadas o parciales
      const ordenesPendientes = todasOrdenes.filter(orden =>
        orden.estado === 'enviada' || orden.estado === 'parcial'
      );
      setOrdenes(ordenesPendientes);
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar órdenes:', error);
      toast.error('Error al cargar las órdenes pendientes');
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar las órdenes pendientes');
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

  const handleRecepcionExitosa = (respuesta) => {
    // El backend responde { orden, ... }; se acepta también la orden sola
    const ordenActualizada = respuesta?.orden || respuesta;
    if (!ordenActualizada?.id) {
      handleCerrarModalRecibir();
      cargarOrdenesPendientes();
      return;
    }
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

  // Verificar permisos
  const puedeRecibir = ['administrador', 'admin', 'almacen', 'compras'].includes(usuario?.rol);

  return (
    <VistaRecepcionR2
      ordenes={ordenes}
      filteredOrdenes={filteredOrdenes}
      loading={loading}
      errorCarga={errorCargaR2}
      recargar={cargarOrdenesPendientes}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      conteosAbiertos={conteosAbiertos}
      abrirConteo={setConteoActivo}
      puedeRecibir={puedeRecibir}
      ordenMano={modalRecibirOrden ? ordenARecibir : null}
      ordenFactura={ordenConFactura}
      abrirMano={handleAbrirModalRecibir}
      cerrarMano={handleCerrarModalRecibir}
      alExitoMano={handleRecepcionExitosa}
      abrirFactura={setOrdenConFactura}
      cerrarFactura={() => setOrdenConFactura(null)}
      alExitoFactura={(data) => {
        if (data?.orden) handleRecepcionExitosa(data.orden);
        setOrdenConFactura(null);
        cargarConteosAbiertos();
      }}
      abrirHistorial={handleAbrirHistorial}
    >
      {conteoActivo && (
        <ConteoRecepcionModal
          isOpen={!!conteoActivo}
          onClose={() => setConteoActivo(null)}
          conteo={conteoActivo}
          onSuccess={() => {
            cargarConteosAbiertos();
            cargarOrdenesPendientes();
          }}
        />
      )}
      {modalHistorialRecepciones && ordenParaHistorial && (
        <HistorialRecepcionesOrden
          isOpen={modalHistorialRecepciones}
          onClose={handleCerrarHistorial}
          orden={ordenParaHistorial}
        />
      )}
    </VistaRecepcionR2>
  );
};

export default RecepcionMercanciaPage;
