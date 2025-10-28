import api from './api';
import type { Articulo, ApiResponse } from '../types';

const articulosService = {
  getAll: async (): Promise<Articulo[]> => {
    const response = await api.get<ApiResponse<Articulo[]>>('/articulos');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Articulo> => {
    const response = await api.get<ApiResponse<Articulo>>(`/articulos/${id}`);
    return response.data.data!;
  },

  getByQR: async (qrCode: string): Promise<Articulo> => {
    const response = await api.get<ApiResponse<Articulo>>(`/articulos/qr/${qrCode}`);
    return response.data.data!;
  },

  create: async (articulo: Partial<Articulo>): Promise<Articulo> => {
    const response = await api.post<ApiResponse<Articulo>>('/articulos', articulo);
    return response.data.data!;
  },

  update: async (id: number, articulo: Partial<Articulo>): Promise<Articulo> => {
    const response = await api.put<ApiResponse<Articulo>>(`/articulos/${id}`, articulo);
    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/articulos/${id}`);
  },
};

export default articulosService;
