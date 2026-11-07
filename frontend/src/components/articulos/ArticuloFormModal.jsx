import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import categoriasService from '../../services/categorias.service';
import ubicacionesService from '../../services/ubicaciones.service';
import almacenesService from '../../services/almacenes.service';
import proveedoresService from '../../services/proveedores.service';
import articulosService from '../../services/articulos.service';
import movimientosService from '../../services/movimientos.service';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../utils/imageUtils';
import CajonFormArticulo from '../../rediseno2/inventario/CajonFormArticulo';

// Unidades que admiten decimales; cualquier otra (piezas, cajas, unidades…) es entera.
// La comparación es case-insensitive porque la unidad se guarda en MAYÚSCULAS
// (p. ej. "PIEZAS"), así que comparar contra 'piezas' en minúsculas fallaba al editar.
const UNIDADES_CON_DECIMALES = ['kg', 'litros', 'metros', 'm²', 'm³', 'gramos', 'ml', 'cm', 'mm'];
const unidadEsEntera = (unidad) => {
  const u = (unidad || '').toLowerCase();
  return !UNIDADES_CON_DECIMALES.some(x => u.includes(x));
};
// Quita los decimales de un texto numérico cuando la unidad es entera (piezas).
const sanitizarCantidad = (value, unidad) => {
  if (value === '' || !unidadEsEntera(unidad)) return value;
  return String(value).replace(/[.,].*$/, '');
};

const ArticuloFormModal = ({ isOpen, onClose, onSuccess, articulo = null, codigoInicial = null, nombreInicial = null, permisosAlmacenAbiertos = false, mantenerPendiente = false }) => {
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

  // Detectar si es rol almacén (campos limitados)
  const esAlmacen = user?.rol === 'almacen';

  // Almacén RESTRINGIDO = almacén sin permisos abiertos. Con permisos abiertos el
  // almacén crea y edita con el formulario completo, igual que un admin (incluida la
  // post-edición de un SKU ya creado).
  const almacenLimitado = esAlmacen && !permisosAlmacenAbiertos;

  // Verificar permisos para crear proveedores: admin/encargado siempre; almacén
  // cuando el admin le abrió los permisos.
  const puedeCrearProveedores = ['administrador', 'encargado'].includes(user?.rol) || (esAlmacen && permisosAlmacenAbiertos);

  // Almacén restringido en edición: solo puede cambiar nombre y foto. Con permisos
  // abiertos edita todos los campos.
  const esEdicionLimitada = almacenLimitado && isEdit;

  // Edición relajada: no exigir datos completos (categoría/ubicación/stock). Aplica a
  // almacén restringido y a la edición de un SKU pendiente desde Nuevos Registros
  // (mantenerPendiente), donde el SKU aún puede estar incompleto y no debe salir de la lista.
  const edicionRelajada = almacenLimitado || (mantenerPendiente && isEdit);

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

    // Los campos de stock no admiten decimales cuando la unidad es entera (piezas).
    const camposStock = ['stock_actual', 'stock_minimo', 'stock_maximo'];
    const valorFinal = camposStock.includes(name)
      ? sanitizarCantidad(value, formData.unidad)
      : value;

    // Guardar el valor tal como viene, sin transformaciones
    // La conversión a mayúsculas se hace visualmente con CSS
    setFormData(prev => ({
      ...prev,
      [name]: valorFinal
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
    if (!almacenSeleccionadoForm) {
      toast.error('Selecciona un almacén antes de crear la ubicación');
      return;
    }

    try {
      setCreandoUbicacion(true);
      const response = await ubicacionesService.create({
        codigo: nuevaUbicacionData.codigo.trim().toUpperCase(),
        descripcion: nuevaUbicacionData.descripcion.trim().toUpperCase() || 'Sin descripción',
        almacen_id: parseInt(almacenSeleccionadoForm, 10)
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
    if (!almacenSeleccionadoForm) {
      toast.error('Selecciona un almacén antes de crear la categoría');
      return;
    }

    try {
      setCreandoCategoria(true);
      const response = await categoriasService.create({
        nombre: nuevaCategoriaData.nombre.trim().toUpperCase(),
        descripcion: nuevaCategoriaData.descripcion.trim().toUpperCase() || 'Sin descripción',
        almacen_id: parseInt(almacenSeleccionadoForm, 10)
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

    // Validar que si la unidad es entera (piezas), la cantidad sea número entero
    if (unidadEsEntera(articuloSeleccionado.unidad) && !Number.isInteger(parseFloat(cantidadIngreso))) {
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

      toast.success(`Ingreso registrado: ${cantidadIngreso} ${articuloSeleccionado.unidad} de ${articuloSeleccionado.nombre}`);

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

    // Solo validar categoria y ubicacion si NO es edición relajada
    if (!edicionRelajada && !formData.categoria_id) {
      toast.error('Selecciona una categoría');
      return;
    }

    if (!edicionRelajada && !formData.ubicacion_id) {
      toast.error('Selecciona una ubicación');
      return;
    }

    // El rol almacén no captura stock (y un SKU pendiente aún puede no tenerlo): el
    // SKU va a NUEVOS REGISTROS y el admin asigna stock al autorizarlo. Para el resto
    // de los casos el stock actual es obligatorio.
    if (!edicionRelajada && (!formData.stock_actual || parseFloat(formData.stock_actual) < 0)) {
      toast.error('El stock actual debe ser mayor o igual a 0');
      return;
    }

    // Solo validar stock_minimo si NO es edición relajada
    if (!edicionRelajada && (!formData.stock_minimo || parseFloat(formData.stock_minimo) < 0)) {
      toast.error('El stock mínimo debe ser mayor o igual a 0');
      return;
    }

    // Validar que si la unidad es entera (piezas), los stocks sean números enteros
    if (unidadEsEntera(formData.unidad)) {
      if (!edicionRelajada && !Number.isInteger(parseFloat(formData.stock_actual))) {
        toast.error('El stock actual debe ser un número entero para piezas');
        return;
      }
      // Solo validar stock_minimo si NO es edición relajada
      if (!edicionRelajada && formData.stock_minimo && !Number.isInteger(parseFloat(formData.stock_minimo))) {
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

      // Si falta categoria/ubicacion (almacén restringido o edición de un SKU pendiente
      // aún incompleto), usar "Sin Categoría" y "Sin Ubicación" como respaldo.
      let categoriaId = formData.categoria_id;
      let ubicacionId = formData.ubicacion_id;

      if (edicionRelajada) {
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
        stock_actual: edicionRelajada ? (parseFloat(formData.stock_actual) || 0) : parseFloat(formData.stock_actual),
        stock_minimo: edicionRelajada ? (parseFloat(formData.stock_minimo) || 0) : parseFloat(formData.stock_minimo),
        stock_maximo: formData.stock_maximo ? parseFloat(formData.stock_maximo) : null,
        unidad: formData.unidad.toUpperCase(),
        costo_unitario: parseFloat(formData.costo_unitario) || 0,
        es_herramienta: formData.es_herramienta || false
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

        // Editar desde Nuevos Registros no debe marcar el SKU como revisado:
        // mantener_pendiente conserva pendiente_revision para que siga en la lista
        // hasta que se pulse Autorizar.
        if (esEdicionLimitada) {
          // Almacén solo puede actualizar nombre y foto
          const dataLimitada = {
            nombre: formData.nombre.trim().toUpperCase(),
            ...(mantenerPendiente && { mantener_pendiente: true })
          };
          await articulosService.update(articulo.id, dataLimitada);
        } else {
          await articulosService.update(articulo.id, {
            ...dataToSend,
            ...(mantenerPendiente && { mantener_pendiente: true })
          });
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

  const cambiarAlmacenForm = (nuevoId) => {
    setAlmacenSeleccionadoForm(nuevoId);
    // Si la ubicación actual no pertenece al nuevo almacén, limpiarla
    const ubicActual = ubicaciones.find(u => String(u.id) === String(formData.ubicacion_id));
    const ubicAlmId = ubicActual?.almacen_id || ubicActual?.almacen_ref?.id;
    if (!nuevoId || (ubicAlmId && String(ubicAlmId) !== String(nuevoId))) {
      setFormData(prev => ({ ...prev, ubicacion_id: '' }));
    }
  };
  return (
    <CajonFormArticulo f={{
      isOpen, handleClose, isEdit, esEdicionLimitada, modoIngreso, esAlmacen, almacenLimitado, esAdministrador: user?.rol === 'administrador',
      loading, formData, handleChange, handleSubmit, handleIngresoInventario, handleEAN13Change, handleTypeDetected, tiposCodigo,
      articulosFiltrados, mostrarAutocomplete, setMostrarAutocomplete, handleSeleccionarArticulo,
      articuloSeleccionado, cantidadIngreso, observacionesIngreso, setObservacionesIngreso, handleCancelarModoIngreso, unidadEsEntera,
      cambiarCantidadIngreso: (v) => setCantidadIngreso(sanitizarCantidad(v, articuloSeleccionado?.unidad)),
      currentImageUrl, handleImageSelect, handleImageRemove, selectedImage, articulo,
      categorias, ubicaciones, almacenes, almacenSeleccionadoForm, cambiarAlmacenForm,
      cambiarEsHerramienta: (marcada) => setFormData(prev => ({ ...prev, es_herramienta: marcada })),
      showNuevaCategoria, nuevaCategoriaData, setNuevaCategoriaData, creandoCategoria, handleCrearCategoriaRapido, handleCancelarNuevaCategoria,
      showNuevaUbicacion, nuevaUbicacionData, setNuevaUbicacionData, creandoUbicacion, handleCrearUbicacionRapido, handleCancelarNuevaUbicacion,
      proveedores, proveedoresSeleccionados, handleAgregarProveedor, handleEliminarProveedor, handleProveedorChange, handleMarcarPreferido,
      showNuevoProveedor, setShowNuevoProveedor, nuevoProveedorNombre, setNuevoProveedorNombre, creandoProveedor,
      handleCrearProveedorRapido, handleCancelarNuevoProveedor, puedeCrearProveedores,
    }} />
  );
};

export default ArticuloFormModal;
