import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PedidoProvider } from './context/PedidoContext';
import PrivateRoute from './components/auth/PrivateRoute';
import ToastProvider from './components/layout/ToastProvider';
import Login from './pages/Login';
import InventarioPage from './pages/InventarioPage';
import PedidoPage from './pages/PedidoPage';
import HistorialPage from './pages/HistorialPage';
import PerfilPage from './pages/PerfilPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PedidoProvider>
          <ToastProvider />
          <Routes>
            {/* Ruta pública - Login */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas */}
            <Route element={<PrivateRoute />}>
              <Route path="/inventario" element={<InventarioPage />} />
              <Route path="/pedido" element={<PedidoPage />} />
              <Route path="/historial" element={<HistorialPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
            </Route>

            {/* Redirigir / a /inventario */}
            <Route path="/" element={<Navigate to="/inventario" replace />} />

            {/* Ruta 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-6xl font-bold text-gray-900">404</h1>
                    <p className="text-xl text-gray-600 mt-4">Página no encontrada</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </PedidoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
