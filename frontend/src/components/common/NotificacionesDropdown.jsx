import React, { useState, useRef, useEffect } from 'react';
import { useNotificaciones } from '../../context/NotificacionesContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PanelAvisos } from '../../rediseno2/fundacion/armazon/PanelAvisos';

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
    requestPushPermission, // D6 · PLA-03 (error 34): sin FCM se pide el permiso con la función del contexto
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
      // Sin FCM, requestPushPermission devuelve el permiso ('granted', 'denied', 'default' o 'unsupported'), no un token
      const activadas = fcmSupported ? (token || pushPermission === 'granted') : token === 'granted';

      if (activadas) {
        toast.success('¡Notificaciones push activadas!');
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
    toast.success((newValue ? 'Sonido activado' : 'Sonido desactivado'));
  };

  return (
    <PanelAvisos
      abierto={isOpen}
      alAlternar={() => setIsOpen(!isOpen)}
      alCerrar={() => setIsOpen(false)}
      avisos={notificaciones}
      noLeidos={countNoLeidas}
      alAbrirAviso={handleNotificacionClick}
      alMarcarLeido={handleMarcarLeida}
      alMarcarTodos={marcarTodasComoLeidas}
      alEliminar={handleEliminar}
      pedirPush={handleRequestPushPermission}
      mostrarPush={pushSupported && pushPermission !== 'granted'}
      mostrarFcm={pushPermission === 'granted' && fcmSupported && !fcmToken}
      mostrarSonido={pushPermission === 'granted'}
      sonido={soundEnabled}
      alSonido={handleToggleSound}
    />
  );
};

export default NotificacionesDropdown;
