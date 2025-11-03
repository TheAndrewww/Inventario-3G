import React, { useState, useEffect } from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';

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
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Imagen del código de barras */}
      <div className="relative bg-white p-4 rounded-lg border border-gray-200 min-w-[250px] min-h-[120px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        )}

        {imageError ? (
          <div className="p-8 text-center text-red-600">
            <p className="text-sm">Error al cargar el código de barras</p>
            <p className="text-xs mt-1">{codigoEAN13}</p>
          </div>
        ) : imageUrl && (
          <img
            src={imageUrl}
            alt={`Código de barras ${codigoEAN13}`}
            className={`max-w-full h-auto ${!imageLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoad={() => {
              setImageLoaded(true);
              setLoading(false);
            }}
          />
        )}
      </div>

      {/* Código EAN-13 */}
      <div className="font-mono text-sm text-gray-700 font-semibold">
        {codigoEAN13}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          title="Descargar PNG"
        >
          <Download size={16} />
          Descargar
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          title="Imprimir"
        >
          <Printer size={16} />
          Imprimir
        </button>
      </div>
    </div>
  );
};

export default BarcodeDisplay;
