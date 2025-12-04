// Importar Firebase scripts para service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (Actualizada 2025-12-04 - Nueva API Key)
const firebaseConfig = {
  apiKey: "AIzaSyDEwkQ0_xK-7QtVlQ4M8CTIG5J0ygMg7lU",
  authDomain: "inventario-3g-6bdda.firebaseapp.com",
  projectId: "inventario-3g-6bdda",
  storageBucket: "inventario-3g-6bdda.firebasestorage.app",
  messagingSenderId: "1075697015742",
  appId: "1:1075697015742:web:5d16bec9e0ef94db4e77ef",
  measurementId: "G-QBNHPSS5CR"
};

// Inicializar Firebase en el service worker
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Manejar notificaciones en background (app cerrada o en segundo plano)
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 [SW] ¡MENSAJE RECIBIDO EN BACKGROUND!');
  console.log('🔔 [SW] Payload completo:', JSON.stringify(payload, null, 2));
  console.log('🔔 [SW] payload.data:', payload.data);
  console.log('🔔 [SW] payload.notification:', payload.notification);

  // Extraer título y mensaje desde data (no desde notification)
  const notificationTitle = payload.data?.title || 'Inventario 3G';
  const notificationBody = payload.data?.body || '';

  console.log('🔔 [SW] Título:', notificationTitle);
  console.log('🔔 [SW] Mensaje:', notificationBody);

  const notificationOptions = {
    body: notificationBody,
    icon: '/Logo3G.svg',
    badge: '/Logo3G.svg',
    data: payload.data || {},
    tag: payload.data?.tipo || 'general',
    requireInteraction: payload.data?.urgente === 'true',
    vibrate: payload.data?.urgente === 'true' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Ver',
        icon: '/vite.svg'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  console.log('🔔 [SW] Mostrando notificación:', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificación clickeada:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Abrir la URL asociada o la app
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla y navegar
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            client.focus();
            if (client.navigate) {
              client.navigate(fullUrl);
            }
            return;
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Manejar mensaje para forzar activación
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Recibido SKIP_WAITING, activando...');
    self.skipWaiting();
  }
});

// Evento de instalación del service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalado');
  // Forzar que el nuevo SW reemplace al antiguo inmediatamente
  self.skipWaiting();
});

// Evento de activación del service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activado');
  // Tomar control de todas las páginas inmediatamente
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[Service Worker] Ahora controla todas las páginas');
    })
  );
});
