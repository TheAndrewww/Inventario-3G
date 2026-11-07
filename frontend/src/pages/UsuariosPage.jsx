import React, { useState, useEffect } from 'react';
import usuariosService from '../services/usuarios.service';
import api from '../services/api';
import { modoCuentas3g } from '../services/cuentas3g';
import toast from 'react-hot-toast';
import { confirmarG3, pedirTextoG3 } from '../diseno-3g/dialogosG3';
import VistaUsuarios from '../rediseno2/gestion/VistaUsuarios';

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: '',
    puesto: '',
    telefono: '',
    activo: true
  });

  // Cuentas 3G (E1 · PLA-24): reporte «quién no ha entrado con su cuenta 3G», solo con Diseño 3G y con
  // VITE_CUENTAS3G_MODO en «ambos» o «solo». Si el servidor está apagado (404), no se muestra nada.
  const conC3g = modoCuentas3g() !== 'apagado';
  const [reporteC3g, setReporteC3g] = useState(null);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (!conC3g) return undefined;
    let vivo = true;
    api.get('/auth/cuentas3g/reporte')
      .then((r) => { if (vivo) setReporteC3g(r.data?.data || null); })
      .catch(() => { if (vivo) setReporteC3g(null); });
    return () => { vivo = false; };
  }, [conC3g]);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const response = await usuariosService.obtenerTodos();
      setUsuarios(response.data.usuarios || []);
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar usuarios');
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
    // Vista previa con los datos del usuario que ya están en pantalla; la petición de después es la misma
    const u = usuarios.find(x => x.id === usuarioId);
    if (!(await confirmarG3({
      titulo: '¿Desactivar este usuario?',
      datos: u ? [['Usuario', u.nombre], ['Correo', u.email], ['Rol', u.rol]] : [],
      pasa: ['Queda como inactivo; lo puedes reactivar desde «Ver inactivos».'],
      confirmar: 'Desactivar usuario', cancelar: 'No desactivar', peligro: true,
    }))) return;

    try {
      await usuariosService.eliminar(usuarioId);
      // Actualización local — sin refetch ni perder scroll
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, activo: false } : u));
      toast.success('Usuario desactivado');
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el usuario');
    }
  };

  const handleReactivar = async (usuarioId) => {
    try {
      await usuariosService.reactivar(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, activo: true } : u));
      toast.success('Usuario reactivado');
    } catch (error) {
      console.error('Error al reactivar usuario:', error);
      toast.error(error.response?.data?.message || 'Error al reactivar el usuario');
    }
  };

  const handleEliminarPermanente = async (usuario) => {
    // Diseño 3G encendido: cajón con el mismo campo (devuelve lo mismo que prompt(): lo escrito o null). La comparación
    // con el correo es la de siempre, abajo.
    const confirmacion = await pedirTextoG3({
        titulo: 'Eliminación permanente',
        aviso: `Vas a borrar definitivamente al usuario «${usuario.nombre}» (${usuario.email}). Esta acción no se puede deshacer.`,
        texto: 'Si el usuario tiene movimientos, pedidos u órdenes históricas, la operación se rechazará y permanecerá desactivado.',
        etiqueta: 'Para confirmar, escribe el correo del usuario',
        modoTeclado: 'email',
        confirmar: 'Eliminar permanentemente', cancelar: 'No eliminar', peligro: true,
      });
    if (confirmacion === null) return;
    if (confirmacion.trim().toLowerCase() !== usuario.email.toLowerCase()) {
      toast.error('Confirmación incorrecta. Operación cancelada.');
      return;
    }

    try {
      await usuariosService.eliminarPermanente(usuario.id);
      // Actualización local — quitar de la lista sin refetch
      setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
      toast.success('Usuario eliminado permanentemente');
    } catch (error) {
      console.error('Error al eliminar permanentemente:', error);
      toast.error(error.response?.data?.message || 'Error al eliminar el usuario');
    }
  };

  const totalInactivos = usuarios.filter(u => !u.activo).length;

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchBusqueda =
      usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = filtroRol === '' || usuario.rol === filtroRol;
    const matchEstado = mostrarInactivos ? !usuario.activo : usuario.activo;
    return matchBusqueda && matchRol && matchEstado;
  });

  return (
    <VistaUsuarios
      usuarios={usuarios} cargando={cargando} errorCarga={errorCargaR2} recargar={cargarUsuarios} busqueda={busqueda} setBusqueda={setBusqueda}
      filtroRol={filtroRol} setFiltroRol={setFiltroRol} mostrarInactivos={mostrarInactivos} setMostrarInactivos={setMostrarInactivos}
      usuariosFiltrados={usuariosFiltrados} totalInactivos={totalInactivos} mostrarModal={mostrarModal} usuarioEditando={usuarioEditando}
      formData={formData} setFormData={setFormData} abrirModalNuevo={abrirModalNuevo} abrirModalEditar={abrirModalEditar} cerrarModal={cerrarModal}
      handleSubmit={handleSubmit} handleEliminar={handleEliminar} handleReactivar={handleReactivar} handleEliminarPermanente={handleEliminarPermanente}
      reporteC3g={reporteC3g}
    />
  );
};

export default UsuariosPage;
