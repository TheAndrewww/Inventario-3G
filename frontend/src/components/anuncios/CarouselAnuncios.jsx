import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import CarruselAnunciosR2 from '../../rediseno2/publicas/CarruselAnunciosR2';

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

  return <CarruselAnunciosR2 anuncios={anuncios} actual={currentIndex} />;
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
