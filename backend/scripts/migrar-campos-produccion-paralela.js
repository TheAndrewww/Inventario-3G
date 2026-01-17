/**
 * Migración: Agregar campos de Manufactura y Herrería a produccion_proyectos
 * 
 * Producción ahora se divide en dos sub-etapas paralelas:
 * - Manufactura
 * - Herrería
 * 
 * Solo cuando ambas están completadas, el proyecto puede avanzar a Instalación.
 */

import { sequelize } from '../src/config/database.js';

const migrarCamposProduccion = async () => {
    console.log('🔄 Iniciando migración: Campos Manufactura y Herrería...\n');

    try {
        // Verificar conexión
        await sequelize.authenticate();
        console.log('✅ Conexión a BD establecida\n');

        // Agregar columnas de Manufactura
        const columnasManufactura = [
            {
                nombre: 'manufactura_completado',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS manufactura_completado BOOLEAN DEFAULT FALSE NOT NULL`
            },
            {
                nombre: 'manufactura_completado_en',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS manufactura_completado_en TIMESTAMP`
            },
            {
                nombre: 'manufactura_completado_por',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS manufactura_completado_por INTEGER REFERENCES usuarios(id)`
            }
        ];

        // Agregar columnas de Herrería
        const columnasHerreria = [
            {
                nombre: 'herreria_completado',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS herreria_completado BOOLEAN DEFAULT FALSE NOT NULL`
            },
            {
                nombre: 'herreria_completado_en',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS herreria_completado_en TIMESTAMP`
            },
            {
                nombre: 'herreria_completado_por',
                sql: `ALTER TABLE produccion_proyectos 
                      ADD COLUMN IF NOT EXISTS herreria_completado_por INTEGER REFERENCES usuarios(id)`
            }
        ];

        const todasColumnas = [...columnasManufactura, ...columnasHerreria];

        for (const columna of todasColumnas) {
            try {
                await sequelize.query(columna.sql);
                console.log(`✅ Columna '${columna.nombre}' agregada/verificada`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⏭️  Columna '${columna.nombre}' ya existe`);
                } else {
                    console.error(`❌ Error en '${columna.nombre}':`, error.message);
                }
            }
        }

        console.log('\n✅ Migración completada exitosamente');

        // Mostrar estado actual de la tabla
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'produccion_proyectos' 
            AND column_name LIKE '%manufactura%' OR column_name LIKE '%herreria%'
            ORDER BY column_name
        `);

        if (columns.length > 0) {
            console.log('\n📊 Columnas de sub-etapas:');
            columns.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
        }

    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
};

migrarCamposProduccion();
