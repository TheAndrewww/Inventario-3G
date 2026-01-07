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
import camionetasService from '../services/camionetas.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import proveedoresService from '../services/proveedores.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';

const RentaHerramientasPage = () => {
    const navigate = useNavigate();
    const [tipos, setTipos] = useState([]);
    const [tiposExpandidos, setTiposExpandidos] = useState({});
    const [unidadesPorTipo, setUnidadesPorTipo] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalAsignar, setModalAsignar] = useState(false);
    const [modalDevolver, setModalDevolver] = useState(false);
    const [modalCambiarEstado, setModalCambiarEstado] = useState(false);
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

    const handleCambiarEstado = (unidad, tipo) => {
        setUnidadSeleccionada({ ...unidad, tipo });
        setModalCambiarEstado(true);
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
            buen_estado: { color: 'bg-green-100 text-green-800', texto: '🟢 Buen estado', icon: CheckCircle },
            estado_regular: { color: 'bg-yellow-100 text-yellow-800', texto: '🟡 Estado regular', icon: AlertCircle },
            mal_estado: { color: 'bg-red-100 text-red-800', texto: '🔴 Mal estado', icon: AlertCircle },
            // Mantener compatibilidad con estados antiguos
            disponible: { color: 'bg-green-100 text-green-800', texto: '🟢 Buen estado', icon: CheckCircle },
            asignada: { color: 'bg-blue-100 text-blue-800', texto: 'Asignada', icon: UserCheck },
            en_reparacion: { color: 'bg-yellow-100 text-yellow-800', texto: '🟡 Estado regular', icon: Settings },
            perdida: { color: 'bg-red-100 text-red-800', texto: '🔴 Mal estado', icon: AlertCircle },
            baja: { color: 'bg-red-100 text-red-800', texto: '🔴 Mal estado', icon: AlertCircle }
        };
        const badge = badges[estado] || badges.buen_estado;
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
                                            {(() => {
                                                // Usar imagen del tipo, o si no existe, la del artículo origen
                                                const imagenUrl = tipo.imagen_url
                                                    ? getImageUrl(tipo.imagen_url)
                                                    : tipo.articuloOrigen?.imagen_url
                                                        ? getImageUrl(tipo.articuloOrigen.imagen_url)
                                                        : null;
                                                return (
                                                    <div className="w-14 h-14 rounded-lg bg-red-100 flex items-center justify-center overflow-hidden">
                                                        {imagenUrl ? (
                                                            <img
                                                                src={imagenUrl}
                                                                alt={tipo.nombre}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextElementSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <Wrench
                                                            className="text-red-700"
                                                            size={28}
                                                            style={{ display: imagenUrl ? 'none' : 'block' }}
                                                        />
                                                    </div>
                                                );
                                            })()}
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
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    {unidad.fecha_asignacion && (
                                                                        <p className="text-xs text-blue-700 flex items-center gap-1">
                                                                            <Clock size={12} />
                                                                            Asignada: {new Date(unidad.fecha_asignacion).toLocaleDateString('es-MX')}
                                                                        </p>
                                                                    )}
                                                                    {unidad.fecha_vencimiento_asignacion && (
                                                                        <p className="text-xs text-orange-700 flex items-center gap-1 font-medium">
                                                                            <AlertCircle size={12} />
                                                                            Vence: {new Date(unidad.fecha_vencimiento_asignacion).toLocaleDateString('es-MX')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {unidad.observaciones && (
                                                            <p className="text-xs text-gray-600 mb-3 italic">
                                                                {unidad.observaciones}
                                                            </p>
                                                        )}

                                                        <div className="flex gap-2">
                                                            {unidad.estado !== 'asignada' && (
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
                                                            <Button
                                                                onClick={() => handleCambiarEstado(unidad, tipo)}
                                                                variant="secondary"
                                                                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm py-2"
                                                            >
                                                                <Settings size={14} />
                                                                Estado
                                                            </Button>
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

            {modalCambiarEstado && unidadSeleccionada && (
                <ModalCambiarEstado
                    isOpen={modalCambiarEstado}
                    unidad={unidadSeleccionada}
                    onClose={() => {
                        setModalCambiarEstado(false);
                        setUnidadSeleccionada(null);
                    }}
                    onSuccess={() => {
                        setModalCambiarEstado(false);
                        setUnidadSeleccionada(null);
                        // Refrescar unidades del tipo
                        if (unidadSeleccionada?.tipo_herramienta_id) {
                            fetchUnidadesTipo(unidadSeleccionada.tipo_herramienta_id);
                        }
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
    const [fechaVencimiento, setFechaVencimiento] = useState('');
    const [usuarios, setUsuarios] = useState([]);
    const [camionetas, setCamionetas] = useState([]);
    const [camionetaSeleccionada, setCamionetaSeleccionada] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDatos();
    }, []);

    const fetchDatos = async () => {
        try {
            const [usuariosData, camionetasData] = await Promise.all([
                usuariosService.obtenerTodos(),
                camionetasService.obtenerTodos()
            ]);
            // Ambos servicios devuelven { data: { usuarios/camionetas: [...] } }
            const usuarios = usuariosData.data?.usuarios || [];
            const camionetas = camionetasData.data?.camionetas || [];
            setUsuarios(usuarios);
            setCamionetas(camionetas);
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

        if (tipoAsignacion === 'camioneta' && !camionetaSeleccionada) {
            toast.error('Selecciona una camioneta');
            return;
        }

        try {
            setLoading(true);

            await herramientasRentaService.asignarHerramienta({
                unidad_id: unidad.id,
                usuario_id: tipoAsignacion === 'usuario' ? parseInt(usuarioSeleccionado) : undefined,
                equipo_id: tipoAsignacion === 'equipo' ? parseInt(equipoSeleccionado) : undefined,
                camioneta_id: tipoAsignacion === 'camioneta' ? parseInt(camionetaSeleccionada) : undefined,
                observaciones: observaciones.trim() || undefined,
                fecha_vencimiento: fechaVencimiento || undefined
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
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="camioneta"
                                checked={tipoAsignacion === 'camioneta'}
                                onChange={(e) => setTipoAsignacion(e.target.value)}
                                className="mr-2"
                            />
                            Camioneta
                        </label>
                    </div>
                </div>

                {tipoAsignacion === 'usuario' && (
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
                )}

                {tipoAsignacion === 'equipo' && (
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
                                    {equipo.nombre} - {equipo.encargado?.nombre || 'Sin encargado'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {tipoAsignacion === 'camioneta' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Camioneta *
                        </label>
                        <select
                            value={camionetaSeleccionada}
                            onChange={(e) => setCamionetaSeleccionada(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                            required
                        >
                            <option value="">Seleccionar camioneta...</option>
                            {camionetas.filter(c => c.activo).map(camioneta => (
                                <option key={camioneta.id} value={camioneta.id}>
                                    {camioneta.nombre} {camioneta.matricula ? `(${camioneta.matricula})` : ''} - {camioneta.encargado?.nombre || 'Sin encargado'}
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

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Vencimiento (opcional)
                    </label>
                    <input
                        type="date"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                        min={new Date().toISOString().split('T')[0]}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Fecha límite para devolver la herramienta
                    </p>
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

// Modal para crear nuevo tipo de herramienta
const ModalNuevoTipo = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [categorias, setCategorias] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        categoria_id: '',
        ubicacion_id: '',
        proveedor_id: '',
        precio_unitario: '',
        cantidad_unidades: '1',
        imagen_url: '',
        prefijo_codigo: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchDatosIniciales();
        }
    }, [isOpen]);

    const fetchDatosIniciales = async () => {
        try {
            const [categoriasData, ubicacionesData, proveedoresData] = await Promise.all([
                categoriasService.getAll(),
                ubicacionesService.getAll(),
                proveedoresService.listar()
            ]);

            setCategorias(categoriasData || []);
            setUbicaciones(ubicacionesData || []);
            setProveedores(proveedoresData.data?.proveedores || []);
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            toast.error('Error al cargar las opciones del formulario');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validaciones
        if (!formData.nombre.trim()) {
            toast.error('El nombre es requerido');
            return;
        }

        if (!formData.categoria_id) {
            toast.error('La categoría es requerida');
            return;
        }

        if (!formData.ubicacion_id) {
            toast.error('La ubicación es requerida');
            return;
        }

        if (!formData.precio_unitario || parseFloat(formData.precio_unitario) <= 0) {
            toast.error('El precio unitario debe ser mayor a 0');
            return;
        }

        if (!formData.cantidad_unidades || parseInt(formData.cantidad_unidades) <= 0) {
            toast.error('La cantidad de unidades debe ser mayor a 0');
            return;
        }

        try {
            setLoading(true);

            const dataToSend = {
                nombre: formData.nombre.trim(),
                descripcion: formData.descripcion.trim() || undefined,
                categoria_id: parseInt(formData.categoria_id),
                ubicacion_id: parseInt(formData.ubicacion_id),
                proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : undefined,
                precio_unitario: parseFloat(formData.precio_unitario),
                cantidad_unidades: parseInt(formData.cantidad_unidades),
                imagen_url: formData.imagen_url.trim() || undefined,
                prefijo_codigo: formData.prefijo_codigo.trim() || undefined
            };

            await herramientasRentaService.crearTipo(dataToSend);

            toast.success(`Tipo de herramienta creado con ${formData.cantidad_unidades} unidad(es)`);
            onSuccess();
        } catch (error) {
            console.error('Error al crear tipo:', error);
            toast.error(error.message || 'Error al crear el tipo de herramienta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Tipo de Herramienta" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Nombre */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Ej: Pistola de Pintar"
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
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Descripción opcional del tipo de herramienta"
                    />
                </div>

                {/* Grid de 2 columnas para campos principales */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Categoría */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Categoría <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="categoria_id"
                            value={formData.categoria_id}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                        >
                            <option value="">Seleccionar categoría</option>
                            {categorias.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Ubicación */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ubicación <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="ubicacion_id"
                            value={formData.ubicacion_id}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                        >
                            <option value="">Seleccionar ubicación</option>
                            {ubicaciones.map(ubi => (
                                <option key={ubi.id} value={ubi.id}>{ubi.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Proveedor */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Proveedor (opcional)
                    </label>
                    <select
                        name="proveedor_id"
                        value={formData.proveedor_id}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <option value="">Sin proveedor</option>
                        {proveedores.filter(p => p.activo).map(prov => (
                            <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Grid de 2 columnas para precio y cantidad */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Precio Unitario */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Precio Unitario <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="precio_unitario"
                            value={formData.precio_unitario}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="0.00"
                            required
                        />
                    </div>

                    {/* Cantidad de Unidades */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad de Unidades <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="cantidad_unidades"
                            value={formData.cantidad_unidades}
                            onChange={handleChange}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="1"
                            required
                        />
                    </div>
                </div>

                {/* Grid de 2 columnas para imagen y prefijo */}
                <div className="grid grid-cols-2 gap-4">
                    {/* URL Imagen */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            URL de Imagen (opcional)
                        </label>
                        <input
                            type="url"
                            name="imagen_url"
                            value={formData.imagen_url}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="https://..."
                        />
                    </div>

                    {/* Prefijo Código */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prefijo Código (opcional)
                        </label>
                        <input
                            type="text"
                            name="prefijo_codigo"
                            value={formData.prefijo_codigo}
                            onChange={handleChange}
                            maxLength="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="Ej: PP, CP"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Si no se especifica, se generará automáticamente
                        </p>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="secondary"
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-red-700 hover:bg-red-800"
                    >
                        {loading ? 'Creando...' : 'Crear Tipo'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Modal para cambiar estado de una unidad
const ModalCambiarEstado = ({ isOpen, unidad, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [motivo, setMotivo] = useState('');

    useEffect(() => {
        if (isOpen) {
            setNuevoEstado(unidad.estado || '');
            setMotivo('');
        }
    }, [isOpen, unidad]);

    const estadosDisponibles = [
        { value: 'buen_estado', label: '🟢 Buen estado', color: 'text-green-700' },
        { value: 'estado_regular', label: '🟡 Estado regular', color: 'text-yellow-700' },
        { value: 'mal_estado', label: '🔴 Mal estado', color: 'text-red-700' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nuevoEstado) {
            toast.error('Debes seleccionar un estado');
            return;
        }

        if (nuevoEstado === unidad.estado) {
            toast.error('El estado seleccionado es el mismo que el actual');
            return;
        }

        if (['en_reparacion', 'perdida', 'baja'].includes(nuevoEstado) && !motivo.trim()) {
            toast.error('Debes proporcionar un motivo para este cambio de estado');
            return;
        }

        try {
            setLoading(true);
            await herramientasRentaService.cambiarEstadoUnidad(unidad.id, nuevoEstado, motivo.trim());
            toast.success(`Estado cambiado a "${estadosDisponibles.find(e => e.value === nuevoEstado)?.label}"`);
            onSuccess();
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            toast.error(error.message || 'Error al cambiar el estado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cambiar Estado de Unidad">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Información de la unidad */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-semibold text-gray-900 mb-2">
                        {unidad.tipo?.nombre || 'Herramienta'}
                    </h3>
                    <p className="text-sm text-gray-600">
                        Código: <span className="font-mono font-bold">{unidad.codigo_unico}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                        Estado actual: <span className="font-medium capitalize">{unidad.estado?.replace(/_/g, ' ')}</span>
                    </p>
                </div>

                {/* Selector de nuevo estado */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nuevo Estado <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {estadosDisponibles.map((estado) => (
                            <button
                                key={estado.value}
                                type="button"
                                onClick={() => setNuevoEstado(estado.value)}
                                className={`
                                    px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                                    ${nuevoEstado === estado.value
                                        ? 'border-red-600 bg-red-50 ' + estado.color
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                    }
                                    ${unidad.estado === estado.value ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                                disabled={unidad.estado === estado.value}
                            >
                                {estado.label}
                                {unidad.estado === estado.value && (
                                    <span className="ml-1 text-xs">(actual)</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Motivo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo / Observaciones
                        {['en_reparacion', 'perdida', 'baja'].includes(nuevoEstado) && (
                            <span className="text-red-500 ml-1">*</span>
                        )}
                    </label>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder={
                            ['en_reparacion', 'perdida', 'baja'].includes(nuevoEstado)
                                ? 'Describe el motivo del cambio (requerido)'
                                : 'Observaciones opcionales sobre este cambio de estado'
                        }
                        required={['en_reparacion', 'perdida', 'baja'].includes(nuevoEstado)}
                    />
                    {['en_reparacion', 'perdida', 'baja'].includes(nuevoEstado) && (
                        <p className="text-xs text-gray-500 mt-1">
                            Este cambio de estado requiere un motivo
                        </p>
                    )}
                </div>

                {/* Advertencia si va a cambiar de asignada a otro estado */}
                {unidad.estado === 'asignada' && nuevoEstado !== 'asignada' && (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <AlertCircle size={14} className="inline mr-1" />
                            Al cambiar el estado, se registrará automáticamente la devolución de la herramienta.
                        </p>
                    </div>
                )}

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="secondary"
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading || !nuevoEstado || nuevoEstado === unidad.estado}
                        className="bg-red-700 hover:bg-red-800"
                    >
                        {loading ? 'Cambiando...' : 'Cambiar Estado'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default RentaHerramientasPage;
