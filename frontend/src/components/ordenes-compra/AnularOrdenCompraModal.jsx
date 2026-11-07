import React, { useState } from 'react';
import CajonAnularOrdenR2 from '../../rediseno2/compras/CajonAnularOrden';

const AnularOrdenCompraModal = ({ isOpen, onClose, orden, onAnular }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const handleAnular = async () => {
    if (!motivo || motivo.trim().length === 0) {
      setError('Debes proporcionar un motivo para anular la orden de compra');
      return;
    }

    if (motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await onAnular(orden.id, motivo);
      setResultado(response.data);

      // Esperar 3 segundos antes de cerrar para que el usuario vea el resultado
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al anular la orden de compra');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
    setError('');
    setResultado(null);
    setLoading(false);
    onClose();
  };

  if (!orden) return null;

  if (!isOpen) return null;
  return (
    <CajonAnularOrdenR2
      onClose={handleClose}
      orden={orden}
      motivo={motivo}
      alCambiarMotivo={(valor) => {
        setMotivo(valor);
        setError('');
      }}
      error={error}
      loading={loading}
      resultado={resultado}
      handleAnular={handleAnular}
    />
  );
};

export default AnularOrdenCompraModal;
