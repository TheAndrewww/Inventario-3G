/**
 * Script de migración de herramientas de renta
 *
 * Este script migra todos los artículos marcados como es_herramienta = true
 * al nuevo sistema de tipos y unidades de herramientas de renta.
 *
 * Proceso:
 * 1. Busca todos los artículos con es_herramienta = true
 * 2. Por cada artículo:
 *    - Crea un tipo_herramienta_renta
 *    - Genera N unidades basado en stock_actual (mínimo 1)
 *    - Asigna códigos únicos a cada unidad
 *    - Vincula con el artículo original
 *    - Marca el artículo original con stock_decimal = 0
 */

import { sequelize } from '../src/config/database.js';
import {
    Articulo,
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    Categoria,
    Ubicacion,
    Proveedor
} from '../src/models/index.js';
import { Op } from 'sequelize';

/**
 * Genera un prefijo único basado en el nombre
 */
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
    return 'HR'; // Herramienta Renta por defecto
};

/**
 * Obtiene un prefijo único (sin colisiones)
 */
const obtenerPrefijoUnico = async (prefijoBase, transaction) => {
    let prefijo = prefijoBase;
    let contador = 1;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo },
            transaction // Pasar la transacción para ver registros no comiteados
        });

        if (!existe) {
            return prefijo;
        }

        // Si existe, agregar número
        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

/**
 * Migra un artículo de herramienta al nuevo sistema
 */
const migrarArticulo = async (articulo, transaction) => {
    console.log(`\n📦 Migrando: ${articulo.nombre}`);
    console.log(`   Stock actual: ${articulo.stock_actual}`);

    // 1. Generar prefijo único
    const prefijoBase = generarPrefijo(articulo.nombre);
    const prefijo = await obtenerPrefijoUnico(prefijoBase, transaction);
    console.log(`   Prefijo asignado: ${prefijo}`);

    // 2. Determinar cantidad de unidades a crear
    // Si el stock es 0 o null, crear al menos 1 unidad
    const cantidadUnidades = Math.max(1, Math.floor(articulo.stock_actual || 0));
    console.log(`   Unidades a crear: ${cantidadUnidades}`);

    // 3. Crear tipo de herramienta
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
        articulo_origen_id: articulo.id // Vincular con artículo original
    }, { transaction });

    console.log(`   ✅ Tipo creado: ID ${nuevoTipo.id}`);

    // 4. Crear unidades individuales
    const unidadesCreadas = [];
    for (let i = 1; i <= cantidadUnidades; i++) {
        const codigoUnico = `${prefijo}-${i.toString().padStart(3, '0')}`;

        const nuevaUnidad = await UnidadHerramientaRenta.create({
            tipo_herramienta_id: nuevoTipo.id,
            codigo_unico: codigoUnico,
            estado: 'disponible',
            activo: true
        }, { transaction });

        unidadesCreadas.push(codigoUnico);
    }

    console.log(`   ✅ ${cantidadUnidades} unidades creadas: ${unidadesCreadas.join(', ')}`);

    // 5. Actualizar artículo original
    // Marcar stock_decimal = 0 para indicar que fue migrado
    await articulo.update({
        stock_decimal: 0,
        observaciones: articulo.observaciones
            ? `${articulo.observaciones}\n[MIGRADO a sistema de herramientas de renta]`
            : '[MIGRADO a sistema de herramientas de renta]'
    }, { transaction });

    return {
        articulo_id: articulo.id,
        articulo_nombre: articulo.nombre,
        tipo_id: nuevoTipo.id,
        prefijo: prefijo,
        unidades_creadas: cantidadUnidades,
        codigos: unidadesCreadas
    };
};

/**
 * Función principal de migración
 */
const ejecutarMigracion = async () => {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   MIGRACIÓN DE HERRAMIENTAS DE RENTA AL NUEVO SISTEMA     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const transaction = await sequelize.transaction();

    try {
        // 1. Buscar todos los artículos marcados como herramientas de renta
        const articulosHerramienta = await Articulo.findAll({
            where: {
                es_herramienta: true,
                activo: true
            },
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen']
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre']
                }
            ],
            order: [['nombre', 'ASC']]
        });

        console.log(`📊 Artículos encontrados: ${articulosHerramienta.length}\n`);

        if (articulosHerramienta.length === 0) {
            console.log('⚠️  No se encontraron artículos marcados como herramientas de renta.');
            console.log('   Asegúrate de que existan artículos con es_herramienta = true\n');
            await transaction.rollback();
            return;
        }

        // 2. Confirmar migración
        console.log('Se migrarán los siguientes artículos:\n');
        articulosHerramienta.forEach((art, index) => {
            console.log(`${index + 1}. ${art.nombre} (Stock: ${art.stock_actual || 0})`);
        });

        console.log('\n🔄 Iniciando migración...\n');

        // 3. Migrar cada artículo
        const resultados = [];
        for (const articulo of articulosHerramienta) {
            try {
                const resultado = await migrarArticulo(articulo, transaction);
                resultados.push(resultado);
            } catch (error) {
                console.error(`   ❌ Error migrando ${articulo.nombre}:`, error.message);
                throw error; // Detener la migración si hay un error
            }
        }

        // 4. Commit de la transacción
        await transaction.commit();

        // 5. Mostrar resumen
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              MIGRACIÓN COMPLETADA EXITOSAMENTE            ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.log('📊 RESUMEN:\n');
        console.log(`   Total de artículos migrados: ${resultados.length}`);
        console.log(`   Total de tipos creados: ${resultados.length}`);

        const totalUnidades = resultados.reduce((sum, r) => sum + r.unidades_creadas, 0);
        console.log(`   Total de unidades creadas: ${totalUnidades}\n`);

        console.log('📋 DETALLE DE TIPOS CREADOS:\n');
        resultados.forEach((resultado, index) => {
            console.log(`${index + 1}. ${resultado.articulo_nombre}`);
            console.log(`   Prefijo: ${resultado.prefijo}`);
            console.log(`   Unidades: ${resultado.unidades_creadas}`);
            console.log(`   Códigos: ${resultado.codigos.slice(0, 3).join(', ')}${resultado.codigos.length > 3 ? '...' : ''}`);
            console.log('');
        });

        console.log('✅ Los artículos originales han sido marcados con stock_decimal = 0');
        console.log('✅ Todos los datos se han migrado correctamente al nuevo sistema\n');

    } catch (error) {
        await transaction.rollback();
        console.error('\n❌ ERROR EN LA MIGRACIÓN:', error.message);
        console.error('\n🔄 Se ha revertido la transacción. No se realizaron cambios.\n');
        throw error;
    }
};

// Ejecutar migración
ejecutarMigracion()
    .then(() => {
        console.log('🎉 Proceso de migración finalizado\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
