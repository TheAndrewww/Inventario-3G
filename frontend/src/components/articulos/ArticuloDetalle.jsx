import { Package, MapPin, Tag, DollarSign, Box, AlertCircle, QrCode, Download } from 'lucide-react';
import { Button } from '../common';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';

const ArticuloDetalle = ({ articulo, onClose, onEdit }) => {
  const qrRef = useRef(null);

  if (!articulo) return null;

  const getStockStatus = () => {
    if (articulo.stock_actual <= articulo.stock_minimo) {
      return {
        text: 'Stock Bajo',
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: <AlertCircle className="w-4 h-4" />,
      };
    }
    return {
      text: 'Stock Normal',
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: <Package className="w-4 h-4" />,
    };
  };

  const status = getStockStatus();

  const handleDownloadQR = () => {
    try {
      // Obtener el SVG del QR
      const svg = qrRef.current?.querySelector('svg');
      if (!svg) return;

      // Crear un canvas para convertir el SVG a imagen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Descargar como PNG
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `QR-${articulo.nombre.replace(/\s+/g, '-')}-${articulo.id}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      console.error('Error al descargar QR:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con estado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{articulo.nombre}</h2>
          <p className="text-gray-600 mt-1">ID: {articulo.id}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${status.color}`}>
          {status.icon}
          <span className="ml-2">{status.text}</span>
        </span>
      </div>

      {/* Descripción */}
      {articulo.descripcion && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Descripción</h3>
          <p className="text-gray-600">{articulo.descripcion}</p>
        </div>
      )}

      {/* Grid de información */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información básica */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Información General
          </h3>

          <div className="space-y-3">
            <div className="flex items-center">
              <Tag className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-xs text-gray-500">Categoría</p>
                <p className="text-sm font-medium text-gray-900">
                  {articulo.categoria?.nombre || 'No especificada'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <MapPin className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-xs text-gray-500">Ubicación</p>
                <p className="text-sm font-medium text-gray-900">
                  {articulo.ubicacion?.codigo} - {articulo.ubicacion?.almacen}
                </p>
                <p className="text-xs text-gray-500">
                  {articulo.ubicacion?.descripcion}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <Box className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-xs text-gray-500">Unidad de Medida</p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {articulo.unidad}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Información de stock */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Stock y Costos
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-xs text-blue-600">Stock Actual</p>
                <p className="text-2xl font-bold text-blue-900">
                  {parseFloat(articulo.stock_actual).toFixed(2)}
                </p>
                <p className="text-xs text-blue-600">{articulo.unidad}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600">Stock Mínimo</p>
                <p className="text-lg font-semibold text-gray-900">
                  {parseFloat(articulo.stock_minimo).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="text-xs text-green-600">Costo Unitario</p>
                <p className="text-lg font-semibold text-green-900">
                  ${parseFloat(articulo.costo_unitario).toFixed(2)} MXN
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div>
                <p className="text-xs text-purple-600">Valor Total en Stock</p>
                <p className="text-lg font-semibold text-purple-900">
                  ${(parseFloat(articulo.stock_actual) * parseFloat(articulo.costo_unitario)).toFixed(2)} MXN
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Código QR */}
      {articulo.codigo_qr && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Código QR
          </h3>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div
                ref={qrRef}
                className="w-48 h-48 border-2 border-gray-200 rounded-lg p-2 flex items-center justify-center bg-white"
              >
                {articulo.codigo_qr ? (
                  <QRCodeSVG
                    value={articulo.codigo_qr}
                    size={176}
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <QrCode className="w-24 h-24 text-gray-400" />
                )}
              </div>

              {articulo.codigo_qr && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadQR}
                  className="mt-3"
                >
                  Descargar QR
                </Button>
              )}
            </div>

            {/* Información del QR */}
            <div className="flex-1 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Información del QR</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  Este código QR identifica de manera única este artículo en el sistema.
                </p>
                <div className="bg-white rounded p-2 font-mono text-xs break-all">
                  {articulo.codigo_qr}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Escanea este código con la app móvil para acceder rápidamente a la información del artículo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadatos */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <p className="font-medium text-gray-700">Creado:</p>
            <p>{new Date(articulo.created_at).toLocaleString('es-MX')}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Última actualización:</p>
            <p>{new Date(articulo.updated_at).toLocaleString('es-MX')}</p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        {onEdit && (
          <Button onClick={() => onEdit(articulo)}>
            Editar Artículo
          </Button>
        )}
      </div>
    </div>
  );
};

export default ArticuloDetalle;
