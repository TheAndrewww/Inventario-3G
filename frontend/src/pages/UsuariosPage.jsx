import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Search, Shield, UserCheck, UserX, RotateCcw } from 'lucide-react';
import usuariosService from '../services/usuarios.service';
import api from '../services/api';
import { modoCuentas3g } from '../services/cuentas3g';
import toast from 'react-hot-toast';
import { useDiseno3G } from '../diseno-3g/useDiseno3G';
import CabG3 from '../diseno-3g/CabG3';
import MasAcciones from '../diseno-3g/MasAcciones';
import { g3Activo, confirmarG3, pedirTextoG3, cx, etq } from '../diseno-3g/dialogosG3';

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const g3 = useDiseno3G(); // Diseño 3G: encabezado, tabla en tarjetas, acciones y confirmación del paquete (apagado, lo de siempre)
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
    if (!g3 || !conC3g) return undefined;
    let vivo = true;
    api.get('/auth/cuentas3g/reporte')
      .then((r) => { if (vivo) setReporteC3g(r.data?.data || null); })
      .catch(() => { if (vivo) setReporteC3g(null); });
    return () => { vivo = false; };
  }, [g3, conC3g]);

  const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

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
    if (g3Activo()) {
      // Vista previa con los datos del usuario que ya están en pantalla; la petición de después es la misma
      const u = usuarios.find(x => x.id === usuarioId);
      if (!(await confirmarG3({
        titulo: '¿Desactivar este usuario?',
        datos: u ? [['Usuario', u.nombre], ['Correo', u.email], ['Rol', u.rol]] : [],
        pasa: ['Queda como inactivo; lo puedes reactivar desde «Ver inactivos».'],
        confirmar: 'Desactivar usuario', cancelar: 'No desactivar', peligro: true,
      }))) return;
    } else if (!confirm('¿Estás seguro de que deseas desactivar este usuario?')) {
      return;
    }

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
    const confirmacion = g3Activo()
      ? await pedirTextoG3({
        titulo: 'Eliminación permanente',
        aviso: `Vas a borrar definitivamente al usuario «${usuario.nombre}» (${usuario.email}). Esta acción no se puede deshacer.`,
        texto: 'Si el usuario tiene movimientos, pedidos u órdenes históricas, la operación se rechazará y permanecerá desactivado.',
        etiqueta: 'Para confirmar, escribe el correo del usuario',
        modoTeclado: 'email',
        confirmar: 'Eliminar permanentemente', cancelar: 'No eliminar', peligro: true,
      })
      : prompt(
        `⚠️ ELIMINACIÓN PERMANENTE\n\n` +
        `Vas a borrar definitivamente al usuario "${usuario.nombre}" (${usuario.email}).\n` +
        `Esta acción NO se puede deshacer.\n\n` +
        `Si el usuario tiene movimientos, pedidos u órdenes históricas, la operación se rechazará y permanecerá desactivado.\n\n` +
        `Para confirmar, escribe el correo del usuario:`
      );
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

  const totalInactivos = usuarios.filter(u => !u.activo).length;

  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchBusqueda =
      usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(busqueda.toLowerCase());
    const matchRol = filtroRol === '' || usuario.rol === filtroRol;
    const matchEstado = mostrarInactivos ? !usuario.activo : usuario.activo;
    return matchBusqueda && matchRol && matchEstado;
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
      {g3 ? (
        <CabG3 titulo="Usuarios" descripcion="Administra los usuarios del sistema y su rol.">
          <button type="button" onClick={abrirModalNuevo} className="g3-btn g3-btn--primario">
            <UserPlus size={18} aria-hidden="true" /> Nuevo usuario
          </button>
        </CabG3>
      ) : (
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
      )}

      {/* Cuenta 3G: quién falta por entrar (E1 · PLA-24, solo con Diseño 3G) */}
      {g3 && reporteC3g && (
        <section className="g3-tarjeta g3-pila" style={{ gap: 12, marginBottom: 24 }} aria-labelledby="c3g-reporte-titulo">
          <div className="g3-tarjeta-cab">
            <h2 id="c3g-reporte-titulo">Cuenta 3G: quién falta por entrar</h2>
            <span className={`g3-estado ${reporteC3g.faltan.length ? 'g3-estado--aviso' : 'g3-estado--ok'}`}>
              {reporteC3g.faltan.length ? `Faltan ${reporteC3g.faltan.length}` : 'Ya entraron todos'}
            </span>
          </div>
          <p className="g3-chico g3-tenue" style={{ margin: 0 }}>
            {reporteC3g.conCuenta} de {reporteC3g.activos} usuarios activos ya entraron a Planta con su cuenta 3G.
            {' '}Planta pasa a «solo cuenta 3G» cuando esta lista queda vacía. Modo de hoy: {reporteC3g.modo === 'solo' ? 'solo cuenta 3G' : 'cuenta 3G y acceso de siempre'}.
          </p>
          {reporteC3g.lista?.vieja && (
            <div className="g3-caja g3-caja--aviso" role="status">
              <div className="g3-caja-cuerpo"><span>La lista de Cuentas 3G no se actualiza desde hace más de 24 horas. Las sesiones siguen; avisa a Dirección para revisar Cuentas 3G.</span></div>
            </div>
          )}
          {reporteC3g.emergencia && (
            <div className="g3-caja g3-caja--aviso" role="status">
              <div className="g3-caja-cuerpo"><span>La llave de emergencia está puesta: Dirección puede entrar con su contraseña. Quítala en cuanto Cuentas 3G responda.</span></div>
            </div>
          )}
          {reporteC3g.emergencias.length > 0 && (
            <div className="g3-caja g3-caja--info">
              <div className="g3-caja-cuerpo">
                <b>Entradas de emergencia en los últimos 30 días: {reporteC3g.emergencias.length}</b>
                <span>Última: {reporteC3g.emergencias[0].usuario} · {fechaCorta(reporteC3g.emergencias[0].cuando)}</span>
              </div>
            </div>
          )}
          {reporteC3g.faltan.length > 0 && (
            <details>
              <summary className="g3-chico" style={{ cursor: 'pointer', fontWeight: 600 }}>Ver quién falta ({reporteC3g.faltan.length})</summary>
              <ul className="g3-lista" style={{ marginTop: 8 }}>
                {reporteC3g.faltan.map((u) => (
                  <li key={u.id} className="g3-fila">
                    <div className="g3-fila-cuerpo">
                      <b>{u.nombre}</b>
                      <span className="g3-chico g3-tenue">{u.email} · {u.rol}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="g3-chico g3-tenue" style={{ margin: 0 }}>
            A las personas se les da (y se les quita) la entrada en Cuentas 3G › Personas. Aquí solo se elige su rol en Planta,
            con el mismo correo o con el «correo en Planta» de su ficha.
            {reporteC3g.emisor ? <> <a href={reporteC3g.emisor} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Abrir Cuentas 3G</a></> : null}
          </p>
        </section>
      )}

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={g3 ? 'Buscar por nombre o correo' : 'Buscar por nombre o email...'}
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

      {/* Toggle: mostrar/ocultar inactivos */}
      <div className="mb-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {mostrarInactivos ? (
            <>
              <UserX size={16} className="text-gray-500" />
              <span>Mostrando <strong>{totalInactivos}</strong> usuario{totalInactivos === 1 ? '' : 's'} inactivo{totalInactivos === 1 ? '' : 's'}</span>
            </>
          ) : (
            <>
              <UserCheck size={16} className="text-green-600" />
              <span>
                Mostrando solo activos
                {totalInactivos > 0 && (
                  <span className="text-gray-500"> · {totalInactivos} inactivo{totalInactivos === 1 ? '' : 's'} oculto{totalInactivos === 1 ? '' : 's'}</span>
                )}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setMostrarInactivos(!mostrarInactivos)}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${mostrarInactivos
            ? 'bg-red-700 text-white hover:bg-red-800'
            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
        >
          {mostrarInactivos ? 'Ver activos' : 'Ver inactivos'}
        </button>
      </div>

      {/* Tabla de usuarios */}
      <div className={g3 ? 'g3-tabla g3-tabla--tarjetas' : 'bg-white rounded-xl shadow-sm overflow-hidden'}>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {g3 ? 'Correo' : 'Email'}
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
                  <td className={cx('px-6 py-4 whitespace-nowrap', g3 && 'g3-celda-titulo')}>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" {...etq(g3, 'Correo')}>
                    {usuario.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" {...etq(g3, 'Rol')}>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${getRolColor(
                        usuario.rol
                      )}`}
                    >
                      {getRolIcon(usuario.rol)}
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" {...etq(g3, 'Puesto')}>
                    {usuario.puesto || '-'}
                  </td>
                  <td className={cx('px-6 py-4 whitespace-nowrap text-center', g3 && 'g3-celda-estado')}>
                    <span
                      className={g3 ? `g3-estado ${usuario.activo ? 'g3-estado--ok' : 'g3-estado--mal'}` : `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        usuario.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className={cx('px-6 py-4 whitespace-nowrap text-right text-sm', g3 && 'g3-celda-acciones')}>
                    {g3 ? (
                      <div className="flex items-center justify-end gap-2">
                        {usuario.activo ? (
                          <>
                            <button type="button" onClick={() => abrirModalEditar(usuario)} className="g3-btn g3-btn--tonal g3-btn--ch">
                              <Edit size={16} aria-hidden="true" /> Editar
                            </button>
                            <MasAcciones titulo={usuario.nombre} acciones={[
                              { texto: 'Desactivar usuario', icono: Trash2, peligro: true, onClick: () => handleEliminar(usuario.id) },
                            ]} />
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => handleReactivar(usuario.id)} className="g3-btn g3-btn--tonal g3-btn--ch">
                              <RotateCcw size={16} aria-hidden="true" /> Reactivar
                            </button>
                            <MasAcciones titulo={usuario.nombre} acciones={[
                              { texto: 'Editar', icono: Edit, onClick: () => abrirModalEditar(usuario) },
                              '-',
                              { texto: 'Eliminar permanentemente', icono: Trash2, peligro: true, title: 'Eliminar permanentemente (irreversible)', onClick: () => handleEliminarPermanente(usuario) },
                            ]} />
                          </>
                        )}
                      </div>
                    ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => abrirModalEditar(usuario)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-blue-700 hover:bg-blue-50 rounded-lg font-medium"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      {usuario.activo ? (
                        <button
                          onClick={() => handleEliminar(usuario.id)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                          title="Desactivar"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReactivar(usuario.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-green-700 hover:bg-green-50 rounded-lg font-medium text-xs"
                            title="Reactivar"
                          >
                            <RotateCcw size={16} />
                            <span className="hidden sm:inline">Reactivar</span>
                          </button>
                          <button
                            onClick={() => handleEliminarPermanente(usuario)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-red-700 text-white hover:bg-red-800 rounded-lg font-medium text-xs g3:!bg-g3-mal g3:!text-g3-sobre-mal g3:hover:!bg-g3-mal-hover"
                            title="Eliminar permanentemente (irreversible)"
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Eliminar</span>
                          </button>
                        </>
                      )}
                    </div>
                    )}
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
              {g3 && reporteC3g && !usuarioEditando && (
                <div className="g3-caja g3-caja--info">
                  <div className="g3-caja-cuerpo">
                    <b>Para que entre con su cuenta 3G</b>
                    <span>Dale de alta también en Cuentas 3G › Personas con este mismo correo (o anótalo como «correo en Planta» en su ficha). La contraseña solo sirve para el acceso de siempre.</span>
                  </div>
                </div>
              )}
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
