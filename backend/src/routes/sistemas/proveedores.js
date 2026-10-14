/**
 * B3 paso 3 · PLA-20 — Puertas de proveedores (origen «finanzas», alcance «proveedores.credito»).
 *
 *   POST /api/sistemas/v1/proveedores/credito   Julia (FIN-23) manda el crédito y el plazo de CTAS CRÉDITO, que sigue
 *        manteniendo Contabilidad (D-9). Cuerpo del contrato §4.4: la lista COMPLETA `[{ rfc, nombre, pestana, plazoDias }]`.
 *        Planta guarda cada pestaña; las que ya no vienen quedan como «ya no está en CTAS CRÉDITO» (no se borran). Una lista
 *        vacía no cambia nada (400). Exige Idempotency-Key (la puerta). Respuestas: 201/200 { ok, recibidas, nuevas,
 *        cambiadas, yaNoEstan, sinProveedorEnPlanta } · 400 { error }.
 *   GET  /api/sistemas/v1/proveedores?pagina=&todos=1   Julia lee la ficha maestra (nombre corto, razones sociales con RFC,
 *        alias, contactos y trato) en vez de la pestaña PROVEEDORES (FIN-23, bandera DIRECTORIO_DESDE_PLANTA en Finanzas).
 *        Páginas de 50. Mismo alcance: es el mismo intercambio de B3 con la misma llave de Finanzas.
 *
 * Planta no manda mensajes ni cambia nada de Julia con esto: solo guarda y muestra (guarda de A1).
 */
import { registrarCredito, proveedoresParaJulia } from '../../services/proveedoresFicha.service.js';

export const ALCANCE_PROVEEDORES = 'proveedores.credito';

/** Para `escribirCon`: { codigo, cuerpo }. */
export const recibirCredito = (req) => registrarCredito(req.body);

/** Para `leer`: el cuerpo. */
export const leerProveedores = (req) => proveedoresParaJulia({
    pagina: req.query.pagina,
    todos: ['1', 'true', 'si', 'sí'].includes(String(req.query.todos || '').toLowerCase())
});
