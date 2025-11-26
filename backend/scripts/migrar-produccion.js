/**
 * Script maestro para migrar la base de datos de producción
 * Incluye todas las migraciones necesarias para el sistema de herramientas de renta
 *
 * IMPORTANTE: Ejecutar SOLO en producción con backup previo
 *
 * Uso: node scripts/migrar-produccion.js
 */

import dotenv from 'dotenv';
import { sequelize } from '../src/config/database.js';
import { QueryTypes } from 'sequelize';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const pregunta = (texto) => {
    return new Promise((resolve) => {
        rl.question(texto, resolve);
    });
};

const ejecutarMigracion = async () => {
    try {
        console.log('🚀 MIGRACIÓN A PRODUCCIÓN - SISTEMA DE HERRAMIENTAS DE RENTA\n');
        console.log('⚠️  ADVERTENCIA: Este script modificará la base de datos de producción\n');

        // Verificar conexión
        await sequelize.authenticate();
        const [dbInfo] = await sequelize.query(
            "SELECT current_database() as db_name",
            { type: QueryTypes.SELECT }
        );

        console.log(`📊 Base de datos conectada: ${dbInfo.db_name}\n`);

        // Confirmación de seguridad
        const respuesta1 = await pregunta('¿Has hecho un BACKUP de la base de datos? (si/no): ');
        if (respuesta1.toLowerCase() !== 'si') {
            console.log('\n❌ Por favor, haz un backup antes de continuar');
            console.log('   Comando: pg_dump -U usuario -d nombre_bd > backup_$(date +%Y%m%d_%H%M%S).sql\n');
            process.exit(1);
        }

        const respuesta2 = await pregunta(`\n¿Confirmas ejecutar la migración en ${dbInfo.db_name}? (ESCRIBIR "CONFIRMAR"): `);
        if (respuesta2 !== 'CONFIRMAR') {
            console.log('\n❌ Migración cancelada\n');
            process.exit(0);
        }

        console.log('\n🔧 Iniciando migración...\n');

        // PASO 1: Agregar campo es_herramienta a articulos
        console.log('📋 PASO 1/4: Agregando campo es_herramienta a articulos...');
        try {
            await sequelize.query(`
                ALTER TABLE articulos
                ADD COLUMN IF NOT EXISTS es_herramienta BOOLEAN DEFAULT FALSE;
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_articulos_es_herramienta
                ON articulos(es_herramienta);
            `, { type: QueryTypes.RAW });

            console.log('✅ Campo es_herramienta agregado correctamente\n');
        } catch (error) {
            console.error('❌ Error al agregar campo es_herramienta:', error.message);
            throw error;
        }

        // PASO 2: Crear tabla tipos_herramienta_renta
        console.log('📋 PASO 2/4: Creando tabla tipos_herramienta_renta...');
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS tipos_herramienta_renta (
                    id SERIAL PRIMARY KEY,
                    nombre VARCHAR(200) NOT NULL,
                    descripcion TEXT,
                    imagen_url TEXT,
                    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    ubicacion_id INTEGER NOT NULL REFERENCES ubicaciones(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    proveedor_id INTEGER REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    precio_unitario DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    prefijo_codigo VARCHAR(10) NOT NULL,
                    total_unidades INTEGER NOT NULL DEFAULT 0,
                    unidades_disponibles INTEGER NOT NULL DEFAULT 0,
                    unidades_asignadas INTEGER NOT NULL DEFAULT 0,
                    articulo_origen_id INTEGER REFERENCES articulos(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    activo BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `, { type: QueryTypes.RAW });

            console.log('✅ Tabla tipos_herramienta_renta creada correctamente\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Tabla tipos_herramienta_renta ya existe, continuando...\n');
            } else {
                console.error('❌ Error al crear tipos_herramienta_renta:', error.message);
                throw error;
            }
        }

        // PASO 3: Crear tabla unidades_herramienta_renta
        console.log('📋 PASO 3/4: Creando tabla unidades_herramienta_renta...');
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS unidades_herramienta_renta (
                    id SERIAL PRIMARY KEY,
                    tipo_herramienta_id INTEGER NOT NULL REFERENCES tipos_herramienta_renta(id) ON UPDATE CASCADE ON DELETE CASCADE,
                    codigo_unico VARCHAR(50) NOT NULL UNIQUE,
                    codigo_ean13 VARCHAR(13) UNIQUE,
                    numero_serie VARCHAR(100),
                    estado VARCHAR(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignada', 'en_reparacion', 'perdida', 'baja')),
                    usuario_asignado_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    equipo_asignado_id INTEGER REFERENCES equipos(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    fecha_asignacion TIMESTAMP,
                    fecha_adquisicion TIMESTAMP,
                    observaciones TEXT,
                    activo BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `, { type: QueryTypes.RAW });

            // Crear índices
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_unidades_tipo_herramienta
                ON unidades_herramienta_renta(tipo_herramienta_id);
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_unidades_estado
                ON unidades_herramienta_renta(estado);
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_unidades_usuario
                ON unidades_herramienta_renta(usuario_asignado_id);
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_unidades_equipo
                ON unidades_herramienta_renta(equipo_asignado_id);
            `, { type: QueryTypes.RAW });

            console.log('✅ Tabla unidades_herramienta_renta creada correctamente\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Tabla unidades_herramienta_renta ya existe, continuando...\n');
            } else {
                console.error('❌ Error al crear unidades_herramienta_renta:', error.message);
                throw error;
            }
        }

        // PASO 4: Crear tabla historial_asignaciones_herramienta
        console.log('📋 PASO 4/4: Creando tabla historial_asignaciones_herramienta...');
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS historial_asignaciones_herramienta (
                    id SERIAL PRIMARY KEY,
                    unidad_herramienta_id INTEGER NOT NULL REFERENCES unidades_herramienta_renta(id) ON UPDATE CASCADE ON DELETE CASCADE,
                    usuario_id INTEGER REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    equipo_id INTEGER REFERENCES equipos(id) ON UPDATE CASCADE ON DELETE SET NULL,
                    tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('asignacion', 'devolucion', 'reparacion', 'baja')),
                    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    fecha_devolucion TIMESTAMP,
                    observaciones TEXT,
                    registrado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `, { type: QueryTypes.RAW });

            // Crear índices
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_historial_unidad
                ON historial_asignaciones_herramienta(unidad_herramienta_id);
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_historial_usuario
                ON historial_asignaciones_herramienta(usuario_id);
            `, { type: QueryTypes.RAW });

            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_historial_equipo
                ON historial_asignaciones_herramienta(equipo_id);
            `, { type: QueryTypes.RAW });

            console.log('✅ Tabla historial_asignaciones_herramienta creada correctamente\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Tabla historial_asignaciones_herramienta ya existe, continuando...\n');
            } else {
                console.error('❌ Error al crear historial_asignaciones_herramienta:', error.message);
                throw error;
            }
        }

        // Verificación final
        console.log('🔍 Verificando migración...\n');

        const tablas = await sequelize.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name IN (
                 'tipos_herramienta_renta',
                 'unidades_herramienta_renta',
                 'historial_asignaciones_herramienta'
             )`,
            { type: QueryTypes.SELECT }
        );

        const columnasArticulos = await sequelize.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'articulos' AND column_name = 'es_herramienta'`,
            { type: QueryTypes.SELECT }
        );

        console.log('📊 RESULTADO DE LA MIGRACIÓN:\n');
        console.log(`  ${tablas.length === 3 ? '✅' : '❌'} Tablas de herramientas de renta: ${tablas.length}/3`);
        console.log(`  ${columnasArticulos.length > 0 ? '✅' : '❌'} Campo es_herramienta en articulos`);

        if (tablas.length === 3 && columnasArticulos.length > 0) {
            console.log('\n✨ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!\n');
            console.log('📋 Tablas creadas:');
            console.log('   - tipos_herramienta_renta');
            console.log('   - unidades_herramienta_renta');
            console.log('   - historial_asignaciones_herramienta');
            console.log('\n📋 Columnas agregadas:');
            console.log('   - articulos.es_herramienta\n');
        } else {
            console.log('\n⚠️  La migración puede no haberse completado correctamente');
            console.log('   Por favor, verifica manualmente la base de datos\n');
        }

    } catch (error) {
        console.error('\n❌ ERROR EN LA MIGRACIÓN:', error);
        console.error('\n⚠️  IMPORTANTE: Verifica el estado de la base de datos');
        console.error('   Si la migración falló parcialmente, puede que necesites restaurar el backup\n');
        throw error;
    } finally {
        rl.close();
        await sequelize.close();
    }
};

ejecutarMigracion();
