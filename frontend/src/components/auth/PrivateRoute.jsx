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
