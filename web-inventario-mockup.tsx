import React, { useState } from 'react';
import { Camera, History, ShoppingCart, User, QrCode, Package, Search, Plus, Minus, Trash2, CheckCircle, LogOut, Key, Bell, Settings, Download, Mail, X, Menu, BarChart3, Users, ShoppingBag } from 'lucide-react';

export default function WebInventarioMockup() {
  const [currentView, setCurrentView] = useState('inventario');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [carrito, setCarrito] = useState([
    { id: '09843', nombre: 'Tuerca 1/4', cantidad: 12, imagen: '🔩', stock: 500, categoria: 'Ferretería', costo: 2.5 },
    { id: '23423', nombre: 'Soldadura 6013', cantidad: 80, imagen: '🔧', stock: 150, categoria: 'Soldadura', costo: 15.0 },
    { id: '34342', nombre: 'Tornillos 1/4', cantidad: 12, imagen: '🔩', stock: 800, categoria: 'Ferretería', costo: 1.8 },
    { id: '44332', nombre: 'Pintura negra', cantidad: 1, imagen: '🎨', stock: 45, categoria: 'Pintura', costo: 85.0 }
  ]);

  const historial = [
    { id: '081025-0829-01', fecha: '08/10/25', hora: '08:29', usuario: 'Nicholas Guido', piezas: 23, estado: 'Completado' },
    { id: '081025-0815-02', fecha: '08/10/25', hora: '08:15', usuario: 'Juan Pérez', piezas: 15, estado: 'Completado' },
    { id: '071025-1645-01', fecha: '07/10/25', hora: '16:45', usuario: 'María González', piezas: 42, estado: 'Completado' },
    { id: '071025-1230-03', fecha: '07/10/25', hora: '12:30', usuario: 'Carlos López', piezas: 8, estado: 'Completado' },
    { id: '061025-0920-01', fecha: '06/10/25', hora: '09:20', usuario: 'Nicholas Guido', piezas: 35, estado: 'Completado' }
  ];

  const inventarioDisponible = [
    { id: '09843', nombre: 'Tuerca 1/4', stock: 500, stockMin: 100, categoria: 'Ferretería', imagen: '🔩', costo: 2.5, ubicacion: 'A-12' },
    { id: '23423', nombre: 'Soldadura 6013', stock: 150, stockMin: 50, categoria: 'Soldadura', imagen: '🔧', costo: 15.0, ubicacion: 'B-05' },
    { id: '34342', nombre: 'Tornillos 1/4', stock: 800, stockMin: 200, categoria: 'Ferretería', imagen: '🔩', costo: 1.8, ubicacion: 'A-14' },
    { id: '44332', nombre: 'Pintura negra', stock: 45, stockMin: 20, categoria: 'Pintura', imagen: '🎨', costo: 85.0, ubicacion: 'C-03' },
    { id: '55221', nombre: 'Cable calibre 12', stock: 200, stockMin: 80, categoria: 'Eléctrico', imagen: '⚡', costo: 12.5, ubicacion: 'D-08' },
    { id: '66110', nombre: 'Cinta aislante', stock: 120, stockMin: 50, categoria: 'Eléctrico', imagen: '🔌', costo: 8.0, ubicacion: 'D-10' },
    { id: '77009', nombre: 'Lija grano 80', stock: 300, stockMin: 100, categoria: 'Herramientas', imagen: '📋', costo: 3.2, ubicacion: 'E-02' },
    { id: '88908', nombre: 'Brocha 3 pulgadas', stock: 85, stockMin: 30, categoria: 'Pintura', imagen: '🖌️', costo: 25.0, ubicacion: 'C-05' }
  ];

  const incrementar = (id) => {
    setCarrito(carrito.map(item => 
      item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item
    ));
  };

  const decrementar = (id) => {
    setCarrito(carrito.map(item => 
      item.id === id && item.cantidad > 1 ? { ...item, cantidad: item.cantidad - 1 } : item
    ));
  };

  const eliminar = (id) => {
    setCarrito(carrito.filter(item => item.id !== id));
  };

  const agregarAlCarrito = (articulo) => {
    const existe = carrito.find(item => item.id === articulo.id);
    if (existe) {
      incrementar(articulo.id);
    } else {
      setCarrito([...carrito, { ...articulo, cantidad: 1 }]);
    }
  };

  const filteredInventario = inventarioDisponible.filter(item =>
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.includes(searchTerm) ||
    item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPiezas = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCosto = carrito.reduce((sum, item) => sum + (item.cantidad * item.costo), 0);

  // Sidebar
  const Sidebar = () => (
    <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-700 rounded-lg flex items-center justify-center text-white font-bold">
              3G
            </div>
            <div>
              <h1 className="font-bold text-gray-900">ERP 3G</h1>
              <p className="text-xs text-gray-500">Inventario v1.0</p>
            </div>
          </div>
        )}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setCurrentView('inventario')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            currentView === 'inventario' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Package size={20} />
          {sidebarOpen && <span className="font-medium">Inventario</span>}
        </button>

        <button
          onClick={() => setCurrentView('pedido')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
            currentView === 'pedido' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <ShoppingCart size={20} />
          {sidebarOpen && <span className="font-medium">Pedido Actual</span>}
          {carrito.length > 0 && (
            <span className="absolute top-2 left-8 bg-red-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {carrito.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentView('historial')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            currentView === 'historial' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <History size={20} />
          {sidebarOpen && <span className="font-medium">Historial</span>}
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <BarChart3 size={20} />
          {sidebarOpen && <span className="font-medium">Reportes</span>}
        </button>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => setCurrentView('perfil')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            currentView === 'perfil' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <User size={20} />
          {sidebarOpen && (
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Nicholas Guido</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  // Header
  const Header = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentView === 'inventario' && 'Inventario'}
          {currentView === 'pedido' && 'Pedido Actual'}
          {currentView === 'historial' && 'Historial de Movimientos'}
          {currentView === 'perfil' && 'Mi Perfil'}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
        >
          <QrCode size={20} />
          <span className="font-medium">Escanear QR</span>
        </button>
        
        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
        </button>
        
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );

  // Vista de Inventario
  const InventarioView = () => (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, ID o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Package size={20} />
          Categorías
        </button>
        <button className="flex items-center gap-2 px-4 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800">
          <Plus size={20} />
          Nuevo Artículo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unit.</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInventario.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                      {item.imagen}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{item.nombre}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {item.categoria}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.ubicacion}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${item.stock <= item.stockMin ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.stock}
                    </span>
                    {item.stock <= item.stockMin && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Bajo</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${item.costo.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => agregarAlCarrito(item)}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                  >
                    <Plus size={16} />
                    Agregar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Vista de Pedido
  const PedidoView = () => (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Artículos en el Pedido</h3>
            
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg">No hay artículos en el pedido</p>
                <button 
                  onClick={() => setCurrentView('inventario')}
                  className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
                >
                  Ver Inventario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {carrito.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                      {item.imagen}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.nombre}</h4>
                      <p className="text-sm text-gray-500">ID: {item.id} • ${item.costo.toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => decrementar(item.id)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-lg font-bold w-12 text-center">{item.cantidad}</span>
                      <button 
                        onClick={() => incrementar(item.id)}
                        className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="font-bold text-gray-900">${(item.cantidad * item.costo).toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => eliminar(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Total de artículos:</span>
                <span className="font-medium">{carrito.length}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total de piezas:</span>
                <span className="font-medium">{totalPiezas}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-bold text-gray-900">Costo Total:</span>
                <span className="font-bold text-xl text-red-700">${totalCosto.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                disabled={carrito.length === 0}
                onClick={() => setCurrentView('ticket')}
                className="w-full py-3 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Finalizar Pedido
              </button>
              <button 
                disabled={carrito.length === 0}
                onClick={() => setCarrito([])}
                className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vaciar Carrito
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Información</h4>
              <p className="text-sm text-gray-600">
                Supervisor: <span className="font-medium">Andrew</span>
              </p>
              <p className="text-sm text-gray-600">
                Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-MX')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Vista de Historial
  const HistorialView = () => (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por ID, usuario..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>
        <input
          type="date"
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
        />
        <button className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
          Filtros
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Ticket</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Piezas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historial.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">
                  {item.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.fecha}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.hora}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.usuario}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{item.piezas} pzas</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {item.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button className="text-red-700 hover:text-red-900 font-medium">
                    Ver Detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Vista de Ticket
  const TicketView = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-block bg-green-100 text-green-700 p-4 rounded-full mb-4">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Pedido Completado!</h2>
          <p className="text-lg text-gray-600">Tu retiro ha sido registrado exitosamente</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">ID de Retiro</p>
              <p className="text-xl font-bold text-red-700">081025-0829-01</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha y Hora</p>
              <p className="font-medium text-gray-900">08/10/2025 - 12:07</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Responsable</p>
              <p className="font-medium text-gray-900">Nicholas Andrew Guido</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Supervisor</p>
              <p className="font-medium text-gray-900">Andrew</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Artículos Retirados</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-sm font-medium text-gray-500">Cantidad</th>
                <th className="text-left py-2 text-sm font-medium text-gray-500">Artículo</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">ID</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Costo Unit.</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {carrito.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3 font-medium text-gray-900">{item.cantidad}</td>
                  <td className="py-3 text-gray-900">{item.nombre}</td>
                  <td className="py-3 text-right text-gray-500">{item.id}</td>
                  <td className="py-3 text-right text-gray-500">${item.costo.toFixed(2)}</td>
                  <td className="py-3 text-right font-medium text-gray-900">${(item.cantidad * item.costo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td colSpan="4" className="py-3 font-bold text-gray-900">TOTAL</td>
                <td className="py-3 text-right">
                  <div className="font-bold text-gray-900">{totalPiezas} pzas</div>
                  <div className="font-bold text-xl text-red-700">${totalCosto.toFixed(2)}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800">
            <Download size={20} />
            Descargar PDF
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            <Mail size={20} />
            Enviar por Email
          </button>
          <button 
            onClick={() => {
              setCarrito([]);
              setCurrentView('pedido');
            }}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Nuevo Pedido
          </button>
        </div>
      </div>
    </div>
  );

  // Vista de Perfil
  const PerfilView = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center text-white text-4xl font-bold">
            NA
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Nicholas Andrew Guido Arroyo</h2>
            <p className="text-lg text-gray-600">Administrador</p>
            <p className="text-sm text-gray-500 mt-1">nicholas@3gtextil.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Key className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Cambiar Contraseña</p>
              <p className="text-sm text-gray-500">Actualiza tu contraseña</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-red-700 hover:bg-red-50 transition-colors">
            <Settings className="text-red-700" size={24} />
            <div className="text-left">
              <p className="font-medium text-gray-900">Configuración</p>
              <p className="text-sm text-gray-500">Preferencias de la cuenta</p>
            </div>
          </button>

          <button className="flex items-center gap-3 p-4 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="text-red-600" size={24} />
            <div className="text-left">
              <p className="font-medium text-red-600">Cerrar Sesión</p>
              <p className="text-sm text-gray-500">Salir de la cuenta</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // Modal Scanner
  const ScannerModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Escanear Código QR</h3>
          <button 
            onClick={() => setShowScanner(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative aspect-square bg-gray-900 rounded-lg flex items-center justify-center mb-6">
          <QrCode size={120} className="text-gray-600" />
          <div className="absolute inset-4 border-4 border-red-700 rounded-lg">
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white"></div>
          </div>
        </div>

        <p className="text-center text-gray-600 mb-6">
          Apunta la cámara al código QR del artículo para agregarlo automáticamente al pedido
        </p>

        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800">
            <Camera size={20} />
            Activar Cámara
          </button>
          <button 
            onClick={() => setShowScanner(false)}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto">
          {currentView === 'inventario' && <InventarioView />}
          {currentView === 'pedido' && <PedidoView />}
          {currentView === 'historial' && <HistorialView />}
          {currentView === 'ticket' && <TicketView />}
          {currentView === 'perfil' && <PerfilView />}
        </div>
      </div>

      {showScanner && <ScannerModal />}
    </div>
  );
}