import React, { useState, useEffect } from 'react';
import { Truck, Plus, Edit, Trash2, Package } from 'lucide-react';
import camionetasService from '../services/camionetas.service';
import usuariosService from '../services/usuarios.service';
import ubicacionesService from '../services/ubicaciones.service';
import InventarioCamionetaModal from '../components/camionetas/InventarioCamionetaModal';
import toast from 'react-hot-toast';

const CamionetasPage = () => {
  const [camionetas, setCamionetas] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [camionetaEditando, setCamionetaEditando] = useState(null);
  const [mostrarInventario, setMostrarInventario] = useState(false);
  const [camionetaInventario, setCamionetaInventario] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    encargado_id: '',
    matricula: '',
    tipo_camioneta: 'general',
    almacen_base_id: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await Promise.all([cargarCamionetas(), cargarEncargados(), cargarUbicaciones()]);
  };

  const cargarCamionetas = async () => {
    try {
      setCargando(true);
      const response = await camionetasService.obtenerTodos();
      setCamionetas(response.data.camionetas || []);
    } catch (error) {
      console.error('Error al cargar camionetas:', error);
      toast.error('Error al cargar camionetas');
    } finally {
      setCargando(false);
    }
  };

  const cargarEncargados = async () => {
    try {
      const response = await usuariosService.obtenerEncargados();
      setEncargados(response.data.encargados || []);
    } catch (error) {
      console.error('Error al cargar encargados:', error);
      toast.error('Error al cargar encargados');
    }
  };

  const cargarUbicaciones = async () => {
    try {
      const ubicaciones = await ubicacionesService.getAll();
      setUbicaciones(ubicaciones || []);
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
      toast.error('Error al cargar ubicaciones');
    }
  };

  const abrirModalNuevo = () => {
    setCamionetaEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      encargado_id: '',
      matricula: '',
      tipo_camioneta: 'general',
      almacen_base_id: ''
    });
    setMostrarModal(true);
  };

  const abrirModalEditar = (camioneta) => {
    setCamionetaEditando(camioneta);
    setFormData({
      nombre: camioneta.nombre,
      descripcion: camioneta.descripcion || '',
      encargado_id: camioneta.encargado_id,
      matricula: camioneta.matricula || '',
      tipo_camioneta: camioneta.tipo_camioneta || 'general',
      almacen_base_id: camioneta.almacen_base_id || ''
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setCamionetaEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      encargado_id: '',
      matricula: '',
      tipo_camioneta: 'general',
      almacen_base_id: ''
    });
  };

  const abrirInventario = (camioneta) => {
    setCamionetaInventario(camioneta);
    setMostrarInventario(true);
  };

  const cerrarInventario = () => {
    setMostrarInventario(false);
    setCamionetaInventario(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre de la camioneta es obligatorio');
      return;
    }

    if (!formData.encargado_id) {
      toast.error('Debes seleccionar un encargado');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        almacen_base_id: formData.almacen_base_id || null,
        matricula: formData.matricula || null
      };

      if (camionetaEditando) {
        await camionetasService.actualizar(camionetaEditando.id, dataToSend);
        toast.success('Camioneta actualizada exitosamente');
      } else {
        await camionetasService.crear(dataToSend);
        toast.success('Camioneta creada exitosamente');
      }
      cerrarModal();
      cargarCamionetas();
    } catch (error) {
      console.error('Error al guardar camioneta:', error);
      toast.error(error.response?.data?.message || 'Error al guardar la camioneta');
    }
  };

  const handleEliminar = async (camionetaId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta camioneta?')) {
      return;
    }

    try {
      await camionetasService.eliminar(camionetaId);
      toast.success('Camioneta eliminada exitosamente');
      cargarCamionetas();
    } catch (error) {
      console.error('Error al eliminar camioneta:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar la camioneta');
    }
  };

  const getTipoCamionetaBadge = (tipo) => {
    const tipos = {
      instalacion: { label: 'Instalación', color: 'bg-blue-100 text-blue-800' },
      mantenimiento: { label: 'Mantenimiento', color: 'bg-green-100 text-green-800' },
      supervision: { label: 'Supervisión', color: 'bg-purple-100 text-purple-800' },
      general: { label: 'General', color: 'bg-gray-100 text-gray-800' }
    };

    const tipoInfo = tipos[tipo] || tipos.general;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tipoInfo.color}`}>
        {tipoInfo.label}
      </span>
    );
  };

  if (cargando) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Camionetas</h1>
          <p className="text-gray-600 mt-1">
            Administra los vehículos de la empresa y su inventario
          </p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium"
        >
          <Plus size={20} />
          Nueva Camioneta
        </button>
      </div>

      {/* Lista de camionetas */}
      {camionetas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Truck size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay camionetas registradas
          </h3>
          <p className="text-gray-600 mb-4">
            Registra tu primera camioneta para comenzar
          </p>
          <button
            onClick={abrirModalNuevo}
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            Crear Camioneta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {camionetas.map((camioneta) => (
            <div
              key={camioneta.id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:border-red-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Truck size={24} className="text-red-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{camioneta.nombre}</h3>
                    <div className="flex gap-2 mt-1">
                      {getTipoCamionetaBadge(camioneta.tipo_camioneta)}
                      {camioneta.matricula && (
                        <span className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded">
                          {camioneta.matricula}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {camioneta.descripcion && (
                <p className="text-sm text-gray-600 mb-4">
                  {camioneta.descripcion}
                </p>
              )}

              <div className="space-y-3 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Encargado</p>
                  <p className="font-medium text-gray-900">
                    {camioneta.encargado?.nombre || 'Sin asignar'}
                  </p>
                </div>

                {camioneta.almacenBase && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Almacén Base</p>
                    <p className="font-medium text-blue-900">
                      {camioneta.almacenBase.nombre}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => abrirInventario(camioneta)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Package size={16} />
                  Ver Inventario
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirModalEditar(camioneta)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(camioneta.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de crear/editar camioneta */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Truck size={24} className="text-red-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {camionetaEditando ? 'Editar Camioneta' : 'Nueva Camioneta'}
                </h3>
                <p className="text-sm text-gray-600">
                  {camionetaEditando ? 'Actualiza la información' : 'Completa los datos de la camioneta'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Camioneta *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Camioneta Norte 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Matrícula / Placas
                  </label>
                  <input
                    type="text"
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value.toUpperCase() })}
                    placeholder="Ej: ABC-1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Camioneta *
                  </label>
                  <select
                    value={formData.tipo_camioneta}
                    onChange={(e) => setFormData({ ...formData, tipo_camioneta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  >
                    <option value="general">General</option>
                    <option value="instalacion">Instalación</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="supervision">Supervisión</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Encargado *
                  </label>
                  <select
                    value={formData.encargado_id}
                    onChange={(e) => setFormData({ ...formData, encargado_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  >
                    <option value="">Selecciona un encargado</option>
                    {encargados.map((encargado) => (
                      <option key={encargado.id} value={encargado.id}>
                        {encargado.nombre}
                      </option>
                    ))}
                  </select>
                  {encargados.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      No hay encargados disponibles. Crea un usuario con rol encargado primero.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Almacén Base
                </label>
                <select
                  value={formData.almacen_base_id}
                  onChange={(e) => setFormData({ ...formData, almacen_base_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                >
                  <option value="">Sin almacén base</option>
                  {ubicaciones.map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>
                      {ubicacion.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Almacén donde se estaciona habitualmente la camioneta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción de la camioneta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium"
                >
                  {camionetaEditando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de inventario */}
      {mostrarInventario && (
        <InventarioCamionetaModal
          camioneta={camionetaInventario}
          onClose={cerrarInventario}
        />
      )}
    </div>
  );
};

export default CamionetasPage;
