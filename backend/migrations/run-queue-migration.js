/**
 * Script para ejecutar la migración de la cola de procesamiento de imágenes
 * Ejecutar con: node migrations/run-queue-migration.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Pool } = pg;

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Iniciando migración de cola de procesamiento de imágenes...\n');

        // Leer archivo SQL
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const sqlPath = join(__dirname, '20250120_create_image_processing_queue.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        // Ejecutar migración
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('✅ Tabla image_processing_queue creada exitosamente');
        console.log('✅ Índices creados');
        console.log('✅ Triggers configurados');
        console.log('\n🎉 Migración completada con éxito!\n');

        // Verificar estructura
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'image_processing_queue'
            ORDER BY ordinal_position
        `);

        console.log('📋 Estructura de la tabla:');
        console.table(result.rows);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
