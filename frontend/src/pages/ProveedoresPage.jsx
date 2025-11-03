import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Package } from 'lucide-react';
import proveedoresService from '../services/proveedores.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';

const ProveedoresPage = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    rfc: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    estado: '',
    codigo_postal: '',
    notas: ''
  });

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const data = await proveedoresService.listar({ activo: true });
      setProveedores(data.data?.proveedores || []);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Error al cargar proveedores');
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (proveedor = null) => {
    if (proveedor) {
      setEditingProveedor(proveedor);
      setFormData({
        nombre: proveedor.nombre || '',
        rfc: proveedor.rfc || '',
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
        ciudad: proveedor.ciudad || '',
        estado: proveedor.estado || '',
        codigo_postal: proveedor.codigo_postal || '',
        notas: proveedor.notas || ''
      });
    } else {
      setEditingProveedor(null);
      setFormData({
        nombre: '',
        rfc: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        estado: '',
        codigo_postal: '',
        notas: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProveedor(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      if (editingProveedor) {
        await proveedoresService.actualizar(editingProveedor.id, formData);
        toast.success('Proveedor actualizado exitosamente');
      } else {
        await proveedoresService.crear(formData);
        toast.success('Proveedor creado exitosamente');
      }
      handleCloseModal();
      fetchProveedores();
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      toast.error(error.message || 'Error al guardar proveedor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este proveedor?')) {
      return;
    }

    try {
      await proveedoresService.eliminar(id);
      toast.success('Proveedor eliminado exitosamente');
      fetchProveedores();
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      toast.error(error.message || 'Error al eliminar proveedor');
    }
  };

  const filteredProveedores = proveedores.filter((proveedor) =>
    proveedor.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.rfc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proveedor.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600">Gestiona los proveedores de artículos</p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Barra de búsqueda */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC o contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
      </div>

      {/* Tabla de proveedores */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RFC</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProveedores.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No se encontraron proveedores
                </td>
              </tr>
            ) : (
              filteredProveedores.map((proveedor) => (
                <tr key={proveedor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{proveedor.nombre}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {proveedor.rfc || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {proveedor.contacto || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {proveedor.telefono || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {proveedor.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(proveedor)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(proveedor.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de crear/editar */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Nombre o razón social"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input
                type="text"
                name="rfc"
                value={formData.rfc}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="RFC del proveedor"
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
              <input
                type="text"
                name="contacto"
                value={formData.contacto}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Persona de contacto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Teléfono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dirección</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  placeholder="Calle, número, colonia"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="Ciudad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input
                    type="text"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="Estado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
                  <input
                    type="text"
                    name="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    placeholder="CP"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Notas adicionales sobre el proveedor..."
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              fullWidth
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
            >
              {editingProveedor ? 'Actualizar' : 'Crear'} Proveedor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProveedoresPage;
