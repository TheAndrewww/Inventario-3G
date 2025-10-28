// User Types
export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'administrador' | 'bodeguero';
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

// Artículo Types
export interface Categoria {
  id: number;
  nombre: string;
}

export interface Ubicacion {
  id: number;
  codigo: string;
  nombre?: string;
}

export interface Articulo {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria_id: number;
  ubicacion_id: number;
  stock_actual: number;
  stock_minimo: number;
  unidad: string;
  costo_unitario: number;
  categoria?: Categoria;
  ubicacion?: Ubicacion;
  created_at?: string;
}

// Movimiento Types
export interface DetalleMovimiento {
  id?: number;
  movimiento_id?: number;
  articulo_id: number;
  cantidad: number;
  observaciones?: string;
  articulo?: Articulo;
}

export interface Movimiento {
  id: number;
  ticket_id: string;
  tipo: 'retiro' | 'devolucion' | 'ajuste';
  usuario_id: number;
  observaciones?: string;
  created_at: string;
  usuario?: User;
  detalles?: DetalleMovimiento[];
}

// Carrito Types
export interface ItemCarrito {
  articulo_id: number;
  articulo: Articulo;
  cantidad: number;
  observaciones?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}
