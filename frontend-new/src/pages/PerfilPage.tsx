import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success('Sesion cerrada exitosamente');
    navigate('/login');
  };

  if (!user) return null;

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`
      : name.substring(0, 2);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center text-white text-4xl font-bold">
            {getInitials(user.nombre)}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{user.nombre}</h2>
            <p className="text-lg text-gray-600 capitalize">{user.rol}</p>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Key className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Cambiar Contrasena</p>
              <p className="text-sm text-gray-500">Actualiza tu contrasena</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Settings className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Configuracion</p>
              <p className="text-sm text-gray-500">Preferencias de la cuenta</p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-4 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="text-red-600" size={24} />
            <div className="text-left">
              <p className="font-medium text-red-600">Cerrar Sesion</p>
              <p className="text-sm text-gray-500">Salir de la cuenta</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
