/**
 * Hook para detectar automáticamente nueva versión desplegada
 * Revisa cada 2 minutos si hay una nueva versión y recarga la página
 */

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutos
const RELOAD_DELAY = 5000; // 5 segundos antes de recargar

export const useVersionCheck = () => {
  const currentVersionRef = useRef(null);
  const checkingRef = useRef(false);

  const checkVersion = async () => {
    // Evitar múltiples checks simultáneos
    if (checkingRef.current) return;

    try {
      checkingRef.current = true;

      // Agregar timestamp para evitar cache
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        console.log('⚠️ No se pudo verificar versión (esperado en desarrollo)');
        return;
      }

      const data = await response.json();
      const newVersion = data.version;

      // Primera carga - guardar versión actual
      if (currentVersionRef.current === null) {
        currentVersionRef.current = newVersion;
        console.log('📌 Versión actual registrada:', newVersion);
        return;
      }

      // Detectar nueva versión
      if (newVersion !== currentVersionRef.current) {
        console.log('🆕 Nueva versión detectada!');
        console.log('   Actual:', currentVersionRef.current);
        console.log('   Nueva:', newVersion);

        // Mostrar notificación al usuario
        toast.success(
          '🔄 Nueva versión disponible\nRecargando en 5 segundos...',
          {
            duration: RELOAD_DELAY,
            icon: '🚀',
            style: {
              background: '#10b981',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
            },
          }
        );

        // Recargar página después del delay
        setTimeout(() => {
          console.log('♻️ Recargando página para aplicar nueva versión...');
          window.location.reload();
        }, RELOAD_DELAY);
      }
    } catch (error) {
      // Silenciar errores en desarrollo (version.json no existe)
      if (import.meta.env.DEV) {
        console.log('ℹ️ Version check deshabilitado en desarrollo');
      } else {
        console.error('❌ Error al verificar versión:', error.message);
      }
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    // Solo habilitar en producción
    if (import.meta.env.DEV) {
      console.log('ℹ️ Auto-reload deshabilitado en desarrollo');
      return;
    }

    console.log('🔍 Sistema de auto-reload activado (check cada 2 min)');

    // Primera verificación después de 10 segundos
    const initialTimeout = setTimeout(checkVersion, 10000);

    // Verificaciones periódicas
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // Cleanup
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return null;
};

export default useVersionCheck;
