/**
 * Panel de calidad contra un Postgres de verdad (prueba de integración, opcional). Revisa lo que el doble en memoria
 * solo imita: los únicos de la base (cambio_id de eventos y puntos, hoja + punto) con dos cambios a la vez, el
 * translate() de los nombres con acentos para volver a ligar, las consultas de la lista, la puerta y los reintentos del
 * reporte, y que el aval y la espera del cierre se guarden de verdad en produccion_proyectos.
 *
 * Solo corre con PRUEBA_PG_URL hacia un Postgres LOCAL (127.0.0.1, localhost o [::1]) con las tablas de Planta (por
 * ejemplo una base de prueba creada con los modelos). Sin esa variable, o si no es local, se salta. Crea las tablas de
 * calidad como server.js (sync: crea si no existe, nunca alter) y la columna obra_id si falta. Escribe proyectos
 * «PRUEBA-CAL-<pid>-…» y sus hojas y los borra al terminar. Nunca la apuntes a la base de producción.
 *
 *   PRUEBA_PG_URL=postgres://<usuario>:<contraseña>@127.0.0.1:<puerto>/<base de prueba> node --test tests/calidad-pg.test.js
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};

const URL_PG = process.env.PRUEBA_PG_URL || '';
const esLocal = (() => {
    try {
        return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(URL_PG).hostname);
    } catch {
        return false;
    }
})();
const SALTAR = esLocal ? false : 'sin PRUEBA_PG_URL local: prueba de integración saltada';

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};

const MARCA = `PRUEBA-CAL-${process.pid}`;
let sequelize;
let ProduccionProyecto;
let S;
let Rep;
let M;
const ids = [];
const ctx = { quien: 'Tableta de prueba', origen: 'tableta', encolarReporte: () => {}, avisar: async () => {} };

before(async () => {
    if (!esLocal) return;
    process.env.DATABASE_URL = URL_PG; // antes de cargar la conexión
    process.env.WHATSAPP_PUENTE_TOKEN = '';
    ({ sequelize } = await import('../src/config/database.js'));
    ({ ProduccionProyecto } = await import('../src/models/index.js'));
    M = await import('../src/models/Calidad.js');
    S = await import('../src/services/calidad.service.js');
    Rep = await import('../src/services/calidadReporte.service.js');
    for (const modelo of M.MODELOS_CALIDAD) await modelo.sync();
    await sequelize.query('ALTER TABLE produccion_proyectos ADD COLUMN IF NOT EXISTS obra_id VARCHAR(16)');
});

after(async () => {
    if (!sequelize) return;
    try {
        const [hojas] = await sequelize.query('SELECT id FROM calidad_hojas WHERE proyecto_nombre LIKE :m OR proyecto_id IN (:ids)', { replacements: { m: `${MARCA}%`, ids: ids.length ? ids : [-1] } });
        const h = hojas.map((x) => x.id);
        if (h.length) {
            await sequelize.query('DELETE FROM calidad_puntos WHERE hoja_id IN (:h)', { replacements: { h } });
            await sequelize.query('DELETE FROM calidad_eventos WHERE hoja_id IN (:h)', { replacements: { h } });
            await sequelize.query('DELETE FROM calidad_sugerencias WHERE hoja_id IN (:h)', { replacements: { h } });
            await sequelize.query('DELETE FROM calidad_hojas WHERE id IN (:h)', { replacements: { h } });
        }
        await sequelize.query('DELETE FROM calidad_sugerencias WHERE llamada_id LIKE :m', { replacements: { m: `${MARCA}%` } });
        await sequelize.query('DELETE FROM calidad_eventos WHERE proyecto_id IN (:ids)', { replacements: { ids: ids.length ? ids : [-1] } });
        if (ids.length) await sequelize.query('DELETE FROM produccion_proyectos WHERE id IN (:ids)', { replacements: { ids } });
    } finally {
        for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
        await sequelize.close();
    }
});

const nuevo = async (datos, obraId = null) => {
    const p = await ProduccionProyecto.create({
        etapa_actual: 'produccion', activo: true, tiene_manufactura: true, tiene_herreria: true, tipo_proyecto: 'A', ...datos,
        nombre: `${MARCA}-${datos.nombre}`
    });
    ids.push(p.id);
    if (obraId) await sequelize.query('UPDATE produccion_proyectos SET obra_id = :o WHERE id = :id', { replacements: { o: obraId, id: p.id } });
    return p;
};
const SOLO_MEMBRANA = { lleva_membrana: true, lleva_estructura: false, acabado_estructura: 'ninguno' };
const llenar = async (id, atributos = SOLO_MEMBRANA) => {
    await S.cambiarAtributos(id, { atributos }, ctx);
    const v = await S.vistaObra(id);
    for (const h of v.hojas) for (const p of h.puntos) await S.marcarPunto(id, p.id, { estado: 'ok' }, ctx);
};

test('Postgres: puntos, idempotencia con los únicos de la base y dos cambios a la vez con el mismo cambioId', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1' });
    const p = await nuevo({ nombre: 'IDEMPOTENCIA' });
    await S.cambiarAtributos(p.id, { atributos: SOLO_MEMBRANA, cambioId: `${MARCA}-a1` }, ctx);
    const a = await S.marcarPunto(p.id, 'M2', { estado: 'defecto', nota: 'Corte corto', cambioId: `${MARCA}-p1` }, ctx);
    const b = await S.marcarPunto(p.id, 'M2', { estado: 'ok', cambioId: `${MARCA}-p1` }, ctx);
    assert.equal(b.repetido, true);
    assert.equal(b.punto.estado, 'defecto');
    assert.deepEqual({ ...b, repetido: false }, a);
    const [x, y] = await Promise.all([
        S.marcarPunto(p.id, 'M5', { estado: 'ok', cambioId: `${MARCA}-p2` }, ctx),
        S.marcarPunto(p.id, 'M5', { estado: 'ok', cambioId: `${MARCA}-p2` }, ctx)
    ]);
    assert.deepEqual([x.repetido, y.repetido].sort(), [false, true]);
    const [[{ n }]] = await sequelize.query('SELECT COUNT(*)::int AS n FROM calidad_eventos WHERE cambio_id = :c', { replacements: { c: `${MARCA}-p2` } });
    assert.equal(n, 1);
    const [[{ np }]] = await sequelize.query('SELECT COUNT(*)::int AS np FROM calidad_puntos p JOIN calidad_hojas h ON h.id = p.hoja_id WHERE h.proyecto_id = :id', { replacements: { id: p.id } });
    assert.equal(np, 2, 'un renglón por punto');
});

test('Postgres: el aval con CALIDAD_AVAL_CIERRA y la espera del cierre se guardan en produccion_proyectos; apagada, como hoy', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = await nuevo({ nombre: 'ESPERA AVAL' });
    await p.completarSubEtapaProduccion('manufactura', null);
    const r = await p.completarSubEtapaProduccion('herreria', null);
    assert.equal(r.esperaCalidad, true);
    await p.reload();
    assert.equal(p.etapa_actual, 'produccion');
    assert.equal(p.instalacion_completado_en, null);
    const [ev] = await sequelize.query("SELECT tipo FROM calidad_eventos WHERE proyecto_id = :id AND tipo = 'espera_calidad'", { replacements: { id: p.id } });
    assert.equal(ev.length, 1);
    // La sincronización del Excel no la promueve
    const { recuperarPorSubetapas } = await import('../src/services/produccionSheets.service.js');
    assert.deepEqual(await recuperarPorSubetapas(p, 'produccion'), {});
    await llenar(p.id);
    const av = await S.avalar(p.id, { nombre: 'Charly', observacionesInstalacion: 'Sin pendientes' }, ctx);
    assert.equal(av.cierre.cerro, true);
    const recargado = await ProduccionProyecto.findByPk(p.id);
    assert.equal(recargado.etapa_actual, 'instalacion');
    assert.ok(recargado.instalacion_completado_en);
    const [[h]] = await sequelize.query('SELECT estado, avalada_por, reporte_estado FROM calidad_hojas WHERE proyecto_id = :id', { replacements: { id: p.id } });
    assert.deepEqual(h, { estado: 'avalada', avalada_por: 'Charly', reporte_estado: 'pendiente' });

    banderas({});
    const q = await nuevo({ nombre: 'COMO HOY' });
    await q.completarSubEtapaProduccion('manufactura', null);
    const r2 = await q.completarSubEtapaProduccion('herreria', null);
    assert.equal(r2.autoAvanzado, true);
    await q.reload();
    assert.equal(q.etapa_actual, 'instalacion');
    const [[{ c }]] = await sequelize.query('SELECT COUNT(*)::int AS c FROM calidad_hojas WHERE proyecto_id = :id', { replacements: { id: q.id } });
    assert.equal(c, 0, 'apagada no escribe nada de calidad');
});

test('Postgres: si el aval falla después de guardar la obra en Preparado, la base deshace todo y el reintento con el mismo cambioId cierra', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = await nuevo({ nombre: 'AVAL A MEDIAS', tiene_manufactura: false, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true });
    await llenar(p.id, { lleva_membrana: false, lleva_estructura: true, acabado_estructura: 'galvanizado' });
    // marcarPreparado sí escribe (UPDATE dentro de la transacción) y después algo truena: el peor caso
    const real = ProduccionProyecto.prototype.marcarPreparado;
    ProduccionProyecto.prototype.marcarPreparado = async function (...a) {
        await real.apply(this, a);
        throw new Error('se cayó la base después del UPDATE');
    };
    const cambioId = `${MARCA}-aval-medias`;
    try {
        await assert.rejects(() => S.avalar(p.id, { nombre: 'Charly', cambioId }, ctx), /después del UPDATE/);
    } finally {
        ProduccionProyecto.prototype.marcarPreparado = real;
    }
    const tras = await ProduccionProyecto.findByPk(p.id);
    assert.equal(tras.etapa_actual, 'produccion', 'el UPDATE de produccion_proyectos se deshizo');
    assert.equal(tras.instalacion_completado_en, null);
    const [[h]] = await sequelize.query('SELECT estado, avalada_en FROM calidad_hojas WHERE proyecto_id = :id', { replacements: { id: p.id } });
    assert.deepEqual(h, { estado: 'lista', avalada_en: null });
    const [[{ n }]] = await sequelize.query('SELECT COUNT(*)::int AS n FROM calidad_eventos WHERE cambio_id = :c', { replacements: { c: cambioId } });
    assert.equal(n, 0, 'el evento del aval tampoco quedó');
    const r = await S.avalar(p.id, { nombre: 'Charly', cambioId }, ctx);
    assert.deepEqual([r.repetido, r.cierre.cerro], [false, true]);
    assert.equal((await ProduccionProyecto.findByPk(p.id)).etapa_actual, 'instalacion');
    const otra = await S.avalar(p.id, { nombre: 'Charly', cambioId }, ctx);
    assert.equal(otra.repetido, true);
    // Lo mismo con un punto: el repetido del mismo cambioId en otra transacción se contesta «repetido», sin 500
    const q = await nuevo({ nombre: 'PUNTO A MEDIAS', tiene_herreria: false });
    await S.cambiarAtributos(q.id, { atributos: SOLO_MEMBRANA }, ctx);
    const realGuardar = S.repoSequelize.guardarPunto;
    S.repoSequelize.guardarPunto = async function (...a) {
        await realGuardar.apply(this, a);
        throw new Error('se cayó la base después del punto');
    };
    try {
        await assert.rejects(() => S.marcarPunto(q.id, 'M1', { estado: 'ok', cambioId: `${MARCA}-pm` }, ctx), /después del punto/);
    } finally {
        S.repoSequelize.guardarPunto = realGuardar;
    }
    const [[{ np }]] = await sequelize.query('SELECT COUNT(*)::int AS np FROM calidad_puntos WHERE cambio_id = :c', { replacements: { c: `${MARCA}-pm` } });
    assert.equal(np, 0);
    const m = await S.marcarPunto(q.id, 'M1', { estado: 'ok', cambioId: `${MARCA}-pm` }, ctx);
    assert.deepEqual([m.repetido, m.punto.estado], [false, 'ok']);
    assert.equal((await S.marcarPunto(q.id, 'M1', { estado: 'ok', cambioId: `${MARCA}-pm` }, ctx)).repetido, true);
});

test('Postgres: el aval y la terminal cierran la misma obra al mismo tiempo: se cierra una vez, con un solo «Proyecto completado»', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const avisos = [];
    const ctxAviso = { ...ctx, avisar: async (d) => { avisos.push(d.proyecto); } };
    for (let i = 0; i < 4; i++) {
        const p = await nuevo({ nombre: `CARRERA ${i}`, manufactura_completado: true, herreria_armado_completado: true });
        await llenar(p.id, { lleva_membrana: true, lleva_estructura: true, acabado_estructura: 'galvanizado' });
        // La terminal de Herrería la tiene leída de antes (como la petición que llega con su propia copia)
        const deLaTerminal = await ProduccionProyecto.findByPk(p.id);
        const [aval, terminal] = await Promise.all([
            S.avalar(p.id, { nombre: 'Charly' }, ctxAviso),
            deLaTerminal.completarSubEtapaProduccion('herreria', null)
        ]);
        // La terminal cerró solo si ganó el candado con la hoja ya avalada… y entonces el aval no; o al revés. Nunca los dos.
        const cierres = (aval.cierre?.cerro ? 1 : 0) + (terminal.autoAvanzado ? 1 : 0);
        assert.equal(cierres, 1, `obra ${i}: aval cerro=${aval.cierre?.cerro} · terminal autoAvanzado=${terminal.autoAvanzado}`);
        const enBase = await ProduccionProyecto.findByPk(p.id);
        assert.equal(enBase.etapa_actual, 'instalacion');
        assert.equal(enBase.herreria_completado, true);
    }
    assert.ok(avisos.length <= 4, 'el aval avisa a lo más una vez por obra');
    // Apagada, la terminal cierra como hoy y no se lee nada de más
    banderas({});
    const q = await nuevo({ nombre: 'CARRERA APAGADA', manufactura_completado: true, herreria_armado_completado: true });
    const r = await q.completarSubEtapaProduccion('herreria', null);
    assert.equal(r.autoAvanzado, true);
    assert.equal(await S.proyectoCerradoPorElAval(q), null);
});

test('Postgres: volver a ligar por ID 3G y por nombre con acentos (translate en SQL)', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1' });
    const obraId = `3G-26-${String(9000 + (process.pid % 999)).padStart(4, '0')}`;
    const viejo = await nuevo({ nombre: 'VELARIA ID' }, obraId);
    await S.cambiarAtributos(viejo.id, { atributos: SOLO_MEMBRANA }, ctx);
    await viejo.update({ activo: false });
    await sequelize.query('UPDATE produccion_proyectos SET obra_id = NULL WHERE id = :id', { replacements: { id: viejo.id } });
    const nuevoRenglon = await nuevo({ nombre: 'VELARIA ID' }, obraId);
    const v = await S.vistaObra(obraId);
    assert.equal(v.obra.proyectoId, nuevoRenglon.id);
    assert.equal(v.hoja.faltanAtributos, false, 'es la misma hoja');
    const [[h]] = await sequelize.query('SELECT proyecto_id FROM calidad_hojas WHERE obra_id = :o', { replacements: { o: obraId } });
    assert.equal(h.proyecto_id, nuevoRenglon.id);

    // Por nombre: «Pérgola  Ñandú» y «PERGOLA NANDU» son la misma obra; el renglón viejo ahora es otra
    const a = await nuevo({ nombre: 'Pérgola  Ñandú' });
    await S.cambiarAtributos(a.id, { atributos: SOLO_MEMBRANA }, ctx);
    await a.update({ nombre: `${MARCA}-TOLDO CAFETERÍA` });
    const b = await nuevo({ nombre: 'PERGOLA NANDU' });
    const vb = await S.vistaObra(b.id);
    assert.equal(vb.hoja.faltanAtributos, false, 'se volvió a ligar por nombre');
    const [[hb]] = await sequelize.query('SELECT proyecto_id FROM calidad_hojas WHERE id = :id', { replacements: { id: vb.hoja.id } });
    assert.equal(hb.proyecto_id, b.id);
    const otros = await S.repoSequelize.proyectosActivosPorClave(S.claveNombre(`${MARCA}-pérgola ñandú`));
    assert.deepEqual(otros.map((o) => o.id), [b.id]);
});

test('Postgres: puerta, lista, sugerencias y la consulta de reintentos del reporte', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1' });
    const p = await nuevo({ nombre: 'PUERTA Y LISTA' }, `3G-26-${String(8000 + (process.pid % 999)).padStart(4, '0')}`);
    await llenar(p.id);
    await S.marcarPunto(p.id, 'M11', { estado: 'defecto', nota: 'Mancha; tel 462 555 0105', saleAsi: true }, ctx);
    const obraId = (await S.repoSequelize.obraIdDe(p.id));
    const cal = await S.calidadDeObras([p], new Map([[p.id, obraId]]));
    assert.equal(cal.get(p.id).estado, 'lista');
    assert.deepEqual(cal.get(p.id).defectos.map((d) => d.punto), ['M11']);
    const listas = await S.listarObras('listas', { hoyMx: '2026-10-28' });
    assert.ok(listas.obras.some((o) => o.proyectoId === p.id));
    const r = await S.recibirSugerencias({
        fecha: '2026-10-28', llamadaId: `${MARCA}-llamada`,
        sugerencias: [{ obraId, punto: 'M2', estado: 'defecto', nota: 'Dice que falta revisar' }, { folio: 'NADIE', punto: 'X', estado: 'ok' }]
    });
    assert.deepEqual([r.cuerpo.pendientes, r.cuerpo.sinObra], [1, 1]);
    const otra = await S.recibirSugerencias({ llamadaId: `${MARCA}-llamada`, sugerencias: [{ obraId, punto: 'M2', estado: 'ok' }] });
    assert.equal(otra.cuerpo.repetida, true);
    await S.avalar(p.id, {}, ctx);
    const porReintentar = await Rep.hojasPorReintentar(new Date(Date.now() + 10 * 60000));
    assert.ok(porReintentar.some((h) => h.proyecto_id === p.id), 'la hoja pendiente de subir aparece después de 2 minutos');
    // Un id que no es número no llega a Postgres (findByPk(NaN) falla en la base): 404
    for (const malo of ['abc', '1.5']) {
        await assert.rejects(() => S.aplicarSugerencia(malo, ctx), (e) => e.codigo === 404);
        await assert.rejects(() => S.descartarSugerencia(malo, ctx), (e) => e.codigo === 404);
    }
});

test('Postgres: un renglón borrado no le pasa la hoja avalada a la obra que sube a su lugar', { skip: SALTAR }, async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const a = await nuevo({ nombre: 'RENGLON BORRADO A', tiene_herreria: false });
    await llenar(a.id);
    await S.avalar(a.id, { nombre: 'Charly' }, ctx);
    // El sync liga por renglón: se borró A y su renglón ahora es B, en producción
    await a.update({ nombre: `${MARCA}-RENGLON BORRADO B`, etapa_actual: 'produccion', instalacion_completado_en: null });
    const b = await ProduccionProyecto.findByPk(a.id);
    assert.equal(await S.calidadDetieneCierre(b), true, 'B espera su propio aval');
    const [hojas] = await sequelize.query('SELECT proyecto_nombre, avalada_en IS NOT NULL AS avalada FROM calidad_hojas WHERE proyecto_id = :id ORDER BY id', { replacements: { id: a.id } });
    assert.deepEqual(hojas.map((h) => [h.proyecto_nombre, h.avalada]), [[`${MARCA}-RENGLON BORRADO A`, true], [`${MARCA}-RENGLON BORRADO B`, false]]);
});
