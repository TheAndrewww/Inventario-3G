import { sequelize } from '../src/config/database.js';
import { DataTypes } from 'sequelize';

const migration = async () => {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🚀 Iniciando migración: Sistema de Equipos y Aprobación de Pedidos...');

        // 1. Crear tabla de equipos
        console.log('📋 Creando tabla equipos...');
        await queryInterface.createTable('equipos', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            nombre: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            descripcion: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            supervisor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'usuarios',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
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
        console.log('✅ Tabla equipos creada');

        // 2. Agregar columna tipo_pedido a movimientos
        console.log('📋 Agregando columna tipo_pedido a movimientos...');
        await queryInterface.addColumn('movimientos', 'tipo_pedido', {
            type: DataTypes.ENUM('proyecto', 'equipo'),
            allowNull: true
        });
        console.log('✅ Columna tipo_pedido agregada');

        // 3. Agregar columna equipo_id a movimientos
        console.log('📋 Agregando columna equipo_id a movimientos...');
        await queryInterface.addColumn('movimientos', 'equipo_id', {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'equipos',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
        console.log('✅ Columna equipo_id agregada');

        // 4. Modificar el ENUM de estado en movimientos para incluir nuevos estados
        console.log('📋 Actualizando estados de movimientos...');

        // Primero, obtenemos el tipo existente
        await sequelize.query(`
            ALTER TYPE "enum_movimientos_estado"
            ADD VALUE IF NOT EXISTS 'pendiente_aprobacion';
        `);
        await sequelize.query(`
            ALTER TYPE "enum_movimientos_estado"
            ADD VALUE IF NOT EXISTS 'rechazado';
        `);
        console.log('✅ Estados de movimientos actualizados');

        // 5. Agregar columna aprobado_por_id a movimientos
        console.log('📋 Agregando columna aprobado_por_id a movimientos...');
        await queryInterface.addColumn('movimientos', 'aprobado_por_id', {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'usuarios',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
        console.log('✅ Columna aprobado_por_id agregada');

        // 6. Agregar columna fecha_aprobacion a movimientos
        console.log('📋 Agregando columna fecha_aprobacion a movimientos...');
        await queryInterface.addColumn('movimientos', 'fecha_aprobacion', {
            type: DataTypes.DATE,
            allowNull: true
        });
        console.log('✅ Columna fecha_aprobacion agregada');

        // 7. Agregar columna motivo_rechazo a movimientos
        console.log('📋 Agregando columna motivo_rechazo a movimientos...');
        await queryInterface.addColumn('movimientos', 'motivo_rechazo', {
            type: DataTypes.TEXT,
            allowNull: true
        });
        console.log('✅ Columna motivo_rechazo agregada');

        console.log('✨ Migración completada exitosamente!');

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        throw error;
    }
};

export default migration;
