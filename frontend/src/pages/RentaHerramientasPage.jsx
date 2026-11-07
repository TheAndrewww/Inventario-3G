import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import herramientasRentaService from '../services/herramientasRenta.service';
import usuariosService from '../services/usuarios.service';
import camionetasService from '../services/camionetas.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import proveedoresService from '../services/proveedores.service';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import VistaRenta from '../rediseno2/gestion/VistaRenta';
import { CajonAsignar, CajonDevolver, CajonNuevoTipo, CajonCondicion } from '../rediseno2/gestion/CajonesRenta';

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
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

    // Solo administradores, almacenistas y encargados pueden gestionar
    const puedeGestionar = ['administrador', 'almacenista', 'almacen', 'encargado'].includes(user?.rol);

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
            setErrorCargaR2(null);
        } catch (error) {
            console.error('Error al cargar tipos de herramienta:', error);
            toast.error('Error al cargar las herramientas');
            setErrorCargaR2(error?.message || 'Error al cargar las herramientas');
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

    // Mapear estado antiguo a condicion nueva (para compatibilidad)
    const mapearEstadoACondicion = (estado) => {
        const mapeo = {
            'buen_estado': 'bueno',
            'estado_regular': 'regular',
            'mal_estado': 'malo',
            'perdida': 'perdido',
            'baja': 'baja',
            'disponible': 'bueno',
            'asignada': 'bueno'
        };
        return mapeo[estado] || 'bueno';
    };

    // Verificar si la unidad está asignada (usar nuevo campo estatus)
    const estaAsignada = (unidad) => {
        return unidad.estatus === 'asignado' || unidad.estado === 'asignada';
    };

    return (
        <VistaRenta
            puedeGestionar={puedeGestionar} tipos={tipos} tiposFiltrados={tiposFiltrados} tiposExpandidos={tiposExpandidos}
            unidadesPorTipo={unidadesPorTipo} loading={loading} errorCarga={errorCargaR2} recargar={fetchTipos} searchTerm={searchTerm}
            setSearchTerm={setSearchTerm} stats={stats} puedeCrear={user?.rol === 'administrador' || user?.rol === 'almacenista'}
            toggleTipo={toggleTipo} handleAsignar={handleAsignar} handleDevolver={handleDevolver} handleCambiarEstado={handleCambiarEstado}
            handleImprimirCodigos={handleImprimirCodigos} setModalNuevoTipo={setModalNuevoTipo} mapearEstadoACondicion={mapearEstadoACondicion}
            estaAsignada={estaAsignada}
            dialogos={(
                <>
                    {modalAsignar && unidadSeleccionada && (
                        <ModalAsignar
                            isOpen={modalAsignar}
                            unidad={unidadSeleccionada}
                            onClose={() => { setModalAsignar(false); setUnidadSeleccionada(null); }}
                            onSuccess={() => {
                                setModalAsignar(false);
                                setUnidadSeleccionada(null);
                                fetchTipos();
                                if (unidadSeleccionada.tipo?.id) fetchUnidadesTipo(unidadSeleccionada.tipo.id);
                            }}
                        />
                    )}
                    {modalDevolver && unidadSeleccionada && (
                        <ModalDevolver
                            isOpen={modalDevolver}
                            unidad={unidadSeleccionada}
                            onClose={() => { setModalDevolver(false); setUnidadSeleccionada(null); }}
                            onSuccess={() => {
                                setModalDevolver(false);
                                setUnidadSeleccionada(null);
                                fetchTipos();
                                if (unidadSeleccionada.tipo?.id) fetchUnidadesTipo(unidadSeleccionada.tipo.id);
                            }}
                        />
                    )}
                    {modalNuevoTipo && (
                        <ModalNuevoTipo
                            isOpen={modalNuevoTipo}
                            onClose={() => setModalNuevoTipo(false)}
                            onSuccess={() => { setModalNuevoTipo(false); fetchTipos(); }}
                        />
                    )}
                    {modalCambiarEstado && unidadSeleccionada && (
                        <ModalCambiarEstado
                            isOpen={modalCambiarEstado}
                            unidad={unidadSeleccionada}
                            onClose={() => { setModalCambiarEstado(false); setUnidadSeleccionada(null); }}
                            onSuccess={() => {
                                setModalCambiarEstado(false);
                                setUnidadSeleccionada(null);
                                // Refrescar unidades del tipo
                                if (unidadSeleccionada?.tipo_herramienta_id) fetchUnidadesTipo(unidadSeleccionada.tipo_herramienta_id);
                                fetchTipos();
                            }}
                        />
                    )}
                </>
            )}
        />
    );
};

// Modal para asignar herramienta
const ModalAsignar = ({ isOpen, unidad, onClose, onSuccess }) => {
    const [tipoAsignacion, setTipoAsignacion] = useState('usuario'); // 'usuario' o 'camioneta'
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
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

        if (tipoAsignacion === 'camioneta' && !camionetaSeleccionada) {
            toast.error('Selecciona una camioneta');
            return;
        }

        try {
            setLoading(true);

            await herramientasRentaService.asignarHerramienta({
                unidad_id: unidad.id,
                usuario_id: tipoAsignacion === 'usuario' ? parseInt(usuarioSeleccionado) : undefined,
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
        <CajonAsignar unidad={unidad} onClose={onClose} tipoAsignacion={tipoAsignacion} setTipoAsignacion={setTipoAsignacion}
            usuarioSeleccionado={usuarioSeleccionado} setUsuarioSeleccionado={setUsuarioSeleccionado} camionetaSeleccionada={camionetaSeleccionada}
            setCamionetaSeleccionada={setCamionetaSeleccionada} observaciones={observaciones} setObservaciones={setObservaciones}
            fechaVencimiento={fechaVencimiento} setFechaVencimiento={setFechaVencimiento} usuarios={usuarios} camionetas={camionetas}
            loading={loading} handleSubmit={handleSubmit} />
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

    return <CajonDevolver unidad={unidad} onClose={onClose} observaciones={observaciones} setObservaciones={setObservaciones} loading={loading} handleSubmit={handleSubmit} />;
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
        <CajonNuevoTipo onClose={onClose} formData={formData} handleChange={handleChange} categorias={categorias} ubicaciones={ubicaciones}
            proveedores={proveedores} loading={loading} handleSubmit={handleSubmit} />
    );
};

// Modal para cambiar estado de una unidad
const ModalCambiarEstado = ({ isOpen, unidad, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [nuevaCondicion, setNuevaCondicion] = useState('');
    const [motivo, setMotivo] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Usar el nuevo campo condicion si existe, o mapear desde estado
            const condicionActual = unidad.condicion || mapearEstadoACondicion(unidad.estado);
            setNuevaCondicion(condicionActual);
            setMotivo('');
        }
    }, [isOpen, unidad]);

    // Mapear estado antiguo a condicion nueva
    const mapearEstadoACondicion = (estado) => {
        const mapeo = {
            'buen_estado': 'bueno',
            'estado_regular': 'regular',
            'mal_estado': 'malo',
            'perdida': 'perdido',
            'baja': 'baja',
            'disponible': 'bueno',
            'asignada': 'bueno'
        };
        return mapeo[estado] || 'bueno';
    };

    // Solo condiciones físicas - el estatus se maneja por asignar/devolver
    const condicionesDisponibles = [
        { value: 'bueno', label: '🟢 Buen estado', color: 'text-green-700', desc: 'Funciona correctamente' },
        { value: 'regular', label: '🟡 Estado regular', color: 'text-yellow-700', desc: 'Funcional con desgaste' },
        { value: 'malo', label: '🔴 Mal estado', color: 'text-red-700', desc: 'Necesita reparación' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nuevaCondicion) {
            toast.error('Debes seleccionar una condición');
            return;
        }

        const condicionActual = unidad.condicion || mapearEstadoACondicion(unidad.estado);
        if (nuevaCondicion === condicionActual) {
            toast.error('La condición seleccionada es la misma que la actual');
            return;
        }

        try {
            setLoading(true);
            // Enviar solo condicion, el estatus no cambia al cambiar condición
            await herramientasRentaService.cambiarEstadoUnidad(unidad.id, {
                condicion: nuevaCondicion,
                motivo: motivo.trim()
            });
            toast.success(`Condición cambiada a «${(condicionesDisponibles.find(c => c.value === nuevaCondicion)?.label || '').replace(/^[^\p{L}\p{N}]+/u, '')}»`);
            onSuccess();
        } catch (error) {
            console.error('Error al cambiar condición:', error);
            toast.error(error.message || 'Error al cambiar la condición');
        } finally {
            setLoading(false);
        }
    };

    const condicionActual = unidad.condicion || mapearEstadoACondicion(unidad.estado);
    const estatusActual = unidad.estatus || (unidad.estado === 'asignada' ? 'asignado' : 'disponible');

    return (
        <CajonCondicion unidad={unidad} onClose={onClose} condicionesDisponibles={condicionesDisponibles} nuevaCondicion={nuevaCondicion}
            setNuevaCondicion={setNuevaCondicion} motivo={motivo} setMotivo={setMotivo} condicionActual={condicionActual}
            estatusActual={estatusActual} loading={loading} handleSubmit={handleSubmit} />
    );
};

export default RentaHerramientasPage;
