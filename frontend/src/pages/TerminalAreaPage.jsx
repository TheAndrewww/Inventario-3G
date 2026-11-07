import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    Hammer,
    Wrench,
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import toast from 'react-hot-toast';
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
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const nombreArea = AREAS_CONFIG[areaEsperada]?.nombre || null;
    const textoAviso = error || aviso;

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

    return (
        <VistaTerminalCodigo
            area={areaEsperada} nombreArea={nombreArea} codigo={codigo} alCambiarCodigo={(v) => setCodigo(v.toUpperCase())}
            alEnviar={handleSubmit} cargando={loading} error={textoAviso} alCambiarArea={areaEsperada ? onCambiarArea : null}
        />
    );
};

// Tarjeta de proyecto para terminal (grande y simple)
const ProyectoCardTerminal = ({ proyecto, onCompletar, areaConfig, loading: globalLoading, area, codigo, alArchivos }) => {
    const [archivosLoading, setArchivosLoading] = useState(false);
    const [archivos, setArchivos] = useState(null);

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
        if (alArchivos) alArchivos(proyecto.id, { cargando: archivosLoading, lista: archivos ? (archivos.archivos?.[area] || []) : null });
    }, [alArchivos, proyecto.id, archivos, archivosLoading, area]);

    return null;
};

// Pantalla principal del terminal
const TerminalView = ({ area, codigo, onLogout, onCodigoRechazado }) => {
    const areaConfig = AREAS_CONFIG[area];

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
                }
            } else {
                // Áreas normales (diseño, compras, instalación)
                response = await produccionService.completarEtapaTerminal(proyectoId, codigo);

                if (response.success) {
                    toast.success(
                        response.message,
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
};

// Componente principal
const TerminalAreaPage = () => {
    const { area: areaParam } = useParams();
    const navigate = useNavigate();
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
        navigate(`/terminal/${areaValidada}`, { replace: true });
    };

    // «Cambiar de área»: regresa a la pantalla del código; los códigos guardados se quedan en la pantalla
    const handleLogout = () => {
        setAviso(null);
        setArea(null);
        navigate('/terminal', { replace: true });
    };

    // El servidor ya no acepta el código guardado (fase C): se olvida y se vuelve a pedir el de esa área
    const handleCodigoRechazado = useCallback((mensaje) => {
        if (area) olvidarCodigo(area);
        setCodigo(null);
        setAviso(mensaje || 'El código de esta pantalla ya no vale. Escribe el código de tu área.');
        setArea(null);
    }, [area]);

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
};

export default TerminalAreaPage;
