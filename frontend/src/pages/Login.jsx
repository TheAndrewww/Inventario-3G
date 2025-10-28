import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components/common';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error al escribir
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      // Redirigir al dashboard después del login exitoso
      navigate('/inventario');
    } catch (err) {
      console.error('Error en login:', err);
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Inventario 3G
          </h1>
          <p className="text-gray-600">
            Sistema de Gestión de Inventario
          </p>
        </div>

        {/* Formulario de Login */}
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Iniciar Sesión
              </h2>
              <p className="text-sm text-gray-600">
                Ingresa tus credenciales para acceder
              </p>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email */}
            <Input
              label="Email"
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              icon={<Mail className="w-5 h-5 text-gray-400" />}
            />

            {/* Password */}
            <Input
              label="Contraseña"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              icon={<Lock className="w-5 h-5 text-gray-400" />}
            />

            {/* Botón de submit */}
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          {/* Credenciales de prueba */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-2">
              Credenciales de prueba:
            </p>
            <div className="space-y-1 text-xs text-gray-600">
              <p className="text-center">
                <span className="font-medium">Admin:</span> admin@3g.com / admin123
              </p>
              <p className="text-center">
                <span className="font-medium">Empleado:</span> juan@3g.com / juan123
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-gray-600">
          © 2025 3G Arquitectura Textil
        </p>
      </div>
    </div>
  );
};

export default Login;
