import { useEffect, useState, useCallback } from 'react';
import { obtenerAnunciosHoy, incrementarVistaAnuncio, regenerarAnuncio, leerAnunciosCalendario, generarAnuncioIndividual } from '../services/anuncios.service';
import { toast } from 'react-hot-toast';
import VistaAnuncios from '../rediseno2/publicas/VistaAnuncios';

/**
 * Página pública para mostrar anuncios en pantallas
 * Optimizada para pantallas completas y uso 24/7
 * Incluye botón de fullscreen para Android TV y menú de administración
 */
const AnunciosPublicosPage = () => {
  const [anuncios, setAnuncios] = useState([]);
  const [anunciosCalendario, setAnunciosCalendario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [regenerandoId, setRegenerandoId] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [generandoIndividual, setGenerandoIndividual] = useState(null);

  // Estado de progreso para generación masiva
  const [progresoGeneracion, setProgresoGeneracion] = useState({
    activo: false,
    total: 0,
    completados: 0,
    actual: null,
    estados: {} // { indexLista: 'pendiente' | 'generando' | 'completado' | 'error' }
  });

  // Verificar si el usuario está autenticado (admin)
  const token = localStorage.getItem('token');
  const isAdmin = !!token;

  // Cargar anuncios (los que ya están en BD)
  const cargarAnuncios = async (mostrarToast = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await obtenerAnunciosHoy();

      if (response.success && response.data) {
        setAnuncios(response.data);
        setUltimaActualizacion(new Date());

        // Incrementar contador de vistas para cada anuncio (solo la primera vez)
        if (!ultimaActualizacion) {
          response.data.forEach(anuncio => {
            incrementarVistaAnuncio(anuncio.id).catch(console.error);
          });
        }

        if (mostrarToast) {
          toast.success('Anuncios actualizados');
        }
      } else {
        setError('No se pudieron cargar los anuncios');
      }

    } catch (err) {
      console.error('Error al cargar anuncios:', err);
      setError('Error de conexión');

      if (mostrarToast) {
        toast.error('Error al actualizar anuncios');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar con calendario Y generar todos los pendientes con progreso
  const handleSincronizarYGenerar = async () => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setSincronizando(true);
      toast.loading('Leyendo anuncios del calendario...', { id: 'sync' });

      // Paso 1: Leer calendario y desactivar obsoletos
      const response = await leerAnunciosCalendario(token);

      if (!response.success || !response.data) {
        toast.error(response.message || 'Error al leer', { id: 'sync' });
        setSincronizando(false);
        return;
      }

      const anunciosLeidos = response.data.anunciosCalendario || [];
      setAnunciosCalendario(anunciosLeidos);

      // Identificar pendientes GUARDANDO SU ÍNDICE ORIGINAL
      const pendientesConIndex = anunciosLeidos
        .map((a, index) => ({ ...a, originalIndex: index }))
        .filter(a => !a.generado);

      if (pendientesConIndex.length === 0) {
        toast.success(`${anunciosLeidos.length} anuncios sincronizados, todos generados`, { id: 'sync' });
        await cargarAnuncios(false);
        setSincronizando(false);
        return;
      }

      toast.success(`Generando ${pendientesConIndex.length} anuncios nuevos...`, { id: 'sync' });

      // Paso 2: Iniciar generación con progreso
      const estadosIniciales = {};
      pendientesConIndex.forEach(item => {
        estadosIniciales[item.originalIndex] = 'pendiente';
      });

      setProgresoGeneracion({
        activo: true,
        total: pendientesConIndex.length,
        completados: 0,
        actual: null,
        estados: estadosIniciales
      });

      // Paso 3: Generar uno por uno
      let completados = 0;

      for (const item of pendientesConIndex) {
        const { originalIndex, textoAnuncio, proyecto, equipo } = item;

        // Actualizar estado a "generando"
        setProgresoGeneracion(prev => ({
          ...prev,
          actual: originalIndex,
          estados: { ...prev.estados, [originalIndex]: 'generando' }
        }));

        try {
          const resultado = await generarAnuncioIndividual(
            textoAnuncio,
            proyecto,
            equipo,
            token
          );

          if (resultado.success && resultado.data) {
            completados++;

            // Actualizar estado a "completado"
            setProgresoGeneracion(prev => ({
              ...prev,
              completados,
              estados: { ...prev.estados, [originalIndex]: 'completado' }
            }));

            // Actualizar localmente el anuncio en la lista para mostrar la imagen ya
            setAnunciosCalendario(prev => {
              const nuevaLista = [...prev];
              nuevaLista[originalIndex] = {
                ...nuevaLista[originalIndex],
                generado: true,
                id: resultado.data.id,
                imagen_url: resultado.data.imagen_url
              };
              return nuevaLista;
            });
          } else {
            throw new Error(resultado.message || 'Error desconocido');
          }

        } catch (err) {
          console.error(`Error generando anuncio index ${originalIndex}:`, err);
          // Actualizar estado a "error"
          setProgresoGeneracion(prev => ({
            ...prev,
            estados: { ...prev.estados, [originalIndex]: 'error' }
          }));
        }
      }

      // Finalizar progreso
      setProgresoGeneracion(prev => ({
        ...prev,
        activo: false,
        actual: null
      }));

      // Actualizar carousel final
      await cargarAnuncios(false);

      if (completados === pendientesConIndex.length) {
        toast.success(`¡Todos los anuncios generados! (${completados})`);
      } else {
        toast.success(`Proceso terminado: ${completados} generados, ${pendientesConIndex.length - completados} errores`);
      }

    } catch (err) {
      console.error('Error al sincronizar:', err);
      toast.error('Error al sincronizar', { id: 'sync' });
    } finally {
      setSincronizando(false);
    }
  };

  // Solo sincronizar sin generar (leer lista)
  const handleSoloSincronizar = async () => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setSincronizando(true);
      toast.loading('Leyendo anuncios...', { id: 'sync-only' });

      const response = await leerAnunciosCalendario(token);

      if (response.success && response.data) {
        setAnunciosCalendario(response.data.anunciosCalendario || []);
        // No recargamos el carousel aquí para no mezclar, o sí?
        // Mejor sí para limpiar desactivados
        await cargarAnuncios(false);

        const pendientes = (response.data.anunciosCalendario || []).filter(a => !a.generado).length;
        toast.success(
          `${response.data.totalEnCalendario} anuncios (${pendientes} pendientes)`,
          { id: 'sync-only' }
        );
      } else {
        toast.error(response.message || 'Error', { id: 'sync-only' });
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error al leer', { id: 'sync-only' });
    } finally {
      setSincronizando(false);
    }
  };

  // Regenerar un anuncio individual (ya generado)
  const handleRegenerar = async (anuncioId) => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setRegenerandoId(anuncioId);
      toast.loading('Regenerando anuncio con IA...', { id: 'regenerar' });

      const response = await regenerarAnuncio(anuncioId, token);

      if (response.success) {
        toast.success('Anuncio regenerado exitosamente', { id: 'regenerar' });
        await cargarAnuncios(false);
        await handleSoloSincronizar(); // Refrescar lista admin
      } else {
        toast.error(response.message || 'Error al regenerar', { id: 'regenerar' });
      }
    } catch (err) {
      console.error('Error al regenerar:', err);
      toast.error('Error al regenerar anuncio', { id: 'regenerar' });
    } finally {
      setRegenerandoId(null);
    }
  };

  // Generar un anuncio individual (no generado aún)
  const handleGenerarIndividual = async (anuncio, index) => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setGenerandoIndividual(index);
      toast.loading('Generando anuncio con IA...', { id: 'generar-ind' });

      const response = await generarAnuncioIndividual(
        anuncio.textoAnuncio,
        anuncio.proyecto,
        anuncio.equipo,
        token
      );

      if (response.success && response.data) {
        toast.success('Anuncio generado exitosamente', { id: 'generar-ind' });

        // Actualizar localmente
        setAnunciosCalendario(prev => {
          const nuevaLista = [...prev];
          nuevaLista[index] = {
            ...nuevaLista[index],
            generado: true,
            id: response.data.id,
            imagen_url: response.data.imagen_url
          };
          return nuevaLista;
        });

        await cargarAnuncios(false);
      } else {
        toast.error(response.message || 'Error al generar', { id: 'generar-ind' });
      }
    } catch (err) {
      console.error('Error al generar:', err);
      toast.error('Error al generar anuncio', { id: 'generar-ind' });
    } finally {
      setGenerandoIndividual(null);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
        toast.success('Pantalla completa activada');
      }).catch(err => {
        console.log('No se pudo activar pantalla completa:', err);
        toast.error('No se pudo activar pantalla completa');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  }, []);

  // Ocultar controles después de inactividad
  useEffect(() => {
    let timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 5000);
    };

    const handleKeyDown = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 5000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleMouseMove);

    timeout = setTimeout(() => setShowControls(false), 5000);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Detectar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cargar anuncios al montar el componente
  useEffect(() => {
    cargarAnuncios(false);

    const interval = setInterval(() => {
      cargarAnuncios(false);
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <VistaAnuncios
      anuncios={anuncios}
      anunciosCalendario={anunciosCalendario}
      loading={loading}
      error={error}
      ultimaActualizacion={ultimaActualizacion}
      isFullscreen={isFullscreen}
      showControls={showControls}
      showAdminMenu={showAdminMenu}
      setShowAdminMenu={setShowAdminMenu}
      regenerandoId={regenerandoId}
      sincronizando={sincronizando}
      generandoIndividual={generandoIndividual}
      progresoGeneracion={progresoGeneracion}
      isAdmin={isAdmin}
      cargarAnuncios={cargarAnuncios}
      handleSincronizarYGenerar={handleSincronizarYGenerar}
      handleSoloSincronizar={handleSoloSincronizar}
      handleRegenerar={handleRegenerar}
      handleGenerarIndividual={handleGenerarIndividual}
      toggleFullscreen={toggleFullscreen}
    />
  );
};

export default AnunciosPublicosPage;
