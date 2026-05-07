import api from './api';

const solicitudesCambioService = {
  crear: async (data) => {
    const response = await api.post('/solicitudes-cambio', data);
    return response.data;
  },
  listar: async (estado = null) => {
    const params = estado ? { estado } : {};
    const response = await api.get('/solicitudes-cambio', { params });
    return response.data;
  },
  contador: async () => {
    const response = await api.get('/solicitudes-cambio/contador');
    return response.data;
  },
  aprobar: async (id) => {
    const response = await api.patch(`/solicitudes-cambio/${id}/aprobar`);
    return response.data;
  },
  rechazar: async (id, motivo) => {
    const response = await api.patch(`/solicitudes-cambio/${id}/rechazar`, { motivo });
    return response.data;
  }
};

export default solicitudesCambioService;
