import { sequelize } from '../src/config/database.js';
import Articulo from '../src/models/Articulo.js';
import TipoHerramientaRenta from '../src/models/TipoHerramientaRenta.js';

async function fixHerramientasHuerfanas() {
  console.log('🔧 Iniciando corrección de herramientas huérfanas...\n');

  try {
    // 1. Encontrar tipos de herramienta sin artículo origen
    const tiposHuerfanos = await TipoHerramientaRenta.findAll({
      where: {
        articulo_origen_id: null,
        activo: true
      }
    });

    console.log(`📋 Tipos de herramienta sin artículo origen: ${tiposHuerfanos.length}\n`);

    for (const tipo of tiposHuerfanos) {
      console.log(`\n🔍 Procesando: ${tipo.nombre} (ID: ${tipo.id})`);

      // Buscar si existe un artículo con el mismo nombre
      let articulo = await Articulo.findOne({
        where: {
          nombre: tipo.nombre,
          es_herramienta: true
        }
      });

      if (!articulo) {
        // Si no existe, crearlo
        console.log(`   ⚠️  No existe artículo, creando nuevo...`);

        // Obtener el siguiente ID para generar el EAN-13
        const result = await sequelize.query(
          "SELECT nextval('articulos_id_seq'::regclass) as next_id",
          { type: sequelize.QueryTypes.SELECT }
        );
        const nextId = result[0].next_id;

        // Generar código EAN-13
        const base = String(nextId).padStart(12, '0');
        const digits = base.split('').map(Number);
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += digits[i] * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        const codigo_ean13 = base + checkDigit;

        articulo = await Articulo.create({
          nombre: tipo.nombre,
          descripcion: tipo.descripcion || `Artículo generado automáticamente para ${tipo.nombre}`,
          categoria_id: tipo.categoria_id || 12, // Sin Categoría
          ubicacion_id: tipo.ubicacion_id || 1,
          stock_actual: 0,
          stock_minimo: 0,
          unidad: 'piezas',
          costo_unitario: tipo.precio_unitario || 0,
          codigo_ean13: codigo_ean13,
          activo: true,
          es_herramienta: true
        });

        console.log(`   ✅ Artículo creado (ID: ${articulo.id}, EAN-13: ${codigo_ean13})`);
      } else {
        console.log(`   ✅ Artículo existente encontrado (ID: ${articulo.id})`);
      }

      // Vincular el tipo con el artículo
      await tipo.update({ articulo_origen_id: articulo.id });
      console.log(`   🔗 Tipo vinculado al artículo`);
    }

    // 2. Sincronizar nombres: si el artículo cambió de nombre, actualizar el tipo
    console.log('\n\n📝 Sincronizando nombres de artículos con tipos de herramienta...');

    const todosLosTipos = await TipoHerramientaRenta.findAll({
      where: { activo: true },
      include: [{
        model: Articulo,
        as: 'articuloOrigen',
        required: true
      }]
    });

    let actualizados = 0;
    for (const tipo of todosLosTipos) {
      if (tipo.articuloOrigen && tipo.nombre !== tipo.articuloOrigen.nombre) {
        console.log(`\n🔄 Actualizando nombre del tipo ${tipo.id}:`);
        console.log(`   Antes: "${tipo.nombre}"`);
        console.log(`   Después: "${tipo.articuloOrigen.nombre}"`);

        await tipo.update({
          nombre: tipo.articuloOrigen.nombre,
          descripcion: tipo.articuloOrigen.descripcion || tipo.descripcion
        });
        actualizados++;
      }
    }

    console.log(`\n✅ ${actualizados} tipos actualizados con nuevos nombres`);

    // 3. Desactivar tipos cuyo artículo origen está inactivo
    console.log('\n\n🗑️  Buscando tipos con artículos inactivos...');

    const tiposConArticulosInactivos = await TipoHerramientaRenta.findAll({
      where: { activo: true },
      include: [{
        model: Articulo,
        as: 'articuloOrigen',
        where: { activo: false },
        required: true
      }]
    });

    console.log(`📋 Encontrados: ${tiposConArticulosInactivos.length}`);

    for (const tipo of tiposConArticulosInactivos) {
      console.log(`   ❌ Desactivando: ${tipo.nombre} (artículo origen inactivo)`);
      await tipo.update({ activo: false });
    }

    console.log('\n\n✅ ¡Corrección completada exitosamente!');
    console.log('\nResumen:');
    console.log(`  - Tipos huérfanos corregidos: ${tiposHuerfanos.length}`);
    console.log(`  - Nombres sincronizados: ${actualizados}`);
    console.log(`  - Tipos desactivados: ${tiposConArticulosInactivos.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
fixHerramientasHuerfanas()
  .then(() => {
    console.log('\n👍 Script finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
