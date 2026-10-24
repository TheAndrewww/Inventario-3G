import api from './api';

// Pedidos de los encargados a Almacén (23-oct-2026)
const pedidosEncargadosService = {
  listar: async (estado = null) => {
    const response = await api.get('/pedidos-encargados', { params: estado ? { estado } : {} });
    return response.data;
  },
  contador: async () => {
    const response = await api.get('/pedidos-encargados/contador');
    return response.data;
  },
  responder: async (id, estado, nota) => {
    const response = await api.patch(`/pedidos-encargados/${id}`, { estado, nota });
    return response.data;
  }
};

export default pedidosEncargadosService;
