import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { grupoDeRuta, subPestanasGrupo, EVENTO_SUBORDEN } from './Sidebar';

// Barra de sub-pestañas arriba de las pantallas que viven dentro de un menú grande
// (p. ej. Compras). Si el rol solo ve una pantalla del grupo, no se muestra.
const SubPestanasGrupo = () => {
  const location = useLocation();
  const { user } = useAuth();
  // Se reacomoda en cuanto el usuario reordena las sub-pestañas en el menú
  const [, setVersion] = useState(0);
  useEffect(() => {
    const alCambiar = () => setVersion(v => v + 1);
    window.addEventListener(EVENTO_SUBORDEN, alCambiar);
    return () => window.removeEventListener(EVENTO_SUBORDEN, alCambiar);
  }, []);
  const grupo = grupoDeRuta(location.pathname);
  if (!grupo) return null;

  const pestanas = subPestanasGrupo(grupo, user?.rol, user?.id);
  if (pestanas.length < 2) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6">
      <nav className="flex gap-1 overflow-x-auto -mb-px">
        {pestanas.map(p => {
          const Icon = p.icon;
          const activa = location.pathname === p.path;
          return (
            <Link
              key={p.path}
              to={p.path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activa
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
            >
              <Icon size={16} />
              {p.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default SubPestanasGrupo;
