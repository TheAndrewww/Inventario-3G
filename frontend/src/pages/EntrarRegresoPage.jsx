import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { regresoDeCuentas3g } from '../services/cuentas3g';
import { rutaInicialPorRol } from '../components/layout/Sidebar';
// Rediseño 2 · vista encendida (apagado no la usa): el mismo canje y el mismo texto
import { useDiseno3G as useDiseno3GR2 } from '../rediseno2/fundacion/useDiseno3G';
import { VistaEntrando } from '../rediseno2/gestion/VistaEntrar';

// Regreso de Cuentas 3G (E1 · PLA-24), ruta pública /entrar/regreso. Solo existe con VITE_CUENTAS3G_MODO en «ambos» o
// «solo». Va fuera del AuthProvider a propósito: así ninguna petición sin sesión de las otras pantallas la saca a /login
// mientras canjea. Al entrar guarda la sesión como /auth/login (token y usuario) y recarga en su destino; si algo falla,
// regresa a Entrar con el motivo.

let enCurso = null; // StrictMode monta dos veces en desarrollo: el canje es de un solo uso.

const EntrarRegresoPage = () => {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('Entrando con tu cuenta 3G…');
  const d3 = useDiseno3GR2(); // Rediseño 2: vista nueva encendida (abajo, antes del return de siempre)

  useEffect(() => {
    const busqueda = window.location.search;
    if (!enCurso || enCurso.busqueda !== busqueda) enCurso = { busqueda, promesa: regresoDeCuentas3g(busqueda) };
    let vivo = true;
    enCurso.promesa.then(({ token, usuario, destino }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usuario));
      setTexto('Listo. Abriendo Planta…');
      window.location.replace(destino && destino !== '/login' && destino !== '/' ? destino : rutaInicialPorRol(usuario?.rol));
    }).catch((error) => {
      if (vivo) navigate('/login', { replace: true, state: { errorCuentas3g: error.message } });
    });
    return () => { vivo = false; };
  }, [navigate]);

  // Rediseño 2 · vista ENCENDIDA (el JSX de hoy sigue intacto debajo)
  if (d3) return <VistaEntrando texto={texto} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4 g3-fondo-lanzador">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-700 g3:border-t-g3-primario" aria-hidden="true" />
        <p className="text-gray-800 font-medium">{texto}</p>
        <p className="text-sm text-gray-600 mt-2">Cuentas 3G ya revisó tu cuenta; Planta está abriendo tu sesión.</p>
      </div>
    </div>
  );
};

export default EntrarRegresoPage;
