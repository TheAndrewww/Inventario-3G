import React, { useState, useEffect } from 'react';
import herramientasRentaService from '../../services/herramientasRenta.service';
import { avisoG3 } from '../../diseno-3g/dialogosG3';
import CajonUnidadHerramienta from '../../rediseno2/inventario/CajonUnidadHerramienta';

const UnidadHerramientaDetalleModal = ({ unidad, tipoHerramienta, isOpen, onClose }) => {
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
      avisoG3('El código QR aún no ha cargado. Por favor, espera un momento.', 'aviso');
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
      avisoG3('Error al descargar el código QR', 'mal');
    }
  };

  // Función para imprimir el código de barras
  const handleImprimir = () => {
    if (!qrImageUrl) {
      avisoG3('El código QR aún no ha cargado. Por favor, espera un momento.', 'aviso');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      avisoG3('Por favor, permite las ventanas emergentes para imprimir', 'aviso');
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
    <CajonUnidadHerramienta unidad={unidad} tipoHerramienta={tipoHerramienta} abierto={isOpen} alCerrar={onClose}
      etiquetaEstado={estadoBadge.label} qr={qrImageUrl} cargandoQr={loadingQr} alDescargar={handleDescargar} alImprimir={handleImprimir} />
  );
};

export default UnidadHerramientaDetalleModal;
