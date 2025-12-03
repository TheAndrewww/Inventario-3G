import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Printer, Package, Hash } from 'lucide-react';
import { Modal } from '../common';
import herramientasRentaService from '../../services/herramientasRenta.service';

const UnidadHerramientaDetalleModal = ({ unidad, tipoHerramienta, isOpen, onClose }) => {
  const barcodeRef = useRef(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(true);

  if (!unidad || !tipoHerramienta) return null;

  // URL del código de barras
  const barcodeUrl = herramientasRentaService.getURLCodigoBarras(unidad.id);
  const barcodeSvgUrl = herramientasRentaService.getURLCodigoBarrasSVG(unidad.id);

  // Cargar imagen QR con autenticación
  useEffect(() => {
    let isMounted = true;
    const cargarQR = async () => {
      try {
        setLoadingQr(true);
        const response = await fetch(barcodeUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Error al cargar QR');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        if (isMounted) {
          setQrImageUrl(url);
        }
      } catch (error) {
        console.error('Error al cargar código QR:', error);
      } finally {
        if (isMounted) {
          setLoadingQr(false);
        }
      }
    };

    if (isOpen && unidad?.id) {
      cargarQR();
    }

    return () => {
      isMounted = false;
      if (qrImageUrl) {
        URL.revokeObjectURL(qrImageUrl);
      }
    };
  }, [isOpen, unidad?.id, barcodeUrl]);

  // Función para descargar el código QR
  const handleDescargar = async () => {
    if (!qrImageUrl) {
      alert('El código QR aún no ha cargado. Por favor, espera un momento.');
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = qrImageUrl;
      a.download = `${unidad.codigo_unico}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error al descargar código QR:', error);
      alert('Error al descargar el código QR');
    }
  };

  // Función para imprimir el código de barras
  const handleImprimir = () => {
    if (!qrImageUrl) {
      alert('El código QR aún no ha cargado. Por favor, espera un momento.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes para imprimir');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Código QR - ${unidad.codigo_unico}</title>
          <style>
            @media print {
              @page {
                size: 4in 2in;
                margin: 0.2in;
              }
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
              min-height: 100vh;
            }
            .container {
              text-align: center;
              border: 2px solid #000;
              padding: 15px;
              background: white;
            }
            .title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            .codigo {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .barcode-container {
              margin: 10px 0;
              display: flex;
              justify-content: center;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .info {
              font-size: 10px;
              color: #666;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">${tipoHerramienta.nombre}</div>
            <div class="codigo">${unidad.codigo_unico}</div>
            <div class="barcode-container">
              <img src="${qrImageUrl}" alt="Código QR" />
            </div>
            <div class="info">ID: ${unidad.id} | Código: ${unidad.codigo_unico}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Determinar el estado visual
  const getEstadoBadge = (estado) => {
    const estados = {
      disponible: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disponible' },
      asignada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Asignada' },
      en_reparacion: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Reparación' },
      perdida: { bg: 'bg-red-100', text: 'text-red-800', label: 'Perdida' },
      baja: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Baja' }
    };
    return estados[estado] || estados.disponible;
  };

  const estadoBadge = getEstadoBadge(unidad.estado);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles de la Unidad">
      <div className="space-y-6">
        {/* Header con información básica */}
        <div className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {tipoHerramienta.nombre}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-lg font-mono font-bold text-red-600">
                  {unidad.codigo_unico}
                </span>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${estadoBadge.bg} ${estadoBadge.text}`}>
                  {estadoBadge.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Información de la unidad */}
        <div className="grid grid-cols-2 gap-4">
          {/* ID */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={18} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-600">ID</span>
            </div>
            <div className="text-xl font-bold text-gray-900">
              #{unidad.id}
            </div>
          </div>

        </div>

        {/* Información adicional si está asignada */}
        {unidad.estado === 'asignada' && (unidad.usuarioAsignado || unidad.equipoAsignado) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Asignación Actual</h3>
            {unidad.usuarioAsignado && (
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Usuario:</span> {unidad.usuarioAsignado.nombre}
              </p>
            )}
            {unidad.equipoAsignado && (
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Equipo:</span> {unidad.equipoAsignado.nombre}
              </p>
            )}
            {unidad.fecha_asignacion && (
              <p className="text-xs text-blue-600 mt-1">
                Desde: {new Date(unidad.fecha_asignacion).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>
        )}

        {/* Código QR */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">
            Código QR
          </h3>
          <div ref={barcodeRef} className="bg-white p-4 rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center" style={{ minHeight: '250px' }}>
            {loadingQr ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mb-3"></div>
                <p className="text-sm text-gray-500">Cargando código QR...</p>
              </div>
            ) : qrImageUrl ? (
              <>
                <img
                  src={qrImageUrl}
                  alt={`Código QR ${unidad.codigo_unico}`}
                  className="max-w-full h-auto"
                  style={{ maxHeight: '200px' }}
                />
                <div className="mt-2 text-center">
                  <p className="text-sm font-mono font-semibold text-gray-700">
                    {unidad.codigo_unico}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-red-600">Error al cargar código QR</p>
              </div>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleDescargar}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download size={18} />
            Descargar
          </button>
          <button
            onClick={handleImprimir}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UnidadHerramientaDetalleModal;
