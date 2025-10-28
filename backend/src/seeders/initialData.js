import { Usuario, Categoria, Ubicacion } from '../models/index.js';

export const seedInitialData = async () => {
    try {
        console.log('🌱 Iniciando seed de datos iniciales...');

        // Verificar si ya existen datos
        const categoriasCount = await Categoria.count();
        if (categoriasCount > 0) {
            console.log('✅ Los datos iniciales ya existen. Saltando seed...');
            return;
        }

        // 1. Crear categorías predefinidas
        console.log('📦 Creando categorías...');
        const categorias = await Categoria.bulkCreate([
            {
                nombre: 'Ferretería',
                descripcion: 'Herramientas y materiales de ferretería',
                color: '#EF4444', // red
                icono: 'Wrench'
            },
            {
                nombre: 'Soldadura',
                descripcion: 'Equipos y consumibles de soldadura',
                color: '#F97316', // orange
                icono: 'Flame'
            },
            {
                nombre: 'Eléctrico',
                descripcion: 'Materiales eléctricos y componentes',
                color: '#EAB308', // yellow
                icono: 'Zap'
            },
            {
                nombre: 'Pintura',
                descripcion: 'Pinturas, brochas y accesorios',
                color: '#8B5CF6', // purple
                icono: 'Paintbrush'
            },
            {
                nombre: 'Herramientas',
                descripcion: 'Herramientas manuales y eléctricas',
                color: '#3B82F6', // blue
                icono: 'Hammer'
            },
            {
                nombre: 'Textil',
                descripcion: 'Materiales textiles y accesorios',
                color: '#EC4899', // pink
                icono: 'Shirt'
            },
            {
                nombre: 'Construcción',
                descripcion: 'Materiales de construcción',
                color: '#84CC16', // lime
                icono: 'Hammer'
            },
            {
                nombre: 'Otros',
                descripcion: 'Otros materiales diversos',
                color: '#6B7280', // gray
                icono: 'Package'
            }
        ]);
        console.log(`✅ ${categorias.length} categorías creadas`);

        // 2. Crear ubicaciones de ejemplo
        console.log('📍 Creando ubicaciones...');
        const ubicaciones = await Ubicacion.bulkCreate([
            {
                codigo: 'A-01',
                almacen: 'Principal',
                pasillo: 'A',
                estante: '01',
                nivel: 1,
                descripcion: 'Pasillo A, Estante 01, Nivel 1'
            },
            {
                codigo: 'A-02',
                almacen: 'Principal',
                pasillo: 'A',
                estante: '02',
                nivel: 1,
                descripcion: 'Pasillo A, Estante 02, Nivel 1'
            },
            {
                codigo: 'A-03',
                almacen: 'Principal',
                pasillo: 'A',
                estante: '03',
                nivel: 1,
                descripcion: 'Pasillo A, Estante 03, Nivel 1'
            },
            {
                codigo: 'B-01',
                almacen: 'Principal',
                pasillo: 'B',
                estante: '01',
                nivel: 1,
                descripcion: 'Pasillo B, Estante 01, Nivel 1'
            },
            {
                codigo: 'B-02',
                almacen: 'Principal',
                pasillo: 'B',
                estante: '02',
                nivel: 1,
                descripcion: 'Pasillo B, Estante 02, Nivel 1'
            },
            {
                codigo: 'C-01',
                almacen: 'Principal',
                pasillo: 'C',
                estante: '01',
                nivel: 1,
                descripcion: 'Pasillo C, Estante 01, Nivel 1'
            },
            {
                codigo: 'ALMACEN-2',
                almacen: 'Secundario',
                pasillo: null,
                estante: null,
                nivel: null,
                descripcion: 'Almacén secundario'
            }
        ]);
        console.log(`✅ ${ubicaciones.length} ubicaciones creadas`);

        // 3. Crear usuario administrador de prueba
        console.log('👤 Creando usuario administrador...');
        const admin = await Usuario.create({
            nombre: 'Administrador',
            email: 'admin@3g.com',
            password: 'admin123', // Se encriptará automáticamente por el hook
            rol: 'administrador',
            telefono: '1234567890',
            puesto: 'Administrador del Sistema',
            activo: true
        });
        console.log(`✅ Usuario administrador creado: ${admin.email}`);

        // 4. Crear usuario empleado de prueba
        console.log('👤 Creando usuario empleado...');
        const empleado = await Usuario.create({
            nombre: 'Juan Pérez',
            email: 'juan@3g.com',
            password: 'juan123', // Se encriptará automáticamente por el hook
            rol: 'empleado',
            telefono: '0987654321',
            puesto: 'Operario',
            activo: true
        });
        console.log(`✅ Usuario empleado creado: ${empleado.email}`);

        // 5. Crear usuario supervisor de prueba
        console.log('👤 Creando usuario supervisor...');
        const supervisor = await Usuario.create({
            nombre: 'María González',
            email: 'maria@3g.com',
            password: 'maria123', // Se encriptará automáticamente por el hook
            rol: 'supervisor',
            telefono: '5555555555',
            puesto: 'Supervisor de Operaciones',
            activo: true
        });
        console.log(`✅ Usuario supervisor creado: ${supervisor.email}`);

        console.log('');
        console.log('🎉 ¡Seed completado exitosamente!');
        console.log('');
        console.log('📝 Usuarios de prueba creados:');
        console.log('   👨‍💼 Administrador: admin@3g.com / admin123');
        console.log('   👷 Empleado: juan@3g.com / juan123');
        console.log('   👨‍🔧 Supervisor: maria@3g.com / maria123');
        console.log('');

    } catch (error) {
        console.error('❌ Error en seed:', error);
        throw error;
    }
};

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    const { sequelize } = await import('../config/database.js');
    await sequelize.authenticate();
    await seedInitialData();
    await sequelize.close();
    process.exit(0);
}
