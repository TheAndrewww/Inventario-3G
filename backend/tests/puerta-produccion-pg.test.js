/**
 * Puerta de producción contra un Postgres de verdad (prueba de integración, opcional). Revisa lo que el evaluador falso
 * de puerta-produccion.test.js solo imita: que el orden y el corte de /produccion/cerradas coincidan cuando las horas de
 * cierre se guardaron con microsegundos (NOW() de SQL). Es la regresión de 2caa1a7: con la columna sola, el cursor
 * repetía obras entre páginas.
 *
 * Solo corre con PRUEBA_PG_URL apuntando a un Postgres LOCAL (127.0.0.1, localhost o [::1]) que ya tenga las tablas de
 * Planta, por ejemplo una base de prueba creada con los modelos. Sin esa variable, o si no es local, se salta. Escribe
 * 52 proyectos con nombre «PRUEBA-MICRO-<pid>-…» y los borra al terminar. Nunca la apuntes a la base de producción.
 *
 *   PRUEBA_PG_URL=postgres://<usuario>:<contraseña>@127.0.0.1:<puerto>/<base de prueba> \
 *     node --test tests/puerta-produccion-pg.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

const URL_PG = process.env.PRUEBA_PG_URL || '';
const esLocal = (() => {
    try {
        return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(URL_PG).hostname);
    } catch {
        return false;
    }
})();

test('cerradas contra Postgres: horas con microsegundos, el cursor no repite ni pierde obras', {
    skip: esLocal ? false : 'sin PRUEBA_PG_URL local: prueba de integración saltada'
}, async () => {
    process.env.DATABASE_URL = URL_PG; // antes de cargar la conexión
    const { sequelize } = await import('../src/config/database.js');
    const { leerCerradas } = await import('../src/routes/sistemas/produccion.js');
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
        await sequelize.close();
    }
});
