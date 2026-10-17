// Rediseño 2 · públicas · ayudas de vista para Anuncios y Calendario público. Ninguna pide nada al servidor.
//   usePantallaCompleta()  → true si el navegador está en pantalla completa (escucha «fullscreenchange»)
//   useFactorPantalla()    → cuánto crece o se encoge la TV respecto a 1920 × 1080 (0.6 a 2), para que la misma vista sirva
//                            en una TV de 1920, en una de 4K o en una laptop de 1440
import { useEffect, useState } from 'react';

export function usePantallaCompleta() {
  const [activa, setActiva] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    const avisar = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', avisar);
    return () => document.removeEventListener('fullscreenchange', avisar);
  }, []);
  return activa;
}

/** Tamaño de la TV: la medida base es 1920 × 1080; en pantallas más chicas o más grandes todo crece o se encoge igual. */
const factorDeVentana = () => {
  if (typeof window === 'undefined') return 1;
  const f = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  return Math.min(2, Math.max(0.6, f));
};

export function useFactorPantalla() {
  const [factor, setFactor] = useState(factorDeVentana);
  useEffect(() => {
    const alCambiar = () => setFactor(factorDeVentana());
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);
  return factor;
}
