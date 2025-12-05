/**
 * Script para ejecutar migración add-orden-compra-to-movimientos en producción
 *
 * USO:
 * DATABASE_URL="postgresql://..." node migrations/run-orden-compra-migration-prod.js
 */

import pkg from 'pg';
const { Client } = pkg;

const ejecutarMigracion = async () => {
    let client;

    try {
        console.log('🔄 Conectando a la base de datos de producción...\n');

        const config = {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Railway requiere SSL
            }
        };

        client = new Client(config);
        await client.connect();
        console.log('✅ Conectado exitosamente\n');

        console.log('🔄 Iniciando migración: Agregar orden_compra_id a movimientos...\n');

        // Iniciar transacción
        await client.query('BEGIN');

        try {
            // 1. Verificar si la columna orden_compra_id ya existe
            console.log('📝 Paso 1/4: Verificando si la columna orden_compra_id existe...');
            const { rows } = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'movimientos'
                AND column_name = 'orden_compra_id'
            `);

            if (rows.length === 0) {
                console.log('   ➡️  Columna no existe, procediendo a crearla...\n');

                // 2. Agregar columna orden_compra_id
                console.log('📝 Paso 2/4: Agregando columna orden_compra_id...');
                await client.query(`
                    ALTER TABLE movimientos
                    ADD COLUMN orden_compra_id INTEGER NULL
                    REFERENCES ordenes_compra(id) ON DELETE SET NULL;
                `);
                console.log('✅ Columna orden_compra_id agregada\n');

                // 3. Agregar comentario
                console.log('📝 Paso 3/4: Agregando comentario descriptivo...');
                await client.query(`
                    COMMENT ON COLUMN movimientos.orden_compra_id
                    IS 'ID de la orden de compra asociada (para entradas desde órdenes de compra)';
                `);
                console.log('✅ Comentario agregado\n');

                // 4. Crear índice
                console.log('📝 Paso 4/4: Creando índice idx_movimientos_orden_compra...');
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_movimientos_orden_compra
                    ON movimientos(orden_compra_id);
                `);
                console.log('✅ Índice creado\n');
            } else {
                console.log('⚠️  La columna orden_compra_id ya existe, omitiendo pasos 2-4\n');
            }

            // 5. Verificar y agregar nuevo tipo de movimiento 'entrada_orden_compra'
            console.log('📝 Paso 5/5: Verificando tipo de movimiento entrada_orden_compra...');
            const { rows: tipoRows } = await client.query(`
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'enum_movimientos_tipo'
                AND e.enumlabel = 'entrada_orden_compra'
            `);

            if (tipoRows.length === 0) {
                console.log('   ➡️  Tipo no existe, agregándolo...');
                await client.query(`
                    ALTER TYPE enum_movimientos_tipo ADD VALUE IF NOT EXISTS 'entrada_orden_compra';
                `);
                console.log('✅ Tipo entrada_orden_compra agregado al ENUM\n');
            } else {
                console.log('⚠️  El tipo entrada_orden_compra ya existe\n');
            }

            // Confirmar transacción
            await client.query('COMMIT');

            console.log('═══════════════════════════════════════════════════');
            console.log('✅ Migración completada exitosamente');
            console.log('═══════════════════════════════════════════════════');
            console.log('\n📊 Cambios aplicados:');
            console.log('   ✓ Columna orden_compra_id agregada a movimientos');
            console.log('   ✓ Foreign key a ordenes_compra configurada');
            console.log('   ✓ Índice idx_movimientos_orden_compra creado');
            console.log('   ✓ Tipo entrada_orden_compra agregado al ENUM');
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
