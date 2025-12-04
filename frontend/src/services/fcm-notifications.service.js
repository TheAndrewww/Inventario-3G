import { messaging, getToken, onMessage } from '../config/firebase';
import api from './api';

class FCMNotificationService {
  constructor() {
    this.token = null;
    this.isSupported = messaging !== null;
    // Cargar token desde localStorage si existe
    this.loadTokenFromStorage();
  }

  /**
   * Cargar token desde localStorage
   */
  loadTokenFromStorage() {
    try {
      const savedToken = localStorage.getItem('fcm_token');
      if (savedToken) {
        this.token = savedToken;
        console.log('✅ Token FCM cargado desde localStorage');
      }
    } catch (error) {
      console.error('Error al cargar token desde localStorage:', error);
    }
  }

  /**
   * Guardar token en localStorage
   */
  saveTokenToStorage(token) {
    try {
      localStorage.setItem('fcm_token', token);
      localStorage.setItem('fcm_token_date', new Date().toISOString());
      console.log('✅ Token FCM guardado en localStorage');
    } catch (error) {
      console.error('Error al guardar token en localStorage:', error);
    }
  }

  /**
   * Obtener token actual (desde memoria o localStorage)
   */
  getCurrentToken() {
    return this.token;
  }

  /**
   * Verificar si FCM está soportado
   */
  isNotificationSupported() {
    return this.isSupported && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Solicitar permiso y obtener token FCM
   */
  async requestPermissionAndGetToken() {
    if (!this.isNotificationSupported()) {
      console.warn('❌ FCM no soportado en este navegador');
      return null;
    }

    try {
      // Solicitar permiso de notificaciones
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('❌ Permiso de notificaciones denegado');
        return null;
      }

      console.log('✅ Permiso de notificaciones concedido');

      // Registrar service worker
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { scope: '/', updateViaCache: 'none' }
      );
      console.log('✅ Service Worker registrado:', registration);

      // Si hay un SW esperando, forzar su activación
      if (registration.waiting) {
        console.log('⚠️ Hay un SW esperando, forzando activación...');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Esperar a que esté activo y controlando la página
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker listo');

      // Forzar que el SW tome control de la página
      if (!navigator.serviceWorker.controller) {
        console.log('⚠️ SW no está controlando la página, reclamando...');
        // Esperar a que el SW tome control
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('✅ SW ahora controla la página');
            resolve();
          }, { once: true });

          // Si no cambia en 2 segundos, continuar de todos modos
          setTimeout(resolve, 2000);
        });
      } else {
        console.log('✅ SW ya está controlando la página');
      }

      // Obtener token FCM
      const currentToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        console.log('✅ Token FCM obtenido:', currentToken.substring(0, 20) + '...');
        this.token = currentToken;

        // Guardar en localStorage para persistencia
        this.saveTokenToStorage(currentToken);

        // Enviar token al backend
        await this.sendTokenToBackend(currentToken);

        return currentToken;
      } else {
        console.log('❌ No se pudo obtener el token FCM');
        return null;
      }
    } catch (error) {
      console.error('❌ Error al obtener token FCM:', error);
      return null;
    }
  }

  /**
   * Enviar token al backend para guardarlo
   */
  async sendTokenToBackend(token) {
    try {
      await api.post('/notificaciones/register-device', {
        fcm_token: token,
        device_type: this.getDeviceType(),
        browser: this.getBrowserInfo()
      });
      console.log('✅ Token FCM enviado al backend');
    } catch (error) {
      console.error('❌ Error al enviar token al backend:', error);
    }
  }

  /**
   * Eliminar token del backend (logout o desactivar notificaciones)
   */
  async removeTokenFromBackend() {
    if (!this.token) return;

    try {
      await api.post('/notificaciones/unregister-device', {
        fcm_token: this.token
      });
      console.log('✅ Token FCM eliminado del backend');
      this.token = null;
    } catch (error) {
      console.error('❌ Error al eliminar token del backend:', error);
    }
  }

  /**
   * Escuchar mensajes cuando la app está en foreground (abierta)
   */
  onMessageListener(callback) {
    if (!this.isSupported) {
      console.warn('⚠️ FCM no soportado, no se puede escuchar mensajes');
      return;
    }

    console.log('🎧 Configurando listener de mensajes FCM...');

    onMessage(messaging, (payload) => {
      console.log('📩 Mensaje FCM recibido (app abierta):', payload);
      console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));

      // Callback personalizado para actualizar UI (badge, lista de notificaciones)
      if (callback) {
        console.log('✅ Ejecutando callback...');
        callback(payload);
      }

      // Mostrar notificación SOLO cuando la app está abierta
      // El Service Worker maneja las notificaciones cuando la app está cerrada
      // Ahora el título y mensaje vienen en payload.data
      const title = payload.data?.title;
      const body = payload.data?.body;

      console.log('📝 Datos extraídos:', { title, body });
      console.log('🔔 Notification API disponible:', 'Notification' in window);
      console.log('🔓 Permiso de notificaciones:', Notification.permission);

      if (title && 'Notification' in window && Notification.permission === 'granted') {
        console.log('✅ Mostrando notificación...');
        const notification = new Notification(title, {
          body: body || '',
          icon: '/Logo3G.svg',
          data: payload.data,
          tag: payload.data?.tipo || 'general',
          requireInteraction: false
        });

        // Manejar clic en la notificación
        notification.onclick = () => {
          console.log('🖱️ Notificación clickeada');
          window.focus();
          if (payload.data?.url) {
            window.location.href = payload.data.url;
          }
          notification.close();
        };
      } else {
        console.error('❌ No se puede mostrar notificación:', {
          hasTitle: !!title,
          notificationAPIAvailable: 'Notification' in window,
          permission: Notification.permission
        });
      }
    });

    console.log('✅ Listener de mensajes FCM configurado');
  }

  /**
   * Obtener tipo de dispositivo
   */
  getDeviceType() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  }

  /**
   * Obtener información del navegador
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'unknown';

    if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'chrome';
    else if (ua.includes('Firefox')) browser = 'firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
    else if (ua.includes('Edge')) browser = 'edge';

    return browser;
  }

  /**
   * Verificar si es dispositivo móvil
   */
  isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }
}

const fcmNotificationService = new FCMNotificationService();
export default fcmNotificationService;
