/**
 * Script para crear usuarios de prueba para cada rol
 */
import { sequelize } from '../src/config/database.js';
import { Usuario } from '../src/models/index.js';
import dotenv from 'dotenv';

dotenv.config();

const usuariosPrueba = [
  {
    nombre: 'Juan Diseñador',
    email: 'diseñador@3g.com',
    password: 'diseñador123',
    rol: 'diseñador',
    puesto: 'Diseñador de Productos',
    telefono: '1234567891',
    activo: true
  },
  {
    nombre: 'María Compras',
    email: 'compras@3g.com',
    password: 'compras123',
    rol: 'compras',
    puesto: 'Encargada de Compras',
    telefono: '1234567892',
    activo: true
  },
  {
    nombre: 'Carlos Almacén',
    email: 'almacen@3g.com',
    password: 'almacen123',
    rol: 'almacen',
    puesto: 'Encargado de Almacén',
    telefono: '1234567893',
    activo: true
  },
  {
    nombre: 'Ana Supervisor',
    email: 'supervisor@3g.com',
    password: 'supervisor123',
    rol: 'supervisor',
    puesto: 'Supervisor de Operaciones',
    telefono: '1234567894',
    activo: true
  }
];

async function crearUsuariosPrueba() {
  try {
    console.log('🚀 Iniciando creación de usuarios de prueba...\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    // Crear cada usuario
    for (const userData of usuariosPrueba) {
      try {
        // Verificar si el usuario ya existe
        const usuarioExistente = await Usuario.findOne({
          where: { email: userData.email }
        });

        if (usuarioExistente) {
          console.log(`⚠️  Usuario ${userData.email} ya existe, omitiendo...`);
          continue;
        }

        // Crear usuario
        const usuario = await Usuario.create(userData);
        console.log(`✅ Usuario creado exitosamente:`);
        console.log(`   Nombre: ${usuario.nombre}`);
        console.log(`   Email: ${usuario.email}`);
        console.log(`   Rol: ${usuario.rol}`);
        console.log(`   Password: ${userData.password}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Error al crear usuario ${userData.email}:`, error.message);
      }
    }

    console.log('\n📋 RESUMEN DE USUARIOS DE PRUEBA:');
    console.log('='.repeat(70));
    console.log('');
    console.log('Usuario Admin (ya existente):');
    console.log('  Email: admin@3g.com');
    console.log('  Password: admin123');
    console.log('  Rol: administrador');
    console.log('');

    for (const user of usuariosPrueba) {
      console.log(`Usuario ${user.rol.charAt(0).toUpperCase() + user.rol.slice(1)}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Rol: ${user.rol}`);
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('\n✅ Proceso completado exitosamente');

    // Listar todos los usuarios
    const todosLosUsuarios = await Usuario.findAll({
      attributes: ['id', 'nombre', 'email', 'rol', 'puesto', 'activo'],
      order: [['id', 'ASC']]
    });

    console.log('\n👥 USUARIOS EN EL SISTEMA:');
    console.log('='.repeat(70));
    todosLosUsuarios.forEach(u => {
      console.log(`ID: ${u.id} | ${u.nombre} | ${u.email} | Rol: ${u.rol} | Activo: ${u.activo ? 'Sí' : 'No'}`);
    });
    console.log('='.repeat(70));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error al crear usuarios de prueba:', error);
    process.exit(1);
  }
}

crearUsuariosPrueba();
