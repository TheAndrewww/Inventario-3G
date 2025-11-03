import { useState, useEffect, useCallback } from 'react';
import pushNotificationService from '../services/push-notifications.service';

/**
 * Hook personalizado para manejar notificaciones push del navegador
 */
const usePushNotifications = () => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({});

  useEffect(() => {
    // Verificar soporte y permiso actual
    const supported = pushNotificationService.isNotificationSupported();
    const currentPermission = pushNotificationService.checkPermission();

    setIsSupported(supported);
    setPermission(currentPermission);
    setDeviceInfo(pushNotificationService.getDeviceInfo());

    // Restaurar preferencia de sonido
    pushNotificationService.isSoundEnabled();
  }, []);

  /**
   * Solicitar permiso para notificaciones
   */
  const requestPermission = useCallback(async () => {
    const result = await pushNotificationService.requestPermission();
    setPermission(result);
    return result;
  }, []);

  /**
   * Mostrar notificación
   */
  const showNotification = useCallback((options) => {
    return pushNotificationService.showNotification(options);
  }, []);

  /**
   * Mostrar notificación desde datos del backend
   */
  const showNotificationFromData = useCallback((notifData) => {
    return pushNotificationService.showNotificationFromData(notifData);
  }, []);

  /**
   * Habilitar/deshabilitar sonido
   */
  const setSoundEnabled = useCallback((enabled) => {
    pushNotificationService.setSoundEnabled(enabled);
  }, []);

  /**
   * Verificar si el sonido está habilitado
   */
  const isSoundEnabled = useCallback(() => {
    return pushNotificationService.isSoundEnabled();
  }, []);

  return {
    permission,
    isSupported,
    deviceInfo,
    requestPermission,
    showNotification,
    showNotificationFromData,
    setSoundEnabled,
    isSoundEnabled
  };
};

export default usePushNotifications;
