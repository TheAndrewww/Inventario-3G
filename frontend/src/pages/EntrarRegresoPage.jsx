import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { regresoDeCuentas3g } from '../services/cuentas3g';
import { rutaInicialPorRol } from '../components/layout/Sidebar';
import { VistaEntrando } from '../rediseno2/gestion/VistaEntrar';

// Regreso de Cuentas 3G (E1 · PLA-24), ruta pública /entrar/regreso. Solo existe con VITE_CUENTAS3G_MODO en «ambos» o
// «solo». Va fuera del AuthProvider a propósito: así ninguna petición sin sesión de las otras pantallas la saca a /login
// mientras canjea. Al entrar guarda la sesión como /auth/login (token y usuario) y recarga en su destino; si algo falla,
// regresa a Entrar con el motivo.

let enCurso = null; // StrictMode monta dos veces en desarrollo: el canje es de un solo uso.

const EntrarRegresoPage = () => {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('Entrando con tu cuenta 3G…');

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

  return <VistaEntrando texto={texto} />;
};

export default EntrarRegresoPage;
