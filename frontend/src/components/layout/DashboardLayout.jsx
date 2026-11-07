import { Outlet } from 'react-router-dom';
import { useCalendario } from '../../context/CalendarioContext';
import Armazon from '../../rediseno2/fundacion/armazon/Armazon';

const DashboardLayout = () => {
  const { modoPantallaCompleta } = useCalendario();

  // Si está en modo pantalla completa, solo mostrar el contenido
  if (modoPantallaCompleta) {
    return (
      <main className="h-screen overflow-auto bg-gradient-to-br from-blue-50 to-indigo-100">
        <Outlet />
      </main>
    );
  }

  return <Armazon />;
};

export default DashboardLayout;
