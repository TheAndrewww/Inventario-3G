import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Search, Shield, UserCheck, UserX } from 'lucide-react';
import usuariosService from '../services/usuarios.service';
import toast from 'react-hot-toast';

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: '',
    puesto: '',
    telefono: '',
    activo: true
  });

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const response = await usuariosService.obtenerTodos();
      setUsuarios(response.data.usuarios || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setUsuarioEditando(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: '',
      puesto: '',
      telefono: '',
      activo: true
    });
    setMostrarModal(true);
  };

  const abrirModalEditar = (usuario) => {
    setUsuarioEditando(usuario);
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '', // No mostramos la contraseña actual
      rol: usuario.rol,
      puesto: usuario.puesto || '',
      telefono: usuario.telefono || '',
      activo: usuario.activo
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setUsuarioEditando(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      rol: '',
      puesto: '',
      telefono: '',
      activo: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.nombre.trim() || !formData.email.trim() || !formData.rol) {
      toast.error('Nombre, email y rol son obligatorios');
      return;
    }

    if (!usuarioEditando && !formData.password.trim()) {
      toast.error('La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    try {
      const datos = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim(),
        rol: formData.rol,
        puesto: formData.puesto.trim() || null,
        telefono: formData.telefono.trim() || null,
        activo: formData.activo
      };

      // Solo incluir password si se proporciona
      if (formData.password.trim()) {
        datos.password = formData.password;
      }

      if (usuarioEditando) {
        await usuariosService.actualizar(usuarioEditando.id, datos);
        toast.success('Usuario actualizado exitosamente');
      } else {
        await usuariosService.crear(datos);
        toast.success('Usuario creado exitosamente');
      }

      cerrarModal();
      cargarUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el usuario');
    }
  };

  const handleEliminar = async (usuarioId) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este usuario?')) {
      return;
    }

    try {
      await usuariosService.eliminar(usuarioId);
      toast.success('Usuario desactivado exitosamente');
      cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el usuario');
    }
  };

  const getRolColor = (rol) => {
    switch (rol) {
      case 'administrador':
        return 'bg-purple-100 text-purple-800';
      case 'encargado':
        return 'bg-blue-100 text-blue-800';
      case 'diseñador':
        return 'bg-green-100 text-green-800';
      case 'almacen':
        return 'bg-yellow-100 text-yellow-800';
      case 'compras':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRolIcon = (rol) => {
    switch (rol) {
      case 'administrador':
        return <Shield size={16} />;
      case 'encargado':
      case 'diseñador':
      case 'almacen':
        return <UserCheck size={16} />;
      default:
        return <UserX size={16} />;
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchBusqueda =
      usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = filtroRol === '' || usuario.rol === filtroRol;
    return matchBusqueda && matchRol;
  });

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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600 mt-1">
            Administra los usuarios del sistema
          </p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium"
        >
          <UserPlus size={20} />
          Nuevo Usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
        </div>
        <div>
          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          >
            <option value="">Todos los roles</option>
            <option value="administrador">Administrador</option>
            <option value="encargado">Encargado</option>
            <option value="diseñador">Diseñador</option>
            <option value="almacen">Almacén</option>
            <option value="compras">Compras</option>
          </select>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Puesto
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No se encontraron usuarios
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold">
                        {usuario.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nombre}
                        </div>
                        {usuario.telefono && (
                          <div className="text-sm text-gray-500">{usuario.telefono}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {usuario.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${getRolColor(
                        usuario.rol
                      )}`}
                    >
                      {getRolIcon(usuario.rol)}
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {usuario.puesto || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        usuario.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      onClick={() => abrirModalEditar(usuario)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      <Edit size={18} className="inline" />
                    </button>
                    <button
                      onClick={() => handleEliminar(usuario.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                      disabled={!usuario.activo}
                    >
                      <Trash2 size={18} className="inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de crear/editar usuario */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <UserPlus size={24} className="text-red-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <p className="text-sm text-gray-600">
                  {usuarioEditando
                    ? 'Actualiza la información del usuario'
                    : 'Completa los datos del nuevo usuario'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña {usuarioEditando && '(dejar vacío para no cambiar)'}
                    {!usuarioEditando && ' *'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required={!usuarioEditando}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol *
                  </label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    required
                  >
                    <option value="">Selecciona un rol</option>
                    <option value="administrador">Administrador</option>
                    <option value="encargado">Encargado</option>
                    <option value="diseñador">Diseñador</option>
                    <option value="almacen">Almacén</option>
                    <option value="compras">Compras</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Puesto
                  </label>
                  <input
                    type="text"
                    value={formData.puesto}
                    onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                    placeholder="Gerente de Operaciones"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="5551234567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  />
                </div>
              </div>

              {usuarioEditando && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-red-700 border-gray-300 rounded focus:ring-red-700"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                    Usuario activo
                  </label>
                </div>
              )}

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
                  {usuarioEditando ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
