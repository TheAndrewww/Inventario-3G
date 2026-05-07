import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../src/config/database.js';
import '../src/models/index.js';

async function syncDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión establecida');

        // Drop all tables first
        await sequelize.query('DROP SCHEMA public CASCADE');
        await sequelize.query('CREATE SCHEMA public');
        console.log('🗑️  Schema limpio');

        // Get all models
        const models = sequelize.models;
        const modelNames = Object.keys(models);
        console.log(`📋 ${modelNames.length} modelos encontrados:`, modelNames.join(', '));

        // Step 1: Create all tables WITHOUT foreign key constraints
        for (const modelName of modelNames) {
            const model = models[modelName];
            const tableName = model.getTableName();

            // Get the CREATE TABLE SQL by syncing each model individually
            // But first, temporarily remove all references
            const attributes = model.rawAttributes;
            const savedReferences = {};

            for (const [attrName, attrDef] of Object.entries(attributes)) {
                if (attrDef.references) {
                    savedReferences[attrName] = attrDef.references;
                    delete attrDef.references;
                }
            }

            try {
                await model.sync({ force: false });
                console.log(`  ✅ Tabla ${tableName} creada`);
            } catch (err) {
                console.error(`  ❌ Error creando ${tableName}:`, err.message);
            }

            // Restore references
            for (const [attrName, ref] of Object.entries(savedReferences)) {
                attributes[attrName].references = ref;
            }
        }

        // Step 2: Add foreign key constraints
        console.log('\n🔗 Agregando foreign keys...');
        for (const modelName of modelNames) {
            const model = models[modelName];
            const tableName = model.getTableName();
            const attributes = model.rawAttributes;

            for (const [attrName, attrDef] of Object.entries(attributes)) {
                if (attrDef.references) {
                    const refTable = typeof attrDef.references.model === 'string'
                        ? attrDef.references.model
                        : attrDef.references.model?.tableName || attrDef.references.model;
                    const refKey = attrDef.references.key || 'id';
                    const fieldName = attrDef.field || attrName;

                    const onDelete = attrDef.onDelete || 'SET NULL';
                    const onUpdate = attrDef.onUpdate || 'CASCADE';

                    const constraintName = `${tableName}_${fieldName}_fkey`;

                    try {
                        await sequelize.query(`
                            ALTER TABLE "${tableName}"
                            ADD CONSTRAINT "${constraintName}"
                            FOREIGN KEY ("${fieldName}")
                            REFERENCES "${refTable}" ("${refKey}")
                            ON DELETE ${onDelete}
                            ON UPDATE ${onUpdate}
                        `);
                    } catch (err) {
                        // Constraint might already exist or table issue
                        if (!err.message.includes('already exists')) {
                            console.log(`  ⚠️  FK ${tableName}.${fieldName} -> ${refTable}: ${err.message}`);
                        }
                    }
                }
            }
        }
        console.log('✅ Foreign keys agregadas');

        // Step 3: Create default admin user
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await sequelize.query(`
            INSERT INTO usuarios (nombre, email, password, rol, activo, created_at, updated_at)
            VALUES ('Administrador', 'admin@inventario3g.com', '${hashedPassword}', 'administrador', true, NOW(), NOW())
            ON CONFLICT (email) DO NOTHING
        `);
        console.log('✅ Usuario admin creado (admin@inventario3g.com / admin123)');

        await sequelize.close();
        console.log('\n🎉 Base de datos sincronizada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

syncDatabase();
