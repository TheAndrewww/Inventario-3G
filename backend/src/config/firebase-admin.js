import admin from 'firebase-admin';

// Inicializar Firebase Admin con service account desde variables de entorno
let messaging = null;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT no configurado. Las notificaciones push NO funcionarán.');
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin inicializado correctamente');
    }

    messaging = admin.messaging();
    console.log('✅ Firebase Cloud Messaging listo');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin:', error.message);
  console.error('Las notificaciones push NO funcionarán.');
}

export { messaging };
export default admin;
