import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  UserPlus,
  ClipboardList,
  Users,
  CheckCircle,
  Package,
  Truck,
  X,
  Check,
  Bell,
  XCircle,
  BellRing,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useNotificaciones } from '../../context/NotificacionesContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificacionesDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const {
    notificaciones,
    countNoLeidas,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    pushPermission,
    pushSupported,
    fcmSupported,
    fcmToken,
    activarNotificacionesFCM,
    setSoundEnabled: setGlobalSoundEnabled
  } = useNotificaciones();

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIconByTipo = (tipo) => {
    const icons = {
      solicitud_compra_creada: ShoppingCart,
      orden_compra_creada: Package,
      orden_estado_cambiado: Truck,
      solicitud_urgente: AlertTriangle,
      pedido_aprobado: CheckCircle,
      pedido_rechazado: XCircle,
      pedido_pendiente: ClipboardList,
      pedido_pendiente_aprobacion: ClipboardList,
      stock_bajo: AlertTriangle
    };
    const Icon = icons[tipo] || Bell;
    return <Icon size={20} />;
  };

  const getColorByTipo = (tipo) => {
    const colores = {
      solicitud_compra_creada: 'bg-blue-100 text-blue-600',
      orden_compra_creada: 'bg-purple-100 text-purple-600',
      orden_estado_cambiado: 'bg-indigo-100 text-indigo-600',
      solicitud_urgente: 'bg-red-100 text-red-600',
      pedido_aprobado: 'bg-green-100 text-green-600',
      pedido_rechazado: 'bg-red-100 text-red-600',
      pedido_pendiente: 'bg-yellow-100 text-yellow-700',
      pedido_pendiente_aprobacion: 'bg-cyan-100 text-cyan-700',
      stock_bajo: 'bg-orange-100 text-orange-600'
    };
    return colores[tipo] || 'bg-gray-100 text-gray-600';
  };

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    const ahora = new Date();
    const diff = ahora - fecha;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;
    return fecha.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleNotificacionClick = (notif) => {
    // Marcar como leída si no lo está
    if (!notif.leida) {
      marcarComoLeida(notif.id);
    }

    // Navegar a la URL si existe
    if (notif.url) {
      navigate(notif.url);
      setIsOpen(false);
    }
  };

  const handleMarcarLeida = (e, id) => {
    e.stopPropagation();
    marcarComoLeida(id);
  };

  const handleEliminar = (e, id) => {
    e.stopPropagation();
    eliminarNotificacion(id);
  };

  const handleRequestPushPermission = async () => {
    try {
      // Usar FCM si está soportado, sino usar el sistema legacy
      const token = fcmSupported
        ? await activarNotificacionesFCM()
        : await requestPushPermission();

      if (token || pushPermission === 'granted') {
        toast.success('¡Notificaciones push activadas! 🔔');
      } else {
        toast.error('Permiso de notificaciones denegado. Puedes habilitarlo desde la configuración de tu navegador.');
      }
    } catch (error) {
      console.error('Error al solicitar permiso:', error);
      toast.error('Error al solicitar permiso de notificaciones');
    }
  };

  const handleToggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    setGlobalSoundEnabled(newValue);
    toast.success(newValue ? '🔊 Sonido activado' : '🔇 Sonido desactivado');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg relative transition-colors"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {countNoLeidas > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs text-white font-bold">
            {countNoLeidas > 9 ? '9+' : countNoLeidas}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900">Notificaciones</h3>
            {countNoLeidas > 0 && (
              <button
                onClick={marcarTodasComoLeidas}
                className="text-sm text-red-700 hover:text-red-800 font-medium flex items-center gap-1"
              >
                <Check size={16} />
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Notificaciones Push - Solicitud de Permiso */}
          {pushSupported && pushPermission !== 'granted' && (
            <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-600 text-white rounded-lg flex-shrink-0">
                  <BellRing size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">
                    Activa las notificaciones push
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Recibe alertas en tiempo real de pedidos, órdenes y más, incluso cuando no estés en la app.
                  </p>
                  <button
                    onClick={handleRequestPushPermission}
                    className="w-full bg-red-700 hover:bg-red-800 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <BellRing size={16} />
                    Activar notificaciones
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FCM Token - Activar/Reactivar cuando hay permiso pero no hay token */}
          {pushPermission === 'granted' && fcmSupported && !fcmToken && (
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg flex-shrink-0">
                  <BellRing size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">
                    Activar notificaciones push FCM
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Haz clic para registrar tu dispositivo y recibir notificaciones push en tiempo real.
                  </p>
                  <button
                    onClick={handleRequestPushPermission}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <BellRing size={16} />
                    Activar notificaciones push
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Configuración de Sonido - Solo si las notificaciones están activadas */}
          {pushPermission === 'granted' && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {soundEnabled ? <Volume2 size={16} className="text-gray-600" /> : <VolumeX size={16} className="text-gray-400" />}
                  <span className="text-sm text-gray-700">Sonido de notificaciones</span>
                </div>
                <button
                  onClick={handleToggleSound}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    soundEnabled ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center">
                <Package size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No tienes notificaciones</p>
              </div>
            ) : (
              notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificacionClick(notif)}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notif.leida ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icono */}
                    <div className={`p-2 rounded-lg ${getColorByTipo(notif.tipo)} flex-shrink-0`}>
                      {getIconByTipo(notif.tipo)}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                          {notif.titulo}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notif.leida && (
                            <button
                              onClick={(e) => handleMarcarLeida(e, notif.id)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Marcar como leída"
                            >
                              <Check size={14} className="text-gray-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleEliminar(e, notif.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Eliminar"
                          >
                            <X size={14} className="text-gray-600" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notif.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatearFecha(notif.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <button className="w-full text-center text-sm text-red-700 hover:text-red-800 font-medium">
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacionesDropdown;
