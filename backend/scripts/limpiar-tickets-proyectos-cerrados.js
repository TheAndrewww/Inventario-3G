/**
 * Script: Limpieza única de tickets de proyectos ya cerrados.
 *
 * Recorre todos los ProduccionProyecto con etapa_actual='completado' y anula
 * los pedidos abiertos asociados (estado pendiente / aprobado / pendiente_aprobacion
 * / listo_para_entrega). El anulado revierte stock y cancela solicitudes de compra.
 *
 * Los tickets ya entregados no se tocan: aparecen filtrados por la query del
 * endpoint, pero no se modifica su estado para no descuadrar el inventario.
 *
 * USO: node backend/scripts/limpiar-tickets-proyectos-cerrados.js
 */

import { sequelize } from '../src/config/database.js';
import { ProduccionProyecto } from '../src/models/index.js';
import { anularPedidosDeProyecto } from '../src/services/pedidosCleanup.service.js';

const run = async () => {
    try {
        console.log('🔄 Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('✅ Conectado.\n');

        const proyectos = await ProduccionProyecto.findAll({
            where: { etapa_actual: 'completado', activo: true },
            attributes: ['id', 'nombre']
        });

        console.log(`📋 Proyectos completados encontrados: ${proyectos.length}\n`);

        let totalAnulados = 0;
        for (const p of proyectos) {
            const t = await sequelize.transaction();
            try {
                const res = await anularPedidosDeProyecto({
                    proyectoNombre: p.nombre,
                    motivo: `Limpieza automática: proyecto "${p.nombre}" cerrado`,
                    transaction: t
                });
                await t.commit();
                if (res.anulados > 0) {
                    totalAnulados += res.anulados;
                    console.log(`  • ${p.nombre} → ${res.anulados} ticket(s) anulados: ${res.ticketIds.join(', ')}`);
                }
            } catch (err) {
                await t.rollback();
                console.error(`  ❌ ${p.nombre}: ${err.message}`);
            }
        }

        console.log(`\n✅ Limpieza completada. Total de tickets anulados: ${totalAnulados}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    }
};

run();
