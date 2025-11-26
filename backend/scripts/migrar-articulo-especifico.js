/**
 * Script para migrar UN artículo específico al sistema de herramientas
 *
 * Uso: node scripts/migrar-articulo-especifico.js <ID>
 * Ejemplo: node scripts/migrar-articulo-especifico.js 440
 */

import { sequelize } from '../src/config/database.js';
import {
    Articulo,
    TipoHerramientaRenta,
    UnidadHerramientaRenta
} from '../src/models/index.js';

const generarPrefijo = (nombre) => {
    const palabrasIgnoradas = ['de', 'la', 'el', 'del', 'los', 'las', 'y', 'para', 'con', 'a'];
    const palabras = nombre
        .split(' ')
        .filter(p => !palabrasIgnoradas.includes(p.toLowerCase()))
        .filter(p => p.length > 0);

    if (palabras.length >= 2) {
        return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1) {
        return palabras[0].substring(0, 2).toUpperCase();
    }
    return 'HR';
};

const obtenerPrefijoUnico = async (prefijoBase, transaction) => {
    let prefijo = prefijoBase;
    let contador = 1;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo },
            transaction
        });

        if (!existe) return prefijo;
        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

const migrarArticulo = async (articuloId) => {
    const transaction = await sequelize.transaction();

    try {
        console.log(`🔍 Buscando artículo ID: ${articuloId}...\n`);

        const articulo = await Articulo.findByPk(articuloId, { transaction });

        if (!articulo) {
            console.log(`❌ Artículo ${articuloId} no encontrado\n`);
            await transaction.rollback();
            process.exit(1);
        }

        console.log(`📦 Artículo: ${articulo.nombre}`);
        console.log(`   es_herramienta: ${articulo.es_herramienta}`);
        console.log(`   Stock actual: ${articulo.stock_actual}\n`);

        // Marcar como herramienta si no lo está
        if (!articulo.es_herramienta) {
            await articulo.update({ es_herramienta: true }, { transaction });
            console.log('✅ Marcado como herramienta de renta\n');
        }

        // Verificar si ya existe un tipo para este artículo
        const tipoExistente = await TipoHerramientaRenta.findOne({
            where: { articulo_origen_id: articulo.id },
            transaction
        });

        if (tipoExistente) {
            console.log(`⚠️  Ya existe un tipo de herramienta para este artículo:`);
            console.log(`   Tipo ID: ${tipoExistente.id}`);
            console.log(`   Prefijo: ${tipoExistente.prefijo_codigo}`);
            console.log(`   Total unidades: ${tipoExistente.total_unidades}\n`);
            await transaction.rollback();
            process.exit(0);
        }

        // Generar prefijo
        const prefijoBase = generarPrefijo(articulo.nombre);
        const prefijo = await obtenerPrefijoUnico(prefijoBase, transaction);

        // Determinar cantidad de unidades
        const cantidadUnidades = Math.max(1, Math.floor(articulo.stock_actual || 0));

        console.log(`🔄 Migrando al sistema de herramientas...`);
        console.log(`   Prefijo: ${prefijo}`);
        console.log(`   Unidades a crear: ${cantidadUnidades}\n`);

        // Crear tipo de herramienta
        const nuevoTipo = await TipoHerramientaRenta.create({
            nombre: articulo.nombre,
            descripcion: articulo.descripcion || `Migrado desde artículo #${articulo.id}`,
            prefijo_codigo: prefijo,
            categoria_id: articulo.categoria_id,
            ubicacion_id: articulo.ubicacion_id,
            proveedor_id: articulo.proveedor_id,
            precio_unitario: articulo.costo_unitario || 0,
            total_unidades: cantidadUnidades,
            unidades_disponibles: cantidadUnidades,
            unidades_asignadas: 0,
            imagen_url: articulo.imagen_url,
            activo: articulo.activo,
            articulo_origen_id: articulo.id
        }, { transaction });

        console.log(`✅ Tipo creado - ID: ${nuevoTipo.id}\n`);

        // Crear unidades
        console.log(`📝 Creando ${cantidadUnidades} unidades...\n`);
        const unidadesCreadas = [];

        for (let i = 1; i <= cantidadUnidades; i++) {
            const codigoUnico = `${prefijo}-${i.toString().padStart(3, '0')}`;

            await UnidadHerramientaRenta.create({
                tipo_herramienta_id: nuevoTipo.id,
                codigo_unico: codigoUnico,
                estado: 'disponible',
                activo: true
            }, { transaction });

            unidadesCreadas.push(codigoUnico);
        }

        await transaction.commit();

        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║         MIGRACIÓN COMPLETADA EXITOSAMENTE               ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');

        console.log(`📊 Artículo: ${articulo.nombre}`);
        console.log(`   Tipo ID: ${nuevoTipo.id}`);
        console.log(`   Prefijo: ${prefijo}`);
        console.log(`   Unidades creadas: ${cantidadUnidades}`);
        console.log(`   Códigos: ${unidadesCreadas.slice(0, 5).join(', ')}${cantidadUnidades > 5 ? '...' : ''}\n`);

    } catch (error) {
        await transaction.rollback();
        console.error('\n❌ ERROR:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
};

// Obtener ID del artículo
const articuloId = parseInt(process.argv[2]);

if (!articuloId || isNaN(articuloId)) {
    console.log('❌ ERROR: Debes especificar un ID de artículo\n');
    console.log('Uso: node scripts/migrar-articulo-especifico.js <ID>\n');
    console.log('Ejemplo: node scripts/migrar-articulo-especifico.js 440\n');
    process.exit(1);
}

migrarArticulo(articuloId);
