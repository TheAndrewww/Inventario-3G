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
import EntradaInventarioPage from './pages/EntradaInventarioPage';
import PedidoPage from './pages/PedidoPage';
import PedidosPendientesPage from './pages/PedidosPendientesPage';
import RecibirPedidosPage from './pages/RecibirPedidosPage';
import EquiposPage from './pages/EquiposPage';
import UsuariosPage from './pages/UsuariosPage';
import HistorialPage from './pages/HistorialPage';
import PerfilPage from './pages/PerfilPage';
import ProveedoresPage from './pages/ProveedoresPage';
import OrdenesCompraPage from './pages/OrdenesCompraPage';
import RentaHerramientasPage from './pages/RentaHerramientasPage';
import CalendarioPage from './pages/CalendarioPage';
import ProcesamientoMasivoPage from './pages/ProcesamientoMasivoPage';
import { useVersionCheck } from './hooks/useVersionCheck';

function App() {
  // Auto-reload cuando se detecta nueva versión en producción
  useVersionCheck();
  return (
    <Router>
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
            {/* Ruta pública */}
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
              <Route path="entrada-inventario" element={<EntradaInventarioPage />} />
              <Route path="pedido" element={<PedidoPage />} />
              <Route path="pedidos-pendientes" element={<PedidosPendientesPage />} />
              <Route path="recibir-pedidos" element={<RecibirPedidosPage />} />
              <Route path="equipos" element={<EquiposPage />} />
              <Route path="usuarios" element={<UsuariosPage />} />
              <Route path="ordenes-compra" element={<OrdenesCompraPage />} />
              <Route path="renta-herramientas" element={<RentaHerramientasPage />} />
              <Route path="historial" element={<HistorialPage />} />
              <Route path="proveedores" element={<ProveedoresPage />} />
              <Route path="calendario" element={<CalendarioPage />} />
              <Route path="procesamiento-masivo" element={<ProcesamientoMasivoPage />} />
              <Route path="perfil" element={<PerfilPage />} />
            </Route>

            {/* Ruta 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </PedidoProvider>
          </CalendarioProvider>
        </NotificacionesProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
