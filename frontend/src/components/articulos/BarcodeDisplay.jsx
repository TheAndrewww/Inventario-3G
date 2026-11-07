import React, { useState, useEffect } from 'react';
import CodigoBarrasR2 from '../../rediseno2/inventario/CodigoBarrasR2';

const BarcodeDisplay = ({ articuloId, codigoEAN13, className = '' }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const barcodeUrl = `${API_URL}/articulos/${articuloId}/barcode`;
  const token = localStorage.getItem('token');

  // Cargar la imagen con autenticación
  useEffect(() => {
    const fetchBarcode = async () => {
      try {
        setLoading(true);
        const response = await fetch(barcodeUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Error al cargar código de barras');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setImageError(false);
      } catch (error) {
        console.error('Error al cargar código de barras:', error);
        setImageError(true);
      } finally {
        setLoading(false);
      }
    };

    if (articuloId) {
      fetchBarcode();
    }

    // Limpiar URL cuando el componente se desmonte
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [articuloId, barcodeUrl, token]);

  const handleDownload = async () => {
    try {
      const response = await fetch(barcodeUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode-${codigoEAN13}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error al descargar código de barras:', error);
    }
  };

  const handlePrint = () => {
    if (!imageUrl) {
      console.error('No hay imagen de código de barras para imprimir');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Código de Barras - ${codigoEAN13}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: Arial, sans-serif;
            }
            img {
              max-width: 100%;
              height: auto;
              margin-bottom: 10px;
            }
            .codigo {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="Código de barras" />
          <div class="codigo">${codigoEAN13}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <CodigoBarrasR2 imagen={imageUrl} cargando={loading} error={imageError} codigo={codigoEAN13}
      alCargar={() => { setImageLoaded(true); setLoading(false); }} alDescargar={handleDownload} alImprimir={handlePrint} />
  );
};

export default BarcodeDisplay;
