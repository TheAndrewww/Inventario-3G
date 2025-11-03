/**
 * Servicio de Notificaciones Push del Navegador
 *
 * Este servicio maneja las notificaciones del sistema usando la API de Notifications del navegador.
 * Funciona en:
 * - Desktop: Chrome, Firefox, Safari, Edge
 * - Mobile: Chrome Android, Safari iOS (con limitaciones)
 */

class PushNotificationService {
  constructor() {
    this.permission = 'default';
    this.isSupported = 'Notification' in window;
    this.soundEnabled = true;
    this.notificationSound = null;
  }

  /**
   * Verificar si las notificaciones están soportadas
   */
  isNotificationSupported() {
    return this.isSupported;
  }

  /**
   * Verificar el estado actual del permiso
   */
  checkPermission() {
    if (!this.isSupported) {
      return 'unsupported';
    }
    this.permission = Notification.permission;
    return this.permission;
  }

  /**
   * Solicitar permiso para mostrar notificaciones
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Las notificaciones no están soportadas en este navegador');
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === 'granted') {
        console.log('✅ Permiso de notificaciones concedido');
        // Mostrar notificación de bienvenida
        this.showNotification({
          title: '🎉 Notificaciones activadas',
          body: 'Recibirás notificaciones de tus pedidos, órdenes y más.',
          icon: '/icon-192.png',
          tag: 'welcome'
        });
      } else if (permission === 'denied') {
        console.warn('❌ Permiso de notificaciones denegado');
      }

      return permission;
    } catch (error) {
      console.error('Error al solicitar permiso de notificaciones:', error);
      return 'error';
    }
  }

  /**
   * Mostrar una notificación del sistema
   */
  showNotification(options = {}) {
    if (!this.isSupported) {
      console.warn('Notificaciones no soportadas');
      return null;
    }

    if (this.permission !== 'granted') {
      console.warn('No hay permiso para mostrar notificaciones');
      return null;
    }

    const {
      title = 'Inventario 3G',
      body = '',
      icon = '/icon-192.png',
      badge = '/badge-72.png',
      tag = Date.now().toString(),
      data = {},
      requireInteraction = false,
      silent = false,
      vibrate = [200, 100, 200],
      actions = []
    } = options;

    try {
      const notification = new Notification(title, {
        body,
        icon,
        badge,
        tag,
        data,
        requireInteraction,
        silent: silent || !this.soundEnabled,
        vibrate,
        // Opciones adicionales para Android
        image: options.image,
        actions,
        dir: 'ltr',
        lang: 'es-MX',
        renotify: false
      });

      // Eventos de la notificación
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();

        // Navegar a la URL si se proporciona
        if (data.url) {
          window.location.href = data.url;
        }

        notification.close();
      };

      notification.onerror = (error) => {
        console.error('Error en la notificación:', error);
      };

      notification.onclose = () => {
        console.log('Notificación cerrada');
      };

      // Reproducir sonido si está habilitado
      if (this.soundEnabled && !silent) {
        this.playNotificationSound();
      }

      // Auto-cerrar después de 10 segundos si no requiere interacción
      if (!requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      return notification;
    } catch (error) {
      console.error('Error al mostrar notificación:', error);
      return null;
    }
  }

  /**
   * Mostrar notificación desde los datos del backend
   */
  showNotificationFromData(notifData) {
    const iconMap = {
      'pedido_aprobado': '✅',
      'pedido_rechazado': '⚠️',
      'pedido_pendiente': '📋',
      'pedido_pendiente_aprobacion': '📋',
      'orden_compra_creada': '🛒',
      'solicitud_compra_creada': '📝',
      'stock_bajo': '📉',
      'solicitud_urgente': '🚨'
    };

    const icon = iconMap[notifData.tipo] || '🔔';

    return this.showNotification({
      title: `${icon} ${notifData.titulo}`,
      body: notifData.mensaje,
      icon: '/icon-192.png',
      tag: `notif-${notifData.id}`,
      data: {
        id: notifData.id,
        tipo: notifData.tipo,
        url: notifData.url,
        ...notifData.datos_adicionales
      },
      requireInteraction: notifData.tipo === 'solicitud_urgente',
      vibrate: notifData.tipo === 'solicitud_urgente' ? [300, 100, 300, 100, 300] : [200, 100, 200]
    });
  }

  /**
   * Reproducir sonido de notificación
   */
  playNotificationSound() {
    if (!this.notificationSound) {
      this.notificationSound = new Audio('/notification-sound.mp3');
      this.notificationSound.volume = 0.5;
    }

    try {
      this.notificationSound.currentTime = 0;
      this.notificationSound.play().catch(error => {
        console.warn('No se pudo reproducir el sonido:', error);
      });
    } catch (error) {
      console.warn('Error al reproducir sonido:', error);
    }
  }

  /**
   * Habilitar/deshabilitar sonido
   */
  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
    localStorage.setItem('notification_sound_enabled', enabled.toString());
  }

  /**
   * Obtener estado del sonido
   */
  isSoundEnabled() {
    const stored = localStorage.getItem('notification_sound_enabled');
    if (stored !== null) {
      this.soundEnabled = stored === 'true';
    }
    return this.soundEnabled;
  }

  /**
   * Limpiar todas las notificaciones visibles
   */
  clearAllNotifications() {
    // No hay API estándar para esto, las notificaciones se auto-limpian
    console.log('Las notificaciones se limpiarán automáticamente');
  }

  /**
   * Obtener información del dispositivo
   */
  getDeviceInfo() {
    return {
      isSupported: this.isSupported,
      permission: this.permission,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
      isAndroid: /Android/i.test(navigator.userAgent),
      isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    };
  }
}

// Crear instancia única
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
