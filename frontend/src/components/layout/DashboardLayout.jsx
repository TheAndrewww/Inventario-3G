import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import SubPestanasGrupo from './SubPestanasGrupo';
import { Outlet } from 'react-router-dom';
import { useCalendario } from '../../context/CalendarioContext';
import { useDiseno3G } from '../../rediseno2/fundacion/useDiseno3G';
import Armazon from '../../rediseno2/fundacion/armazon/Armazon';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Cerrado por defecto en móvil
  const [isMobile, setIsMobile] = useState(false);
  const { modoPantallaCompleta } = useCalendario();
  const diseno3g = useDiseno3G();

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // En desktop, sidebar abierto por defecto; en móvil, cerrado
      if (!mobile && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Si está en modo pantalla completa, solo mostrar el contenido
  if (modoPantallaCompleta) {
    return (
      <main className="h-screen overflow-auto bg-gradient-to-br from-blue-50 to-indigo-100">
        <Outlet />
      </main>
    );
  }

  // Diseño encendido: armazón del rediseño 2 (riel por áreas, barra de 56 px, barra inferior por rol). Mismas rutas y permisos.
  if (diseno3g) {
    return <Armazon />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Overlay para móvil */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        isMobile={isMobile}
        onNavigate={closeSidebar}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} isMobile={isMobile} />
        <SubPestanasGrupo />

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
