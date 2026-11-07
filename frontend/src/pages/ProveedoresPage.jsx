import React, { useState, useEffect } from 'react';
import proveedoresService from '../services/proveedores.service';
import toast from 'react-hot-toast';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import { useAuth } from '../context/AuthContext';
import {
  fichaVacia, fichaAFormulario, fichaParaGuardar,
} from '../components/proveedores/fichaDatos';
import VistaProveedores from '../rediseno2/gestion/VistaProveedores';

// B3 paso 1 · PLA-11 (solo con Diseño 3G): liga a la otra mitad de «Proveedores», que vive en Finanzas.
// La dirección de Finanzas es privada: Planta no la escribe en su JS público. Si una página con sesión la configuró
// (G3.configurar), es enlace; si no, dice «Ábrela desde Inicio 3G», como el selector de apps.
const VISTA_FINANZAS = '/#vista=proveedores-a-credito';
const urlFinanzas = () => {
  try {
    const base = window.G3?.sistemas?.find((s) => s.id === 'finanzas')?.url;
    if (!base) return null;
    const url = new URL(VISTA_FINANZAS, base).toString();
    return window.G3?.urlCon ? window.G3.urlCon(url) : url;
  } catch { return null; }
};

const ProveedoresPage = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  // B3 paso 3 · PLA-20 (solo Diseño 3G): ficha maestra, crédito de CTAS CRÉDITO y reporte sin RFC
  const { user } = useAuth();
  const puedeEditar = ['compras', 'encargado', 'administrador'].includes(user?.rol);
  const [fichas, setFichas] = useState({});
  const [credito, setCredito] = useState([]);
  const [vista, setVista] = useState('lista');
  const [reporte, setReporte] = useState(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [errorReporte, setErrorReporte] = useState(null);
  // null = las fichas no han llegado (o fallaron): el formulario se guarda como siempre y no pisa ninguna ficha
  const [fichaForm, setFichaForm] = useState(null);
  const [fichasListas, setFichasListas] = useState(false);
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»
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

  // Las fichas y el crédito solo se piden con Diseño 3G (apagado, la pantalla pide lo mismo que siempre)
  const cargarFichas = async () => {
    try {
      const r = await proveedoresService.fichas();
      setFichas(r.data?.fichas || {});
      setCredito(r.data?.credito || []);
      setFichasListas(true);
    } catch (error) {
      console.error('Error al cargar las fichas de proveedores:', error);
    }
  };
  useEffect(() => {
    cargarFichas();
  }, []);

  const cargarReporte = async () => {
    setCargandoReporte(true);
    setErrorReporte(null);
    try {
      const r = await proveedoresService.reporteSinRfc();
      setReporte(r.data);
    } catch (error) {
      console.error('Error al cargar el reporte sin RFC:', error);
      setErrorReporte('No se pudo cargar el reporte de proveedores sin RFC.');
    } finally {
      setCargandoReporte(false);
    }
  };
  const verVista = (v) => {
    setVista(v);
    if (v === 'sinrfc') cargarReporte();
  };

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const data = await proveedoresService.listar({ activo: true });
      setProveedores(data.data?.proveedores || []);
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Error al cargar proveedores');
      setErrorCargaR2(error?.message || 'Error al cargar proveedores');
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
      setFichaForm(fichasListas ? fichaAFormulario(fichas[proveedor.id]) : null);
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
      setFichaForm(fichasListas ? fichaVacia() : null);
    }
    setShowModal(true);
  };

  // Desde el reporte: abre el formulario del proveedor con su ficha
  const abrirFicha = (id) => {
    const p = proveedores.find((x) => x.id === id);
    if (p) handleOpenModal(p);
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

    // B3 · PLA-20 (Diseño 3G): la ficha se guarda junto con los datos. Si ya existe, primero la ficha (si no pasa la
    // revisión, no se guarda nada); si es nuevo, primero el proveedor (para tener su id).
    if (puedeEditar && fichaForm) {
      try {
        const ficha = fichaParaGuardar(fichaForm);
        if (editingProveedor) {
          await proveedoresService.guardarFicha(editingProveedor.id, ficha);
          await proveedoresService.actualizar(editingProveedor.id, formData);
          toast.success('Proveedor y ficha guardados');
        } else {
          const creado = await proveedoresService.crear(formData);
          const id = creado?.data?.id;
          if (id) {
            try {
              await proveedoresService.guardarFicha(id, ficha);
            } catch (error) {
              toast.error(`Se creó el proveedor, pero la ficha no se guardó: ${error.response?.data?.message || error.message}`);
            }
          }
          toast.success('Proveedor creado');
        }
        handleCloseModal();
        fetchProveedores();
        cargarFichas();
        if (reporte) cargarReporte();
      } catch (error) {
        console.error('Error al guardar proveedor:', error);
        toast.error(error.response?.data?.message || error.message || 'Error al guardar proveedor');
      }
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
    // Vista previa con lo que ya está en pantalla; la petición de después es la misma
    const p = proveedores.find(x => x.id === id);
    if (!(await confirmarG3({
      titulo: '¿Eliminar este proveedor?',
      aviso: 'Se elimina de forma permanente. Si tiene artículos asociados, el sistema no lo deja eliminar.',
      datos: p ? [['Proveedor', p.nombre], ['RFC', p.rfc || 'N/A'], ['Contacto', p.contacto || 'N/A']] : [],
      confirmar: 'Eliminar proveedor', cancelar: 'No eliminar', peligro: true,
    }))) return;

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

  return (
    <VistaProveedores
      proveedores={proveedores} loading={loading} errorCarga={errorCargaR2} recargar={fetchProveedores} searchTerm={searchTerm}
      setSearchTerm={setSearchTerm} filteredProveedores={filteredProveedores} showModal={showModal} editingProveedor={editingProveedor}
      formData={formData} handleInputChange={handleInputChange} handleOpenModal={handleOpenModal} handleCloseModal={handleCloseModal}
      handleSubmit={handleSubmit} handleDelete={handleDelete} puedeEditar={puedeEditar} fichas={fichas} credito={credito}
      fichasListas={fichasListas} vista={vista} verVista={verVista} reporte={reporte} cargandoReporte={cargandoReporte}
      errorReporte={errorReporte} cargarReporte={cargarReporte} abrirFicha={abrirFicha} fichaForm={fichaForm} setFichaForm={setFichaForm}
      urlFinanzas={urlFinanzas}
    />
  );
};

export default ProveedoresPage;
