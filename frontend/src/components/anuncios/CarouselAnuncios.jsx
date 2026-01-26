import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Componente de carousel para mostrar anuncios
 * Adaptado del proyecto tensito-ad-generator
 */
const CarouselAnuncios = ({ anuncios = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotar anuncios cada 8 segundos
  useEffect(() => {
    if (anuncios.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % anuncios.length);
    }, 16000);

    return () => clearInterval(interval);
  }, [anuncios.length]);

  // Reset index si cambian los anuncios
  useEffect(() => {
    if (currentIndex >= anuncios.length && anuncios.length > 0) {
      setCurrentIndex(0);
    }
  }, [anuncios.length, currentIndex]);

  if (anuncios.length === 0) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500 mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Esperando señal de video...</h2>
        <p className="text-gray-400">Cargando anuncios de 3G Velarias...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden group">
      {anuncios.map((anuncio, index) => {
        const isActive = index === currentIndex;

        return (
          <div
            key={anuncio.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
          >
            {/* Dynamic Background con efecto Ken Burns */}
            <div
              className={`absolute inset-0 bg-cover bg-center transition-transform duration-[16000ms] ease-linear ${isActive ? 'scale-110' : 'scale-100'
                }`}
              style={{
                backgroundImage: `url(${anuncio.imagen_url})`,
                opacity: 0.4,
                filter: 'blur(20px)'
              }}
            />

            {/* Container de imagen principal */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={anuncio.imagen_url}
                alt={anuncio.frase}
                className={`w-full h-full object-cover shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-1000 ease-out ${isActive ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'
                  }`}
              />
            </div>

            {/* Overlay de texto removido por solicitud del usuario */}
          </div>
        );
      })}

      {/* Barra de progreso para rotación */}
      {anuncios.length > 1 && (
        <div
          key={currentIndex}
          className="absolute bottom-0 left-0 h-1.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)] z-50 w-full origin-left animate-progress"
        />
      )}

      <style>{`
        @keyframes progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 16000ms linear forwards;
        }
      `}</style>
    </div>
  );
};

CarouselAnuncios.propTypes = {
  anuncios: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    frase: PropTypes.string.isRequired,
    imagen_url: PropTypes.string.isRequired,
    proyecto_nombre: PropTypes.string,
    equipo: PropTypes.string
  }))
};

export default CarouselAnuncios;
