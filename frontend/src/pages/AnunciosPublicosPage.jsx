import { useEffect, useState, useCallback } from 'react';
import CarouselAnuncios from '../components/anuncios/CarouselAnuncios';
import { obtenerAnunciosHoy, incrementarVistaAnuncio, regenerarAnuncio, generarAnunciosDesdeCalendario, leerAnunciosCalendario } from '../services/anuncios.service';
import { toast, Toaster } from 'react-hot-toast';
import { Maximize2, Minimize2, RefreshCw, Settings, X, RotateCcw, Sparkles, FileText, ImageOff } from 'lucide-react';

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
  const [generandoTodos, setGenerandoTodos] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [generandoIndividual, setGenerandoIndividual] = useState(null);

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

  // Sincronizar con calendario (leer sin generar)
  const handleSincronizarCalendario = async () => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setSincronizando(true);
      toast.loading('Leyendo anuncios del calendario...', { id: 'sync' });

      const response = await leerAnunciosCalendario(token);

      if (response.success && response.data) {
        setAnunciosCalendario(response.data.anunciosCalendario || []);
        toast.success(
          `${response.data.totalEnCalendario} anuncios encontrados (${response.data.totalGenerados} generados)`,
          { id: 'sync' }
        );
      } else {
        toast.error(response.message || 'Error al leer', { id: 'sync' });
      }
    } catch (err) {
      console.error('Error al sincronizar:', err);
      toast.error('Error al leer calendario', { id: 'sync' });
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
        await handleSincronizarCalendario();
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
  const handleGenerarIndividual = async (textoAnuncio, index) => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setGenerandoIndividual(index);
      toast.loading('Generando anuncio con IA...', { id: 'generar-ind' });

      // Generar todos del calendario (la lógica del backend solo genera los nuevos)
      const response = await generarAnunciosDesdeCalendario(token);

      if (response.success) {
        toast.success('Anuncio generado exitosamente', { id: 'generar-ind' });
        await cargarAnuncios(false);
        await handleSincronizarCalendario();
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

  // Generar todos los anuncios del día
  const handleGenerarTodos = async () => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setGenerandoTodos(true);
      toast.loading('Generando anuncios desde calendario...', { id: 'generar' });

      const response = await generarAnunciosDesdeCalendario(token);

      if (response.success) {
        toast.success(`${response.anunciosGenerados || 0} anuncios generados`, { id: 'generar' });
        await cargarAnuncios(false);
        await handleSincronizarCalendario();
      } else {
        toast.error(response.message || 'Error al generar', { id: 'generar' });
      }
    } catch (err) {
      console.error('Error al generar todos:', err);
      toast.error('Error al generar anuncios', { id: 'generar' });
    } finally {
      setGenerandoTodos(false);
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

        {/* Menú de administración - AHORA MÁS GRANDE */}
        {showAdminMenu && isAdmin && (
          <div className="absolute top-20 left-4 z-50 bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/20 p-5 w-[420px] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold text-xl">Administrar Anuncios</h3>
              <button
                onClick={() => setShowAdminMenu(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Botones de acción */}
            <div className="space-y-3 mb-5">
              {/* Sincronizar con Calendario */}
              <button
                onClick={handleSincronizarCalendario}
                disabled={sincronizando}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-3 px-4 rounded-xl transition-colors text-base font-medium"
              >
                {sincronizando ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Leyendo calendario...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Sincronizar con Calendario
                  </>
                )}
              </button>

              {/* Generar Todos */}
              <button
                onClick={handleGenerarTodos}
                disabled={generandoTodos}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white py-3 px-4 rounded-xl transition-colors text-base font-medium"
              >
                {generandoTodos ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generar Todos del Día
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-gray-300 text-base mb-4 font-medium">
                Anuncios del Calendario ({listaAnuncios.length})
              </h4>

              {listaAnuncios.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-base">No hay anuncios</p>
                  <p className="text-gray-600 text-sm mt-1">Sincroniza con el calendario para ver anuncios</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {listaAnuncios.map((anuncio, index) => (
                    <div
                      key={anuncio.id || index}
                      className={`rounded-xl p-4 border ${anuncio.generado
                          ? 'bg-black/50 border-green-500/30'
                          : 'bg-black/50 border-yellow-500/30'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Miniatura */}
                        <div className="w-20 h-20 bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {anuncio.generado && anuncio.imagen_url ? (
                            <img
                              src={anuncio.imagen_url}
                              alt={`Anuncio ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
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
                            {anuncio.generado ? (
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

                      {/* Botón de acción */}
                      <button
                        onClick={() => anuncio.generado
                          ? handleRegenerar(anuncio.id)
                          : handleGenerarIndividual(anuncio.textoAnuncio, index)
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
                    </div>
                  ))}
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
