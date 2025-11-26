import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Plus,
    Package,
    Wrench,
    ChevronDown,
    ChevronUp,
    UserCheck,
    RotateCcw,
    AlertCircle,
    CheckCircle,
    Clock,
    Settings,
    Users,
    Printer
} from 'lucide-react';
import herramientasRentaService from '../services/herramientasRenta.service';
import usuariosService from '../services/usuarios.service';
import equiposService from '../services/equipos.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const RentaHerramientasPage = () => {
    const navigate = useNavigate();
    const [tipos, setTipos] = useState([]);
    const [tiposExpandidos, setTiposExpandidos] = useState({});
    const [unidadesPorTipo, setUnidadesPorTipo] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalAsignar, setModalAsignar] = useState(false);
    const [modalDevolver, setModalDevolver] = useState(false);
    const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
    const [modalNuevoTipo, setModalNuevoTipo] = useState(false);
    const { user } = useAuth();

    // Solo administradores, almacenistas y encargados pueden gestionar
    const puedeGestionar = ['administrador', 'almacenista', 'encargado'].includes(user?.rol);

    useEffect(() => {
        if (puedeGestionar) {
            fetchTipos();
        }
    }, [puedeGestionar]);

    const fetchTipos = async () => {
        try {
            setLoading(true);
            const data = await herramientasRentaService.obtenerTipos();
            setTipos(data.tipos || []);
        } catch (error) {
            console.error('Error al cargar tipos de herramienta:', error);
            toast.error('Error al cargar las herramientas');
        } finally {
            setLoading(false);
        }
    };

    const fetchUnidadesTipo = async (tipoId) => {
        try {
            const data = await herramientasRentaService.obtenerUnidadesPorTipo(tipoId);
            setUnidadesPorTipo(prev => ({
                ...prev,
                [tipoId]: data.unidades || []
            }));
        } catch (error) {
            console.error(`Error al cargar unidades del tipo ${tipoId}:`, error);
            toast.error('Error al cargar las unidades');
        }
    };

    const toggleTipo = async (tipoId) => {
        const estaExpandido = tiposExpandidos[tipoId];

        if (!estaExpandido && !unidadesPorTipo[tipoId]) {
            await fetchUnidadesTipo(tipoId);
        }

        setTiposExpandidos(prev => ({
            ...prev,
            [tipoId]: !estaExpandido
        }));
    };

    const handleAsignar = (unidad, tipo) => {
        setUnidadSeleccionada({ ...unidad, tipo });
        setModalAsignar(true);
    };

    const handleDevolver = (unidad, tipo) => {
        setUnidadSeleccionada({ ...unidad, tipo });
        setModalDevolver(true);
    };

    const handleImprimirCodigos = (tipo) => {
        const unidades = unidadesPorTipo[tipo.id] || [];
        navigate('/renta-herramientas/imprimir-codigos', {
            state: { tipo, unidades }
        });
    };

    const tiposFiltrados = tipos.filter((tipo) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            tipo.nombre?.toLowerCase().includes(searchLower) ||
            tipo.prefijo_codigo?.toLowerCase().includes(searchLower) ||
            tipo.categoria?.nombre?.toLowerCase().includes(searchLower)
        );
    });

    // Calcular estadísticas globales
    const stats = React.useMemo(() => {
        return tipos.reduce((acc, tipo) => {
            acc.totalUnidades += tipo.total_unidades || 0;
            acc.disponibles += tipo.unidades_disponibles || 0;
            acc.asignadas += tipo.unidades_asignadas || 0;
            return acc;
        }, { totalUnidades: 0, disponibles: 0, asignadas: 0 });
    }, [tipos]);

    const getEstadoBadge = (estado) => {
        const badges = {
            disponible: { color: 'bg-green-100 text-green-800', texto: 'Disponible', icon: CheckCircle },
            asignada: { color: 'bg-blue-100 text-blue-800', texto: 'Asignada', icon: UserCheck },
            en_reparacion: { color: 'bg-yellow-100 text-yellow-800', texto: 'En Reparación', icon: Settings },
            perdida: { color: 'bg-red-100 text-red-800', texto: 'Perdida', icon: AlertCircle },
            baja: { color: 'bg-gray-100 text-gray-800', texto: 'Baja', icon: AlertCircle }
        };
        const badge = badges[estado] || badges.disponible;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <Icon size={12} />
                {badge.texto}
            </span>
        );
    };

    if (!puedeGestionar) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">No tienes permisos para acceder a esta sección.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return <Loader fullScreen />;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Herramientas de Renta</h1>
                <p className="text-gray-600">
                    Gestiona las herramientas de renta con seguimiento individual de cada unidad
                </p>
            </div>

            {/* Barra de acciones */}
            <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, prefijo o categoría..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    />
                </div>

                {(user?.rol === 'administrador' || user?.rol === 'almacenista') && (
                    <Button
                        onClick={() => setModalNuevoTipo(true)}
                        className="bg-red-700 hover:bg-red-800 text-white"
                    >
                        <Plus size={20} />
                        Nuevo Tipo de Herramienta
                    </Button>
                )}
            </div>

            {/* Estadísticas globales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Tipos de Herramienta</p>
                            <p className="text-2xl font-bold text-gray-900">{tipos.length}</p>
                        </div>
                        <Package className="text-purple-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total de Unidades</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalUnidades}</p>
                        </div>
                        <Wrench className="text-blue-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Disponibles</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.disponibles}</p>
                        </div>
                        <CheckCircle className="text-green-500" size={32} />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Asignadas</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.asignadas}</p>
                        </div>
                        <UserCheck className="text-orange-500" size={32} />
                    </div>
                </div>
            </div>

            {/* Lista de tipos */}
            {tiposFiltrados.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <Wrench size={64} className="mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No hay tipos de herramienta registrados
                    </h3>
                    <p className="text-gray-600 mb-6">
                        Comienza creando un nuevo tipo de herramienta
                    </p>
                    {(user?.rol === 'administrador' || user?.rol === 'almacenista') && (
                        <Button
                            onClick={() => setModalNuevoTipo(true)}
                            className="bg-red-700 hover:bg-red-800"
                        >
                            <Plus size={20} />
                            Crear Primer Tipo
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {tiposFiltrados.map((tipo) => {
                        const estaExpandido = tiposExpandidos[tipo.id];
                        const unidades = unidadesPorTipo[tipo.id] || [];

                        return (
                            <div key={tipo.id} className="bg-white rounded-lg shadow overflow-hidden">
                                {/* Header del tipo */}
                                <div
                                    className="bg-gray-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => toggleTipo(tipo.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center">
                                                <Wrench className="text-red-700" size={28} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-lg text-gray-900">{tipo.nombre}</h3>
                                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-mono rounded">
                                                        {tipo.prefijo_codigo}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span>
                                                        {tipo.categoria?.nombre || 'Sin categoría'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        {tipo.total_unidades} {tipo.total_unidades === 1 ? 'unidad' : 'unidades'}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="text-green-600 font-medium">
                                                        {tipo.unidades_disponibles} disponibles
                                                    </span>
                                                    {tipo.unidades_asignadas > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-blue-600 font-medium">
                                                                {tipo.unidades_asignadas} asignadas
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                                            {estaExpandido ? (
                                                <ChevronUp className="text-gray-600" size={24} />
                                            ) : (
                                                <ChevronDown className="text-gray-600" size={24} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Unidades (colapsable) */}
                                {estaExpandido && (
                                    <div className="p-6">
                                        {/* Botón de imprimir códigos */}
                                        {unidades.length > 0 && (user?.rol === 'administrador' || user?.rol === 'almacenista') && (
                                            <div className="mb-4 flex justify-end">
                                                <Button
                                                    onClick={() => handleImprimirCodigos(tipo)}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                                                >
                                                    <Printer size={18} />
                                                    Imprimir Códigos de Barras
                                                </Button>
                                            </div>
                                        )}

                                        {unidades.length === 0 ? (
                                            <p className="text-center text-gray-500 py-4">No hay unidades registradas</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {unidades.map((unidad) => (
                                                    <div
                                                        key={unidad.id}
                                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div>
                                                                <p className="font-mono font-bold text-gray-900">
                                                                    {unidad.codigo_unico}
                                                                </p>
                                                                {unidad.numero_serie && (
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        S/N: {unidad.numero_serie}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {getEstadoBadge(unidad.estado)}
                                                        </div>

                                                        {unidad.estado === 'asignada' && (
                                                            <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-100">
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    {unidad.usuarioAsignado ? (
                                                                        <>
                                                                            <UserCheck size={14} className="text-blue-600" />
                                                                            <span className="text-blue-900 font-medium">
                                                                                {unidad.usuarioAsignado.nombre}
                                                                            </span>
                                                                        </>
                                                                    ) : unidad.equipoAsignado ? (
                                                                        <>
                                                                            <Users size={14} className="text-blue-600" />
                                                                            <span className="text-blue-900 font-medium">
                                                                                {unidad.equipoAsignado.nombre}
                                                                            </span>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                                {unidad.fecha_asignacion && (
                                                                    <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                                                                        <Clock size={12} />
                                                                        {new Date(unidad.fecha_asignacion).toLocaleDateString('es-MX')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {unidad.observaciones && (
                                                            <p className="text-xs text-gray-600 mb-3 italic">
                                                                {unidad.observaciones}
                                                            </p>
                                                        )}

                                                        <div className="flex gap-2">
                                                            {unidad.estado === 'disponible' && (
                                                                <Button
                                                                    onClick={() => handleAsignar(unidad, tipo)}
                                                                    variant="secondary"
                                                                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm py-2"
                                                                >
                                                                    <UserCheck size={14} />
                                                                    Asignar
                                                                </Button>
                                                            )}
                                                            {unidad.estado === 'asignada' && (
                                                                <Button
                                                                    onClick={() => handleDevolver(unidad, tipo)}
                                                                    variant="secondary"
                                                                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-sm py-2"
                                                                >
                                                                    <RotateCcw size={14} />
                                                                    Devolver
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modales */}
            {modalAsignar && unidadSeleccionada && (
                <ModalAsignar
                    isOpen={modalAsignar}
                    unidad={unidadSeleccionada}
                    onClose={() => {
                        setModalAsignar(false);
                        setUnidadSeleccionada(null);
                    }}
                    onSuccess={() => {
                        setModalAsignar(false);
                        setUnidadSeleccionada(null);
                        fetchTipos();
                        if (unidadSeleccionada.tipo?.id) {
                            fetchUnidadesTipo(unidadSeleccionada.tipo.id);
                        }
                    }}
                />
            )}

            {modalDevolver && unidadSeleccionada && (
                <ModalDevolver
                    isOpen={modalDevolver}
                    unidad={unidadSeleccionada}
                    onClose={() => {
                        setModalDevolver(false);
                        setUnidadSeleccionada(null);
                    }}
                    onSuccess={() => {
                        setModalDevolver(false);
                        setUnidadSeleccionada(null);
                        fetchTipos();
                        if (unidadSeleccionada.tipo?.id) {
                            fetchUnidadesTipo(unidadSeleccionada.tipo.id);
                        }
                    }}
                />
            )}

            {modalNuevoTipo && (
                <ModalNuevoTipo
                    isOpen={modalNuevoTipo}
                    onClose={() => setModalNuevoTipo(false)}
                    onSuccess={() => {
                        setModalNuevoTipo(false);
                        fetchTipos();
                    }}
                />
            )}
        </div>
    );
};

// Modal para asignar herramienta
const ModalAsignar = ({ isOpen, unidad, onClose, onSuccess }) => {
    const [tipoAsignacion, setTipoAsignacion] = useState('usuario'); // 'usuario' o 'equipo'
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
    const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [usuarios, setUsuarios] = useState([]);
    const [equipos, setEquipos] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDatos();
    }, []);

    const fetchDatos = async () => {
        try {
            const [usuariosData, equiposData] = await Promise.all([
                usuariosService.getAll(),
                equiposService.getAll()
            ]);
            setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
            setEquipos(Array.isArray(equiposData) ? equiposData : []);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar datos');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (tipoAsignacion === 'usuario' && !usuarioSeleccionado) {
            toast.error('Selecciona un usuario');
            return;
        }

        if (tipoAsignacion === 'equipo' && !equipoSeleccionado) {
            toast.error('Selecciona un equipo');
            return;
        }

        try {
            setLoading(true);

            await herramientasRentaService.asignarHerramienta({
                unidad_id: unidad.id,
                usuario_id: tipoAsignacion === 'usuario' ? parseInt(usuarioSeleccionado) : undefined,
                equipo_id: tipoAsignacion === 'equipo' ? parseInt(equipoSeleccionado) : undefined,
                observaciones: observaciones.trim() || undefined
            });

            toast.success('Herramienta asignada exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error al asignar herramienta:', error);
            toast.error(error.message || 'Error al asignar la herramienta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Asignar Herramienta">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-1">
                        <strong>Herramienta:</strong> {unidad.tipo?.nombre}
                    </p>
                    <p className="text-sm text-blue-800">
                        <strong>Código:</strong> {unidad.codigo_unico}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Asignar a:
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="usuario"
                                checked={tipoAsignacion === 'usuario'}
                                onChange={(e) => setTipoAsignacion(e.target.value)}
                                className="mr-2"
                            />
                            Usuario
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="equipo"
                                checked={tipoAsignacion === 'equipo'}
                                onChange={(e) => setTipoAsignacion(e.target.value)}
                                className="mr-2"
                            />
                            Equipo
                        </label>
                    </div>
                </div>

                {tipoAsignacion === 'usuario' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Usuario *
                        </label>
                        <select
                            value={usuarioSeleccionado}
                            onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                            required
                        >
                            <option value="">Seleccionar usuario...</option>
                            {usuarios.filter(u => u.activo).map(usuario => (
                                <option key={usuario.id} value={usuario.id}>
                                    {usuario.nombre} - {usuario.puesto || usuario.rol}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Equipo *
                        </label>
                        <select
                            value={equipoSeleccionado}
                            onChange={(e) => setEquipoSeleccionado(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                            required
                        >
                            <option value="">Seleccionar equipo...</option>
                            {equipos.filter(e => e.activo).map(equipo => (
                                <option key={equipo.id} value={equipo.id}>
                                    {equipo.nombre} - {equipo.supervisor?.nombre || 'Sin encargado'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observaciones
                    </label>
                    <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                        rows="3"
                        placeholder="Notas adicionales sobre la asignación..."
                    />
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? 'Asignando...' : 'Asignar Herramienta'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Modal para devolver herramienta
const ModalDevolver = ({ isOpen, unidad, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [observaciones, setObservaciones] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);

            await herramientasRentaService.devolverHerramienta(
                unidad.id,
                observaciones.trim()
            );

            toast.success('Herramienta devuelta exitosamente');
            onSuccess();
        } catch (error) {
            console.error('Error al devolver herramienta:', error);
            toast.error(error.message || 'Error al devolver la herramienta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Devolver Herramienta">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 mb-1">
                        <strong>Herramienta:</strong> {unidad.tipo?.nombre}
                    </p>
                    <p className="text-sm text-green-800 mb-1">
                        <strong>Código:</strong> {unidad.codigo_unico}
                    </p>
                    {unidad.usuarioAsignado && (
                        <p className="text-sm text-green-800">
                            <strong>Asignado a:</strong> {unidad.usuarioAsignado.nombre}
                        </p>
                    )}
                    {unidad.equipoAsignado && (
                        <p className="text-sm text-green-800">
                            <strong>Equipo:</strong> {unidad.equipoAsignado.nombre}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estado de la herramienta
                    </label>
                    <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                        rows="3"
                        placeholder="Ej: En buen estado, con desgaste normal, requiere mantenimiento, etc."
                    />
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
                        {loading ? 'Devolviendo...' : 'Confirmar Devolución'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Modal para crear nuevo tipo (placeholder - se puede expandir después)
const ModalNuevoTipo = ({ isOpen, onClose, onSuccess }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Tipo de Herramienta">
            <div className="p-4 text-center">
                <p className="text-gray-600">
                    Esta funcionalidad estará disponible próximamente.
                    <br />
                    Por ahora, los tipos se crean directamente desde la base de datos.
                </p>
                <Button onClick={onClose} className="mt-4">
                    Entendido
                </Button>
            </div>
        </Modal>
    );
};

export default RentaHerramientasPage;
