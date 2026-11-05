// La tercera parte de la celda del calendario ("NOMBRE / MTO / RETIRO") dice de qué es la cita.
// googleSheets.service la deja en `cliente` junto con la segunda; aquí se comprueba que con eso
// el retiro y la cimentación ya no cuentan como instalación (5-nov-2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverFechasInstalacion } from '../src/services/fechaInstalacion.service.js';

test('el retiro escrito en la tercera parte no es la instalación y sí cuenta como retiro previo', () => {
    const proyectos = [{ id: 1, nombre: 'RYSE | TERESA MURILLO - TOLDO / MTO', tipo_proyecto: 'MTO', fecha_limite: '2026-11-09' }];
    const citas = [
        { nombre: 'TERESA MURILLO', cliente: 'MTO / RETIRO', fecha: '2026-11-02', hora: '11.00 - 12.00 PM' },
        { nombre: 'TERESA MURILLO', cliente: 'MTO', fecha: '2026-11-06', hora: '12.30 - 1.30 PM' }
    ];
    const r = resolverFechasInstalacion(proyectos, citas, '2026-11-05').get(1);
    assert.equal(r.fecha, '2026-11-06');
    assert.equal(r.retiroPrevio, true);
});

test('la cimentación escrita en la tercera parte no es la instalación', () => {
    const proyectos = [{ id: 2, nombre: 'CRIT ECATEPEC | LIC. JONATHAN / GTIA', tipo_proyecto: 'GTIA', fecha_limite: '2026-11-20' }];
    const citas = ['2026-11-05', '2026-11-06', '2026-11-07'].map(fecha => ({ nombre: 'CRIT ECATEPEC', cliente: 'GTIA / CIMENTACIÓN', fecha, hora: '7.00 - 7.30 AM' }));
    const r = resolverFechasInstalacion(proyectos, citas, '2026-11-05').get(2);
    assert.equal(r.fuente, 'indice');
    assert.equal(r.fecha, '2026-11-20');
});

test('con cimentación el día de su fecha del Índice, el proyecto se queda sin fecha hasta que aparezca la instalación', () => {
    const proyectos = [{ id: 3, nombre: 'CRIT ECATEPEC | LIC. JONATHAN / GTIA', tipo_proyecto: 'GTIA', fecha_limite: '2026-11-05' }];
    const cimentacion = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map(fecha => ({ nombre: 'CRIT ECATEPEC', cliente: 'GTIA / CIMENTACIÓN', fecha, hora: '7.00 - 7.30 AM' }));
    const sinInstalar = resolverFechasInstalacion(proyectos, cimentacion, '2026-11-05').get(3);
    assert.equal(sinInstalar.fecha, null);
    assert.equal(sinInstalar.fuente, 'cimentacion');
    const conInstalacion = resolverFechasInstalacion(proyectos, [...cimentacion, { nombre: 'CRIT ECATEPEC', cliente: 'GTIA', fecha: '2026-11-10', hora: '9.00 - 10.00 AM' }], '2026-11-05').get(3);
    assert.equal(conInstalacion.fecha, '2026-11-10');
});
