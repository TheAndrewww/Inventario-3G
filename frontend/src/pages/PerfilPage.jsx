import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Modal } from '../components/common';
import { User, Lock, Settings, LogOut, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const PerfilPage = () => {
  const { user, logout } = useAuth();
  const [modalCambiarPassword, setModalCambiarPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    passwordActual: '',
    passwordNueva: '',
    confirmarPassword: ''
  });

  const getInitials = () => {
    if (!user?.nombre) return 'U';
    const names = user.nombre.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.nombre[0].toUpperCase();
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();

    if (passwordForm.passwordNueva !== passwordForm.confirmarPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (passwordForm.passwordNueva.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      // TODO: Implementar cambio de contraseña en el backend
      toast.success('Contraseña actualizada exitosamente');
      setModalCambiarPassword(false);
      setPasswordForm({
        passwordActual: '',
        passwordNueva: '',
        confirmarPassword: ''
      });
    } catch (error) {
      toast.error('Error al cambiar la contraseña');
    }
  };

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      logout();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Perfil Header */}
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-red-700 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {getInitials()}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{user?.nombre}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Shield size={16} className="text-gray-500" />
                  <span className="text-gray-600 capitalize">{user?.rol}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Mail size={16} className="text-gray-500" />
                  <span className="text-gray-600">{user?.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Opciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cambiar Contraseña */}
            <button
              onClick={() => setModalCambiarPassword(true)}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                  <Lock size={24} className="text-gray-600 group-hover:text-red-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Cambiar Contraseña</h3>
                  <p className="text-sm text-gray-500">Actualiza tu contraseña de acceso</p>
                </div>
              </div>
            </button>

            {/* Configuración */}
            <button
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all text-left group"
              onClick={() => toast('Próximamente', { icon: '⚙️' })}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                  <Settings size={24} className="text-gray-600 group-hover:text-red-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Configuración</h3>
                  <p className="text-sm text-gray-500">Ajusta las preferencias de tu cuenta</p>
                </div>
              </div>
            </button>

            {/* Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all text-left group border-2 border-transparent hover:border-red-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
                  <LogOut size={24} className="text-red-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-700 mb-1">Cerrar Sesión</h3>
                  <p className="text-sm text-gray-500">Salir de tu cuenta</p>
                </div>
              </div>
            </button>
          </div>

          {/* Información adicional */}
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Información de la Cuenta</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Usuario</span>
                <span className="font-medium text-gray-900">{user?.nombre}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Correo Electrónico</span>
                <span className="font-medium text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Rol</span>
                <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800 capitalize">
                  {user?.rol}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Estado</span>
                <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                  Activo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cambiar Contraseña */}
      <Modal
        isOpen={modalCambiarPassword}
        onClose={() => {
          setModalCambiarPassword(false);
          setPasswordForm({
            passwordActual: '',
            passwordNueva: '',
            confirmarPassword: ''
          });
        }}
        title="Cambiar Contraseña"
        size="md"
      >
        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña Actual
            </label>
            <input
              type="password"
              value={passwordForm.passwordActual}
              onChange={(e) => setPasswordForm({ ...passwordForm, passwordActual: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Ingresa tu contraseña actual"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={passwordForm.passwordNueva}
              onChange={(e) => setPasswordForm({ ...passwordForm, passwordNueva: e.target.value })}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              value={passwordForm.confirmarPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmarPassword: e.target.value })}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Repite la nueva contraseña"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setModalCambiarPassword(false);
                setPasswordForm({
                  passwordActual: '',
                  passwordNueva: '',
                  confirmarPassword: ''
                });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
            >
              Actualizar Contraseña
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default PerfilPage;
