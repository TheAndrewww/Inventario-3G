import api from './api';

const configuracionService = {
  obtener: async () => {
    const response = await api.get('/configuracion');
    return response.data;
  },
  setAjusteDirecto: async (activo) => {
    const response = await api.put('/configuracion/ajuste-directo', { activo });
    return response.data;
  }
};

export default configuracionService;
