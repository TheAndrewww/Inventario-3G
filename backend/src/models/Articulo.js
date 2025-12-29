import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Articulo = sequelize.define('Articulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo_ean13: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Código de barras del artículo (soporta múltiples formatos)',
        field: 'codigo_ean13' // Mantiene compatibilidad con BD existente
    },
    codigo_tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'EAN13',
        comment: 'Tipo de código: EAN13, EAN8, UPCA, UPCE, CODE128, CODE39, QRCODE, DATAMATRIX',
        validate: {
            isIn: [['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX']]
        }
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categorias',
            key: 'id'
        }
    },
    ubicacion_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ubicaciones',
            key: 'id'
        }
    },
    stock_actual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Stock actual del artículo (puede ser negativo si hay faltante)'
    },
    stock_minimo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    stock_maximo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Stock máximo recomendado para el artículo',
        validate: {
            min: 0
        }
    },
    unidad: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'piezas',
        comment: 'Unidad de medida: piezas, kg, metros, litros, cajas, etc.'
    },
    proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        comment: 'Proveedor del artículo'
    },
    costo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    imagen_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL de la imagen del artículo'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'SKU del proveedor (opcional)'
    },
    es_herramienta: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si el artículo es una herramienta que se renta/presta'
    },
    pendiente_revision: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el artículo fue creado por almacén y está pendiente de revisión por admin'
    },
    etiquetado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el artículo tiene etiquetas generadas'
    }
}, {
    tableName: 'articulos',
    timestamps: true,
    indexes: [
        {
            fields: ['codigo_ean13']
        },
        {
            fields: ['nombre']
        },
        {
            fields: ['categoria_id']
        },
        {
            fields: ['activo']
        }
    ],
    hooks: {
        /**
         * Hook que se ejecuta después de actualizar un artículo
         * Sincroniza las unidades de herramientas cuando cambia el stock_actual
         */
        afterUpdate: async (articulo, options) => {
            // Solo ejecutar si:
            // 1. El artículo es una herramienta
            // 2. El stock_actual cambió
            if (!articulo.es_herramienta || !articulo.changed('stock_actual')) {
                return;
            }

            try {
                const { TipoHerramientaRenta, UnidadHerramientaRenta } = await import('./index.js');
                const { Op } = await import('sequelize');

                // Buscar el tipo de herramienta asociado
                const tipoHerramienta = await TipoHerramientaRenta.findOne({
                    where: { articulo_origen_id: articulo.id, activo: true }
                });

                if (!tipoHerramienta) {
                    console.log(`⚠️ Hook: No hay tipo de herramienta para artículo ${articulo.id}`);
                    return;
                }

                // Contar unidades actuales activas
                const unidadesActivas = await UnidadHerramientaRenta.count({
                    where: { tipo_herramienta_id: tipoHerramienta.id, activo: true }
                });

                const nuevoStock = parseInt(articulo.stock_actual);
                const diferencia = nuevoStock - unidadesActivas;

                console.log(`🔄 Hook afterUpdate: Sincronizando unidades - Stock=${nuevoStock}, Activas=${unidadesActivas}, Diferencia=${diferencia}`);

                if (diferencia > 0) {
                    // Crear nuevas unidades
                    const prefijo = tipoHerramienta.prefijo_codigo;

                    // Obtener el último número usado
                    const ultimaUnidad = await UnidadHerramientaRenta.findOne({
                        where: { codigo_unico: { [Op.like]: `${prefijo}-%` } },
                        order: [['codigo_unico', 'DESC']]
                    });

                    let numeroInicial = 1;
                    if (ultimaUnidad) {
                        const match = ultimaUnidad.codigo_unico.match(/-(\d+)$/);
                        if (match) {
                            numeroInicial = parseInt(match[1]) + 1;
                        }
                    }

                    // Crear las nuevas unidades
                    for (let i = 0; i < diferencia; i++) {
                        const numeroActual = numeroInicial + i;
                        const codigoUnico = `${prefijo}-${numeroActual.toString().padStart(3, '0')}`;

                        await UnidadHerramientaRenta.create({
                            tipo_herramienta_id: tipoHerramienta.id,
                            codigo_unico: codigoUnico,
                            codigo_ean13: null,
                            estado: 'buen_estado',
                            activo: true
                        }, { transaction: options.transaction });

                        console.log(`   ✅ Hook: Creada unidad ${codigoUnico}`);
                    }

                    // Actualizar contadores
                    await tipoHerramienta.update({
                        total_unidades: nuevoStock,
                        unidades_disponibles: tipoHerramienta.unidades_disponibles + diferencia
                    }, { transaction: options.transaction });

                } else if (diferencia < 0) {
                    // Desactivar unidades sobrantes
                    const unidadesSobran = Math.abs(diferencia);

                    const unidadesParaDesactivar = await UnidadHerramientaRenta.findAll({
                        where: {
                            tipo_herramienta_id: tipoHerramienta.id,
                            activo: true,
                            estado: { [Op.ne]: 'asignada' }
                        },
                        order: [['id', 'DESC']],
                        limit: unidadesSobran
                    });

                    for (const unidad of unidadesParaDesactivar) {
                        await unidad.update({
                            activo: false,
                            observaciones: `Desactivada automáticamente al reducir stock de ${unidadesActivas} a ${nuevoStock}`
                        }, { transaction: options.transaction });

                        console.log(`   ❌ Hook: Desactivada unidad ${unidad.codigo_unico}`);
                    }

                    // Actualizar contadores
                    const unidadesDisponiblesRestantes = Math.max(0, tipoHerramienta.unidades_disponibles - unidadesParaDesactivar.length);
                    await tipoHerramienta.update({
                        total_unidades: nuevoStock,
                        unidades_disponibles: unidadesDisponiblesRestantes
                    }, { transaction: options.transaction });
                }

            } catch (error) {
                console.error('⚠️ Error en hook afterUpdate de Articulo:', error.message);
                // No lanzar el error para no fallar la actualización del artículo
            }
        }
    }
});

export default Articulo;
