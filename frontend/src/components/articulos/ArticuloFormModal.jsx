import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Check } from 'lucide-react';
import { Modal, ImageUpload } from '../common';
import toast from 'react-hot-toast';
import categoriasService from '../../services/categorias.service';
import ubicacionesService from '../../services/ubicaciones.service';
import proveedoresService from '../../services/proveedores.service';
import articulosService from '../../services/articulos.service';
import EAN13InputScanner from './EAN13InputScanner';
import { useAuth } from '../../context/AuthContext';

const ArticuloFormModal = ({ isOpen, onClose, onSuccess, articulo = null }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [showNuevoProveedor, setShowNuevoProveedor] = useState(false);
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('');
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [showNuevaUbicacion, setShowNuevaUbicacion] = useState(false);
  const [nuevaUbicacionData, setNuevaUbicacionData] = useState({ codigo: '', descripcion: '' });
  const [creandoUbicacion, setCreandoUbicacion] = useState(false);
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [nuevaCategoriaData, setNuevaCategoriaData] = useState({ nombre: '', descripcion: '' });
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [formData, setFormData] = useState({
    codigo_ean13: '',
    codigo_tipo: 'EAN13',
    nombre: '',
    descripcion: '',
    categoria_id: '',
    ubicacion_id: '',
    proveedor_id: '',
    stock_actual: '',
    stock_minimo: '',
    stock_maximo: '',
    unidad: 'piezas',
    costo_unitario: '',
    es_herramienta: false
  });

  // Tipos de código soportados
  const tiposCodigo = [
    { value: 'EAN13', label: 'EAN-13 (13 dígitos)' },
    { value: 'EAN8', label: 'EAN-8 (8 dígitos)' },
    { value: 'UPCA', label: 'UPC-A (12 dígitos)' },
    { value: 'UPCE', label: 'UPC-E (6-8 dígitos)' },
    { value: 'CODE128', label: 'Code 128 (alfanumérico)' },
    { value: 'CODE39', label: 'Code 39 (alfanumérico)' },
    { value: 'QRCODE', label: 'QR Code' },
    { value: 'DATAMATRIX', label: 'DataMatrix' }
  ];

  const isEdit = !!articulo;

  // Verificar permisos para crear proveedores (solo admin y supervisor)
  const puedeCrearProveedores = ['administrador', 'supervisor'].includes(user?.rol);

  // Cargar catálogos y datos del artículo si es edición
  useEffect(() => {
    if (isOpen) {
      fetchCatalogos();

      if (articulo) {
        setFormData({
          codigo_ean13: articulo.codigo_ean13 || '',
          codigo_tipo: articulo.codigo_tipo || 'EAN13',
          nombre: articulo.nombre || '',
          descripcion: articulo.descripcion || '',
          categoria_id: articulo.categoria_id || '',
          ubicacion_id: articulo.ubicacion_id || '',
          proveedor_id: articulo.proveedor_id || '',
          stock_actual: articulo.stock_actual || '',
          stock_minimo: articulo.stock_minimo || '',
          stock_maximo: articulo.stock_maximo || '',
          unidad: articulo.unidad || 'piezas',
          costo_unitario: articulo.costo_unitario || '',
          es_herramienta: articulo.es_herramienta || false
        });

        // Cargar imagen actual si existe
        if (articulo.imagen_url) {
          setCurrentImageUrl(`${import.meta.env.VITE_BASE_URL || 'http://localhost:5001'}${articulo.imagen_url}`);
        } else {
          setCurrentImageUrl(null);
        }
        setSelectedImage(null);
      } else {
        // Limpiar formulario para nuevo artículo
        setFormData({
          codigo_ean13: '',
          codigo_tipo: 'EAN13',
          nombre: '',
          descripcion: '',
          categoria_id: '',
          ubicacion_id: '',
          proveedor_id: '',
          stock_actual: '',
          stock_minimo: '',
          stock_maximo: '',
          unidad: 'piezas',
          costo_unitario: '',
          es_herramienta: false
        });
        setCurrentImageUrl(null);
        setSelectedImage(null);
      }
    }
  }, [isOpen, articulo]);

  const fetchCatalogos = async () => {
    try {
      const [categoriasData, ubicacionesData, proveedoresResponse] = await Promise.all([
        categoriasService.getAll(),
        ubicacionesService.getAll(),
        proveedoresService.listar({ activo: true })
      ]);

      setCategorias(Array.isArray(categoriasData) ? categoriasData : []);
      setUbicaciones(Array.isArray(ubicacionesData) ? ubicacionesData : []);

      // El servicio devuelve response.data que es { data: { proveedores: [...] } }
      console.log('Respuesta completa de proveedores:', proveedoresResponse);
      const proveedoresList = proveedoresResponse?.data?.proveedores || [];
      setProveedores(proveedoresList);
      console.log('Proveedores cargados:', proveedoresList);
    } catch (error) {
      console.error('Error al cargar catálogos:', error);
      toast.error('Error al cargar catálogos');
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    // Si el usuario selecciona "nuevo_proveedor" en el select
    if (name === 'proveedor_id' && value === 'nuevo_proveedor') {
      setShowNuevoProveedor(true);
      setNuevoProveedorNombre('');
      return;
    }

    // Si el usuario selecciona "nueva_ubicacion" en el select
    if (name === 'ubicacion_id' && value === 'nueva_ubicacion') {
      setShowNuevaUbicacion(true);
      setNuevaUbicacionData({ codigo: '', descripcion: '' });
      return;
    }

    // Si el usuario selecciona "nueva_categoria" en el select
    if (name === 'categoria_id' && value === 'nueva_categoria') {
      setShowNuevaCategoria(true);
      setNuevaCategoriaData({ nombre: '', descripcion: '' });
      return;
    }

    // Convertir a mayúsculas si es un input de texto (excepto números y emails)
    const camposDeTexto = ['nombre', 'descripcion', 'unidad'];
    const finalValue = (type === 'text' && camposDeTexto.includes(name))
      ? value.toUpperCase()
      : value;

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handleCrearProveedorRapido = async () => {
    if (!nuevoProveedorNombre.trim()) {
      toast.error('Ingresa el nombre del proveedor');
      return;
    }

    try {
      setCreandoProveedor(true);
      const response = await proveedoresService.crear({
        nombre: nuevoProveedorNombre.trim()
      });

      const nuevoProveedor = response.data;

      // Agregar el nuevo proveedor a la lista
      setProveedores(prev => [...prev, nuevoProveedor]);

      // Seleccionar el nuevo proveedor
      setFormData(prev => ({
        ...prev,
        proveedor_id: nuevoProveedor.id
      }));

      // Limpiar y ocultar el input
      setShowNuevoProveedor(false);
      setNuevoProveedorNombre('');

      toast.success(`Proveedor "${nuevoProveedor.nombre}" creado exitosamente`);
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      toast.error(error.response?.data?.message || 'Error al crear proveedor');
    } finally {
      setCreandoProveedor(false);
    }
  };

  const handleCancelarNuevoProveedor = () => {
    setShowNuevoProveedor(false);
    setNuevoProveedorNombre('');
    setFormData(prev => ({
      ...prev,
      proveedor_id: ''
    }));
  };

  const handleCrearUbicacionRapido = async () => {
    if (!nuevaUbicacionData.codigo.trim()) {
      toast.error('Ingresa el código de la ubicación');
      return;
    }

    try {
      setCreandoUbicacion(true);
      const response = await ubicacionesService.create({
        codigo: nuevaUbicacionData.codigo.trim(),
        descripcion: nuevaUbicacionData.descripcion.trim() || 'Sin descripción'
      });

      const nuevaUbicacion = response;

      // Agregar la nueva ubicación a la lista
      setUbicaciones(prev => [...prev, nuevaUbicacion]);

      // Seleccionar la nueva ubicación
      setFormData(prev => ({
        ...prev,
        ubicacion_id: nuevaUbicacion.id
      }));

      // Limpiar y ocultar el input
      setShowNuevaUbicacion(false);
      setNuevaUbicacionData({ codigo: '', descripcion: '' });

      toast.success(`Ubicación "${nuevaUbicacion.codigo}" creada exitosamente`);
    } catch (error) {
      console.error('Error al crear ubicación:', error);
      toast.error(error.response?.data?.message || 'Error al crear ubicación');
    } finally {
      setCreandoUbicacion(false);
    }
  };

  const handleCancelarNuevaUbicacion = () => {
    setShowNuevaUbicacion(false);
    setNuevaUbicacionData({ codigo: '', descripcion: '' });
    setFormData(prev => ({
      ...prev,
      ubicacion_id: ''
    }));
  };

  const handleCrearCategoriaRapido = async () => {
    if (!nuevaCategoriaData.nombre.trim()) {
      toast.error('Ingresa el nombre de la categoría');
      return;
    }

    try {
      setCreandoCategoria(true);
      const response = await categoriasService.create({
        nombre: nuevaCategoriaData.nombre.trim(),
        descripcion: nuevaCategoriaData.descripcion.trim() || 'Sin descripción'
      });

      const nuevaCategoria = response;

      // Agregar la nueva categoría a la lista
      setCategorias(prev => [...prev, nuevaCategoria]);

      // Seleccionar la nueva categoría
      setFormData(prev => ({
        ...prev,
        categoria_id: nuevaCategoria.id
      }));

      // Limpiar y ocultar el input
      setShowNuevaCategoria(false);
      setNuevaCategoriaData({ nombre: '', descripcion: '' });

      toast.success(`Categoría "${nuevaCategoria.nombre}" creada exitosamente`);
    } catch (error) {
      console.error('Error al crear categoría:', error);
      toast.error(error.response?.data?.message || 'Error al crear categoría');
    } finally {
      setCreandoCategoria(false);
    }
  };

  const handleCancelarNuevaCategoria = () => {
    setShowNuevaCategoria(false);
    setNuevaCategoriaData({ nombre: '', descripcion: '' });
    setFormData(prev => ({
      ...prev,
      categoria_id: ''
    }));
  };

  const handleEAN13Change = (value) => {
    setFormData(prev => ({
      ...prev,
      codigo_ean13: value
    }));
  };

  // Manejar detección automática del tipo de código
  const handleTypeDetected = (detectedType) => {
    console.log('✓ Tipo detectado automáticamente:', detectedType);
    setFormData(prev => ({
      ...prev,
      codigo_tipo: detectedType
    }));
    // El toast ya se muestra en el scanner con el nombre del tipo
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Advertencia si hay un proveedor sin confirmar
    if (showNuevoProveedor && nuevoProveedorNombre.trim()) {
      toast.error('Tienes un proveedor sin confirmar. Presiona el botón verde para guardarlo o X para cancelar.');
      return;
    }

    // Advertencia si hay una ubicación sin confirmar
    if (showNuevaUbicacion && (nuevaUbicacionData.codigo.trim() || nuevaUbicacionData.descripcion.trim())) {
      toast.error('Tienes una ubicación sin confirmar. Presiona el botón verde para guardarlo o X para cancelar.');
      return;
    }

    // Advertencia si hay una categoría sin confirmar
    if (showNuevaCategoria && (nuevaCategoriaData.nombre.trim() || nuevaCategoriaData.descripcion.trim())) {
      toast.error('Tienes una categoría sin confirmar. Presiona el botón verde para guardarlo o X para cancelar.');
      return;
    }

    // Validaciones
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (!formData.categoria_id) {
      toast.error('Selecciona una categoría');
      return;
    }

    if (!formData.ubicacion_id) {
      toast.error('Selecciona una ubicación');
      return;
    }

    if (!formData.stock_actual || parseFloat(formData.stock_actual) < 0) {
      toast.error('El stock actual debe ser mayor o igual a 0');
      return;
    }

    if (!formData.stock_minimo || parseFloat(formData.stock_minimo) < 0) {
      toast.error('El stock mínimo debe ser mayor o igual a 0');
      return;
    }

    // Validar que si la unidad es "piezas", los stocks sean números enteros
    if (formData.unidad === 'piezas') {
      if (!Number.isInteger(parseFloat(formData.stock_actual))) {
        toast.error('El stock actual debe ser un número entero para piezas');
        return;
      }
      if (!Number.isInteger(parseFloat(formData.stock_minimo))) {
        toast.error('El stock mínimo debe ser un número entero para piezas');
        return;
      }
      if (formData.stock_maximo && !Number.isInteger(parseFloat(formData.stock_maximo))) {
        toast.error('El stock máximo debe ser un número entero para piezas');
        return;
      }
    }

    try {
      setLoading(true);

      const dataToSend = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        categoria_id: parseInt(formData.categoria_id),
        ubicacion_id: parseInt(formData.ubicacion_id),
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
        stock_actual: parseFloat(formData.stock_actual),
        stock_minimo: parseFloat(formData.stock_minimo),
        stock_maximo: formData.stock_maximo ? parseFloat(formData.stock_maximo) : null,
        unidad: formData.unidad,
        costo_unitario: parseFloat(formData.costo_unitario) || 0,
        es_herramienta: formData.es_herramienta
      };

      // Agregar código y tipo solo si se proporcionó un código
      if (formData.codigo_ean13 && formData.codigo_ean13.trim()) {
        dataToSend.codigo_ean13 = formData.codigo_ean13.trim();
        dataToSend.codigo_tipo = formData.codigo_tipo;
      }

      let articuloId;

      if (isEdit) {
        await articulosService.update(articulo.id, dataToSend);
        articuloId = articulo.id;
        toast.success('Artículo actualizado exitosamente');
      } else {
        const response = await articulosService.create(dataToSend);
        articuloId = response.articulo.id;
        const mensaje = dataToSend.codigo_ean13
          ? 'Artículo creado exitosamente con el código proporcionado'
          : 'Artículo creado exitosamente con código EAN-13 automático';
        toast.success(mensaje);
      }

      // Subir imagen si se seleccionó una nueva
      if (selectedImage) {
        try {
          await articulosService.uploadImagen(articuloId, selectedImage);
          toast.success('Imagen subida exitosamente');
        } catch (error) {
          console.error('Error al subir imagen:', error);
          toast.error('Artículo guardado, pero hubo un error al subir la imagen');
        }
      }

      // Limpiar formulario
      setFormData({
        codigo_ean13: '',
        codigo_tipo: 'EAN13',
        nombre: '',
        descripcion: '',
        categoria_id: '',
        ubicacion_id: '',
        proveedor_id: '',
        stock_actual: '',
        stock_minimo: '',
        stock_maximo: '',
        unidad: 'piezas',
        costo_unitario: '',
        es_herramienta: false
      });
      setSelectedImage(null);
      setCurrentImageUrl(null);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al guardar artículo:', error);
      toast.error(error.message || 'Error al guardar artículo');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (file) => {
    setSelectedImage(file);
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setCurrentImageUrl(null);
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        codigo_ean13: '',
        codigo_tipo: 'EAN13',
        nombre: '',
        descripcion: '',
        categoria_id: '',
        ubicacion_id: '',
        proveedor_id: '',
        stock_actual: '',
        stock_minimo: '',
        stock_maximo: '',
        unidad: 'piezas',
        costo_unitario: '',
        es_herramienta: false
      });
      setSelectedImage(null);
      setCurrentImageUrl(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Editar Artículo' : 'Nuevo Artículo'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Código de Barras (solo en creación) */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de Barras / QR (Opcional)
            </label>
            <EAN13InputScanner
              value={formData.codigo_ean13}
              onChange={handleEAN13Change}
              onTypeDetected={handleTypeDetected}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Escanea cualquier código de barras, QR o ingresa manualmente.
              {formData.codigo_tipo === 'EAN13' && ' Si no ingresas uno, se generará automáticamente.'}
            </p>
            {formData.codigo_ean13 && formData.codigo_tipo && (
              <p className="mt-1 text-xs text-green-600 font-medium">
                ✓ Tipo detectado: {tiposCodigo.find(t => t.value === formData.codigo_tipo)?.label}
              </p>
            )}
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="Ej: TORNILLO HEXAGONAL 1/4"
            style={{ textTransform: 'uppercase' }}
            required
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="DESCRIPCIÓN DEL ARTÍCULO..."
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        {/* Imagen del artículo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fotografía del Artículo
          </label>
          <ImageUpload
            currentImage={currentImageUrl}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            disabled={loading}
          />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría <span className="text-red-600">*</span>
          </label>

          {!showNuevaCategoria ? (
            <select
              key={`categoria-select-${categorias.length}`}
              name="categoria_id"
              value={formData.categoria_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              disabled={loading}
              required
            >
              <option value="">Seleccionar...</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
              <option value="nueva_categoria" className="text-red-700 font-medium">
                + Crear nueva categoría
              </option>
            </select>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaCategoriaData.nombre}
                  onChange={(e) => setNuevaCategoriaData(prev => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (nuevaCategoriaData.nombre.trim() && nuevaCategoriaData.descripcion.trim()) {
                        handleCrearCategoriaRapido();
                      }
                    }
                    if (e.key === 'Escape') {
                      handleCancelarNuevaCategoria();
                    }
                  }}
                  placeholder="NOMBRE (EJ: TORNILLERÍA)"
                  className="flex-1 px-3 py-2 border-2 border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 animate-pulse"
                  style={{ textTransform: 'uppercase' }}
                  autoFocus
                  disabled={creandoCategoria}
                />
                <input
                  type="text"
                  value={nuevaCategoriaData.descripcion}
                  onChange={(e) => setNuevaCategoriaData(prev => ({ ...prev, descripcion: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (nuevaCategoriaData.nombre.trim()) {
                        handleCrearCategoriaRapido();
                      }
                    }
                    if (e.key === 'Escape') {
                      handleCancelarNuevaCategoria();
                    }
                  }}
                  placeholder="DESCRIPCIÓN (OPCIONAL)"
                  className="flex-1 px-3 py-2 border-2 border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 animate-pulse"
                  style={{ textTransform: 'uppercase' }}
                  disabled={creandoCategoria}
                />
                <button
                  type="button"
                  onClick={handleCrearCategoriaRapido}
                  disabled={creandoCategoria}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  title="Guardar categoría"
                >
                  {creandoCategoria ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelarNuevaCategoria}
                  disabled={creandoCategoria}
                  className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Cancelar"
                >
                  <X size={18} />
                </button>
              </div>
              {showNuevaCategoria && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>Categoría pendiente:</strong> Presiona Enter o el botón verde ✓ para guardar, o Escape/X para cancelar
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ubicación */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación <span className="text-red-600">*</span>
          </label>

          {!showNuevaUbicacion ? (
              <select
                key={`ubicacion-select-${ubicaciones.length}`}
                name="ubicacion_id"
                value={formData.ubicacion_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                disabled={loading}
                required
              >
                <option value="">Seleccionar...</option>
                {ubicaciones.map(ub => (
                  <option key={ub.id} value={ub.id}>
                    {ub.codigo} - {ub.descripcion}
                  </option>
                ))}
                <option value="nueva_ubicacion" className="text-red-700 font-medium">
                  + Crear nueva ubicación
                </option>
              </select>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevaUbicacionData.codigo}
                    onChange={(e) => setNuevaUbicacionData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (nuevaUbicacionData.codigo.trim() && nuevaUbicacionData.descripcion.trim()) {
                          handleCrearUbicacionRapido();
                        }
                      }
                      if (e.key === 'Escape') {
                        handleCancelarNuevaUbicacion();
                      }
                    }}
                    placeholder="CÓDIGO (EJ: A-01)"
                    className="flex-1 px-3 py-2 border-2 border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 animate-pulse"
                    style={{ textTransform: 'uppercase' }}
                    autoFocus
                    disabled={creandoUbicacion}
                  />
                  <input
                    type="text"
                    value={nuevaUbicacionData.descripcion}
                    onChange={(e) => setNuevaUbicacionData(prev => ({ ...prev, descripcion: e.target.value.toUpperCase() }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (nuevaUbicacionData.codigo.trim()) {
                          handleCrearUbicacionRapido();
                        }
                      }
                      if (e.key === 'Escape') {
                        handleCancelarNuevaUbicacion();
                      }
                    }}
                    placeholder="DESCRIPCIÓN (OPCIONAL)"
                    className="flex-1 px-3 py-2 border-2 border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 animate-pulse"
                    style={{ textTransform: 'uppercase' }}
                    disabled={creandoUbicacion}
                  />
                  <button
                    type="button"
                    onClick={handleCrearUbicacionRapido}
                    disabled={creandoUbicacion}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="Guardar ubicación"
                  >
                    {creandoUbicacion ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelarNuevaUbicacion}
                    disabled={creandoUbicacion}
                    className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Cancelar"
                  >
                    <X size={18} />
                  </button>
                </div>
                {showNuevaUbicacion && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Ubicación pendiente:</strong> Presiona Enter o el botón verde ✓ para guardar, o Escape/X para cancelar
                    </p>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor
          </label>

          {!showNuevoProveedor ? (
            <select
              key={`proveedor-select-${proveedores.length}`}
              name="proveedor_id"
              value={formData.proveedor_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              disabled={loading}
            >
              <option value="">Seleccionar...</option>
              {proveedores.map(prov => (
                <option key={prov.id} value={prov.id}>
                  {prov.nombre}
                </option>
              ))}
              {puedeCrearProveedores && (
                <option value="nuevo_proveedor" className="text-red-700 font-medium">
                  + Crear nuevo proveedor
                </option>
              )}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoProveedorNombre}
                onChange={(e) => setNuevoProveedorNombre(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCrearProveedorRapido();
                  }
                  if (e.key === 'Escape') {
                    handleCancelarNuevoProveedor();
                  }
                }}
                placeholder="NOMBRE DEL NUEVO PROVEEDOR"
                className="flex-1 px-3 py-2 border-2 border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 animate-pulse"
                style={{ textTransform: 'uppercase' }}
                autoFocus
                disabled={creandoProveedor}
              />
              <button
                type="button"
                onClick={handleCrearProveedorRapido}
                disabled={creandoProveedor}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Guardar proveedor"
              >
                {creandoProveedor ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelarNuevoProveedor}
                disabled={creandoProveedor}
                className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {showNuevoProveedor && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                ⚠️ <strong>Proveedor pendiente:</strong> Presiona Enter o el botón verde ✓ para guardar, o Escape/X para cancelar
              </p>
            </div>
          )}
        </div>

        {/* Stock Actual, Mínimo y Máximo */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Actual <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              name="stock_actual"
              value={formData.stock_actual}
              onChange={handleChange}
              min="0"
              step={formData.unidad === 'piezas' ? '1' : '0.01'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Mínimo <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              name="stock_minimo"
              value={formData.stock_minimo}
              onChange={handleChange}
              min="0"
              step={formData.unidad === 'piezas' ? '1' : '0.01'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="20"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Máximo
            </label>
            <input
              type="number"
              name="stock_maximo"
              value={formData.stock_maximo}
              onChange={handleChange}
              min="0"
              step={formData.unidad === 'piezas' ? '1' : '0.01'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="500"
            />
          </div>
        </div>

        {/* Unidad y Costo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidad
            </label>
            <select
              name="unidad"
              value={formData.unidad}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="piezas">Piezas</option>
              <option value="kg">Kilogramos</option>
              <option value="litros">Litros</option>
              <option value="metros">Metros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Costo Unitario
            </label>
            <input
              type="number"
              name="costo_unitario"
              value={formData.costo_unitario}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Toggle Es Herramienta */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="checkbox"
            id="es_herramienta"
            name="es_herramienta"
            checked={formData.es_herramienta}
            onChange={(e) => setFormData({ ...formData, es_herramienta: e.target.checked })}
            className="w-4 h-4 text-red-700 bg-gray-100 border-gray-300 rounded focus:ring-red-700 focus:ring-2"
          />
          <label htmlFor="es_herramienta" className="text-sm font-medium text-gray-700 cursor-pointer">
            ¿Es una herramienta para renta?
          </label>
        </div>

        {!isEdit && !formData.codigo_ean13 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              ℹ️ Si no proporcionas un código EAN-13, se generará uno automáticamente.
            </p>
          </div>
        )}

        {!isEdit && formData.codigo_ean13 && /^[0-9]{13}$/.test(formData.codigo_ean13) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              ✅ Se utilizará el código EAN-13 proporcionado: <span className="font-mono font-semibold">{formData.codigo_ean13}</span>
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                {isEdit ? 'Actualizar' : 'Crear Artículo'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ArticuloFormModal;
