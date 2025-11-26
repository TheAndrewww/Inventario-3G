/**
 * Script para verificar un artículo específico
 */
import { Articulo } from '../src/models/index.js';

const articuloId = process.argv[2] || 440;

console.log(`🔍 Verificando artículo ID: ${articuloId}...\n`);

Articulo.findByPk(articuloId, { raw: true })
  .then(art => {
    if (art) {
      console.log('📦 Artículo encontrado:');
      console.log('  ID:', art.id);
      console.log('  Nombre:', art.nombre);
      console.log('  es_herramienta:', art.es_herramienta);
      console.log('  Stock actual:', art.stock_actual);
      console.log('  Activo:', art.activo);
      console.log('  Categoría ID:', art.categoria_id);
      console.log('  Ubicación ID:', art.ubicacion_id);
      console.log('');
    } else {
      console.log('❌ Artículo no encontrado\n');
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  })
  .finally(() => {
    process.exit();
  });
