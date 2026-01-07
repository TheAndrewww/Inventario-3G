import { useEffect, useState } from 'react';
import CarouselAnuncios from '../components/anuncios/CarouselAnuncios';
import { obtenerAnunciosHoy, incrementarVistaAnuncio } from '../services/anuncios.service';
import { toast, Toaster } from 'react-hot-toast';

/**
 * Página pública para mostrar anuncios en pantallas
 * Optimizada para pantallas completas y uso 24/7
 */
const AnunciosPublicosPage = () => {
  const [anuncios, setAnuncios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

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

  // Cargar anuncios al montar el componente
  useEffect(() => {
    cargarAnuncios(false);

    // Auto-refresh cada 5 minutos
    const interval = setInterval(() => {
      cargarAnuncios(false);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activar pantalla completa automáticamente
  useEffect(() => {
    const requestFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('No se pudo activar pantalla completa:', err);
        });
      }
    };

    // Intentar activar pantalla completa después de 1 segundo
    const timer = setTimeout(requestFullscreen, 1000);

    return () => clearTimeout(timer);
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
        <div className="absolute top-4 right-4 z-50 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          LIVE DISPLAY
        </div>

        {/* Carousel de anuncios */}
        <CarouselAnuncios anuncios={anuncios} />

        {/* Indicador de última actualización (oculto en producción) */}
        {import.meta.env.DEV && ultimaActualizacion && (
          <div className="absolute bottom-4 left-4 z-50 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg">
            Última actualización: {ultimaActualizacion.toLocaleTimeString('es-MX')}
          </div>
        )}
      </div>
    </>
  );
};

export default AnunciosPublicosPage;
