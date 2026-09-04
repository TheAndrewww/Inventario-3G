/**
 * Últimos errores del servidor, en memoria.
 *
 * En producción el manejador de errores esconde la causa (devuelve "Algo salió
 * mal!") y los logs del contenedor no se pueden leer desde fuera. Cuando algo
 * falla en la operación —cerrar una Orden de Salida, por ejemplo— eso deja el
 * diagnóstico a ciegas: se ve el 500 y nada más.
 *
 * Aquí se guardan los últimos errores para poder consultarlos por
 * GET /api/estado-sistema. Solo mensajes de error, ningún dato del negocio, y
 * nada se persiste: al reiniciar el servidor se vacía.
 */

const MAXIMO = 8;
const errores = [];

export const registrarError = (donde, error) => {
    // Un error de Sequelize trae el mensaje real de Postgres adentro
    // (parent/original): sin él solo se lee "Validation error" y similares.
    const raiz = error?.parent || error?.original;

    errores.unshift({
        cuando: new Date().toISOString(),
        donde,
        nombre: error?.name || 'Error',
        mensaje: error?.message || String(error),
        postgres: raiz ? { codigo: raiz.code, detalle: raiz.detail, mensaje: raiz.message } : null,
        sql: error?.sql ? String(error.sql).slice(0, 300) : null
    });

    if (errores.length > MAXIMO) errores.length = MAXIMO;
};

export const ultimosErrores = () => errores;
