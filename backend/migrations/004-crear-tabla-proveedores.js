export const up = async (queryInterface, Sequelize) => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Crear tabla de proveedores
    await queryInterface.createTable('proveedores', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Nombre o razón social del proveedor'
      },
      rfc: {
        type: Sequelize.STRING(13),
        allowNull: true,
        unique: true,
        comment: 'RFC del proveedor (opcional)'
      },
      contacto: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Nombre de la persona de contacto'
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Teléfono de contacto'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Correo electrónico de contacto',
        validate: {
          isEmail: true
        }
      },
      direccion: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Dirección completa del proveedor'
      },
      ciudad: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      estado: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      codigo_postal: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre el proveedor'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, { transaction });

    // Crear índices
    await queryInterface.addIndex('proveedores', ['nombre'], {
      name: 'idx_proveedores_nombre',
      transaction
    });

    await queryInterface.addIndex('proveedores', ['activo'], {
      name: 'idx_proveedores_activo',
      transaction
    });

    console.log('✅ Tabla proveedores creada exitosamente');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración 004:', error);
    throw error;
  }
};

export const down = async (queryInterface, Sequelize) => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.dropTable('proveedores', { transaction });
    console.log('✅ Tabla proveedores eliminada');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración 004:', error);
    throw error;
  }
};
