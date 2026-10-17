// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../common';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import { EsqueletoArmazon } from '../../rediseno2/fundacion/armazon/EsqueletoArmazon';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const d3 = useDiseno3G(); // Rediseño 2: encendido, esqueleto del armazón en lugar de la rueda

  if (loading) {
    // VIEJO: se borra a partir del 24-oct-2026 — d3 siempre es true; lo que corre con d3 en false (después de este if o en su else) es lo viejo.
    if (d3) return <EsqueletoArmazon />;
    return <Loader fullScreen />;
  }

  if (!isAuthenticated) {
    // Se recuerda a dónde iba (p. ej. la liga que llega por WhatsApp) para volver ahí tras entrar
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default PrivateRoute;
