// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3, g3 en false son la vista apagada, que ya nunca se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import PedidosEncargadosPage from './pages/PedidosEncargadosPage';

import CamionetasPage from './pages/CamionetasPage';
import UsuariosPage from './pages/UsuariosPage';
import SolicitudesCambioPage from './pages/SolicitudesCambioPage';
import HistorialPage from './pages/HistorialPage';
import PerfilPage from './pages/PerfilPage';
import ProveedoresPage from './pages/ProveedoresPage';
import OrdenesCompraPage from './pages/OrdenesCompraPage';
import CalendarioPage from './pages/CalendarioPage';
import CalendarioPublicoPage from './tv-clasico/CalendarioPublicoPage'; // TV clásica (fondo blanco, como antes del Diseño 3G)
import AnunciosPublicosPage from './pages/AnunciosPublicosPage';
import ProcesamientoMasivoPage from './pages/ProcesamientoMasivoPage';
import MiEquipoPage from './pages/MiEquipoPage';
import DashboardProduccionPage from './pages/DashboardProduccionPage';
import TerminalAreaPage from './pages/TerminalAreaPage';
import DashboardProduccionTVPage from './tv-clasico/DashboardProduccionTVPage'; // TV clásica (fondo blanco, como antes del Diseño 3G)
import DashboardPreparadosTVPage from './tv-clasico/DashboardPreparadosTVPage'; // TV clásica (fondo blanco, como antes del Diseño 3G)
import DashboardManufacturaTVPage from './tv-clasico/DashboardManufacturaTVPage'; // TV clásica (fondo blanco, como antes del Diseño 3G)
import DashboardHerreriaTVPage from './tv-clasico/DashboardHerreriaTVPage'; // TV clásica (fondo blanco, como antes del Diseño 3G)
import ControlCampanaPage from './pages/ControlCampanaPage';
import ConteoCiclicoPage from './pages/ConteoCiclicoPage';
import DescontarAlmacenPage from './pages/DescontarAlmacenPage';
import RollosMembranasPage from './pages/RollosMembranasPage';
import AvanceProduccionPage from './pages/AvanceProduccionPage';
import RentaHerramientasPage from './pages/RentaHerramientasPage';
import ReportesPage from './pages/ReportesPage';
import StockBajoPage from './pages/StockBajoPage';
import EntradasSalidasPage from './pages/EntradasSalidasPage';
import AvisosProduccionPage from './pages/AvisosProduccionPage';
import EntrarRegresoPage from './pages/EntrarRegresoPage';
import { modoCuentas3g } from './services/cuentas3g';
import RutaDiseno3G from './diseno-3g/RutaDiseno3G';
import { useVersionCheck } from './hooks/useVersionCheck';
import { useAuth } from './context/AuthContext';
import { rolPuedeVer, rutaInicialPorRol } from './components/layout/Sidebar';
import { rolPuedeVerG3 } from './diseno-3g/menuPlanta';
import { useDiseno3G } from './diseno-3g/useDiseno3G';
import { useDiseno3G as useDiseno3GR2 } from './rediseno2/fundacion/useDiseno3G';
import { AvisosFlotantes } from './rediseno2/fundacion/armazon/AvisosFlotantes';
import VistaTabletasCalidad from './rediseno2/calidad/VistaTabletasCalidad';
import { usePanelCalidad } from './rediseno2/calidad/usePanelCalidad';

const IndexRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={rutaInicialPorRol(user?.rol)} replace />;
};

// Quien no tiene esa vista en su menú no entra aunque teclee la URL
const SoloConVista = ({ path, children }) => {
  const { user } = useAuth();
  if (!rolPuedeVer(user?.rol, path)) {
    return <Navigate to={rutaInicialPorRol(user?.rol)} replace />;
  }
  return children;
};

// Pantallas nuevas que solo existen con Diseño 3G (B1 · PLA-12): con el diseño de siempre, o sin el rol, a su inicio
const SoloConDiseno3G = ({ path, children }) => {
  const { user } = useAuth();
  const g3 = useDiseno3G();
  if (!g3 || !rolPuedeVerG3(user?.rol, path)) {
    return <Navigate to={rutaInicialPorRol(user?.rol)} replace />;
  }
  return children;
};

// 28-oct · Panel de calidad: «Tabletas de calidad» solo existe con PANEL_CALIDAD encendida y para administración
const SoloConCalidad = ({ children }) => {
  const { user } = useAuth();
  const panel = usePanelCalidad();
  if (user?.rol !== 'administrador') return <Navigate to={rutaInicialPorRol(user?.rol)} replace />;
  if (panel.cargando) return null;
  if (!panel.activo) return <Navigate to={rutaInicialPorRol(user?.rol)} replace />;
  return children;
};

// Las ligas viejas (/ordenes-compra?vista=solicitudes, p. ej. del aviso de WhatsApp)
// llevan a la sub-pestaña Solicitudes Pendientes
const OrdenesCompraRuta = () => {
  const { search } = useLocation();
  if (new URLSearchParams(search).get('vista') === 'solicitudes') {
    return <Navigate to="/solicitudes-compra" replace />;
  }
  return <OrdenesCompraPage key="ordenes" vista="ordenes" />;
};

function App() {
  // Auto-reload cuando se detecta nueva versión en producción
  useVersionCheck();
  // Rediseño 2: encendido, los avisos flotantes de siempre (react-hot-toast) abajo a la izquierda y con el diseño nuevo
  const d3 = useDiseno3GR2();
  return (
    <Router>
      <RutaDiseno3G />
      <Routes>
        {/* Rutas 100% públicas - completamente fuera del AuthProvider */}
        <Route path="/anuncios" element={<AnunciosPublicosPage />} />
        <Route path="/calendario-publico" element={<CalendarioPublicoPage />} />
        <Route path="/produccion-tv" element={<DashboardProduccionTVPage />} />
        <Route path="/preparados-tv" element={<DashboardPreparadosTVPage />} />
        <Route path="/manufactura-tv" element={<DashboardManufacturaTVPage />} />
        <Route path="/herreria-tv" element={<DashboardHerreriaTVPage />} />
        <Route path="/terminal" element={<TerminalAreaPage />} />
        <Route path="/terminal/:area" element={<TerminalAreaPage />} />
        {/* Regreso de Cuentas 3G (E1 · PLA-24): pública y fuera del AuthProvider. Solo con VITE_CUENTAS3G_MODO en «ambos»
            o «solo»; apagado, la ruta no existe (como hoy). */}
        {modoCuentas3g() !== 'apagado' && <Route path="/entrar/regreso" element={<EntrarRegresoPage />} />}

        {/* Resto de la aplicación con autenticación */}
        <Route path="/*" element={
          <AuthProvider>
            <NotificacionesProvider>
              <CalendarioProvider>
                <PedidoProvider>
                  {d3 ? <AvisosFlotantes /> : <Toaster
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
                  />}

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
                      <Route index element={<IndexRedirect />} />
                      <Route path="inventario" element={<SoloConVista path="/inventario"><InventarioPage /></SoloConVista>} />
                      <Route path="recepcion-mercancia" element={<RecepcionMercanciaPage />} />
                      <Route path="pedido" element={<PedidoPage />} />
                      <Route path="pedidos-pendientes" element={<PedidosPendientesPage />} />
                      <Route path="pedidos-encargados" element={<SoloConVista path="/pedidos-encargados"><PedidosEncargadosPage /></SoloConVista>} />

                      <Route path="camionetas" element={<CamionetasPage />} />
                      <Route path="usuarios" element={<UsuariosPage />} />
                      <Route path="solicitudes-cambio" element={<SolicitudesCambioPage />} />
                      <Route path="ordenes-compra" element={<OrdenesCompraRuta />} />
                      <Route path="solicitudes-compra" element={<OrdenesCompraPage key="solicitudes" vista="solicitudes" />} />
                      <Route path="historial" element={<HistorialPage />} />
                      <Route path="proveedores" element={<ProveedoresPage />} />
                      <Route path="calendario" element={<CalendarioPage />} />
                      <Route path="procesamiento-masivo" element={<ProcesamientoMasivoPage />} />
                      <Route path="mi-equipo" element={<MiEquipoPage />} />
                      <Route path="produccion" element={<DashboardProduccionPage />} />
                      <Route path="produccion/avisos" element={<SoloConDiseno3G path="/produccion/avisos"><AvisosProduccionPage /></SoloConDiseno3G>} />
                      <Route path="control-campana" element={<ControlCampanaPage />} />
                      <Route path="conteo-ciclico" element={<ConteoCiclicoPage />} />
                      <Route path="descontar-almacen" element={<DescontarAlmacenPage />} />
                      <Route path="rollos-membrana" element={<RollosMembranasPage />} />
                      <Route path="avance-produccion" element={<AvanceProduccionPage />} />
                      <Route path="renta-herramientas" element={<RentaHerramientasPage />} />
                      <Route path="reportes" element={<ReportesPage />} />
                      <Route path="stock-bajo" element={<StockBajoPage />} />
                      <Route path="entradas-salidas" element={<EntradasSalidasPage />} />
                      <Route path="perfil" element={<PerfilPage />} />
                      <Route path="calidad/tabletas" element={<SoloConCalidad><VistaTabletasCalidad /></SoloConCalidad>} />

                      {/* Ruta 404 para rutas privadas no encontradas */}
                      <Route path="*" element={<IndexRedirect />} />
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
