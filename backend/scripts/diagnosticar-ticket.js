/**
 * Diagnóstico: imprime info de un ticket y por qué no fue filtrado.
 *
 * USO:
 *   node backend/scripts/diagnosticar-ticket.js PED-010426-0113-01
 */

import { sequelize } from '../src/config/database.js';
import { Movimiento, ProduccionProyecto } from '../src/models/index.js';
import { mismosProyectos } from '../src/services/pedidosCleanup.service.js';

const run = async () => {
    const ticketId = process.argv[2];
    if (!ticketId) {
        console.error('❌ Falta el ticket_id. Uso: node backend/scripts/diagnosticar-ticket.js PED-010426-0113-01');
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        console.log(`🔍 Buscando ticket ${ticketId}...\n`);

        const ticket = await Movimiento.findOne({
            where: { ticket_id: ticketId, tipo: 'pedido' },
            attributes: ['id', 'ticket_id', 'tipo', 'estado', 'proyecto', 'proyecto_id', 'fecha_hora']
        });

        if (!ticket) {
            console.log(`❌ No se encontró ningún Movimiento (tipo=pedido) con ticket_id = "${ticketId}"`);
            process.exit(0);
        }

        console.log('📋 Datos del ticket:');
        console.log('   id          :', ticket.id);
        console.log('   ticket_id   :', ticket.ticket_id);
        console.log('   estado      :', ticket.estado);
        console.log('   proyecto    :', JSON.stringify(ticket.proyecto));
        console.log('   proyecto_id :', ticket.proyecto_id);
        console.log('   fecha       :', ticket.fecha_hora);

        console.log('\n📋 Proyectos con etapa_actual = "completado":');
        const completados = await ProduccionProyecto.findAll({
            where: { etapa_actual: 'completado' },
            attributes: ['id', 'nombre', 'tipo_proyecto', 'activo', 'fecha_completado'],
            order: [['fecha_completado', 'DESC']]
        });
        if (completados.length === 0) {
            console.log('   (ninguno)');
        } else {
            completados.forEach(p => {
                const match = mismosProyectos(ticket.proyecto, p.nombre);
                const marker = match ? '✅ MATCH' : '  ';
                console.log(`   ${marker} id=${p.id}  activo=${p.activo}  tipo=${p.tipo_proyecto || '-'}  nombre=${JSON.stringify(p.nombre)}`);
            });
        }

        const algunMatch = completados.some(p => mismosProyectos(ticket.proyecto, p.nombre));
        console.log('\n📊 Resultado:');
        if (algunMatch) {
            console.log('   ✅ El nuevo match detecta este ticket como perteneciente a un proyecto cerrado.');
            console.log('   👉 Si aún aparece en la UI, asegúrate de que Railway tiene desplegado este commit.');
        } else {
            console.log('   ❌ El match aún no detecta este ticket como cerrado.');
            console.log('   👉 Revisa el nombre exacto del proyecto arriba y compara visualmente con `proyecto` del ticket.');
            console.log('   👉 Probable: el ProduccionProyecto correspondiente NO está en etapa_actual="completado".');
        }

        // Buscar candidatos por similitud aún si no están en completado
        console.log('\n🔎 Proyectos cuyo nombre coincide con este ticket (cualquier etapa):');
        const todos = await ProduccionProyecto.findAll({
            attributes: ['id', 'nombre', 'etapa_actual', 'activo'],
            order: [['updated_at', 'DESC']]
        });
        const candidatos = todos.filter(p => mismosProyectos(ticket.proyecto, p.nombre));
        if (candidatos.length === 0) {
            console.log('   (ninguno con el match flexible)');
        } else {
            candidatos.forEach(p => {
                console.log(`   id=${p.id}  etapa=${p.etapa_actual}  activo=${p.activo}  nombre=${JSON.stringify(p.nombre)}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
};

run();
