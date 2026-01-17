/**
 * Script de migración para agregar campos de Google Drive
 * a la tabla produccion_proyectos
 * 
 * Ejecutar: node backend/scripts/migrar-campos-drive.js
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const sequelize = new Sequelize(
    process.env.DB_NAME || 'inventario_3g',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);

const columnas = [
    {
        nombre: 'drive_folder_id',
        tipo: 'VARCHAR(100)',
        nullable: true,
        comentario: 'ID de la carpeta del proyecto en Google Drive'
    },
    {
        nombre: 'tiene_manufactura',
        tipo: 'BOOLEAN',
        nullable: false,
        default: 'FALSE',
        comentario: 'Si se encontraron PDFs de Manufactura en Drive'
    },
    {
        nombre: 'tiene_herreria',
        tipo: 'BOOLEAN',
        nullable: false,
        default: 'FALSE',
        comentario: 'Si se encontraron PDFs de Herrería en Drive'
    },
    {
        nombre: 'archivos_manufactura',
        tipo: 'JSONB',
        nullable: true,
        comentario: 'Array de archivos PDF de Manufactura'
    },
    {
        nombre: 'archivos_herreria',
        tipo: 'JSONB',
        nullable: true,
        comentario: 'Array de archivos PDF de Herrería'
    },
    {
        nombre: 'drive_sync_at',
        tipo: 'TIMESTAMP WITH TIME ZONE',
        nullable: true,
        comentario: 'Última sincronización con Google Drive'
    }
];

async function ejecutarMigracion() {
    console.log('🚀 Iniciando migración de campos de Google Drive...\n');

    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a base de datos establecida\n');

        for (const columna of columnas) {
            try {
                // Verificar si la columna ya existe
                const [resultado] = await sequelize.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'produccion_proyectos' 
                    AND column_name = '${columna.nombre}'
                `);

                if (resultado.length > 0) {
                    console.log(`⏭️  Columna "${columna.nombre}" ya existe, omitiendo...`);
                    continue;
                }

                // Construir query de ALTER TABLE
                let query = `ALTER TABLE produccion_proyectos ADD COLUMN ${columna.nombre} ${columna.tipo}`;

                if (!columna.nullable) {
                    if (columna.default !== undefined) {
                        query += ` DEFAULT ${columna.default} NOT NULL`;
                    } else {
                        query += ` NOT NULL`;
                    }
                }

                await sequelize.query(query);
                console.log(`✅ Columna "${columna.nombre}" agregada correctamente`);

                // Agregar comentario
                if (columna.comentario) {
                    await sequelize.query(`
                        COMMENT ON COLUMN produccion_proyectos.${columna.nombre} 
                        IS '${columna.comentario}'
                    `);
                }

            } catch (error) {
                console.error(`❌ Error al agregar columna "${columna.nombre}":`, error.message);
            }
        }

        console.log('\n✅ Migración completada exitosamente');

    } catch (error) {
        console.error('❌ Error en la migración:', error);
    } finally {
        await sequelize.close();
    }
}

ejecutarMigracion();
