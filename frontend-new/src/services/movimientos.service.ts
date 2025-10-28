import api from './api';
import type { Movimiento, ApiResponse } from '../types';

interface CreateMovimientoData {
  tipo: 'retiro' | 'devolucion' | 'ajuste';
  observaciones?: string;
  detalles: Array<{
    articulo_id: number;
    cantidad: number;
    observaciones?: string;
  }>;
}

const movimientosService = {
  getAll: async (): Promise<Movimiento[]> => {
    const response = await api.get<ApiResponse<Movimiento[]>>('/movimientos');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Movimiento> => {
    const response = await api.get<ApiResponse<Movimiento>>(`/movimientos/${id}`);
    return response.data.data!;
  },

  create: async (data: CreateMovimientoData): Promise<Movimiento> => {
    const response = await api.post<ApiResponse<Movimiento>>('/movimientos', data);
    return response.data.data!;
  },

  getByTicketId: async (ticketId: string): Promise<Movimiento> => {
    const response = await api.get<ApiResponse<Movimiento>>(`/movimientos/ticket/${ticketId}`);
    return response.data.data!;
  },
};

export default movimientosService;
