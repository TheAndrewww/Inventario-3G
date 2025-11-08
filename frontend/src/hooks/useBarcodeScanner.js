import { useEffect, useRef, useState } from 'react';

/**
 * Hook personalizado para detectar automáticamente la pistola de códigos de barras
 *
 * Las pistolas de códigos actúan como teclados USB que escriben muy rápido.
 * Este hook detecta cuando se escribe texto rápidamente (< 100ms entre caracteres)
 * y termina con ENTER, identificando así un escaneo de código.
 *
 * @param {Function} onScan - Callback que se ejecuta cuando se detecta un código escaneado
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.enabled - Si el scanner está habilitado (default: true)
 * @param {number} options.minLength - Longitud mínima del código (default: 3)
 * @param {number} options.timeout - Tiempo máximo entre caracteres en ms (default: 100)
 */
export const useBarcodeScanner = (onScan, options = {}) => {
  const {
    enabled = true,
    minLength = 3,
    timeout = 200, // Aumentado a 200ms para capturar todos los caracteres
  } = options;

  const scanBufferRef = useRef('');
  const lastKeypressTimeRef = useRef(0);
  const timeoutIdRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      // Ignorar si el usuario está escribiendo en un input/textarea
      const target = event.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastKeypress = currentTime - lastKeypressTimeRef.current;

      // Si es ENTER, procesar el código escaneado
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        event.stopPropagation();

        const scannedCode = scanBufferRef.current.trim();

        if (scannedCode.length >= minLength) {
          setIsScanning(false);

          // Ejecutar el callback con el código escaneado
          if (onScan) {
            onScan(scannedCode);
          }
        }

        // Limpiar el buffer
        scanBufferRef.current = '';
        return;
      }

      // Ignorar teclas especiales (Shift, Control, Alt, etc.)
      if (event.key.length > 1 && event.key !== 'Enter') {
        return;
      }

      // Caracteres válidos para códigos de barras (alfanuméricos y algunos especiales)
      if (event.key.length === 1) {
        // Prevenir comportamiento por defecto para evitar pérdida de caracteres
        event.preventDefault();
        event.stopPropagation();

        // Detectar inicio de escaneo rápido
        if (timeSinceLastKeypress < timeout) {
          setIsScanning(true);
        }

        scanBufferRef.current += event.key;
        lastKeypressTimeRef.current = currentTime;

        // Auto-limpiar el buffer después de un timeout
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
        }

        timeoutIdRef.current = setTimeout(() => {
          if (scanBufferRef.current) {
            scanBufferRef.current = '';
            setIsScanning(false);
          }
        }, 1000); // 1 segundo para limpiar si no llega ENTER
      }
    };

    // Agregar listener global - usar keydown con capture para capturar antes que otros listeners
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [enabled, minLength, timeout, onScan]);

  return { isScanning };
};

export default useBarcodeScanner;
