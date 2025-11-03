/**
 * Migración: Sistema de Órdenes de Compra
 *
 * Este sistema permite a diseñadores y almacenistas crear órdenes de compra.
 * Cuando un diseñador crea un pedido sin stock, se genera automáticamente una
 * solicitud de compra por el faltante + stock_maximo del artículo.
 *
 * Tablas:
 * - ordenes_compra: Órden principal de compra
 * - detalle_ordenes_compra: Artículos en la orden de compra
 * - solicitudes_compra: Solicitudes automáticas generadas por falta de stock
 */

export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Iniciando migración de sistema de órdenes de compra...\n');

    // ====================
    // TABLA: ordenes_compra
    // ====================
    console.log('1️⃣ Creando tabla ordenes_compra...');

    await queryInterface.createTable('ordenes_compra', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ticket_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Formato: OC-DDMMYY-HHMM-NN'
      },
      proveedor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'proveedores',
          key: 'id'
        },
        comment: 'Proveedor asignado a la orden de compra'
      },
      usuario_creador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        comment: 'Usuario que creó la orden (diseñador o almacenista)'
      },
      estado: {
        type: Sequelize.ENUM('borrador', 'enviada', 'parcial', 'recibida', 'cancelada'),
        allowNull: false,
        defaultValue: 'borrador',
        comment: 'Estado de la orden de compra'
      },
      total_estimado: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total estimado de la orden'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      fecha_envio: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha en que se envió la orden al proveedor'
      },
      fecha_recepcion: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha en que se recibió completamente'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, { transaction });

    console.log('✅ Tabla ordenes_compra creada\n');

    // ====================
    // TABLA: detalle_ordenes_compra
    // ====================
    console.log('2️⃣ Creando tabla detalle_ordenes_compra...');

    await queryInterface.createTable('detalle_ordenes_compra', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      orden_compra_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ordenes_compra',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'FK a ordenes_compra'
      },
      articulo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'articulos',
          key: 'id'
        },
        comment: 'Artículo a comprar'
      },
      cantidad_solicitada: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Cantidad solicitada'
      },
      cantidad_recibida: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad recibida hasta el momento'
      },
      costo_unitario: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Costo unitario cotizado'
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Subtotal de esta línea (cantidad * costo)'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, { transaction });

    console.log('✅ Tabla detalle_ordenes_compra creada\n');

    // ====================
    // TABLA: solicitudes_compra
    // ====================
    console.log('3️⃣ Creando tabla solicitudes_compra...');

    await queryInterface.createTable('solicitudes_compra', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ticket_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Formato: SC-DDMMYY-HHMM-NN'
      },
      articulo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'articulos',
          key: 'id'
        },
        comment: 'Artículo que necesita ser comprado'
      },
      cantidad_solicitada: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Cantidad que se solicita comprar (faltante + stock_maximo)'
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Motivo de la solicitud (ej: generado automáticamente por pedido sin stock)'
      },
      pedido_origen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'movimientos',
          key: 'id'
        },
        comment: 'ID del pedido que generó la solicitud (si aplica)'
      },
      usuario_solicitante_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        comment: 'Usuario que generó la solicitud'
      },
      orden_compra_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'ordenes_compra',
          key: 'id'
        },
        comment: 'Orden de compra asociada (cuando se convierte en orden)'
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'en_orden', 'completada', 'cancelada'),
        allowNull: false,
        defaultValue: 'pendiente',
        comment: 'pendiente=sin orden, en_orden=incluida en orden de compra, completada=ya recibida, cancelada=cancelada'
      },
      prioridad: {
        type: Sequelize.ENUM('baja', 'media', 'alta', 'urgente'),
        allowNull: false,
        defaultValue: 'media',
        comment: 'Prioridad de la solicitud'
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, { transaction });

    console.log('✅ Tabla solicitudes_compra creada\n');

    // ====================
    // ÍNDICES
    // ====================
    console.log('4️⃣ Creando índices...');

    await queryInterface.addIndex('ordenes_compra', ['estado'], { transaction });
    await queryInterface.addIndex('ordenes_compra', ['proveedor_id'], { transaction });
    await queryInterface.addIndex('ordenes_compra', ['usuario_creador_id'], { transaction });
    await queryInterface.addIndex('ordenes_compra', ['created_at'], { transaction });

    await queryInterface.addIndex('detalle_ordenes_compra', ['orden_compra_id'], { transaction });
    await queryInterface.addIndex('detalle_ordenes_compra', ['articulo_id'], { transaction });

    await queryInterface.addIndex('solicitudes_compra', ['estado'], { transaction });
    await queryInterface.addIndex('solicitudes_compra', ['articulo_id'], { transaction });
    await queryInterface.addIndex('solicitudes_compra', ['pedido_origen_id'], { transaction });
    await queryInterface.addIndex('solicitudes_compra', ['orden_compra_id'], { transaction });
    await queryInterface.addIndex('solicitudes_compra', ['prioridad'], { transaction });

    console.log('✅ Índices creados\n');

    await transaction.commit();
    console.log('✅ Migración de sistema de órdenes de compra completada exitosamente\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración de órdenes de compra:', error);
    throw error;
  }
}

export async function down(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Revirtiendo migración de sistema de órdenes de compra...\n');

    // Eliminar tablas en orden inverso por las FK
    console.log('1️⃣ Eliminando tabla solicitudes_compra...');
    await queryInterface.dropTable('solicitudes_compra', { transaction });

    console.log('2️⃣ Eliminando tabla detalle_ordenes_compra...');
    await queryInterface.dropTable('detalle_ordenes_compra', { transaction });

    console.log('3️⃣ Eliminando tabla ordenes_compra...');
    await queryInterface.dropTable('ordenes_compra', { transaction });

    // Eliminar ENUMs
    console.log('4️⃣ Eliminando tipos ENUM...');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ordenes_compra_estado"', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_estado"', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_solicitudes_compra_prioridad"', { transaction });

    await transaction.commit();
    console.log('✅ Reversión completada\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración:', error);
    throw error;
  }
}
