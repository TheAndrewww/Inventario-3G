import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Zap,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle,
  Scan,
  Clock,
  Hash,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getScannerConfig,
  saveScannerConfig,
  clearScannerConfig,
  generateDeviceSignature,
  getCleanCode
} from '../services/scannerConfig.service';

const ConfiguracionLectorPage = () => {
  const [config, setConfig] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0); // 0: no iniciado, 1: esperando escaneo, 2: completado
  const [scannerName, setScannerName] = useState('');
  const [keyEvents, setKeyEvents] = useState([]);
  const keyEventsRef = useRef([]);
  const calibrationTimeoutRef = useRef(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = getScannerConfig();
    setConfig(savedConfig);
    if (savedConfig) {
      setScannerName(savedConfig.name || '');
    }
  };

  const startCalibration = () => {
    if (!scannerName.trim()) {
      toast.error('Por favor ingresa un nombre para el lector');
      return;
    }

    setIsCalibrating(true);
    setCalibrationStep(1);
    setKeyEvents([]);
    keyEventsRef.current = [];

    toast.success('Escanea un código de barras ahora...', { duration: 5000 });
  };

  useEffect(() => {
    if (!isCalibrating || calibrationStep !== 1) return;

    const handleKeyDown = (event) => {
      // Prevenir comportamiento por defecto
      event.preventDefault();
      event.stopPropagation();

      const timestamp = Date.now();
      const key = event.key;

      // Agregar evento al buffer
      const newEvent = { key, timestamp };
      keyEventsRef.current.push(newEvent);

      // Si es Enter, procesar la calibración
      if (key === 'Enter' && keyEventsRef.current.length > 2) {
        processCalibration(keyEventsRef.current);
      } else {
        // Actualizar estado para mostrar progreso
        setKeyEvents([...keyEventsRef.current]);

        // Auto-timeout si no llega Enter en 2 segundos
        if (calibrationTimeoutRef.current) {
          clearTimeout(calibrationTimeoutRef.current);
        }

        calibrationTimeoutRef.current = setTimeout(() => {
          if (keyEventsRef.current.length > 2) {
            processCalibration(keyEventsRef.current);
          } else {
            toast.error('No se detectó un escaneo completo. Intenta de nuevo.');
            cancelCalibration();
          }
        }, 2000);
      }
    };

    // Capturar eventos a nivel global con máxima prioridad
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
    };
  }, [isCalibrating, calibrationStep]);

  const processCalibration = (events) => {
    try {
      const signature = generateDeviceSignature(events);
      const cleanCode = getCleanCode(events, signature);

      const newConfig = {
        enabled: true,
        deviceSignature: signature,
        name: scannerName.trim()
      };

      const saved = saveScannerConfig(newConfig);

      if (saved) {
        setConfig(newConfig);
        setCalibrationStep(2);
        setKeyEvents(events);

        toast.success(`¡Lector "${scannerName}" configurado exitosamente!`);

        // Resetear después de 3 segundos
        setTimeout(() => {
          setIsCalibrating(false);
          setCalibrationStep(0);
          setKeyEvents([]);
          keyEventsRef.current = [];
        }, 3000);
      } else {
        throw new Error('Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error en calibración:', error);
      toast.error('Error al calibrar el lector: ' + error.message);
      cancelCalibration();
    }
  };

  const cancelCalibration = () => {
    setIsCalibrating(false);
    setCalibrationStep(0);
    setKeyEvents([]);
    keyEventsRef.current = [];

    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current);
    }
  };

  const handleDeleteConfig = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar la configuración del lector?')) {
      clearScannerConfig();
      setConfig(null);
      setScannerName('');
      toast.success('Configuración eliminada');
    }
  };

  const toggleEnabled = () => {
    if (!config) return;

    const updatedConfig = {
      ...config,
      enabled: !config.enabled
    };

    saveScannerConfig(updatedConfig);
    setConfig(updatedConfig);

    toast.success(updatedConfig.enabled ? 'Lector habilitado' : 'Lector deshabilitado');
  };

  const formatInterval = (ms) => {
    return `${ms.toFixed(1)} ms`;
  };

  const getCalibrationDate = () => {
    if (!config?.deviceSignature?.calibratedAt) return 'N/A';

    const date = new Date(config.deviceSignature.calibratedAt);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="text-blue-600" size={32} />
          Configuración del Lector de Códigos
        </h1>
        <p className="text-gray-600 mt-2">
          Configura tu lector de códigos Bluetooth para que sea detectado automáticamente
        </p>
      </div>

      {/* Estado actual */}
      {config ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-green-500">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={24} />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{config.name}</h2>
                <p className="text-sm text-gray-500">Lector configurado</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleEnabled}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  config.enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {config.enabled ? 'Habilitado' : 'Deshabilitado'}
              </button>
              <button
                onClick={handleDeleteConfig}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Detalles de la firma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="text-blue-600" size={18} />
                <span className="font-medium text-gray-700">Velocidad promedio</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatInterval(config.deviceSignature.avgKeyInterval)}
              </p>
              <p className="text-xs text-gray-500 mt-1">entre teclas</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-yellow-600" size={18} />
                <span className="font-medium text-gray-700">Rango de velocidad</span>
              </div>
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{formatInterval(config.deviceSignature.minKeyInterval)}</span>
                {' - '}
                <span className="font-semibold">{formatInterval(config.deviceSignature.maxKeyInterval)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">mínimo - máximo</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="text-purple-600" size={18} />
                <span className="font-medium text-gray-700">Longitud del código</span>
              </div>
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{config.deviceSignature.minLength}</span>
                {' - '}
                <span className="font-semibold">{config.deviceSignature.maxLength}</span>
                {' caracteres'}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="text-green-600" size={18} />
                <span className="font-medium text-gray-700">Termina con Enter</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {config.deviceSignature.hasEnterSuffix ? '✓ Sí' : '✗ No'}
              </p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Código de prueba:</strong> {config.deviceSignature.testCode}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <strong>Calibrado el:</strong> {getCalibrationDate()}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                No hay lector configurado
              </h3>
              <p className="text-sm text-yellow-800">
                Configura tu lector de códigos Bluetooth para que el sistema lo reconozca automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sección de calibración */}
      {!isCalibrating ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {config ? 'Recalibrar lector' : 'Configurar nuevo lector'}
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="scannerName" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del lector
              </label>
              <input
                type="text"
                id="scannerName"
                value={scannerName}
                onChange={(e) => setScannerName(e.target.value)}
                placeholder="Ej: Lector Bluetooth Principal"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Scan size={18} />
                Instrucciones de calibración
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Ingresa un nombre para identificar tu lector</li>
                <li>Haz clic en "Iniciar Calibración"</li>
                <li>Escanea cualquier código de barras con tu lector Bluetooth</li>
                <li>El sistema detectará automáticamente las características de tu lector</li>
              </ol>
            </div>

            <button
              onClick={startCalibration}
              disabled={!scannerName.trim()}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              Iniciar Calibración
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          {calibrationStep === 1 && (
            <div className="text-center">
              <div className="animate-pulse mb-4">
                <Scan className="mx-auto text-blue-600" size={64} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Esperando escaneo...
              </h3>
              <p className="text-gray-600 mb-4">
                Escanea un código de barras con tu lector ahora
              </p>

              {keyEvents.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Caracteres detectados: {keyEvents.length}
                  </p>
                  <p className="font-mono text-xs text-gray-700 break-all">
                    {keyEvents.map(e => e.key).join('')}
                  </p>
                </div>
              )}

              <button
                onClick={cancelCalibration}
                className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {calibrationStep === 2 && (
            <div className="text-center">
              <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                ¡Calibración exitosa!
              </h3>
              <p className="text-gray-600">
                Tu lector "{scannerName}" ha sido configurado correctamente
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfiguracionLectorPage;
