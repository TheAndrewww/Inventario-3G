import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EsqueletoArmazon } from '../../rediseno2/fundacion/armazon/EsqueletoArmazon';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <EsqueletoArmazon />;
  }

  if (!isAuthenticated) {
    // Se recuerda a dónde iba (p. ej. la liga que llega por WhatsApp) para volver ahí tras entrar
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default PrivateRoute;
