import { sequelize } from '../src/config/database.js';
import { DataTypes } from 'sequelize';

const migration = async () => {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🚀 Iniciando migración: Sistema de Herramientas de Renta...');

        // 1. Crear tabla tipos_herramienta_renta
        console.log('📋 Creando tabla tipos_herramienta_renta...');
        await queryInterface.createTable('tipos_herramienta_renta', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            nombre: {
                type: DataTypes.STRING(200),
                allowNull: false
            },
            descripcion: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            imagen_url: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            categoria_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'categorias',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            ubicacion_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'ubicaciones',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            proveedor_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'proveedores',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            precio_unitario: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0
            },
            prefijo_codigo: {
                type: DataTypes.STRING(10),
                allowNull: false,
                comment: 'Prefijo para generar códigos únicos (ej: PP, CP, TD)'
            },
            total_unidades: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Total de unidades creadas'
            },
            unidades_disponibles: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Unidades actualmente disponibles'
            },
            unidades_asignadas: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Unidades actualmente asignadas'
            },
            articulo_origen_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: 'ID del artículo original si fue migrado',
                references: {
                    model: 'articulos',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            activo: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
        console.log('✅ Tabla tipos_herramienta_renta creada');

        // 2. Crear tabla unidades_herramienta_renta
        console.log('📋 Creando tabla unidades_herramienta_renta...');
        await queryInterface.createTable('unidades_herramienta_renta', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            tipo_herramienta_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tipos_herramienta_renta',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            codigo_unico: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                comment: 'Código único de la unidad (ej: PP-001, CP-005)'
            },
            codigo_ean13: {
                type: DataTypes.STRING(13),
                allowNull: true,
                unique: true,
                comment: 'Código de barras EAN-13 para la unidad'
            },
            numero_serie: {
                type: DataTypes.STRING(100),
                allowNull: true,
                comment: 'Número de serie del fabricante (opcional)'
            },
            estado: {
                type: DataTypes.ENUM('disponible', 'asignada', 'en_reparacion', 'perdida', 'baja'),
                allowNull: false,
                defaultValue: 'disponible'
            },
            usuario_asignado_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'usuarios',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            equipo_asignado_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'equipos',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            fecha_asignacion: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Fecha de la asignación actual'
            },
            fecha_adquisicion: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: 'Fecha de compra/adquisición'
            },
            observaciones: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            activo: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
        console.log('✅ Tabla unidades_herramienta_renta creada');

        // 3. Crear tabla historial_asignaciones_herramienta
        console.log('📋 Creando tabla historial_asignaciones_herramienta...');
        await queryInterface.createTable('historial_asignaciones_herramienta', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            unidad_herramienta_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'unidades_herramienta_renta',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            usuario_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'usuarios',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            equipo_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'equipos',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            tipo_movimiento: {
                type: DataTypes.ENUM('asignacion', 'devolucion', 'reparacion', 'baja'),
                allowNull: false
            },
            fecha_asignacion: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            fecha_devolucion: {
                type: DataTypes.DATE,
                allowNull: true
            },
            observaciones: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            registrado_por_usuario_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'usuarios',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
        console.log('✅ Tabla historial_asignaciones_herramienta creada');

        // 4. Crear índices para mejorar el rendimiento
        console.log('📋 Creando índices...');

        await queryInterface.addIndex('unidades_herramienta_renta', ['tipo_herramienta_id']);
        await queryInterface.addIndex('unidades_herramienta_renta', ['estado']);
        await queryInterface.addIndex('unidades_herramienta_renta', ['usuario_asignado_id']);
        await queryInterface.addIndex('unidades_herramienta_renta', ['equipo_asignado_id']);
        await queryInterface.addIndex('historial_asignaciones_herramienta', ['unidad_herramienta_id']);
        await queryInterface.addIndex('historial_asignaciones_herramienta', ['usuario_id']);
        await queryInterface.addIndex('historial_asignaciones_herramienta', ['equipo_id']);

        console.log('✅ Índices creados');

        console.log('✨ Migración completada exitosamente!');

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        throw error;
    }
};

export default migration;
