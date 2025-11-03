import { sequelize } from '../src/config/database.js';
import '../src/models/index.js';
import bcrypt from 'bcryptjs';
import { Usuario } from '../src/models/index.js';

async function setupProduction() {
    try {
        console.log('🔄 Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('✅ Conexión exitosa');

        console.log('🔄 Creando tablas...');
        await sequelize.sync({ force: false, alter: true });
        console.log('✅ Tablas creadas/actualizadas');

        // Verificar si ya existe el usuario admin
        const adminExists = await Usuario.findOne({ where: { email: 'admin@3g.com' } });

        if (adminExists) {
            console.log('ℹ️  Usuario administrador ya existe');
        } else {
            console.log('🔄 Creando usuario administrador...');
            const hashedPassword = await bcrypt.hash('admin123', 10);

            await Usuario.create({
                nombre: 'Administrador',
                email: 'admin@3g.com',
                password: hashedPassword,
                rol: 'administrador',
                activo: true,
                telefono: '0000000000',
                puesto: 'Administrador del Sistema'
            });

            console.log('✅ Usuario administrador creado');
            console.log('📧 Email: admin@3g.com');
            console.log('🔑 Password: admin123');
            console.log('⚠️  IMPORTANTE: Cambiar la contraseña después del primer login');
        }

        console.log('✅ Setup completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en setup:', error);
        process.exit(1);
    }
}

setupProduction();
