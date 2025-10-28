import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/common';
import { LogOut, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Inventario = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Package className="w-8 h-8 mr-3 text-blue-600" />
                Inventario 3G
              </h1>
              <p className="text-gray-600 mt-1">
                Bienvenido, {user?.nombre} ({user?.rol})
              </p>
            </div>
            <Button
              variant="outline"
              icon={<LogOut className="w-4 h-4" />}
              onClick={handleLogout}
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Total de Artículos" padding="lg">
            <p className="text-4xl font-bold text-blue-600">0</p>
            <p className="text-sm text-gray-600 mt-2">
              Artículos en el inventario
            </p>
          </Card>

          <Card title="Stock Bajo" padding="lg">
            <p className="text-4xl font-bold text-orange-600">0</p>
            <p className="text-sm text-gray-600 mt-2">
              Artículos con stock bajo
            </p>
          </Card>

          <Card title="Movimientos Hoy" padding="lg">
            <p className="text-4xl font-bold text-green-600">0</p>
            <p className="text-sm text-gray-600 mt-2">
              Retiros registrados hoy
            </p>
          </Card>
        </div>

        {/* Información del sistema */}
        <Card title="Estado del Sistema" className="mt-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Usuario:</span> {user?.email}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Rol:</span> {user?.rol}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Puesto:</span> {user?.puesto || 'No especificado'}
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              🎉 <span className="font-medium">Frontend funcionando correctamente!</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              La autenticación está funcionando. El siguiente paso es implementar
              la gestión de artículos y movimientos.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Inventario;
