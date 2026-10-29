/**
 * Puerta de producción contra un Postgres de verdad (prueba de integración, opcional). Revisa lo que los dobles de
 * puerta-produccion.test.js solo imitan:
 *   1. Que el orden y el corte de /produccion/cerradas coincidan cuando las horas de cierre se guardaron con
 *      microsegundos (NOW() de SQL). Es la regresión de 2caa1a7: con la columna sola, el cursor repetía obras.
 *   2. /produccion/en-curso con VENCIDAS_USA_JULIA y el nombre corto de la ficha: que las consultas corran en Postgres
 *      (orden_seguimiento, proveedores_ficha y la consulta del material del día con la fecha de Julia) y que el material
 *      del día sea el mismo que da el SQL escrito aparte con la misma regla, con la bandera encendida y apagada.
 *   3. Con la bandera, que 2 100 órdenes en camino sin fecha propia no dejen fuera a la que llega hoy (la fecha que manda
 *      se calcula antes del corte, sin tope de lectura).
 *
 * Solo corre con PRUEBA_PG_URL apuntando a un Postgres LOCAL (127.0.0.1, localhost o [::1]) que ya tenga las tablas de
 * Planta, por ejemplo una base de prueba creada con los modelos. Sin esa variable, o si no es local, se salta. Si falta
 * orden_seguimiento, la crea como server.js al arrancar (sync: crea si no existe, nunca alter). Escribe proyectos,
 * proveedores, un ticket, órdenes y renglones de seguimiento marcados «PRUEBA-…-<pid>» y los borra al terminar. Nunca
 * la apuntes a la base de producción.
 *
 *   PRUEBA_PG_URL=postgres://<usuario>:<contraseña>@127.0.0.1:<puerto>/<base de prueba> \
 *     node --test tests/puerta-produccion-pg.test.js
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

const URL_PG = process.env.PRUEBA_PG_URL || '';
const esLocal = (() => {
    try {
        return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(URL_PG).hostname);
    } catch {
        return false;
    }
})();

const SALTAR = esLocal ? false : 'sin PRUEBA_PG_URL local: prueba de integración saltada';
let sequelize;
let P;

before(async () => {
    if (!esLocal) return;
    process.env.DATABASE_URL = URL_PG; // antes de cargar la conexión
    ({ sequelize } = await import('../src/config/database.js'));
    P = await import('../src/routes/sistemas/produccion.js');
});

after(async () => {
    if (sequelize) await sequelize.close();
});

test('cerradas contra Postgres: horas con microsegundos, el cursor no repite ni pierde obras', { skip: SALTAR }, async () => {
    const { leerCerradas } = P;
    const marca = `PRUEBA-MICRO-${process.pid}`;
    // T al milisegundo y hace 20 s: 48 obras un segundo aparte antes de T y 4 en el MISMO milisegundo T con 900, 500,
    // 100 y 0 microsegundos (los id al revés de los microsegundos). La página 1 corta a la mitad de ese milisegundo.
    const T = new Date(Math.floor((Date.now() - 20000) / 1000) * 1000 + 123);
    try {
        const [antes] = await sequelize.query(
            `INSERT INTO produccion_proyectos (nombre, etapa_actual, activo, instalacion_completado_en, created_at, updated_at)
             SELECT :marca || '-' || g, 'instalacion', true,
                    CAST(:t AS timestamptz) - ((48 - g) * interval '1 second') + interval '250 microseconds', now(), now()
               FROM generate_series(0, 47) g
             RETURNING id`,
            { replacements: { marca, t: T.toISOString() } }
        );
        const grupo = [];
        for (const us of [900, 500, 100, 0]) {
            const [[fila]] = await sequelize.query(
                `INSERT INTO produccion_proyectos (nombre, etapa_actual, activo, instalacion_completado_en, created_at, updated_at)
                 VALUES (:nombre, 'completado', true, CAST(:t AS timestamptz) + (:us * interval '1 microsecond'), now(), now())
                 RETURNING id`,
                { replacements: { nombre: `${marca}-us${us}`, t: T.toISOString(), us } }
            );
            grupo.push(fila.id);
        }
        const mias = new Set([...antes.map((f) => f.id), ...grupo]);
        const esperado = [...antes.map((f) => f.id).sort((a, b) => a - b), ...[...grupo].sort((a, b) => a - b)];

        const ahora = new Date();
        let query = { desde: new Date(T.getTime() - 49000).toISOString() };
        const vistas = [];
        const paginas = [];
        for (let vuelta = 0; vuelta < 10; vuelta++) {
            const r = await leerCerradas({ query }, { ahora });
            assert.equal(r.codigo, 200);
            paginas.push(r.cuerpo.obras.length);
            vistas.push(...r.cuerpo.obras.map((o) => o.proyectoId));
            if (!r.cuerpo.hayMas) break;
            query = { desde: r.cuerpo.siguiente.desde, despuesDe: String(r.cuerpo.siguiente.despuesDe) };
        }
        assert.equal(new Set(vistas).size, vistas.length, `obras repetidas entre páginas: ${paginas.join('+')}`);
        assert.deepEqual(vistas.filter((id) => mias.has(id)), esperado, 'todas, en orden (milisegundo e id)');
    } finally {
        await sequelize.query('DELETE FROM produccion_proyectos WHERE nombre LIKE :patron', { replacements: { patron: `${marca}-%` } });
    }
});

// El material del día escrito aparte, en SQL, para comparar con la puerta.
//   - Apagada (como hoy): fecha propia hasta hoy (UTC), en el orden de la consulta de siempre.
//   - Encendida: la fecha de Julia (el renglón más reciente de Finanzas con fecha, como fechasEstimadasJulia) manda si es
//     más nueva que el día UTC de la orden o si la orden no tiene; hoy primero y luego las más recientes, id para desempatar.
const SQL_DEL_DIA_APAGADA = `
    SELECT ticket_id, to_char((fecha_llegada_estimada AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS llegada
      FROM ordenes_compra
     WHERE estado IN ('enviada', 'parcial') AND fecha_recepcion IS NULL AND fecha_llegada_estimada < CAST(:manana AS timestamptz)
     ORDER BY fecha_llegada_estimada DESC, id ASC LIMIT 50`;
const SQL_DEL_DIA_CON_JULIA = `
    WITH j AS (
        SELECT DISTINCT ON (orden_id) orden_id, fecha_estimada FROM orden_seguimiento
         WHERE origen = 'finanzas' AND fecha_estimada IS NOT NULL
         ORDER BY orden_id, fecha DESC, id DESC
    ), o AS (
        SELECT oc.id, oc.ticket_id, (oc.fecha_llegada_estimada AT TIME ZONE 'UTC')::date AS propia, j.fecha_estimada AS julia
          FROM ordenes_compra oc LEFT JOIN j ON j.orden_id = oc.id
         WHERE oc.estado IN ('enviada', 'parcial') AND oc.fecha_recepcion IS NULL
    ), l AS (
        SELECT id, ticket_id, CASE WHEN julia IS NOT NULL AND (propia IS NULL OR julia > propia) THEN julia ELSE propia END AS llegada FROM o
    )
    SELECT ticket_id, to_char(llegada, 'YYYY-MM-DD') AS llegada FROM l
     WHERE llegada <= CAST(:hoy AS date) ORDER BY llegada DESC, id ASC LIMIT 50`;

const resumen = (ordenes) => ordenes.map((o) => [o.folio, o.llegadaEstimada, o.vencida, o.llegadaDeJulia ?? false, 'llegadaOrden' in o ? o.llegadaOrden : '—', o.proveedor]);

test('en-curso contra Postgres: la llegada de Julia (VENCIDAS_USA_JULIA) y el nombre corto de la ficha', { skip: SALTAR }, async () => {
    const { leerEnCurso } = P;
    const { default: OrdenSeguimiento } = await import('../src/models/OrdenSeguimiento.js');
    await OrdenSeguimiento.sync(); // como server.js al arrancar: crea si no existe, nunca alter
    const marca = `PRUEBA-JULIA-${process.pid}`;
    const patron = `${marca}-%`;
    const ahora = new Date();
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(ahora);
    const dia = (n) => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
    const q = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
    const huella = (t) => crypto.createHash('sha256').update(t).digest('hex');
    const antes = process.env.VENCIDAS_USA_JULIA;
    try {
        const [{ id: usuario }] = await q('SELECT id FROM usuarios ORDER BY id LIMIT 1');
        const [{ id: articulo }] = await q('SELECT id FROM articulos ORDER BY id LIMIT 1');
        const proveedor = async (nombre) => (await q('INSERT INTO proveedores (nombre, activo, created_at, updated_at) VALUES (:nombre, true, now(), now()) RETURNING id', { nombre }))[0].id;
        const conFicha = await proveedor(`${marca}-ACEROS DEL BAJIO SA DE CV`);
        const sinCorto = await proveedor(`${marca}-LONAS SA`);
        const corto = `Aceros ${process.pid}`;
        await q(`INSERT INTO proveedores_ficha (proveedor_id, nombre_corto, razones_sociales, alias, contactos, created_at, updated_at)
                 VALUES (:a, :corto, '[]', '[]', '[{"telefono":"4625550101"}]', now(), now()), (:b, NULL, '[]', '[]', '[]', now(), now())`,
        { a: conFicha, b: sinCorto, corto });
        const [obra] = await q(`INSERT INTO produccion_proyectos (nombre, etapa_actual, activo, created_at, updated_at)
                                VALUES (:nombre, 'produccion', true, now(), now()) RETURNING id`, { nombre: `${marca}-OBRA` });
        const [ticket] = await q(`INSERT INTO movimientos (ticket_id, tipo, fecha_hora, usuario_id, proyecto, estado, created_at, updated_at)
                                  VALUES (:t, 'pedido', now(), :u, :p, 'pendiente', now(), now()) RETURNING id`, { t: `${marca}-T1`, u: usuario, p: `${marca}-OBRA` });
        // Tres órdenes en camino de la obra: (A) venció ayer y Julia la espera pasado mañana; (B) sin fecha propia, Julia
        // dijo ayer y luego hoy (manda el renglón más reciente; el de Planta no cuenta); (C) hace 4 días, sin Julia.
        const oc = {};
        for (const [letra, llegada, prov] of [['A', dia(-1), conFicha], ['B', null, sinCorto], ['C', dia(-4), sinCorto]]) {
            const [fila] = await q(`INSERT INTO ordenes_compra (ticket_id, proveedor_id, usuario_creador_id, estado, fecha_llegada_estimada, created_at, updated_at)
                                    VALUES (:t, :p, :u, 'enviada', CAST(:l AS timestamptz), now(), now()) RETURNING id`,
            { t: `${marca}-OC${letra}`, p: prov, u: usuario, l: llegada ? `${llegada}T00:00:00Z` : null });
            oc[letra] = fila.id;
            await q(`INSERT INTO solicitudes_compra (ticket_id, articulo_id, cantidad_solicitada, pedido_origen_id, usuario_solicitante_id, orden_compra_id, estado, created_at, updated_at)
                     VALUES (:t, :a, 2, :m, :u, :oc, 'en_orden', now(), now())`, { t: `${marca}-SC${letra}`, a: articulo, m: ticket.id, u: usuario, oc: fila.id });
        }
        const seguir = (orden, folio, origen, horasAtras, estimada) => q(`INSERT INTO orden_seguimiento (orden_id, folio, origen, tipo, estado, fecha, fecha_estimada, huella, created_at)
            VALUES (:orden, :folio, :origen, :tipo, 'pedida', now() - (:h * interval '1 hour'), CAST(:e AS date), :huella, now())`,
        { orden, folio, origen, tipo: origen === 'planta' ? 'llegada' : 'estado', h: horasAtras, e: estimada, huella: huella(`${folio}-${horasAtras}`) });
        await seguir(oc.A, `${marca}-OCA`, 'finanzas', 1, dia(2));
        await seguir(oc.B, `${marca}-OCB`, 'finanzas', 2, dia(-1));
        await seguir(oc.B, `${marca}-OCB`, 'finanzas', 1, hoy);
        await seguir(oc.B, `${marca}-OCB`, 'planta', 0, dia(5));
        // Más fechas de Julia sobre las órdenes de la base (1 de cada 4 en camino), de 6 días atrás a 4 adelante: unas
        // recorren la fecha, otras son más viejas que la de la orden y otras dan fecha a una que no tenía.
        await q(`INSERT INTO orden_seguimiento (orden_id, folio, origen, tipo, estado, fecha, fecha_estimada, huella, created_at)
                 SELECT id, :marca || '-S' || id, 'finanzas', 'estado', 'pedida', now() - interval '3 hours',
                        CAST(:hoy AS date) + ((id % 11) - 6), md5(:marca || '-' || id) || md5(id || '-' || :marca), now()
                   FROM ordenes_compra
                  WHERE estado IN ('enviada', 'parcial') AND fecha_recepcion IS NULL AND id % 4 = 0 AND ticket_id NOT LIKE :patron`,
        { marca, hoy, patron });

        const pagina = { query: { despuesDe: String(obra.id - 1) } };
        // Encendida
        process.env.VENCIDAS_USA_JULIA = '1';
        const r = await leerEnCurso(pagina, { ahora });
        assert.equal(r.codigo, 200);
        assert.deepEqual(r.cuerpo.avisos, []);
        const mia = r.cuerpo.obras.find((o) => o.proyectoId === obra.id);
        assert.deepEqual(resumen(mia.material.ordenes), [
            [`${marca}-OCA`, dia(2), false, true, dia(-1), corto],
            [`${marca}-OCB`, hoy, false, true, null, `${marca}-LONAS SA`],
            [`${marca}-OCC`, dia(-4), true, false, '—', `${marca}-LONAS SA`]
        ]);
        const primera = await leerEnCurso({ query: {} }, { ahora });
        assert.equal(primera.codigo, 200);
        const sql = await q(SQL_DEL_DIA_CON_JULIA, { hoy });
        assert.deepEqual(primera.cuerpo.material.ordenes.map((o) => [o.folio, o.llegadaEstimada]), sql.map((f) => [f.ticket_id, f.llegada]), 'material del día = SQL (encendida)');
        const b = primera.cuerpo.material.ordenes.find((o) => o.folio === `${marca}-OCB`);
        assert.equal(!!b, sql.some((f) => f.ticket_id === `${marca}-OCB`));
        if (b) assert.equal(b.llegadaDeJulia, true);
        assert.ok(!primera.cuerpo.material.ordenes.some((o) => o.folio === `${marca}-OCA`), 'la A (Julia la recorrió) no se esperaba hoy');

        // Apagada: la de la orden, sin leer a Julia; el nombre corto sigue (no depende de la bandera)
        delete process.env.VENCIDAS_USA_JULIA;
        const r0 = await leerEnCurso(pagina, { ahora });
        assert.deepEqual(resumen(r0.cuerpo.obras.find((o) => o.proyectoId === obra.id).material.ordenes), [
            [`${marca}-OCA`, dia(-1), true, false, '—', corto],
            [`${marca}-OCB`, null, false, false, '—', `${marca}-LONAS SA`],
            [`${marca}-OCC`, dia(-4), true, false, '—', `${marca}-LONAS SA`]
        ]);
        const primera0 = await leerEnCurso({ query: {} }, { ahora });
        const sql0 = await q(SQL_DEL_DIA_APAGADA, { manana: `${dia(1)}T00:00:00Z` });
        assert.deepEqual(primera0.cuerpo.material.ordenes.map((o) => [o.folio, o.llegadaEstimada]), sql0.map((f) => [f.ticket_id, f.llegada]), 'material del día = SQL (apagada)');
        assert.ok(!JSON.stringify(primera0.cuerpo).includes('llegadaDeJulia'), 'apagada: la respuesta de siempre');
        assert.ok(!JSON.stringify([r.cuerpo, primera.cuerpo, r0.cuerpo, primera0.cuerpo]).includes('4625550101'), 'de la ficha solo sale el nombre corto');
    } finally {
        if (antes === undefined) delete process.env.VENCIDAS_USA_JULIA; else process.env.VENCIDAS_USA_JULIA = antes;
        await q('DELETE FROM orden_seguimiento WHERE folio LIKE :patron', { patron });
        await q('DELETE FROM solicitudes_compra WHERE ticket_id LIKE :patron', { patron });
        await q('DELETE FROM movimientos WHERE ticket_id LIKE :patron', { patron });
        await q('DELETE FROM ordenes_compra WHERE ticket_id LIKE :patron', { patron });
        await q('DELETE FROM proveedores_ficha WHERE proveedor_id IN (SELECT id FROM proveedores WHERE nombre LIKE :patron)', { patron });
        await q('DELETE FROM proveedores WHERE nombre LIKE :patron', { patron });
        await q('DELETE FROM produccion_proyectos WHERE nombre LIKE :patron', { patron });
    }
});

test('en-curso contra Postgres con VENCIDAS_USA_JULIA: 2 100 órdenes sin fecha propia no dejan fuera a la que llega hoy', { skip: SALTAR }, async () => {
    const { leerEnCurso } = P;
    const { default: OrdenSeguimiento } = await import('../src/models/OrdenSeguimiento.js');
    await OrdenSeguimiento.sync(); // como server.js al arrancar: crea si no existe, nunca alter
    const marca = `PRUEBA-TOPE-${process.pid}`;
    const patron = `${marca}-%`;
    const ahora = new Date();
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(ahora);
    const ayer = (() => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10); })();
    const q = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
    const antes = process.env.VENCIDAS_USA_JULIA;
    try {
        const [{ id: usuario }] = await q('SELECT id FROM usuarios ORDER BY id LIMIT 1');
        const [{ id: prov }] = await q('INSERT INTO proveedores (nombre, activo, created_at, updated_at) VALUES (:n, true, now(), now()) RETURNING id', { n: `${marca}-PROV` });
        // 2 100 en camino sin fecha propia (más que el tope de 2 000 que tenía la lectura de candidatas) y, después, la de hoy
        await q(`INSERT INTO ordenes_compra (ticket_id, proveedor_id, usuario_creador_id, estado, fecha_llegada_estimada, created_at, updated_at)
                 SELECT :marca || '-N' || g, :p, :u, 'enviada', NULL, now(), now() FROM generate_series(1, 2100) g`, { marca, p: prov, u: usuario });
        await q(`INSERT INTO ordenes_compra (ticket_id, proveedor_id, usuario_creador_id, estado, fecha_llegada_estimada, created_at, updated_at)
                 VALUES (:t, :p, :u, 'parcial', CAST(:l AS timestamptz), now(), now())`,
        { t: `${marca}-HOY`, p: prov, u: usuario, l: `${hoy}T00:00:00Z` });
        // A una de las sin fecha, Julia la esperaba ayer: entra como vencida
        const [conJulia] = await q('SELECT id FROM ordenes_compra WHERE ticket_id = :t', { t: `${marca}-N1500` });
        await q(`INSERT INTO orden_seguimiento (orden_id, folio, origen, tipo, estado, fecha, fecha_estimada, huella, created_at)
                 VALUES (:o, :f, 'finanzas', 'estado', 'pedida', now(), CAST(:e AS date), md5(:f) || md5(:f || '-2'), now())`,
        { o: conJulia.id, f: `${marca}-N1500`, e: ayer });

        process.env.VENCIDAS_USA_JULIA = '1';
        const r = await leerEnCurso({ query: {} }, { ahora });
        assert.equal(r.codigo, 200);
        assert.deepEqual(r.cuerpo.avisos, []);
        const folios = r.cuerpo.material.ordenes.map((o) => o.folio);
        assert.ok(folios.includes(`${marca}-HOY`), 'la de hoy sale aunque haya 2 100 sin fecha propia');
        const deJulia = r.cuerpo.material.ordenes.find((o) => o.folio === `${marca}-N1500`);
        assert.deepEqual(deJulia && [deJulia.llegadaEstimada, deJulia.vencida, deJulia.llegadaDeJulia, deJulia.llegadaOrden], [ayer, true, true, null]);
        assert.ok(!folios.some((f) => f.startsWith(`${marca}-N`) && f !== `${marca}-N1500`), 'sin fecha y sin Julia no entran');
        const sql = await q(SQL_DEL_DIA_CON_JULIA, { hoy });
        assert.deepEqual(r.cuerpo.material.ordenes.map((o) => [o.folio, o.llegadaEstimada]), sql.map((f) => [f.ticket_id, f.llegada]), 'material del día = SQL (encendida)');
    } finally {
        if (antes === undefined) delete process.env.VENCIDAS_USA_JULIA; else process.env.VENCIDAS_USA_JULIA = antes;
        await q('DELETE FROM orden_seguimiento WHERE folio LIKE :patron', { patron });
        await q('DELETE FROM ordenes_compra WHERE ticket_id LIKE :patron', { patron });
        await q('DELETE FROM proveedores WHERE nombre LIKE :patron', { patron });
    }
});
