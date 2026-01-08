import { useEffect, useState, useCallback } from 'react';
import CarouselAnuncios from '../components/anuncios/CarouselAnuncios';
import { obtenerAnunciosHoy, incrementarVistaAnuncio } from '../services/anuncios.service';
import { toast, Toaster } from 'react-hot-toast';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

/**
 * Página pública para mostrar anuncios en pantallas
 * Optimizada para pantallas completas y uso 24/7
 * Incluye botón de fullscreen para Android TV
 */
const AnunciosPublicosPage = () => {
  const [anuncios, setAnuncios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

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
        </div>

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

