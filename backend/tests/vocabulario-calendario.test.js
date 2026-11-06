/**
 * Un solo vocabulario del calendario (revisión del 6-nov-2026, punto 9 a y b): la lectura de cada celda, la regla de
 * antes con la bandera apagada, la lista de celdas que Planta no entiende, el tipo de cita de la agenda y la fecha de la
 * puerta de producción con cimentación. Datos inventados.
 * Correr:  cd backend && npm test
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

const {
    clasificarCita, esRetiro, esCimentacion, reglaAnteriorTipoCitas, tipoAnteriorDeCita, motivosNoEntendida, celdasNoEntendidas, vocabularioUnico
} = await import('../src/utils/vocabularioCalendario.js');
const { resolverFechasInstalacion, tipoDeObra } = await import('../src/services/fechaInstalacion.service.js');
const { fechaDeObra, leerDetalle, armarObra } = await import('../src/routes/sistemas/produccion.js');

const cita = (nombre, cliente = null, extra = {}) => ({ nombre, cliente, fecha: '2026-11-10', hora: '9.00 - 10.00 AM', ...extra });
afterEach(() => { delete process.env.CALENDARIO_VOCABULARIO_UNICO; });

test('cada palabra del calendario tiene un solo tipo, en el orden RETIRO, CIMENTACION, EXTENSIVO, MTO, GTIA, INSTALACION', () => {
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MTO / RETIRO')).tipo, 'RETIRO');
    assert.equal(clasificarCita(cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN')).tipo, 'CIMENTACION');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'RETIRAR LONA')).tipo, 'RETIRO', 'cualquier palabra que empiece con RETIR, como Operación');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MANTTO')).tipo, 'MTO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MANTENIMIENTO')).tipo, 'MTO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'REINSTALACIÓN')).tipo, 'MTO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'REINSTALACIÓN')).reinstalacion, true);
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'EXTENSIVO')).tipo, 'EXTENSIVO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MTO')).tipo, 'MTO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MTO'), { esExtensivo: true }).tipo, 'EXTENSIVO', 'un MTO de una obra EXTENSIVO del Índice');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MTO / RETIRO'), { esExtensivo: true }).tipo, 'RETIRO', 'el retiro de un extensivo sigue siendo retiro');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'GARANTÍA')).tipo, 'GTIA');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', null, { tipoProyecto: 'GARANTIA' })).tipo, 'GTIA', 'sin palabra, manda el color');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', null, { tipoProyecto: 'MANTENIMIENTO' })).tipo, 'MTO');
    assert.equal(clasificarCita(cita('ROSA PÉREZ', 'MTO', { tipoProyecto: 'GARANTIA' })).tipo, 'MTO', 'la palabra gana al color');
    assert.equal(clasificarCita(cita('LA ARBOLEDA', 'COCINA')).tipo, 'INSTALACION');
});

test('bandera apagada: retiro y cimentación como antes (palabra exacta); encendida: el vocabulario único', () => {
    assert.equal(vocabularioUnico(), false);
    const retirar = cita('ROSA PÉREZ', 'RETIRAR LONA');
    assert.equal(esRetiro(retirar), false, 'apagada: «RETIRAR» no es la palabra exacta RETIRO');
    assert.equal(esRetiro(cita('ROSA PÉREZ', 'MTO / RETIRO')), true);
    assert.equal(esCimentacion(cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN')), true);
    process.env.CALENDARIO_VOCABULARIO_UNICO = '1';
    assert.equal(vocabularioUnico(), true);
    assert.equal(esRetiro(retirar), true);
    assert.equal(esRetiro(cita('ROSA PÉREZ', 'RETIROS')), true);
    assert.equal(esCimentacion(cita('COLEGIO NORTE', 'CIMENTACIONES')), true);
});

test('el tipo de las citas del día de antes se conserva (campo «tipo»); «tipo_cita» es el nuevo', () => {
    assert.equal(reglaAnteriorTipoCitas(cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN')), 'GTIA');
    assert.equal(clasificarCita(cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN')).tipo, 'CIMENTACION');
    assert.equal(reglaAnteriorTipoCitas(cita('ROSA PÉREZ', 'MTO / RETIRO')), 'RETIRO');
    assert.equal(reglaAnteriorTipoCitas(cita('ROSA PÉREZ', 'MANTTO')), 'INSTALACION', 'antes «MANTTO» no se reconocía');
});

// Verificación del 6-nov-2026: Julia reparte las citas con ['MTO','GTIA','RETIRO'].includes(c.tipo). Si `tipo` tomara
// EXTENSIVO o CIMENTACION, esas citas saldrían de la lista de Carla y se le confirmarían al cliente como instalación.
test('el campo viejo «tipo» de las citas del día siempre es RETIRO, GTIA, MTO o INSTALACION, con la bandera apagada o encendida', () => {
    const ANTERIORES = ['RETIRO', 'GTIA', 'MTO', 'INSTALACION'];
    const DE_CARLA = ['MTO', 'GTIA', 'RETIRO']; // la regla con la que Julia separa las citas de Carla
    const casos = [
        [cita('ROSA PÉREZ', 'MTO'), { esExtensivo: true }],             // MTO de una obra EXTENSIVO del Índice
        [cita('ROSA PÉREZ', 'EXTENSIVO'), {}],
        [cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN'), {}],
        [cita('COLEGIO NORTE', 'CIMENTACIÓN'), {}],
        [cita('ROSA PÉREZ', 'MTO / RETIRO'), { esExtensivo: true }],
        [cita('ROSA PÉREZ', 'RETIRAR LONA'), {}],
        [cita('ROSA PÉREZ', 'MANTTO'), {}],
        [cita('ROSA PÉREZ', 'REINSTALACIÓN'), {}],
        [cita('ROSA PÉREZ', null, { tipoProyecto: 'GARANTIA' }), {}],
        [cita('ROSA PÉREZ', 'MTO / GTIA'), {}],
        [cita('PARQUE SUR', null), { esExtensivo: true }],
        [cita('PARQUE SUR', 'COCINA'), {}]
    ];
    for (const unico of [false, true]) {
        for (const [c, op] of casos) {
            const clasificada = clasificarCita(c, op);
            const tipo = tipoAnteriorDeCita(c, { clasificada, unico });
            const etiqueta = `${c.nombre} / ${c.cliente} (bandera ${unico ? 'encendida' : 'apagada'}): ${tipo}`;
            assert.ok(ANTERIORES.includes(tipo), etiqueta);
            if (!unico) assert.equal(tipo, reglaAnteriorTipoCitas(c), `apagada = la regla de antes · ${etiqueta}`);
            // Encender la bandera nunca saca una cita de la lista de Carla
            if (DE_CARLA.includes(reglaAnteriorTipoCitas(c))) assert.ok(DE_CARLA.includes(tipo), `sigue con Carla · ${etiqueta}`);
        }
    }
    // El escenario del verificador: con la bandera, MTO de un EXTENSIVO sigue MTO y «GTIA / CIMENTACIÓN» sigue GTIA
    assert.equal(tipoAnteriorDeCita(cita('ROSA PÉREZ', 'MTO'), { clasificada: clasificarCita(cita('ROSA PÉREZ', 'MTO'), { esExtensivo: true }), unico: true }), 'MTO');
    assert.equal(tipoAnteriorDeCita(cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN'), { unico: true }), 'GTIA');
    // Lo que la bandera sí mejora: palabras y colores que antes se leían como instalación
    assert.equal(tipoAnteriorDeCita(cita('ROSA PÉREZ', 'RETIRAR LONA'), { unico: true }), 'RETIRO');
    assert.equal(tipoAnteriorDeCita(cita('ROSA PÉREZ', 'MANTTO'), { unico: true }), 'MTO');
    // Sin decirlo, sigue la bandera de verdad (apagada aquí)
    assert.equal(tipoAnteriorDeCita(cita('ROSA PÉREZ', 'MANTTO')), 'INSTALACION');
    process.env.CALENDARIO_VOCABULARIO_UNICO = '1';
    assert.equal(tipoAnteriorDeCita(cita('ROSA PÉREZ', 'MANTTO')), 'MTO');
});

test('celdas que Planta no entiende: palabra mal escrita, color que contradice y dos tipos juntos', () => {
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'MTO / RETRIO')).join(), /RETRIO.*RETIRO/);
    assert.match(motivosNoEntendida(cita('COLEGIO NORTE', 'GTIA / CIMENTASION')).join(), /CIMENTACION/);
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'GRANTIA')).join(), /GARANTIA/);
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'GTA')).join(), /GTIA/);
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'MTO', { tipoProyecto: 'GARANTIA' })).join(), /pintada de garantía/);
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'GTIA', { tipoProyecto: 'MANTENIMIENTO' })).join(), /pintada de mantenimiento/);
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ', 'RETIRO Y REINSTALACIÓN')).join(), /RETIRO y REINSTALACIÓN/);
    // Lo que sí se entiende no sale (nombres, lugares, abreviaturas de siempre)
    for (const [nombre, cliente] of [['JUAN GARCÍA', 'COCINA'], ['LA ARBOLEDA', 'MTO'], ['ROSA PÉREZ', 'MANTTO'], ['COLEGIO NORTE', 'GTIA / CIMENTACIÓN'],
        ['ROSA PÉREZ', 'MTO / RETIRO'], ['MARTÍN RETANA', null], ['ROSA PÉREZ', 'INSTALACIÓN'], ['ROSA PÉREZ', 'EXTENSIVO'], ['GTIA MOTO CLUB', null],
        // Verificación del 6-nov-2026: nombres antes de la diagonal, o que también llegan después, ya no dan falsos avisos
        ['RAMIRO GONZALEZ', 'MTO'], ['JUAN MTZ', 'MTO'], ['RAMIRO GONZALEZ / MTO', null], ['JUAN MTZ / MTO', null],
        ['PARQUE SUR', 'JUAN MTZ / MTO'], ['PARQUE SUR', 'RAMIRO GONZALEZ / MTO'], ['RETRIO ROSA', 'MTO']]) {
        assert.deepEqual(motivosNoEntendida(cita(nombre, cliente)), [], `${nombre} / ${cliente}`);
    }
    // Lo mal escrito después de la diagonal se sigue viendo, venga la celda partida o entera
    assert.match(motivosNoEntendida(cita('ROSA PÉREZ / MTO / RETRIO', null)).join(), /RETRIO.*RETIRO/);
    assert.match(motivosNoEntendida(cita('PARQUE SUR', 'JUAN MTZ / GTA')).join(), /GTA.*GTIA/);
});

test('la lista de celdas no entendidas no repite la misma celda y va por fecha', () => {
    const lista = celdasNoEntendidas([
        cita('ROSA PÉREZ', 'RETRIO', { fecha: '2026-11-12' }),
        cita('ROSA PÉREZ', 'RETRIO', { fecha: '2026-11-12' }),
        cita('ANA RUIZ', 'GTA', { fecha: '2026-11-11' }),
        cita('LUIS MORA', 'MTO', { fecha: '2026-11-11' })
    ]);
    assert.deepEqual(lista.map((c) => [c.fecha, c.celda]), [['2026-11-11', 'ANA RUIZ / GTA'], ['2026-11-12', 'ROSA PÉREZ / RETRIO']]);
});

test('la agenda dice el tipo de cita de cada obra, y EXTENSIVO si la obra lo es en el Índice', () => {
    const proyectos = [
        { id: 1, nombre: 'ROSA PÉREZ / MTO', tipo_proyecto: 'MTO', fecha_limite: null },
        { id: 2, nombre: 'LUIS MORA', tipo_proyecto: 'MTO', es_extensivo: true, fecha_limite: null },
        { id: 3, nombre: 'COLEGIO NORTE', tipo_proyecto: 'GTIA', fecha_limite: '2026-11-10' },
        { id: 4, nombre: 'ANA RUIZ', tipo_proyecto: null, fecha_limite: '2026-11-20' },
        { id: 5, nombre: 'PEDRO SOTO', tipo_proyecto: null, fecha_limite: '2026-11-25' }
    ];
    const citas = [
        cita('ROSA PÉREZ', 'MTO / RETIRO', { fecha: '2026-11-03' }),
        cita('ROSA PÉREZ', 'MTO', { fecha: '2026-11-12' }),
        cita('LUIS MORA', 'MTO', { fecha: '2026-11-13' }),
        cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN', { fecha: '2026-11-10' }),
        cita('PEDRO SOTO', null, { fecha: '2026-11-18' })
    ];
    const r = resolverFechasInstalacion(proyectos, citas, '2026-11-06');
    assert.deepEqual([r.get(1).fecha, r.get(1).tipoCita, r.get(1).retiroPrevio], ['2026-11-12', 'MTO', true]);
    assert.deepEqual([r.get(2).fecha, r.get(2).tipoCita], ['2026-11-13', 'EXTENSIVO']);
    assert.deepEqual([r.get(3).fecha, r.get(3).fuente, r.get(3).tipoCita], [null, 'cimentacion', 'CIMENTACION']);
    assert.deepEqual([r.get(4).fecha, r.get(4).fuente, r.get(4).tipoCita], ['2026-11-20', 'indice', 'INSTALACION']);
    assert.deepEqual([r.get(5).fecha, r.get(5).tipoCita], ['2026-11-18', 'INSTALACION']);
    assert.equal(tipoDeObra({ tipo_proyecto: 'GTIA' }), 'GTIA');
});

test('«RETIRAR LONA»: apagada no es retiro (como hoy); encendida sí, y la reinstalación ya tiene su retiro previo', () => {
    const proyectos = [{ id: 7, nombre: 'ROSA PÉREZ', tipo_proyecto: 'MTO', fecha_limite: null }];
    const citas = [cita('ROSA PÉREZ', 'RETIRAR LONA', { fecha: '2026-11-09' }), cita('ROSA PÉREZ', 'MTO', { fecha: '2026-11-20' })];
    const antes = resolverFechasInstalacion(proyectos, citas, '2026-11-06').get(7);
    assert.equal(antes.fecha, '2026-11-20', 'dos bloques: manda el último');
    assert.equal(antes.retiroPrevio, false, 'apagada: «RETIRAR» no cuenta como retiro previo');
    process.env.CALENDARIO_VOCABULARIO_UNICO = '1';
    const despues = resolverFechasInstalacion(proyectos, citas, '2026-11-06').get(7);
    assert.equal(despues.fecha, '2026-11-20');
    assert.equal(despues.retiroPrevio, true, 'encendida: la reinstalación ya tiene su retiro previo');
});

test('puerta de producción: tipoCita y cimentación nuevos; con la bandera, la cimentación deja la obra sin fecha como en la agenda', () => {
    const detalle = leerDetalle(JSON.stringify({ 3: ['CIMENTACION', '2026-11-10'], 4: ['INSTALACION', null], 9: ['<script>', 'mal'] }));
    assert.deepEqual(detalle.get(9), { tipoCita: null, cimentacion: null }, 'lo que no es un tipo o una fecha no pasa');
    const colegio = { id: 3, fecha_limite: '2026-11-10' };
    const foto = new Map([[3, null], [4, '2026-11-20']]);
    // Sin detalle (quien ya la leía): la forma de siempre
    assert.deepEqual(fechaDeObra(colegio, foto), { fecha: '2026-11-10', fuente: 'indice' });
    // Apagada: misma fecha del Índice, con los dos campos nuevos
    assert.deepEqual(fechaDeObra(colegio, foto, detalle), { fecha: '2026-11-10', fuente: 'indice', tipoCita: 'CIMENTACION', cimentacion: '2026-11-10' });
    process.env.CALENDARIO_VOCABULARIO_UNICO = '1';
    assert.deepEqual(fechaDeObra(colegio, foto, detalle), { fecha: null, fuente: 'cimentacion', tipoCita: 'CIMENTACION', cimentacion: '2026-11-10' });
    assert.deepEqual(fechaDeObra({ id: 4, fecha_limite: '2026-11-20' }, foto, detalle), { fecha: '2026-11-20', fuente: 'indice', tipoCita: 'INSTALACION', cimentacion: null });
    const obra = armarObra({ id: 3, nombre: 'COLEGIO NORTE', tipo_proyecto: 'GTIA', es_extensivo: true, fecha_limite: '2026-11-10', etapa_actual: 'produccion' }, { foto, detalle });
    assert.equal(obra.extensivo, true);
    assert.equal(obra.fechaInstalacion.tipoCita, 'CIMENTACION');
});

test('citas del día: es_extensivo sale de la obra que reclamó el nombre de la cita (mismo cruce que la agenda)', async () => {
    const { extensivoDeCita } = await import('../src/services/fechaInstalacion.service.js');
    const proyectos = [
        { id: 1, nombre: 'LUIS MORA | TOLDO TERRAZA', tipo_proyecto: 'MTO', es_extensivo: true, fecha_limite: null },
        { id: 2, nombre: 'ROSA PÉREZ', tipo_proyecto: 'MTO', es_extensivo: false, fecha_limite: null }
    ];
    const citas = [cita('LUIS MORA', 'MTO', { fecha: '2026-11-13' }), cita('ROSA PÉREZ', 'MTO', { fecha: '2026-11-13' })];
    const esExt = extensivoDeCita(proyectos, citas, '2026-11-06');
    assert.equal(esExt(citas[0]), true);
    assert.equal(esExt(citas[1]), false);
    assert.equal(clasificarCita(citas[0], { esExtensivo: esExt(citas[0]) }).tipo, 'EXTENSIVO');
    assert.equal(esExt(cita('NADIE', 'MTO')), false);
});

test('las tres pantallas dicen lo mismo con la bandera: agenda, puerta de producción y tablero', async () => {
    process.env.CALENDARIO_VOCABULARIO_UNICO = '1';
    const { aplicarFechasCalendario } = await import('../../frontend/src/utils/produccion.js');
    const { conVocabulario } = await import('../src/utils/vocabularioCalendario.js');
    const proyectos = [
        { id: 1, nombre: 'PARQUE SUR', tipo_proyecto: null, fecha_limite: '2026-11-25' },                 // instalación normal
        { id: 2, nombre: 'COLEGIO NORTE', tipo_proyecto: 'GTIA', fecha_limite: '2026-11-10' },            // cimentación
        { id: 3, nombre: 'ROSA PÉREZ', tipo_proyecto: 'MTO', fecha_limite: null },                        // retirar y reinstalar
        { id: 4, nombre: 'LUIS MORA', tipo_proyecto: null, fecha_limite: '2026-11-27' },                  // solo el retiro
        { id: 5, nombre: 'ANA RUIZ', tipo_proyecto: 'MTO', es_extensivo: true, fecha_limite: null }       // extensivo
    ];
    const citas = [
        cita('PARQUE SUR', null, { fecha: '2026-11-12' }),
        cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN', { fecha: '2026-11-10' }),
        cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN', { fecha: '2026-11-11' }),
        cita('ROSA PÉREZ', 'RETIRAR LONA', { fecha: '2026-11-09' }),
        cita('ROSA PÉREZ', 'MTO', { fecha: '2026-11-19' }),
        cita('LUIS MORA', 'MTO / RETIRO', { fecha: '2026-11-13' }),
        cita('ANA RUIZ', 'MTO', { fecha: '2026-11-17' })
    ];
    const agenda = resolverFechasInstalacion(proyectos, citas, '2026-11-06');
    // La puerta lee lo que la pasada de 5 min guarda: la foto (fecha) y el detalle (tipo y cimentación)
    const foto = new Map(proyectos.map((p) => [p.id, agenda.get(p.id).fecha]));
    const detalle = leerDetalle(JSON.stringify(Object.fromEntries(proyectos.map((p) => {
        const f = agenda.get(p.id);
        return [p.id, [f.tipoCita, f.fuente === 'cimentacion' ? f.cimentacion : null]];
    }))));
    const tablero = aplicarFechasCalendario(proyectos.map((p) => ({ ...p })), conVocabulario({ data: { proyectos: citas } }).data.proyectos, 2026, 11);
    const fechaTablero = (p) => (p._fechaInstalacion || (p._sinFechaPorCimentacion ? null : p.fecha_limite) || null);
    for (const p of proyectos) {
        const a = agenda.get(p.id).fecha;
        assert.equal(fechaDeObra(p, foto, detalle).fecha, a, `puerta = agenda (${p.nombre})`);
        assert.equal(fechaTablero(tablero.find((t) => t.id === p.id)), a, `tablero = agenda (${p.nombre})`);
    }
    assert.deepEqual(proyectos.map((p) => agenda.get(p.id).fecha), ['2026-11-12', null, '2026-11-19', '2026-11-27', '2026-11-17']);
    assert.deepEqual(proyectos.map((p) => detalle.get(p.id).tipoCita), ['INSTALACION', 'CIMENTACION', 'MTO', 'INSTALACION', 'EXTENSIVO']);
});
