import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rutaInicialPorRol } from '../components/layout/Sidebar';
import toast from 'react-hot-toast';
import { modoCuentas3g, irACuentas3g, estadoServidorCuentas3g } from '../services/cuentas3g';
import VistaEntrar from '../rediseno2/gestion/VistaEntrar';

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
    <VistaEntrar formData={formData} handleChange={handleChange} handleSubmit={handleSubmit} loading={loading} error={error} conC3g={conC3g}
      botonC3g={botonC3g} conFormulario={conFormulario} emergenciaC3g={emergenciaC3g} yendoC3g={yendoC3g} entrarConC3g={entrarConC3g} />
  );
};

export default LoginPage;
