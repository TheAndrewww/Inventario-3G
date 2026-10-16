/**
 * C1 · PLA-19 — El ID 3G en Planta (contrato §7.4 del plan final; plan A-B-C-D §4.2).
 *
 * El ID 3G («3G-AA-NNNN») lo genera SOLO Operación (OPE-10) y lo escribe en el libro de obras, en la columna cuyo
 * encabezado es exactamente «ID 3G». Planta solo lo LEE y lo guarda como DATO (nunca como llave: la llave «MES_fila»
 * de la sincronización no se toca, guarda de A3):
 *
 *   1. La sincronización de producción (produccionSheets.service.js) lee la pestaña hasta la última columna con
 *      encabezado y busca «ID 3G» por su nombre, en cualquier posición; lo de B a K se sigue leyendo igual.
 *   2. Lo guarda en `produccion_proyectos.obra_id` (nunca pisa un ID distinto ni lo borra).
 *   3. Cada ticket nuevo de un proyecto lo copia en `movimientos.obra_id`.
 *   4. La anulación automática al cerrar una obra (A6) busca primero por ID y, si el ticket no lo trae, por nombre.
 *
 * Todo detrás de la bandera EMPATE_POR_OBRA (apagada por omisión = comportamiento de hoy: la misma lectura B6:K200,
 * nada se guarda ni se copia y la anulación es por nombre). El ensayo (GET /api/admin/ensayo-id3g) siempre funciona
 * y solo lee: dice si se puede encender.
 *
 * Las dos columnas `obra_id` van FUERA de los modelos (como `pronostico_whatsapp` de PLA-17): el JSON de proyectos y
 * tickets no cambia; solo el tablero suma `obra_id` en los proyectos que ya lo tienen. Se crean al arrancar con
 * ADD COLUMN IF NOT EXISTS (server.js).
 */
import { sequelize } from '../config/database.js';

export const BANDERA_EMPATE_OBRA = 'EMPATE_POR_OBRA';
const SI = new Set(['1', 'true', 'si', 'sí', 'on', 'encendida']);
export const empatePorObra = () => SI.has(String(process.env[BANDERA_EMPATE_OBRA] ?? '').trim().toLowerCase());

/** Formato del contrato: 3G-AA-NNNN (el consecutivo crece a 5 dígitos si un año pasa de 9 999). */
export const ES_ID3G = /^3G-\d{2}-\d{4,5}$/;
export const ENCABEZADO_ID3G = 'ID 3G';
/** Los encabezados se buscan en los primeros 8 renglones, igual que Operación (OPE-10), para que los dos vean la misma columna. */
export const RENGLONES_ENCABEZADO = 8;

/** La celda trae un ID 3G válido → el ID; si no, null. */
export const idDeCelda = (v) => {
    const t = String(v ?? '').trim();
    return ES_ID3G.test(t) ? t : null;
};

/** Letra de columna (0 → A, 25 → Z, 26 → AA). */
export const letraColumna = (i) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
};

/**
 * La columna «ID 3G» de una pestaña (valores desde A1), por su encabezado EXACTO en los primeros 8 renglones; nunca por
 * posición. «ID 3G (ancla)» (la del Índice contable) no cuenta. Dos columnas distintas con ese encabezado = no se lee
 * ninguna (motivo «varias»).
 */
export const columnaId3G = (valores = []) => {
    const hallazgos = new Set();
    for (let r = 0; r < Math.min(RENGLONES_ENCABEZADO, valores.length); r++) {
        (valores[r] || []).forEach((c, j) => { if (String(c ?? '').trim() === ENCABEZADO_ID3G) hallazgos.add(j); });
    }
    if (!hallazgos.size) return { col: null, motivo: 'sin-columna' };
    if (hallazgos.size > 1) return { col: null, motivo: 'varias', letras: [...hallazgos].map(letraColumna) };
    const col = [...hallazgos][0];
    return { col, letra: letraColumna(col) };
};

/** Última columna con encabezado (renglones 1 a 8), para decir hasta dónde llega la lectura. */
export const ultimaColumnaConEncabezado = (valores = []) => {
    let ultima = -1;
    for (let r = 0; r < Math.min(RENGLONES_ENCABEZADO, valores.length); r++) {
        (valores[r] || []).forEach((c, j) => { if (String(c ?? '').trim() && j > ultima) ultima = j; });
    }
    return ultima;
};

/**
 * Renglones B..K a partir de la lectura ancha (desde A1). Deja cada renglón EXACTAMENTE como lo da Sheets al pedir
 * `B6:K200`: las columnas B a K y sin las celdas vacías del final (Sheets no las manda). Así la interpretación de
 * siempre recibe lo mismo. `primerRenglon` = 6 (los datos empiezan en el renglón 6).
 */
export const renglonesBK = (valores = [], primerRenglon = 6, ultimoRenglon = 200) => {
    const filas = valores.slice(primerRenglon - 1, ultimoRenglon).map((fila) => {
        const bk = (fila || []).slice(1, 11);
        while (bk.length && (bk[bk.length - 1] === '' || bk[bk.length - 1] === undefined || bk[bk.length - 1] === null)) bk.pop();
        return bk;
    });
    // Sheets tampoco manda los renglones vacíos del final del rango
    while (filas.length && filas[filas.length - 1].length === 0) filas.pop();
    return filas;
};

/**
 * Los IDs de la pestaña por renglón (índice 0 = renglón 6). Un ID repetido en dos renglones de la misma pestaña no se
 * le da a ninguno (conflicto: el ensayo lo reporta). Una celda con algo que no es un ID tampoco.
 */
export const idsPorRenglon = (valores = [], col, primerRenglon = 6, ultimoRenglon = 200) => {
    const ids = [];
    const invalidas = [];
    const vistos = new Map();
    if (col === null || col === undefined) return { ids, invalidas, repetidos: [] };
    valores.slice(primerRenglon - 1, ultimoRenglon).forEach((fila, i) => {
        const celda = String((fila || [])[col] ?? '').trim();
        const id = idDeCelda(celda);
        ids[i] = id;
        if (celda && !id) invalidas.push({ fila: i + primerRenglon, celda: celda.slice(0, 40) });
        if (id) vistos.set(id, [...(vistos.get(id) || []), i]);
    });
    const repetidos = [];
    for (const [id, indices] of vistos) {
        if (indices.length > 1) {
            repetidos.push({ id, filas: indices.map((i) => i + primerRenglon) });
            for (const i of indices) ids[i] = null;
        }
    }
    return { ids, invalidas, repetidos };
};

/* ───────────────────────── base de datos (columnas fuera del modelo) ───────────────────────── */

const consulta = async (sql, replacements = {}, transaction = null) => {
    const [filas] = await sequelize.query(sql, { replacements, transaction });
    return filas;
};

/** Mapa id del proyecto → ID 3G, solo de los que lo tienen. Si la columna aún no existe, mapa vacío. */
export const obraIdsDeProyectos = async (ids = []) => {
    const mapa = new Map();
    if (!ids.length) return mapa;
    try {
        const filas = await consulta('SELECT id, obra_id FROM produccion_proyectos WHERE id IN (:ids) AND obra_id IS NOT NULL', { ids });
        for (const f of filas) mapa.set(f.id, f.obra_id);
    } catch (e) {
        console.error('[ID 3G] no se pudieron leer los ID de los proyectos:', e.message);
    }
    return mapa;
};

/** Los ID ya guardados de una pestaña: spreadsheet_row_id («MES_fila») → ID 3G (para no reescribir cada 5 minutos). */
export const obraIdsDeMes = async (mes) => {
    const filas = await consulta(
        "SELECT spreadsheet_row_id AS fila, obra_id FROM produccion_proyectos WHERE spreadsheet_row_id LIKE :patron AND obra_id IS NOT NULL",
        { patron: `${mes}\\_%` }
    );
    return new Map(filas.map((f) => [f.fila, f.obra_id]));
};

export const obraIdDeProyecto = async (id, transaction = null) => {
    if (!id) return null;
    const filas = await consulta('SELECT obra_id FROM produccion_proyectos WHERE id = :id', { id }, transaction);
    return filas[0]?.obra_id || null;
};

/**
 * Guarda el ID que trae la hoja en el proyecto. Nunca pisa un ID distinto ni lo borra, y no lo guarda si otro
 * proyecto ACTIVO ya tiene ese ID (renglón movido de pestaña: se guarda en la siguiente vuelta, cuando el viejo se
 * desactiva). UPDATE directo: no pasa por los ganchos del modelo ni toca updated_at.
 * Devuelve 'guardado' | 'igual' | 'conflicto' | 'repetido'.
 */
export const guardarObraIdProyecto = async (proyectoId, obraId) => {
    if (!proyectoId || !ES_ID3G.test(String(obraId || ''))) return 'invalido';
    const [, meta] = await sequelize.query(
        `UPDATE produccion_proyectos SET obra_id = :obraId
          WHERE id = :id AND obra_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM produccion_proyectos o WHERE o.obra_id = :obraId AND o.activo = true AND o.id <> :id)`,
        { replacements: { id: proyectoId, obraId } }
    );
    if ((meta?.rowCount ?? 0) > 0) return 'guardado';
    const actual = await obraIdDeProyecto(proyectoId);
    if (actual === obraId) return 'igual';
    return actual ? 'conflicto' : 'repetido';
};

/** Mapa id del ticket → ID 3G, solo de los que lo tienen. */
export const obraIdsDeTickets = async (ids = [], transaction = null) => {
    const mapa = new Map();
    if (!ids.length) return mapa;
    const filas = await consulta('SELECT id, obra_id FROM movimientos WHERE id IN (:ids) AND obra_id IS NOT NULL', { ids }, transaction);
    for (const f of filas) mapa.set(f.id, f.obra_id);
    return mapa;
};

const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const AREAS_FIJAS = ['manufactura', 'herreria'];

/** Obras abiertas en producción (los mismos criterios que getNombresProyectosAbiertos) con su ID. */
const obrasAbiertas = () => consulta(
    `SELECT id, nombre, obra_id FROM produccion_proyectos
      WHERE activo = true AND etapa_actual <> 'completado'
        AND (tipo_proyecto IS NULL OR tipo_proyecto NOT ILIKE 'CANCELADO%')`
);

/**
 * Qué ID le tocaría a un ticket del proyecto «nombre»: el de las obras abiertas con ESE nombre (si no hay ninguna, las
 * que empatan con la regla de siempre). Solo si todas comparten un mismo ID; si hay dos obras con el nombre y IDs
 * distintos, o alguna sin ID, no se copia nada (el ticket se anulará por nombre, como hoy).
 */
export const idParaTicket = (nombre, obras, mismosProyectos) => {
    const n = normalizar(nombre);
    if (!n || AREAS_FIJAS.includes(n)) return { obraId: null, motivo: 'sin-obra' };
    let candidatas = obras.filter((o) => normalizar(o.nombre) === n);
    if (!candidatas.length) candidatas = obras.filter((o) => mismosProyectos(o.nombre, nombre));
    if (!candidatas.length) return { obraId: null, motivo: 'sin-obra' };
    const ids = new Set(candidatas.map((o) => o.obra_id || null));
    if (ids.size === 1 && !ids.has(null)) return { obraId: [...ids][0], motivo: 'copiado' };
    return { obraId: null, motivo: ids.has(null) && ids.size === 1 ? 'obra-sin-id' : 'ambiguo', obras: candidatas.length };
};

/**
 * Ticket nuevo copia el ID de su obra (con EMPATE_POR_OBRA). Se llama DESPUÉS de guardar el ticket y nunca lanza: si
 * algo falla, el ticket queda sin ID y se anulará por nombre, como hoy.
 */
export const copiarObraIdAlTicket = async (movimientoId, proyectoNombre) => {
    if (!empatePorObra() || !movimientoId || !proyectoNombre) return null;
    try {
        const { mismosProyectos } = await import('./pedidosCleanup.service.js');
        const r = idParaTicket(proyectoNombre, await obrasAbiertas(), mismosProyectos);
        if (!r.obraId) return r;
        await sequelize.query('UPDATE movimientos SET obra_id = :obraId WHERE id = :id AND obra_id IS NULL', { replacements: { id: movimientoId, obraId: r.obraId } });
        return r;
    } catch (e) {
        console.error('[ID 3G] el ticket quedó sin ID (se anulará por nombre):', e.message);
        return null;
    }
};

/**
 * La regla de la anulación con ID (A6 con EMPATE_POR_OBRA): un ticket que trae ID se empata solo por ID; uno que no lo
 * trae, por nombre (la regla de siempre). Así, al cerrar una obra no se anulan los tickets de OTRA obra con el mismo
 * nombre (homónimos, mantenimientos y garantías de un mismo cliente).
 */
export const ticketEsDeLaObra = ({ ticketObraId, ticketProyecto, obraId, proyectoNombre, mismosProyectos }) =>
    (ticketObraId ? ticketObraId === obraId : mismosProyectos(ticketProyecto, proyectoNombre));

/* ───────────────────────── ensayo (solo lectura) ───────────────────────── */

/**
 * GET /api/admin/ensayo-id3g (administración). Lee el libro como lo haría la sincronización con la bandera, lo compara
 * con la lectura de hoy (B6:K200), y dice qué guardaría, qué tickets copiarían su ID y qué cambiaría al cerrar cada obra
 * abierta. No escribe nada (ni en la hoja ni en la base). `limpio` = se puede encender.
 */
export const ensayoId3g = async ({ leerHoja, meses, ahora = new Date() } = {}) => {
    const { mismosProyectos } = await import('./pedidosCleanup.service.js');
    const motivos = [];
    const hoja = [];
    const idsHoja = new Map(); // id → [{mes, fila, rowId}]
    const porRowId = new Map(); // spreadsheet_row_id → id de la hoja

    for (const mes of meses) {
        let r;
        try { r = await leerHoja(mes); } catch (e) {
            const estado = /no existe/.test(e.message) ? 'sin-pestana' : 'error';
            hoja.push({ mes, estado, detalle: e.message.slice(0, 160) });
            // Una pestaña que no se pudo leer no está «limpia»: con la bandera, ese error cortaría la sincronización.
            if (estado === 'error') motivos.push(`${mes}: no se pudo leer la pestaña (${e.message.slice(0, 80)})`);
            continue;
        }
        const col = r.id3g || { columna: null, motivo: 'sin-columna' };
        const conId = r.proyectos.filter((p) => p.obraId).length;
        const fila = {
            mes,
            estado: col.columna ? 'ok' : col.motivo,
            columna: col.columna || null,
            ...(col.columnas ? { columnas: col.columnas } : {}),
            hastaColumna: r.hastaColumna || null,
            proyectos: r.proyectos.length,
            conId,
            sinId: r.proyectos.length - conId,
            celdasInvalidas: r.invalidas || [],
            repetidos: r.repetidos || [],
            lecturaBK: r.bkIgual ? 'igual' : 'distinta',
            ...(r.bkIgual ? {} : { diferenciasBK: r.diferenciasBK })
        };
        if (!r.bkIgual) motivos.push(`${mes}: la lectura de B a K no salió igual a la de hoy`);
        if (col.motivo === 'varias') motivos.push(`${mes}: hay más de una columna «ID 3G»`);
        if (fila.celdasInvalidas.length) motivos.push(`${mes}: ${fila.celdasInvalidas.length} celda(s) «ID 3G» con algo que no es un ID`);
        if (fila.repetidos.length) motivos.push(`${mes}: ${fila.repetidos.length} ID repetido(s) en la pestaña`);
        for (const p of r.proyectos) {
            if (!p.obraId) continue;
            idsHoja.set(p.obraId, [...(idsHoja.get(p.obraId) || []), { mes, fila: p.filaOriginal, nombre: p.nombre }]);
            porRowId.set(p.spreadsheetRowId, p.obraId);
        }
        hoja.push(fila);
    }
    const entreMeses = [...idsHoja].filter(([, v]) => v.length > 1).map(([id, v]) => ({ id, renglones: v.map((x) => `${x.mes} ${x.fila}`) }));
    if (entreMeses.length) motivos.push(`${entreMeses.length} ID que aparecen en más de una pestaña`);

    // Proyectos de la base: qué guardaría la sincronización
    const proyectos = await consulta('SELECT id, nombre, spreadsheet_row_id, obra_id, activo FROM produccion_proyectos WHERE spreadsheet_row_id IS NOT NULL');
    const conIdGuardado = await consulta('SELECT id, nombre, obra_id FROM produccion_proyectos WHERE obra_id IS NOT NULL AND activo = true');
    const conflictos = [];
    let porGuardar = 0, yaGuardados = 0;
    for (const p of proyectos) {
        const enHoja = porRowId.get(p.spreadsheet_row_id);
        if (!enHoja) continue;
        if (p.obra_id === enHoja) { yaGuardados++; continue; }
        if (p.obra_id) { conflictos.push({ proyecto: p.nombre, renglon: p.spreadsheet_row_id, guardado: p.obra_id, enHoja, motivo: 'el proyecto ya tiene otro ID' }); continue; }
        const otro = conIdGuardado.find((o) => o.obra_id === enHoja && o.id !== p.id);
        if (otro) conflictos.push({ proyecto: p.nombre, renglon: p.spreadsheet_row_id, enHoja, motivo: `otro proyecto activo ya tiene ese ID («${otro.nombre}»)` });
        else porGuardar++;
    }
    if (conflictos.length) motivos.push(`${conflictos.length} proyecto(s) cuyo ID de la hoja no se guardaría (ya tienen otro, u otra obra activa tiene ese ID)`);

    // Tickets abiertos: cuáles traen ID y qué ID copiaría hoy uno nuevo de cada obra
    const { Movimiento } = await import('../models/index.js');
    const { Op } = await import('sequelize');
    const abiertos = await Movimiento.findAll({
        where: { tipo: 'pedido', estado: { [Op.in]: ['pendiente', 'pendiente_aprobacion', 'aprobado', 'listo_para_entrega'] } },
        attributes: ['id', 'ticket_id', 'proyecto']
    });
    const idsTickets = await obraIdsDeTickets(abiertos.map((t) => t.id));
    const obras = await obrasAbiertas();
    // Con los ID que la sincronización guardaría (la hoja manda si el proyecto aún no lo tiene)
    const rowIdDe = new Map(proyectos.map((p) => [p.id, p.spreadsheet_row_id]));
    const obrasConHoja = obras.map((o) => ({ ...o, obra_id: o.obra_id || porRowId.get(rowIdDe.get(o.id)) || null }));
    const copia = { copiarian: 0, obraSinId: 0, ambiguos: [] };
    const nombresVistos = new Set();
    for (const t of abiertos) {
        if (!t.proyecto || nombresVistos.has(normalizar(t.proyecto))) continue;
        nombresVistos.add(normalizar(t.proyecto));
        const r = idParaTicket(t.proyecto, obrasConHoja, mismosProyectos);
        if (r.motivo === 'copiado') copia.copiarian++;
        else if (r.motivo === 'obra-sin-id') copia.obraSinId++;
        else if (r.motivo === 'ambiguo') copia.ambiguos.push({ proyecto: t.proyecto, obras: r.obras });
    }

    // Cierre: por cada obra abierta con ID, qué tickets anularía hoy (por nombre) y cuáles con la regla nueva:
    // (a) con los ID que los tickets traen hoy y (b) si cada ticket abierto trajera el ID que copiaría uno nuevo
    // (lo que pasará con los tickets que se hagan con la bandera encendida).
    const simulado = new Map(abiertos.map((t) => [t.id, idsTickets.get(t.id) || idParaTicket(t.proyecto, obrasConHoja, mismosProyectos).obraId]));
    const diferencias = (idsDe) => {
        const lista = [];
        for (const o of obrasConHoja.filter((x) => x.obra_id)) {
            const hoy = abiertos.filter((t) => mismosProyectos(t.proyecto, o.nombre)).map((t) => t.ticket_id);
            const nueva = abiertos.filter((t) => ticketEsDeLaObra({ ticketObraId: idsDe.get(t.id), ticketProyecto: t.proyecto, obraId: o.obra_id, proyectoNombre: o.nombre, mismosProyectos })).map((t) => t.ticket_id);
            const igual = hoy.length === nueva.length && hoy.every((x) => nueva.includes(x));
            if (!igual) lista.push({ obra: o.nombre, id: o.obra_id, hoyAnularia: hoy, conIdAnularia: nueva });
        }
        return lista;
    };
    const cierre = diferencias(idsTickets);
    const cierreConTicketsNuevos = diferencias(simulado);

    return {
        soloLectura: true,
        generado: ahora.toISOString(),
        bandera: { nombre: BANDERA_EMPATE_OBRA, encendida: empatePorObra() },
        limpio: motivos.length === 0,
        motivos,
        hoja: { meses: hoja, idsEnVariasPestanas: entreMeses },
        proyectos: { conIdEnLaHoja: porRowId.size, yaGuardados, porGuardar, conflictos },
        tickets: {
            abiertos: abiertos.length,
            conId: idsTickets.size,
            sinId: abiertos.length - idsTickets.size,
            ticketNuevoCopiaria: copia
        },
        cierreCambiaria: cierre,
        cierreCambiariaConTicketsNuevos: cierreConTicketsNuevos
    };
};
