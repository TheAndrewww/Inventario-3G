// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3, g3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useState, useEffect } from 'react';
import { PackageCheck, Search, AlertCircle, Eye, History, Package, Sparkles, ClipboardCheck } from 'lucide-react';
import ordenesCompraService from '../services/ordenesCompra.service';
import { Loader } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import RecibirOrdenModal from '../components/ordenes/RecibirOrdenModal';
import HistorialRecepcionesOrden from '../components/ordenes/HistorialRecepcionesOrden';
import RecibirConFacturaModal from '../components/ordenes/RecibirConFacturaModal';
import ConteoRecepcionModal from '../components/ordenes/ConteoRecepcionModal';
import { useDiseno3G } from '../diseno-3g/useDiseno3G';
import CabG3 from '../diseno-3g/CabG3';
import MasAcciones from '../diseno-3g/MasAcciones';
import { cx, etq } from '../diseno-3g/dialogosG3';
// Rediseño 2 · vista encendida (apagado no la usa)
import { useDiseno3G as useDiseno3GR2 } from '../rediseno2/fundacion/useDiseno3G';
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
  const g3 = useDiseno3G(); // Diseño 3G: encabezado, estados, tabla en tarjetas y un botón principal por renglón (apagado, lo de siempre)
  const d3 = useDiseno3GR2(); // Rediseño 2: vista nueva encendida (abajo, antes del return de siempre)
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

  const getEstadoBadge = (estado) => {
    const badges = {
      enviada: 'bg-blue-100 text-blue-800',
      parcial: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      enviada: 'Enviada',
      parcial: 'Parcial',
    };
    // VIEJO: se borra a partir del 24-oct-2026 — g3 siempre es true; lo que corre con g3 en false (después de este if o en su else) es lo viejo.
    if (g3) return <span className={`g3-estado ${estado === 'parcial' ? 'g3-estado--aviso' : 'g3-estado--info'}`}>{estado === 'parcial' ? 'Recibida en parte' : labels[estado]}</span>;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[estado]}`}>
        {labels[estado]}
      </span>
    );
  };

  // Verificar permisos
  const puedeRecibir = ['administrador', 'admin', 'almacen', 'compras'].includes(usuario?.rol);

  // Rediseño 2 · vista ENCENDIDA. Mismo estado, mismas peticiones y mismos manejadores; el conteo y el historial se montan
  // con las mismas props de abajo (cada uno pinta su versión nueva encendido). El JSX de hoy sigue intacto debajo.
  // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
  if (d3) {
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 g3:!min-h-0 g3:!bg-transparent g3:max-md:!p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        {g3 ? (
          <CabG3 titulo="Recepción de mercancía" descripcion="Recibe y registra la mercancía de las órdenes de compra enviadas: con foto de la factura o capturando a mano." />
        ) : (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <PackageCheck className="text-green-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Recepción de Mercancía</h1>
          </div>
          <p className="text-gray-600">
            Recibe y registra la mercancía de las órdenes de compra enviadas
          </p>
        </div>
        )}

        {/* Conteos abiertos: la ventana de reclamo de 7 días */}
        {conteosAbiertos.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow border-l-4 border-blue-500 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="text-blue-600" size={20} />
              <h2 className="font-semibold text-gray-900">Pendientes de contar</h2>
              <span className="text-sm text-gray-500">
                ({conteosAbiertos.length}) · ventana de reclamo de 7 días
              </span>
            </div>
            <div className="space-y-2">
              {conteosAbiertos.map((conteo) => (
                <div
                  key={conteo.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${conteo.vencido ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {conteo.ticket_id} · {conteo.proveedor || 'Sin proveedor'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {conteo.articulos.length} artículo(s) ·{' '}
                      {conteo.vencido
                        ? 'la ventana ya venció, se cerrará sola'
                        : `quedan ${conteo.dias_restantes} día(s)`}
                    </p>
                  </div>
                  <button
                    onClick={() => setConteoActivo(conteo)}
                    className={g3 ? 'g3-btn g3-btn--tonal g3-btn--ch shrink-0' : 'shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg'}
                  >
                    Contar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div className={g3 ? undefined : 'bg-white rounded-lg shadow overflow-hidden'}>
            <div className={cx('overflow-x-auto', g3 && 'g3-tabla g3-tabla--tarjetas')}>
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
                      {g3 ? 'Fecha de envío' : 'Fecha Envío'}
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
                      <td className={cx('px-6 py-4 whitespace-nowrap', g3 && 'g3-celda-titulo')}>
                        <div className="text-sm font-medium text-gray-900">{orden.ticket_id}</div>
                      </td>
                      <td className="px-6 py-4" {...etq(g3, 'Proveedor')}>
                        <div className="text-sm text-gray-900">
                          {orden.proveedor?.nombre || 'Sin proveedor'}
                        </div>
                      </td>
                      <td className={cx('px-6 py-4 whitespace-nowrap', g3 && 'g3-celda-estado')}>
                        {getEstadoBadge(orden.estado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" {...etq(g3, 'Fecha de envío')}>
                        <div className="text-sm text-gray-900">
                          {orden.fecha_envio
                            ? new Date(orden.fecha_envio).toLocaleDateString('es-MX')
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" {...etq(g3, 'Total')}>
                        <div className="text-sm font-semibold text-gray-900">
                          ${parseFloat(orden.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" {...etq(g3, 'Artículos')}>
                        <div className="text-sm text-gray-600">
                          {orden.detalles?.length || 0} artículo(s)
                        </div>
                      </td>
                      <td className={cx('px-6 py-4 whitespace-nowrap text-center', g3 && 'g3-celda-acciones')}>
                        {g3 ? (
                          <div className="flex items-center justify-end gap-2">
                            {puedeRecibir ? (
                              <>
                                <button type="button" onClick={() => setOrdenConFactura(orden)} className="g3-btn g3-btn--primario g3-btn--ch" title="Recibir tomando foto de la factura">
                                  <Sparkles size={16} aria-hidden="true" /> Recibir con factura
                                </button>
                                <MasAcciones titulo={orden.ticket_id} acciones={[
                                  { texto: 'Recibir capturando a mano', icono: PackageCheck, onClick: () => handleAbrirModalRecibir(orden) },
                                  { texto: 'Historial de recepciones', icono: History, onClick: () => handleAbrirHistorial(orden) },
                                ]} />
                              </>
                            ) : (
                              <button type="button" onClick={() => handleAbrirHistorial(orden)} className="g3-btn g3-btn--ch">
                                <History size={16} aria-hidden="true" /> Historial de recepciones
                              </button>
                            )}
                          </div>
                        ) : (
                        <div className="flex items-center justify-center gap-2">
                          {puedeRecibir && (
                            <>
                              <button
                                onClick={() => setOrdenConFactura(orden)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                title="Recibir tomando foto de la factura"
                              >
                                <Sparkles size={16} />
                                Con factura
                              </button>
                              <button
                                onClick={() => handleAbrirModalRecibir(orden)}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                title="Recibir capturando a mano"
                              >
                                <PackageCheck size={16} />
                                Recibir
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleAbrirHistorial(orden)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Ver historial de recepciones"
                          >
                            <History size={18} />
                          </button>
                        </div>
                        )}
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

      {ordenConFactura && (
        <RecibirConFacturaModal
          isOpen={!!ordenConFactura}
          onClose={() => setOrdenConFactura(null)}
          orden={ordenConFactura}
          onSuccess={(data) => {
            if (data?.orden) handleRecepcionExitosa(data.orden);
            setOrdenConFactura(null);
            cargarConteosAbiertos();
          }}
        />
      )}

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
    </div>
  );
};

export default RecepcionMercanciaPage;
