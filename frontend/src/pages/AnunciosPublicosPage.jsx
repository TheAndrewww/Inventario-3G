import { useEffect, useState, useCallback } from 'react';
import CarouselAnuncios from '../components/anuncios/CarouselAnuncios';
import { obtenerAnunciosHoy, incrementarVistaAnuncio, regenerarAnuncio, leerAnunciosCalendario, generarAnuncioIndividual } from '../services/anuncios.service';
import { toast, Toaster } from 'react-hot-toast';
import { Maximize2, Minimize2, RefreshCw, Settings, X, RotateCcw, Sparkles, FileText, ImageOff, Check, Loader2 } from 'lucide-react';

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
    estados: {} // { index: 'pendiente' | 'generando' | 'completado' | 'error' }
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
        return;
      }

      const anunciosLeidos = response.data.anunciosCalendario || [];
      setAnunciosCalendario(anunciosLeidos);

      // Identificar pendientes
      const pendientes = anunciosLeidos.filter(a => !a.generado);

      if (pendientes.length === 0) {
        toast.success(`${anunciosLeidos.length} anuncios sincronizados, todos generados`, { id: 'sync' });
        await cargarAnuncios(false);
        return;
      }

      toast.success(`${anunciosLeidos.length} anuncios, generando ${pendientes.length} nuevos...`, { id: 'sync' });

      // Paso 2: Iniciar generación con progreso
      const estadosIniciales = {};
      pendientes.forEach((_, idx) => {
        estadosIniciales[idx] = 'pendiente';
      });

      setProgresoGeneracion({
        activo: true,
        total: pendientes.length,
        completados: 0,
        actual: null,
        estados: estadosIniciales
      });

      // Paso 3: Generar uno por uno
      let completados = 0;

      for (let i = 0; i < pendientes.length; i++) {
        const anuncio = pendientes[i];

        // Actualizar estado a "generando"
        setProgresoGeneracion(prev => ({
          ...prev,
          actual: i,
          estados: { ...prev.estados, [i]: 'generando' }
        }));

        try {
          await generarAnuncioIndividual(
            anuncio.textoAnuncio,
            anuncio.proyecto,
            anuncio.equipo,
            token
          );

          completados++;

          // Actualizar estado a "completado"
          setProgresoGeneracion(prev => ({
            ...prev,
            completados,
            estados: { ...prev.estados, [i]: 'completado' }
          }));

          // Actualizar lista de anuncios en el carousel
          await cargarAnuncios(false);

          // También actualizar la lista del menú
          const nuevoResponse = await leerAnunciosCalendario(token);
          if (nuevoResponse.success && nuevoResponse.data) {
            setAnunciosCalendario(nuevoResponse.data.anunciosCalendario || []);
          }

        } catch (err) {
          console.error(`Error generando anuncio ${i}:`, err);
          // Actualizar estado a "error"
          setProgresoGeneracion(prev => ({
            ...prev,
            estados: { ...prev.estados, [i]: 'error' }
          }));
        }
      }

      // Finalizar progreso
      setProgresoGeneracion(prev => ({
        ...prev,
        activo: false,
        actual: null
      }));

      toast.success(`¡${completados} anuncios generados!`);

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
        await handleSoloSincronizar();
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

      if (response.success) {
        toast.success('Anuncio generado exitosamente', { id: 'generar-ind' });
        await cargarAnuncios(false);
        await handleSoloSincronizar();
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

  if (loading && anuncios.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mb-4"></div>
        <div className="text-white text-2xl font-bold">Cargando anuncios...</div>
        <div className="text-gray-400 text-lg mt-2">3G Velarias</div>
      </div>
    );
  }

  if (error && anuncios.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <div className="text-white text-2xl font-bold mb-2">Error de Conexión</div>
        <div className="text-gray-400 text-lg">{error}</div>
        <button
          onClick={() => cargarAnuncios(true)}
          className="mt-6 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Lista combinada: usa anunciosCalendario si tiene datos, sino usa anuncios de BD
  const listaAnuncios = anunciosCalendario.length > 0 ? anunciosCalendario : anuncios.map(a => ({
    textoAnuncio: a.frase,
    generado: true,
    id: a.id,
    imagen_url: a.imagen_url
  }));

  // Calcular progreso
  const porcentajeProgreso = progresoGeneracion.total > 0
    ? Math.round((progresoGeneracion.completados / progresoGeneracion.total) * 100)
    : 0;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <div className="h-screen bg-black overflow-hidden relative">
        {/* Indicador de LIVE en la esquina */}
        <div className={`absolute top-4 right-4 z-50 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          LIVE DISPLAY
        </div>

        {/* Botones de control para Android TV */}
        <div className={`absolute top-4 left-4 z-50 flex gap-2 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={toggleFullscreen}
            className="bg-black/70 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 hover:bg-black/90 hover:border-orange-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 size={28} /> : <Maximize2 size={28} />}
          </button>

          <button
            onClick={() => cargarAnuncios(true)}
            className="bg-black/70 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 hover:bg-black/90 hover:border-orange-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Actualizar anuncios"
          >
            <RefreshCw size={28} className={loading ? 'animate-spin' : ''} />
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAdminMenu(!showAdminMenu)}
              className={`bg-black/70 backdrop-blur-md text-white p-3 rounded-xl border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 ${showAdminMenu ? 'border-orange-500 bg-orange-600/30' : 'border-white/20 hover:bg-black/90 hover:border-orange-500'
                }`}
              title="Administración de anuncios"
            >
              <Settings size={28} />
            </button>
          )}
        </div>

        {/* Menú de administración */}
        {showAdminMenu && isAdmin && (
          <div className="absolute top-20 left-4 z-50 bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/20 p-5 w-[450px] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold text-xl">Administrar Anuncios</h3>
              <button
                onClick={() => setShowAdminMenu(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Barra de progreso global */}
            {progresoGeneracion.activo && (
              <div className="mb-5 p-4 bg-blue-900/30 rounded-xl border border-blue-500/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-300 text-sm font-medium">Generando imágenes...</span>
                  <span className="text-blue-300 text-sm">{progresoGeneracion.completados}/{progresoGeneracion.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${porcentajeProgreso}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="space-y-3 mb-5">
              {/* Solo Leer */}
              <button
                onClick={handleSoloSincronizar}
                disabled={sincronizando || progresoGeneracion.activo}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white py-3 px-4 rounded-xl transition-colors text-base font-medium"
              >
                {sincronizando ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Leyendo...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Solo Leer Lista
                  </>
                )}
              </button>

              {/* Sincronizar y Generar Todo */}
              <button
                onClick={handleSincronizarYGenerar}
                disabled={sincronizando || progresoGeneracion.activo}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white py-3 px-4 rounded-xl transition-colors text-base font-medium"
              >
                {progresoGeneracion.activo ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generando {progresoGeneracion.completados + 1}/{progresoGeneracion.total}...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Sincronizar y Generar Todo
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-gray-300 text-base mb-4 font-medium">
                Anuncios ({listaAnuncios.length})
              </h4>

              {listaAnuncios.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-base">No hay anuncios</p>
                  <p className="text-gray-600 text-sm mt-1">Presiona "Solo Leer Lista" para ver anuncios del calendario</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {listaAnuncios.map((anuncio, index) => {
                    // Determinar estado del item
                    const estadoProgreso = progresoGeneracion.estados[index];
                    const estaGenerando = estadoProgreso === 'generando';
                    const estaCompletado = estadoProgreso === 'completado';
                    const tieneError = estadoProgreso === 'error';

                    return (
                      <div
                        key={anuncio.id || index}
                        className={`rounded-xl p-4 border transition-all duration-300 ${estaCompletado ? 'bg-green-900/20 border-green-500/50' :
                            estaGenerando ? 'bg-blue-900/20 border-blue-500/50 animate-pulse' :
                              tieneError ? 'bg-red-900/20 border-red-500/50' :
                                anuncio.generado ? 'bg-black/50 border-green-500/30' :
                                  'bg-black/50 border-yellow-500/30'
                          }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Miniatura */}
                          <div className="w-20 h-20 bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                            {anuncio.generado && anuncio.imagen_url ? (
                              <img
                                src={anuncio.imagen_url}
                                alt={`Anuncio ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : estaGenerando ? (
                              <Loader2 size={32} className="text-blue-400 animate-spin" />
                            ) : estaCompletado ? (
                              <Check size={32} className="text-green-400" />
                            ) : (
                              <ImageOff size={32} className="text-gray-600" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-base font-medium line-clamp-2">
                              {anuncio.textoAnuncio || anuncio.frase}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {estaCompletado ? (
                                <span className="text-green-400 text-sm flex items-center gap-1">
                                  <Check size={14} /> ¡Generado!
                                </span>
                              ) : estaGenerando ? (
                                <span className="text-blue-400 text-sm flex items-center gap-1">
                                  <Loader2 size={14} className="animate-spin" /> Generando...
                                </span>
                              ) : tieneError ? (
                                <span className="text-red-400 text-sm flex items-center gap-1">
                                  ✗ Error
                                </span>
                              ) : anuncio.generado ? (
                                <span className="text-green-400 text-sm flex items-center gap-1">
                                  ✓ Generado
                                </span>
                              ) : (
                                <span className="text-yellow-400 text-sm flex items-center gap-1">
                                  ⏳ Pendiente
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botón de acción individual */}
                        {!progresoGeneracion.activo && (
                          <button
                            onClick={() => anuncio.generado
                              ? handleRegenerar(anuncio.id)
                              : handleGenerarIndividual(anuncio, index)
                            }
                            disabled={regenerandoId === anuncio.id || generandoIndividual === index}
                            className="w-full mt-3 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white py-2.5 px-4 rounded-lg text-sm transition-colors"
                          >
                            {(regenerandoId === anuncio.id || generandoIndividual === index) ? (
                              <>
                                <RefreshCw size={16} className="animate-spin" />
                                {anuncio.generado ? 'Regenerando...' : 'Generando...'}
                              </>
                            ) : (
                              <>
                                {anuncio.generado ? <RotateCcw size={16} /> : <Sparkles size={16} />}
                                {anuncio.generado ? 'Regenerar Imagen' : 'Generar Imagen'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Carousel de anuncios */}
        <CarouselAnuncios anuncios={anuncios} />

        {/* Indicador de última actualización */}
        <div className={`absolute bottom-4 left-4 z-50 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {ultimaActualizacion && (
            <>Última actualización: {ultimaActualizacion.toLocaleTimeString('es-MX')}</>
          )}
          {anuncios.length > 0 && (
            <span className="ml-2">• {anuncios.length} anuncios</span>
          )}
        </div>
      </div>
    </>
  );
};

export default AnunciosPublicosPage;
