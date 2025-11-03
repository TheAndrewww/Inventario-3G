import { Ubicacion } from '../src/models/index.js';
import { sequelize } from '../src/config/database.js';

/**
 * Script para crear ubicaciones predeterminadas para las camionetas
 * Ejecutar: node scripts/crear-ubicaciones-camionetas.js
 */

const ubicacionesCamionetas = [
  {
    codigo: 'NP300-1',
    almacen: 'Camioneta NP-300 #1',
    descripcion: 'Nissan NP-300 - Unidad 1 para trabajo diario'
  },
  {
    codigo: 'NP300-2',
    almacen: 'Camioneta NP-300 #2',
    descripcion: 'Nissan NP-300 - Unidad 2 para trabajo diario'
  },
  {
    codigo: 'TORNADO',
    almacen: 'Camioneta Tornado',
    descripcion: 'Chevrolet Tornado para trabajo diario'
  },
  {
    codigo: 'SAVEIRO',
    almacen: 'Camioneta Saveiro',
    descripcion: 'Volkswagen Saveiro para trabajo diario'
  },
  {
    codigo: 'STOCK-GEN',
    almacen: 'Stock General',
    descripcion: 'Almacén general para stock de respaldo'
  }
];

async function crearUbicacionesCamionetas() {
  try {
    console.log('🚀 Iniciando creación de ubicaciones para camionetas...\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida\n');

    for (const ubicacionData of ubicacionesCamionetas) {
      // Verificar si ya existe una ubicación con ese código
      const ubicacionExistente = await Ubicacion.findOne({
        where: { codigo: ubicacionData.codigo }
      });

      if (ubicacionExistente) {
        console.log(`⚠️  La ubicación "${ubicacionData.almacen}" (${ubicacionData.codigo}) ya existe (ID: ${ubicacionExistente.id})`);
      } else {
        // Crear la nueva ubicación
        const nuevaUbicacion = await Ubicacion.create({
          codigo: ubicacionData.codigo,
          almacen: ubicacionData.almacen,
          descripcion: ubicacionData.descripcion,
          activo: true
        });
        console.log(`✅ Creada: "${nuevaUbicacion.almacen}" (Código: ${nuevaUbicacion.codigo}, ID: ${nuevaUbicacion.id})`);
      }
    }

    console.log('\n🎉 Proceso completado exitosamente');
    console.log('\n📋 Resumen de ubicaciones para camionetas:');

    const todasLasUbicaciones = await Ubicacion.findAll({
      where: { activo: true },
      order: [['almacen', 'ASC']]
    });

    todasLasUbicaciones.forEach(ub => {
      const esVehiculo = ub.almacen.includes('Camioneta') || ub.almacen.includes('NP-300') ||
                         ub.almacen.includes('Tornado') || ub.almacen.includes('Saveiro');
      const icono = esVehiculo ? '🚛' : '📦';
      console.log(`${icono} ${ub.almacen} [${ub.codigo}] (ID: ${ub.id})`);
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error al crear ubicaciones:', error);
    process.exit(1);
  }
}

// Ejecutar
crearUbicacionesCamionetas();
