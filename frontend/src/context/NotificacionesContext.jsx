import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import notificacionesService from '../services/notificaciones.service';
import pushNotificationService from '../services/push-notifications.service';
import fcmNotificationService from '../services/fcm-notifications.service';

const NotificacionesContext = createContext();

export const useNotificaciones = () => {
  const context = useContext(NotificacionesContext);
  if (!context) {
    throw new Error('useNotificaciones debe usarse dentro de un NotificacionesProvider');
  }
  return context;
};

export const NotificacionesProvider = ({ children }) => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [countNoLeidas, setCountNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSupported, setPushSupported] = useState(false);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const [fcmToken, setFcmToken] = useState(null);
  const [fcmSupported, setFcmSupported] = useState(false);

  // Ref para evitar inicialización duplicada en StrictMode
  const initialized = useRef(false);

  // Función para obtener todas las notificaciones
  const fetchNotificaciones = useCallback(async (soloNoLeidas = false) => {
    try {
      setLoading(true);
      const response = await notificacionesService.obtenerNotificaciones(soloNoLeidas);
      if (response.success) {
        setNotificaciones(response.data.notificaciones);
      }
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para obtener el conteo de no leídas
  const fetchCount = useCallback(async () => {
    try {
      const response = await notificacionesService.contarNoLeidas();
      if (response.success) {
        const newCount = response.data.count;

        // Si hay nuevas notificaciones, mostrar notificación push
        if (newCount > lastNotificationCount && pushPermission === 'granted') {
          // Obtener las nuevas notificaciones
          const notifResponse = await notificacionesService.obtenerNotificaciones(true);
          if (notifResponse.success && notifResponse.data.notificaciones.length > 0) {
            // Mostrar solo la más reciente
            const nuevaNotif = notifResponse.data.notificaciones[0];
            pushNotificationService.showNotificationFromData(nuevaNotif);
          }
        }

        setCountNoLeidas(newCount);
        setLastNotificationCount(newCount);
      }
    } catch (error) {
      console.error('Error al contar notificaciones no leídas:', error);
    }
  }, [lastNotificationCount, pushPermission]);

  // Función para marcar como leída
  const marcarComoLeida = async (id) => {
    try {
      const response = await notificacionesService.marcarComoLeida(id);
      if (response.success) {
        // Actualizar localmente
        setNotificaciones(prev =>
          prev.map(notif =>
            notif.id === id ? { ...notif, leida: true } : notif
          )
        );
        // Actualizar conteo
        setCountNoLeidas(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
    }
  };

  // Función para marcar todas como leídas
  const marcarTodasComoLeidas = async () => {
    try {
      const response = await notificacionesService.marcarTodasComoLeidas();
      if (response.success) {
        // Actualizar localmente
        setNotificaciones(prev =>
          prev.map(notif => ({ ...notif, leida: true }))
        );
        setCountNoLeidas(0);
      }
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  // Función para eliminar una notificación
  const eliminarNotificacion = async (id) => {
    try {
      const response = await notificacionesService.eliminarNotificacion(id);
      if (response.success) {
        // Actualizar localmente
        const notifEliminada = notificaciones.find(n => n.id === id);
        setNotificaciones(prev => prev.filter(notif => notif.id !== id));

        // Si era no leída, actualizar conteo
        if (notifEliminada && !notifEliminada.leida) {
          setCountNoLeidas(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  // Inicializar notificaciones push y FCM
  useEffect(() => {
    console.log('🔧 Iniciando configuración de notificaciones FCM...');

    const supported = pushNotificationService.isNotificationSupported();
    const permission = pushNotificationService.checkPermission();
    const fcmSupportedCheck = fcmNotificationService.isNotificationSupported();

    console.log('📊 Estado de notificaciones:', {
      supported,
      permission,
      fcmSupportedCheck
    });

    setPushSupported(supported);
    setPushPermission(permission);
    setFcmSupported(fcmSupportedCheck);

    // Verificar si ya hay un token FCM guardado
    const savedToken = fcmNotificationService.getCurrentToken();
    console.log('🔑 Token guardado:', savedToken ? savedToken.substring(0, 20) + '...' : 'No');

    if (savedToken && permission === 'granted') {
      console.log('✅ Token FCM ya existe, configurando listeners...');
      setFcmToken(savedToken);

      // Configurar listeners para mensajes en foreground
      console.log('🎧 Configurando onMessageListener...');
      fcmNotificationService.onMessageListener((payload) => {
        console.log('📩 ¡MENSAJE FCM RECIBIDO EN CONTEXT!', payload);
        console.log('📦 Payload data:', payload.data);
        console.log('📦 Payload notification:', payload.notification);

        // Actualizar contador y lista
        console.log('🔄 Actualizando contador y lista de notificaciones...');
        fetchCount();
        fetchNotificaciones();
      });
      console.log('✅ onMessageListener configurado correctamente');
    } else {
      console.warn('⚠️ No se configuró listener:', {
        hasSavedToken: !!savedToken,
        permission
      });
    }

    console.log('🔔 FCM Supported:', fcmSupportedCheck);
    console.log('🔔 Token guardado:', savedToken ? 'Sí' : 'No');
  }, [fetchCount, fetchNotificaciones]);

  // Función para solicitar permiso de notificaciones push
  const requestPushPermission = useCallback(async () => {
    const permission = await pushNotificationService.requestPermission();
    setPushPermission(permission);
    return permission;
  }, []);

  // Función para habilitar/deshabilitar sonido
  const setSoundEnabled = useCallback((enabled) => {
    pushNotificationService.setSoundEnabled(enabled);
  }, []);

  // Función para activar notificaciones FCM
  const activarNotificacionesFCM = useCallback(async () => {
    try {
      const token = await fcmNotificationService.requestPermissionAndGetToken();

      if (token) {
        setFcmToken(token);
        setPushPermission('granted');

        // Escuchar mensajes en foreground
        fcmNotificationService.onMessageListener((payload) => {
          console.log('📩 Nueva notificación FCM:', payload);
          // Actualizar el contador y lista
          fetchCount();
          fetchNotificaciones();
        });

        return token;
      } else {
        setPushPermission('denied');
        return null;
      }
    } catch (error) {
      console.error('Error al activar notificaciones FCM:', error);
      return null;
    }
  }, [fetchCount, fetchNotificaciones]);

  // Cargar notificaciones y conteo al montar el componente
  useEffect(() => {
    // Evitar doble ejecución en React StrictMode
    if (initialized.current) return;
    initialized.current = true;

    fetchNotificaciones();
    fetchCount();

    // Polling: actualizar cada 30 segundos
    const interval = setInterval(() => {
      fetchCount();
      fetchNotificaciones();
    }, 30000);

    return () => {
      clearInterval(interval);
      initialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  const value = {
    notificaciones,
    countNoLeidas,
    loading,
    pushPermission,
    pushSupported,
    fcmToken,
    fcmSupported,
    fetchNotificaciones,
    fetchCount,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
    requestPushPermission,
    setSoundEnabled,
    activarNotificacionesFCM
  };

  return (
    <NotificacionesContext.Provider value={value}>
      {children}
    </NotificacionesContext.Provider>
  );
};
