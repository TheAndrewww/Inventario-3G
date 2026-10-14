// Tipos de cuentas3g-cliente 1.1.0 (CTA-08; personas() desde 1.1.0, CTA-09). Se copia SIN CAMBIOS junto a cuentas3g-cliente.cjs.

export declare const VERSION: string;
export declare const MODOS: readonly ['apagado', 'ambos', 'solo'];
export type Modo = 'apagado' | 'ambos' | 'solo';

export declare class ErrorCuentas3G extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje?: string);
}

export interface ConfigCuentas3G {
  /** El modo que vale de verdad: con configuración incompleta queda en «apagado». */
  modo: Modo;
  /** Lo que se pidió en CUENTAS3G_MODO. */
  pedido: string;
  /** CUENTAS3G_EMERGENCIA encendida (solo cuenta en «solo»). */
  emergencia: boolean;
  completa: boolean;
  faltan: string[];
  malas: string[];
  /** Texto para el registro del sistema (nunca lleva valores). */
  aviso: string | null;
  cliente: { emisor: string; clienteId: string; clienteSecreto: string; regreso: string } | null;
}

export declare function leerConfig(
  env: Record<string, string | undefined>,
  opciones?: { prefijo?: string; necesita?: Array<'EMISOR' | 'CLIENTE_ID' | 'CLIENTE_SECRETO' | 'REGRESO'> },
): ConfigCuentas3G;

export interface Almacen {
  leer(): Promise<string | null>;
  guardar(texto: string): Promise<void>;
}
export declare function almacenEnDisco(ruta: string): Almacen;
export declare function almacenEnMemoria(): Almacen;

export declare function sellar(datos: unknown, secreto: string, segundos?: number, ahoraMs?: number): Promise<string>;
export declare function abrir<T = unknown>(valor: string | undefined, secreto: string, ahoraMs?: number): Promise<T | null>;
export declare function destinoInterno(valor: unknown): string;

export interface Temporal {
  state?: string;
  nonce: string;
  verificador: string;
  despues?: string;
  en?: number;
}

export interface PersonaDeCuentas3G {
  /** El id de la persona en Cuentas 3G («p_…»); nunca cambia. */
  sub: string;
  /** Su versión: guárdala en la sesión y pásala a sesionVigente(). */
  ver: number;
  /** Su nivel en ESTE sistema (null solo en Planta, fase 1). */
  nivel: string | null;
  codigos: string[];
  roles: string[];
  nombre: string;
  correo: string | null;
  /** El «correo en Planta» (solo para Planta). */
  correoEnSistema: string | null;
  authTime: number | null;
  /** A dónde volver (ruta interna). */
  despues: string;
  /** Cuándo se creó (ms): guárdalo en la sesión como `en`. */
  en: number;
}

export interface SesionDeCuentas3G {
  sub: string;
  ver: number;
  /** Cuándo creó el sistema esta sesión (ms). */
  en: number;
}

export interface EstadoCliente {
  version: string;
  lista: { origen: 'cuentas' | 'guardada'; en: string; personas: number } | null;
  /** Sin lista o sin actualizar en 24 h: el sistema sigue y avisa a Dirección. */
  listaVieja: boolean;
  ultimoError: string | null;
  avisos: number;
  catalogo: { origen: 'cuentas' | 'guardada'; en: string; personas: number } | null;
  ultimoErrorCatalogo: string | null;
}

/** Lo que reciben Finanzas y Operación del catálogo (CTA-09). */
export interface PersonaDelCatalogo {
  sub: string;
  nombre: string;
  /** Sus roles (dir, oficina, asesor, supervisor, conta, almacen, compras, diseno). */
  papeles: string[];
  /** Nulo si no tiene o si está dada de baja. */
  telefono: string | null;
  activo: boolean;
  codigos: { codigo: string; tipo: 'asesor' | 'canal' | 'direccion' | 'comisionista' | 'supervisor'; desde: string; hasta: string | null }[];
}

/** Lo que recibe Planta del catálogo (CTA-09). */
export interface PersonaParaPlanta {
  sub: string;
  correoEnPlanta: string;
}

export interface Catalogo<P = PersonaDelCatalogo | PersonaParaPlanta> {
  personas: P[];
  /** Cuándo se obtuvo (ms). */
  en: number;
  origen: 'cuentas' | 'guardada';
}

export interface Cliente {
  iniciar(op?: { despues?: string; pedirGoogle?: boolean }): Promise<{ url: string; temporal: Temporal }>;
  regreso(x: { url?: string; codigo?: string; state?: string; temporal: Temporal }): Promise<PersonaDeCuentas3G>;
  listaDeVersiones(op?: { forzar?: boolean }): Promise<unknown>;
  sesionVigente(s: SesionDeCuentas3G): boolean;
  motivoDeCorte(s: SesionDeCuentas3G): null | 'sesion_invalida' | 'aviso_de_baja' | 'no_esta_en_la_lista' | 'baja' | 'version';
  avisoDeBaja(logoutToken: string): Promise<{ sub: string }>;
  /** El catálogo (Finanzas, Operación y Planta); null = sin Cuentas 3G y sin copia: usar la configuración de hoy. */
  personas<P = PersonaDelCatalogo | PersonaParaPlanta>(op?: { forzar?: boolean }): Promise<Catalogo<P> | null>;
  arrancar(op?: { sinReloj?: boolean }): Promise<() => void>;
  detener(): void;
  estado(): EstadoCliente;
}

export declare function crearCliente(o: {
  emisor: string;
  clienteId: string;
  clienteSecreto: string;
  regreso: string;
  almacen?: Almacen;
  almacenPersonas?: Almacen;
  personasCadaMs?: number;
  niveles?: string[];
  sinNivel?: boolean;
  cadaMs?: number;
  limiteMs?: number;
  pedir?: typeof fetch;
  ahora?: () => number;
  registro?: { info?: (o: object, m: string) => void; warn?: (o: object, m: string) => void };
}): Cliente;
