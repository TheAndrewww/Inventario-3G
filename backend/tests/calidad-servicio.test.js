/**
 * Panel de calidad: estados de la hoja, puntos, aval, reabrir, «repintar» (defecto que reabre), volver a ligar la hoja
 * cuando el renglón del Excel se mueve, idempotencia por cambioId y el cierre automático con y sin CALIDAD_AVAL_CIERRA.
 *
 * Sin base: el repositorio es el doble en memoria de tests/_calidadMemoria.js y los proyectos son instancias de verdad de
 * ProduccionProyecto (su lógica corre; save() solo cuenta). Sin WhatsApp: el puente va apagado y el aviso es un espía.
 * Correr:  cd backend && npm test
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const S = await import('../src/services/calidad.service.js');
const { crearRepoMemoria } = await import('./_calidadMemoria.js');

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};

const VELARIA = {
    lleva_membrana: true, lleva_estructura: true, lleva_costura: true, lleva_vulcanizado: false, lleva_cables: true,
    lleva_placas_vertice: true, lleva_mecanismo: false, lleva_rolados: true, lleva_placas_base: true, acabado_estructura: 'pintura'
};
const SOLO_MEMBRANA = { lleva_membrana: true, lleva_costura: false, lleva_estructura: false, acabado_estructura: 'ninguno' };

let repo;
let reportes;
let avisos;
let ctx;
beforeEach(() => {
    banderas({ PANEL_CALIDAD: '1' });
    repo = crearRepoMemoria(ProduccionProyecto);
    S.usarRepoCalidad(repo);
    reportes = [];
    avisos = [];
    ctx = { repo, quien: 'Tableta de Charly', origen: 'tableta', encolarReporte: (id) => reportes.push(id), avisar: async (d) => { avisos.push(d); } };
});
afterEach(() => {
    S.usarRepoCalidad(null);
    for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
});

/** Marca todos los puntos que aplican en ok (o lo que diga `excepto`). */
const llenar = async (ref, atributos, excepto = {}) => {
    await S.cambiarAtributos(ref, { atributos }, ctx);
    const v = await S.vistaObra(ref, { repo });
    for (const h of v.hojas) {
        for (const p of h.puntos) {
            const datos = excepto[p.id] || { estado: 'ok' };
            await S.marcarPunto(ref, p.id, datos, ctx);
        }
    }
    return S.vistaObra(ref, { repo });
};

const espera = async (fn, codigo, texto) => {
    await assert.rejects(fn, (e) => {
        assert.equal(e.codigo, codigo, e.message);
        if (texto) assert.match(e.message, texto);
        return true;
    });
};

// ---------- Estados de la hoja ----------

test('estado de la hoja: sin atributos, sin revisar, en revisión, con defectos, lista y avalada', async () => {
    repo.agregarProyecto({ id: 1, nombre: 'LONA ESCUELA' });
    let v = await S.vistaObra(1, { repo });
    assert.equal(v.hoja.estado, 'sin_revisar');
    assert.equal(v.hoja.faltanAtributos, true);
    assert.deepEqual(v.hoja.porQueNo, ['Falta decir qué lleva la obra']);
    assert.equal(v.hojas.length, 0, 'sin atributos ninguna hoja aplica');

    let r = await S.cambiarAtributos(1, { atributos: SOLO_MEMBRANA }, ctx);
    assert.equal(r.hoja.estado, 'sin_revisar');
    assert.equal(r.hoja.faltanAtributos, false);
    assert.equal(r.hoja.conteos.total, 8);
    v = await S.vistaObra(1, { repo });
    assert.deepEqual(v.hojas.map((h) => h.id), ['MANUFACTURA']);
    assert.deepEqual(v.hojas[0].puntos.map((p) => p.id), ['M1', 'M2', 'M5', 'M9', 'M11', 'M12', 'M13', 'M14']);

    r = await S.marcarPunto(1, 'M1', { estado: 'ok' }, ctx);
    assert.equal(r.hoja.estado, 'en_revision');
    r = await S.marcarPunto(1, 'M2', { estado: 'defecto', nota: 'Mide 5 cm menos', saleAsi: false }, ctx);
    assert.equal(r.hoja.estado, 'con_defectos');
    assert.match(r.hoja.porQueNo.join(' '), /1 defecto sin corregir/);
    r = await S.marcarPunto(1, 'M2', { estado: 'defecto', nota: 'Mide 5 cm menos; el cliente lo aceptó', saleAsi: true }, ctx);
    assert.equal(r.hoja.estado, 'en_revision', 'un defecto que sale así ya no detiene');
    for (const id of ['M5', 'M9', 'M11', 'M12', 'M13']) await S.marcarPunto(1, id, { estado: 'ok' }, ctx);
    r = await S.marcarPunto(1, 'M14', { estado: 'na' }, ctx).catch((e) => e);
    assert.equal(r.codigo, 400, 'M14 no permite «No aplica»');
    r = await S.marcarPunto(1, 'M14', { estado: 'ok' }, ctx);
    assert.equal(r.hoja.estado, 'lista');
    assert.equal(r.hoja.listaParaAvalar, true);
    assert.deepEqual(r.hoja.conteos, { total: 8, ok: 7, na: 0, defectos: 1, salenAsi: 1, pendientes: 0 });
    r = await S.avalar(1, { observacionesInstalacion: 'Llevar escalera larga' }, ctx);
    assert.equal(r.hoja.estado, 'avalada');
    assert.equal(r.hoja.avaladaPor, 'Charly', 'Charly por omisión');
});

test('cambiar atributos recalcula qué aplica; los puntos que dejan de aplicar se conservan pero no cuentan', async () => {
    repo.agregarProyecto({ id: 2, nombre: 'VELARIA PARQUE' });
    await llenar(2, VELARIA);
    let v = await S.vistaObra(2, { repo });
    assert.equal(v.hoja.estado, 'lista');
    assert.equal(v.hoja.conteos.total, 27);
    // Ya no lleva pintura: H7–H11 dejan de aplicar, siguen guardados
    const r = await S.cambiarAtributos(2, { atributos: { acabado_estructura: 'galvanizado' } }, ctx);
    assert.equal(r.hoja.conteos.total, 22);
    assert.equal(r.hoja.estado, 'lista');
    v = await S.vistaObra(2, { repo });
    assert.deepEqual(v.yaNoAplican.map((p) => p.id), ['H7', 'H8', 'H9', 'H10', 'H11']);
    assert.equal(repo._puntos.filter((p) => p.hoja_id === v.hoja.id).length, 27);
    // Atributo que no existe o de otro tipo
    await espera(() => S.cambiarAtributos(2, { atributos: { lleva_lona: true } }, ctx), 400, /no es un atributo/);
    await espera(() => S.cambiarAtributos(2, { atributos: { acabado_estructura: 'cromado' } }, ctx), 400);
});

test('punto: defecto sin nota, «No aplica» sin permiso, punto o estado que no existen, sin atributos y punto que no aplica', async () => {
    repo.agregarProyecto({ id: 3, nombre: 'TOLDO RESTAURANTE' });
    await espera(() => S.marcarPunto(999, 'M1', { estado: 'ok' }, ctx), 404, /No existe esa obra/);
    await espera(() => S.marcarPunto(3, 'M1', { estado: 'ok' }, ctx), 409, /Primero di qué lleva/);
    await S.cambiarAtributos(3, { atributos: SOLO_MEMBRANA }, ctx);
    await espera(() => S.marcarPunto(3, 'M2', { estado: 'defecto', nota: '   ' }, ctx), 400, /necesita una nota/);
    await espera(() => S.marcarPunto(3, 'M1', { estado: 'na' }, ctx), 400, /No aplica/);
    await espera(() => S.marcarPunto(3, 'M99', { estado: 'ok' }, ctx), 404, /no es un punto/);
    await espera(() => S.marcarPunto(3, 'M1', { estado: 'regular' }, ctx), 400, /estado debe ser/);
    await espera(() => S.marcarPunto(3, 'H1', { estado: 'ok' }, ctx), 409, /no aplica a esta obra/);
    await espera(() => S.marcarPunto(3, 'M1', { estado: 'ok', cambioId: 'con espacios' }, ctx), 400, /cambioId/);
    // M5 sí permite «No aplica»; el punto se puede regresar a pendiente
    let r = await S.marcarPunto(3, 'm5', { estado: 'na' }, ctx);
    assert.equal(r.punto.estado, 'na');
    r = await S.marcarPunto(3, 'M5', { estado: 'pendiente', nota: 'se borra' }, ctx);
    assert.equal(r.punto.estado, 'pendiente');
    assert.equal(r.punto.nota, null);
    // Saber quién y desde dónde
    r = await S.marcarPunto(3, 'M1', { estado: 'ok' }, { ...ctx, quien: 'Charly (web)', origen: 'web' });
    assert.equal(r.punto.actualizadoPor, 'Charly (web)');
    assert.equal(r.punto.origen, 'web');
});

test('idempotencia: el mismo cambioId dos veces responde igual sin repetir; uno viejo no pisa a uno nuevo', async () => {
    repo.agregarProyecto({ id: 4, nombre: 'PERGOLA CASA CLUB' });
    await S.cambiarAtributos(4, { atributos: SOLO_MEMBRANA, cambioId: 'tab1-attr-1' }, ctx);
    const otraVez = await S.cambiarAtributos(4, { atributos: { lleva_membrana: false }, cambioId: 'tab1-attr-1' }, ctx);
    assert.equal(otraVez.repetido, true);
    assert.equal(repo._hojas[0].atributos.lleva_membrana, true, 'el repetido no cambió nada');

    const a = await S.marcarPunto(4, 'M2', { estado: 'defecto', nota: 'Costura floja', cambioId: 'tab1-0001', cuando: '2026-10-28T15:00:00Z' }, ctx);
    const eventosAntes = repo._eventos.length;
    const b = await S.marcarPunto(4, 'M2', { estado: 'defecto', nota: 'Costura floja', cambioId: 'tab1-0001', cuando: '2026-10-28T15:00:00Z' }, ctx);
    assert.equal(b.repetido, true);
    assert.equal(repo._eventos.length, eventosAntes, 'no se anotó otra vez');
    assert.deepEqual({ ...b, repetido: false }, { ...a, repetido: false }, 'la respuesta es la misma');
    // Con otro contenido pero el mismo cambioId: tampoco se aplica
    const c = await S.marcarPunto(4, 'M2', { estado: 'ok', cambioId: 'tab1-0001' }, ctx);
    assert.equal(c.repetido, true);
    assert.equal(c.punto.estado, 'defecto');

    // Llega tarde un cambio viejo (sin señal): no pisa al nuevo, pero queda en la bitácora y su cambioId ya cuenta
    await S.marcarPunto(4, 'M1', { estado: 'ok', cambioId: 'tab1-0003', cuando: '2026-10-20T16:00:00Z' }, ctx);
    const tarde = await S.marcarPunto(4, 'M1', { estado: 'defecto', nota: 'viejo', cambioId: 'tab1-0002', cuando: '2026-10-20T15:30:00Z' }, ctx);
    assert.equal(tarde.aplicado, false);
    assert.equal(tarde.punto.estado, 'ok');
    assert.ok(repo._eventos.some((e) => e.tipo === 'marco_tarde' && e.cambio_id === 'tab1-0002'));
    const tardeOtraVez = await S.marcarPunto(4, 'M1', { estado: 'defecto', nota: 'viejo', cambioId: 'tab1-0002', cuando: '2026-10-20T15:30:00Z' }, ctx);
    // Un reloj adelantado no gana: «cuando» en el futuro cuenta como ahora
    const futuro = await S.marcarPunto(4, 'M1', { estado: 'ok', cambioId: 'tab1-0005', cuando: '2030-01-01T00:00:00Z' }, ctx);
    assert.ok(new Date(futuro.punto.actualizadoEn).getTime() <= Date.now());
    assert.equal(tardeOtraVez.repetido, true);
    // …y el repetido dice lo mismo que la primera vez: no se aplicó (la tableta no debe darlo por bueno)
    assert.equal(tardeOtraVez.aplicado, false);
    assert.equal(tardeOtraVez.motivo, tarde.motivo);
    // El mismo cambioId en OTRO cambio (otro punto, los atributos o el aval) no se contesta «repetido»: 409
    await espera(() => S.marcarPunto(4, 'M3', { estado: 'ok', cambioId: 'tab1-0001' }, ctx), 409, /otro cambio/);
    await espera(() => S.marcarPunto(4, 'M3', { estado: 'ok', cambioId: 'tab1-attr-1' }, ctx), 409, /otro cambio/);
    await espera(() => S.cambiarAtributos(4, { atributos: { lleva_costura: true }, cambioId: 'tab1-0001' }, ctx), 409, /otro cambio/);
    await espera(() => S.avalar(4, { nombre: 'Charly', cambioId: 'tab1-0001' }, ctx), 409, /otro cambio/);
    assert.equal(repo._puntos.find((p) => p.punto_id === 'M3'), undefined, 'M3 no se marcó');

    // Dos cambios a la vez con el mismo cambioId (la tableta reintenta mientras el primero se guarda): uno solo se aplica
    const [x, y] = await Promise.all([
        S.marcarPunto(4, 'M5', { estado: 'ok', cambioId: 'tab1-0004' }, ctx),
        S.marcarPunto(4, 'M5', { estado: 'ok', cambioId: 'tab1-0004' }, ctx)
    ]);
    assert.deepEqual([x.repetido, y.repetido].sort(), [false, true]);
    assert.equal(repo._eventos.filter((e) => e.cambio_id === 'tab1-0004').length, 1);
    // Avalar dos veces con el mismo cambioId
    const lista = await llenar(4, SOLO_MEMBRANA);
    assert.equal(lista.hoja.estado, 'lista');
    const av1 = await S.avalar(4, { nombre: 'Charly', cambioId: 'tab1-aval' }, ctx);
    const av2 = await S.avalar(4, { nombre: 'Charly', cambioId: 'tab1-aval' }, ctx);
    assert.equal(av1.hoja.estado, 'avalada');
    assert.equal(av2.repetido, true);
    assert.equal(reportes.length, 1, 'el reporte se encoló una vez');
});

// ---------- Aval y reabrir ----------

test('aval: solo con la hoja lista; bloquea los puntos; encola el reporte; con la bandera de cierre apagada no mueve la obra', async () => {
    banderas({ PANEL_CALIDAD: '1' });
    const p = repo.agregarProyecto({ id: 5, nombre: 'VELARIA PLAZA', manufactura_completado: true, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true, etapa_actual: 'instalacion', instalacion_completado_en: new Date('2026-10-27T18:00:00Z') });
    await S.cambiarAtributos(5, { atributos: VELARIA }, ctx);
    await espera(() => S.avalar(5, {}, ctx), 409, /Todavía no se puede avalar: 27 puntos sin revisar/);
    try { await S.avalar(5, {}, ctx); } catch (e) { assert.deepEqual(e.extra.porQueNo, ['27 puntos sin revisar']); }
    await llenar(5, VELARIA, { H9: { estado: 'defecto', nota: 'Lijado disparejo en una columna', saleAsi: true } });
    const guardadosAntes = repo._guardados.length;
    const r = await S.avalar(5, { nombre: 'Charly', observacionesInstalacion: 'La columna 3 lleva retoque en sitio' }, ctx);
    assert.equal(r.hoja.estado, 'avalada');
    assert.equal(r.cierre, null, 'sin CALIDAD_AVAL_CIERRA no cierra nada');
    assert.equal(repo._guardados.length, guardadosAntes, 'el proyecto no se guardó');
    assert.equal(p.etapa_actual, 'instalacion');
    assert.deepEqual(avisos, []);
    assert.deepEqual(reportes, [repo._hojas[0].id]);
    assert.equal(repo._hojas[0].reporte_estado, 'pendiente');
    assert.equal(repo._hojas[0].observaciones_instalacion, 'La columna 3 lleva retoque en sitio');
    await espera(() => S.marcarPunto(5, 'M1', { estado: 'ok' }, ctx), 409, /avalada/);
    await espera(() => S.cambiarAtributos(5, { atributos: SOLO_MEMBRANA }, ctx), 409, /avalada/);
    await espera(() => S.avalar(5, {}, ctx), 409, /ya está avalada/);
});

test('aval con CALIDAD_AVAL_CIERRA: pasa la obra a Preparado con la lógica del «Preparado» manual y el mismo aviso', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = repo.agregarProyecto({ id: 6, nombre: 'ESTRUCTURA BODEGA', tiene_manufactura: false, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true, etapa_actual: 'produccion' });
    await llenar(6, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    const r = await S.avalar(6, { nombre: 'Charly' }, { ...ctx, usuarioId: null });
    assert.deepEqual(r.cierre, { cerro: true, etapaAntes: 'produccion', etapa: 'instalacion' });
    assert.equal(p.etapa_actual, 'instalacion');
    assert.ok(p.instalacion_completado_en instanceof Date);
    assert.equal(p.instalacion_completado_por, null, 'la tableta no es una sesión');
    assert.equal(p.manufactura_completado, true, 'como el «Preparado» manual');
    assert.equal(p.fecha_completado, null);
    assert.deepEqual(avisos, [{ proyecto: 'ESTRUCTURA BODEGA' }]);
    assert.ok(repo._eventos.some((e) => e.tipo === 'cerro_produccion'));
    // Obra ya en Preparado o cerrada en el Índice: no se toca
    const q = repo.agregarProyecto({ id: 7, nombre: 'YA ENTREGADA', etapa_actual: 'completado', tiene_manufactura: false });
    await llenar(7, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    const r2 = await S.avalar(7, {}, ctx);
    assert.deepEqual(r2.cierre, { cerro: false, etapa: 'completado' });
    assert.equal(q.etapa_actual, 'completado');
    assert.equal(avisos.length, 1);
});

/** Hace que la siguiente llamada a `obj[metodo]` falle una vez (como la base que se cae a medio camino). */
const fallaUnaVez = (obj, metodo, texto = 'se cayó la base') => {
    const real = obj[metodo];
    obj[metodo] = async function (...a) {
        obj[metodo] = real;
        throw new Error(texto);
    };
};

test('aval con CALIDAD_AVAL_CIERRA: si el paso a Preparado falla no queda nada a medias, y el reintento con el mismo cambioId cierra (un aviso)', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = repo.agregarProyecto({ id: 8, nombre: 'ESTRUCTURA ATORADA', tiene_manufactura: false, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true, etapa_actual: 'produccion' });
    await llenar(8, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    fallaUnaVez(p, 'save');
    await assert.rejects(() => S.avalar(8, { nombre: 'Charly', cambioId: 'tab1-aval-8' }, ctx), /se cayó la base/);
    const hoja = repo._hojas.find((h) => h.proyecto_id === 8);
    assert.equal(hoja.avalada_en ?? null, null, 'la hoja no quedó avalada');
    assert.equal(hoja.estado, 'lista');
    assert.equal(repo._eventos.some((e) => e.cambio_id === 'tab1-aval-8' || e.tipo === 'cerro_produccion'), false, 'ni el aval ni el cierre quedaron en la bitácora');
    assert.equal(p.etapa_actual, 'produccion');
    assert.equal(p.instalacion_completado_en ?? null, null);
    assert.equal(p.manufactura_completado, false, 'lo que marcarPreparado alcanzó a cambiar también se deshizo');
    assert.deepEqual([avisos, reportes], [[], []], 'sin aviso ni reporte de algo que no se guardó');
    // Antes, este reintento contestaba «repetido» y la obra se quedaba esperando para siempre
    const r = await S.avalar(8, { nombre: 'Charly', cambioId: 'tab1-aval-8' }, ctx);
    assert.equal(r.repetido, false);
    assert.deepEqual(r.cierre, { cerro: true, etapaAntes: 'produccion', etapa: 'instalacion' });
    assert.equal(r.hoja.estado, 'avalada');
    assert.equal(p.etapa_actual, 'instalacion');
    const r2 = await S.avalar(8, { nombre: 'Charly', cambioId: 'tab1-aval-8' }, ctx);
    assert.equal(r2.repetido, true);
    assert.deepEqual(avisos, [{ proyecto: 'ESTRUCTURA ATORADA' }], 'un solo aviso');
    assert.equal(reportes.length, 1);
    // Si lo que falla es la bitácora del cierre, la obra tampoco queda en Preparado
    const q = repo.agregarProyecto({ id: 18, nombre: 'BITACORA CAIDA', tiene_manufactura: false, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true, etapa_actual: 'produccion' });
    await llenar(18, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    const anotarReal = repo.anotarEvento;
    repo.anotarEvento = async (d) => { if (d.tipo === 'cerro_produccion') throw new Error('se cayó la base'); return anotarReal(d); };
    await assert.rejects(() => S.avalar(18, { nombre: 'Charly', cambioId: 'tab1-aval-18' }, ctx), /se cayó la base/);
    repo.anotarEvento = anotarReal;
    assert.equal(q.etapa_actual, 'produccion');
    assert.equal(repo._hojas.find((h) => h.proyecto_id === 18).avalada_en ?? null, null);
    assert.equal(avisos.length, 1);
});

test('aval: si otra cosa ya pasó la obra a Preparado mientras tanto, el aval no la vuelve a cerrar ni avisa otra vez', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = repo.agregarProyecto({ id: 9, nombre: 'CERRADA A MANO', tiene_manufactura: false, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true, etapa_actual: 'produccion' });
    await llenar(9, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    const cuando = new Date('2026-10-28T19:00:00Z');
    // La obra que leyó el aval dice «produccion»; en la base ya está en Preparado (la oficina la cerró a mano en ese momento)
    repo.proyectoAlDia = async (i) => {
        const fresco = ProduccionProyecto.build({ ...repo._proyectos.get(i).dataValues, etapa_actual: 'instalacion', instalacion_completado_en: cuando }, { isNewRecord: false });
        fresco.save = async () => { throw new Error('no debía guardarse'); };
        return fresco;
    };
    const r = await S.avalar(9, { nombre: 'Charly' }, ctx);
    assert.deepEqual(r.cierre, { cerro: false, etapa: 'instalacion' });
    assert.equal(r.hoja.estado, 'avalada');
    assert.equal(r.obra.etapa, 'instalacion', 'la respuesta dice cómo está ahora');
    assert.deepEqual(avisos, []);
    assert.equal(repo._eventos.some((e) => e.tipo === 'cerro_produccion'), false);
    assert.equal(p.instalacion_completado_en ?? null, null, 'no se tocó la obra');
});

test('punto y qué lleva: si guardar falla a medio camino no queda el evento, y el reintento con el mismo cambioId lo aplica', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_DEFECTO_REABRE: '1' });
    const p = repo.agregarProyecto({ id: 10, nombre: 'LONA CAIDA', tiene_herreria: false, manufactura_completado: true });
    fallaUnaVez(repo, 'actualizarHoja');
    await assert.rejects(() => S.cambiarAtributos(10, { atributos: SOLO_MEMBRANA, cambioId: 'tab1-attr-10' }, ctx), /se cayó la base/);
    assert.equal(repo._eventos.some((e) => e.cambio_id === 'tab1-attr-10'), false);
    const a = await S.cambiarAtributos(10, { atributos: SOLO_MEMBRANA, cambioId: 'tab1-attr-10' }, ctx);
    assert.equal(a.repetido, false);
    assert.equal(a.hoja.faltanAtributos, false);

    fallaUnaVez(repo, 'guardarPunto');
    await assert.rejects(() => S.marcarPunto(10, 'M1', { estado: 'ok', cambioId: 'tab1-p-10' }, ctx), /se cayó la base/);
    assert.equal(repo._eventos.some((e) => e.cambio_id === 'tab1-p-10'), false, 'antes quedaba el evento sin el punto y el reintento decía «repetido»');
    const b = await S.marcarPunto(10, 'M1', { estado: 'ok', cambioId: 'tab1-p-10' }, ctx);
    assert.deepEqual([b.repetido, b.aplicado, b.punto.estado], [false, true, 'ok']);

    // Un defecto que reabre manufactura: si guardar la obra falla, ni el punto ni la reapertura quedan
    fallaUnaVez(p, 'save');
    await assert.rejects(() => S.marcarPunto(10, 'M2', { estado: 'defecto', nota: 'Costura abierta', cambioId: 'tab1-p-11' }, ctx), /se cayó la base/);
    assert.equal(repo._puntos.some((x) => x.punto_id === 'M2'), false);
    assert.equal(repo._eventos.some((e) => e.cambio_id === 'tab1-p-11' || e.tipo === 'defecto_reabrio'), false);
    assert.equal(p.manufactura_completado, true, 'manufactura sigue terminada');
    const c = await S.marcarPunto(10, 'M2', { estado: 'defecto', nota: 'Costura abierta', cambioId: 'tab1-p-11' }, ctx);
    assert.equal(c.reabrio.area, 'manufactura');
    assert.equal(p.manufactura_completado, false);
});

test('reabrir: pide motivo, quita el aval y con CALIDAD_AVAL_CIERRA no descierra la obra (lo anota)', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = repo.agregarProyecto({ id: 8, nombre: 'CUBIERTA ALBERCA', tiene_herreria: false, manufactura_completado: true, etapa_actual: 'produccion' });
    await espera(() => S.reabrir(8, { motivo: 'algo' }, ctx), 409, /no está avalada/);
    await llenar(8, SOLO_MEMBRANA);
    await S.avalar(8, {}, ctx);
    assert.equal(p.etapa_actual, 'instalacion');
    await espera(() => S.reabrir(8, { motivo: '  ' }, ctx), 400, /motivo/);
    const r = await S.reabrir(8, { motivo: 'El cliente pidió cambiar el color del hilo' }, ctx);
    assert.equal(r.hoja.estado, 'lista', 'sin aval, la hoja vuelve a su estado');
    assert.equal(r.hoja.avaladaEn, null);
    assert.equal(r.sigueEnPreparado, true);
    assert.equal(p.etapa_actual, 'instalacion', 'no se descierra sola');
    const ev = repo._eventos.find((e) => e.tipo === 'reabrio');
    assert.match(ev.detalle, /color del hilo.*la oficina decide/);
    // Ya se puede cambiar
    const m = await S.marcarPunto(8, 'M1', { estado: 'defecto', nota: 'Color equivocado' }, ctx);
    assert.equal(m.hoja.estado, 'con_defectos');
});

// ---------- Repintar: CALIDAD_DEFECTO_REABRE ----------

const obraTerminada = (id, nombre, extra = {}) => repo.agregarProyecto({
    id, nombre, etapa_actual: 'produccion', manufactura_completado: true, manufactura_completado_en: new Date('2026-10-26T15:00:00Z'), manufactura_completado_por: 3,
    herreria_completado: true, herreria_completado_en: new Date('2026-10-26T16:00:00Z'), herreria_completado_por: 4,
    herreria_armado_completado: true, herreria_pintado_completado: true, ...extra
});

test('repintar: un defecto que no sale así reabre la subetapa de su hoja (manufactura, pintura y herrería, soldadura)', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_DEFECTO_REABRE: '1' });
    const m = obraTerminada(10, 'OBRA MANUFACTURA');
    await S.cambiarAtributos(10, { atributos: VELARIA }, ctx);
    let r = await S.marcarPunto(10, 'M11', { estado: 'defecto', nota: 'Mancha de grasa' }, ctx);
    assert.deepEqual(r.reabrio, { area: 'manufactura', reabierta: true, regresoDePreparado: false });
    assert.equal(m.manufactura_completado, false);
    assert.equal(m.manufactura_completado_en, null);
    assert.equal(m.herreria_completado, true, 'herrería no se toca');

    const pin = obraTerminada(11, 'OBRA PINTURA');
    await S.cambiarAtributos(11, { atributos: VELARIA }, ctx);
    r = await S.marcarPunto(11, 'H9', { estado: 'defecto', nota: 'Lijado disparejo' }, ctx);
    assert.equal(r.reabrio.area, 'pintura y herrería');
    assert.equal(pin.herreria_pintado_completado, false);
    assert.equal(pin.herreria_completado, false);
    assert.equal(pin.herreria_armado_completado, true, 'la soldadura sigue hecha');
    assert.equal(pin.manufactura_completado, true);

    const sol = obraTerminada(12, 'OBRA SOLDADURA');
    await S.cambiarAtributos(12, { atributos: VELARIA }, ctx);
    r = await S.marcarPunto(12, 'H5', { estado: 'defecto', nota: 'Poro en soldadura de placa base' }, ctx);
    assert.equal(r.reabrio.area, 'herrería');
    assert.equal(sol.herreria_completado, false);
    assert.equal(sol.herreria_armado_completado, false);
    assert.equal(sol.herreria_pintado_completado, true);

    // Corregir la nota del mismo defecto no reabre otra vez; un defecto que sale así no reabre
    const guardados = repo._guardados.length;
    await S.marcarPunto(12, 'H5', { estado: 'defecto', nota: 'Poro en soldadura de placa base (lado norte)' }, ctx);
    await S.marcarPunto(12, 'H1', { estado: 'defecto', nota: 'Perfil distinto, autorizado', saleAsi: true }, ctx);
    assert.equal(repo._guardados.length, guardados);
    assert.equal(repo._eventos.filter((e) => e.tipo === 'defecto_reabrio').length, 3);
});

test('repintar: si la obra ya estaba en Preparado la regresa con regresarEtapa y deja la otra área como estaba; entregada no se toca', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_DEFECTO_REABRE: '1' });
    const p = obraTerminada(13, 'OBRA PREPARADA', { etapa_actual: 'instalacion', instalacion_completado_en: new Date('2026-10-27T15:00:00Z'), instalacion_completado_por: 2, produccion_completado_en: null });
    await S.cambiarAtributos(13, { atributos: VELARIA }, ctx);
    const r = await S.marcarPunto(13, 'M6', { estado: 'defecto', nota: 'Terminal sin prensar' }, ctx);
    assert.deepEqual(r.reabrio, { area: 'manufactura', reabierta: true, regresoDePreparado: true });
    assert.equal(p.etapa_actual, 'produccion');
    assert.equal(p.instalacion_completado_en, null);
    assert.equal(p.manufactura_completado, false);
    assert.equal(p.herreria_completado, true, 'herrería queda terminada como estaba');
    assert.equal(p.herreria_completado_por, 4);

    const e = obraTerminada(14, 'OBRA ENTREGADA', { etapa_actual: 'completado' });
    await S.cambiarAtributos(14, { atributos: VELARIA }, ctx);
    const r2 = await S.marcarPunto(14, 'H10', { estado: 'defecto', nota: 'Escurrimiento de primario' }, ctx);
    assert.deepEqual(r2.reabrio, { area: 'pintura y herrería', reabierta: false });
    assert.equal(e.etapa_actual, 'completado');
    assert.equal(e.herreria_completado, true);
    assert.ok(repo._eventos.some((x) => x.tipo === 'defecto_sin_reabrir'));
});

test('repintar apagado (CALIDAD_DEFECTO_REABRE sin poner): el defecto se anota y la obra no se mueve', async () => {
    banderas({ PANEL_CALIDAD: '1' });
    const p = obraTerminada(15, 'OBRA SIN REABRIR', { etapa_actual: 'instalacion', instalacion_completado_en: new Date() });
    await S.cambiarAtributos(15, { atributos: VELARIA }, ctx);
    const r = await S.marcarPunto(15, 'H11', { estado: 'defecto', nota: 'Raspón' }, ctx);
    assert.equal(r.reabrio, undefined);
    assert.equal(r.hoja.estado, 'con_defectos');
    assert.equal(p.etapa_actual, 'instalacion');
    assert.equal(p.herreria_pintado_completado, true);
    assert.equal(repo._guardados.length, 0);
});

// ---------- Religar ----------

test('religar por ID 3G: el renglón del Excel cambió de id y la hoja lo sigue (queda en la bitácora)', async () => {
    const viejo = repo.agregarProyecto({ id: 20, nombre: 'VELARIA ESCUELA' }, '3G-26-0412');
    await S.cambiarAtributos(20, { atributos: SOLO_MEMBRANA }, ctx);
    await S.marcarPunto(20, 'M1', { estado: 'ok' }, ctx);
    // El sync movió el renglón: el proyecto 20 ya no está y el 33 es la misma obra (mismo ID 3G)
    viejo.activo = false;
    repo._obraIds.delete(20);
    repo.agregarProyecto({ id: 33, nombre: 'VELARIA ESCUELA' }, '3G-26-0412');
    const v = await S.vistaObra('3G-26-0412', { repo });
    assert.equal(v.obra.proyectoId, 33);
    assert.equal(v.hojas[0].puntos.find((p) => p.id === 'M1').estado, 'ok', 'misma hoja');
    assert.equal(repo._hojas.length, 1);
    assert.equal(repo._hojas[0].proyecto_id, 33);
    assert.match(repo._eventos.find((e) => e.tipo === 'religo').detalle, /ID 3G 3G-26-0412.*20 al 33/);
    // Por proyectoId también la encuentra
    assert.equal((await S.vistaObra(33, { repo })).hoja.id, repo._hojas[0].id);
});

test('religar por nombre exacto: los renglones se movieron (el id 40 ahora es otra obra)', async () => {
    const a = repo.agregarProyecto({ id: 40, nombre: 'Velaría  Parque Norte' });
    await S.cambiarAtributos(40, { atributos: SOLO_MEMBRANA }, ctx);
    await S.marcarPunto(40, 'M2', { estado: 'defecto', nota: 'Corte chueco' }, ctx);
    // Se movió el Excel: el renglón 40 ahora es «TOLDO CAFETERÍA» y «VELARIA PARQUE NORTE» quedó en el 41
    a.nombre = 'TOLDO CAFETERÍA';
    repo.agregarProyecto({ id: 41, nombre: 'VELARIA PARQUE NORTE' });
    // La de 40 ya no es suya: no se le enseña la hoja de otra obra
    const v40 = await S.vistaObra(40, { repo });
    assert.equal(v40.hoja.id, null, 'TOLDO CAFETERÍA no tiene hoja');
    assert.equal(repo._hojas[0].proyecto_id, 41, 'la hoja se pasó a su obra');
    const v41 = await S.vistaObra(41, { repo });
    assert.equal(v41.hoja.id, repo._hojas[0].id);
    assert.equal(v41.hojas[0].puntos.find((p) => p.id === 'M2').estado, 'defecto');
    assert.ok(repo._eventos.some((e) => e.tipo === 'religo' && /renglón 40 al 41/.test(e.detalle)));
});

test('religar por nombre exacto cuando la obra llega por el renglón nuevo primero; renombrar no pierde la hoja; homónimas no se cruzan', async () => {
    const a = repo.agregarProyecto({ id: 50, nombre: 'PERGOLA JARDIN' });
    await S.cambiarAtributos(50, { atributos: SOLO_MEMBRANA }, ctx);
    a.nombre = 'OTRA COSA';
    repo.agregarProyecto({ id: 51, nombre: 'Pérgola Jardín' });
    const v51 = await S.vistaObra(51, { repo });
    assert.equal(v51.hoja.id, repo._hojas[0].id);
    assert.equal(repo._hojas[0].proyecto_id, 51);

    // Renombrar: mismo renglón, otro nombre y nadie más se llama así
    const r = repo.agregarProyecto({ id: 60, nombre: 'CUBIERTA ESTACIONAMIENTO' });
    await S.cambiarAtributos(60, { atributos: SOLO_MEMBRANA }, ctx);
    r.nombre = 'CUBIERTA ESTACIONAMIENTO NORTE';
    const v60 = await S.vistaObra(60, { repo });
    const h60 = repo._hojas.find((h) => h.proyecto_id === 60);
    assert.equal(v60.hoja.id, h60.id);
    assert.equal(h60.proyecto_nombre, 'CUBIERTA ESTACIONAMIENTO NORTE');
    assert.ok(repo._eventos.some((e) => e.tipo === 'religo' && /cambió de nombre/.test(e.detalle)));

    // Dos obras activas con el mismo nombre: cada una con la suya
    repo.agregarProyecto({ id: 70, nombre: 'LONA AUDITORIO' });
    repo.agregarProyecto({ id: 71, nombre: 'LONA AUDITORIO' });
    await S.cambiarAtributos(70, { atributos: SOLO_MEMBRANA }, ctx);
    await S.cambiarAtributos(71, { atributos: { ...SOLO_MEMBRANA, lleva_costura: true } }, ctx);
    const h70 = (await S.vistaObra(70, { repo })).hoja.id;
    const h71 = (await S.vistaObra(71, { repo })).hoja.id;
    assert.notEqual(h70, h71);
    assert.equal((await S.vistaObra(70, { repo })).hoja.id, h70);

    // Dos hojas sin dueño con el mismo nombre: no se adivina
    repo._hojas.push({ id: 900, proyecto_id: 998, proyecto_nombre: 'TOLDO X', proyecto_clave: 'toldo x', atributos: null, estado: 'sin_revisar' });
    repo._hojas.push({ id: 901, proyecto_id: 999, proyecto_nombre: 'TOLDO X', proyecto_clave: 'toldo x', atributos: null, estado: 'sin_revisar' });
    repo.agregarProyecto({ id: 80, nombre: 'Toldo X' });
    assert.equal(await S.ligarHoja({ id: 80, nombre: 'Toldo X', obraId: null }, { repo }), null);
});

test('religar tras borrar un renglón: la obra que sube no hereda la hoja avalada ni la que trae ID 3G; si tiene la suya, se queda con la suya', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    // (a) «TOLDO A» se avaló y pasó a Preparado; luego se borró su renglón y el renglón 90 (el sync liga por renglón)
    // ahora es «TOLDO B», que no tenía hoja. B no puede cerrar con la firma de A.
    const a = repo.agregarProyecto({ id: 90, nombre: 'TOLDO A', tiene_herreria: false });
    await llenar(90, SOLO_MEMBRANA);
    await S.avalar(90, { nombre: 'Charly' }, ctx);
    assert.equal(a.etapa_actual, 'instalacion');
    const hojaA = repo._hojas.find((h) => h.proyecto_id === 90);
    a.nombre = 'TOLDO B';
    a.etapa_actual = 'produccion';
    a.instalacion_completado_en = null;
    assert.equal(await S.calidadDetieneCierre(a, { repo }), true, 'B espera su propio aval');
    const vB = await S.vistaObra(90, { repo });
    assert.notEqual(vB.hoja.id, hojaA.id);
    assert.equal(vB.hoja.estado, 'sin_revisar');
    assert.equal(hojaA.proyecto_nombre, 'TOLDO A', 'la hoja avalada de A se conserva tal cual');
    assert.ok(hojaA.avalada_en);
    assert.ok(!repo._eventos.some((e) => e.tipo === 'religo' && /cambió de nombre/.test(e.detalle)));

    // (b) Las dos tenían hoja: se borra «LONA C» (renglón 91) y «LONA D» sube del 92 al 91; el 92 ahora es «LONA E».
    // D se queda con SU hoja (la del nombre exacto) y la de C no se renombra.
    const c = repo.agregarProyecto({ id: 91, nombre: 'LONA C' });
    const d = repo.agregarProyecto({ id: 92, nombre: 'LONA D' });
    await S.cambiarAtributos(91, { atributos: SOLO_MEMBRANA }, ctx);
    await S.marcarPunto(91, 'M1', { estado: 'defecto', nota: 'Color equivocado' }, ctx);
    await S.cambiarAtributos(92, { atributos: SOLO_MEMBRANA }, ctx);
    await S.marcarPunto(92, 'M1', { estado: 'ok' }, ctx);
    const hojaC = repo._hojas.find((h) => h.proyecto_id === 91);
    const hojaD = repo._hojas.find((h) => h.proyecto_id === 92);
    c.nombre = 'LONA D';
    d.nombre = 'LONA E';
    const vD = await S.vistaObra(91, { repo });
    assert.equal(vD.hoja.id, hojaD.id, 'D sigue con su hoja');
    assert.equal(vD.hojas[0].puntos.find((p) => p.id === 'M1').estado, 'ok');
    assert.equal(hojaC.proyecto_nombre, 'LONA C', 'la hoja de C no se le pasó a D');

    // (c) Una hoja con ID 3G no se pasa por un cambio de nombre: el ID 3G ya dice de qué obra es
    const x = repo.agregarProyecto({ id: 93, nombre: 'CUBIERTA X' }, '3G-26-0500');
    await S.cambiarAtributos(93, { atributos: SOLO_MEMBRANA }, ctx);
    repo._obraIds.delete(93);
    x.nombre = 'CUBIERTA Y';
    assert.equal((await S.vistaObra(93, { repo })).hoja.id, null);
    assert.equal(repo._hojas.find((h) => h.obra_id === '3G-26-0500').proyecto_nombre, 'CUBIERTA X');
});

// ---------- El cierre automático: CALIDAD_AVAL_CIERRA ----------

test('cierre automático con las banderas apagadas: completarSubEtapaProduccion hace lo de hoy y no toca calidad', async () => {
    for (const b of [{}, { PANEL_CALIDAD: '1' }, { CALIDAD_AVAL_CIERRA: '1' }]) {
        banderas(b);
        repo = crearRepoMemoria(ProduccionProyecto);
        S.usarRepoCalidad(repo);
        const p = repo.agregarProyecto({ id: 90, nombre: 'OBRA DE HOY', etapa_actual: 'produccion' });
        const r1 = await p.completarSubEtapaProduccion('manufactura', 7);
        assert.deepEqual(Object.keys(r1).sort(), ['autoAvanzado', 'estadoSubEtapas', 'proyecto', 'puedeAvanzarAInstalacion', 'subEtapaCompletada']);
        assert.equal(r1.autoAvanzado, false);
        const r2 = await p.completarSubEtapaProduccion('herreria', 7);
        assert.deepEqual(Object.keys(r2).sort(), ['autoAvanzado', 'estadoSubEtapas', 'proyecto', 'puedeAvanzarAInstalacion', 'subEtapaCompletada']);
        assert.equal(r2.autoAvanzado, true, JSON.stringify(b));
        assert.equal(p.etapa_actual, 'instalacion');
        assert.equal(p.instalacion_completado_por, 7);
        assert.ok(p.instalacion_completado_en instanceof Date);
        assert.equal(repo._hojas.length, 0, 'no se creó hoja');
        assert.equal(repo._eventos.length, 0, 'no se escribió nada de calidad');
        assert.equal(await S.calidadDetieneCierre(p), false);
    }
});

test('cierre automático con CALIDAD_AVAL_CIERRA: la obra espera el aval en producción y la pasa el aval', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = repo.agregarProyecto({ id: 91, nombre: 'OBRA QUE ESPERA', etapa_actual: 'produccion' });
    await p.completarSubEtapaProduccion('manufactura', 7);
    const r = await p.completarSubEtapaProduccion('herreria', 7);
    assert.equal(r.autoAvanzado, false);
    assert.equal(r.esperaCalidad, true);
    assert.equal(r.puedeAvanzarAInstalacion, true, 'producción sí terminó');
    assert.equal(p.etapa_actual, 'produccion');
    assert.ok(!p.instalacion_completado_en);
    assert.equal(repo._eventos.filter((e) => e.tipo === 'espera_calidad').length, 1);
    // Preguntar otra vez (la sincronización del Excel cada 5 min) no repite el evento
    assert.equal(await S.calidadDetieneCierre(p), true);
    assert.equal(repo._eventos.filter((e) => e.tipo === 'espera_calidad').length, 1);
    // El aval la pasa a Preparado con el aviso de siempre
    await llenar(91, VELARIA);
    const av = await S.avalar(91, { nombre: 'Charly' }, ctx);
    assert.equal(av.cierre.cerro, true);
    assert.equal(p.etapa_actual, 'instalacion');
    assert.deepEqual(avisos, [{ proyecto: 'OBRA QUE ESPERA' }]);
    assert.equal(await S.calidadDetieneCierre(p), false);

    // Una obra que llegó a las dos subetapas desde diseño pasa a producción (no a Preparado)
    const d = repo.agregarProyecto({ id: 92, nombre: 'OBRA EN DISEÑO', etapa_actual: 'diseno' });
    await d.completarSubEtapaProduccion('manufactura', null);
    const rd = await d.completarSubEtapaProduccion('herreria', null);
    assert.equal(rd.esperaCalidad, true);
    assert.equal(d.etapa_actual, 'produccion');

    // Avalada antes de terminar: cierra como hoy al terminar
    const t = repo.agregarProyecto({ id: 93, nombre: 'OBRA AVALADA ANTES', etapa_actual: 'produccion' });
    await llenar(93, SOLO_MEMBRANA);
    await S.avalar(93, {}, ctx); // con la bandera: la pasa a Preparado ya (marcarPreparado)
    assert.equal(t.etapa_actual, 'instalacion');

    // Mantenimiento no extensivo y PREMIUM no esperan
    const mto = repo.agregarProyecto({ id: 94, nombre: 'MTO RAPIDO', tipo_proyecto: 'MTO', etapa_actual: 'produccion' });
    assert.equal(await S.calidadDetieneCierre(mto), false);
    const prem = repo.agregarProyecto({ id: 95, nombre: 'PREMIUM', es_premium: true, etapa_actual: 'produccion' });
    assert.equal(await S.calidadDetieneCierre(prem), false);
    const ext = repo.agregarProyecto({ id: 96, nombre: 'MTO EXTENSIVO', tipo_proyecto: 'MTO', es_extensivo: true, etapa_actual: 'produccion' });
    assert.equal(await S.calidadDetieneCierre(ext), true);
});

test('cierre automático: si revisar calidad falla, la obra cierra como hoy (y queda en el registro)', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const roto = { ...repo, obraIdDe: async () => { throw new Error('base caída'); } };
    S.usarRepoCalidad(roto);
    const p = repo.agregarProyecto({ id: 97, nombre: 'OBRA CON FALLA', etapa_actual: 'produccion', manufactura_completado: true });
    const r = await p.completarSubEtapaProduccion('herreria', 1);
    assert.equal(r.autoAvanzado, true);
    assert.equal(p.etapa_actual, 'instalacion');
});

// ---------- Sugerencias ----------

test('sugerencias: se guardan por ID 3G o nombre exacto, sin obra quedan «sin_obra», se aplican y descartan', async () => {
    repo.agregarProyecto({ id: 100, nombre: 'VELARIA HOSPITAL' }, '3G-26-0500');
    repo.agregarProyecto({ id: 101, nombre: 'TOLDO MERCADO' });
    await S.cambiarAtributos(100, { atributos: VELARIA }, ctx);
    const r = await S.recibirSugerencias({
        fecha: '2026-10-28', llamadaId: 'llamada-calidad-0001',
        sugerencias: [
            { obraId: '3G-26-0500', punto: 'm2', estado: 'DEFECTO', nota: 'Dice que le falta una relinga', saleAsi: 'no', discrepancia: 'La hoja dice ok' },
            { obraId: '3G-26-0500', punto: 'H7', estado: 'ok' },
            { folio: 'Toldo Mercado', punto: 'Lavado de lona', estado: 'listo', nota: 'Ya quedó' },
            { obraId: '3G-26-9999', punto: 'M1', estado: 'ok' }
        ]
    }, { origen: 'operacion', repo });
    assert.equal(r.codigo, 200);
    assert.deepEqual({ recibidas: r.cuerpo.recibidas, pendientes: r.cuerpo.pendientes, sinObra: r.cuerpo.sinObra }, { recibidas: 4, pendientes: 3, sinObra: 1 });
    const [s1, s2, s3, s4] = repo._sugerencias;
    assert.equal(s1.punto_id, 'M2');
    assert.equal(s1.estado, 'defecto');
    assert.equal(s1.sale_asi, false);
    assert.equal(s3.punto_id, null, 'punto que no existe');
    assert.match(s3.nota, /Punto «Lavado de lona»: Ya quedó · Estado dicho: «listo»/);
    assert.equal(s3.proyecto_id, 101);
    assert.equal(s4.estado_sugerencia, 'sin_obra');
    assert.equal(s4.obra_id, '3G-26-9999');
    // En la vista de la obra, junto a su punto
    const v = await S.vistaObra(100, { repo });
    assert.equal(v.hoja.sugerenciasPendientes, 2);
    assert.equal(v.hojas[0].puntos.find((p) => p.id === 'M2').sugerencias[0].nota, 'Dice que le falta una relinga');
    // Aplicar: se marca como lo dijo la llamada (origen carla)
    const a = await S.aplicarSugerencia(s1.id, { ...ctx, quien: 'Charly' });
    assert.equal(a.punto.estado, 'defecto');
    assert.equal(a.punto.origen, 'carla');
    assert.equal(a.punto.actualizadoPor, 'Carla (lo aplicó Charly)');
    assert.equal(s1.estado_sugerencia, 'aplicada');
    await espera(() => S.aplicarSugerencia(s1.id, ctx), 409, /aplicada/);
    await espera(() => S.aplicarSugerencia(s3.id, ctx), 409, /no se puede aplicar sola/);
    const d = await S.descartarSugerencia(s3.id, ctx);
    assert.equal(d.sugerencia.estado, 'descartada');
    await espera(() => S.descartarSugerencia(s4.id, ctx), 409, /sin obra/);
    await espera(() => S.aplicarSugerencia(12345, ctx), 404);
    // Errores del cuerpo
    assert.equal((await S.recibirSugerencias({ sugerencias: [] }, { repo })).codigo, 400);
    assert.equal((await S.recibirSugerencias({ fecha: '28/10/2026', sugerencias: [{ obraId: 'x' }] }, { repo })).codigo, 400);
    assert.equal((await S.recibirSugerencias(null, { repo })).codigo, 400);
});

test('sugerencias: un cuerpo con una sugerencia mala no guarda ninguna, y el reenvío corregido de la misma llamada se guarda completo', async () => {
    repo.agregarProyecto({ id: 105, nombre: 'TOLDO TERRAZA' }, '3G-26-0505');
    await S.cambiarAtributos(105, { atributos: SOLO_MEMBRANA }, ctx);
    const buenas = [{ obraId: '3G-26-0505', punto: 'M1', estado: 'ok' }, { obraId: '3G-26-0505', punto: 'M2', estado: 'ok' }];
    for (const mala of [null, 'M3 ok', ['M3']]) {
        const r = await S.recibirSugerencias({ fecha: '2026-10-28', llamadaId: 'llamada-calidad-0105', sugerencias: [...buenas, mala] }, { origen: 'operacion', repo });
        assert.equal(r.codigo, 400);
        assert.match(r.cuerpo.error, /sugerencia 3/);
        assert.equal(repo._sugerencias.length, 0, 'nada a medias');
    }
    const r = await S.recibirSugerencias({ fecha: '2026-10-28', llamadaId: 'llamada-calidad-0105', sugerencias: [...buenas, { obraId: '3G-26-0505', punto: 'M3', estado: 'ok' }] }, { origen: 'operacion', repo });
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.repetida, undefined);
    assert.deepEqual(repo._sugerencias.map((s) => s.punto_id), ['M1', 'M2', 'M3']);
});

// ---------- Para la puerta y la terminal ----------

test('calidad de varias obras (puerta) y «Calidad pide corregir» (terminal), solo leyendo', async () => {
    repo.agregarProyecto({ id: 110, nombre: 'VELARIA COLEGIO' }, '3G-26-0610');
    repo.agregarProyecto({ id: 111, nombre: 'SIN HOJA' });
    await llenar(110, VELARIA, {
        M3: { estado: 'defecto', nota: 'Hilo distinto, llamar al 462 555 0101', saleAsi: false },
        H9: { estado: 'defecto', nota: 'Lijado disparejo', saleAsi: true },
        H5: { estado: 'defecto', nota: 'Poro', saleAsi: false },
        M12: { estado: 'pendiente' }
    });
    const eventos = repo._eventos.length;
    const filas = [repo._proyectos.get(110), repo._proyectos.get(111)];
    const cal = await S.calidadDeObras(filas, new Map([[110, '3G-26-0610']]), { repo, limpiar: (t) => (t ? String(t).replace(/\d{3} \d{3} \d{4}/g, '•••') : null) });
    const c = cal.get(110);
    assert.equal(c.estado, 'con_defectos');
    assert.equal(c.faltanAtributos, false);
    assert.deepEqual(c.pendientes, [{ punto: 'M12', texto: 'Brandeada.' }]);
    assert.deepEqual(c.defectos.map((d) => [d.punto, d.saleAsi]), [['M3', false], ['H5', false], ['H9', true]]);
    assert.match(c.defectos[0].nota, /•••/);
    assert.deepEqual(cal.get(111), { estado: 'sin_revisar', avaladaEn: null, avaladaPor: null, faltanAtributos: true, pendientes: [], defectos: [], observacionesInstalacion: null });
    assert.equal(repo._eventos.length, eventos, 'leer no escribe');
    assert.equal(repo._hojas.length, 1, 'leer no crea hojas');
    const man = await S.correccionesParaArea(filas, 'manufactura', { repo });
    assert.deepEqual(man.get(110).map((d) => d.punto), ['M3']);
    const her = await S.correccionesParaArea(filas, 'herreria', { repo });
    assert.deepEqual(her.get(110).map((d) => d.punto), ['H5'], 'el que sale así no se pide corregir');
    assert.equal(man.has(111), false);
});

test('lista de la tableta: en taller, listas para avalar y avaladas', async () => {
    repo.agregarProyecto({ id: 120, nombre: 'EN TALLER', etapa_actual: 'produccion', cliente: 'Cliente Uno' });
    repo.agregarProyecto({ id: 121, nombre: 'LISTA', etapa_actual: 'produccion' });
    repo.agregarProyecto({ id: 122, nombre: 'AVALADA', etapa_actual: 'produccion', tiene_herreria: false });
    repo.agregarProyecto({ id: 123, nombre: 'YA INSTALADA', etapa_actual: 'instalacion', instalacion_completado_en: new Date() });
    repo.agregarProyecto({ id: 124, nombre: 'PREPARADA SIN INSTALAR', etapa_actual: 'instalacion', instalacion_completado_en: new Date() });
    await llenar(121, SOLO_MEMBRANA);
    await llenar(122, SOLO_MEMBRANA);
    await S.avalar(122, {}, ctx);
    const fechaDe = (p) => ({ fecha: p.id === 123 ? '2026-10-01' : p.id === 124 ? '2026-11-05' : null, fuente: 'indice' });
    const op = { repo, fechaDe, hoyMx: '2026-10-28', ahora: new Date() };
    const taller = await S.listarObras('taller', op);
    assert.deepEqual(taller.obras.map((o) => o.proyectoId), [124, 120]);
    assert.equal(taller.obras.find((o) => o.proyectoId === 124).preparado, true);
    assert.equal(taller.obras.find((o) => o.proyectoId === 120).cliente, 'Cliente Uno');
    assert.deepEqual((await S.listarObras('listas', op)).obras.map((o) => o.proyectoId), [121]);
    const av = await S.listarObras('avaladas', op);
    assert.deepEqual(av.obras.map((o) => o.proyectoId), [122]);
    assert.equal(av.obras[0].hoja.avaladaPor, 'Charly');
});
