/**
 * Script para verificar el estado actual de la base de datos
 * Útil para saber qué migraciones faltan ejecutar
 *
 * Uso: node scripts/verificar-estado-db.js
 */

import dotenv from 'dotenv';
import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';

dotenv.config();

const verificarEstadoDB = async () => {
    try {
        console.log('🔍 Verificando estado de la base de datos...\n');

        // Verificar conexión
        await sequelize.authenticate();
        console.log('✅ Conexión establecida\n');

        // Obtener nombre de la base de datos
        const [dbInfo] = await sequelize.query(
            "SELECT current_database() as db_name",
            { type: QueryTypes.SELECT }
        );
        console.log(`📊 Base de datos: ${dbInfo.db_name}\n`);

        // Verificar tablas existentes
        console.log('📋 Verificando tablas...\n');

        const tablasEsperadas = [
            'usuarios',
            'articulos',
            'categorias',
            'ubicaciones',
            'proveedores',
            'movimientos',
            'detalle_movimientos',
            'pedidos',
            'detalle_pedidos',
            'equipos',
            'ordenes_compra',
            'detalle_ordenes_compra',
            'solicitudes_compra',
            'notificaciones',
            'proyectos',
            'tipos_herramienta_renta',
            'unidades_herramienta_renta',
            'historial_asignaciones_herramienta'
        ];

        const tablasExistentes = await sequelize.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             ORDER BY table_name`,
            { type: QueryTypes.SELECT }
        );

        const nombresTablas = tablasExistentes.map(t => t.table_name);

        for (const tabla of tablasEsperadas) {
            const existe = nombresTablas.includes(tabla);
            console.log(`  ${existe ? '✅' : '❌'} ${tabla}`);
        }

        // Verificar campo es_herramienta en articulos
        console.log('\n📋 Verificando columnas críticas...\n');

        const columnasArticulos = await sequelize.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_name = 'articulos' AND column_name = 'es_herramienta'`,
            { type: QueryTypes.SELECT }
        );

        if (columnasArticulos.length > 0) {
            console.log('  ✅ Campo es_herramienta en articulos existe');
            console.log(`     Tipo: ${columnasArticulos[0].data_type}`);
        } else {
            console.log('  ❌ Campo es_herramienta en articulos NO existe');
        }

        // Contar registros en tablas principales
        console.log('\n📊 Conteo de registros...\n');

        const tablas = ['articulos', 'usuarios', 'categorias', 'ubicaciones'];
        for (const tabla of tablas) {
            try {
                const [{ count }] = await sequelize.query(
                    `SELECT COUNT(*) as count FROM ${tabla}`,
                    { type: QueryTypes.SELECT }
                );
                console.log(`  ${tabla}: ${count} registros`);
            } catch (error) {
                console.log(`  ${tabla}: Tabla no existe`);
            }
        }

        // Verificar si existen herramientas de renta
        if (nombresTablas.includes('tipos_herramienta_renta')) {
            const [{ count }] = await sequelize.query(
                'SELECT COUNT(*) as count FROM tipos_herramienta_renta',
                { type: QueryTypes.SELECT }
            );
            console.log(`  tipos_herramienta_renta: ${count} registros`);

            if (nombresTablas.includes('unidades_herramienta_renta')) {
                const [{ countUnidades }] = await sequelize.query(
                    'SELECT COUNT(*) as countUnidades FROM unidades_herramienta_renta',
                    { type: QueryTypes.SELECT }
                );
                console.log(`  unidades_herramienta_renta: ${countUnidades} registros`);
            }
        }

        // Resumen
        console.log('\n📈 RESUMEN\n');
        const tablasFaltantes = tablasEsperadas.filter(t => !nombresTablas.includes(t));

        if (tablasFaltantes.length === 0) {
            console.log('✅ Todas las tablas necesarias están presentes');
        } else {
            console.log('⚠️  Tablas faltantes:');
            tablasFaltantes.forEach(t => console.log(`   - ${t}`));
        }

        if (columnasArticulos.length === 0) {
            console.log('⚠️  Falta agregar campo es_herramienta a articulos');
        }

        console.log('\n✨ Verificación completada');

    } catch (error) {
        console.error('\n❌ Error al verificar base de datos:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
};

verificarEstadoDB();
