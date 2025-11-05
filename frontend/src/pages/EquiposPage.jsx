import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import equiposService from '../services/equipos.service';
import usuariosService from '../services/usuarios.service';
import { Button } from '../components/common';
import toast from 'react-hot-toast';

const EquiposPage = () => {
  const [equipos, setEquipos] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [equipoEditando, setEquipoEditando] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    supervisor_id: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    await Promise.all([cargarEquipos(), cargarEncargados()]);
  };

  const cargarEquipos = async () => {
    try {
      setCargando(true);
      const response = await equiposService.obtenerTodos();
      setEquipos(response.data.equipos || []);
    } catch (error) {
      console.error('Error al cargar equipos:', error);
      toast.error('Error al cargar equipos');
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

  const abrirModalNuevo = () => {
    setEquipoEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      supervisor_id: ''
    });
    setMostrarModal(true);
  };

  const abrirModalEditar = (equipo) => {
    setEquipoEditando(equipo);
    setFormData({
      nombre: equipo.nombre,
      descripcion: equipo.descripcion || '',
      supervisor_id: equipo.supervisor_id
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEquipoEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      supervisor_id: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre del equipo es obligatorio');
      return;
    }

    if (!formData.supervisor_id) {
      toast.error('Debes seleccionar un encargado');
      return;
    }

    try {
      if (equipoEditando) {
        await equiposService.actualizar(equipoEditando.id, formData);
        toast.success('Equipo actualizado exitosamente');
      } else {
        await equiposService.crear(formData);
        toast.success('Equipo creado exitosamente');
      }
      cerrarModal();
      cargarEquipos();
    } catch (error) {
      console.error('Error al guardar equipo:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el equipo');
    }
  };

  const handleEliminar = async (equipoId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este equipo?')) {
      return;
    }

    try {
      await equiposService.eliminar(equipoId);
      toast.success('Equipo eliminado exitosamente');
      cargarEquipos();
    } catch (error) {
      console.error('Error al eliminar equipo:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el equipo');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Equipos</h1>
          <p className="text-gray-600 mt-1">
            Administra los equipos de instalación y supervisión
          </p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium"
        >
          <Plus size={20} />
          Nuevo Equipo
        </button>
      </div>

      {/* Lista de equipos */}
      {equipos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay equipos registrados
          </h3>
          <p className="text-gray-600 mb-4">
            Crea tu primer equipo para comenzar
          </p>
          <button
            onClick={abrirModalNuevo}
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            Crear Equipo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipos.map((equipo) => (
            <div
              key={equipo.id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:border-red-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Users size={24} className="text-red-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{equipo.nombre}</h3>
                    <p className="text-sm text-gray-500">
                      {equipo.activo ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
              </div>

              {equipo.descripcion && (
                <p className="text-sm text-gray-600 mb-4">
                  {equipo.descripcion}
                </p>
              )}

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Encargado</p>
                <p className="font-medium text-gray-900">
                  {equipo.supervisor?.nombre || 'Sin asignar'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => abrirModalEditar(equipo)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(equipo.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de crear/editar equipo */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Users size={24} className="text-red-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {equipoEditando ? 'Editar Equipo' : 'Nuevo Equipo'}
                </h3>
                <p className="text-sm text-gray-600">
                  {equipoEditando ? 'Actualiza la información' : 'Completa los datos del equipo'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Equipo *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Equipo Instalación Norte"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción del equipo..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encargado *
                </label>
                <select
                  value={formData.supervisor_id}
                  onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  required
                >
                  <option value="">Selecciona un encargado</option>
                  {encargados.map((encargado) => (
                    <option key={encargado.id} value={encargado.id}>
                      {encargado.nombre} ({encargado.email})
                    </option>
                  ))}
                </select>
                {encargados.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    No hay encargados disponibles. Crea un usuario con rol encargado primero.
                  </p>
                )}
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
                  {equipoEditando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquiposPage;
