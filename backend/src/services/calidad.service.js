/**
 * Panel de calidad (28-oct-2026, «3G Calidad»): la hoja de control de calidad de cada obra, su aval como cierre de
 * producción y el camino de «repintar» (un defecto reabre la subetapa de su hoja).
 *
 * Todo lo de aquí corre solo con PANEL_CALIDAD encendida (las rutas responden 404 sin ella). Las dos banderas que mueven
 * producción se revisan aquí mismo:
 *   - CALIDAD_AVAL_CIERRA: calidadDetieneCierre() dice si una obra que terminó Manufactura y Herrería debe esperar el aval
 *     (la usan ProduccionProyecto.completarSubEtapaProduccion, toggleEtapa y la sincronización del Excel). Apagada
 *     contesta false sin tocar la base: el cierre automático de hoy no cambia. El aval pasa la obra a «Preparado» con la
 *     lógica de siempre (ProduccionProyecto.marcarPreparado, la misma del «Preparado» manual) y el mismo aviso.
 *   - CALIDAD_DEFECTO_REABRE: un defecto que NO sale así reabre la subetapa de su hoja (reabrirPorDefecto).
 *
 * La obra se identifica por proyectoId (cambia si se mueve el renglón del Excel) o por su ID 3G (estable). ligarHoja
 * busca primero por ID 3G, luego por proyecto_id con el mismo nombre y, si el id cambió, vuelve a ligar por nombre
 * exacto (normalizado) y lo anota en la bitácora.
 *
 * La base se usa por medio de `repo` (repoSequelize aquí; en las pruebas, uno en memoria con la misma forma), para que
 * la lógica se pruebe sin Postgres y también contra un Postgres de verdad.
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ProduccionProyecto } from '../models/index.js';
import { CalidadHoja, CalidadPunto, CalidadEvento, CalidadSugerencia } from '../models/Calidad.js';
import {
    CONFIG, VERSION_CONFIG, ESTADOS_PUNTO, puntoDe, tieneAtributos, mezclarAtributos, hojasQueAplican, puntosQueAplican,
    PUNTOS_PINTURA
} from './checklistCalidad.js';
import { panelCalidad, calidadAvalCierra, calidadDefectoReabre } from '../utils/banderasCalidad.js';
import { obraIdsDeProyectos, ES_ID3G } from './obraId.service.js';

const MAX_NOTA = 1000;
const MAX_NOMBRE = 120;
const RE_CAMBIO_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const FUTURO_MS = 5 * 60 * 1000;
export const NOMBRE_POR_OMISION = 'Charly';

/** Error con código HTTP y texto en español (lo convierte la ruta en { error }). */
export class ErrorCalidad extends Error {
    constructor(codigo, texto, extra = {}) {
        super(texto);
        this.codigo = codigo;
        this.extra = extra;
    }
}
const falla = (codigo, texto, extra) => { throw new ErrorCalidad(codigo, texto, extra); };

/** Nombre para comparar: sin acentos, minúsculas, espacios juntos. «Velaría  Parque» = «velaria parque». */
export const claveNombre = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// Cómo se dice cada estado en la bitácora (la que lee la oficina)
const ESTADO_EN_PALABRAS = { pendiente: 'pendiente', ok: 'bien', defecto: 'defecto', na: 'no aplica' };
const textoLimpio = (v, max) => {
    if (v === undefined || v === null) return null;
    const t = String(v).replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : null;
};

// ---------- La base (Sequelize) ----------

// La forma normalizada del nombre en SQL, para buscar proyectos por nombre exacto sin acentos (después se confirma en JS
// con claveNombre). translate cubre las vocales acentuadas del español y la ñ.
const SQL_CLAVE = `btrim(regexp_replace(translate(lower(nombre), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'), '\\s+', ' ', 'g'))`;

export const repoSequelize = {
    async proyectoPorId(id) { return ProduccionProyecto.findByPk(id); },
    async proyectoPorObraId(obraId) {
        const [filas] = await sequelize.query(
            'SELECT id FROM produccion_proyectos WHERE obra_id = :obraId AND activo = true ORDER BY id DESC LIMIT 2',
            { replacements: { obraId } }
        );
        if (filas.length !== 1) return null; // ninguno, o dos activos con el mismo ID (el sync no lo permite): no se adivina
        return ProduccionProyecto.findByPk(filas[0].id);
    },
    async obraIdDe(id) { return (await obraIdsDeProyectos([id])).get(id) || null; },
    async proyectoResumen(id) {
        const p = await ProduccionProyecto.findByPk(id, { attributes: ['id', 'nombre', 'activo'] });
        return p ? { id: p.id, nombre: p.nombre, activo: p.activo } : null;
    },
    async proyectosActivosPorClave(clave, exceptoId = null) {
        const [filas] = await sequelize.query(
            `SELECT id, nombre FROM produccion_proyectos WHERE activo = true AND ${SQL_CLAVE} = :clave${exceptoId ? ' AND id <> :exceptoId' : ''}`,
            { replacements: { clave, exceptoId } }
        );
        return filas.filter((f) => claveNombre(f.nombre) === clave);
    },
    async hojaPorId(id) { return CalidadHoja.findByPk(id); },
    async hojaPorObraId(obraId) { return CalidadHoja.findOne({ where: { obra_id: obraId }, order: [['id', 'ASC']] }); },
    async hojasPorProyectoId(id) { return CalidadHoja.findAll({ where: { proyecto_id: id }, order: [['id', 'ASC']] }); },
    async hojasPorClave(clave) { return CalidadHoja.findAll({ where: { proyecto_clave: clave }, order: [['id', 'ASC']] }); },
    async hojasDeObras({ ids = [], obraIds = [], claves = [] }) {
        const o = [];
        if (ids.length) o.push({ proyecto_id: { [Op.in]: ids } });
        if (obraIds.length) o.push({ obra_id: { [Op.in]: obraIds } });
        if (claves.length) o.push({ proyecto_clave: { [Op.in]: claves } });
        if (!o.length) return [];
        return CalidadHoja.findAll({ where: { [Op.or]: o }, order: [['id', 'ASC']] });
    },
    async hojasAvaladasDesde(desde) {
        return CalidadHoja.findAll({ where: { avalada_en: { [Op.gte]: desde } }, order: [['avalada_en', 'DESC']], limit: 200 });
    },
    async crearHoja(datos) { return CalidadHoja.create(datos); },
    async actualizarHoja(hoja, cambios) { return hoja.update(cambios); },
    async puntos(hojaId) { return CalidadPunto.findAll({ where: { hoja_id: hojaId }, order: [['id', 'ASC']] }); },
    async puntosDeHojas(ids) { return ids.length ? CalidadPunto.findAll({ where: { hoja_id: { [Op.in]: ids } } }) : []; },
    async guardarPunto(hojaId, datos) {
        const fila = await CalidadPunto.findOne({ where: { hoja_id: hojaId, punto_id: datos.punto_id } });
        if (fila) return fila.update(datos);
        return CalidadPunto.create({ hoja_id: hojaId, ...datos });
    },
    async eventoPorCambioId(cambioId) { return CalidadEvento.findOne({ where: { cambio_id: cambioId } }); },
    async anotarEvento(datos) { return CalidadEvento.create(datos); },
    async borrarEvento(id) { await CalidadEvento.destroy({ where: { id } }); },
    async eventos(hojaId, limite = 20) {
        return CalidadEvento.findAll({ where: { hoja_id: hojaId }, order: [['created_at', 'DESC'], ['id', 'DESC']], limit: limite });
    },
    async sugerenciasPendientes(hojaIds) {
        return hojaIds.length ? CalidadSugerencia.findAll({ where: { hoja_id: { [Op.in]: hojaIds }, estado_sugerencia: 'pendiente' }, order: [['id', 'ASC']] }) : [];
    },
    async sugerenciaPorId(id) { return CalidadSugerencia.findByPk(id); },
    async crearSugerencia(datos) { return CalidadSugerencia.create(datos); },
    async sugerenciasDeLlamada(llamadaId, origen) { return CalidadSugerencia.findAll({ where: { llamada_id: llamadaId, origen }, order: [['id', 'ASC']], limit: 500 }); },
    async actualizarSugerencia(s, cambios) { return s.update(cambios); },
    async proyectosEnTaller() {
        // La misma regla que /en-curso de la puerta y las pantallas de Manufactura y Herrería (obtenerPorArea)
        return ProduccionProyecto.findAll({
            where: {
                etapa_actual: { [Op.in]: ['pendiente', 'diseno', 'compras', 'produccion'] },
                activo: true,
                [Op.and]: [
                    { [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }] },
                    { [Op.or]: [
                        { etapa_actual: 'produccion' },
                        { tiene_manufactura: true, manufactura_completado: false },
                        { tiene_herreria: true, herreria_completado: false }
                    ] }
                ]
            },
            order: [['id', 'ASC']],
            limit: 300
        });
    },
    async proyectosPreparadosDesde(desde) {
        // Ya en «Preparado» (se cerraron solas o a mano) en los últimos días y con producción
        return ProduccionProyecto.findAll({
            where: {
                etapa_actual: 'instalacion',
                activo: true,
                es_premium: false,
                instalacion_completado_en: { [Op.gte]: desde },
                [Op.and]: [
                    { [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }] },
                    { [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notIn]: ['MTO', 'GTIA'] } }, { es_extensivo: true }] },
                    { [Op.or]: [{ tiene_manufactura: true }, { tiene_herreria: true }] }
                ]
            },
            order: [['id', 'ASC']],
            limit: 300
        });
    },
    async proyectosPorIds(ids) { return ids.length ? ProduccionProyecto.findAll({ where: { id: { [Op.in]: ids }, activo: true } }) : []; },
    async obraIdsDe(ids) { return obraIdsDeProyectos(ids); }
};

// El repositorio por omisión. Producción no pasa `repo` (usa la base); las pruebas cambian este con usarRepoCalidad para
// que también el modelo y los controladores (que llaman sin `repo`) usen el doble en memoria.
let repoActivo = repoSequelize;
export const usarRepoCalidad = (r) => { repoActivo = r || repoSequelize; };
export const repoCalidad = () => repoActivo;

// Un cambio a la vez por obra (dos toques seguidos de la tableta, o la tableta y la web): sin hojas repetidas ni estados
// cruzados. Planta corre en una sola instancia; el candado es de este proceso.
const candados = new Map();
export const conCandado = async (clave, fn) => {
    const antes = candados.get(clave) || Promise.resolve();
    let soltar;
    const este = new Promise((r) => { soltar = r; });
    const cola = antes.then(() => este);
    candados.set(clave, cola);
    try {
        await antes;
        return await fn();
    } finally {
        soltar();
        if (candados.get(clave) === cola) candados.delete(clave);
    }
};

// ---------- Estado de la hoja (puro) ----------

/**
 * Lo que dice la hoja con sus puntos guardados. Pura.
 * Estados: sin_revisar (nada marcado o falta decir qué lleva) → en_revision (algo marcado, algo pendiente) →
 * con_defectos (algún defecto que no sale así) → lista (todo lo que aplica en ok, na o defecto que sale así con nota) →
 * avalada. Los puntos que dejaron de aplicar (cambiaron los atributos) se conservan pero no cuentan.
 */
export const calcularHoja = (hoja, puntos = []) => {
    const atributos = hoja?.atributos || null;
    const faltanAtributos = !tieneAtributos(atributos);
    const filas = new Map(puntos.map((p) => [p.punto_id, p]));
    const hojas = hojasQueAplican(atributos);
    const aplicables = hojas.flatMap((h) => h.puntos.map((p) => ({ hojaId: h.hoja.id, punto: p, fila: filas.get(p.id) || null })));
    const conteos = { total: aplicables.length, ok: 0, na: 0, defectos: 0, salenAsi: 0, pendientes: 0 };
    const pendientes = [];
    const defectos = [];
    for (const a of aplicables) {
        const estado = a.fila?.estado || 'pendiente';
        if (estado === 'ok') conteos.ok++;
        else if (estado === 'na') conteos.na++;
        else if (estado === 'defecto') {
            conteos.defectos++;
            if (a.fila.sale_asi) conteos.salenAsi++;
            defectos.push(a);
        } else {
            conteos.pendientes++;
            pendientes.push(a);
        }
    }
    const sinCorregir = conteos.defectos - conteos.salenAsi;
    const avalada = !!hoja?.avalada_en;
    let estado;
    if (avalada) estado = 'avalada';
    else if (faltanAtributos) estado = 'sin_revisar';
    else if (sinCorregir > 0) estado = 'con_defectos';
    else if (conteos.pendientes === 0) estado = 'lista';
    else if (conteos.ok + conteos.na + conteos.defectos === 0) estado = 'sin_revisar';
    else estado = 'en_revision';
    const porQueNo = [];
    if (avalada) porQueNo.push('Ya está avalada');
    if (faltanAtributos) porQueNo.push('Falta decir qué lleva la obra');
    if (!faltanAtributos && conteos.pendientes) porQueNo.push(plural(conteos.pendientes, 'punto sin revisar', 'puntos sin revisar'));
    if (!faltanAtributos && sinCorregir) porQueNo.push(`${plural(sinCorregir, 'defecto sin corregir', 'defectos sin corregir')} (corrígelo o marca que sale así a instalación)`);
    const aplican = new Set(aplicables.map((a) => a.punto.id));
    const yaNoAplican = puntos.filter((p) => !aplican.has(p.punto_id) && p.estado && p.estado !== 'pendiente');
    return { estado, faltanAtributos, conteos, listaParaAvalar: estado === 'lista', porQueNo, aplicables, pendientes, defectos, hojas, yaNoAplican };
};

// ---------- La obra y su hoja ----------

/** La obra por proyectoId (número) o ID 3G. → { proyecto, id, nombre, obraId } o null (no existe o no está activa). */
export const cargarObra = async (ref, { repo = repoActivo } = {}) => {
    const texto = String(ref ?? '').trim().toUpperCase();
    let proyecto = null;
    let obraId = null;
    if (ES_ID3G.test(texto)) {
        proyecto = await repo.proyectoPorObraId(texto);
        obraId = proyecto ? texto : null;
    } else if (/^\d{1,10}$/.test(texto) && Number(texto) > 0) {
        proyecto = await repo.proyectoPorId(Number(texto));
        if (proyecto) obraId = await repo.obraIdDe(proyecto.id);
    }
    if (!proyecto || proyecto.activo === false) return null;
    return { proyecto, id: proyecto.id, nombre: proyecto.nombre, obraId };
};

const anotar = (repo, datos) => repo.anotarEvento({ origen: null, quien: null, ...datos });

/**
 * La hoja de la obra, si ya tiene una. `escribir`: vuelve a ligarla si el renglón cambió (y lo anota en la bitácora).
 *   1. Por ID 3G (si la obra lo tiene): es la llave estable.
 *   2. Por proyecto_id con el mismo nombre. Si el nombre es otro y otro proyecto activo tiene el nombre de la hoja, la
 *      hoja es de ese (el renglón se movió) y se le pasa.
 *   3. Por nombre exacto (normalizado): una hoja con ese nombre cuyo proyecto ya no es suyo (no existe, está inactivo o
 *      ahora se llama distinto). Si hay más de una, no se adivina.
 *   4. Solo si nada de lo anterior la encontró: la hoja de este renglón con otro nombre que ya nadie tiene puede ser un
 *      cambio de nombre en el Índice… o el renglón de una obra que se borró y que ahora ocupa otra (el sync liga por
 *      renglón). Por eso se pasa SOLO si no está avalada y no trae ID 3G: un aval es la firma de una obra y el ID 3G ya
 *      la identifica; pasarlos a otra la dejaría cerrar sin su propia revisión (28-oct, revisión). En esos casos la obra
 *      empieza una hoja nueva y la otra se conserva.
 */
export const ligarHoja = async (obra, { repo = repoActivo, escribir = true } = {}) => {
    const clave = claveNombre(obra.nombre);
    const delMismoId3g = (h) => !h.obra_id || !obra.obraId || h.obra_id === obra.obraId;
    if (obra.obraId) {
        const h = await repo.hojaPorObraId(obra.obraId);
        if (h) {
            const cambios = {};
            if (h.proyecto_id !== obra.id) cambios.proyecto_id = obra.id;
            if (h.proyecto_clave !== clave || h.proyecto_nombre !== obra.nombre) { cambios.proyecto_nombre = obra.nombre; cambios.proyecto_clave = clave; }
            if (escribir && Object.keys(cambios).length) {
                const antes = h.proyecto_id;
                await repo.actualizarHoja(h, cambios);
                if (cambios.proyecto_id) {
                    await anotar(repo, {
                        hoja_id: h.id, proyecto_id: obra.id, tipo: 'religo',
                        detalle: `Se volvió a ligar por el ID 3G ${obra.obraId}: el proyecto pasó del renglón ${antes ?? '—'} al ${obra.id}`
                    });
                }
            }
            return h;
        }
    }
    const propias = (await repo.hojasPorProyectoId(obra.id)).filter(delMismoId3g);
    const mismaClave = propias.find((h) => h.proyecto_clave === clave);
    if (mismaClave) {
        if (escribir && obra.obraId && !mismaClave.obra_id) await repo.actualizarHoja(mismaClave, { obra_id: obra.obraId });
        return mismaClave;
    }
    const otra = propias[0] || null;
    // La hoja de este renglón con otro nombre que ya ningún proyecto activo tiene: quizá se renombró (paso 4)
    let sinDueno = null;
    if (otra) {
        const duenos = await repo.proyectosActivosPorClave(otra.proyecto_clave, obra.id);
        if (!duenos.length) sinDueno = otra;
        // El renglón se movió: la hoja es del proyecto que ahora tiene su nombre
        else if (escribir && duenos.length === 1) {
            await repo.actualizarHoja(otra, { proyecto_id: duenos[0].id });
            await anotar(repo, {
                hoja_id: otra.id, proyecto_id: duenos[0].id, tipo: 'religo',
                detalle: `Se volvió a ligar por nombre: «${otra.proyecto_nombre}» pasó del renglón ${obra.id} al ${duenos[0].id}`
            });
        }
    }
    const candidatas = (await repo.hojasPorClave(clave)).filter((h) => h.proyecto_id !== obra.id && delMismoId3g(h) && h.id !== otra?.id);
    const libres = [];
    for (const h of candidatas) {
        const actual = h.proyecto_id ? await repo.proyectoResumen(h.proyecto_id) : null;
        if (!actual || actual.activo === false || claveNombre(actual.nombre) !== h.proyecto_clave) libres.push(h);
    }
    if (libres.length === 1) {
        const h = libres[0];
        if (escribir) {
            const antes = h.proyecto_id;
            await repo.actualizarHoja(h, { proyecto_id: obra.id, proyecto_nombre: obra.nombre, ...(obra.obraId && !h.obra_id ? { obra_id: obra.obraId } : {}) });
            await anotar(repo, {
                hoja_id: h.id, proyecto_id: obra.id, tipo: 'religo',
                detalle: `Se volvió a ligar por nombre: «${obra.nombre}» pasó del renglón ${antes ?? '—'} al ${obra.id}`
            });
        }
        return h;
    }
    if (libres.length > 1) console.warn(`[calidad] «${obra.nombre}»: ${libres.length} hojas con ese nombre sin dueño; no se adivina cuál es`);
    if (sinDueno) {
        if (sinDueno.avalada_en || sinDueno.obra_id) {
            console.warn(`[calidad] «${obra.nombre}» (renglón ${obra.id}): la hoja de «${sinDueno.proyecto_nombre}» ${sinDueno.avalada_en ? 'está avalada' : `trae el ID 3G ${sinDueno.obra_id}`}; no se pasa por un cambio de nombre (la obra empieza su propia hoja)`);
            return null;
        }
        // Mismo renglón, otro nombre: el proyecto se renombró en el Índice
        if (escribir) {
            const antes = sinDueno.proyecto_nombre;
            await repo.actualizarHoja(sinDueno, { proyecto_nombre: obra.nombre, proyecto_clave: clave, ...(obra.obraId ? { obra_id: obra.obraId } : {}) });
            await anotar(repo, { hoja_id: sinDueno.id, proyecto_id: obra.id, tipo: 'religo', detalle: `El proyecto cambió de nombre: «${antes}» → «${obra.nombre}»` });
        }
        return sinDueno;
    }
    return null;
};

/** La hoja de la obra; si no tiene, la crea vacía (sin_revisar). */
export const hojaDeObra = async (obra, { repo = repoActivo } = {}) => {
    const h = await ligarHoja(obra, { repo, escribir: true });
    if (h) return h;
    return repo.crearHoja({
        proyecto_id: obra.id, obra_id: obra.obraId || null, proyecto_nombre: obra.nombre, proyecto_clave: claveNombre(obra.nombre),
        atributos: null, estado: 'sin_revisar', version_config: VERSION_CONFIG
    });
};

// ---------- Vistas ----------

const iso = (v) => (v ? new Date(v).toISOString() : null);

const vistaPunto = (a) => ({
    id: a.punto.id,
    hoja: a.hojaId,
    texto: a.punto.texto,
    permiteNa: !!a.punto.permite_na,
    estado: a.fila?.estado || 'pendiente',
    nota: a.fila?.nota || null,
    saleAsi: !!a.fila?.sale_asi,
    actualizadoPor: a.fila?.actualizado_por || null,
    actualizadoEn: iso(a.fila?.actualizado_en),
    origen: a.fila?.origen || null
});

/** Resumen de la hoja (lo que regresa cada cambio y lo que lleva cada obra de la lista). */
export const resumenHoja = (hoja, calc, { sugerenciasPendientes = 0 } = {}) => ({
    id: hoja?.id ?? null,
    estado: calc.estado,
    faltanAtributos: calc.faltanAtributos,
    conteos: calc.conteos,
    listaParaAvalar: calc.listaParaAvalar,
    porQueNo: calc.porQueNo,
    sugerenciasPendientes,
    avaladaEn: iso(hoja?.avalada_en),
    avaladaPor: hoja?.avalada_por || null
});

const vistaSugerencia = (s) => ({
    id: s.id,
    punto: s.punto_id,
    puntoTexto: s.punto_texto,
    estado: s.estado,
    nota: s.nota,
    saleAsi: s.sale_asi,
    discrepancia: s.discrepancia,
    fechaLlamada: s.fecha_llamada || null,
    llegoEn: iso(s.created_at)
});

const vistaEvento = (e) => ({
    tipo: e.tipo, punto: e.punto_id || null, detalle: e.detalle || null, quien: e.quien || null, origen: e.origen || null, cuando: iso(e.created_at)
});

/** Lo que importa de la obra en sí (etapa y si espera el aval). */
export const datosObra = (obra) => {
    const p = obra.proyecto;
    const subetapasListas = (!p.tiene_manufactura || p.manufactura_completado) && (!p.tiene_herreria || p.herreria_completado)
        && (p.tiene_manufactura || p.tiene_herreria);
    return {
        proyectoId: obra.id,
        obraId: obra.obraId || null,
        proyecto: obra.nombre,
        etapa: p.etapa_actual,
        preparado: ['instalacion', 'completado'].includes(p.etapa_actual),
        produccionTerminada: !!subetapasListas,
        areas: {
            manufactura: { aplica: !!p.tiene_manufactura, lista: !!p.manufactura_completado },
            herreria: { aplica: !!p.tiene_herreria, lista: !!p.herreria_completado, soldadura: !!p.herreria_armado_completado, pintura: !!p.herreria_pintado_completado }
        }
    };
};

/** La hoja completa de una obra (GET /obras/:id). Lee y, si el renglón cambió, vuelve a ligar. */
export const vistaObra = async (ref, { repo = repoActivo } = {}) => {
    const obra = await cargarObra(ref, { repo });
    if (!obra) falla(404, 'No existe esa obra (o ya no está activa).');
    const hoja = await ligarHoja(obra, { repo, escribir: true });
    const puntos = hoja ? await repo.puntos(hoja.id) : [];
    const calc = calcularHoja(hoja, puntos);
    const [sugerencias, eventos] = hoja ? await Promise.all([repo.sugerenciasPendientes([hoja.id]), repo.eventos(hoja.id, 20)]) : [[], []];
    const sugPorPunto = new Map();
    for (const s of sugerencias) if (s.punto_id) sugPorPunto.set(s.punto_id, [...(sugPorPunto.get(s.punto_id) || []), vistaSugerencia(s)]);
    const d = datosObra(obra);
    return {
        obra: { ...d, esperaCalidad: calidadAvalCierra() && d.produccionTerminada && !d.preparado && calc.estado !== 'avalada' },
        hoja: {
            ...resumenHoja(hoja, calc, { sugerenciasPendientes: sugerencias.length }),
            atributos: hoja?.atributos || null,
            observacionesInstalacion: hoja?.observaciones_instalacion || null,
            avalNota: hoja?.aval_nota || null,
            versionConfig: hoja?.version_config || VERSION_CONFIG,
            reporte: hoja?.reporte_estado ? { estado: hoja.reporte_estado, error: hoja.reporte_error || null, subido: hoja.reporte_estado === 'subido' } : null
        },
        hojas: calc.hojas.map((h) => ({
            id: h.hoja.id,
            titulo: h.hoja.titulo,
            firma: h.hoja.firma,
            puntos: calc.aplicables.filter((a) => a.hojaId === h.hoja.id).map((a) => ({ ...vistaPunto(a), sugerencias: sugPorPunto.get(a.punto.id) || [] }))
        })),
        yaNoAplican: calc.yaNoAplican.map((p) => ({ id: p.punto_id, hoja: p.hoja, estado: p.estado, nota: p.nota || null })),
        sugerencias: sugerencias.map(vistaSugerencia),
        eventos: eventos.map(vistaEvento),
        version: VERSION_CONFIG
    };
};

// ---------- Cambios ----------

const leerCambioId = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const t = String(v).trim();
    if (!RE_CAMBIO_ID.test(t)) falla(400, 'cambioId no válido (letras, números, guion, punto o dos puntos; 80 como máximo).');
    return t;
};

const leerCuando = (v, ahora) => {
    if (v === undefined || v === null || v === '') return ahora;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) falla(400, '«cuando» no es una fecha válida.');
    return d.getTime() > ahora.getTime() + FUTURO_MS ? ahora : d; // un reloj adelantado no gana a los demás
};

/** Si ese cambio ya se aplicó, la respuesta de ahora sin repetirlo. */
const yaAplicado = async (repo, cambioId) => (cambioId ? !!(await repo.eventoPorCambioId(cambioId)) : false);

const esDuplicado = (e) => e?.name === 'SequelizeUniqueConstraintError' || e?.codigoDuplicado === true;

/** La respuesta de cualquier cambio: cómo quedó la hoja (y el punto, si fue un punto). */
const respuestaCambio = async (repo, obra, hoja, extra = {}, puntoId = null) => {
    const puntos = hoja ? await repo.puntos(hoja.id) : [];
    const calc = calcularHoja(hoja, puntos);
    const sugerencias = hoja ? await repo.sugerenciasPendientes([hoja.id]) : [];
    const a = puntoId ? calc.aplicables.find((x) => x.punto.id === puntoId) : null;
    return {
        ok: true,
        repetido: false,
        aplicado: true,
        ...extra,
        ...(puntoId ? { punto: a ? vistaPunto(a) : null } : {}),
        hoja: resumenHoja(hoja, calc, { sugerenciasPendientes: sugerencias.length }),
        obra: datosObra(obra)
    };
};

/** Recalcula y guarda el estado de la hoja. */
const recalcular = async (repo, hoja) => {
    const calc = calcularHoja(hoja, await repo.puntos(hoja.id));
    if (hoja.estado !== calc.estado) await repo.actualizarHoja(hoja, { estado: calc.estado });
    return calc;
};

/**
 * Un punto de la hoja (PUT /obras/:id/puntos/:puntoId). Reglas: defecto sin nota → 400; «No aplica» en un punto que no
 * lo permite → 400; hoja avalada → 409; sin atributos o punto que no aplica → 409; el mismo cambioId dos veces → la
 * misma respuesta sin repetir. Si ya hay un cambio más nuevo del punto (la tableta mandó tarde uno viejo), no lo pisa.
 */
export const marcarPunto = async (ref, puntoIdCrudo, datos = {}, ctx = {}) => {
    const { repo = repoActivo, ahora = new Date(), quien = null, origen = 'tableta' } = ctx;
    const def = puntoDe(puntoIdCrudo);
    if (!def) falla(404, `«${String(puntoIdCrudo ?? '').slice(0, 20)}» no es un punto del checklist.`);
    const estado = String(datos.estado ?? '').trim().toLowerCase();
    if (!ESTADOS_PUNTO.includes(estado)) falla(400, `El estado debe ser ${ESTADOS_PUNTO.join(', ')}.`);
    const nota = textoLimpio(datos.nota, MAX_NOTA);
    if (estado === 'defecto' && !nota) falla(400, 'Un defecto necesita una nota que diga qué está mal.');
    if (estado === 'na' && !def.punto.permite_na) falla(400, `El punto ${def.punto.id} no se puede marcar como «No aplica».`);
    const cambioId = leerCambioId(datos.cambioId);
    const cuando = leerCuando(datos.cuando, ahora);
    const saleAsi = estado === 'defecto' && datos.saleAsi === true;
    const obra = await cargarObra(ref, { repo });
    if (!obra) falla(404, 'No existe esa obra (o ya no está activa).');

    return conCandado(`obra:${obra.id}`, async () => {
        if (await yaAplicado(repo, cambioId)) {
            const hoja = await ligarHoja(obra, { repo, escribir: false });
            return respuestaCambio(repo, obra, hoja, { repetido: true }, def.punto.id);
        }
        const hoja = await hojaDeObra(obra, { repo });
        if (hoja.avalada_en) falla(409, 'La hoja ya está avalada: para cambiar algo hay que reabrirla.');
        if (!tieneAtributos(hoja.atributos)) falla(409, 'Primero di qué lleva la obra (atributos).');
        if (!puntosQueAplican(hoja.atributos).has(def.punto.id)) falla(409, `El punto ${def.punto.id} no aplica a esta obra con lo que lleva.`);
        const fila = (await repo.puntos(hoja.id)).find((p) => p.punto_id === def.punto.id) || null;
        const antes = { estado: fila?.estado || 'pendiente', saleAsi: !!fila?.sale_asi };
        const tarde = fila?.actualizado_en && new Date(fila.actualizado_en).getTime() > cuando.getTime();
        let evento;
        try {
            evento = await anotar(repo, {
                hoja_id: hoja.id, proyecto_id: obra.id, tipo: tarde ? 'marco_tarde' : 'marco', punto_id: def.punto.id,
                detalle: tarde
                    ? `${def.punto.id}: llegó tarde «${ESTADO_EN_PALABRAS[estado]}» (ya había un cambio más nuevo); no se aplicó`
                    : `${def.punto.id}: ${ESTADO_EN_PALABRAS[antes.estado] || antes.estado} → ${ESTADO_EN_PALABRAS[estado]}${saleAsi ? ' (sale así)' : ''}${nota ? ` · ${nota}` : ''}`,
                quien, origen, cambio_id: cambioId, datos: { estado, nota, saleAsi, cuando: cuando.toISOString() }
            });
        } catch (e) {
            if (esDuplicado(e)) return respuestaCambio(repo, obra, hoja, { repetido: true }, def.punto.id);
            throw e;
        }
        if (tarde) return respuestaCambio(repo, obra, hoja, { aplicado: false, motivo: 'Ya había un cambio más nuevo de este punto' }, def.punto.id);
        try {
            await repo.guardarPunto(hoja.id, {
                hoja: def.hoja.id, punto_id: def.punto.id, estado,
                nota: estado === 'pendiente' ? null : nota, sale_asi: saleAsi,
                actualizado_por: quien, actualizado_en: cuando, origen, cambio_id: cambioId
            });
        } catch (e) {
            await repo.borrarEvento(evento.id).catch(() => {});
            if (esDuplicado(e)) falla(409, 'Ese cambioId ya se usó en otro punto.');
            throw e;
        }
        await recalcular(repo, hoja);
        let reabrio = null;
        const nuevoDefecto = estado === 'defecto' && !saleAsi && !(antes.estado === 'defecto' && !antes.saleAsi);
        if (nuevoDefecto && calidadDefectoReabre()) reabrio = await reabrirPorDefecto(obra, hoja, def, { repo, ahora, quien, origen });
        return respuestaCambio(repo, obra, hoja, reabrio ? { reabrio } : {}, def.punto.id);
    });
};

/** Qué lleva la obra (PUT /obras/:id/atributos). Recalcula qué aplica; los puntos que dejan de aplicar se conservan. */
export const cambiarAtributos = async (ref, datos = {}, ctx = {}) => {
    const { repo = repoActivo, quien = null, origen = 'tableta' } = ctx;
    const cambioId = leerCambioId(datos.cambioId);
    const obra = await cargarObra(ref, { repo });
    if (!obra) falla(404, 'No existe esa obra (o ya no está activa).');
    return conCandado(`obra:${obra.id}`, async () => {
        if (await yaAplicado(repo, cambioId)) return respuestaCambio(repo, obra, await ligarHoja(obra, { repo, escribir: false }), { repetido: true });
        const hoja = await hojaDeObra(obra, { repo });
        if (hoja.avalada_en) falla(409, 'La hoja ya está avalada: para cambiar algo hay que reabrirla.');
        const m = mezclarAtributos(datos.atributos, hoja.atributos);
        if (m.error) falla(400, m.error);
        try {
            await anotar(repo, {
                hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'atributos', quien, origen, cambio_id: cambioId,
                detalle: 'Cambió qué lleva la obra', datos: { antes: hoja.atributos || null, despues: m.atributos }
            });
        } catch (e) {
            if (esDuplicado(e)) return respuestaCambio(repo, obra, hoja, { repetido: true });
            throw e;
        }
        await repo.actualizarHoja(hoja, { atributos: m.atributos, version_config: VERSION_CONFIG });
        await recalcular(repo, hoja);
        return respuestaCambio(repo, obra, hoja);
    });
};

/**
 * Avalar (POST /obras/:id/avalar): la hoja debe estar lista. Firma (Charly por omisión), observaciones para instalación,
 * encola el reporte PDF y, con CALIDAD_AVAL_CIERRA, pasa la obra a «Preparado» con la lógica de siempre y el mismo aviso.
 */
export const avalar = async (ref, datos = {}, ctx = {}) => {
    const {
        repo = repoActivo, ahora = new Date(), quien = null, origen = 'tableta', usuarioId = null,
        encolarReporte = encolarReportePorOmision, avisar = avisoPorOmision
    } = ctx;
    const cambioId = leerCambioId(datos.cambioId);
    const nombre = textoLimpio(datos.nombre, MAX_NOMBRE) || NOMBRE_POR_OMISION;
    const observaciones = textoLimpio(datos.observacionesInstalacion, 4000);
    const notaAval = textoLimpio(datos.nota, MAX_NOTA);
    const obra = await cargarObra(ref, { repo });
    if (!obra) falla(404, 'No existe esa obra (o ya no está activa).');
    return conCandado(`obra:${obra.id}`, async () => {
        if (await yaAplicado(repo, cambioId)) return respuestaCambio(repo, obra, await ligarHoja(obra, { repo, escribir: false }), { repetido: true });
        const hoja = await hojaDeObra(obra, { repo });
        if (hoja.avalada_en) falla(409, 'La hoja ya está avalada.');
        const calc = calcularHoja(hoja, await repo.puntos(hoja.id));
        if (!calc.listaParaAvalar) falla(409, `Todavía no se puede avalar: ${calc.porQueNo.join('; ')}.`, { porQueNo: calc.porQueNo });
        try {
            await anotar(repo, {
                hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'avalo', quien: quien || nombre, origen, cambio_id: cambioId,
                detalle: `Avaló ${nombre}${observaciones ? ` · Para instalación: ${observaciones}` : ''}`
            });
        } catch (e) {
            if (esDuplicado(e)) return respuestaCambio(repo, obra, hoja, { repetido: true });
            throw e;
        }
        await repo.actualizarHoja(hoja, {
            estado: 'avalada', avalada_en: ahora, avalada_por: nombre, aval_nota: notaAval, observaciones_instalacion: observaciones,
            version_config: VERSION_CONFIG,
            reporte_estado: 'pendiente', reporte_intentos: 0, reporte_siguiente_intento: null, reporte_error: null
        });
        let cierre = null;
        if (calidadAvalCierra()) cierre = await pasarAPreparadoPorAval(obra, { usuarioId, avisar, repo, hoja, quien: quien || nombre, origen });
        try { encolarReporte(hoja.id); } catch (e) { console.error('[calidad] no se pudo encolar el reporte:', e.message); }
        return respuestaCambio(repo, obra, hoja, { cierre });
    });
};

/**
 * Reabrir la hoja (POST /obras/:id/reabrir): pide motivo y quita el aval. Con CALIDAD_AVAL_CIERRA NO descierra la obra
 * sola: lo anota y la oficina decide (con «Regresar etapa», como hoy).
 */
export const reabrir = async (ref, datos = {}, ctx = {}) => {
    const { repo = repoActivo, quien = null, origen = 'tableta' } = ctx;
    const motivo = textoLimpio(datos.motivo, MAX_NOTA);
    if (!motivo) falla(400, 'Escribe el motivo para reabrir la hoja.');
    const obra = await cargarObra(ref, { repo });
    if (!obra) falla(404, 'No existe esa obra (o ya no está activa).');
    return conCandado(`obra:${obra.id}`, async () => {
        const hoja = await ligarHoja(obra, { repo, escribir: true });
        if (!hoja || !hoja.avalada_en) falla(409, 'La hoja no está avalada: no hay nada que reabrir.');
        const sigueCerrada = calidadAvalCierra() && ['instalacion', 'completado'].includes(obra.proyecto.etapa_actual);
        await anotar(repo, {
            hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'reabrio', quien, origen,
            detalle: `Reabrió la hoja: ${motivo}${sigueCerrada ? ' · La obra sigue en Preparado: la oficina decide si la regresa' : ''}`,
            datos: { avaladaEn: iso(hoja.avalada_en), avaladaPor: hoja.avalada_por }
        });
        await repo.actualizarHoja(hoja, { avalada_en: null, avalada_por: null, aval_nota: null });
        await recalcular(repo, hoja);
        return respuestaCambio(repo, obra, hoja, { sigueEnPreparado: sigueCerrada });
    });
};

// ---------- Producción: cierre con aval y «repintar» ----------

const avisoPorOmision = async ({ proyecto }) => {
    const { avisarProyectoCompletado } = await import('./avisosProduccion.service.js');
    return avisarProyectoCompletado({ proyecto });
};

/**
 * Con CALIDAD_AVAL_CIERRA: la obra pasa a «Preparado» al avalar, con la lógica del «Preparado» manual
 * (ProduccionProyecto.marcarPreparado) y el aviso de siempre al grupo («Proyecto completado»). Si ya estaba en
 * Preparado o cerrada en el Índice no se toca.
 */
export const pasarAPreparadoPorAval = async (obra, { usuarioId = null, avisar = avisoPorOmision, repo = repoActivo, hoja = null, quien = null, origen = null } = {}) => {
    const p = obra.proyecto;
    const antes = p.etapa_actual;
    if (['instalacion', 'completado'].includes(antes)) return { cerro: false, etapa: antes };
    await p.marcarPreparado(usuarioId);
    if (hoja) await anotar(repo, { hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'cerro_produccion', quien, origen, detalle: `Con el aval, la obra pasó de ${antes} a Preparado` });
    try {
        await avisar({ proyecto: p.nombre });
    } catch (e) {
        console.error('⚠️ No se pudo avisar al grupo de producción:', e.message);
    }
    return { cerro: true, etapaAntes: antes, etapa: p.etapa_actual };
};

/**
 * ¿Esta obra debe esperar el aval antes de pasar a «Preparado»? Solo con CALIDAD_AVAL_CIERRA (apagada: false sin tocar
 * la base, como hoy). Espera si su hoja no está avalada; la primera vez lo anota en la bitácora («Espera calidad»).
 * Si la revisión falla, no detiene nada (la obra cierra como hoy) y queda en el registro.
 */
export const calidadDetieneCierre = async (proyecto, { repo = repoActivo } = {}) => {
    if (!calidadAvalCierra()) return false;
    // Mantenimiento y garantía no extensivos y los PREMIUM no pasan por producción: no esperan aval
    const tipo = String(proyecto?.tipo_proyecto || '').toUpperCase();
    if (((tipo === 'MTO' || tipo === 'GTIA') && !proyecto.es_extensivo) || proyecto?.es_premium) return false;
    try {
        const obra = { proyecto, id: proyecto.id, nombre: proyecto.nombre, obraId: await repo.obraIdDe(proyecto.id) };
        return await conCandado(`obra:${obra.id}`, async () => {
            const hoja = await hojaDeObra(obra, { repo });
            if (hoja.avalada_en) return false;
            const ultimo = (await repo.eventos(hoja.id, 1))[0];
            if (ultimo?.tipo !== 'espera_calidad') {
                await anotar(repo, { hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'espera_calidad', detalle: 'Manufactura y Herrería terminaron: la obra espera el aval de Calidad para pasar a Preparado' });
            }
            return true;
        });
    } catch (e) {
        console.error(`[calidad] no se pudo revisar el aval de «${proyecto?.nombre}» (la obra cierra como siempre):`, e.message);
        return false;
    }
};

/** El «Preparado» manual de la oficina con CALIDAD_AVAL_CIERRA: sigue funcionando y queda en la bitácora de calidad. */
export const anotarPreparadoManual = async (proyecto, { quien = null, repo = repoActivo } = {}) => {
    if (!calidadAvalCierra()) return;
    try {
        const obra = { proyecto, id: proyecto.id, nombre: proyecto.nombre, obraId: await repo.obraIdDe(proyecto.id) };
        await conCandado(`obra:${obra.id}`, async () => {
            const hoja = await hojaDeObra(obra, { repo });
            if (hoja.avalada_en) return;
            await anotar(repo, { hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'preparado_manual', quien, origen: 'web', detalle: 'La oficina marcó la obra como Preparado sin el aval de Calidad' });
        });
    } catch (e) {
        console.error(`[calidad] no se pudo anotar el Preparado manual de «${proyecto?.nombre}»:`, e.message);
    }
};

const quitar = (p, area) => {
    p[`${area}_completado`] = false;
    p[`${area}_completado_en`] = null;
    p[`${area}_completado_por`] = null;
};

/**
 * CALIDAD_DEFECTO_REABRE: un defecto que no sale así reabre la subetapa de su hoja para que el área lo corrija.
 *   MANUFACTURA → manufactura. HERRERIA H7–H11 (pintura) → pintura y herrería. Otro H → herrería (soldadura).
 * Si la obra ya estaba en «Preparado», primero se regresa con la lógica de siempre (regresarEtapa: instalación →
 * producción) y luego se deja terminada la otra área como estaba (regresarEtapa reabre las dos). Una obra cerrada en el
 * Índice (completado) no se toca: solo se anota.
 */
export const reabrirPorDefecto = async (obra, hoja, def, { repo = repoActivo, quien = null, origen = null } = {}) => {
    const p = obra.proyecto;
    const hojaId = def.hoja.id;
    const pintura = hojaId === 'HERRERIA' && PUNTOS_PINTURA.has(def.punto.id);
    const area = hojaId === 'MANUFACTURA' ? 'manufactura' : pintura ? 'pintura y herrería' : 'herrería';
    if (p.etapa_actual === 'completado') {
        await anotar(repo, { hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'defecto_sin_reabrir', punto_id: def.punto.id, quien, origen, detalle: `${def.punto.id}: la obra ya está cerrada en el Índice; no se reabrió ${area}` });
        return { area, reabierta: false };
    }
    const antes = {
        manufactura_completado: p.manufactura_completado, manufactura_completado_en: p.manufactura_completado_en, manufactura_completado_por: p.manufactura_completado_por,
        herreria_completado: p.herreria_completado, herreria_completado_en: p.herreria_completado_en, herreria_completado_por: p.herreria_completado_por
    };
    let regreso = false;
    if (p.etapa_actual === 'instalacion') {
        await p.regresarEtapa(null);
        regreso = true;
        // regresarEtapa reabre las dos áreas: la que no tiene que ver con el defecto se queda como estaba
        const otra = hojaId === 'MANUFACTURA' ? 'herreria' : 'manufactura';
        for (const campo of ['completado', 'completado_en', 'completado_por']) p[`${otra}_${campo}`] = antes[`${otra}_${campo}`];
    }
    if (hojaId === 'MANUFACTURA') quitar(p, 'manufactura');
    else {
        quitar(p, 'herreria');
        if (pintura) p.herreria_pintado_completado = false;
        else p.herreria_armado_completado = false;
    }
    await p.save();
    await anotar(repo, {
        hoja_id: hoja.id, proyecto_id: obra.id, tipo: 'defecto_reabrio', punto_id: def.punto.id, quien, origen,
        detalle: `${def.punto.id}: se reabrió ${area} para corregirlo${regreso ? ' (la obra regresó de Preparado a producción)' : ''}`
    });
    return { area, reabierta: true, regresoDePreparado: regreso };
};

// ---------- Sugerencias de la llamada de las 16:00 ----------

/** Aplicar una sugerencia de Carla: se marca el punto como lo dijo la llamada (origen «carla»). */
export const aplicarSugerencia = async (id, ctx = {}) => {
    const { repo = repoActivo, ahora = new Date(), quien = null, origen = 'tableta' } = ctx;
    const s = await repo.sugerenciaPorId(Number(id));
    if (!s) falla(404, 'No existe esa sugerencia.');
    if (s.estado_sugerencia !== 'pendiente') falla(409, `Esa sugerencia ya está ${s.estado_sugerencia === 'sin_obra' ? 'sin obra' : s.estado_sugerencia}.`);
    if (!s.hoja_id || !s.punto_id || !ESTADOS_PUNTO.includes(s.estado || '')) {
        falla(409, 'Esta sugerencia no se puede aplicar sola (no trae un punto o un estado del checklist): márcalo a mano y descártala.');
    }
    const hoja = await repo.hojaPorId(s.hoja_id);
    if (!hoja?.proyecto_id) falla(409, 'La hoja de esa sugerencia ya no está ligada a una obra.');
    const nota = s.nota || s.discrepancia || (s.estado === 'defecto' ? 'Lo dijo la llamada de Calidad' : null);
    const r = await marcarPunto(hoja.proyecto_id, s.punto_id, { estado: s.estado, nota, saleAsi: s.sale_asi === true, cuando: ahora }, {
        repo, ahora, quien: quien ? `Carla (lo aplicó ${quien})` : 'Carla', origen: 'carla'
    });
    await repo.actualizarSugerencia(s, { estado_sugerencia: 'aplicada', resuelta_en: ahora, resuelta_por: quien });
    await anotar(repo, { hoja_id: hoja.id, proyecto_id: hoja.proyecto_id, tipo: 'sugerencia_aplicada', punto_id: s.punto_id, quien, origen, detalle: `Se aplicó lo que dijo la llamada: ${s.punto_id} ${s.estado}` });
    return { ...r, sugerencia: { id: s.id, estado: 'aplicada' } };
};

export const descartarSugerencia = async (id, ctx = {}) => {
    const { repo = repoActivo, ahora = new Date(), quien = null, origen = 'tableta' } = ctx;
    const s = await repo.sugerenciaPorId(Number(id));
    if (!s) falla(404, 'No existe esa sugerencia.');
    if (s.estado_sugerencia !== 'pendiente') falla(409, `Esa sugerencia ya está ${s.estado_sugerencia === 'sin_obra' ? 'sin obra' : s.estado_sugerencia}.`);
    await repo.actualizarSugerencia(s, { estado_sugerencia: 'descartada', resuelta_en: ahora, resuelta_por: quien });
    await anotar(repo, { hoja_id: s.hoja_id, proyecto_id: s.proyecto_id, tipo: 'sugerencia_descartada', punto_id: s.punto_id, quien, origen, detalle: `Se descartó lo que dijo la llamada${s.punto_id ? ` de ${s.punto_id}` : ''}` });
    return { ok: true, sugerencia: { id: s.id, estado: 'descartada' } };
};

// Cómo puede llegar el estado de un punto desde la llamada
const ESTADO_DE_LLAMADA = {
    ok: 'ok', bien: 'ok', corregido: 'ok', defecto: 'defecto', retrabajo: 'defecto', mal: 'defecto',
    na: 'na', 'n/a': 'na', 'no aplica': 'na', pendiente: 'pendiente'
};
const siNo = (v) => {
    if (v === true || v === false) return v;
    const t = claveNombre(v);
    if (['si', 'sí', 'true', '1'].includes(t)) return true;
    if (['no', 'false', '0'].includes(t)) return false;
    return null;
};

/**
 * POST /api/sistemas/v1/calidad/sugerencias (la puerta, alcance calidad.sugerir): guarda cada sugerencia como
 * «pendiente» en la hoja de su obra (por ID 3G o, si no, por nombre exacto de una obra activa) o «sin_obra». Un punto
 * que no existe en el checklist se guarda con punto_id null y el punto dentro de la nota. → { codigo, cuerpo }
 */
export const MAX_SUGERENCIAS = 200;
export const recibirSugerencias = async (cuerpo, { origen = 'operacion', repo = repoActivo } = {}) => {
    const error = (texto) => ({ codigo: 400, cuerpo: { error: texto } });
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return error('El cuerpo debe ser { fecha, llamadaId, sugerencias: [...] }.');
    const lista = cuerpo.sugerencias;
    if (!Array.isArray(lista) || !lista.length) return error('Faltan las sugerencias (una lista con al menos una).');
    if (lista.length > MAX_SUGERENCIAS) return error(`Son ${lista.length} sugerencias; el máximo es ${MAX_SUGERENCIAS}.`);
    const fecha = cuerpo.fecha === undefined || cuerpo.fecha === null || cuerpo.fecha === '' ? null : String(cuerpo.fecha).slice(0, 10);
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return error('«fecha» debe ser AAAA-MM-DD.');
    // Todo el cuerpo se revisa ANTES de guardar nada: un 400 a media lista dejaría guardadas las primeras y, como la
    // misma llamada no se duplica (abajo), el reenvío corregido ya no guardaría las demás.
    const malo = lista.findIndex((x) => !x || typeof x !== 'object' || Array.isArray(x));
    if (malo >= 0) return error(`La sugerencia ${malo + 1} no es un objeto.`);
    const llamadaId = textoLimpio(cuerpo.llamadaId, 120);
    // La misma llamada dos veces (Operación reintenta tras un 504 con otra Idempotency-Key): no se duplica
    if (llamadaId) {
        const previas = await repo.sugerenciasDeLlamada(llamadaId, origen);
        if (previas.length) {
            const lista2 = previas.map((s) => ({ id: s.id, obraId: s.obra_id, punto: s.punto_id, estado: s.estado_sugerencia === 'sin_obra' ? 'sin_obra' : 'pendiente' }));
            return { codigo: 200, cuerpo: { recibidas: previas.length, pendientes: lista2.filter((g) => g.estado === 'pendiente').length, sinObra: lista2.filter((g) => g.estado === 'sin_obra').length, sugerencias: lista2, repetida: true } };
        }
    }
    const guardadas = [];
    const obras = new Map(); // ref → obra (una búsqueda por obra aunque traiga varios puntos)
    for (let i = 0; i < lista.length; i++) {
        const x = lista[i];
        const ref =textoLimpio(x.obraId ?? x.folio, 200);
        if (!obras.has(ref)) {
            let obra = null;
            if (ref && ES_ID3G.test(ref.toUpperCase())) obra = await cargarObra(ref.toUpperCase(), { repo });
            else if (ref) {
                const mismos = await repo.proyectosActivosPorClave(claveNombre(ref));
                if (mismos.length === 1) obra = await cargarObra(mismos[0].id, { repo });
            }
            obras.set(ref, obra);
        }
        const obra = obras.get(ref);
        const puntoTexto = textoLimpio(x.punto, 120);
        const def = puntoDe(puntoTexto);
        const estadoCrudo = claveNombre(x.estado);
        const estado = ESTADO_DE_LLAMADA[estadoCrudo] || null;
        let nota = textoLimpio(x.nota, MAX_NOTA);
        if (!def && puntoTexto) nota = textoLimpio(`Punto «${puntoTexto}»: ${nota || 'sin nota'}`, MAX_NOTA);
        if (!estado && estadoCrudo) nota = textoLimpio(`${nota ? `${nota} · ` : ''}Estado dicho: «${String(x.estado).slice(0, 40)}»`, MAX_NOTA);
        const discrepancia = typeof x.discrepancia === 'boolean' ? (x.discrepancia ? 'sí' : null) : textoLimpio(x.discrepancia, MAX_NOTA);
        let hoja = null;
        if (obra) hoja = await conCandado(`obra:${obra.id}`, () => hojaDeObra(obra, { repo }));
        const s = await repo.crearSugerencia({
            hoja_id: hoja?.id || null, proyecto_id: obra?.id || null, obra_id: obra?.obraId || (ref && ES_ID3G.test(ref.toUpperCase()) ? ref.toUpperCase() : null),
            obra_ref: ref, punto_id: def ? def.punto.id : null, punto_texto: puntoTexto, estado, nota,
            sale_asi: siNo(x.saleAsi), discrepancia, fecha_llamada: fecha, llamada_id: llamadaId, origen,
            estado_sugerencia: obra ? 'pendiente' : 'sin_obra'
        });
        guardadas.push({ id: s.id, obraId: s.obra_id, punto: s.punto_id, estado: s.estado_sugerencia });
    }
    return {
        codigo: 200,
        cuerpo: {
            recibidas: lista.length,
            pendientes: guardadas.filter((g) => g.estado === 'pendiente').length,
            sinObra: guardadas.filter((g) => g.estado === 'sin_obra').length,
            sugerencias: guardadas
        }
    };
};

// ---------- Varias obras (lista de la tableta y la puerta) ----------

/**
 * Empata hojas con obras sin escribir nada (para la puerta y la lista): por ID 3G; por proyecto_id con el mismo nombre;
 * por nombre exacto si la hoja ya no está ligada a ninguna de estas obras. Lo dudoso se deja sin hoja.
 * obras: [{ id, nombre, obraId }] → Map(id → hoja)
 */
export const empatarHojas = (obras, hojas) => {
    const res = new Map();
    const usadas = new Set();
    const ids = new Set(obras.map((o) => o.id));
    const porObraId = new Map();
    for (const h of hojas) if (h.obra_id && !porObraId.has(h.obra_id)) porObraId.set(h.obra_id, h);
    for (const o of obras) {
        const h = o.obraId ? porObraId.get(o.obraId) : null;
        if (h) { res.set(o.id, h); usadas.add(h.id); }
    }
    for (const o of obras) {
        if (res.has(o.id)) continue;
        const clave = claveNombre(o.nombre);
        const h = hojas.find((x) => !usadas.has(x.id) && x.proyecto_id === o.id && x.proyecto_clave === clave && (!x.obra_id || !o.obraId || x.obra_id === o.obraId));
        if (h) { res.set(o.id, h); usadas.add(h.id); }
    }
    for (const o of obras) {
        if (res.has(o.id)) continue;
        const clave = claveNombre(o.nombre);
        const libres = hojas.filter((x) => !usadas.has(x.id) && x.proyecto_clave === clave && !ids.has(x.proyecto_id) && (!x.obra_id || !o.obraId || x.obra_id === o.obraId));
        if (libres.length === 1) { res.set(o.id, libres[0]); usadas.add(libres[0].id); }
    }
    return res;
};

/**
 * `calidad` de cada obra para la puerta (OBRA de /cerradas, /estado y /en-curso), solo leyendo:
 * { estado, avaladaEn, avaladaPor, faltanAtributos, pendientes: [{ punto, texto }], defectos: [{ punto, texto, nota,
 *   saleAsi }], observacionesInstalacion }. `limpiar` es sinDatos de la puerta (sin teléfonos, correos ni montos).
 * filas: proyectos ({ id, nombre }); obraIds: Map(id → ID 3G). → Map(id → calidad)
 */
export const calidadDeObras = async (filas, obraIds, { repo = repoActivo, limpiar = (t) => t, isoFecha = iso } = {}) => {
    const obras = filas.map((p) => ({ id: p.id, nombre: p.nombre, obraId: obraIds.get(p.id) || null }));
    const res = new Map();
    if (!obras.length) return res;
    const hojas = await repo.hojasDeObras({
        ids: obras.map((o) => o.id),
        obraIds: obras.map((o) => o.obraId).filter(Boolean),
        claves: [...new Set(obras.map((o) => claveNombre(o.nombre)).filter(Boolean))]
    });
    const empate = empatarHojas(obras, hojas);
    const puntos = await repo.puntosDeHojas([...new Set([...empate.values()].map((h) => h.id))]);
    const porHoja = new Map();
    for (const p of puntos) porHoja.set(p.hoja_id, [...(porHoja.get(p.hoja_id) || []), p]);
    for (const o of obras) {
        const h = empate.get(o.id) || null;
        const calc = calcularHoja(h, h ? porHoja.get(h.id) || [] : []);
        res.set(o.id, {
            estado: calc.estado,
            avaladaEn: h?.avalada_en ? isoFecha(h.avalada_en) : null,
            avaladaPor: h?.avalada_por ? limpiar(h.avalada_por, 120) : null,
            faltanAtributos: calc.faltanAtributos,
            pendientes: calc.pendientes.slice(0, 50).map((a) => ({ punto: a.punto.id, texto: a.punto.texto })),
            defectos: calc.defectos.slice(0, 50).map((a) => ({ punto: a.punto.id, texto: a.punto.texto, nota: limpiar(a.fila?.nota, 400), saleAsi: !!a.fila?.sale_asi })),
            observacionesInstalacion: h?.observaciones_instalacion ? limpiar(h.observaciones_instalacion, 1000) : null
        });
    }
    return res;
};

/**
 * Lo que «Calidad pide corregir» en la terminal de Manufactura o Herrería: de cada obra, los defectos de SU hoja que no
 * salen así (texto del punto y nota). Solo lectura. → Map(id → [{ punto, texto, nota }]) (solo las que tienen)
 */
export const correccionesParaArea = async (proyectos, area, { repo = repoActivo } = {}) => {
    const res = new Map();
    const hojaId = area === 'manufactura' ? 'MANUFACTURA' : area === 'herreria' ? 'HERRERIA' : null;
    if (!hojaId || !proyectos.length) return res;
    const obraIds = await repo.obraIdsDe(proyectos.map((p) => p.id));
    const calidad = await calidadDeObras(proyectos, obraIds, { repo });
    for (const p of proyectos) {
        const c = calidad.get(p.id);
        if (!c || c.estado === 'avalada') continue;
        const lista = c.defectos.filter((d) => !d.saleAsi && puntoDe(d.punto)?.hoja.id === hojaId).map((d) => ({ punto: d.punto, texto: d.texto, nota: d.nota }));
        if (lista.length) res.set(p.id, lista);
    }
    return res;
};

export const DIAS_LISTA = 30;

/**
 * Obras para la tableta (GET /obras?vista=taller|listas|avaladas):
 *   taller   en producción (la regla de /en-curso) o ya en Preparado en los últimos 30 días sin instalarse todavía, con la
 *            hoja sin terminar (sin revisar, en revisión o con defectos);
 *   listas   las mismas con la hoja lista para avalar;
 *   avaladas las avaladas en los últimos 30 días.
 * Cada una con su resumen de hoja. `fechaDe(p)` da la fecha de instalación ({ fecha, fuente }).
 */
export const listarObras = async (vista = 'taller', { repo = repoActivo, ahora = new Date(), fechaDe = () => ({ fecha: null, fuente: null }), hoyMx = null, limpiar = (t) => t } = {}) => {
    const desde = new Date(ahora.getTime() - DIAS_LISTA * 86400000);
    let proyectos;
    if (vista === 'avaladas') {
        const hojas = await repo.hojasAvaladasDesde(desde);
        proyectos = await repo.proyectosPorIds([...new Set(hojas.map((h) => h.proyecto_id).filter(Boolean))]);
    } else {
        const [taller, preparados] = await Promise.all([repo.proyectosEnTaller(), repo.proyectosPreparadosDesde(desde)]);
        const hoy = hoyMx || ahora.toISOString().slice(0, 10);
        // De los ya preparados, solo los que no se han instalado (fecha de hoy en adelante o sin fecha)
        const aun = preparados.filter((p) => { const f = fechaDe(p).fecha; return !f || f >= hoy; });
        const vistos = new Set();
        proyectos = [...taller, ...aun].filter((p) => (vistos.has(p.id) ? false : vistos.add(p.id)));
    }
    const obraIds = await repo.obraIdsDe(proyectos.map((p) => p.id));
    const obras = proyectos.map((p) => ({ id: p.id, nombre: p.nombre, obraId: obraIds.get(p.id) || null }));
    const hojas = await repo.hojasDeObras({
        ids: obras.map((o) => o.id), obraIds: obras.map((o) => o.obraId).filter(Boolean),
        claves: [...new Set(obras.map((o) => claveNombre(o.nombre)).filter(Boolean))]
    });
    const empate = empatarHojas(obras, hojas);
    const hojaIds = [...new Set([...empate.values()].map((h) => h.id))];
    const [puntos, sugerencias] = await Promise.all([repo.puntosDeHojas(hojaIds), repo.sugerenciasPendientes(hojaIds)]);
    const porHoja = new Map();
    for (const p of puntos) porHoja.set(p.hoja_id, [...(porHoja.get(p.hoja_id) || []), p]);
    const sugPorHoja = new Map();
    for (const s of sugerencias) sugPorHoja.set(s.hoja_id, (sugPorHoja.get(s.hoja_id) || 0) + 1);
    const avalCierra = calidadAvalCierra();
    const lista = [];
    for (const p of proyectos) {
        const obra = { proyecto: p, id: p.id, nombre: p.nombre, obraId: obraIds.get(p.id) || null };
        const h = empate.get(p.id) || null;
        const calc = calcularHoja(h, h ? porHoja.get(h.id) || [] : []);
        const enVista = vista === 'avaladas' ? calc.estado === 'avalada'
            : vista === 'listas' ? calc.estado === 'lista'
                : !['lista', 'avalada'].includes(calc.estado);
        if (!enVista) continue;
        const d = datosObra(obra);
        lista.push({
            ...d,
            cliente: limpiar(p.cliente, 200),
            prioridad: p.prioridad ?? null,
            esperaCalidad: avalCierra && d.produccionTerminada && !d.preparado && calc.estado !== 'avalada',
            fechaInstalacion: fechaDe(p),
            hoja: resumenHoja(h, calc, { sugerenciasPendientes: h ? sugPorHoja.get(h.id) || 0 : 0 })
        });
    }
    // Primero lo que se instala antes; sin fecha al final; luego la prioridad y el nombre
    lista.sort((a, b) => {
        const fa = a.fechaInstalacion?.fecha || '9999-99-99';
        const fb = b.fechaInstalacion?.fecha || '9999-99-99';
        return fa.localeCompare(fb) || (a.prioridad ?? 9) - (b.prioridad ?? 9) || String(a.proyecto).localeCompare(String(b.proyecto), 'es');
    });
    return { vista, generado: ahora.toISOString(), obras: lista };
};

/** Para avalar se necesita la configuración: la mandamos a la app con su versión. */
export const configParaApp = () => ({ version: VERSION_CONFIG, config: CONFIG });

// El reporte se encola desde calidadReporte.service.js (import diferido: el reporte importa este archivo)
const encolarReportePorOmision = (hojaId) => {
    import('./calidadReporte.service.js')
        .then((m) => m.encolarReporteCalidad(hojaId))
        .catch((e) => console.error('[calidad] no se pudo encolar el reporte:', e.message));
};

export default {
    panelCalidad, claveNombre, calcularHoja, cargarObra, ligarHoja, hojaDeObra, vistaObra, marcarPunto, cambiarAtributos,
    avalar, reabrir, pasarAPreparadoPorAval, calidadDetieneCierre, anotarPreparadoManual, reabrirPorDefecto,
    aplicarSugerencia, descartarSugerencia, recibirSugerencias, empatarHojas, calidadDeObras, correccionesParaArea,
    listarObras, configParaApp, repoSequelize
};
