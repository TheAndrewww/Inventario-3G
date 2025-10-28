import { useState, useEffect } from 'react';
import { Input, Button } from '../common';
import { Package, AlertCircle } from 'lucide-react';

const ArticuloForm = ({ articulo = null, onSubmit, onCancel, loading = false }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria_id: '',
    ubicacion_id: '',
    stock_actual: '',
    stock_minimo: '',
    unidad: 'piezas',
    costo_unitario: '',
  });

  const [errors, setErrors] = useState({});

  // Opciones hardcodeadas (idealmente vendrían del backend)
  const categorias = [
    { id: 1, nombre: 'Ferretería' },
    { id: 2, nombre: 'Soldadura' },
    { id: 3, nombre: 'Eléctrico' },
    { id: 4, nombre: 'Pintura' },
    { id: 5, nombre: 'Herramientas' },
    { id: 6, nombre: 'Textil' },
    { id: 7, nombre: 'Construcción' },
    { id: 8, nombre: 'Otros' },
  ];

  const ubicaciones = [
    { id: 1, codigo: 'A-01', descripcion: 'Pasillo A, Estante 01, Nivel 1' },
    { id: 2, codigo: 'A-02', descripcion: 'Pasillo A, Estante 02, Nivel 1' },
    { id: 3, codigo: 'A-03', descripcion: 'Pasillo A, Estante 03, Nivel 1' },
    { id: 4, codigo: 'B-01', descripcion: 'Pasillo B, Estante 01, Nivel 1' },
    { id: 5, codigo: 'B-02', descripcion: 'Pasillo B, Estante 02, Nivel 1' },
    { id: 6, codigo: 'C-01', descripcion: 'Pasillo C, Estante 01, Nivel 1' },
    { id: 7, codigo: 'ALMACEN-2', descripcion: 'Almacén secundario' },
  ];

  const unidades = [
    'piezas',
    'kg',
    'metros',
    'litros',
    'cajas',
    'paquetes',
    'rollos',
    'galones',
  ];

  // Cargar datos del artículo si estamos editando
  useEffect(() => {
    if (articulo) {
      setFormData({
        nombre: articulo.nombre || '',
        descripcion: articulo.descripcion || '',
        categoria_id: articulo.categoria_id || '',
        ubicacion_id: articulo.ubicacion_id || '',
        stock_actual: articulo.stock_actual || '',
        stock_minimo: articulo.stock_minimo || '',
        unidad: articulo.unidad || 'piezas',
        costo_unitario: articulo.costo_unitario || '',
      });
    }
  }, [articulo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error del campo
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }
    if (!formData.categoria_id) {
      newErrors.categoria_id = 'La categoría es requerida';
    }
    if (!formData.ubicacion_id) {
      newErrors.ubicacion_id = 'La ubicación es requerida';
    }
    if (!formData.stock_actual || parseFloat(formData.stock_actual) < 0) {
      newErrors.stock_actual = 'El stock actual debe ser mayor o igual a 0';
    }
    if (!formData.stock_minimo || parseFloat(formData.stock_minimo) < 0) {
      newErrors.stock_minimo = 'El stock mínimo debe ser mayor o igual a 0';
    }
    if (!formData.costo_unitario || parseFloat(formData.costo_unitario) < 0) {
      newErrors.costo_unitario = 'El costo unitario debe ser mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Convertir strings a números
    const dataToSubmit = {
      ...formData,
      categoria_id: parseInt(formData.categoria_id),
      ubicacion_id: parseInt(formData.ubicacion_id),
      stock_actual: parseFloat(formData.stock_actual),
      stock_minimo: parseFloat(formData.stock_minimo),
      costo_unitario: parseFloat(formData.costo_unitario),
    };

    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nombre */}
      <Input
        label="Nombre del Artículo"
        name="nombre"
        value={formData.nombre}
        onChange={handleChange}
        error={errors.nombre}
        required
        disabled={loading}
        placeholder="Ej: Tornillo hexagonal 1/4"
        icon={<Package className="w-5 h-5 text-gray-400" />}
      />

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          disabled={loading}
          rows={3}
          placeholder="Descripción detallada del artículo..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Categoría y Ubicación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            name="categoria_id"
            value={formData.categoria_id}
            onChange={handleChange}
            disabled={loading}
            className={`block w-full rounded-lg border ${errors.categoria_id ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            <option value="">Seleccionar categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
          {errors.categoria_id && (
            <p className="mt-1 text-sm text-red-600">{errors.categoria_id}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación <span className="text-red-500">*</span>
          </label>
          <select
            name="ubicacion_id"
            value={formData.ubicacion_id}
            onChange={handleChange}
            disabled={loading}
            className={`block w-full rounded-lg border ${errors.ubicacion_id ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          >
            <option value="">Seleccionar ubicación</option>
            {ubicaciones.map((ub) => (
              <option key={ub.id} value={ub.id}>
                {ub.codigo} - {ub.descripcion}
              </option>
            ))}
          </select>
          {errors.ubicacion_id && (
            <p className="mt-1 text-sm text-red-600">{errors.ubicacion_id}</p>
          )}
        </div>
      </div>

      {/* Stock y Unidad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Stock Actual"
          name="stock_actual"
          type="number"
          step="0.01"
          value={formData.stock_actual}
          onChange={handleChange}
          error={errors.stock_actual}
          required
          disabled={loading}
          placeholder="100"
        />

        <Input
          label="Stock Mínimo"
          name="stock_minimo"
          type="number"
          step="0.01"
          value={formData.stock_minimo}
          onChange={handleChange}
          error={errors.stock_minimo}
          required
          disabled={loading}
          placeholder="20"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unidad
          </label>
          <select
            name="unidad"
            value={formData.unidad}
            onChange={handleChange}
            disabled={loading}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {unidades.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Costo Unitario */}
      <Input
        label="Costo Unitario (MXN)"
        name="costo_unitario"
        type="number"
        step="0.01"
        value={formData.costo_unitario}
        onChange={handleChange}
        error={errors.costo_unitario}
        required
        disabled={loading}
        placeholder="2.50"
      />

      {/* Alerta si el stock actual es bajo */}
      {formData.stock_actual && formData.stock_minimo && parseFloat(formData.stock_actual) <= parseFloat(formData.stock_minimo) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            El stock actual es igual o menor que el stock mínimo. Se generará una alerta automáticamente.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading}
        >
          {articulo ? 'Actualizar Artículo' : 'Crear Artículo'}
        </Button>
      </div>
    </form>
  );
};

export default ArticuloForm;
