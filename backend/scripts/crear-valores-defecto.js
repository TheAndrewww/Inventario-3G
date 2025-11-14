/**
 * Script para crear categorías y ubicaciones por defecto
 * Ejecutar con: node scripts/crear-valores-defecto.js
 */

import { Categoria, Ubicacion } from '../src/models/index.js';
import { sequelize } from '../src/config/database.js';

async function crearValoresPorDefecto() {
  try {
    console.log('🔄 Iniciando creación de valores por defecto...\n');

    // Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida\n');

    // 1. Crear o verificar "Sin Categoría"
    const [sinCategoria, createdCategoria] = await Categoria.findOrCreate({
      where: { nombre: 'SIN CATEGORÍA' },
      defaults: {
        nombre: 'SIN CATEGORÍA',
        descripcion: 'Artículos sin categoría asignada',
        activo: true
      }
    });

    if (createdCategoria) {
      console.log('✅ Categoría "SIN CATEGORÍA" creada con ID:', sinCategoria.id);
    } else {
      console.log('ℹ️  Categoría "SIN CATEGORÍA" ya existe con ID:', sinCategoria.id);
    }

    // 2. Crear o verificar "Sin Ubicación"
    const [sinUbicacion, createdUbicacion] = await Ubicacion.findOrCreate({
      where: { codigo: 'SIN-UBICACION' },
      defaults: {
        codigo: 'SIN-UBICACION',
        almacen: 'Principal',
        descripcion: 'Artículos sin ubicación asignada',
        activo: true
      }
    });

    if (createdUbicacion) {
      console.log('✅ Ubicación "SIN-UBICACION" creada con ID:', sinUbicacion.id);
    } else {
      console.log('ℹ️  Ubicación "SIN-UBICACION" ya existe con ID:', sinUbicacion.id);
    }

    console.log('\n✅ Valores por defecto creados exitosamente');
    console.log('\nResumen:');
    console.log(`  - Categoría "SIN CATEGORÍA": ID ${sinCategoria.id}`);
    console.log(`  - Ubicación "SIN-UBICACION": ID ${sinUbicacion.id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear valores por defecto:', error);
    process.exit(1);
  }
}

// Ejecutar el script
crearValoresPorDefecto();
