import React from 'react';
import { Key, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PerfilPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  const getInitials = (nombre) => {
    if (!nombre) return 'U';
    const parts = nombre.split(' ');
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : nombre.substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-8">
        {/* Información del usuario */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center text-white text-4xl font-bold">
            {getInitials(user?.nombre)}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{user?.nombre || 'Usuario'}</h2>
            <p className="text-lg text-gray-600">{user?.rol || 'Empleado'}</p>
            <p className="text-sm text-gray-500 mt-1">{user?.email || 'email@ejemplo.com'}</p>
          </div>
        </div>

        {/* Opciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Key className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Cambiar Contraseña</p>
              <p className="text-sm text-gray-500">Actualiza tu contraseña</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Settings className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Configuración</p>
              <p className="text-sm text-gray-500">Preferencias de la cuenta</p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-4 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="text-red-600" size={24} />
            <div className="text-left">
              <p className="font-medium text-red-600">Cerrar Sesión</p>
              <p className="text-sm text-gray-500">Salir de la cuenta</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
