import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { PedidoProvider } from './context/PedidoContext';
import { NotificacionesProvider } from './context/NotificacionesContext';
import { CalendarioProvider } from './context/CalendarioContext';
import PrivateRoute from './components/auth/PrivateRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import InventarioPage from './pages/InventarioPage';
import RecepcionMercanciaPage from './pages/RecepcionMercanciaPage';
import PedidoPage from './pages/PedidoPage';
import PedidosPendientesPage from './pages/PedidosPendientesPage';
import RecibirPedidosPage from './pages/RecibirPedidosPage';
import CamionetasPage from './pages/CamionetasPage';
import UsuariosPage from './pages/UsuariosPage';
import HistorialPage from './pages/HistorialPage';
import PerfilPage from './pages/PerfilPage';
import ProveedoresPage from './pages/ProveedoresPage';
import OrdenesCompraPage from './pages/OrdenesCompraPage';
import RentaHerramientasPage from './pages/RentaHerramientasPage';
import ImpresionCodigosHerramientasPage from './pages/ImpresionCodigosHerramientasPage';
import CalendarioPage from './pages/CalendarioPage';
import CalendarioPublicoPage from './pages/CalendarioPublicoPage';
import AnunciosPublicosPage from './pages/AnunciosPublicosPage';
import ProcesamientoMasivoPage from './pages/ProcesamientoMasivoPage';
import MonitorPedidosPage from './pages/MonitorPedidosPage';
import MiEquipoPage from './pages/MiEquipoPage';
import { useVersionCheck } from './hooks/useVersionCheck';

function App() {
  // Auto-reload cuando se detecta nueva versión en producción
  useVersionCheck();
  return (
    <Router>
      <Routes>
        {/* Rutas 100% públicas - completamente fuera del AuthProvider */}
        <Route path="/anuncios" element={<AnunciosPublicosPage />} />
        <Route path="/calendario-publico" element={<CalendarioPublicoPage />} />

        {/* Resto de la aplicación con autenticación */}
        <Route path="/*" element={
          <AuthProvider>
            <NotificacionesProvider>
              <CalendarioProvider>
                <PedidoProvider>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: '#363636',
                        color: '#fff',
                      },
                      success: {
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />

                  <Routes>
                    {/* Ruta de login */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Rutas privadas */}
                    <Route
                      path="/"
                      element={
                        <PrivateRoute>
                          <DashboardLayout />
                        </PrivateRoute>
                      }
                    >
                      <Route index element={<Navigate to="/inventario" replace />} />
                      <Route path="inventario" element={<InventarioPage />} />
                      <Route path="recepcion-mercancia" element={<RecepcionMercanciaPage />} />
                      <Route path="pedido" element={<PedidoPage />} />
                      <Route path="pedidos-pendientes" element={<PedidosPendientesPage />} />
                      <Route path="recibir-pedidos" element={<RecibirPedidosPage />} />
                      <Route path="camionetas" element={<CamionetasPage />} />
                      <Route path="usuarios" element={<UsuariosPage />} />
                      <Route path="ordenes-compra" element={<OrdenesCompraPage />} />
                      <Route path="renta-herramientas" element={<RentaHerramientasPage />} />
                      <Route path="renta-herramientas/imprimir-codigos" element={<ImpresionCodigosHerramientasPage />} />
                      <Route path="historial" element={<HistorialPage />} />
                      <Route path="proveedores" element={<ProveedoresPage />} />
                      <Route path="calendario" element={<CalendarioPage />} />
                      <Route path="procesamiento-masivo" element={<ProcesamientoMasivoPage />} />
                      <Route path="monitor-pedidos" element={<MonitorPedidosPage />} />
                      <Route path="mi-equipo" element={<MiEquipoPage />} />
                      <Route path="perfil" element={<PerfilPage />} />

                      {/* Ruta 404 para rutas privadas no encontradas */}
                      <Route path="*" element={<Navigate to="/inventario" replace />} />
                    </Route>
                  </Routes>
                </PedidoProvider>
              </CalendarioProvider>
            </NotificacionesProvider>
          </AuthProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;
