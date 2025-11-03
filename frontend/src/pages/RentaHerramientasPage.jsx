import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Wrench, UserCheck, RotateCcw, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import movimientosService from '../services/movimientos.service';
import articulosService from '../services/articulos.service';
import usuariosService from '../services/usuarios.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const RentaHerramientasPage = () => {
  const [herramientasRentadas, setHerramientasRentadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalRetiro, setModalRetiro] = useState(false);
  const [modalDevolucion, setModalDevolucion] = useState(false);
  const [retiroSeleccionado, setRetiroSeleccionado] = useState(null);
  const { user } = useAuth();

  // Solo supervisores y administradores pueden acceder
  const puedeGestionar = ['administrador', 'supervisor'].includes(user?.rol);

  useEffect(() => {
    if (puedeGestionar) {
      fetchHerramientasRentadas();
    }
  }, [puedeGestionar]);

  const fetchHerramientasRentadas = async () => {
    try {
      setLoading(true);
      // Obtener retiros que no han sido devueltos (sin devolución correspondiente)
      const response = await movimientosService.getHistorial({ tipo: 'retiro' });

      // Filtrar solo los retiros de herramientas (al menos un artículo debe ser herramienta)
      const retirosHerramientas = response.data?.movimientos?.filter(mov => {
        // Verificar si es un retiro completado y contiene al menos una herramienta
        if (mov.estado !== 'completado') return false;

        // Verificar si alguno de los artículos es una herramienta
        const tieneHerramientas = mov.detalles?.some(detalle =>
          detalle.articulo?.es_herramienta === true
        );

        return tieneHerramientas;
      });

      setHerramientasRentadas(retirosHerramientas || []);
    } catch (error) {
      console.error('Error al cargar herramientas rentadas:', error);
      toast.error('Error al cargar las herramientas rentadas');
    } finally {
      setLoading(false);
    }
  };

  const handleNuevoRetiro = () => {
    setModalRetiro(true);
  };

  const handleDevolucion = (retiro) => {
    setRetiroSeleccionado(retiro);
    setModalDevolucion(true);
  };

  const herramientasFiltradas = herramientasRentadas.filter((retiro) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      retiro.usuario?.nombre?.toLowerCase().includes(searchLower) ||
      retiro.proyecto?.toLowerCase().includes(searchLower) ||
      retiro.detalles?.some(detalle =>
        detalle.articulo?.nombre?.toLowerCase().includes(searchLower)
      )
    );
  });

  // Agrupar por persona
  const herramientasPorPersona = React.useMemo(() => {
    const grupos = {};
    herramientasFiltradas.forEach(retiro => {
      const nombrePersona = retiro.usuario?.nombre || 'Desconocido';
      if (!grupos[nombrePersona]) {
        grupos[nombrePersona] = {
          usuario: retiro.usuario,
          retiros: []
        };
      }
      grupos[nombrePersona].retiros.push(retiro);
    });
    return grupos;
  }, [herramientasFiltradas]);

  if (!puedeGestionar) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Renta de Herramientas</h1>
        <p className="text-gray-600">
          Gestiona el préstamo y devolución de herramientas del inventario
        </p>
      </div>

      {/* Barra de acciones */}
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por persona, proyecto o herramienta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>

        <Button
          onClick={handleNuevoRetiro}
          className="bg-red-700 hover:bg-red-800 text-white"
        >
          <Plus size={20} />
          Nueva Renta
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Herramientas Rentadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {herramientasRentadas.reduce((total, retiro) =>
                  total + (retiro.detalles?.length || 0), 0
                )}
              </p>
            </div>
            <Wrench className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Personas con Herramientas</p>
              <p className="text-2xl font-bold text-gray-900">
                {Object.keys(herramientasPorPersona).length}
              </p>
            </div>
            <UserCheck className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Retiros</p>
              <p className="text-2xl font-bold text-gray-900">
                {herramientasRentadas.length}
              </p>
            </div>
            <Package className="text-orange-500" size={32} />
          </div>
        </div>
      </div>

      {/* Lista de herramientas por persona */}
      {Object.keys(herramientasPorPersona).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Wrench size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No hay herramientas rentadas
          </h3>
          <p className="text-gray-600 mb-6">
            Comienza registrando el préstamo de herramientas a tu equipo
          </p>
          <Button onClick={handleNuevoRetiro} className="bg-red-700 hover:bg-red-800">
            <Plus size={20} />
            Registrar Primera Renta
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(herramientasPorPersona).map(([nombrePersona, data]) => {
            const totalHerramientas = data.retiros.reduce(
              (sum, retiro) => sum + (retiro.detalles?.length || 0), 0
            );

            return (
              <div key={nombrePersona} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Header de la persona */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <UserCheck className="text-red-700" size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{nombrePersona}</h3>
                        <p className="text-sm text-gray-600">
                          {data.usuario?.rol || 'Sin rol'} • {totalHerramientas} herramienta{totalHerramientas !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retiros de esta persona */}
                <div className="divide-y divide-gray-200">
                  {data.retiros.map((retiro) => (
                    <div key={retiro.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{retiro.ticket_id}</span>
                            {retiro.proyecto && (
                              <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                {retiro.proyecto}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(retiro.fecha_hora).toLocaleString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleDevolucion(retiro)}
                          variant="secondary"
                          className="bg-green-50 hover:bg-green-100 text-green-700"
                        >
                          <RotateCcw size={16} />
                          Registrar Devolución
                        </Button>
                      </div>

                      {/* Herramientas del retiro */}
                      <div className="space-y-2">
                        {retiro.detalles?.map((detalle, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Wrench className="text-gray-400" size={18} />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {detalle.articulo?.nombre}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Cantidad: {detalle.cantidad} {detalle.articulo?.unidad}
                                </p>
                              </div>
                            </div>
                            {detalle.observaciones && (
                              <div className="text-sm text-gray-600 max-w-xs">
                                <AlertCircle size={14} className="inline mr-1" />
                                {detalle.observaciones}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {retiro.observaciones && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <strong>Nota:</strong> {retiro.observaciones}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nuevo Retiro */}
      {modalRetiro && (
        <ModalNuevoRetiro
          isOpen={modalRetiro}
          onClose={() => setModalRetiro(false)}
          onSuccess={() => {
            setModalRetiro(false);
            fetchHerramientasRentadas();
          }}
        />
      )}

      {/* Modal Devolución */}
      {modalDevolucion && retiroSeleccionado && (
        <ModalDevolucion
          isOpen={modalDevolucion}
          retiro={retiroSeleccionado}
          onClose={() => {
            setModalDevolucion(false);
            setRetiroSeleccionado(null);
          }}
          onSuccess={() => {
            setModalDevolucion(false);
            setRetiroSeleccionado(null);
            fetchHerramientasRentadas();
          }}
        />
      )}
    </div>
  );
};

// Modal para nuevo retiro
const ModalNuevoRetiro = ({ isOpen, onClose, onSuccess }) => {
  const [articulos, setArticulos] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  useEffect(() => {
    fetchDatos();
  }, []);

  const fetchDatos = async () => {
    try {
      const [artData, supData] = await Promise.all([
        articulosService.getAll(),
        usuariosService.getSupervisores()
      ]);

      // Filtrar solo artículos marcados como herramientas
      const herramientas = (Array.isArray(artData) ? artData : []).filter(art => art.es_herramienta === true);
      setArticulos(herramientas);
      setSupervisores(Array.isArray(supData) ? supData : []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    }
  };

  const articulosFiltrados = articulos.filter((art) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      art.nombre?.toLowerCase().includes(searchLower) ||
      art.codigo_ean13?.includes(searchTerm) ||
      art.categoria?.nombre?.toLowerCase().includes(searchLower)
    );
  });

  const handleSeleccionarArticulo = (articulo) => {
    const yaExiste = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

    if (yaExiste) {
      toast.error('Esta herramienta ya está en la lista');
      return;
    }

    setArticulosSeleccionados([
      ...articulosSeleccionados,
      {
        articulo_id: articulo.id,
        articulo: articulo,
        cantidad: 1
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!supervisorSeleccionado) {
      toast.error('Selecciona un supervisor');
      return;
    }

    if (articulosSeleccionados.length === 0) {
      toast.error('Debe agregar al menos una herramienta');
      return;
    }

    try {
      setLoading(true);

      const supervisor = supervisores.find(s => s.id === parseInt(supervisorSeleccionado));
      const nombreSupervisor = supervisor?.nombre || 'Desconocido';

      const movimientoData = {
        tipo: 'retiro',
        articulos: articulosSeleccionados.map(item => ({
          articulo_id: item.articulo_id,
          cantidad: parseFloat(item.cantidad),
          observaciones: item.observaciones
        })),
        proyecto: `${nombreSupervisor}${proyecto ? ` - ${proyecto}` : ''}`,
        observaciones: observaciones.trim() || undefined
      };

      await movimientosService.crearRetiro(movimientoData);
      toast.success('Renta registrada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error al crear retiro:', error);
      toast.error(error.message || 'Error al registrar la renta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Renta de Herramienta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supervisor *
          </label>
          <select
            value={supervisorSeleccionado}
            onChange={(e) => setSupervisorSeleccionado(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            required
          >
            <option value="">Seleccionar supervisor...</option>
            {supervisores.map(supervisor => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.nombre} - {supervisor.puesto || 'Supervisor'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proyecto/Obra (Opcional)
          </label>
          <input
            type="text"
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="Nombre del proyecto u obra"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar y agregar herramientas
          </label>

          <div className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar herramienta..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setMostrarCatalogo(e.target.value.length > 0);
                  }}
                  onFocus={() => setMostrarCatalogo(searchTerm.length > 0)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setMostrarCatalogo(!mostrarCatalogo);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                <Package size={18} />
              </button>
            </div>

            {mostrarCatalogo && articulosFiltrados.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {articulosFiltrados.map((articulo) => (
                  <button
                    key={articulo.id}
                    type="button"
                    onClick={() => handleSeleccionarArticulo(articulo)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{articulo.nombre}</p>
                    <p className="text-sm text-gray-600">
                      Stock: {articulo.stock_actual} {articulo.unidad}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {articulosSeleccionados.length > 0 && (
            <div className="space-y-2">
              {articulosSeleccionados.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{item.articulo.nombre}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoverArticulo(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => handleCantidadChange(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                    max={item.articulo.stock_actual}
                    required
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            rows="3"
            placeholder="Notas adicionales..."
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || articulosSeleccionados.length === 0}>
            {loading ? 'Registrando...' : 'Registrar Renta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para devolución
const ModalDevolucion = ({ isOpen, retiro, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [observaciones, setObservaciones] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const devolucionData = {
        tipo: 'devolucion',
        articulos: retiro.detalles.map(detalle => ({
          articulo_id: detalle.articulo_id,
          cantidad: detalle.cantidad
        })),
        proyecto: `Devolución de ${retiro.usuario?.nombre || 'usuario'} - ${retiro.ticket_id}`,
        observaciones: observaciones.trim() || `Devolución del retiro ${retiro.ticket_id}`
      };

      await movimientosService.create(devolucionData);
      toast.success('Devolución registrada exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error al registrar devolución:', error);
      toast.error(error.response?.data?.message || 'Error al registrar la devolución');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Devolución">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-2">
            <strong>Retiro:</strong> {retiro.ticket_id}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Persona:</strong> {retiro.usuario?.nombre || 'Desconocido'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Herramientas a devolver
          </label>
          <div className="space-y-2">
            {retiro.detalles?.map((detalle, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{detalle.articulo?.nombre}</p>
                <p className="text-sm text-gray-600">
                  Cantidad: {detalle.cantidad} {detalle.articulo?.unidad}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones (Estado de la herramienta)
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            rows="3"
            placeholder="Ej: En buen estado, con desgaste normal, requiere mantenimiento, etc."
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Registrando...' : 'Confirmar Devolución'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RentaHerramientasPage;
