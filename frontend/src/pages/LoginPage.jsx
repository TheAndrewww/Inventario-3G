import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { rutaInicialPorRol } from '../components/layout/Sidebar';
import { Input, Button } from '../components/common';
import toast from 'react-hot-toast';
import { modoCuentas3g, irACuentas3g, estadoServidorCuentas3g } from '../services/cuentas3g';

// Entrar con tu cuenta 3G (E1 · PLA-24). VITE_CUENTAS3G_MODO apagado (o sin poner) = esta pantalla exactamente como
// siempre, sin ninguna petición nueva. «ambos»: el botón arriba y el acceso de siempre abajo. «solo»: solo el botón; el
// formulario vuelve únicamente si el servidor tiene la llave de emergencia (solo Dirección) o si el servidor todavía no
// está en «solo». Se ve igual con el diseño de siempre y con Diseño 3G (excepción de §3.5).
const MODO_C3G = modoCuentas3g();

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conC3g = MODO_C3G !== 'apagado';
  const [servidorC3g, setServidorC3g] = useState(null); // { modo, emergencia } · null mientras llega o sin respuesta
  const [yendoC3g, setYendoC3g] = useState(false);

  // Cuentas 3G: qué modo tiene de verdad el servidor (y si hay emergencia), y el motivo si el regreso falló.
  useEffect(() => {
    if (!conC3g) return undefined;
    let vivo = true;
    estadoServidorCuentas3g().then((e) => { if (vivo) setServidorC3g(e || { sinRespuesta: true }); });
    return () => { vivo = false; };
  }, [conC3g]);
  useEffect(() => {
    if (conC3g && location.state?.errorCuentas3g) setError(location.state.errorCuentas3g);
  }, [conC3g, location.state]);

  const modoServidor = servidorC3g?.modo;
  const emergenciaC3g = MODO_C3G === 'solo' && !!servidorC3g?.emergencia;
  const botonC3g = conC3g && modoServidor !== 'apagado';
  const conFormulario = !conC3g || MODO_C3G === 'ambos' || modoServidor === 'apagado' || modoServidor === 'ambos' || emergenciaC3g;

  const entrarConC3g = async () => {
    setYendoC3g(true);
    setError('');
    try {
      const from = location.state?.from;
      await irACuentas3g(from?.pathname ? `${from.pathname}${from.search || ''}` : null);
    } catch (e) {
      setError(e.message);
      setYendoC3g(false);
    }
  };

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from;
      const destino = from?.pathname && from.pathname !== '/login' && from.pathname !== '/'
        ? `${from.pathname}${from.search || ''}`
        : rutaInicialPorRol(user?.rol);
      navigate(destino, { replace: true });
    }
  }, [isAuthenticated, navigate, user, location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      toast.success('¡Bienvenido!');
      // El useEffect se encargará de la navegación
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      // Límite de intentos (A10): el servidor responde 429 con los minutos que faltan
      if (error?.codigo === 'DEMASIADOS_INTENTOS') {
        const minutos = Math.max(1, Number(error.minutos) || 1);
        const espera = `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
        setError(espera);
        toast.error(espera);
        return;
      }
      setError(error.message || 'Credenciales incorrectas');
      toast.error('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4 g3-fondo-lanzador">
      <div className="w-full max-w-md">
        {/* Logo y Título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png"
              alt="Logo 3G Textil"
              className="h-32 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ERP 3G Inventario</h1>
          <p className="text-gray-600">Ingresa a tu cuenta para continuar</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {conC3g && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3" role="alert">
                  <AlertCircle className="text-red-600 shrink-0" size={20} />
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
              {botonC3g && (
                <>
                  <Button type="button" variant="primary" fullWidth icon={LogIn} onClick={entrarConC3g} disabled={yendoC3g}>
                    {yendoC3g ? 'Abriendo Cuentas 3G…' : 'Entrar con tu cuenta 3G'}
                  </Button>
                  <p className="text-sm text-gray-600 text-center">Con tu cuenta de Google de 3G: una sola cuenta para todos los sistemas.</p>
                </>
              )}
              {!conFormulario && (
                <p className="text-sm text-gray-600 text-center">
                  El acceso con correo y contraseña ya no se usa en Planta. ¿No puedes entrar? Pide ayuda a Dirección.
                </p>
              )}
              {conFormulario && botonC3g && (
                <div className="flex items-center gap-3 pt-2" aria-hidden="true">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-medium text-gray-600">{emergenciaC3g ? 'Acceso de emergencia · solo Dirección' : 'o usa el acceso de siempre'}</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              {emergenciaC3g && (
                <p className="text-sm text-gray-600">Úsalo solo si Cuentas 3G no responde. Es solo para Dirección y cada entrada queda en el registro.</p>
              )}
            </div>
          )}
          {conFormulario && (
          <form onSubmit={handleSubmit} className={conC3g ? 'space-y-6 mt-4' : 'space-y-6'}>
            {!conC3g && error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="text-red-600" size={20} />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <Input
              label="Correo Electrónico"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="usuario@3gtextil.com"
              icon={Mail}
              required
            />

            <Input
              label="Contraseña"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              icon={Lock}
              required
            />

            <Button
              type="submit"
              variant={conC3g && botonC3g ? 'secondary' : 'primary'}
              fullWidth
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
          )}

          {conFormulario && (
          <div className="mt-6 text-center">
            <a href="#" className="text-sm text-red-700 hover:text-red-800 font-medium g3:!text-g3-primario">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>© 2025 3G Textil. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
