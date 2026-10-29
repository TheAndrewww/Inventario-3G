/**
 * Los PDF de la tablet (check y avance) que Operaciones guarda en la carpeta de PRODUCCIÓN no son producción:
 * no cuentan como manufactura ni se avisan al grupo (jefe, 28-oct-2026).
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esArchivoNoProduccion } from '../src/services/googleDrive.service.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

test('los checks y avances de la tablet no son producción', () => {
    for (const n of [
        'CHECK DE INSTALACION - VELARIA DEPORTIVA PURISIMA DEL RINCON | ING. ROGELIO AYALA 28-10-2026.pdf',
        'CHECK DE SERVICIO - MAURICIO ALANIZ.pdf',
        'CHECK DE GARANTÍA - X.pdf',
        'AVANCE DIA 3 - OBRA 27-10-2026.pdf',
        'AVANCE - OBRA 27-10-2026.pdf',
        'REPORTE_DIARIO 27-10.pdf'
    ]) assert.equal(esArchivoNoProduccion(norm(n)), true, n);
});

test('los planos siguen siendo producción', () => {
    for (const n of ['VELARIA DEPORTIVA - PATRON.pdf', 'MANUFACTURA AVANCE 2.pdf', 'LONA CHECKER.pdf'])
        assert.equal(esArchivoNoProduccion(norm(n)), false, n);
});
