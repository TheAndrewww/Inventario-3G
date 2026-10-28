// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve. Las ramas con tv
// (useTvG3) en true son el diseño de TV de la ola 3, que tampoco se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    LogOut,
    RefreshCw,
    Lock,
    Hammer,
    Wrench,
    FileText,
    Eye,
    X
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { esProyectoMTO, esUrgenteMTO } from '../utils/produccion';
import toast, { Toaster } from 'react-hot-toast';
import { useTvG3 } from '../diseno-3g/tvG3';
import { BarraTv, VivoTv, CargandoTv } from '../diseno-3g/PiezasTv';
import { useDiseno3G } from '../rediseno2/fundacion/useDiseno3G';
import VistaTerminalCodigo from '../rediseno2/piso/VistaTerminalCodigo';
import VistaTerminalArea from '../rediseno2/piso/VistaTerminalArea';
import { AvisosPiso } from '../rediseno2/piso/AvisosPiso';

// Configuración de áreas
const AREAS_CONFIG = {
    diseno: {
        nombre: 'Diseño',
        color: '#8B5CF6',
        bgGradient: 'from-violet-600 to-violet-800',
        icon: Package,
        esSubEtapa: false
    },
    compras: {
        nombre: 'Compras',
        color: '#10B981',
        bgGradient: 'from-emerald-600 to-emerald-800',
        icon: ShoppingCart,
        esSubEtapa: false
    },
    manufactura: {
        nombre: 'Manufactura',
        color: '#F59E0B',
        bgGradient: 'from-amber-500 to-amber-700',
        icon: Factory,
        esSubEtapa: true,
        subEtapa: 'manufactura'
    },
    herreria: {
        nombre: 'Herrería',
        color: '#EF4444',
        bgGradient: 'from-red-500 to-red-700',
        icon: Hammer,
        esSubEtapa: true,
        subEtapa: 'herreria'
    },
    instalacion: {
        nombre: 'Instalación',
        color: '#3B82F6',
        bgGradient: 'from-blue-600 to-blue-800',
        icon: Truck,
        esSubEtapa: false
    }
};

// A4 · PLA-04: el código validado se guarda en la tableta o pantalla, por área, y va en cada llamada (X-Codigo-Area).
// Si el navegador no deja guardar (ventana privada), se queda en memoria mientras la página esté abierta.
const CLAVE_CODIGOS = 'terminal3g-codigos';
const codigosEnMemoria = {};
const leerCodigos = () => {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_CODIGOS) || '{}');
        return { ...codigosEnMemoria, ...(guardados && typeof guardados === 'object' ? guardados : {}) };
    } catch {
        return { ...codigosEnMemoria };
    }
};
const codigoGuardado = (area) => (area && leerCodigos()[area]) || null;
const guardarCodigo = (area, codigo) => {
    codigosEnMemoria[area] = codigo;
    try { localStorage.setItem(CLAVE_CODIGOS, JSON.stringify({ ...leerCodigos(), [area]: codigo })); } catch { /* sin almacenamiento */ }
};
const olvidarCodigo = (area) => {
    delete codigosEnMemoria[area];
    try {
        const codigos = leerCodigos();
        delete codigos[area];
        localStorage.setItem(CLAVE_CODIGOS, JSON.stringify(codigos));
    } catch { /* sin almacenamiento */ }
};

// Texto para la pantalla del código según lo que contestó el servidor
const mensajeDeError = (error) => {
    if (error.response?.status === 429) return error.response.data?.message || 'Demasiados intentos. Espera unos minutos.';
    if (error.response?.data?.message && error.response.status < 500) return error.response.data.message;
    if (!error.response) return 'No hay conexión con el servidor. Revisa el internet de esta pantalla.';
    return 'Código inválido';
};

// Pantalla de login con código de área
// A4 · PLA-04: con `areaEsperada` (llegó por /terminal/:area sin código guardado) dice de qué área es y ofrece
// «Cambiar de área». El error del código se queda escrito en la pantalla (código equivocado o la espera del límite).
const LoginArea = ({ onLogin, areaEsperada = null, aviso = null, onCambiarArea }) => {
    const tv = useTvG3(); // Diseño 3G para TV (solo con ?diseno=3g en la liga de la terminal)
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const nombreArea = AREAS_CONFIG[areaEsperada]?.nombre || null;
    const textoAviso = error || aviso;
    const d3 = useDiseno3G(); // Rediseño 2: encendido, la vista nueva (mismo formulario y mismo manejador)

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!codigo.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const response = await produccionService.validarCodigoArea(codigo);
            if (response.success) {
                onLogin(response.data.area, codigo.trim().toUpperCase());
                toast.success(`Acceso a ${response.data.info.nombre}`);
            }
        } catch (error) {
            setError(mensajeDeError(error));
        } finally {
            setLoading(false);
        }
    };

    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) {
        return (
            <VistaTerminalCodigo
                area={areaEsperada} nombreArea={nombreArea} codigo={codigo} alCambiarCodigo={(v) => setCodigo(v.toUpperCase())}
                alEnviar={handleSubmit} cargando={loading} error={textoAviso} alCambiarArea={areaEsperada ? onCambiarArea : null}
            />
        );
    }

    if (tv) {
        // Mismo formulario y mismo manejador; solo cambia cómo se ve.
        return (
            <div className="g3tv-acceso">
                <div className="g3tv-acceso-tarjeta">
                    <span className="g3tv-marca" aria-hidden="true">3G</span>
                    <h1>{nombreArea ? `Terminal de ${nombreArea}` : 'Terminal de producción'}</h1>
                    <p>{nombreArea ? `Ingresa el código de ${nombreArea}` : 'Ingresa el código de tu área'}</p>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="g3tv-codigo">Código del área</label>
                        <input
                            id="g3tv-codigo"
                            type="text"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                            className="g3tv-codigo"
                            placeholder="XXX-0000"
                            maxLength={20}
                            autoComplete="off"
                            autoFocus
                            aria-invalid={error ? true : undefined}
                            aria-describedby={textoAviso ? 'g3tv-codigo-aviso' : undefined}
                        />
                        {textoAviso && (
                            <p id="g3tv-codigo-aviso" role="alert" style={{ color: 'var(--g3-mal)', fontWeight: 600 }}>{textoAviso}</p>
                        )}
                        <button type="submit" disabled={loading || !codigo.trim()} className="g3tv-btn g3tv-btn--primario g3tv-btn--grande">
                            {loading ? 'Validando…' : 'Entrar'}
                        </button>
                        {areaEsperada && (
                            <button type="button" onClick={onCambiarArea} className="g3tv-btn g3tv-btn--contorno">
                                Cambiar de área
                            </button>
                        )}
                    </form>
                    <p className="g3tv-pie-texto">3G Velarias · Sistema de producción</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-8">
            <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Lock size={48} className="text-gray-600" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {nombreArea ? `Terminal de ${nombreArea}` : 'Terminal de Producción'}
                </h1>
                <p className="text-gray-500 mb-8">
                    {nombreArea ? `Ingresa el código de ${nombreArea}` : 'Ingresa el código de tu área'}
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                        className="w-full text-center text-3xl font-mono tracking-widest px-6 py-4 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-violet-200 focus:border-violet-500 mb-6"
                        placeholder="XXX-0000"
                        maxLength={20}
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        aria-describedby={textoAviso ? 'terminal-codigo-aviso' : undefined}
                    />

                    {textoAviso && (
                        <p id="terminal-codigo-aviso" role="alert" className="-mt-3 mb-5 text-base font-semibold text-red-600">
                            {textoAviso}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !codigo.trim()}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-violet-700 text-white text-xl font-bold rounded-xl hover:from-violet-700 hover:to-violet-800 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Validando...' : 'Ingresar'}
                    </button>

                    {areaEsperada && (
                        <button
                            type="button"
                            onClick={onCambiarArea}
                            className="w-full mt-4 py-3 text-lg font-semibold text-gray-600 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cambiar de área
                        </button>
                    )}
                </form>

                <p className="text-sm text-gray-400 mt-8">
                    3G Velarias - Sistema de Producción
                </p>
            </div>
        </div>
    );
};

// Modal para visualizar PDFs
const PDFViewerModal = ({ archivo, onClose }) => {
    const tv = useTvG3();
    if (!archivo) return null;

    // Generar link de embed para Google Drive
    const embedLink = archivo.link
        ? archivo.link.replace('/view', '/preview')
        : `https://drive.google.com/file/d/${archivo.id}/preview`;

    if (tv) {
        return (
            <div className="g3tv-visor" role="dialog" aria-modal="true" aria-label={archivo.nombre}>
                <div className="g3tv-visor-hoja">
                    <div className="g3tv-visor-cab">
                        <h3><FileText size={24} aria-hidden="true" />{archivo.nombre}</h3>
                        <button type="button" onClick={onClose} className="g3tv-btn g3tv-btn--contorno">
                            <X aria-hidden="true" />Cerrar plano
                        </button>
                    </div>
                    <iframe src={embedLink} title={archivo.nombre} allow="autoplay" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
            <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-100 border-b">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-blue-600" />
                        <h3 className="text-xl font-bold text-gray-800">{archivo.nombre}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={28} className="text-gray-600" />
                    </button>
                </div>

                {/* PDF Viewer */}
                <div className="w-full h-[calc(100%-4rem)]">
                    <iframe
                        src={embedLink}
                        className="w-full h-full border-0"
                        title={archivo.nombre}
                        allow="autoplay"
                    />
                </div>
            </div>
        </div>
    );
};

// Tarjeta de proyecto para terminal (grande y simple)
const ProyectoCardTerminal = ({ proyecto, onCompletar, areaConfig, loading: globalLoading, area, codigo, alArchivos }) => {
    const tv = useTvG3();
    // Rediseño 2: encendido, esta tarjeta solo es el cargador de los planos de su obra (la misma petición, una vez, con la
    // misma llave); no pinta nada y le avisa a la vista nueva qué trajo. La ficha de la obra la pinta la vista.
    const d3 = useDiseno3G();
    const [loading, setLoading] = useState(false);
    const [archivosLoading, setArchivosLoading] = useState(false);
    const [archivos, setArchivos] = useState(null);
    const [pdfAbierto, setPdfAbierto] = useState(null);
    const diasRestantes = proyecto.diasRestantes;
    // MTO: solo por fecha del calendario ya vencida
    const esUrgente = esProyectoMTO(proyecto)
        ? esUrgenteMTO(proyecto)
        : (proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3));

    // Cargar archivos de Drive cuando se monta el componente (solo para manufactura/herreria)
    useEffect(() => {
        const cargarArchivos = async () => {
            if (area !== 'manufactura' && area !== 'herreria') return;

            setArchivosLoading(true);
            try {
                const response = await produccionService.obtenerArchivosDriveTerminal(proyecto.id, codigo);
                if (response.success) {
                    setArchivos(response.data);
                }
            } catch (error) {
                console.error('Error cargando archivos:', error);
            } finally {
                setArchivosLoading(false);
            }
        };

        cargarArchivos();
    }, [proyecto.id, area, codigo]);

    useEffect(() => {
        if (d3 && alArchivos) alArchivos(proyecto.id, { cargando: archivosLoading, lista: archivos ? (archivos.archivos?.[area] || []) : null });
    }, [d3, alArchivos, proyecto.id, archivos, archivosLoading, area]);

    const handleCompletar = async () => {
        if (loading || globalLoading) return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    // Obtener archivos relevantes para esta área
    const archivosRelevantes = archivos?.archivos?.[area] || [];
    const tieneArchivos = archivosRelevantes.length > 0;

    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) return null;

    if (tv) {
        // Mismos datos, mismos planos y el mismo botón (mismo manejador); sin emojis y con el azul de acción.
        const plazoMal = diasRestantes !== null && diasRestantes <= 3;
        return (
            <article className={`g3tv-obra${esUrgente ? ' g3tv-obra--urgente' : ''}`}>
                {pdfAbierto && (
                    <PDFViewerModal
                        archivo={pdfAbierto}
                        onClose={() => setPdfAbierto(null)}
                    />
                )}
                <div className="g3tv-obra-cab">
                    <div className="g3tv-pila" style={{ gap: 8 }}>
                        {esUrgente && (
                            <span className="g3tv-etq g3tv-etq--mal" style={{ justifySelf: 'start' }}><AlertTriangle aria-hidden="true" />Urgente</span>
                        )}
                        <h2>{proyecto.nombre}</h2>
                        {proyecto.cliente && <p className="g3tv-cliente">{proyecto.cliente}</p>}
                    </div>
                    <span className="g3tv-num">#{proyecto.id}</span>
                </div>
                {proyecto.fecha_limite && (
                    <p className={`g3tv-obra-plazo${plazoMal ? ' g3tv-obra-plazo--mal' : ''}`}>
                        <Clock aria-hidden="true" />
                        {diasRestantes !== null && diasRestantes < 0
                            ? `Vencido hace ${Math.abs(diasRestantes)} días`
                            : diasRestantes === 0
                                ? 'Vence hoy'
                                : diasRestantes !== null
                                    ? `${diasRestantes} días restantes`
                                    : new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short'
                                    })}
                    </p>
                )}
                {(area === 'manufactura' || area === 'herreria') && (
                    archivosLoading ? (
                        <p className="g3tv-nota"><RefreshCw size={18} className="g3tv-gira" aria-hidden="true" /> Cargando planos…</p>
                    ) : tieneArchivos ? (
                        <div className="g3tv-planos">
                            <p>{archivosRelevantes.length} plano{archivosRelevantes.length !== 1 ? 's' : ''} disponible{archivosRelevantes.length !== 1 ? 's' : ''}</p>
                            {archivosRelevantes.map((archivo, index) => (
                                <button
                                    key={archivo.id || index}
                                    type="button"
                                    onClick={() => setPdfAbierto(archivo)}
                                    className="g3tv-btn g3tv-btn--tonal g3tv-btn--bloque"
                                >
                                    <Eye aria-hidden="true" />
                                    Ver: {archivo.nombre}
                                </button>
                            ))}
                        </div>
                    ) : archivos && !tieneArchivos ? (
                        <p className="g3tv-nota">Sin planos en Drive para este proyecto</p>
                    ) : null
                )}
                <button
                    type="button"
                    onClick={handleCompletar}
                    disabled={loading || globalLoading}
                    className="g3tv-btn g3tv-btn--primario g3tv-btn--grande"
                >
                    {loading
                        ? <><RefreshCw className="g3tv-gira" aria-hidden="true" />Procesando…</>
                        : <><CheckCircle2 aria-hidden="true" />Marcar como completado</>}
                </button>
            </article>
        );
    }

    return (
        <div className={`bg-white rounded-2xl shadow-xl p-6 border-4 ${esUrgente ? 'border-red-500 ring-4 ring-red-200' : 'border-white'
            }`}>
            {/* Modal de PDF */}
            {pdfAbierto && (
                <PDFViewerModal
                    archivo={pdfAbierto}
                    onClose={() => setPdfAbierto(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    {esUrgente && (
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <AlertTriangle size={24} />
                            <span className="font-bold text-lg">URGENTE</span>
                        </div>
                    )}
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                        {proyecto.nombre}
                    </h2>
                    {proyecto.cliente && (
                        <p className="text-lg text-gray-600 mt-1">{proyecto.cliente}</p>
                    )}
                </div>
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    #{proyecto.id}
                </span>
            </div>

            {/* Fecha límite */}
            {proyecto.fecha_limite && (
                <div className={`flex items-center gap-2 text-lg mb-6 ${diasRestantes !== null && diasRestantes <= 3
                    ? 'text-red-600 font-bold'
                    : 'text-gray-500'
                    }`}>
                    <Clock size={20} />
                    {diasRestantes !== null && diasRestantes < 0
                        ? `⚠️ Vencido hace ${Math.abs(diasRestantes)} días`
                        : diasRestantes === 0
                            ? '⏰ Vence HOY'
                            : diasRestantes !== null
                                ? `📅 ${diasRestantes} días restantes`
                                : new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                })
                    }
                </div>
            )}

            {/* Botones Ver Plano (si hay archivos) */}
            {(area === 'manufactura' || area === 'herreria') && (
                <div className="mb-4">
                    {archivosLoading ? (
                        <div className="flex items-center justify-center gap-2 text-gray-400 py-3">
                            <RefreshCw size={20} className="animate-spin" />
                            <span>Cargando planos...</span>
                        </div>
                    ) : tieneArchivos ? (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-500 mb-2 font-medium">
                                📄 {archivosRelevantes.length} plano(s) disponible(s):
                            </p>
                            <div className="grid gap-2">
                                {archivosRelevantes.map((archivo, index) => (
                                    <button
                                        key={archivo.id || index}
                                        onClick={() => setPdfAbierto(archivo)}
                                        className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl text-blue-700 font-semibold flex items-center justify-center gap-3 transition-all"
                                    >
                                        <Eye size={24} />
                                        Ver: {archivo.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : archivos && !tieneArchivos ? (
                        <p className="text-center text-gray-400 text-sm py-2">
                            Sin planos en Drive para este proyecto
                        </p>
                    ) : null}
                </div>
            )}

            {/* Botón completar - GRANDE */}
            <button
                onClick={handleCompletar}
                disabled={loading || globalLoading}
                className={`w-full py-6 px-8 rounded-xl text-white text-2xl font-bold flex items-center justify-center gap-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'
                    }`}
                style={{
                    background: `linear-gradient(135deg, ${areaConfig.color}, ${areaConfig.color}dd)`
                }}
            >
                {loading ? (
                    <>
                        <RefreshCw size={32} className="animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        <CheckCircle2 size={32} />
                        ✓ COMPLETADO
                    </>
                )}
            </button>
        </div>
    );
};

// Pantalla principal del terminal
const TerminalView = ({ area, codigo, onLogout, onCodigoRechazado }) => {
    const tv = useTvG3(); // Diseño 3G para TV: mismos datos, misma actualización cada 15 s
    const d3 = useDiseno3G(); // Rediseño 2: encendido, lista + ficha (mismos datos, misma actualización y mismos manejadores)
    const areaConfig = AREAS_CONFIG[area];
    const Icon = areaConfig?.icon || Package;

    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actualizando, setActualizando] = useState(false);

    const cargarProyectos = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            else setActualizando(true);

            const response = await produccionService.obtenerProyectosArea(area, codigo);
            if (response.success) {
                setProyectos(response.data.proyectos);
            }
        } catch (error) {
            // A4 · PLA-04 (fase C): el servidor ya no acepta el código de esta pantalla → se vuelve a pedir.
            if (error.response?.status === 403 && error.response.data?.codigo === 'CODIGO_TERMINAL') {
                onCodigoRechazado?.(error.response.data.message);
                return;
            }
            console.error('Error al cargar proyectos:', error);
            toast.error('Error al cargar proyectos');
        } finally {
            setLoading(false);
            setActualizando(false);
        }
    }, [area, codigo, onCodigoRechazado]);

    useEffect(() => {
        cargarProyectos();

        // Auto-refresh cada 15 segundos
        const interval = setInterval(() => cargarProyectos(false), 15000);
        return () => clearInterval(interval);
    }, [cargarProyectos]);

    const handleCompletar = async (proyectoId) => {
        try {
            let response;

            // Si es una sub-etapa (manufactura o herrería), usar el endpoint específico
            if (areaConfig?.esSubEtapa && areaConfig?.subEtapa) {
                response = await produccionService.completarSubEtapaTerminal(
                    proyectoId,
                    areaConfig.subEtapa,
                    codigo
                );

                if (response.success) {
                    const mensaje = response.data.puedeAvanzarAInstalacion
                        ? `${areaConfig.nombre} completada ✅ ¡Listo para Instalación!`
                        : `${areaConfig.nombre} completada ✅`;

                    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
                    if (d3) {
                        // Rediseño 2: el mismo aviso, sin emojis y diciendo qué sigue
                        toast.success(
                            // 28-oct · CALIDAD_AVAL_CIERRA: producción terminó, pero la obra espera el aval de Calidad
                            response.data.esperaCalidad
                                ? `${areaConfig.nombre} terminada. La obra espera el aval de Calidad para quedar lista.`
                                : response.data.puedeAvanzarAInstalacion
                                ? `${areaConfig.nombre} terminada. La obra queda lista para instalar.`
                                : `${areaConfig.nombre} terminada. Falta ${areaConfig.subEtapa === 'manufactura' ? 'herrería' : 'manufactura'}.`,
                            { duration: 4000 }
                        );
                    } else if (tv) {
                        // Mismo aviso, sin emojis
                        toast.success(
                            <div className="g3tv-aviso">
                                <div>{response.data.puedeAvanzarAInstalacion ? `${areaConfig.nombre} completada. ¡Listo para instalación!` : `${areaConfig.nombre} completada.`}</div>
                                {!response.data.puedeAvanzarAInstalacion && (
                                    <div style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.85, marginTop: 4 }}>
                                        Esperando {areaConfig.subEtapa === 'manufactura' ? 'Herrería' : 'Manufactura'}
                                    </div>
                                )}
                            </div>,
                            { duration: 4000 }
                        );
                    } else toast.success(
                        <div className="text-center">
                            <div className="text-2xl mb-1">✅</div>
                            <div className="font-bold">{mensaje}</div>
                            {!response.data.puedeAvanzarAInstalacion && (
                                <div className="text-sm opacity-80 mt-1">
                                    Esperando {areaConfig.subEtapa === 'manufactura' ? 'Herrería' : 'Manufactura'}
                                </div>
                            )}
                        </div>,
                        { duration: 4000 }
                    );
                }
            } else {
                // Áreas normales (diseño, compras, instalación)
                response = await produccionService.completarEtapaTerminal(proyectoId, codigo);

                if (response.success) {
                    toast.success(
                        d3
                            ? response.message
                            : tv
                            ? <div className="g3tv-aviso">{response.message}</div>
                            : (
                                <div className="text-center">
                                    <div className="text-2xl mb-1">✅</div>
                                    <div className="font-bold">{response.message}</div>
                                </div>
                            ),
                        { duration: 3000 }
                    );
                }
            }

            cargarProyectos(false);
        } catch (error) {
            if (error.response?.status === 403 && error.response.data?.codigo === 'CODIGO_TERMINAL') {
                onCodigoRechazado?.(error.response.data.message);
                return;
            }
            console.error('Error al completar:', error);
            toast.error(error.response?.data?.message || 'Error al completar');
        }
    };

    // Rediseño 2 (encendido): la cola del área + la ficha de la obra elegida. Cada obra conserva su cargador de planos de
    // hoy (ProyectoCardTerminal con la misma llave), que en encendido no pinta nada.
    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) {
        return (
            <VistaTerminalArea
                area={area} nombreArea={areaConfig?.nombre || area} proyectos={proyectos} cargando={loading} actualizando={actualizando}
                alActualizar={() => cargarProyectos(false)} alCompletar={handleCompletar} alCambiarArea={onLogout}
                cargadores={(alArchivos) => proyectos.map(proyecto => (
                    <ProyectoCardTerminal
                        key={proyecto.id}
                        proyecto={proyecto}
                        onCompletar={handleCompletar}
                        areaConfig={areaConfig}
                        loading={actualizando}
                        area={area}
                        codigo={codigo}
                        alArchivos={alArchivos}
                    />
                ))}
            />
        );
    }

    if (loading && tv) return <CargandoTv>Cargando proyectos…</CargandoTv>;
    if (loading) {
        return (
            <div className={`min-h-screen bg-gradient-to-br ${areaConfig?.bgGradient || 'from-gray-600 to-gray-800'} flex items-center justify-center`}>
                <div className="text-center text-white">
                    <RefreshCw size={64} className="animate-spin mx-auto mb-4" />
                    <p className="text-2xl">Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    if (tv) {
        return (
            <div className="g3tv" style={{ minHeight: '100vh' }}>
                <div className="g3tv-desplaza" style={{ height: 'auto' }}>
                    <div className="g3tv-pila">
                        <BarraTv
                            titulo={areaConfig?.nombre}
                            icono={Icon}
                            subtitulo={<><b>{proyectos.length}</b> proyecto{proyectos.length !== 1 ? 's' : ''} pendiente{proyectos.length !== 1 ? 's' : ''}</>}
                            derecha={(
                                <>
                                    <VivoTv>En vivo · cada 15 segundos</VivoTv>
                                    <button
                                        type="button"
                                        onClick={() => cargarProyectos(false)}
                                        disabled={actualizando}
                                        className="g3tv-btn g3tv-btn--contorno"
                                    >
                                        <RefreshCw className={actualizando ? 'g3tv-gira' : ''} aria-hidden="true" />
                                        Actualizar
                                    </button>
                                    <button type="button" onClick={onLogout} className="g3tv-btn g3tv-btn--contorno">
                                        <LogOut aria-hidden="true" />
                                        Cambiar de área
                                    </button>
                                </>
                            )}
                        />
                        {proyectos.length === 0 ? (
                            <div className="g3tv-vacio">
                                <CheckCircle2 aria-hidden="true" />
                                <b>¡Todo completado!</b>
                                <p>No hay proyectos pendientes en esta área</p>
                            </div>
                        ) : (
                            <div className="g3tv-rejilla">
                                {proyectos.map(proyecto => (
                                    <ProyectoCardTerminal
                                        key={proyecto.id}
                                        proyecto={proyecto}
                                        onCompletar={handleCompletar}
                                        areaConfig={areaConfig}
                                        loading={actualizando}
                                        area={area}
                                        codigo={codigo}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="g3tv-pie-fijo">
                    <span>3G Velarias · Terminal de {areaConfig?.nombre}{actualizando && ' · Actualizando…'}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-gradient-to-br ${areaConfig?.bgGradient || 'from-gray-600 to-gray-800'} p-6`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Icon size={36} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{areaConfig?.nombre}</h1>
                        <p className="text-white/70">
                            {proyectos.length} proyecto(s) pendiente(s)
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => cargarProyectos(false)}
                        disabled={actualizando}
                        className="p-4 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                    >
                        <RefreshCw size={28} className={actualizando ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={onLogout}
                        title="Cambiar de área"
                        aria-label="Cambiar de área"
                        className="p-4 bg-white/10 hover:bg-red-500/50 rounded-xl text-white transition-colors"
                    >
                        <LogOut size={28} />
                    </button>
                </div>
            </div>

            {/* Lista de proyectos */}
            {proyectos.length === 0 ? (
                <div className="text-center text-white py-20">
                    <CheckCircle2 size={80} className="mx-auto mb-6 opacity-50" />
                    <h2 className="text-3xl font-bold mb-2">¡Todo completado!</h2>
                    <p className="text-xl text-white/70">
                        No hay proyectos pendientes en esta área
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    {proyectos.map(proyecto => (
                        <ProyectoCardTerminal
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={handleCompletar}
                            areaConfig={areaConfig}
                            loading={actualizando}
                            area={area}
                            codigo={codigo}
                        />
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="fixed bottom-4 left-0 right-0 text-center text-white/50 text-sm">
                3G Velarias - Terminal {areaConfig?.nombre}
                {actualizando && ' • Actualizando...'}
            </div>
        </div>
    );
};

// Componente principal
const TerminalAreaPage = () => {
    const { area: areaParam } = useParams();
    const navigate = useNavigate();
    const tv = useTvG3();
    const d3 = useDiseno3G(); // Rediseño 2: encendido, sus avisos grandes de piso (los mismos toast de siempre)
    // Diseño 3G para TV: la liga conserva ?diseno=3g al entrar y salir del área, para que la tableta siga igual si se recarga.
    const sufijoTv = tv ? `?diseno=3g${tv === 'oscuro' ? '&tema=oscuro' : ''}` : '';
    // A4 · PLA-04: la liga del área ya no entra sola: solo si esta pantalla tiene guardado el código de esa área.
    const [area, setArea] = useState(() => (areaParam && codigoGuardado(areaParam) ? areaParam : null));
    const [codigo, setCodigo] = useState(() => codigoGuardado(areaParam));
    const [aviso, setAviso] = useState(null);

    // Si llega con área en la URL y ya tiene su código, entrar directo; si no, pedir el código de esa área
    useEffect(() => {
        if (areaParam && AREAS_CONFIG[areaParam]) {
            const guardado = codigoGuardado(areaParam);
            setCodigo(guardado);
            setArea(guardado ? areaParam : null);
        }
    }, [areaParam]);

    const handleLogin = (areaValidada, codigoValidado) => {
        guardarCodigo(areaValidada, codigoValidado);
        setAviso(null);
        setCodigo(codigoValidado);
        setArea(areaValidada);
        navigate(`/terminal/${areaValidada}${sufijoTv}`, { replace: true });
    };

    // «Cambiar de área»: regresa a la pantalla del código; los códigos guardados se quedan en la pantalla
    const handleLogout = () => {
        setAviso(null);
        setArea(null);
        navigate(`/terminal${sufijoTv}`, { replace: true });
    };

    // El servidor ya no acepta el código guardado (fase C): se olvida y se vuelve a pedir el de esa área
    const handleCodigoRechazado = useCallback((mensaje) => {
        if (area) olvidarCodigo(area);
        setCodigo(null);
        setAviso(mensaje || 'El código de esta pantalla ya no vale. Escribe el código de tu área.');
        setArea(null);
    }, [area]);

    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) {
        return (
            <>
                <AvisosPiso />
                {area && AREAS_CONFIG[area] ? (
                    <TerminalView area={area} codigo={codigo} onLogout={handleLogout} onCodigoRechazado={handleCodigoRechazado} />
                ) : (
                    <LoginArea
                        key={areaParam || 'todas'}
                        onLogin={handleLogin}
                        areaEsperada={areaParam && AREAS_CONFIG[areaParam] ? areaParam : null}
                        aviso={aviso}
                        onCambiarArea={handleLogout}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        fontSize: '1.25rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '1rem',
                    },
                }}
            />

            {area && AREAS_CONFIG[area] ? (
                <TerminalView area={area} codigo={codigo} onLogout={handleLogout} onCodigoRechazado={handleCodigoRechazado} />
            ) : (
                <LoginArea
                    key={areaParam || 'todas'}
                    onLogin={handleLogin}
                    areaEsperada={areaParam && AREAS_CONFIG[areaParam] ? areaParam : null}
                    aviso={aviso}
                    onCambiarArea={handleLogout}
                />
            )}
        </>
    );
};

export default TerminalAreaPage;
