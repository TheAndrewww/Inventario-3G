/**
 * POST /api/sistemas/v1/produccion/reabrir-manufactura (alcance «produccion.reabrir»).
 *
 * La acción «reabrir manufactura / regresar a producción» que se puede ordenar por WhatsApp (Sofía): una obra que ya
 * estaba en «Preparado» y en el día de instalación no quedó vuelve a producción con su manufactura abierta. Hace lo
 * mismo que el botón «Reabrir manufactura» del tablero (ProduccionProyecto.reabrirManufactura): herrería y los demás
 * sellos se quedan, lo que se quita queda anotado en las observaciones de producción y no se avisa al grupo.
 * Sin el alcance en ALCANCES_<ORIGEN> la puerta responde 403, como todas.
 *
 * Cuerpo: { proyectoId (id de Planta) o obraId (ID 3G «3G-AA-NNNN»), autor, motivo? }
 * Respuestas: 200 { ok, proyectoId, proyecto, etapaAntes: 'instalacion', etapa: 'produccion' }
 *   · 400 { error } si falta o sobra algo · 404 si no existe · 409 si la obra no está en «Preparado» (o está cerrada).
 */
import { ES_ID3G } from '../../services/obraId.service.js';
import { sinTelefonos } from './bitacora.js';

export const ALCANCE_REABRIR = 'produccion.reabrir';

const texto = (v, max) => {
    if (v === undefined || v === null || v === '') return { valor: null };
    if (typeof v !== 'string' || v.trim().length > max) return { error: true };
    return { valor: v.trim() || null };
};

/** Revisa el cuerpo; devuelve { errores } o { datos }. Exportada para las pruebas. */
export const leerReabrir = (b) => {
    const errores = [];
    const hayId = b?.proyectoId !== undefined && b?.proyectoId !== null && b?.proyectoId !== '';
    const proyectoId = typeof b?.proyectoId === 'number' ? b.proyectoId : (/^\d+$/.test(String(b?.proyectoId ?? '')) ? Number(b.proyectoId) : NaN);
    const obraId = typeof b?.obraId === 'string' ? b.obraId.trim().toUpperCase() : '';
    if (hayId && obraId) errores.push('Manda «proyectoId» u «obraId», no los dos');
    else if (hayId && (!Number.isInteger(proyectoId) || proyectoId <= 0)) errores.push('«proyectoId» debe ser el id del proyecto de Planta');
    else if (!hayId && !ES_ID3G.test(obraId)) errores.push(obraId ? '«obraId» debe ser un ID 3G (3G-AA-NNNN)' : 'Falta «proyectoId» u «obraId»');
    const autor = texto(b?.autor, 60);
    if (autor.error || !autor.valor) errores.push('Falta «autor» (hasta 60 caracteres)');
    const motivo = texto(b?.motivo, 300);
    if (motivo.error) errores.push('«motivo» debe ser texto de hasta 300 caracteres');
    if (errores.length) return { errores };
    return {
        errores: [],
        datos: {
            proyectoId: hayId ? proyectoId : null,
            obraId: hayId ? null : obraId,
            autor: sinTelefonos(autor.valor),
            motivo: motivo.valor ? sinTelefonos(motivo.valor) : null
        }
    };
};

/** El proyecto activo con ese ID 3G (la columna obra_id va fuera del modelo, como en obraId.service.js). */
const proyectoDeObra = async (ProduccionProyecto, obraId) => {
    const { sequelize } = await import('../../config/database.js');
    const [filas] = await sequelize.query(
        'SELECT id FROM produccion_proyectos WHERE obra_id = :obraId AND activo = true ORDER BY id DESC LIMIT 1',
        { replacements: { obraId } }
    );
    return filas[0] ? ProduccionProyecto.findByPk(filas[0].id) : null;
};

/**
 * Reabre la manufactura. Devuelve { codigo, cuerpo } para la puerta.
 * `modelo` y `buscarObra` son para las pruebas (sin base).
 */
export const reabrirManufacturaPuerta = async (cuerpo, { modelo = null, buscarObra = proyectoDeObra } = {}) => {
    const { errores, datos } = leerReabrir(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se reabrió: ${errores.join('; ')}.` } };
    const ProduccionProyecto = modelo || (await import('../../models/index.js')).ProduccionProyecto;
    const proyecto = datos.proyectoId
        ? await ProduccionProyecto.findByPk(datos.proyectoId)
        : await buscarObra(ProduccionProyecto, datos.obraId);
    if (!proyecto) {
        return { codigo: 404, cuerpo: { error: `No existe ${datos.proyectoId ? `el proyecto ${datos.proyectoId}` : `la obra ${datos.obraId}`} en Planta.` } };
    }
    if (proyecto.etapa_actual !== 'instalacion') {
        return {
            codigo: 409,
            cuerpo: {
                error: proyecto.etapa_actual === 'completado'
                    ? `«${proyecto.nombre}» ya está cerrada en el Índice; no se reabrió su manufactura.`
                    : `«${proyecto.nombre}» no está en «Preparado» (está en ${proyecto.etapa_actual}); no se reabrió nada.`,
                proyectoId: proyecto.id,
                etapa: proyecto.etapa_actual
            }
        };
    }
    await proyecto.reabrirManufactura(null, { motivo: datos.motivo, quien: datos.autor });
    console.log(`🔁 Manufactura reabierta desde la puerta para "${proyecto.nombre}" (${datos.autor})`);
    return {
        codigo: 200,
        cuerpo: {
            ok: true,
            proyectoId: proyecto.id,
            proyecto: proyecto.nombre,
            etapaAntes: 'instalacion',
            etapa: proyecto.etapa_actual
        }
    };
};
