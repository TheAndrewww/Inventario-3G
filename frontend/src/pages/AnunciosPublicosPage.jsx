import { useEffect, useState, useCallback } from 'react';
import CarouselAnuncios from '../components/anuncios/CarouselAnuncios';
import { obtenerAnunciosHoy, incrementarVistaAnuncio, regenerarAnuncio, generarAnunciosDesdeCalendario } from '../services/anuncios.service';
import { toast, Toaster } from 'react-hot-toast';
import { Maximize2, Minimize2, RefreshCw, Settings, X, RotateCcw, Sparkles, HardDrive } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Página pública para mostrar anuncios en pantallas
 * Optimizada para pantallas completas y uso 24/7
 * Incluye botón de fullscreen para Android TV y menú de administración
 */
const AnunciosPublicosPage = () => {
  const [anuncios, setAnuncios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [regenerandoId, setRegenerandoId] = useState(null);
  const [generandoTodos, setGenerandoTodos] = useState(false);
  const [sincronizandoDrive, setSincronizandoDrive] = useState(false);

  // Verificar si el usuario está autenticado (admin)
  const token = localStorage.getItem('token');
  const isAdmin = !!token;

  // Cargar anuncios
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

  // Regenerar un anuncio individual
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

  // Sincronizar con Google Drive
  const handleSincronizarDrive = async () => {
    if (!token) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      setSincronizandoDrive(true);
      toast.loading('Sincronizando con Google Drive...', { id: 'sync-drive' });

      const response = await axios.post(
        `${API_URL}/produccion/sincronizar-drive`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success(
          `Sincronizado: ${response.data.exitosos || 0} proyectos`,
          { id: 'sync-drive' }
        );
      } else {
        toast.error(response.data.message || 'Error al sincronizar', { id: 'sync-drive' });
      }
    } catch (err) {
      console.error('Error al sincronizar con Drive:', err);
      toast.error('Error al sincronizar con Drive', { id: 'sync-drive' });
    } finally {
      setSincronizandoDrive(false);
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

    // También mostrar controles con teclado (para controles remotos de TV)
    const handleKeyDown = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 5000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleMouseMove);

    // Inicialmente ocultar después de 5 segundos
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

    // Auto-refresh cada hora para detectar nuevos anuncios
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
          {/* Botón de pantalla completa */}
          <button
            onClick={toggleFullscreen}
            className="bg-black/70 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 hover:bg-black/90 hover:border-orange-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 size={28} /> : <Maximize2 size={28} />}
          </button>

          {/* Botón de refrescar */}
          <button
            onClick={() => cargarAnuncios(true)}
            className="bg-black/70 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 hover:bg-black/90 hover:border-orange-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title="Actualizar anuncios"
          >
            <RefreshCw size={28} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Botón de administración (solo si está autenticado) */}
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
          <div className="absolute top-20 left-4 z-50 bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/20 p-4 w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Administrar Anuncios</h3>
              <button
                onClick={() => setShowAdminMenu(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Botón para generar todos */}
            <button
              onClick={handleGenerarTodos}
              disabled={generandoTodos}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {generandoTodos ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generar Todos del Día
                </>
              )}
            </button>

            {/* Botón para sincronizar con Drive */}
            <button
              onClick={handleSincronizarDrive}
              disabled={sincronizandoDrive}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {sincronizandoDrive ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <HardDrive size={18} />
                  Sincronizar con Drive
                </>
              )}
            </button>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-gray-400 text-sm mb-3">Anuncios Actuales ({anuncios.length})</h4>

              {anuncios.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay anuncios para mostrar</p>
              ) : (
                <div className="space-y-3">
                  {anuncios.map((anuncio, index) => (
                    <div
                      key={anuncio.id}
                      className="bg-black/50 rounded-lg p-3 border border-white/10"
                    >
                      <div className="flex items-start gap-3">
                        {/* Miniatura */}
                        <div className="w-16 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                          {anuncio.imagen_url && (
                            <img
                              src={anuncio.imagen_url}
                              alt={`Anuncio ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {anuncio.frase || `Anuncio ${index + 1}`}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {anuncio.proyecto_nombre || 'Sin proyecto'}
                          </p>
                        </div>
                      </div>

                      {/* Botón regenerar */}
                      <button
                        onClick={() => handleRegenerar(anuncio.id)}
                        disabled={regenerandoId === anuncio.id}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white py-1.5 px-3 rounded-lg text-sm transition-colors"
                      >
                        {regenerandoId === anuncio.id ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Regenerando...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} />
                            Regenerar Imagen
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
