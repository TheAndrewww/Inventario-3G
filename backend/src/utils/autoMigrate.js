/**
 * Auto-migración para sistema de herramientas de renta
 * Se ejecuta automáticamente al iniciar el servidor
 * Solo crea tablas si no existen - 100% seguro
 */

import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

export const ejecutarAutoMigracion = async () => {
    try {
        console.log('🔍 Verificando si se necesita migración...');

        // Verificar si las tablas de herramientas de renta existen
        const tablas = await sequelize.query(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name IN (
                 'tipos_herramienta_renta',
                 'unidades_herramienta_renta',
                 'historial_asignaciones_herramienta'
             )`,
            { type: QueryTypes.SELECT }
        );

        // Verificar campo es_herramienta
        const campoEsHerramienta = await sequelize.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = 'articulos' AND column_name = 'es_herramienta'`,
            { type: QueryTypes.SELECT }
        );

        const necesitaMigracion = tablas.length < 3 || campoEsHerramienta.length === 0;

        if (!necesitaMigracion) {
            console.log('✅ Base de datos actualizada - No se requiere migración');
            return { migrado: false, mensaje: 'Ya está migrado' };
        }

        console.log('🚀 Ejecutando migración automática de herramientas de renta...');

        // PASO 1: Agregar campo es_herramienta
        await sequelize.query(`
            ALTER TABLE articulos
            ADD COLUMN IF NOT EXISTS es_herramienta BOOLEAN DEFAULT FALSE;
        `, { type: QueryTypes.RAW });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_articulos_es_herramienta
            ON articulos(es_herramienta);
        `, { type: QueryTypes.RAW });

        console.log('  ✅ Campo es_herramienta agregado');

        // PASO 2: Crear tabla tipos_herramienta_renta
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

        console.log('  ✅ Tabla tipos_herramienta_renta creada');

        // PASO 3: Crear tabla unidades_herramienta_renta
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

        console.log('  ✅ Tabla unidades_herramienta_renta creada');

        // PASO 4: Crear tabla historial_asignaciones_herramienta
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

        console.log('  ✅ Tabla historial_asignaciones_herramienta creada');

        console.log('✨ Migración automática completada exitosamente');

        return {
            migrado: true,
            mensaje: 'Migración de herramientas de renta completada'
        };

    } catch (error) {
        console.error('❌ Error en auto-migración:', error.message);
        // No lanzar error para que el servidor pueda iniciar de todos modos
        return {
            migrado: false,
            error: error.message
        };
    }
};
