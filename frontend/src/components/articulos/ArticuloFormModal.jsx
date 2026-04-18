import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Check } from 'lucide-react';
import { Modal, ImageUpload } from '../common';
import toast from 'react-hot-toast';
import categoriasService from '../../services/categorias.service';
import ubicacionesService from '../../services/ubicaciones.service';
import almacenesService from '../../services/almacenes.service';
import proveedoresService from '../../services/proveedores.service';
import articulosService from '../../services/articulos.service';
import movimientosService from '../../services/movimientos.service';
import EAN13InputScanner from './EAN13InputScanner';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../utils/imageUtils';

const ArticuloFormModal = ({ isOpen, onClose, onSuccess, articulo = null, codigoInicial = null, nombreInicial = null }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenSeleccionadoForm, setAlmacenSeleccionadoForm] = useState('');
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

  // Estados para autocomplete y modo ingreso
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [articulosFiltrados, setArticulosFiltrados] = useState([]);
  const [mostrarAutocomplete, setMostrarAutocomplete] = useState(false);
  const [modoIngreso, setModoIngreso] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [cantidadIngreso, setCantidadIngreso] = useState('');
  const [observacionesIngreso, setObservacionesIngreso] = useState('');
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

  // Estado para múltiples proveedores
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState([]);

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

  // Verificar permisos para crear proveedores (solo admin y encargado)
  const puedeCrearProveedores = ['administrador', 'encargado'].includes(user?.rol);

  // Detectar si es rol almacén (campos limitados)
  const esAlmacen = user?.rol === 'almacen';

  // Almacén en modo edición: solo puede cambiar nombre y foto
  const esEdicionLimitada = esAlmacen && isEdit;

  // Cargar catálogos y datos del artículo si es edición
  useEffect(() => {
    if (isOpen) {
      fetchCatalogos();

      if (articulo) {
        // Modo edición: cargar datos del artículo existente
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

        // Pre-seleccionar el almacén basado en la ubicación del artículo
        const almacenIdArt = articulo.ubicacion?.almacen_id || articulo.ubicacion?.almacen_ref?.id || '';
        setAlmacenSeleccionadoForm(almacenIdArt ? String(almacenIdArt) : '');

        // Cargar proveedores seleccionados si existen
        if (articulo.proveedores && articulo.proveedores.length > 0) {
          setProveedoresSeleccionados(
            articulo.proveedores.map(prov => ({
              proveedor_id: prov.id,
              costo_unitario: prov.ArticuloProveedor?.costo_unitario || 0,
              es_preferido: prov.ArticuloProveedor?.es_preferido || false
            }))
          );
        } else if (articulo.proveedor_id) {
          // Si solo tiene el proveedor legacy
          setProveedoresSeleccionados([{
            proveedor_id: articulo.proveedor_id,
            costo_unitario: articulo.costo_unitario || 0,
            es_preferido: true
          }]);
        } else {
          setProveedoresSeleccionados([]);
        }

        // Cargar imagen actual si existe
        if (articulo.imagen_url) {
          setCurrentImageUrl(getImageUrl(articulo.imagen_url));
        } else {
          setCurrentImageUrl(null);
        }
        setSelectedImage(null);
        setModoIngreso(false);
        setArticuloSeleccionado(null);
      } else {
        // Modo creación: limpiar formulario y pre-llenar código o nombre si vienen de búsqueda
        setFormData({
          codigo_ean13: codigoInicial || '', // Pre-llenar con código si viene de búsqueda por código
          codigo_tipo: 'EAN13',
          nombre: nombreInicial || '', // Pre-llenar con nombre si viene de búsqueda por nombre
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
        setModoIngreso(false);
        setArticuloSeleccionado(null);
        setCantidadIngreso('');
        setObservacionesIngreso('');
        setAlmacenSeleccionadoForm('');

        // Cargar todos los artículos para el autocomplete
        fetchTodosArticulos();
      }
    }
  }, [isOpen, articulo, codigoInicial, nombreInicial]);

  // Cargar todos los artículos para el autocomplete
  const fetchTodosArticulos = async () => {
    try {
      const articulos = await articulosService.getAll();
      // Filtrar solo artículos activos
      const articulosActivos = Array.isArray(articulos)
        ? articulos.filter(art => art.activo)
        : [];
      setTodosArticulos(articulosActivos);
    } catch (error) {
      console.error('Error al cargar artículos para autocomplete:', error);
    }
  };

  const fetchCatalogos = async () => {
    try {
      const [categoriasData, ubicacionesData, almacenesData, proveedoresResponse] = await Promise.all([
        categoriasService.getAll(),
        ubicacionesService.getAll(),
        almacenesService.getAll(),
        proveedoresService.listar({ activo: true })
      ]);

      setCategorias(Array.isArray(categoriasData) ? categoriasData : []);
      setUbicaciones(Array.isArray(ubicacionesData) ? ubicacionesData : []);
      setAlmacenes(Array.isArray(almacenesData) ? almacenesData.filter(a => a.activo !== false) : []);

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
    const { name, value } = e.target;

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

    // Si es el campo nombre en modo creación, filtrar artículos para autocomplete
    if (name === 'nombre' && !isEdit && !modoIngreso) {
      const valorBusqueda = value.toUpperCase();

      if (valorBusqueda.trim().length >= 2) {
        const filtered = todosArticulos.filter(art =>
          art.nombre.toUpperCase().includes(valorBusqueda)
        );
        setArticulosFiltrados(filtered);
        setMostrarAutocomplete(filtered.length > 0);
      } else {
        setArticulosFiltrados([]);
        setMostrarAutocomplete(false);
      }
    }

    // Guardar el valor tal como viene, sin transformaciones
    // La conversión a mayúsculas se hace visualmente con CSS
    setFormData(prev => ({
      ...prev,
      [name]: value
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
        nombre: nuevoProveedorNombre.trim().toUpperCase()
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
        codigo: nuevaUbicacionData.codigo.trim().toUpperCase(),
        descripcion: nuevaUbicacionData.descripcion.trim().toUpperCase() || 'Sin descripción'
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
        nombre: nuevaCategoriaData.nombre.trim().toUpperCase(),
        descripcion: nuevaCategoriaData.descripcion.trim().toUpperCase() || 'Sin descripción'
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

  // Agregar proveedor
  const handleAgregarProveedor = () => {
    setProveedoresSeleccionados(prev => [...prev, {
      proveedor_id: '',
      costo_unitario: formData.costo_unitario || 0,
      es_preferido: prev.length === 0 // El primero es preferido por defecto
    }]);
  };

  // Eliminar proveedor
  const handleEliminarProveedor = (index) => {
    setProveedoresSeleccionados(prev => prev.filter((_, i) => i !== index));
  };

  // Actualizar datos de un proveedor específico
  const handleProveedorChange = (index, field, value) => {
    setProveedoresSeleccionados(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Marcar como preferido (solo uno puede ser preferido)
  const handleMarcarPreferido = (index) => {
    setProveedoresSeleccionados(prev =>
      prev.map((prov, i) => ({ ...prov, es_preferido: i === index }))
    );
  };

  // Manejar selección de artículo existente desde autocomplete
  const handleSeleccionarArticulo = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModoIngreso(true);
    setMostrarAutocomplete(false);
    setFormData(prev => ({
      ...prev,
      nombre: articulo.nombre
    }));
    setCantidadIngreso('');
    setObservacionesIngreso('');
  };

  // Cancelar modo ingreso y volver a modo creación normal
  const handleCancelarModoIngreso = () => {
    setModoIngreso(false);
    setArticuloSeleccionado(null);
    setCantidadIngreso('');
    setObservacionesIngreso('');
    setFormData(prev => ({
      ...prev,
      nombre: ''
    }));
  };

  // Manejar ingreso de inventario
  const handleIngresoInventario = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!cantidadIngreso || parseFloat(cantidadIngreso) <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar que si la unidad es "piezas", la cantidad sea número entero
    if (articuloSeleccionado.unidad === 'piezas' && !Number.isInteger(parseFloat(cantidadIngreso))) {
      toast.error('La cantidad debe ser un número entero para piezas');
      return;
    }

    try {
      setLoading(true);

      // Crear movimiento de tipo "ajuste_entrada" o "entrada"
      await movimientosService.create({
        tipo: 'ajuste_entrada',
        articulos: [{
          articulo_id: articuloSeleccionado.id,
          cantidad: parseFloat(cantidadIngreso),
          observaciones: observacionesIngreso.trim().toUpperCase() || 'Ingreso manual'
        }],
        observaciones: `Ingreso de inventario: ${articuloSeleccionado.nombre}`
      });

      toast.success(`✅ Ingreso exitoso de ${cantidadIngreso} ${articuloSeleccionado.unidad} de ${articuloSeleccionado.nombre}`);

      // Limpiar y cerrar
      handleCancelarModoIngreso();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Error al registrar ingreso:', error);
      toast.error(error.message || 'Error al registrar ingreso de inventario');
    } finally {
      setLoading(false);
    }
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
    e.stopPropagation();

    // Prevenir múltiples submits mientras se está procesando
    if (loading) {
      console.log('⚠️ Submit ignorado - Ya hay una operación en proceso');
      return;
    }

    console.log('📝 handleSubmit llamado - Modo:', isEdit ? 'EDICIÓN' : 'CREACIÓN');
    console.log('📝 FormData:', formData);
    console.log('📝 SelectedImage:', selectedImage);

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

    // Solo validar categoria y ubicacion si NO es almacen
    if (!esAlmacen && !formData.categoria_id) {
      toast.error('Selecciona una categoría');
      return;
    }

    if (!esAlmacen && !formData.ubicacion_id) {
      toast.error('Selecciona una ubicación');
      return;
    }

    if (!formData.stock_actual || parseFloat(formData.stock_actual) < 0) {
      toast.error('El stock actual debe ser mayor o igual a 0');
      return;
    }

    // Solo validar stock_minimo si NO es almacen
    if (!esAlmacen && (!formData.stock_minimo || parseFloat(formData.stock_minimo) < 0)) {
      toast.error('El stock mínimo debe ser mayor o igual a 0');
      return;
    }

    // Validar que si la unidad es "piezas", los stocks sean números enteros
    if (formData.unidad === 'piezas') {
      if (!Number.isInteger(parseFloat(formData.stock_actual))) {
        toast.error('El stock actual debe ser un número entero para piezas');
        return;
      }
      // Solo validar stock_minimo si NO es almacen
      if (!esAlmacen && formData.stock_minimo && !Number.isInteger(parseFloat(formData.stock_minimo))) {
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

      // Si es almacen y no hay categoria/ubicacion, buscar o usar "Sin Categoría" y "Sin Ubicación"
      let categoriaId = formData.categoria_id;
      let ubicacionId = formData.ubicacion_id;

      if (esAlmacen) {
        // Buscar "Sin Categoría" en la lista de categorías
        if (!categoriaId) {
          const sinCategoria = categorias.find(c =>
            c.nombre?.toUpperCase() === 'SIN CATEGORÍA' ||
            c.nombre?.toUpperCase() === 'SIN CATEGORIA'
          );
          categoriaId = sinCategoria?.id || categorias[0]?.id || 1;
        }

        // Buscar "Sin Ubicación" en la lista de ubicaciones
        if (!ubicacionId) {
          const sinUbicacion = ubicaciones.find(u =>
            u.codigo?.toUpperCase() === 'SIN-UBICACION' ||
            u.codigo?.toUpperCase() === 'SIN UBICACION'
          );
          ubicacionId = sinUbicacion?.id || ubicaciones[0]?.id || 1;
        }
      }

      const dataToSend = {
        nombre: formData.nombre.trim().toUpperCase(),
        descripcion: formData.descripcion.trim().toUpperCase(),
        categoria_id: parseInt(categoriaId),
        ubicacion_id: parseInt(ubicacionId),
        stock_actual: parseFloat(formData.stock_actual),
        stock_minimo: esAlmacen ? 0 : parseFloat(formData.stock_minimo),
        stock_maximo: formData.stock_maximo ? parseFloat(formData.stock_maximo) : null,
        unidad: formData.unidad.toUpperCase(),
        costo_unitario: parseFloat(formData.costo_unitario) || 0,
        es_herramienta: formData.es_herramienta
      };

      // Agregar proveedores si se seleccionaron
      if (proveedoresSeleccionados.length > 0) {
        const proveedoresValidos = proveedoresSeleccionados.filter(p => p.proveedor_id);
        if (proveedoresValidos.length > 0) {
          dataToSend.proveedores_ids = proveedoresValidos.map(p => ({
            proveedor_id: parseInt(p.proveedor_id),
            costo_unitario: parseFloat(p.costo_unitario) || 0,
            es_preferido: p.es_preferido || false
          }));
        }
      }

      // Agregar código y tipo solo si se proporcionó un código
      if (formData.codigo_ean13 && formData.codigo_ean13.trim()) {
        dataToSend.codigo_ean13 = formData.codigo_ean13.trim();
        dataToSend.codigo_tipo = formData.codigo_tipo;
      }

      let articuloId;
      let articuloCreado = null;

      if (isEdit) {
        console.log('🔄 Actualizando artículo:', articulo.id);

        if (esEdicionLimitada) {
          // Almacén solo puede actualizar nombre y foto
          const dataLimitada = {
            nombre: formData.nombre.trim().toUpperCase()
          };
          await articulosService.update(articulo.id, dataLimitada);
        } else {
          await articulosService.update(articulo.id, dataToSend);
        }

        articuloId = articulo.id;
        console.log('✅ Artículo actualizado exitosamente');
        toast.success('Artículo actualizado exitosamente');
      } else {
        console.log('➕ Creando artículo:', dataToSend);
        const response = await articulosService.create(dataToSend);
        articuloId = response.articulo.id;
        articuloCreado = response.articulo;
        console.log('✅ Artículo creado:', articuloId);
        const mensaje = dataToSend.codigo_ean13
          ? 'Artículo creado exitosamente con el código proporcionado'
          : 'Artículo creado exitosamente con código EAN-13 automático';
        toast.success(mensaje);
      }

      // Subir imagen si se seleccionó una nueva
      console.log('📷 Debug subida imagen:', {
        selectedImage: selectedImage,
        selectedImageType: selectedImage?.type,
        selectedImageSize: selectedImage?.size,
        articuloId: articuloId,
        isEdit: isEdit
      });

      if (selectedImage) {
        try {
          console.log('📤 Iniciando subida de imagen...');
          await articulosService.uploadImagen(articuloId, selectedImage);
          toast.success('Imagen subida exitosamente');
          console.log('✅ Imagen subida correctamente');
        } catch (error) {
          console.error('❌ Error al subir imagen:', error);
          toast.error('Artículo guardado, pero hubo un error al subir la imagen');
        }
      } else {
        console.log('⚠️ No hay selectedImage, no se sube nada');
      }

      // Limpiar formulario
      console.log('🧹 Limpiando formulario...');
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

      // Pasar el artículo creado al callback
      console.log('📞 Llamando onSuccess callback...');
      if (onSuccess && articuloCreado) {
        onSuccess(articuloCreado);
      } else if (onSuccess) {
        onSuccess();
      }

      console.log('🚪 Cerrando modal...');
      onClose();
    } catch (error) {
      console.error('❌ Error al guardar artículo:', error);
      toast.error(error.message || 'Error al guardar artículo');
    } finally {
      console.log('🏁 Finalizando handleSubmit...');
      setLoading(false);
    }
  };

  const handleImageSelect = (file) => {
    console.log('📷 Imagen seleccionada:', file);
    setSelectedImage(file);
    // NO llamar a ninguna acción de guardado aquí
  };

  const handleImageRemove = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('🗑️ Imagen removida');
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
      setProveedoresSeleccionados([]);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? (esEdicionLimitada ? 'Editar Nombre y Foto' : 'Editar Artículo') : (modoIngreso ? 'Ingreso de Inventario' : 'Nuevo Artículo')}
      closeOnBackdropClick={false}
    >
      <form onSubmit={modoIngreso ? handleIngresoInventario : handleSubmit} className="space-y-4">
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
        {!modoIngreso ? (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              onFocus={() => {
                // Mostrar autocomplete si ya hay filtros aplicados
                if (articulosFiltrados.length > 0) {
                  setMostrarAutocomplete(true);
                }
              }}
              onBlur={() => {
                // Ocultar autocomplete después de un pequeño delay para permitir clics
                setTimeout(() => setMostrarAutocomplete(false), 300);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Ej: TORNILLO HEXAGONAL 1/4"
              style={{ textTransform: 'uppercase' }}
              required
            />

            {/* Autocomplete Dropdown */}
            {mostrarAutocomplete && articulosFiltrados.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2 bg-blue-50 border-b border-blue-200">
                  <p className="text-xs text-blue-800 font-medium">
                    💡 Selecciona un artículo existente para registrar una entrada de inventario
                  </p>
                </div>
                {articulosFiltrados.slice(0, 10).map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => handleSeleccionarArticulo(art)}
                    className="w-full px-3 py-2 text-left hover:bg-red-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{art.nombre}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Stock actual: <span className="font-semibold">{art.stock_actual} {art.unidad}</span>
                          {art.categoria && ` • ${art.categoria.nombre}`}
                        </p>
                      </div>
                      <span className="ml-2 text-xs text-blue-600 font-medium whitespace-nowrap">
                        Ingresar ➜
                      </span>
                    </div>
                  </button>
                ))}
                {articulosFiltrados.length > 10 && (
                  <div className="p-2 text-center bg-gray-50">
                    <p className="text-xs text-gray-600">
                      Mostrando 10 de {articulosFiltrados.length} resultados. Sigue escribiendo para refinar la búsqueda.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Modo Ingreso: Información del artículo seleccionado */
          <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{articuloSeleccionado.nombre}</h3>
                <p className="text-sm text-gray-600 mt-1">{articuloSeleccionado.descripcion}</p>
              </div>
              <button
                type="button"
                onClick={handleCancelarModoIngreso}
                className="ml-2 p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Cambiar a crear nuevo artículo"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Stock Actual</p>
                <p className="font-bold text-lg text-blue-700">
                  {articuloSeleccionado.stock_actual} {articuloSeleccionado.unidad}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Categoría</p>
                <p className="font-semibold text-gray-900">
                  {articuloSeleccionado.categoria?.nombre || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Ubicación</p>
                <p className="font-semibold text-gray-900">
                  {articuloSeleccionado.ubicacion?.codigo || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modo Ingreso: Campos simplificados */}
        {modoIngreso ? (
          <>
            {/* Cantidad a Ingresar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad a Ingresar <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={cantidadIngreso}
                onChange={(e) => setCantidadIngreso(e.target.value)}
                min="0"
                step={articuloSeleccionado.unidad === 'piezas' ? '1' : '0.01'}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                placeholder={`Cantidad en ${articuloSeleccionado.unidad}`}
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-600">
                Stock resultante: <span className="font-semibold text-blue-700">
                  {cantidadIngreso ? (parseFloat(articuloSeleccionado.stock_actual) + parseFloat(cantidadIngreso)).toFixed(2) : articuloSeleccionado.stock_actual} {articuloSeleccionado.unidad}
                </span>
              </p>
            </div>

            {/* Observaciones del Ingreso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={observacionesIngreso}
                onChange={(e) => setObservacionesIngreso(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MOTIVO DEL INGRESO, PROVEEDOR, ETC..."
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </>
        ) : esEdicionLimitada ? (
          /* Modo Edición Limitada (Almacén): Solo Nombre y Foto */
          <>
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

            {/* Fotografía */}
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

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                ⚠️ Solo puedes modificar el nombre y la foto del artículo.
              </p>
            </div>
          </>
        ) : (
          /* Modo Creación: Todos los campos del artículo */
          <>
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

            {/* Categoría - Solo visible para admin y encargado */}
            {!esAlmacen && (
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
                    required={!esAlmacen}
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
                        onChange={(e) => setNuevaCategoriaData(prev => ({ ...prev, nombre: e.target.value }))}
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
                        onChange={(e) => setNuevaCategoriaData(prev => ({ ...prev, descripcion: e.target.value }))}
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
            )}

            {/* Almacén - Solo visible para admin y encargado */}
            {!esAlmacen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Almacén <span className="text-red-600">*</span>
                </label>
                <select
                  value={almacenSeleccionadoForm}
                  onChange={(e) => {
                    setAlmacenSeleccionadoForm(e.target.value);
                    // Si la ubicación actual no pertenece al nuevo almacén, limpiarla
                    const nuevoId = e.target.value;
                    const ubicActual = ubicaciones.find(u => String(u.id) === String(formData.ubicacion_id));
                    const ubicAlmId = ubicActual?.almacen_id || ubicActual?.almacen_ref?.id;
                    if (!nuevoId || (ubicAlmId && String(ubicAlmId) !== String(nuevoId))) {
                      setFormData(prev => ({ ...prev, ubicacion_id: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                  disabled={loading}
                  required
                >
                  <option value="">Seleccionar almacén...</option>
                  {almacenes.map(al => (
                    <option key={al.id} value={al.id}>
                      📦 {al.nombre.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ubicación - Solo visible para admin y encargado */}
            {!esAlmacen && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación <span className="text-red-600">*</span>
                </label>

                {!showNuevaUbicacion ? (
                  <>
                    <select
                      key={`ubicacion-select-${ubicaciones.length}-${almacenSeleccionadoForm}`}
                      name="ubicacion_id"
                      value={formData.ubicacion_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 disabled:bg-gray-100"
                      disabled={loading || !almacenSeleccionadoForm}
                      required={!esAlmacen}
                    >
                      <option value="">{almacenSeleccionadoForm ? 'Seleccionar...' : 'Primero elige un almacén'}</option>
                      {ubicaciones
                        .filter(ub => {
                          if (!almacenSeleccionadoForm) return false;
                          const ubAl = ub.almacen_id || ub.almacen_ref?.id;
                          return String(ubAl) === String(almacenSeleccionadoForm);
                        })
                        .map(ub => (
                          <option key={ub.id} value={ub.id}>
                            {ub.codigo}{ub.descripcion ? ` - ${ub.descripcion}` : ''}
                          </option>
                        ))}
                      {almacenSeleccionadoForm && (
                        <option value="nueva_ubicacion" className="text-red-700 font-medium">
                          + Crear nueva ubicación
                        </option>
                      )}
                    </select>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevaUbicacionData.codigo}
                        onChange={(e) => setNuevaUbicacionData(prev => ({ ...prev, codigo: e.target.value }))}
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
                        onChange={(e) => setNuevaUbicacionData(prev => ({ ...prev, descripcion: e.target.value }))}
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
            )}

            {/* Proveedores Múltiples */}
            {!esAlmacen && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Proveedores
                  </label>
                  <button
                    type="button"
                    onClick={handleAgregarProveedor}
                    className="text-sm text-red-700 hover:text-red-800 font-medium flex items-center gap-1"
                  >
                    <span className="text-lg">+</span> Agregar Proveedor
                  </button>
                </div>

                {proveedoresSeleccionados.length === 0 ? (
                  <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <p className="text-sm text-gray-500">
                      No hay proveedores seleccionados. Haz clic en "Agregar Proveedor" para comenzar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {proveedoresSeleccionados.map((provSel, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={provSel.proveedor_id}
                              onChange={(e) => handleProveedorChange(index, 'proveedor_id', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 text-sm"
                              required
                            >
                              <option value="">Seleccionar proveedor...</option>
                              {proveedores.map(prov => (
                                <option key={prov.id} value={prov.id}>
                                  {prov.nombre}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={provSel.costo_unitario}
                              onChange={(e) => handleProveedorChange(index, 'costo_unitario', e.target.value)}
                              placeholder="Costo"
                              min="0"
                              step="0.01"
                              className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`preferido-${index}`}
                              checked={provSel.es_preferido}
                              onChange={() => handleMarcarPreferido(index)}
                              className="w-4 h-4 text-red-700 bg-gray-100 border-gray-300 rounded focus:ring-red-700 focus:ring-2"
                            />
                            <label htmlFor={`preferido-${index}`} className="text-xs text-gray-600 cursor-pointer">
                              Proveedor preferido
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEliminarProveedor(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar proveedor"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showNuevoProveedor && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevoProveedorNombre}
                        onChange={(e) => setNuevoProveedorNombre(e.target.value)}
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
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        ⚠️ <strong>Proveedor pendiente:</strong> Presiona Enter o el botón verde ✓ para guardar, o Escape/X para cancelar
                      </p>
                    </div>
                  </div>
                )}

                {puedeCrearProveedores && !showNuevoProveedor && (
                  <button
                    type="button"
                    onClick={() => setShowNuevoProveedor(true)}
                    className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
                  >
                    + Crear nuevo proveedor
                  </button>
                )}
              </div>
            )}

            {/* Stock Actual, Mínimo y Máximo */}
            <div className={`grid ${esAlmacen ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
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

              {!esAlmacen && (
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
                    required={!esAlmacen}
                  />
                </div>
              )}

              {!esAlmacen && (
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
              )}
            </div>

            {/* Unidad y Costo */}
            <div className={`grid ${esAlmacen ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
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

              {!esAlmacen && (
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
              )}
            </div>

            {/* Toggle Es Herramienta */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${formData.es_herramienta ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
              <input
                type="checkbox"
                id="es_herramienta"
                name="es_herramienta"
                checked={formData.es_herramienta}
                onChange={(e) => setFormData({ ...formData, es_herramienta: e.target.checked })}
                className="w-5 h-5 text-blue-700 bg-gray-100 border-gray-300 rounded focus:ring-blue-700 focus:ring-2"
              />
              <label htmlFor="es_herramienta" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                🔧 <strong>Es una herramienta</strong>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Si marcas esto, el artículo aparecerá en la sección "HERRAMIENTAS" del gate principal en lugar de en su almacén.
                </span>
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
          </>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={modoIngreso ? handleCancelarModoIngreso : handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {modoIngreso ? 'Volver' : 'Cancelar'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 ${modoIngreso
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-red-700 hover:bg-red-800'
              } text-white rounded-lg transition-colors disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {modoIngreso ? 'Registrando...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Save size={18} />
                {modoIngreso ? 'Registrar Ingreso' : (isEdit ? 'Actualizar' : 'Crear Artículo')}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ArticuloFormModal;
