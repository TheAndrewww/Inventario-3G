/**
 * Reporte de calidad de salida: el PDF (lo que dice y lo que nunca dice), su nombre, la subida a la carpeta de Drive con
 * piezas de mentira y sus reintentos, la agenda (solo aparece con PANEL_CALIDAD) y el clasificador del barrido de Drive
 * (el «CALIDAD - …pdf» no es plano, ni ticket, ni archivo nuevo).
 * Sin base, sin Drive y sin red. Correr:  cd backend && npm test
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};
const errores = [];
console.error = (...a) => errores.push(a.join(' '));
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const S = await import('../src/services/calidad.service.js');
const Rep = await import('../src/services/calidadReporte.service.js');
const { clasificarNombrePDF } = await import('../src/services/googleDrive.service.js');
const { agendaPlanta } = await import('../src/utils/agendaPlanta.js');
const { crearRepoMemoria } = await import('./_calidadMemoria.js');

/** El texto del PDF: abre cada stream comprimido (va con compress: true), como en ticket-drive.test.js. */
const textoDelPDF = (pdf) => {
    const crudo = pdf.toString('latin1');
    const partes = [crudo];
    const patron = /stream\r?\n/g;
    let m;
    while ((m = patron.exec(crudo))) {
        const inicio = m.index + m[0].length;
        const fin = crudo.indexOf('endstream', inicio);
        if (fin < 0) break;
        try { partes.push(inflateSync(pdf.subarray(inicio, fin)).toString('latin1')); } catch { /* no era Flate */ }
        // Después de «endstream» (si no, el patrón vuelve a caer en él y se salta la página siguiente)
        patron.lastIndex = fin + 'endstream'.length;
    }
    return partes.join('\n');
};

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};

let repo;
let ctx;
beforeEach(() => {
    banderas({ PANEL_CALIDAD: '1' });
    repo = crearRepoMemoria(ProduccionProyecto);
    S.usarRepoCalidad(repo);
    ctx = { repo, quien: 'Tableta de Charly', origen: 'tableta', encolarReporte: () => {}, avisar: async () => {} };
});
afterEach(() => {
    S.usarRepoCalidad(null);
    for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
});

const fechaDe = () => ({ fecha: '2026-11-04', fuente: 'calendario' });
const VELARIA = { lleva_membrana: true, lleva_estructura: true, lleva_costura: true, lleva_cables: true, acabado_estructura: 'pintura' };

const obraAvalada = async () => {
    repo.agregarProyecto({ id: 1, nombre: 'VELARIA PLAZA CENTRAL', cliente: 'Plaza; contacto ventas@plaza.example 462 555 0102' }, '3G-26-0412');
    await S.cambiarAtributos(1, { atributos: VELARIA }, ctx);
    const v = await S.vistaObra(1, { repo });
    for (const h of v.hojas) for (const p of h.puntos) await S.marcarPunto(1, p.id, { estado: 'ok' }, ctx);
    await S.marcarPunto(1, 'H9', { estado: 'defecto', nota: 'Lijado disparejo en columna 2; anticipo $12,500 pendiente', saleAsi: true }, ctx);
    await S.avalar(1, { nombre: 'Charly', observacionesInstalacion: 'Retocar pintura en sitio. Llamar al 462 555 0103 antes de llegar' }, { ...ctx, ahora: new Date('2026-10-28T23:30:00Z') });
};

test('el PDF dice la obra, qué lleva, cada punto, lo que sale así, las observaciones y quién avaló; sin teléfonos, correos ni montos', async () => {
    await obraAvalada();
    const { pdf, nombreArchivo, datos } = await Rep.generarReporteDeObra(1, { repo, fechaDe, logo: null, generado: new Date() });
    assert.equal(nombreArchivo, 'CALIDAD - 3G-26-0412 - 2026-10-28.pdf', 'el día es el de México (23:30 UTC sigue siendo 28)');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const t = textoDelPDF(pdf);
    for (const x of ['Reporte de calidad', 'VELARIA PLAZA CENTRAL', '3G-26-0412', '2026-11-04', 'Avalada', 'Control de calidad · Manufactura',
        'Control de calidad · Herrer', 'H9', 'Lijado disparejo', 'sale as', 'Retocar pintura en sitio', 'Charly', 'Autoriza:', 'hora de M']) {
        assert.ok(t.includes(x), `falta «${x}»`);
    }
    for (const x of ['555 0102', '555 0103', 'ventas@plaza', '12,500', '12500']) assert.ok(!t.includes(x), `no debe salir «${x}»`);
    assert.ok(!datos.cliente.includes('@'));
    // La hoja sin avalar sale como vista previa
    await S.reabrir(1, { motivo: 'Revisar otra vez' }, ctx);
    const previa = textoDelPDF((await Rep.generarReporteDeObra(1, { repo, fechaDe, logo: null })).pdf);
    assert.ok(previa.includes('vista previa'));
    // Nombre sin ID 3G: el del proyecto, sin diagonales ni comillas
    assert.equal(Rep.nombreReporte({ obraId: null, proyecto: "TOLDO D'ANGELO / NORTE", fecha: new Date('2026-10-28T18:00:00Z') }), 'CALIDAD - TOLDO D ANGELO NORTE - 2026-10-28.pdf');
});

test('subida a Drive: con piezas de mentira sube a la carpeta del proyecto; sin carpeta, sin permiso o con error se reintenta', async () => {
    await obraAvalada();
    const hoja = repo._hojas[0];
    const subidas = [];
    const piezas = (extra = {}) => ({
        repo, fechaDe, logo: null, escrituraConfigurada: () => true,
        buscarCarpeta: async (nombre) => ({ carpetaId: nombre === 'VELARIA PLAZA CENTRAL' ? 'carpeta-de-prueba' : null }),
        subir: async (carpeta, pdf, nombre) => { subidas.push({ carpeta, nombre, pdf: pdf.length }); return { id: 'archivo-1', name: nombre }; },
        ...extra
    });
    const r = await Rep.subirReporteCalidad(hoja.id, piezas());
    assert.equal(r.estado, 'subido');
    assert.deepEqual(subidas.map((x) => [x.carpeta, x.nombre]), [['carpeta-de-prueba', 'CALIDAD - 3G-26-0412 - 2026-10-28.pdf']]);
    assert.ok(subidas[0].pdf > 1000);
    assert.equal((await Rep.subirReporteCalidad(hoja.id, piezas({ buscarCarpeta: async () => ({ carpetaId: null }) }))).estado, 'sin_carpeta');
    await assert.rejects(() => Rep.subirReporteCalidad(hoja.id, piezas({ escrituraConfigurada: () => false })), /no está autorizado/);
    // Lo que se guarda tras cada intento (10, 20, 40… minutos, como el ticket)
    const ahora = new Date('2026-10-28T12:00:00Z');
    assert.deepEqual(Rep.cambiosReporteTrasIntento({ reporte_intentos: 0 }, { estado: 'subido', archivo: { id: 'a1' } }, ahora),
        { reporte_estado: 'subido', reporte_intentos: 1, reporte_error: null, reporte_siguiente_intento: null, reporte_archivo_id: 'a1' });
    const e = Rep.cambiosReporteTrasIntento({ reporte_intentos: 2 }, { estado: 'error', motivo: 'Drive caído' }, ahora);
    assert.equal(e.reporte_estado, 'error');
    assert.equal(e.reporte_siguiente_intento.getTime() - ahora.getTime(), 40 * 60000);
    assert.equal(Rep.cambiosReporteTrasIntento({}, { estado: 'no_aplica', motivo: 'x' }, ahora).reporte_siguiente_intento, null);
    // procesar: guarda el resultado en la hoja; un error de Drive queda en palabras
    await Rep.procesarReporteCalidad(hoja.id, { repo, subirReporte: async () => { throw Object.assign(new Error('invalid_grant'), {}); } });
    assert.equal(hoja.reporte_estado, 'error');
    assert.match(hoja.reporte_error, /permiso de Google Drive caducó/);
    assert.ok(hoja.reporte_siguiente_intento);
    await Rep.procesarReporteCalidad(hoja.id, { repo, subirReporte: (id) => Rep.subirReporteCalidad(id, piezas()) });
    assert.equal(hoja.reporte_estado, 'subido');
    assert.equal(hoja.reporte_archivo_id, 'archivo-1');
    assert.equal(hoja.reporte_intentos, 2);
    // Ya subido: no se vuelve a subir
    const antes = subidas.length;
    await Rep.procesarReporteCalidad(hoja.id, { repo, subirReporte: (id) => Rep.subirReporteCalidad(id, piezas()) });
    assert.equal(subidas.length, antes);
    // Si la hoja se reabrió, ya no aplica
    await S.reabrir(1, { motivo: 'Cambio' }, ctx);
    assert.equal((await Rep.subirReporteCalidad(hoja.id, piezas())).estado, 'no_aplica');
    // La vuelta de reintentos procesa lo que le toca
    const procesadas = [];
    const n = await Rep.reintentarReportesCalidad({ buscar: async () => [{ id: 5 }, { id: 6 }], procesar: async (id) => procesadas.push(id), pausa: 0 });
    assert.equal(n, 2);
    assert.deepEqual(procesadas, [5, 6]);
});

test('subida a Drive: si el renglón de la hoja ya es otra obra, no sube a la carpeta de esa obra; se reintenta y sube a la suya ya religada', async () => {
    await obraAvalada();
    const hoja = repo._hojas[0];
    // «TOLDO VECINO» (renglón 3) ya tenía su hoja, sin avalar
    const vecino = repo.agregarProyecto({ id: 3, nombre: 'TOLDO VECINO' });
    await S.cambiarAtributos(3, { atributos: VELARIA }, ctx);
    // Antes de subir, el Excel se movió: el renglón 1 ahora es «TOLDO VECINO», la velaria quedó en el 2 y el 3 se vació
    const p1 = repo._proyectos.get(1);
    p1.nombre = 'TOLDO VECINO';
    repo._obraIds.delete(1);
    vecino.activo = false;
    repo.agregarProyecto({ id: 2, nombre: 'VELARIA PLAZA CENTRAL' }, '3G-26-0412');
    const subidas = [];
    const piezas = {
        repo, fechaDe, logo: null, escrituraConfigurada: () => true,
        buscarCarpeta: async (nombre) => ({ carpetaId: `carpeta de ${nombre}` }),
        subir: async (carpeta, pdf, nombre) => { subidas.push([carpeta, nombre]); return { id: 'archivo-2', name: nombre }; }
    };
    // Primera vuelta: el renglón 1 ya no es la velaria; no sube nada (cuenta como error y se reintenta)…
    await Rep.procesarReporteCalidad(hoja.id, { repo, subirReporte: (id) => Rep.subirReporteCalidad(id, piezas) });
    assert.deepEqual(subidas, [], 'nada a la carpeta de TOLDO VECINO');
    assert.equal(hoja.reporte_estado, 'error');
    assert.match(hoja.reporte_error, /ahora es «TOLDO VECINO»/);
    // …y en la siguiente, con la hoja ya ligada a su renglón (por el ID 3G), sube a la carpeta de la velaria
    await S.vistaObra('3G-26-0412', { repo });
    assert.equal(hoja.proyecto_id, 2);
    await Rep.procesarReporteCalidad(hoja.id, { repo, subirReporte: (id) => Rep.subirReporteCalidad(id, piezas) });
    assert.deepEqual(subidas, [['carpeta de VELARIA PLAZA CENTRAL', 'CALIDAD - 3G-26-0412 - 2026-10-28.pdf']]);
    assert.equal(hoja.reporte_estado, 'subido');
});

test('agenda: el reporte de calidad solo aparece con PANEL_CALIDAD; apagada la agenda es la de antes', async () => {
    banderas({});
    const apagada = await agendaPlanta({ ahora: new Date('2026-10-28T15:00:00Z') });
    assert.ok(!apagada.envios.some((e) => e.id === 'pla-calidad-reporte'));
    assert.deepEqual(apagada.envios.map((e) => e.id), [
        'pla-cierre-conteos', 'pla-resumen-ordenes-0800', 'pla-cancelacion-0815', 'pla-barrido-0830', 'pla-corte-conteos',
        'pla-calendario-5min', 'pla-drive-10min', 'pla-tickets-drive', 'pla-correo-orden', 'pla-avisos-cola'
    ]);
    banderas({ PANEL_CALIDAD: '1' });
    const encendida = await agendaPlanta({ ahora: new Date('2026-10-28T15:00:00Z') });
    const e = encendida.envios.find((x) => x.id === 'pla-calidad-reporte');
    assert.ok(e);
    assert.deepEqual(e.interruptor, { variable: 'PANEL_CALIDAD', encendido: true });
    assert.equal(e.linea, 'drive');
    assert.ok(!('soloCon' in e));
});

test('clasificador del barrido de Drive: «CALIDAD - …pdf» se ignora; lo demás como siempre', () => {
    const casos = [
        ['CALIDAD - 3G-26-0412 - 2026-10-28.pdf', 'ignorado'],
        ['CALIDAD - VELARIA HERRERIA NORTE - 2026-10-28.pdf', 'ignorado'],
        ['calidad - Velaría Parque - 2026-10-28.PDF', 'ignorado'],
        ['HERRERIA - VELARIA PARQUE.pdf', 'herreria'],
        ['Herrería columnas.pdf', 'herreria'],
        ['Ticket-PED-271026-1430-03.pdf', 'ticket'],
        ['REPORTE DIARIO 27-oct.pdf', 'ignorado'],
        ['PATRONES DE CORTE.pdf', 'manufactura'],
        // Lo que se parece pero no es el reporte: como siempre
        ['CALIDAD DE LONA.pdf', 'manufactura'],
        ['CONTROL DE CALIDAD HERRERIA.pdf', 'herreria'],
        ['CALIDAD - SIN FECHA.pdf', 'manufactura']
    ];
    for (const [nombre, esperado] of casos) assert.equal(clasificarNombrePDF(nombre), esperado, nombre);
});
