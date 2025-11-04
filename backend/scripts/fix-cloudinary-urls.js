/**
 * Script para corregir URLs de Cloudinary malformadas en la base de datos
 *
 * Problema: Algunas URLs tienen "https//" en lugar de "https://"
 * Solución: Reemplazar todas las URLs malformadas
 *
 * USO:
 * node backend/scripts/fix-cloudinary-urls.js
 *
 * Para producción:
 * DATABASE_URL="postgresql://..." node backend/scripts/fix-cloudinary-urls.js
 */

import pkg from 'pg';
const { Client } = pkg;

const corregirURLs = async () => {
    let client;

    try {
        console.log('🔄 Conectando a la base de datos...\n');

        // Configurar conexión usando DATABASE_URL o variables individuales
        const config = process.env.DATABASE_URL ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Railway requiere SSL
            }
        } : {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'inventario3g',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        };

        client = new Client(config);
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        // Buscar artículos con URLs malformadas
        console.log('🔍 Buscando artículos con URLs malformadas...\n');

        const query = `
            SELECT id, nombre, imagen_url
            FROM articulos
            WHERE imagen_url IS NOT NULL
            AND (imagen_url LIKE '%https//%' OR imagen_url LIKE '%http//%')
        `;

        const result = await client.query(query);

        if (result.rows.length === 0) {
            console.log('✅ No se encontraron URLs malformadas. Todo está correcto.');
            return;
        }

        console.log(`📋 Se encontraron ${result.rows.length} artículo(s) con URLs malformadas:\n`);

        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. ID: ${row.id} - ${row.nombre}`);
            console.log(`   URL malformada: ${row.imagen_url}\n`);
        });

        console.log('🔄 Corrigiendo URLs...\n');

        // Iniciar transacción
        await client.query('BEGIN');

        try {
            // Corregir URLs malformadas
            const updateQuery = `
                UPDATE articulos
                SET imagen_url = REPLACE(REPLACE(imagen_url, 'https//', 'https://'), 'http//', 'http://')
                WHERE imagen_url IS NOT NULL
                AND (imagen_url LIKE '%https//%' OR imagen_url LIKE '%http//%')
                RETURNING id, nombre, imagen_url
            `;

            const updateResult = await client.query(updateQuery);

            // Confirmar transacción
            await client.query('COMMIT');

            console.log('═══════════════════════════════════════════════════');
            console.log(`✅ Se corrigieron ${updateResult.rows.length} URL(s) exitosamente`);
            console.log('═══════════════════════════════════════════════════\n');

            if (updateResult.rows.length > 0) {
                console.log('📋 URLs corregidas:\n');
                updateResult.rows.forEach((row, index) => {
                    console.log(`${index + 1}. ID: ${row.id} - ${row.nombre}`);
                    console.log(`   URL corregida: ${row.imagen_url}\n`);
                });
            }

        } catch (error) {
            // Revertir transacción en caso de error
            await client.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('❌ Error durante la corrección:', error);
        console.error('\nDetalles:', error.message);
        throw error;
    } finally {
        if (client) {
            await client.end();
            console.log('🔌 Conexión cerrada');
        }
    }
};

// Ejecutar corrección
corregirURLs()
    .then(() => {
        console.log('\n🎉 Proceso completado.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 La corrección falló:', error.message);
        process.exit(1);
    });
