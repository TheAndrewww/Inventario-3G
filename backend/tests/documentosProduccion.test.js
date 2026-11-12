import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palabrasDeNombre, archivoParaOperacion } from '../src/routes/sistemas/documentosProduccion.js';

test('documentos de producción: palabras para buscar la obra por nombre', () => {
    assert.deepEqual(palabrasDeNombre('Aracely Gómez Romero / MTO'), ['ARACELY', 'GOMEZ', 'ROMERO']);
    assert.deepEqual(palabrasDeNombre('3G'), []);
});

test('documentos de producción: a Operación solo le va id, nombre, categoría, tipo y fecha (sin ligas de Drive)', () => {
    const a = archivoParaOperacion({ id: 'x1', nombre: 'ORDEN MANUFACTURA.pdf', categoria: 'manufactura', mimeType: 'application/pdf', modificado: '2026-11-10T10:00:00Z', link: 'https://drive' });
    assert.deepEqual(Object.keys(a).sort(), ['categoria', 'id', 'mimeType', 'modificado', 'nombre']);
});
