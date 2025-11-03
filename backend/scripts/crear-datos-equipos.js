import { sequelize } from '../src/config/database.js';
import { Usuario, Equipo } from '../src/models/index.js';
import bcrypt from 'bcrypt';

const crearDatosPrueba = async () => {
    try {
        console.log('🔄 Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('✅ Conexión establecida\n');

        // 1. Crear usuarios de prueba (supervisor y almacenista)
        console.log('📋 Creando usuarios de prueba...');

        // Verificar si ya existe el supervisor
        let supervisor = await Usuario.findOne({ where: { email: 'supervisor@3g.com' } });
        if (!supervisor) {
            supervisor = await Usuario.create({
                nombre: 'Juan Supervisor',
                email: 'supervisor@3g.com',
                password: 'supervisor123', // Se encriptará automáticamente
                rol: 'supervisor',
                puesto: 'Supervisor de Campo',
                telefono: '5551234567',
                activo: true
            });
            console.log('✅ Supervisor creado: supervisor@3g.com / supervisor123');
        } else {
            console.log('ℹ️  Supervisor ya existe: supervisor@3g.com');
        }

        // Verificar si ya existe el almacenista
        let almacenista = await Usuario.findOne({ where: { email: 'almacen@3g.com' } });
        if (!almacenista) {
            almacenista = await Usuario.create({
                nombre: 'María Almacén',
                email: 'almacen@3g.com',
                password: 'almacen123', // Se encriptará automáticamente
                rol: 'almacen',
                puesto: 'Encargada de Almacén',
                telefono: '5559876543',
                activo: true
            });
            console.log('✅ Almacenista creado: almacen@3g.com / almacen123');
        } else {
            console.log('ℹ️  Almacenista ya existe: almacen@3g.com');
        }

        // 2. Crear equipos de prueba
        console.log('\n📋 Creando equipos de prueba...');

        const equipos = [
            {
                nombre: 'Equipo Instalación Norte',
                descripcion: 'Equipo de instalación para zona norte de la ciudad',
                supervisor_id: supervisor.id
            },
            {
                nombre: 'Equipo Instalación Sur',
                descripcion: 'Equipo de instalación para zona sur de la ciudad',
                supervisor_id: supervisor.id
            },
            {
                nombre: 'Equipo Mantenimiento',
                descripcion: 'Equipo especializado en mantenimiento preventivo y correctivo',
                supervisor_id: supervisor.id
            }
        ];

        for (const equipoData of equipos) {
            const existente = await Equipo.findOne({ where: { nombre: equipoData.nombre } });
            if (!existente) {
                await Equipo.create(equipoData);
                console.log(`✅ Equipo creado: ${equipoData.nombre}`);
            } else {
                console.log(`ℹ️  Equipo ya existe: ${equipoData.nombre}`);
            }
        }

        // 3. Mostrar resumen
        console.log('\n📊 RESUMEN DE DATOS DE PRUEBA:');
        console.log('════════════════════════════════════════════════');
        console.log('\n👥 USUARIOS:');
        console.log(`   Supervisor: supervisor@3g.com / supervisor123 (ID: ${supervisor.id})`);
        console.log(`   Almacenista: almacen@3g.com / almacen123 (ID: ${almacenista.id})`);

        const todosEquipos = await Equipo.findAll({
            include: [
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['nombre']
                }
            ]
        });

        console.log('\n🔧 EQUIPOS:');
        todosEquipos.forEach(eq => {
            console.log(`   [${eq.id}] ${eq.nombre}`);
            console.log(`       Supervisor: ${eq.supervisor.nombre}`);
        });

        console.log('\n════════════════════════════════════════════════');
        console.log('✨ Datos de prueba creados exitosamente!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

crearDatosPrueba();
