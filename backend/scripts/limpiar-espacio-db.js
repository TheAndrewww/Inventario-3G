/**
 * Script para diagnosticar y liberar espacio en PostgreSQL
 * Ejecutar: node backend/scripts/limpiar-espacio-db.js
 * 
 * Opciones:
 *   --diagnostico   Solo muestra tamaños (default)
 *   --limpiar       Ejecuta la limpieza
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const modo = process.argv.includes('--limpiar') ? 'limpiar' : 'diagnostico';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

async function diagnostico() {
    console.log('📊 === DIAGNÓSTICO DE ESPACIO EN BASE DE DATOS ===\n');

    // 1. Tamaño total de la DB
    const dbSize = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as total,
               pg_database_size(current_database()) as bytes
    `);
    console.log(`📦 Tamaño total de la BD: ${dbSize.rows[0].total}\n`);

    // 2. Tamaño por tabla (top 15)
    const tablas = await pool.query(`
        SELECT 
            schemaname || '.' || tablename as tabla,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total,
            pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as datos,
            pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) as indices,
            pg_total_relation_size(schemaname || '.' || tablename) as bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
        LIMIT 15
    `);
    console.log('📋 Top 15 tablas por tamaño:');
    console.log('─'.repeat(70));
    console.log('Tabla'.padEnd(35) + 'Total'.padEnd(12) + 'Datos'.padEnd(12) + 'Índices');
    console.log('─'.repeat(70));
    for (const t of tablas.rows) {
        const nombre = t.tabla.replace('public.', '');
        console.log(nombre.padEnd(35) + t.total.padEnd(12) + t.datos.padEnd(12) + t.indices);
    }

    // 3. Conteo de registros en tablas grandes
    console.log('\n📊 Conteo de registros en tablas clave:');
    console.log('─'.repeat(50));
    const tablasContar = [
        'notificaciones',
        'image_processing_queue',
        'movimientos',
        'detalle_movimientos',
        'fcm_tokens',
        'produccion_proyectos',
        'ordenes_compra',
        'articulos'
    ];
    for (const tabla of tablasContar) {
        try {
            const count = await pool.query(`SELECT COUNT(*) as total FROM ${tabla}`);
            console.log(`  ${tabla}: ${count.rows[0].total} registros`);
        } catch (e) {
            // Tabla no existe
        }
    }

    // 4. Notificaciones antiguas
    try {
        const notifAntiguas = await pool.query(`
            SELECT COUNT(*) as total FROM notificaciones 
            WHERE created_at < NOW() - INTERVAL '30 days'
        `);
        const notifLeidas = await pool.query(`
            SELECT COUNT(*) as total FROM notificaciones WHERE leida = true
        `);
        console.log(`\n📬 Notificaciones:`);
        console.log(`  Leídas: ${notifLeidas.rows[0].total}`);
        console.log(`  Antiguas (>30 días): ${notifAntiguas.rows[0].total}`);
    } catch (e) {}

    // 5. Cola de imágenes procesadas
    try {
        const queueProcessed = await pool.query(`
            SELECT status, COUNT(*) as total 
            FROM image_processing_queue 
            GROUP BY status
        `);
        console.log(`\n🖼️ Cola de procesamiento de imágenes:`);
        for (const row of queueProcessed.rows) {
            console.log(`  ${row.status}: ${row.total}`);
        }
    } catch (e) {}

    // 6. Bloat (espacio desperdiciado)
    try {
        const deadTuples = await pool.query(`
            SELECT schemaname || '.' || relname as tabla,
                   n_dead_tup as tuplas_muertas,
                   n_live_tup as tuplas_vivas,
                   CASE WHEN n_live_tup > 0 
                        THEN round(100.0 * n_dead_tup / n_live_tup, 1)
                        ELSE 0 END as pct_muerto
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 100
            ORDER BY n_dead_tup DESC
            LIMIT 10
        `);
        if (deadTuples.rows.length > 0) {
            console.log(`\n🗑️ Tablas con tuplas muertas (bloat):`);
            for (const t of deadTuples.rows) {
                const nombre = t.tabla.replace('public.', '');
                console.log(`  ${nombre}: ${t.tuplas_muertas} muertas / ${t.tuplas_vivas} vivas (${t.pct_muerto}%)`);
            }
        }
    } catch (e) {}
}

async function limpiar() {
    console.log('🧹 === LIMPIEZA DE ESPACIO EN BASE DE DATOS ===\n');

    let totalLiberado = 0;

    // 1. Limpiar notificaciones leídas de más de 30 días
    try {
        const res = await pool.query(`
            DELETE FROM notificaciones 
            WHERE (leida = true AND created_at < NOW() - INTERVAL '7 days')
               OR created_at < NOW() - INTERVAL '60 days'
            RETURNING id
        `);
        console.log(`✅ Notificaciones eliminadas: ${res.rowCount}`);
        totalLiberado += res.rowCount;
    } catch (e) {
        console.log(`⚠️ Error limpiando notificaciones: ${e.message}`);
    }

    // 2. Limpiar cola de imágenes procesadas/fallidas
    try {
        const res = await pool.query(`
            DELETE FROM image_processing_queue 
            WHERE status IN ('completed', 'failed', 'error')
               OR created_at < NOW() - INTERVAL '30 days'
            RETURNING id
        `);
        console.log(`✅ Items de cola de imágenes eliminados: ${res.rowCount}`);
        totalLiberado += res.rowCount;
    } catch (e) {
        console.log(`⚠️ Error limpiando cola de imágenes: ${e.message}`);
    }

    // 3. Limpiar tokens FCM duplicados o antiguos
    try {
        // Eliminar duplicados (mantener solo el más reciente por token)
        const res = await pool.query(`
            DELETE FROM fcm_tokens 
            WHERE id NOT IN (
                SELECT DISTINCT ON (token) id 
                FROM fcm_tokens 
                ORDER BY token, updated_at DESC
            )
            RETURNING id
        `);
        console.log(`✅ Tokens FCM duplicados eliminados: ${res.rowCount}`);
        totalLiberado += res.rowCount;
    } catch (e) {
        console.log(`⚠️ Error limpiando tokens FCM: ${e.message}`);
    }

    // 4. Limpiar proyectos de producción completados hace mucho
    try {
        const res = await pool.query(`
            UPDATE produccion_proyectos 
            SET archivos_manufactura = '[]'::jsonb,
                archivos_herreria = '[]'::jsonb
            WHERE etapa_actual = 'completado' 
              AND fecha_completado < NOW() - INTERVAL '90 days'
              AND (jsonb_array_length(COALESCE(archivos_manufactura, '[]'::jsonb)) > 0
                   OR jsonb_array_length(COALESCE(archivos_herreria, '[]'::jsonb)) > 0)
            RETURNING id
        `);
        console.log(`✅ Archivos JSON limpiados de proyectos completados (>90 días): ${res.rowCount}`);
    } catch (e) {
        console.log(`⚠️ Error limpiando archivos de proyectos: ${e.message}`);
    }

    // 5. VACUUM para recuperar espacio
    console.log('\n🔄 Ejecutando VACUUM FULL (puede tardar)...');
    try {
        // VACUUM FULL requiere conexión sin transacción
        const client = await pool.connect();
        await client.query('VACUUM FULL');
        client.release();
        console.log('✅ VACUUM FULL completado');
    } catch (e) {
        console.log(`⚠️ VACUUM FULL falló (${e.message}), intentando VACUUM normal...`);
        try {
            const client = await pool.connect();
            await client.query('VACUUM');
            client.release();
            console.log('✅ VACUUM normal completado');
        } catch (e2) {
            console.log(`⚠️ VACUUM también falló: ${e2.message}`);
        }
    }

    // 6. REINDEX
    console.log('🔄 Reindexando tablas principales...');
    const tablasReindex = ['notificaciones', 'image_processing_queue', 'movimientos', 'articulos'];
    for (const tabla of tablasReindex) {
        try {
            await pool.query(`REINDEX TABLE ${tabla}`);
            console.log(`  ✅ ${tabla} reindexada`);
        } catch (e) {
            // tabla no existe o error
        }
    }

    // Mostrar tamaño final
    const dbSize = await pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as total
    `);
    console.log(`\n📦 Tamaño final de la BD: ${dbSize.rows[0].total}`);
}

async function main() {
    try {
        await diagnostico();

        if (modo === 'limpiar') {
            console.log('\n');
            await limpiar();
        } else {
            console.log('\n💡 Para ejecutar la limpieza, usa: node backend/scripts/limpiar-espacio-db.js --limpiar');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

main();
