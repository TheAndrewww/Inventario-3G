/**
 * Migración: Agregar campo codigo_tipo a la tabla articulos
 *
 * Permite almacenar el tipo de código de barras para cada artículo:
 * - EAN13, EAN8, UPCA, UPCE, CODE128, CODE39, QRCODE, DATAMATRIX
 *
 * También amplía el tamaño del campo codigo_ean13 de 13 a 50 caracteres
 * para soportar códigos más largos como CODE128 y QR Codes
 */

import { sequelize } from '../src/config/database.js';

const ejecutarMigracion = async () => {
    try {
        console.log('🔄 Iniciando migración: Agregar soporte para múltiples tipos de códigos de barras...\n');

        // Iniciar transacción
        const transaction = await sequelize.transaction();

        try {
            // 1. Ampliar el campo codigo_ean13 de 13 a 50 caracteres
            console.log('📝 Paso 1/3: Ampliando campo codigo_ean13 de VARCHAR(13) a VARCHAR(50)...');
            await sequelize.query(`
                ALTER TABLE articulos
                ALTER COLUMN codigo_ean13 TYPE VARCHAR(50);
            `, { transaction });
            console.log('✅ Campo codigo_ean13 ampliado correctamente\n');

            // 2. Agregar campo codigo_tipo con valor por defecto 'EAN13'
            console.log('📝 Paso 2/3: Agregando campo codigo_tipo...');
            await sequelize.query(`
                ALTER TABLE articulos
                ADD COLUMN IF NOT EXISTS codigo_tipo VARCHAR(20) NOT NULL DEFAULT 'EAN13'
                CHECK (codigo_tipo IN ('EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX'));
            `, { transaction });
            console.log('✅ Campo codigo_tipo agregado correctamente\n');

            // 3. Agregar comentario al campo
            console.log('📝 Paso 3/3: Agregando comentario descriptivo...');
            await sequelize.query(`
                COMMENT ON COLUMN articulos.codigo_tipo IS
                'Tipo de código de barras: EAN13, EAN8, UPCA, UPCE, CODE128, CODE39, QRCODE, DATAMATRIX';
            `, { transaction });
            console.log('✅ Comentario agregado correctamente\n');

            // Confirmar transacción
            await transaction.commit();

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
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        throw error;
    }
};

// Ejecutar migración
ejecutarMigracion()
    .then(() => {
        console.log('🎉 Proceso completado. Cerrando conexión...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 La migración falló:', error.message);
        process.exit(1);
    });
