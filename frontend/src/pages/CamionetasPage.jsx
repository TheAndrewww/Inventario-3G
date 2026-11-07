import React, { useState, useEffect } from 'react';
import camionetasService from '../services/camionetas.service';
import usuariosService from '../services/usuarios.service';
import ubicacionesService from '../services/ubicaciones.service';
import InventarioCamionetaModal from '../components/camionetas/InventarioCamionetaModal';
import ConfigurarStockMinimoModal from '../components/camionetas/ConfigurarStockMinimoModal';
import ChecklistManager from '../components/equipos/ChecklistManager';
import ChecklistEquipoModal from '../components/equipos/ChecklistEquipoModal';
import toast from 'react-hot-toast';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaEquipos from '../rediseno2/gestion/VistaEquipos';

const CamionetasPage = () => {
  const [camionetas, setCamionetas] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [camionetaEditando, setCamionetaEditando] = useState(null);
  const [mostrarInventario, setMostrarInventario] = useState(false);
  const [camionetaInventario, setCamionetaInventario] = useState(null);
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [camionetaConfiguracion, setCamionetaConfiguracion] = useState(null);
  const [mostrarChecklistManager, setMostrarChecklistManager] = useState(false);
  const [equipoChecklist, setEquipoChecklist] = useState(null);
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»
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
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar camionetas:', error);
      toast.error('Error al cargar camionetas');
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar camionetas');
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

  const abrirConfiguracion = (camioneta) => {
    setCamionetaConfiguracion(camioneta);
    setMostrarConfiguracion(true);
  };

  const cerrarConfiguracion = () => {
    setMostrarConfiguracion(false);
    setCamionetaConfiguracion(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre del equipo es obligatorio');
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
        toast.success('Equipo creado exitosamente');
      }
      cerrarModal();
      cargarCamionetas();
    } catch (error) {
      console.error('Error al guardar equipo:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el equipo');
    }
  };

  const handleEliminar = async (camionetaId) => {
    // Vista previa con los datos del equipo que ya están en pantalla; la petición de después es la misma
    const eq = camionetas.find(c => c.id === camionetaId);
    if (!(await confirmarG3({
      titulo: '¿Eliminar este equipo?',
      datos: eq ? [['Equipo', eq.nombre], ['Encargado', eq.encargado?.nombre || 'Sin asignar']] : [],
      pasa: ['El equipo se marca como inactivo; no se borra de la base de datos.'],
      confirmar: 'Eliminar equipo', cancelar: 'No eliminar', peligro: true,
    }))) return;

    try {
      await camionetasService.eliminar(camionetaId);
      toast.success('Equipo eliminado exitosamente');
      cargarCamionetas();
    } catch (error) {
      console.error('Error al eliminar equipo:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el equipo');
    }
  };

  return (
    <VistaEquipos
      camionetas={camionetas} encargados={encargados} ubicaciones={ubicaciones} cargando={cargando} errorCarga={errorCargaR2}
      recargar={cargarCamionetas} mostrarModal={mostrarModal} camionetaEditando={camionetaEditando} formData={formData}
      setFormData={setFormData} abrirModalNuevo={abrirModalNuevo} abrirModalEditar={abrirModalEditar} cerrarModal={cerrarModal}
      handleSubmit={handleSubmit} handleEliminar={handleEliminar} abrirInventario={abrirInventario} abrirConfiguracion={abrirConfiguracion}
      setMostrarChecklistManager={setMostrarChecklistManager} setEquipoChecklist={setEquipoChecklist}
      dialogos={(
        <>
          {mostrarInventario && <InventarioCamionetaModal camioneta={camionetaInventario} onClose={cerrarInventario} />}
          {mostrarConfiguracion && (
            <ConfigurarStockMinimoModal camioneta={camionetaConfiguracion} onClose={cerrarConfiguracion} onActualizar={cargarCamionetas} />
          )}
          <ChecklistManager isOpen={mostrarChecklistManager} onClose={() => setMostrarChecklistManager(false)} />
          <ChecklistEquipoModal isOpen={!!equipoChecklist} onClose={() => setEquipoChecklist(null)} equipo={equipoChecklist} />
        </>
      )}
    />
  );
};

export default CamionetasPage;
