/**
 * El ticket de cada Orden de salida se sube solo a la carpeta de Drive de su proyecto (27-oct-2026, pedido del dueño:
 * «automático por servidor, siempre después de crear un pedido, sin tener que presionar otro botón»).
 *
 * Antes lo subía el navegador de quien creaba la orden (PedidoPage › uploadTicketDrive): si cerraba la pestaña, se
 * caía la señal o el PDF fallaba, el ticket no llegaba a Drive. Ahora:
 * 1. crearPedido, ya guardada la orden, llama a encolarTicketDrive: anota el ticket en tickets_drive y lo sube en
 *    seguida, sin hacer esperar a quien creó la orden.
 * 2. El servidor arma el MISMO PDF que se descarga (utils/ticketPDF.js), busca la carpeta del proyecto como siempre
 *    (drive_folder_id del proyecto; si no, la busca en Drive por nombre) y lo sube con la cuenta dueña de la carpeta
 *    PRODUCCION (las credenciales GOOGLE_OAUTH_* que ya usa uploadTicket). Avisa al grupo de PRODUCCIÓN una sola vez.
 * 3. Si falla (Drive caído, permiso vencido, el proyecto todavía sin carpeta), lo reintenta cada 10 minutos con
 *    espera creciente, hasta 7 días. Si a la hora no ha llegado, /api/inicio3g/v1/salud lo avisa con el motivo.
 *
 * Bandera TICKET_DRIVE_DESDE_SERVIDOR: viene ENCENDIDA (lo pidió el dueño); con `0` se regresa a como era: el servidor
 * no sube nada y la pantalla lo vuelve a subir desde el navegador (lo sabe por `ticket_drive` en la respuesta).
 */
import { Op } from 'sequelize';
import { Movimiento, DetalleMovimiento, Articulo, Usuario, Categoria, Ubicacion, ProduccionProyecto } from '../models/index.js';
import TicketDrive from '../models/TicketDrive.js';
import { buscarCarpetaProyecto, uploadTicket, driveEscrituraConfigurada } from './googleDrive.service.js';
import { avisarTicketSubido } from './avisosProduccion.service.js';
import { generarTicketPDF } from '../utils/ticketPDF.js';
import { anotarCorrida } from '../utils/agendaPlanta.js';

const MINUTOS_ENTRE_VUELTAS = 10;
const DIAS_REINTENTANDO = 7;
const POR_VUELTA = 20;
// Un ticket que lleva más de esto sin llegar a Drive (por error o porque su proyecto no tiene carpeta) levanta aviso en
// /salud: la pantalla ya no enseña el error, y así alguien revisa el nombre o la carpeta (o lo sube a mano).
const MINUTOS_PARA_AVISAR = 60;

/** Encendida salvo que diga 0 (o no / false / off). */
export const ticketDriveDesdeServidor = () =>
    !['0', 'no', 'false', 'off'].includes(String(process.env.TICKET_DRIVE_DESDE_SERVIDOR ?? '').trim().toLowerCase());

/** Desde cuándo se reintenta tras `intentos` fallidos: 10, 20, 40, 80, 160 minutos y luego cada 3 horas. */
export const siguienteIntento = (intentos, ahora = new Date()) => {
    const minutos = Math.min(MINUTOS_ENTRE_VUELTAS * 2 ** Math.max(0, intentos - 1), 180);
    return new Date(ahora.getTime() + minutos * 60000);
};

/** Por qué no se subió, en palabras (sin datos de la cuenta ni llaves). */
export const motivoLegible = (error) => {
    const texto = String(error?.message || error || '');
    if (error?.code === 'DRIVE_OAUTH_EXPIRADO' || texto.includes('invalid_grant')) {
        return 'El permiso de Google Drive caducó: hay que volver a autorizarlo (scripts/autorizar-drive.mjs)';
    }
    if (texto.includes('no está autorizado') || texto.includes('storage quota')) {
        return 'Drive no está autorizado con la cuenta dueña de la carpeta PRODUCCION (scripts/autorizar-drive.mjs)';
    }
    if (texto.includes('invalid_client') || texto.includes('unauthorized_client')) {
        return 'Google no reconoce GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET: revisar el cliente OAuth';
    }
    return texto.slice(0, 300) || 'Error desconocido al subir a Drive';
};

/** El pedido con lo que pide el PDF (la misma forma que GET /api/pedidos/:id). null si no existe. */
export const cargarPedidoParaTicket = async (movimientoId) => {
    const pedido = await Movimiento.findOne({
        where: { id: movimientoId, tipo: 'pedido' },
        include: [
            { model: Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email', 'rol', 'puesto'] },
            { model: Usuario, as: 'supervisor', attributes: ['id', 'nombre', 'email'] },
            {
                model: DetalleMovimiento,
                as: 'detalles',
                include: [{
                    model: Articulo,
                    as: 'articulo',
                    include: [
                        { model: Categoria, as: 'categoria' },
                        { model: Ubicacion, as: 'ubicacion' }
                    ]
                }]
            }
        ]
    });
    return pedido ? pedido.toJSON() : null;
};

/**
 * La carpeta de Drive del proyecto: primero el drive_folder_id guardado (más rápido que Drive); si no hay, la busca en
 * Drive por nombre y la guarda para la próxima. { carpetaId | null, proyectoObj | null }.
 * Es la misma búsqueda que hacía POST /api/pedidos/ticket-drive (que ahora también la usa).
 */
export const carpetaDelProyecto = async (proyecto, { buscar = buscarCarpetaProyecto } = {}) => {
    const proyectoObj = await ProduccionProyecto.findOne({
        where: { nombre: proyecto, activo: true },
        attributes: ['id', 'nombre', 'drive_folder_id', 'archivos_ticket']
    });

    let carpetaId = proyectoObj?.drive_folder_id || null;
    if (!carpetaId) {
        const carpeta = await buscar(proyecto);
        if (carpeta) {
            carpetaId = carpeta.id;
            if (proyectoObj) await proyectoObj.update({ drive_folder_id: carpeta.id });
        }
    }
    return { carpetaId, proyectoObj };
};

/**
 * Avisa al grupo de PRODUCCIÓN que el ticket ya está en la carpeta y lo anota como visto en el proyecto, para que el
 * barrido de Drive de cada 10 minutos no lo vuelva a avisar. Si ese mismo archivo ya estaba anotado (lo subió la
 * pantalla o el barrido ya lo vio), no avisa otra vez. Regresa true si avisó. Nunca lanza.
 */
export const avisarYAnotarTicket = async ({ proyecto, proyectoObj, archivo, fileName, avisar = avisarTicketSubido }) => {
    try {
        if (proyectoObj && archivo?.id) await proyectoObj.reload({ attributes: ['id', 'archivos_ticket'] }).catch(() => {});
        const vistos = proyectoObj?.archivos_ticket || [];
        if (archivo?.id && vistos.some(t => t.id === archivo.id)) return false;

        await avisar({ proyecto })
            .catch(err => console.error('⚠️ No se pudo avisar el ticket al grupo:', err.message));

        if (proyectoObj && archivo?.id) {
            await proyectoObj.update({
                archivos_ticket: [...vistos, { id: archivo.id, nombre: archivo.name || fileName }]
            }).catch(err => console.error('⚠️ No se pudo anotar el ticket:', err.message));
        }
        return true;
    } catch (error) {
        console.error('⚠️ Ticket: no se pudo avisar ni anotar:', error.message);
        return false;
    }
};

/**
 * Un intento de subir el ticket de un pedido. { estado: 'subido' | 'sin_carpeta' | 'no_aplica', motivo?, archivo? }.
 * Lanza si Drive falla (lo atrapa procesarTicketDrive y lo cuenta como error para reintentar).
 * Las piezas se pueden cambiar para probar sin base ni Drive.
 */
export const subirTicketADrive = async (movimientoId, piezas = {}) => {
    const {
        cargarPedido = cargarPedidoParaTicket,
        buscarCarpeta = carpetaDelProyecto,
        generarPDF = generarTicketPDF,
        subir = uploadTicket,
        avisarYAnotar = avisarYAnotarTicket,
        escrituraConfigurada = driveEscrituraConfigurada
    } = piezas;

    const pedido = await cargarPedido(movimientoId);
    if (!pedido) return { estado: 'no_aplica', motivo: 'El pedido ya no existe' };
    if (!pedido.proyecto) return { estado: 'no_aplica', motivo: 'El pedido no tiene proyecto' };
    if (pedido.estado === 'cancelado') return { estado: 'no_aplica', motivo: 'El pedido se canceló antes de subirlo' };
    // Sin el permiso para subir no tiene caso bajar las imágenes y armar el PDF en cada reintento.
    if (!escrituraConfigurada()) throw new Error('Drive no está autorizado para subir archivos');

    const { carpetaId, proyectoObj } = await buscarCarpeta(pedido.proyecto);
    if (!carpetaId) return { estado: 'sin_carpeta', motivo: `Carpeta del proyecto "${pedido.proyecto}" no encontrada en Drive` };

    const fileName = `Ticket-${pedido.ticket_id}.pdf`;
    const pdf = await generarPDF(pedido);
    const archivo = await subir(carpetaId, pdf, fileName);
    await avisarYAnotar({ proyecto: pedido.proyecto, proyectoObj, archivo, fileName });
    return { estado: 'subido', archivo };
};

/** Qué se guarda en tickets_drive después de un intento. */
export const cambiosTrasIntento = (registro, resultado, ahora = new Date()) => {
    const intentos = (registro.intentos || 0) + 1;
    if (resultado.estado === 'subido') {
        return {
            estado: 'subido', intentos, ultimo_error: null, siguiente_intento: null,
            archivo_id: resultado.archivo?.id || null,
            archivo_url: resultado.archivo?.webViewLink || null,
            subido_en: ahora
        };
    }
    if (resultado.estado === 'no_aplica') {
        return { estado: 'no_aplica', intentos, ultimo_error: resultado.motivo || null, siguiente_intento: null };
    }
    // Sin carpeta se reintenta igual que un error (la carpeta puede crearse después o corregirse el nombre)
    return {
        estado: resultado.estado === 'sin_carpeta' ? 'sin_carpeta' : 'error',
        intentos,
        ultimo_error: resultado.motivo || null,
        siguiente_intento: siguienteIntento(intentos, ahora)
    };
};

// Un mismo ticket no se sube dos veces a la vez (el de en seguida y una vuelta de reintentos).
const enCurso = new Set();

/** Intenta subir el ticket anotado de un pedido y guarda cómo le fue. Nunca lanza. */
export const procesarTicketDrive = async (movimientoId, { subirTicket = subirTicketADrive } = {}) => {
    if (enCurso.has(movimientoId)) return null;
    enCurso.add(movimientoId);
    try {
        const registro = await TicketDrive.findOne({ where: { movimiento_id: movimientoId } });
        if (!registro || ['subido', 'no_aplica'].includes(registro.estado)) return registro;

        let resultado;
        try {
            resultado = await subirTicket(movimientoId);
        } catch (error) {
            resultado = { estado: 'error', motivo: motivoLegible(error) };
        }
        await registro.update(cambiosTrasIntento(registro, resultado));

        if (resultado.estado === 'subido') console.log(`📄 Ticket ${registro.ticket_id} subido a la carpeta de Drive de "${registro.proyecto}"`);
        else console.error(`⚠️ Ticket ${registro.ticket_id} (${registro.proyecto}) sin subir a Drive [${resultado.estado}]: ${resultado.motivo}`);
        return registro;
    } catch (error) {
        console.error(`⚠️ Ticket del pedido ${movimientoId}: no se pudo procesar la subida a Drive:`, error.message);
        return null;
    } finally {
        enCurso.delete(movimientoId);
    }
};

/**
 * Lo llama crearPedido ya guardada la orden: anota el ticket y lo sube en seguida, sin esperar a Drive. Nunca lanza.
 * Regresa true si el servidor se encarga. Si no se pudo anotar (la tabla no está o la base falló), regresa false y la
 * pantalla lo sube como antes (crearPedido responde ticket_drive: 'navegador').
 */
export const encolarTicketDrive = async ({ movimientoId, ticketId, proyecto }) => {
    try {
        await TicketDrive.findOrCreate({
            where: { movimiento_id: movimientoId },
            defaults: { ticket_id: ticketId, proyecto, estado: 'pendiente' }
        });
    } catch (error) {
        console.error(`⚠️ Ticket ${ticketId}: no se pudo anotar para subirlo desde el servidor (${error.message}); lo sube la pantalla`);
        return false;
    }
    setImmediate(() => { procesarTicketDrive(movimientoId); });
    return true;
};

/**
 * ¿El servidor ya se encarga de este ticket? Lo pregunta POST /api/pedidos/ticket-drive para no subirlo dos veces:
 * una pantalla de antes del 27-oct (abierta mientras se publica) todavía puede llamarlo. Ante la duda, false.
 */
export const ticketYaLoSubeElServidor = async (ticketId) => {
    if (!ticketDriveDesdeServidor() || !ticketId) return false;
    try {
        return (await TicketDrive.count({ where: { ticket_id: ticketId } })) > 0;
    } catch {
        return false;
    }
};

/**
 * Una vuelta de reintentos: los que fallaron y ya les toca, y los que se quedaron a medias por un reinicio. Solo los
 * de los últimos 7 días y a lo más 20 por vuelta. Regresa cuántos intentó.
 */
export const reintentarTicketsDrive = async ({ ahora = new Date() } = {}) => {
    const pendientes = await TicketDrive.findAll({
        where: {
            created_at: { [Op.gte]: new Date(ahora.getTime() - DIAS_REINTENTANDO * 86400000) },
            [Op.or]: [
                { estado: { [Op.in]: ['error', 'sin_carpeta'] }, siguiente_intento: { [Op.lte]: ahora } },
                { estado: 'pendiente', updated_at: { [Op.lte]: new Date(ahora.getTime() - 2 * 60000) } }
            ]
        },
        order: [['created_at', 'ASC']],
        limit: POR_VUELTA
    });
    for (const registro of pendientes) {
        await procesarTicketDrive(registro.movimiento_id);
        await new Promise(resolve => setTimeout(resolve, 500)); // sin saturar la API de Google
    }
    return pendientes.length;
};

/** Reintentos cada 10 minutos (y una vuelta 2 minutos después de arrancar). Con la bandera en 0 no hace nada. */
export const iniciarReintentosTicketsDrive = () => {
    if (!ticketDriveDesdeServidor()) {
        console.log('📄 TICKET_DRIVE_DESDE_SERVIDOR=0: el ticket lo sube la pantalla, como antes');
        return;
    }
    let corriendo = false;
    const vuelta = async () => {
        if (corriendo) return;
        corriendo = true;
        anotarCorrida('pla-tickets-drive');
        try {
            const n = await reintentarTicketsDrive();
            if (n) console.log(`📄 Reintentos de tickets a Drive: ${n}`);
        } catch (error) {
            console.error('⚠️ Error en los reintentos de tickets a Drive:', error.message);
        } finally {
            corriendo = false;
        }
    };
    setTimeout(vuelta, 2 * 60000);
    setInterval(vuelta, MINUTOS_ENTRE_VUELTAS * 60000);
    console.log(`📅 Tickets de salida a Drive desde el servidor (reintentos cada ${MINUTOS_ENTRE_VUELTAS} minutos)`);
};

/**
 * Pieza de /api/inicio3g/v1/salud. «aviso» si falta el permiso para subir o si algún ticket de la última semana lleva
 * más de una hora sin llegar a Drive (Drive lo rechazó o su proyecto no tiene carpeta). Los más recientes se cuentan
 * como «intentándose». `tope` limita cuánto se espera a la base. null con la bandera en 0.
 */
export const piezaTicketsDrive = async ({ ahora = new Date(), tope = (p) => p } = {}) => {
    if (!ticketDriveDesdeServidor()) return null;
    const pieza = { id: 'tickets-drive', nombre: 'Tickets de salida a la carpeta de Drive del proyecto' };
    if (!driveEscrituraConfigurada()) {
        return { ...pieza, estado: 'aviso', mensaje: 'Falta GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET o GOOGLE_OAUTH_REFRESH_TOKEN: los tickets no se suben' };
    }
    try {
        const desde = new Date(ahora.getTime() - DIAS_REINTENTANDO * 86400000);
        const limite = new Date(ahora.getTime() - MINUTOS_PARA_AVISAR * 60000);
        const sinLlegar = { [Op.in]: ['pendiente', 'error', 'sin_carpeta'] };
        const [atorados, intentandose] = await tope(Promise.all([
            TicketDrive.count({ where: { estado: sinLlegar, created_at: { [Op.gte]: desde, [Op.lte]: limite } } }),
            TicketDrive.count({ where: { estado: { [Op.in]: ['error', 'sin_carpeta'] }, created_at: { [Op.gt]: limite } } })
        ]));
        const recientes = intentandose ? ` · ${intentandose} reintentándose` : '';
        if (!atorados) return { ...pieza, estado: 'ok', mensaje: `Cada orden de salida se sube sola${recientes}` };
        const ultimo = await tope(TicketDrive.findOne({
            where: { estado: sinLlegar, created_at: { [Op.gte]: desde, [Op.lte]: limite } },
            order: [['updated_at', 'DESC']],
            attributes: ['ticket_id', 'ultimo_error']
        }));
        return {
            ...pieza,
            estado: 'aviso',
            mensaje: `${atorados} sin llegar a Drive después de una hora${ultimo?.ultimo_error ? ` (el último, ${ultimo.ticket_id}: ${ultimo.ultimo_error})` : ''}${recientes}`
        };
    } catch (error) {
        return { ...pieza, estado: 'aviso', mensaje: 'No se pudo revisar la subida de tickets' };
    }
};

export default {
    ticketDriveDesdeServidor,
    encolarTicketDrive,
    procesarTicketDrive,
    subirTicketADrive,
    reintentarTicketsDrive,
    iniciarReintentosTicketsDrive,
    piezaTicketsDrive
};
