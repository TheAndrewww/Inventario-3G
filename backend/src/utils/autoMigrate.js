/**
 * Auto-migración para sistema de herramientas de renta
 * Se ejecuta automáticamente al iniciar el servidor
 * Solo crea tablas si no existen - 100% seguro
 */

import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import {
    Articulo,
    TipoHerramientaRenta,
    UnidadHerramientaRenta
} from '../models/index.js';

/**
 * Genera prefijo único para tipo de herramienta
 */
const generarPrefijo = (nombre) => {
    const palabrasIgnoradas = ['de', 'la', 'el', 'del', 'los', 'las', 'y', 'para', 'con', 'a'];
    const palabras = nombre
        .split(' ')
        .filter(p => !palabrasIgnoradas.includes(p.toLowerCase()))
        .filter(p => p.length > 0);

    if (palabras.length >= 2) {
        return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1) {
        return palabras[0].substring(0, 2).toUpperCase();
    }
    return 'HR';
};

const obtenerPrefijoUnico = async (prefijoBase, transaction) => {
    let prefijo = prefijoBase;
    let contador = 1;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo },
            transaction
        });

        if (!existe) return prefijo;
        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

/**
 * Migra artículos pendientes que tienen es_herramienta = true
 * pero no están en el nuevo sistema
 */
export const migrarArticulosPendientes = async () => {
    const transaction = await sequelize.transaction();

    try {
        console.log('🔍 Buscando artículos de herramientas pendientes de migración...');

        // Buscar artículos que tienen es_herramienta = true pero no tienen tipo_herramienta_renta
        const articulosPendientes = await Articulo.findAll({
            where: {
                es_herramienta: true,
                activo: true
            },
            transaction
        });

        if (articulosPendientes.length === 0) {
            console.log('✅ No hay artículos pendientes de migración');
            await transaction.rollback();
            return { migrados: 0, mensaje: 'No hay pendientes' };
        }

        // Filtrar solo los que NO tienen tipo de herramienta
        const sinMigrar = [];
        for (const articulo of articulosPendientes) {
            const tipoExiste = await TipoHerramientaRenta.findOne({
                where: { articulo_origen_id: articulo.id },
                transaction
            });
            if (!tipoExiste) {
                sinMigrar.push(articulo);
            }
        }

        if (sinMigrar.length === 0) {
            console.log('✅ Todos los artículos ya están migrados');
            await transaction.rollback();
            return { migrados: 0, mensaje: 'Todos migrados' };
        }

        console.log(`📦 Encontrados ${sinMigrar.length} artículos para migrar`);

        let totalUnidadesCreadas = 0;

        for (const articulo of sinMigrar) {
            const prefijoBase = generarPrefijo(articulo.nombre);
            const prefijo = await obtenerPrefijoUnico(prefijoBase, transaction);
            const cantidadUnidades = Math.max(1, Math.floor(articulo.stock_actual || 0));

            // Crear tipo de herramienta
            const nuevoTipo = await TipoHerramientaRenta.create({
                nombre: articulo.nombre,
                descripcion: articulo.descripcion || `Migrado automáticamente desde artículo #${articulo.id}`,
                prefijo_codigo: prefijo,
                categoria_id: articulo.categoria_id,
                ubicacion_id: articulo.ubicacion_id,
                proveedor_id: articulo.proveedor_id,
                precio_unitario: articulo.costo_unitario || 0,
                total_unidades: cantidadUnidades,
                unidades_disponibles: cantidadUnidades,
                unidades_asignadas: 0,
                imagen_url: articulo.imagen_url,
                activo: articulo.activo,
                articulo_origen_id: articulo.id
            }, { transaction });

            // Crear unidades
            for (let i = 1; i <= cantidadUnidades; i++) {
                const codigoUnico = `${prefijo}-${i.toString().padStart(3, '0')}`;
                await UnidadHerramientaRenta.create({
                    tipo_herramienta_id: nuevoTipo.id,
                    codigo_unico: codigoUnico,
                    estado: 'disponible',
                    activo: true
                }, { transaction });
                totalUnidadesCreadas++;
            }

            console.log(`  ✅ ${articulo.nombre} → ${prefijo} (${cantidadUnidades} unidades)`);
        }

        await transaction.commit();

        console.log(`✨ Migración automática completada: ${sinMigrar.length} artículos, ${totalUnidadesCreadas} unidades`);

        return {
            migrados: sinMigrar.length,
            unidades: totalUnidadesCreadas,
            mensaje: 'Migración exitosa'
        };

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Error en migración de artículos pendientes:', error.message);
        return {
            migrados: 0,
            error: error.message
        };
    }
};

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
            console.log('✅ Base de datos actualizada - No se requiere migración de tablas');

            // Aunque las tablas existan, verificar si hay artículos pendientes de migrar
            const resultadoArticulos = await migrarArticulosPendientes();

            return {
                migrado: false,
                mensaje: 'Tablas ya migradas',
                articulosMigrados: resultadoArticulos.migrados || 0
            };
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

        console.log('✨ Migración de tablas completada exitosamente');

        // Migrar artículos pendientes después de crear las tablas
        const resultadoArticulos = await migrarArticulosPendientes();

        return {
            migrado: true,
            mensaje: 'Migración de herramientas de renta completada',
            articulosMigrados: resultadoArticulos.migrados || 0,
            unidadesCreadas: resultadoArticulos.unidades || 0
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
