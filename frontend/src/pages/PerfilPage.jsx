import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import VistaPerfil from '../rediseno2/gestion/VistaPerfil';

const PerfilPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  return <VistaPerfil user={user} handleLogout={handleLogout} />;
};

export default PerfilPage;
