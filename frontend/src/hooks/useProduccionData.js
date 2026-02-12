import { useState, useCallback, useEffect, useRef } from 'react';
import produccionService from '../services/produccion.service';
import { flattenProyectos } from '../utils/produccion';
import toast from 'react-hot-toast';

/**
 * Hook para gestionar datos del dashboard de producción
 * Compartido entre DashboardProduccionPage y DashboardProduccionTVPage
 * 
 * @param {object} options
 * @param {boolean} options.autoSync - Sincronizar con Sheets al cargar (default: false)
 * @param {number} options.refreshInterval - Intervalo de refresh en ms (default: 60000)
 * @param {boolean} options.isPublic - Usar endpoint público (default: false)
 */
export const useProduccionData = ({
    autoSync = false,
    refreshInterval = 60000,
    isPublic = false
} = {}) => {
    const [proyectos, setProyectos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [loading, setLoading] = useState(true);
    const [sincronizando, setSincronizando] = useState(false);
    const [ultimaSync, setUltimaSync] = useState(null);

    const mountedRef = useRef(true);

    // Cargar datos del dashboard
    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = isPublic
                ? await produccionService.obtenerDashboardPublico()
                : await produccionService.obtenerDashboard();

            if (response.success && mountedRef.current) {
                setProyectos(flattenProyectos(response.data.resumen));
                setEstadisticas(response.data.estadisticas);
            }
        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            if (!isPublic) {
                toast.error('Error al cargar el dashboard');
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [isPublic]);

    // Sincronizar con Google Sheets
    const sincronizarSheets = useCallback(async () => {
        try {
            setSincronizando(true);
            const response = await produccionService.sincronizarConSheets();
            if (response.success && mountedRef.current) {
                const mesesInfo = response.data.meses?.length > 1 ? ` (${response.data.meses.length} meses)` : '';
                toast.success(
                    `Sincronizado${mesesInfo}: ${response.data.creados} nuevos, ${response.data.actualizados} actualizados`
                );
                setUltimaSync(new Date());
                await cargarDatos();
            }
        } catch (error) {
            console.error('Error al sincronizar:', error);
            toast.error('Error al sincronizar con Google Sheets');
        } finally {
            if (mountedRef.current) {
                setSincronizando(false);
            }
        }
    }, [cargarDatos]);

    // Sincronizar con Google Drive
    const sincronizarDrive = useCallback(async () => {
        try {
            setSincronizando(true);
            toast.loading('Sincronizando con Drive...', { id: 'sync-drive' });

            const response = await produccionService.sincronizarTodosDrive();

            if (response?.success && mountedRef.current) {
                toast.success(
                    `Drive actualizado: ${response.data.exitosos} proyectos procesados`,
                    { id: 'sync-drive' }
                );
                await cargarDatos();
            } else {
                toast.error('Error al sincronizar con Drive', { id: 'sync-drive' });
            }
        } catch (error) {
            console.error('Error al sincronizar Drive:', error);
            toast.error('Error de conexión con Drive', { id: 'sync-drive' });
        } finally {
            if (mountedRef.current) {
                setSincronizando(false);
            }
        }
    }, [cargarDatos]);

    // Completar etapa de un proyecto
    const completarEtapa = useCallback(async (proyectoId) => {
        try {
            const response = await produccionService.completarEtapa(proyectoId);
            if (response.success) {
                toast.success(response.message);
                await cargarDatos();
            }
        } catch (error) {
            console.error('Error al completar etapa:', error);
            toast.error('Error al completar etapa');
        }
    }, [cargarDatos]);

    // Regresar a etapa anterior
    const regresarEtapa = useCallback(async (proyectoId) => {
        try {
            const response = await produccionService.regresarEtapa(proyectoId);
            if (response.success) {
                toast.success(response.message);
                await cargarDatos();
            }
        } catch (error) {
            console.error('Error al regresar etapa:', error);
            toast.error(error.response?.data?.message || 'Error al regresar etapa');
        }
    }, [cargarDatos]);

    // Crear nuevo proyecto
    const crearProyecto = useCallback(async (data) => {
        try {
            const response = await produccionService.crearProyecto(data);
            if (response.success) {
                toast.success('Proyecto creado exitosamente');
                await cargarDatos();
                return true;
            }
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            toast.error('Error al crear proyecto');
        }
        return false;
    }, [cargarDatos]);

    // Completar sub-etapa de producción (manufactura o herrería)
    const completarSubEtapa = useCallback(async (proyectoId, subEtapa) => {
        try {
            const response = await produccionService.completarSubEtapa(proyectoId, subEtapa);
            if (response.success) {
                toast.success(response.message);
                await cargarDatos();
            }
        } catch (error) {
            console.error('Error al completar sub-etapa:', error);
            toast.error(error.response?.data?.message || 'Error al completar sub-etapa');
        }
    }, [cargarDatos]);

    // Pausar/reanudar proyecto
    const togglePausa = useCallback(async (proyectoId, motivo = '') => {
        try {
            const response = await produccionService.togglePausa(proyectoId, motivo);
            if (response.success) {
                toast.success(response.message);
                await cargarDatos();
            }
        } catch (error) {
            console.error('Error al pausar/reanudar proyecto:', error);
            toast.error('Error al pausar/reanudar proyecto');
        }
    }, [cargarDatos]);

    // Toggle etapa específica
    const toggleEtapa = useCallback(async (proyectoId, etapa, completado) => {
        try {
            const response = await produccionService.toggleEtapa(proyectoId, etapa, completado);
            if (response.success) {
                await cargarDatos();
                return true;
            }
        } catch (error) {
            console.error('Error al toggle etapa:', error);
            toast.error('Error al actualizar etapa');
            return false;
        }
    }, [cargarDatos]);

    // Efecto inicial y cleanup
    useEffect(() => {
        mountedRef.current = true;

        const inicializar = async () => {
            if (autoSync) {
                setSincronizando(true);
                try {
                    await produccionService.sincronizarConSheets();
                    setUltimaSync(new Date());
                } catch (error) {
                    console.error('Error en sincronización automática:', error);
                } finally {
                    setSincronizando(false);
                }
            }
            await cargarDatos();
        };

        inicializar();

        // Auto-refresh
        const interval = setInterval(() => {
            if (autoSync) {
                produccionService.sincronizarConSheets()
                    .then(() => setUltimaSync(new Date()))
                    .catch(console.error);
            }
            cargarDatos();
        }, refreshInterval);

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [autoSync, refreshInterval, cargarDatos]);

    return {
        proyectos,
        estadisticas,
        loading,
        sincronizando,
        ultimaSync,
        cargarDatos,
        sincronizarSheets,
        sincronizarDrive,
        completarEtapa,
        regresarEtapa,
        completarSubEtapa,
        crearProyecto,
        togglePausa,
        toggleEtapa
    };
};

export default useProduccionData;
