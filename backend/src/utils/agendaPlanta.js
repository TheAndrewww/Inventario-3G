/**
 * Agenda de los avisos que Planta manda solo (D3 paso 2 · PLA-13): GET /api/inicio3g/v1/agenda.
 *
 * Es el registro que ENVUELVE los programadores de Planta: cronJobs.js toma de aquí la hora de cada tarea (cronDe) y
 * cada tarea y cada trabajo de jobs/ anota aquí cuándo corrió (anotarCorrida). Así la lista no se desfasa del código.
 * Forma del contrato del Inicio v2 §2.4: { id, nombre, cuando: { cron, zona, texto }, repite, linea, firma, destino,
 * interruptor: { variable, encendido } | null, silencio, ultimaVez, proximaVez }. Los ids de los que ya estaban en la
 * foto fechada del Inicio (datos/agenda.js) son los mismos. Destinos por su papel, nunca teléfonos ni ids de grupo.
 */
import { isoMexico } from './revisarConfig.js';

const ZONA = 'America/Mexico_City';

export const ENVIOS = [
    {
        id: 'pla-cierre-conteos', nombre: 'Cierre de ventanas de conteo de recepción',
        cron: '0 8 * * *', texto: '8:00, todos los días', linea: 'contable', firma: 'Avisos de Planta', destino: 'Grupo Requisiciones',
        silencio: 'Solo si hay ventanas que cerrar'
    },
    {
        id: 'pla-resumen-ordenes-0800', nombre: 'Resumen de órdenes de compra por autorizar (correo)',
        cron: '0 8 * * 1-6', texto: '8:00, lunes a sábado', linea: 'correo', firma: '3G Inventario', destino: 'Dirección (correo)',
        interruptor: 'OC_CORREO_MODO', silencio: 'Domingo no; solo si hay órdenes por autorizar'
    },
    {
        id: 'pla-cancelacion-0815', nombre: 'Aviso del día antes y cancelación de órdenes de compra viejas',
        cron: '15 8 * * 1-6', texto: '8:15, lunes a sábado', linea: 'contable', firma: 'Avisos de Planta', destino: 'Grupo Compras',
        interruptor: 'CANCELACION_PROGRAMADA', silencio: 'Domingo no; solo si hay órdenes por vencer'
    },
    {
        id: 'pla-barrido-0830', nombre: 'Barrido de compras (stock mínimo y salidas previstas)',
        cron: '30 8 * * 1-6', texto: '8:30, lunes a sábado (y al nacer una solicitud)', linea: 'contable', firma: 'Avisos de Planta',
        destino: 'Grupo Compras', silencio: 'Domingo no; solo si encontró algo nuevo'
    },
    {
        id: 'pla-corte-conteos', nombre: 'Corte semanal de conteos cíclicos',
        cron: '0 9 * * 6', texto: 'Sábado 9:00', linea: 'contable', firma: 'Avisos de Planta', destino: 'Grupo Requisiciones',
        silencio: null
    },
    {
        id: 'pla-calendario-5min', nombre: 'Lectura del calendario de instalaciones (avisa cambios y adelantos a Producción)',
        cron: null, texto: 'Cada 5 minutos', cadaMs: 5 * 60000, linea: 'contable',
        firma: 'Avisos de Planta', destino: 'Grupo Producción', interruptor: 'HORARIO_AVISOS', silencio: 'cola'
    },
    {
        id: 'pla-drive-10min', nombre: 'Revisión de las carpetas de Drive de cada proyecto (planos y tickets nuevos a Producción)',
        cron: null, texto: 'Cada 10 minutos', cadaMs: 10 * 60000, linea: 'contable',
        firma: 'Avisos de Planta', destino: 'Grupo Producción', interruptor: 'HORARIO_AVISOS', silencio: 'cola'
    },
    {
        id: 'pla-correo-orden', nombre: 'Correo de cada orden por autorizar («Aprobar» y «Rechazar»)',
        cron: null, texto: 'Al pedir la autorización de una orden', linea: 'correo', firma: '3G Inventario', destino: 'Dirección (correo)',
        interruptor: 'OC_CORREO_MODO_APROBAR', silencio: null
    },
    {
        id: 'pla-avisos-cola', nombre: 'Avisos de Planta: órdenes por autorizar, material que llegó, etapas y cambios de fecha',
        cron: null, texto: 'Al momento (Julia revisa la cola de Planta cada minuto)', linea: 'contable', firma: 'Avisos de Planta',
        destino: 'Grupos Compras, Requisiciones y Producción', interruptor: 'HORARIO_AVISOS', silencio: 'cola'
    }
];

/** La hora de una tarea, para que cronJobs.js la programe con la misma expresión que publica la agenda. */
export const cronDe = (id) => {
    const e = ENVIOS.find((x) => x.id === id);
    if (!e || !e.cron) throw new Error(`Envío sin hora en la agenda: ${id}`);
    return e.cron;
};

// Última corrida de cada envío (en memoria: empieza vacía al reiniciar; «null» = no se sabe).
const corridas = new Map();
export const anotarCorrida = (id, cuando = new Date()) => { corridas.set(id, cuando); };

// ---------- Siguiente ejecución de una expresión cron simple (minuto hora día mes día-de-semana), hora de México ----------
const campo = (texto, min, max) => {
    const s = new Set();
    for (const parte of String(texto).split(',')) {
        const [rango, paso] = parte.split('/');
        const [a, b] = rango === '*' ? [min, max] : rango.split('-').map(Number);
        for (let i = a; i <= (b ?? a); i += Number(paso || 1)) s.add(i === 7 && max === 6 ? 0 : i);
    }
    return s;
};
// México no tiene horario de verano desde 2022: UTC-6 todo el año.
export const siguienteEjecucion = (cron, desde = new Date()) => {
    if (!cron) return null;
    const [m, h, dm, mes, ds] = cron.trim().split(/\s+/);
    const M = campo(m, 0, 59), H = campo(h, 0, 23), DM = campo(dm, 1, 31), MES = campo(mes, 1, 12), DS = campo(ds, 0, 6);
    const local = new Date(desde.getTime() - 6 * 3600000); // reloj de México expresado en UTC
    for (let dia = 0; dia <= 366; dia++) {
        const f = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dia));
        if (!MES.has(f.getUTCMonth() + 1) || !DM.has(f.getUTCDate()) || !DS.has(f.getUTCDay())) continue;
        for (const hh of [...H].sort((x, y) => x - y)) {
            for (const mm of [...M].sort((x, y) => x - y)) {
                const t = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), hh, mm) + 6 * 3600000);
                if (t > desde) return t;
            }
        }
    }
    return null;
};

/** La agenda en vivo, con el estado real de los interruptores. */
export const agendaPlanta = async ({ ahora = new Date() } = {}) => {
    const { ventanaAvisos, textoVentana } = await import('./horarioAvisos.js');
    const { modoCorreoOrdenes } = await import('../services/email.service.js');
    const { cancelacionProgramadaEncendida } = await import('../controllers/ordenesCompra.controller.js');
    const ventana = ventanaAvisos();
    const modo = modoCorreoOrdenes();
    // Último aviso que Julia publicó de la cola (dato real de la base); si falla, «no se sabe».
    let ultimoDeLaCola = null;
    try {
        const { AvisoWhatsApp } = await import('../models/index.js');
        const a = await AvisoWhatsApp.findOne({ where: { estado: 'enviado' }, attributes: ['enviado_at'], order: [['enviado_at', 'DESC']] });
        ultimoDeLaCola = a?.enviado_at || null;
    } catch { /* sin dato */ }

    const interruptor = (nombre) => {
        if (nombre === 'HORARIO_AVISOS') return { variable: 'HORARIO_AVISOS', encendido: !!ventana };
        if (nombre === 'OC_CORREO_MODO') return { variable: 'OC_CORREO_MODO', encendido: modo === 'resumen' };
        if (nombre === 'OC_CORREO_MODO_APROBAR') return { variable: 'OC_CORREO_MODO', encendido: modo === 'aprobar' };
        if (nombre === 'CANCELACION_PROGRAMADA') return { variable: 'CANCELACION_PROGRAMADA', encendido: cancelacionProgramadaEncendida() };
        return null;
    };
    const silencioCola = ventana
        ? `Solo ${textoVentana(ventana)}: lo de la noche y del domingo sale al abrir (lo urgente pasa)`
        : 'Hoy ninguna: sale también de noche y en domingo';

    const envios = ENVIOS.map((e) => {
        const ultima = e.id === 'pla-avisos-cola' ? ultimoDeLaCola : (corridas.get(e.id) || null);
        let proxima = e.cron ? siguienteEjecucion(e.cron, ahora) : null;
        if (!proxima && e.cadaMs && ultima) proxima = new Date(new Date(ultima).getTime() + e.cadaMs);
        return {
            id: e.id,
            nombre: e.nombre,
            cuando: { cron: e.cron || null, zona: e.cron ? ZONA : null, texto: e.texto },
            repite: e.repite || null,
            linea: e.linea,
            firma: e.firma,
            destino: e.destino,
            interruptor: e.interruptor ? interruptor(e.interruptor) : null,
            silencio: e.silencio === 'cola' ? silencioCola : (e.silencio || null),
            ultimaVez: ultima ? isoMexico(new Date(ultima)) : null,
            proximaVez: proxima ? isoMexico(proxima) : null
        };
    });
    return { sistema: 'planta', generado: isoMexico(ahora), envios };
};
