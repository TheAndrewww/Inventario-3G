/**
 * Seguimiento automático de Planta (revisión del 6-nov-2026, punto 9 c, d y e, y el aviso diario de a).
 * Regla del dueño: lo que se decide con una regla lo hace el sistema solo; lo que necesita a una persona va con plazo y
 * salida segura; y nada falla en silencio.
 *
 * Bandera PLANTA_SEGUIMIENTO (APAGADA por omisión: sin ella no sale ningún aviso nuevo). `1` (o `todo`) enciende las
 * cuatro piezas; también acepta una lista: `pedidos,encargado`.
 *   resumen    8:00 lun-sáb · campana (y push) al administrador: celdas del calendario que Planta no entiende, pedidos de
 *              encargados vencidos, tickets sin llegar a Drive y cuántos tickets se subieron ayer. Si no sale, queda
 *              anotado (la puerta lo dice en `avisos`) y se reintenta cada hora hasta las 18:00 (vuelta 1).
 *   pedidos    cada hora de 9:00 a 18:00 lun-sáb · a Almacén (Charly): campana y un mensaje al grupo Requisiciones con los
 *              pedidos que llevan más de PEDIDOS_RECORDAR_HORAS (4 por omisión) «por atender». Una vez al día por pedido
 *              y dos días como máximo; después el pedido queda VENCIDO (salida segura): ya no se le insiste a Charly, sale
 *              en el resumen de las 8:00 al administrador y en la puerta «pendientes de Planta» que lee Operación.
 *              Solo cuenta como recordado si salió algo (el WhatsApp o la campana); si no salió nada, se reintenta en la
 *              siguiente vuelta y la puerta y el resumen lo dicen en `avisos`.
 *   encargado  al contestar Almacén un pedido (surtido, parcial o no se puede): aviso al grupo Requisiciones, el mismo
 *              donde salió la requisición, para que el encargado sepa sin abrir la tableta. ANTES DE ENCENDERLA hay que
 *              confirmar que los encargados están en ese grupo. Si el WhatsApp no sale: campana al administrador (una por
 *              hora como máximo), Charly lo ve al guardar, y queda en la puerta y en el resumen.
 *   tickets    cada 10 min · campana (y push) al administrador cuando una orden de salida lleva más de 1 h sin llegar a
 *              Drive. Una vez por ticket, los que no se han avisado primero (antes solo lo decía /api/inicio3g/v1/salud).
 *
 * Sin bandera (solo lectura): pendientesDePlanta (GET /api/sistemas/v1/pendientes-planta y GET /api/seguimiento/pendientes)
 * y ticketsPorDia (GET /api/seguimiento/tickets-drive). OJO: sin la pieza «resumen», esa lista solo se ve por esas dos
 * rutas; ninguna pantalla de Planta la muestra.
 *
 * Las piezas de la base, de WhatsApp y de la campana se pueden cambiar en las pruebas (tests/seguimiento-planta.test.js).
 * Nada de aquí lleva teléfonos ni importes: el texto de los pedidos ya llega sin teléfonos (sinTelefonos de la puerta).
 */
import { Op } from 'sequelize';
import { isoMexico } from '../utils/revisarConfig.js';
import { vocabularioUnico } from '../utils/vocabularioCalendario.js';

export const PIEZAS_SEGUIMIENTO = ['resumen', 'pedidos', 'encargado', 'tickets'];
const TODO = new Set(['1', 'true', 'si', 'sí', 'on', 'todo', 'todas']);
const NADA = new Set(['', '0', 'no', 'false', 'off']);

/** Las piezas encendidas de PLANTA_SEGUIMIENTO (vacío = apagada). Se lee en cada llamada, como las demás banderas. */
export const piezasSeguimiento = (env = process.env) => {
    const v = String(env.PLANTA_SEGUIMIENTO ?? '').trim().toLowerCase();
    if (NADA.has(v)) return new Set();
    if (TODO.has(v)) return new Set(PIEZAS_SEGUIMIENTO);
    return new Set(v.split(/[\s,;]+/).filter((p) => PIEZAS_SEGUIMIENTO.includes(p)));
};
export const seguimientoEncendido = (pieza, env = process.env) => piezasSeguimiento(env).has(pieza);

/** Horas «por atender» antes del recordatorio a Almacén: PEDIDOS_RECORDAR_HORAS (1 a 72), 4 por omisión. */
export const horasParaRecordar = (env = process.env) => {
    const n = Number(String(env.PEDIDOS_RECORDAR_HORAS ?? '').trim());
    return Number.isFinite(n) && n >= 1 && n <= 72 ? n : 4;
};
export const RECORDATORIOS_MAXIMOS = 2;   // días que se le recuerda a Almacén; después, vencido y al resumen
const MINUTOS_TICKET_ATORADO = 60;       // el mismo plazo de la salud (ticketDrive.service › MINUTOS_PARA_AVISAR)
const DIAS_TICKETS = 7;                  // los reintentos de tickets duran 7 días
const MAX_LISTA = 50;
const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;

const CLAVE_RECORDATORIOS = 'pedidos_encargados_recordatorios';
const CLAVE_TICKETS_ALERTADOS = 'tickets_drive_alertados';
const CLAVE_CELDAS = 'calendario_celdas_no_entendidas'; // la escribe fechaInstalacion.service cada 5 min
const CLAVE_RECORDATORIO_NO_SALIO = 'pedidos_recordatorio_no_salio'; // la última vuelta del recordatorio que no salió completa
const CLAVE_AVISOS_ENCARGADO = 'avisos_encargado_no_salieron';       // avisos al encargado que no salieron (7 días)
const CLAVE_RESUMEN = 'resumen_planta_diario';                     // { enviado: día en que salió, noSalio: { dia, cuando, intentos, motivo } }
const CLAVE_VISTA_PREVIA = 'calendario_vocabulario_vista_previa';  // la escribe fechaInstalacion.service cada 5 min (vuelta 1)
const ESTADOS_SIN_LLEGAR = ['pendiente', 'error', 'sin_carpeta'];

const hoyMexico = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(ahora);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaCorto = (iso) => { const [, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MESES[m - 1]}`; };
const nombreBonito = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
const corto = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const TEXTO_TIPO = { MATERIAL: 'Material', REPOSICION: 'Reposición', HERRAMIENTA_ESPECIAL: 'Herramienta especial' };
const horaMexico = (iso) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const hace = (horas) => (horas < 24 ? `hace ${Math.max(1, Math.floor(horas))} h` : `hace ${Math.floor(horas / 24)} ${Math.floor(horas / 24) === 1 ? 'día' : 'días'}`);

// ---------- Configuración guardada (clave-valor), con piezas cambiables para las pruebas ----------
const cfgPorOmision = async () => (await import('../models/index.js')).Configuracion;
const leerJson = async (clave, cfg) => {
    const Configuracion = cfg || await cfgPorOmision();
    const fila = await Configuracion.findOne({ where: { clave }, attributes: ['valor'] });
    try { return fila?.valor ? JSON.parse(fila.valor) : null; } catch { return null; }
};
const guardarJson = async (clave, valor, descripcion, cfg) => {
    const Configuracion = cfg || await cfgPorOmision();
    const texto = JSON.stringify(valor);
    const [fila, creada] = await Configuracion.findOrCreate({ where: { clave }, defaults: { valor: texto, descripcion } });
    if (!creada && fila.valor !== texto) await fila.update({ valor: texto });
};
const modeloPedidos = async () => (await import('../models/SolicitudAlmacen.js')).default;
const modeloTickets = async () => (await import('../models/TicketDrive.js')).default;
const notificarPorOmision = async (datos) => (await import('../controllers/notificaciones.controller.js')).notificarPorRol(datos);
const whatsappPorOmision = async (mensaje, destino) => (await import('./whatsapp.service.js')).enviarWhatsApp(mensaje, destino);

// ---------- (c) Pedidos de los encargados ----------

/** Cómo va un pedido «por atender». Pura. */
export const estadoPedido = (s, { ahora = new Date(), horas = 4, recordatorio = null } = {}) => {
    const hoy = hoyMexico(ahora);
    const espera = (ahora.getTime() - new Date(s.created_at).getTime()) / HORA_MS;
    const veces = recordatorio?.veces || 0;
    const fechaPasada = !!s.para_fecha && String(s.para_fecha).slice(0, 10) < hoy;
    return {
        id: `almacen-${s.id}`,
        encargado: s.encargado,
        tipo: s.tipo,
        texto: corto(s.texto, 200),
        paraFecha: s.para_fecha ? String(s.para_fecha).slice(0, 10) : null,
        obra: s.obra_id || null,
        desde: isoMexico(new Date(s.created_at)),
        horasEsperando: Math.max(0, Math.floor(espera)),
        atrasado: espera >= horas,
        recordatorios: veces,
        // Salida segura: ya se le recordó los días máximos o ya pasó el día en que lo necesitaba.
        vencido: veces >= RECORDATORIOS_MAXIMOS || fechaPasada,
        motivoVencido: fechaPasada ? 'ya pasó el día en que lo necesitaba' : veces >= RECORDATORIOS_MAXIMOS ? `se le recordó ${veces} días a Almacén` : null
    };
};

/** El recordatorio al grupo Requisiciones. Pura. */
export const textoRecordatorioPedidos = (pedidos, { ahora = new Date() } = {}) => {
    const hoy = hoyMexico(ahora);
    const lineas = pedidos.slice(0, 10).map((p) => {
        const para = p.paraFecha ? ` · para el ${diaCorto(p.paraFecha)}${p.paraFecha < hoy ? ' (ya pasó)' : ''}` : '';
        return `• ${nombreBonito(p.encargado)} · ${TEXTO_TIPO[p.tipo] || 'Pedido'}: ${corto(p.texto, 90)}${para} · ${hace(p.horasEsperando)}`;
    });
    if (pedidos.length > 10) lineas.push(`• y ${pedidos.length - 10} más`);
    return [
        `⏰ *Pedidos de encargados sin atender* (${pedidos.length})`,
        ...lineas,
        'Se atienden en Inventario › Pedidos de encargados: surtido, parcial o no se puede (con el motivo).'
    ].join('\n');
};

/** Los pedidos «por atender» con su estado (más viejo primero). */
export const pedidosPorAtender = async ({ ahora = new Date(), modelo = null, cfg = null, env = process.env } = {}) => {
    const Modelo = modelo || await modeloPedidos();
    const filas = await Modelo.findAll({ where: { estado: 'pendiente' }, order: [['created_at', 'ASC'], ['id', 'ASC']], limit: 200 });
    const recordatorios = (await leerJson(CLAVE_RECORDATORIOS, cfg)) || {};
    const horas = horasParaRecordar(env);
    return filas.map((s) => ({ fila: s, ...estadoPedido(s, { ahora, horas, recordatorio: recordatorios[s.id] }) }));
};

/**
 * Una vuelta del recordatorio a Almacén (pieza «pedidos»). Recuerda los pedidos atrasados que hoy no se han recordado y
 * que no han llegado al máximo; guarda cuántas veces van. Un recordatorio solo cuenta si salió algo: el WhatsApp
 * (enviarWhatsApp regresa false si está apagado o no se pudo encolar) o la campana. Cada salida va por separado, así que
 * una campana que falla ya no impide guardar la cuenta (antes, a la hora siguiente salía otro mensaje igual al grupo).
 * Si no salió nada, no se cuenta (se reintenta en la siguiente vuelta) y queda anotado para la puerta y el resumen.
 * Regresa { recordados, vencidos, porWhatsApp, porCampana }. Nunca lanza.
 */
export const recordarPedidos = async ({ ahora = new Date(), modelo = null, cfg = null, env = process.env,
    enviar = whatsappPorOmision, notificar = notificarPorOmision } = {}) => {
    if (!seguimientoEncendido('pedidos', env)) return { recordados: 0, vencidos: 0, apagada: true };
    try {
        const hoy = hoyMexico(ahora);
        const Modelo = modelo || await modeloPedidos();
        const filas = await Modelo.findAll({ where: { estado: 'pendiente' }, order: [['created_at', 'ASC'], ['id', 'ASC']], limit: 200 });
        const previos = (await leerJson(CLAVE_RECORDATORIOS, cfg)) || {};
        const horas = horasParaRecordar(env);
        const estado = {};
        const toca = [];
        let vencidos = 0;
        for (const s of filas) {
            const r = previos[s.id] || { veces: 0, ultimo: null };
            estado[s.id] = r; // los que ya no están «por atender» se caen solos de la lista
            const e = estadoPedido(s, { ahora, horas, recordatorio: r });
            if (e.vencido) vencidos++;
            if (e.atrasado && !e.vencido && r.ultimo !== hoy) toca.push({ s, e });
        }
        let porWhatsApp = false;
        let porCampana = false;
        if (toca.length) {
            const motivos = [];
            try {
                porWhatsApp = !!(await enviar(textoRecordatorioPedidos(toca.map((x) => x.e), { ahora }), 'requisiciones'));
                if (!porWhatsApp) motivos.push('el WhatsApp al grupo Requisiciones no salió (apagado o no se pudo encolar)');
            } catch (e) {
                motivos.push(`el WhatsApp falló: ${e.message}`);
            }
            try {
                await notificar({
                    roles: ['almacen'],
                    tipo: 'pedido_pendiente',
                    titulo: `${toca.length} ${toca.length === 1 ? 'pedido de encargado espera' : 'pedidos de encargados esperan'} respuesta`,
                    mensaje: toca.slice(0, 5).map((x) => `${nombreBonito(x.e.encargado)}: ${corto(x.e.texto, 60)}`).join(' · '),
                    url: '/pedidos-encargados',
                    datos_adicionales: { solicitudes_almacen: toca.map((x) => x.s.id) }
                });
                porCampana = true;
            } catch (e) {
                motivos.push(`la campana falló: ${e.message}`);
            }
            if (porWhatsApp || porCampana) {
                for (const { s } of toca) estado[s.id] = { veces: (estado[s.id].veces || 0) + 1, ultimo: hoy };
                console.log(`⏰ Recordatorio a Almacén: ${toca.length} pedido(s) de encargados sin atender`);
            } else {
                console.error(`⚠️ El recordatorio a Almacén no salió (${motivos.join('; ')}); se reintenta en la siguiente vuelta`);
            }
            const completo = porWhatsApp && porCampana;
            await guardarJson(CLAVE_RECORDATORIO_NO_SALIO, completo ? null : {
                cuando: ahora.toISOString(),
                pedidos: toca.length,
                salioPor: porWhatsApp ? 'whatsapp' : porCampana ? 'campana' : null,
                motivo: corto(motivos.join('; '), 300)
            }, 'Último recordatorio a Almacén que no salió completo (PLANTA_SEGUIMIENTO)', cfg);
        }
        await guardarJson(CLAVE_RECORDATORIOS, estado, 'Recordatorios a Almacén de pedidos de encargados sin atender (PLANTA_SEGUIMIENTO)', cfg);
        return { recordados: porWhatsApp || porCampana ? toca.length : 0, vencidos, porWhatsApp, porCampana };
    } catch (e) {
        console.error('⚠️ Recordatorio de pedidos de encargados:', e.message);
        return { recordados: 0, vencidos: 0, error: e.message };
    }
};

const TEXTO_RESPUESTA = { surtida: 'Surtido', parcial: 'Surtido en parte', rechazada: 'No se puede', cancelada: 'Cancelado' };
/** El aviso al grupo Requisiciones cuando Almacén contesta. Pura. */
export const textoRespuestaEncargado = (f) => [
    `${f.estado === 'surtida' ? '✅' : f.estado === 'parcial' ? '🟡' : '❌'} *Almacén contestó a ${nombreBonito(f.encargado)}* · ${TEXTO_RESPUESTA[f.estado] || f.estado}`,
    `«${corto(f.texto, 160)}»`,
    f.nota_almacen ? `Nota: ${corto(f.nota_almacen, 300)}` : null,
    'También se ve en su tableta.'
].filter(Boolean).join('\n');

/**
 * Un aviso al encargado que no salió: queda en la lista de 7 días (la puerta y el resumen la leen) y el administrador
 * recibe una campana, una por hora como máximo (con el WhatsApp apagado, Charly puede contestar varios seguidos).
 * Nunca lanza.
 */
export const anotarAvisoNoSalio = async (fila, motivo, { ahora = new Date(), cfg = null, notificar = notificarPorOmision } = {}) => {
    const respuesta = TEXTO_RESPUESTA[fila.estado] || fila.estado;
    console.error(`⚠️ El aviso al encargado ${fila.encargado} (pedido #${fila.id}) no salió: ${motivo}`);
    try {
        const guardado = (await leerJson(CLAVE_AVISOS_ENCARGADO, cfg)) || {};
        const limite = new Date(ahora.getTime() - DIAS_TICKETS * DIA_MS).toISOString();
        const lista = [
            { id: `almacen-${fila.id}`, encargado: fila.encargado, respuesta, texto: corto(fila.texto, 80), cuando: ahora.toISOString(), motivo: corto(motivo, 200) },
            ...(Array.isArray(guardado.lista) ? guardado.lista : []).filter((a) => a?.cuando >= limite)
        ].slice(0, MAX_LISTA);
        let campana = guardado.campana || null;
        if (!campana || ahora.getTime() - new Date(campana).getTime() >= HORA_MS) {
            try {
                await notificar({
                    roles: ['administrador'],
                    tipo: 'pedido_pendiente',
                    titulo: 'No salió el aviso al encargado',
                    mensaje: `Almacén contestó a ${nombreBonito(fila.encargado)} («${corto(fila.texto, 60)}»: ${respuesta}), pero el WhatsApp al grupo Requisiciones no salió (${corto(motivo, 120)}). Lo ve en su tableta; si urge, hay que avisarle por otro medio.`,
                    url: '/pedidos-encargados',
                    datos_adicionales: { solicitud_almacen_id: fila.id }
                });
                campana = ahora.toISOString();
            } catch (e) {
                console.error('⚠️ Campana del aviso al encargado que no salió:', e.message);
            }
        }
        await guardarJson(CLAVE_AVISOS_ENCARGADO, { lista, campana }, 'Avisos al encargado que no salieron por WhatsApp (PLANTA_SEGUIMIENTO)', cfg);
    } catch (e) {
        console.error('⚠️ No se pudo anotar el aviso al encargado que no salió:', e.message);
    }
};

/**
 * Pieza «encargado»: aviso de la respuesta. Regresa true si salió, false si no salió (y lo anota: anotarAvisoNoSalio) y
 * null con la pieza apagada. Nunca lanza ni tumba la respuesta de Charly.
 */
export const avisarRespuestaAlEncargado = async (fila, { env = process.env, enviar = whatsappPorOmision, notificar = notificarPorOmision, cfg = null, ahora = new Date() } = {}) => {
    if (!seguimientoEncendido('encargado', env) || !fila) return null;
    let motivo;
    try {
        if (await enviar(textoRespuestaEncargado(fila), 'requisiciones')) return true;
        motivo = 'WhatsApp apagado o no se pudo encolar';
    } catch (e) {
        motivo = e.message;
    }
    await anotarAvisoNoSalio(fila, motivo, { ahora, cfg, notificar });
    return false;
};

// ---------- (d) Tickets de salida a Drive ----------

const whereAtorados = (ahora) => ({
    estado: { [Op.in]: ESTADOS_SIN_LLEGAR },
    created_at: { [Op.gte]: new Date(ahora.getTime() - DIAS_TICKETS * DIA_MS), [Op.lte]: new Date(ahora.getTime() - MINUTOS_TICKET_ATORADO * 60000) }
});

/**
 * Tickets de los últimos 7 días que llevan más de 1 h sin llegar a Drive (los 50 más viejos). `excluir` = movimientos que
 * ya se avisaron: así la alerta toma primero los que nadie ha visto, aunque haya más de 50 atorados.
 */
export const ticketsAtorados = async ({ ahora = new Date(), modelo = null, excluir = [] } = {}) => {
    const Modelo = modelo || await modeloTickets();
    const where = whereAtorados(ahora);
    if (excluir.length) where.movimiento_id = { [Op.notIn]: excluir };
    return Modelo.findAll({
        where,
        order: [['created_at', 'ASC']],
        limit: MAX_LISTA,
        attributes: ['movimiento_id', 'ticket_id', 'proyecto', 'estado', 'intentos', 'ultimo_error', 'created_at']
    });
};

/**
 * Cuántos tickets no han llegado a Drive, sin tope: `sinSubir` (de 1 h a 7 días, se siguen reintentando) y `masDe7Dias`
 * (ya no se reintentan solos: ticketDrive.service solo reintenta 7 días). Antes `sinSubir` era el largo de una lista de
 * 50 y lo de más de 7 días desaparecía sin que nadie lo dijera.
 */
export const contarTicketsSinSubir = async ({ ahora = new Date(), modelo = null } = {}) => {
    const Modelo = modelo || await modeloTickets();
    const [sinSubir, masDe7Dias] = await Promise.all([
        Modelo.count({ where: whereAtorados(ahora) }),
        Modelo.count({ where: { estado: { [Op.in]: ESTADOS_SIN_LLEGAR }, created_at: { [Op.lt]: new Date(ahora.getTime() - DIAS_TICKETS * DIA_MS) } } })
    ]);
    return { sinSubir, masDe7Dias };
};

/** Forma de un ticket atorado para la puerta y la campana. Pura. */
export const formaTicket = (t, ahora = new Date()) => ({
    ticket: t.ticket_id,
    proyecto: corto(t.proyecto, 120),
    estado: t.estado,
    intentos: t.intentos || 0,
    motivo: t.ultimo_error ? corto(t.ultimo_error, 200) : null,
    desde: isoMexico(new Date(t.created_at)),
    horas: Math.floor((ahora.getTime() - new Date(t.created_at).getTime()) / HORA_MS)
});

/** Pieza «tickets»: campana al administrador por cada ticket nuevo que pasó la hora sin llegar. Nunca lanza. */
export const alertarTicketsAtorados = async ({ ahora = new Date(), modelo = null, cfg = null, env = process.env, notificar = notificarPorOmision } = {}) => {
    if (!seguimientoEncendido('tickets', env)) return { alertados: 0, apagada: true };
    try {
        const previos = (await leerJson(CLAVE_TICKETS_ALERTADOS, cfg)) || {};
        const limite = new Date(ahora.getTime() - (DIAS_TICKETS + 1) * DIA_MS).toISOString();
        const vigentes = Object.fromEntries(Object.entries(previos).filter(([, cuando]) => cuando >= limite));
        // Solo los que no se han avisado (antes tomaba los 50 más viejos y los nuevos esperaban días a que esos salieran)
        const ids = Object.keys(vigentes).map(Number).filter(Number.isFinite);
        const atorados = await ticketsAtorados({ ahora, modelo, excluir: ids });
        const nuevos = atorados.filter((t) => !vigentes[t.movimiento_id]);
        if (nuevos.length) {
            const lista = nuevos.map((t) => formaTicket(t, ahora));
            const { sinSubir } = await contarTicketsSinSubir({ ahora, modelo });
            await notificar({
                roles: ['administrador'],
                tipo: 'pedido_pendiente',
                titulo: `${nuevos.length} ${nuevos.length === 1 ? 'orden de salida no ha llegado' : 'órdenes de salida no han llegado'} a Drive`,
                mensaje: lista.slice(0, 3).map((t) => `${t.ticket} (${t.proyecto}): ${t.motivo || 'sigue intentándose'}`).join(' · ') +
                    (sinSubir > nuevos.length ? ` · En total, ${sinSubir} sin llegar` : ''),
                url: '/pedidos-pendientes',
                datos_adicionales: { tickets_drive: lista.map((t) => t.ticket) }
            });
            for (const t of nuevos) vigentes[t.movimiento_id] = ahora.toISOString();
            console.error(`⚠️ Tickets sin llegar a Drive después de una hora: ${lista.map((t) => t.ticket).join(', ')} (aviso al administrador)`);
        }
        await guardarJson(CLAVE_TICKETS_ALERTADOS, vigentes, 'Tickets de salida ya avisados al administrador por no llegar a Drive (PLANTA_SEGUIMIENTO)', cfg);
        return { alertados: nuevos.length };
    } catch (e) {
        console.error('⚠️ Alerta de tickets sin llegar a Drive:', e.message);
        return { alertados: 0, error: e.message };
    }
};

/**
 * Cuántas órdenes de salida hubo y cuántos tickets se subieron cada día (hora de México), del más nuevo al más viejo.
 * `ordenes` = tickets anotados ese día; `subidos` = los que llegaron a Drive ese día; `sinSubir` = los de ese día que
 * todavía no llegan. Pura.
 */
export const contarPorDia = (filas, { dias = 14, ahora = new Date() } = {}) => {
    const hoy = hoyMexico(ahora);
    const resultado = new Map();
    for (let i = 0; i < dias; i++) {
        const dia = hoyMexico(new Date(new Date(`${hoy}T12:00:00-06:00`).getTime() - i * DIA_MS));
        resultado.set(dia, { dia, ordenes: 0, subidos: 0, sinSubir: 0 });
    }
    for (const f of filas || []) {
        const creado = resultado.get(hoyMexico(new Date(f.created_at)));
        if (creado) {
            creado.ordenes++;
            if (ESTADOS_SIN_LLEGAR.includes(f.estado)) creado.sinSubir++;
        }
        if (f.estado === 'subido' && f.subido_en) {
            const subido = resultado.get(hoyMexico(new Date(f.subido_en)));
            if (subido) subido.subidos++;
        }
    }
    return [...resultado.values()];
};

export const ticketsPorDia = async ({ dias = 14, ahora = new Date(), modelo = null } = {}) => {
    const n = Math.min(Math.max(Number.parseInt(dias, 10) || 14, 1), 31);
    const Modelo = modelo || await modeloTickets();
    const filas = await Modelo.findAll({
        where: { [Op.or]: [
            { created_at: { [Op.gte]: new Date(ahora.getTime() - (n + 1) * DIA_MS) } },
            { subido_en: { [Op.gte]: new Date(ahora.getTime() - (n + 1) * DIA_MS) } }
        ] },
        attributes: ['estado', 'created_at', 'subido_en'],
        limit: 5000
    });
    return contarPorDia(filas, { dias: n, ahora });
};

// ---------- Calendario: celdas que Planta no entiende (las anota fechaInstalacion.service cada 5 min) ----------
export const leerCeldasNoEntendidas = async ({ ahora = new Date(), cfg = null } = {}) => {
    const guardado = await leerJson(CLAVE_CELDAS, cfg);
    const hoy = hoyMexico(ahora);
    const celdas = Array.isArray(guardado?.celdas) ? guardado.celdas.filter((c) => !c.fecha || c.fecha >= hoy) : [];
    return {
        revisadoEl: guardado?.dia || null,
        // Si la lista no es de hoy, la lectura del calendario de cada 5 min no ha podido correr hoy: se dice, no se calla.
        alDia: guardado?.dia === hoy,
        celdas: celdas.slice(0, MAX_LISTA)
    };
};

// ---------- (e) Pendientes de Planta: lo que el resumen diario de Operación puede consultar ----------

/**
 * Pedidos sin atender, tickets sin subir y celdas no entendidas, en una sola respuesta. Cada parte por separado: si una
 * no se puede leer, sale null y `avisos` dice cuál (nada se calla). Sin teléfonos, importes ni llaves.
 */
export const pendientesDePlanta = async ({ ahora = new Date(), modelos = {}, cfg = null, env = process.env } = {}) => {
    const avisos = [];
    let pedidos = null;
    try {
        const lista = (await pedidosPorAtender({ ahora, modelo: modelos.pedidos, cfg, env })).map(({ fila, ...p }) => p);
        pedidos = {
            porAtender: lista.length,
            atrasados: lista.filter((p) => p.atrasado).length,
            vencidos: lista.filter((p) => p.vencido).length,
            horasParaRecordar: horasParaRecordar(env),
            lista: lista.sort((a, b) => Number(b.vencido) - Number(a.vencido) || a.desde.localeCompare(b.desde)).slice(0, MAX_LISTA)
        };
    } catch (e) {
        avisos.push('No se pudieron leer los pedidos de los encargados');
        console.error('[pendientes] pedidos:', e.message);
    }
    let tickets = null;
    try {
        const atorados = (await ticketsAtorados({ ahora, modelo: modelos.tickets })).map((t) => formaTicket(t, ahora));
        const { sinSubir, masDe7Dias } = await contarTicketsSinSubir({ ahora, modelo: modelos.tickets });
        tickets = {
            sinSubir,                 // todos los de 1 h a 7 días, sin tope (la lista trae los 50 más viejos)
            masDe7Dias,               // ya no se reintentan solos
            lista: atorados,
            porDia: await ticketsPorDia({ dias: 7, ahora, modelo: modelos.tickets })
        };
        if (masDe7Dias) {
            avisos.push(`${masDe7Dias} ${masDe7Dias === 1 ? 'ticket de salida lleva' : 'tickets de salida llevan'} más de 7 días sin llegar a Drive y ya no se reintentan solos`);
        }
    } catch (e) {
        avisos.push('No se pudieron leer los tickets de salida a Drive');
        console.error('[pendientes] tickets:', e.message);
    }
    // Lo que el seguimiento intentó avisar y no salió (piezas «pedidos» y «encargado»): se dice, no se calla.
    let avisosNoSalieron = null;
    try {
        const [recordatorio, encargado, resumen] = await Promise.all([
            leerJson(CLAVE_RECORDATORIO_NO_SALIO, cfg), leerJson(CLAVE_AVISOS_ENCARGADO, cfg), leerJson(CLAVE_RESUMEN, cfg)
        ]);
        const hace24 = new Date(ahora.getTime() - DIA_MS).toISOString();
        const alEncargado = Array.isArray(encargado?.lista) ? encargado.lista : [];
        // El resumen de las 8:00 que no salió (y no ha salido ese día): vuelta 1, antes solo quedaba en el log.
        const resumenNoSalio = resumen?.noSalio?.cuando && resumen.enviado !== resumen.noSalio.dia ? resumen.noSalio : null;
        avisosNoSalieron = { recordatorioAlmacen: recordatorio?.cuando ? recordatorio : null, alEncargado, resumenDiario: resumenNoSalio };
        if (resumenNoSalio && resumenNoSalio.cuando >= hace24) {
            const deHoy = resumenNoSalio.dia === hoyMexico(ahora);
            avisos.push(`El resumen de las 8:00 al administrador ${deHoy ? 'de hoy' : `del ${diaCorto(resumenNoSalio.dia)}`} no salió ` +
                `(${resumenNoSalio.intentos} ${resumenNoSalio.intentos === 1 ? 'intento' : 'intentos'}): ${resumenNoSalio.motivo}` +
                (deHoy ? '. Se reintenta cada hora hasta las 18:00' : ''));
        }
        if (recordatorio?.cuando >= hace24) {
            avisos.push(recordatorio.salioPor
                ? `El recordatorio a Almacén de las ${horaMexico(recordatorio.cuando)} salió solo por ${recordatorio.salioPor === 'campana' ? 'la campana' : 'WhatsApp'}: ${recordatorio.motivo}`
                : `El recordatorio a Almacén de las ${horaMexico(recordatorio.cuando)} no salió (ni WhatsApp ni campana): ${recordatorio.motivo}. Se reintenta cada hora`);
        }
        const recientes = alEncargado.filter((a) => a?.cuando >= hace24);
        if (recientes.length) {
            avisos.push(`${recientes.length} ${recientes.length === 1 ? 'aviso a un encargado no salió' : 'avisos a encargados no salieron'} por WhatsApp en las últimas 24 h (el último: ${nombreBonito(recientes[0].encargado)}, ${recientes[0].respuesta})`);
        }
    } catch (e) {
        avisos.push('No se pudo revisar si los avisos del seguimiento salieron');
        console.error('[pendientes] avisos que no salieron:', e.message);
    }
    let calendario = null;
    try {
        const c = await leerCeldasNoEntendidas({ ahora, cfg });
        calendario = { celdasNoEntendidas: c.celdas.length, revisadoEl: c.revisadoEl, alDia: c.alDia, lista: c.celdas };
        if (!c.alDia) avisos.push('La lista de celdas del calendario no es de hoy: la lectura del calendario no ha corrido hoy');
        // Vuelta 1: qué obras cambiarían de fecha al mover CALENDARIO_VOCABULARIO_UNICO. Se revisa ANTES de encenderla.
        try {
            const vista = await leerJson(CLAVE_VISTA_PREVIA, cfg);
            if (vista) {
                calendario.alCambiarVocabulario = {
                    hoyEsta: vista.encendida ? 'encendida' : 'apagada',
                    revisadoEl: vista.dia || null,
                    obrasQueCambian: Number(vista.total) || 0,
                    lista: (Array.isArray(vista.obras) ? vista.obras : []).slice(0, MAX_LISTA)
                        .map((o) => ({ id: o.id, proyecto: corto(o.proyecto, 120), ahora: o.ahora || null, conLaOtraRegla: o.conLaOtraRegla || null }))
                };
            }
        } catch (e) {
            avisos.push('No se pudo leer qué obras cambiarían de fecha con CALENDARIO_VOCABULARIO_UNICO');
            console.error('[pendientes] vista previa del vocabulario:', e.message);
        }
    } catch (e) {
        avisos.push('No se pudo leer la lista de celdas del calendario');
        console.error('[pendientes] calendario:', e.message);
    }
    return {
        sistema: 'planta',
        generado: isoMexico(ahora),
        pedidos,
        tickets,
        calendario,
        avisosNoSalieron,
        banderas: { PLANTA_SEGUIMIENTO: [...piezasSeguimiento(env)], CALENDARIO_VOCABULARIO_UNICO: vocabularioUnico() },
        avisos
    };
};

/** El resumen de las 8:00 al administrador. Puro: recibe lo que armó pendientesDePlanta. */
export const textoResumen = (p, { ahora = new Date() } = {}) => {
    const ayer = hoyMexico(new Date(ahora.getTime() - DIA_MS));
    const partes = [];
    if (p.calendario) {
        partes.push(p.calendario.celdasNoEntendidas
            ? `${p.calendario.celdasNoEntendidas} ${p.calendario.celdasNoEntendidas === 1 ? 'celda' : 'celdas'} del calendario sin entender: ${p.calendario.lista.slice(0, 5).map((c) => `«${corto(c.celda, 50)}» (${c.motivos[0]})`).join('; ')}`
            : 'Calendario: todas las celdas se entienden');
    }
    if (p.pedidos) {
        const v = p.pedidos.lista.filter((x) => x.vencido);
        partes.push(v.length
            ? `${v.length} ${v.length === 1 ? 'pedido de encargado vencido' : 'pedidos de encargados vencidos'}: ${v.slice(0, 5).map((x) => `${nombreBonito(x.encargado)} «${corto(x.texto, 40)}»`).join('; ')}`
            : `Pedidos de encargados: ${p.pedidos.porAtender} por atender, ninguno vencido`);
    }
    if (p.tickets) {
        const deAyer = p.tickets.porDia.find((d) => d.dia === ayer);
        partes.push(`${p.tickets.sinSubir} ${p.tickets.sinSubir === 1 ? 'ticket de salida' : 'tickets de salida'} sin llegar a Drive` +
            (deAyer ? ` · ayer: ${deAyer.subidos} subidos de ${deAyer.ordenes} órdenes` : ''));
    }
    for (const a of p.avisos || []) partes.push(`⚠️ ${a}`);
    return partes.join(' · ');
};

/**
 * Pieza «resumen»: campana (y push) al administrador a las 8:00. Corre cada hora de 8:00 a 18:00 (agendaPlanta), pero
 * sale una vez al día: si ya salió hoy, no hace nada. Si no sale (vuelta 1), queda anotado en `configuracion` con su
 * motivo, la puerta lo dice en `avisos` y se reintenta en la siguiente hora. Antes se perdía con un console.error.
 * Nunca lanza.
 */
export const enviarResumenDiario = async ({ ahora = new Date(), env = process.env, notificar = notificarPorOmision, armar = pendientesDePlanta, cfg = null } = {}) => {
    if (!seguimientoEncendido('resumen', env)) return { enviado: false, apagada: true };
    const hoy = hoyMexico(ahora);
    let estado = {};
    try {
        estado = (await leerJson(CLAVE_RESUMEN, cfg)) || {};
    } catch (e) {
        // Sin saber si ya salió, se intenta: mejor uno de más que ninguno.
        console.error('⚠️ No se pudo leer si el resumen de hoy ya salió:', e.message);
    }
    if (estado.enviado === hoy) return { enviado: false, yaSalio: true };
    const reintento = estado.noSalio?.dia === hoy;
    try {
        const p = await armar({ ahora, env, cfg });
        const urgente = (p.calendario?.celdasNoEntendidas || 0) + (p.pedidos?.vencidos || 0) + (p.tickets?.sinSubir || 0) + (p.avisos?.length || 0);
        await notificar({
            roles: ['administrador'],
            tipo: 'pedido_pendiente',
            titulo: urgente ? `Pendientes de Planta (${urgente})` : 'Pendientes de Planta: todo al día',
            mensaje: textoResumen(p, { ahora }),
            url: '/pedidos-encargados',
            datos_adicionales: { resumen_planta: hoy }
        });
        try {
            // El fallo de un día anterior se conserva (la puerta lo dice 24 h); el de hoy ya se resolvió.
            await guardarJson(CLAVE_RESUMEN, { enviado: hoy, noSalio: reintento ? null : estado.noSalio || null }, 'Resumen de las 8:00 de Planta: día en que salió y el último que no salió (PLANTA_SEGUIMIENTO)', cfg);
        } catch (e) {
            console.error('⚠️ El resumen de Planta salió, pero no se pudo anotar (puede repetirse en la siguiente hora):', e.message);
        }
        if (reintento) console.log(`⏰ Resumen de Planta: salió al reintentar (antes ${estado.noSalio.intentos} intento(s) sin salir)`);
        return { enviado: true, urgente, reintento };
    } catch (e) {
        const intentos = reintento ? (Number(estado.noSalio.intentos) || 0) + 1 : 1;
        console.error(`⚠️ El resumen de las 8:00 de Planta no salió (intento ${intentos}): ${e.message}. Se reintenta cada hora hasta las 18:00`);
        try {
            await guardarJson(CLAVE_RESUMEN, { enviado: estado.enviado || null, noSalio: { dia: hoy, cuando: ahora.toISOString(), intentos, motivo: corto(e.message, 200) } },
                'Resumen de las 8:00 de Planta: día en que salió y el último que no salió (PLANTA_SEGUIMIENTO)', cfg);
        } catch (e2) {
            console.error('⚠️ Tampoco se pudo anotar que el resumen no salió:', e2.message);
        }
        return { enviado: false, error: e.message, intentos };
    }
};

// ---------- Programación (cronJobs.js la arranca; la hora sale de la agenda) ----------
export const iniciarSeguimientoPlanta = async () => {
    const { default: cron } = await import('node-cron');
    const { cronDe, anotarCorrida } = await import('../utils/agendaPlanta.js');
    const zona = { timezone: 'America/Mexico_City' };
    cron.schedule(cronDe('pla-seguimiento-resumen'), async () => {
        if (!seguimientoEncendido('resumen')) return;
        // Corre cada hora de 8:00 a 18:00, pero solo la primera que sale cuenta (las demás son el reintento).
        const r = await enviarResumenDiario();
        if (!r.yaSalio) anotarCorrida('pla-seguimiento-resumen');
    }, zona);
    cron.schedule(cronDe('pla-seguimiento-pedidos'), async () => {
        if (!seguimientoEncendido('pedidos')) return;
        anotarCorrida('pla-seguimiento-pedidos');
        await recordarPedidos();
    }, zona);
    cron.schedule(cronDe('pla-seguimiento-tickets'), async () => {
        if (!seguimientoEncendido('tickets')) return;
        anotarCorrida('pla-seguimiento-tickets');
        await alertarTicketsAtorados();
    }, zona);
    const piezas = [...piezasSeguimiento()];
    console.log(`⏰ Seguimiento de Planta: ${piezas.length ? piezas.join(', ') : 'apagado (PLANTA_SEGUIMIENTO)'}`);
};

export default {
    piezasSeguimiento, seguimientoEncendido, recordarPedidos, avisarRespuestaAlEncargado, anotarAvisoNoSalio, alertarTicketsAtorados,
    contarTicketsSinSubir, ticketsPorDia, pendientesDePlanta, enviarResumenDiario, iniciarSeguimientoPlanta
};
