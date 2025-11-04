/**
 * Script para ejecutar migración en producción
 *
 * USO:
 * DATABASE_URL="postgresql://..." node backend/migrations/run-migration-prod.js
 *
 * O con variables separadas:
 * DB_HOST="..." DB_PORT="..." DB_NAME="..." DB_USER="..." DB_PASSWORD="..." node backend/migrations/run-migration-prod.js
 */

import pkg from 'pg';
const { Client } = pkg;

const ejecutarMigracion = async () => {
    let client;

    try {
        console.log('🔄 Conectando a la base de datos de producción...\n');

        // Configurar conexión usando DATABASE_URL o variables individuales
        const config = process.env.DATABASE_URL ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Railway requiere SSL
            }
        } : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: {
                rejectUnauthorized: false
            }
        };

        client = new Client(config);
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        console.log('🔄 Iniciando migración: Agregar soporte para múltiples tipos de códigos de barras...\n');

        // Iniciar transacción
        await client.query('BEGIN');

        try {
            // 1. Ampliar el campo codigo_ean13 de 13 a 50 caracteres
            console.log('📝 Paso 1/3: Ampliando campo codigo_ean13 de VARCHAR(13) a VARCHAR(50)...');
            await client.query(`
                ALTER TABLE articulos
                ALTER COLUMN codigo_ean13 TYPE VARCHAR(50);
            `);
            console.log('✅ Campo codigo_ean13 ampliado correctamente\n');

            // 2. Agregar campo codigo_tipo con valor por defecto 'EAN13'
            console.log('📝 Paso 2/3: Agregando campo codigo_tipo...');
            await client.query(`
                ALTER TABLE articulos
                ADD COLUMN IF NOT EXISTS codigo_tipo VARCHAR(20) NOT NULL DEFAULT 'EAN13'
                CHECK (codigo_tipo IN ('EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX'));
            `);
            console.log('✅ Campo codigo_tipo agregado correctamente\n');

            // 3. Agregar comentario al campo
            console.log('📝 Paso 3/3: Agregando comentario descriptivo...');
            await client.query(`
                COMMENT ON COLUMN articulos.codigo_tipo IS
                'Tipo de código de barras: EAN13, EAN8, UPCA, UPCE, CODE128, CODE39, QRCODE, DATAMATRIX';
            `);
            console.log('✅ Comentario agregado correctamente\n');

            // Confirmar transacción
            await client.query('COMMIT');

            console.log('═══════════════════════════════════════════════════');
            console.log('✅ Migración completada exitosamente');
            console.log('═══════════════════════════════════════════════════');
            console.log('\n📊 Cambios aplicados:');
            console.log('   ✓ Campo codigo_ean13: VARCHAR(13) → VARCHAR(50)');
            console.log('   ✓ Nuevo campo codigo_tipo: VARCHAR(20) DEFAULT \'EAN13\'');
            console.log('   ✓ Restricción CHECK para tipos válidos');
            console.log('\n📝 Tipos de código soportados:');
            console.log('   • EAN13  - Código de barras estándar (13 dígitos)');
            console.log('   • EAN8   - Código de barras corto (8 dígitos)');
            console.log('   • UPCA   - Código UPC estándar (12 dígitos)');
            console.log('   • UPCE   - Código UPC corto (6-8 dígitos)');
            console.log('   • CODE128 - Código alfanumérico completo');
            console.log('   • CODE39  - Código alfanumérico simple');
            console.log('   • QRCODE  - Código QR (hasta 4296 caracteres)');
            console.log('   • DATAMATRIX - DataMatrix (hasta 2335 caracteres)');
            console.log('\n');

        } catch (error) {
            // Revertir transacción en caso de error
            await client.query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        console.error('\nDetalles:', error.message);
        throw error;
    } finally {
        if (client) {
            await client.end();
            console.log('🔌 Conexión cerrada');
        }
    }
};

// Ejecutar migración
ejecutarMigracion()
    .then(() => {
        console.log('🎉 Proceso completado.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 La migración falló:', error.message);
        process.exit(1);
    });
