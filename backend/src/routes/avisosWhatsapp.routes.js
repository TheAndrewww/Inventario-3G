/**
 * Cola de avisos de WhatsApp — la consume el bot contable.
 *
 * No usa el JWT de usuarios: quien llama es otro sistema, no una persona.
 * Se autentica con el token compartido WHATSAPP_PUENTE_TOKEN.
 */

import express from 'express';
import { Op } from 'sequelize';
import { proyectosAbiertos, resolverFechasInstalacion, leerCitasCercanas, resumenProduccion } from '../services/fechaInstalacion.service.js';
import { obtenerDistribucionEquipos } from '../services/googleSheets.service.js';
import { AvisoWhatsApp, OrdenCompra, Usuario, Proveedor, DetalleOrdenCompra, Articulo, ArticuloProveedor, ProduccionProyecto, SolicitudCompra, Movimiento, DetalleMovimiento, Equipo } from '../models/index.js';
import { urlSolicitudes } from '../services/barridoCompras.service.js';
import { crearNotificacion } from '../controllers/notificaciones.controller.js';
import { getNombresProyectosAbiertos, pedidoEsDeProyectoAbierto, mismosProyectos } from '../controllers/pedidos.controller.js';
import { enviarEmailEstadoOrden } from '../services/email.service.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import { ventanaAvisos, dentroDeHorario } from '../utils/horarioAvisos.js';
import BitacoraAviso from '../models/BitacoraAviso.js';
import { ORIGENES_BITACORA } from './sistemas/bitacora.js';
import { anotarLatido } from './sistemas/latidos.js';

const router = express.Router();

/**
 * GET /api/avisos-whatsapp/produccion/avisos — B1 paso 1 · PLA-12: Planta › Producción › Avisos.
 * Esta SÍ es para personas (sesión de Planta), no para el bot: va antes del candado del puente.
 *
 * Lo que se mandó a Producción, para verlo junto en Planta (la pantalla es de Diseño 3G): la cola propia de Planta
 * (avisos_whatsapp, destino 'produccion') y, desde PLA-14, la bitácora de Carla y Julia (bitacora_avisos, la manda
 * Finanzas por la puerta /api/sistemas/v1/bitacora-avisos), en el mismo formato. Solo lectura. Query: dias (7; máx. 31),
 * dia=AAAA-MM-DD, origen=planta,carla,julia, destino=produccion,charly,susana,asesor (como la liga del Inicio:
 * ?destino=susana,asesor). Roles: los del tablero de producción.
 */
const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const HORA_MX = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false });
const listaDe = (valor) => String(valor || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
// Primer renglón del aviso sin emojis ni asteriscos: «📅 *Cambió una instalación*» → «Cambió una instalación»
const tituloDeAviso = (mensaje) => (String(mensaje || '').split('\n').find(l => l.trim()) || 'Aviso')
    .replace(/[*_~]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Aviso';

router.get('/produccion/avisos', verificarToken, verificarRol('administrador', 'diseñador', 'almacen'), async (req, res) => {
    try {
        const dias = Math.min(Math.max(parseInt(req.query.dias) || 7, 1), 31);
        const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dia || '')) ? req.query.dia : null;
        const origenes = listaDe(req.query.origen);
        const destinos = listaDe(req.query.destino);
        const desde = new Date(Date.now() - dias * 86400000);

        // La cola propia de Planta: lo que Planta deja para el grupo Producción (lo publica Julia)
        let filas = [];
        if ((!origenes.length || origenes.includes('planta')) && (!destinos.length || destinos.includes('produccion'))) {
            filas = await AvisoWhatsApp.findAll({
                where: { destino: 'produccion', created_at: { [Op.gte]: desde } },
                attributes: ['id', 'tipo', 'mensaje', 'estado', 'error', 'enviado_at', 'created_at'],
                order: [['created_at', 'DESC'], ['id', 'DESC']],
                limit: 300
            });
        }

        const avisos = filas.map(a => ({
            id: `planta-${a.id}`,
            origen: 'planta',
            destino: 'produccion',
            tipo: a.tipo,
            titulo: tituloDeAviso(a.mensaje),
            texto: a.mensaje,
            cuando: a.created_at,
            dia: DIA_MX.format(a.created_at),
            hora: HORA_MX.format(a.created_at),
            estado: a.estado, // pendiente | enviado | error
            enviadoEn: a.enviado_at,
            // Sin teléfonos: el error del bot puede traer uno
            error: a.estado === 'error' ? String(a.error || '').replace(/\d{7,}/g, '•••').slice(0, 160) : null
        }));

        // B1 · PLA-14: la bitácora de Carla y Julia (solo lo que sí salió). Si la tabla falla, la pantalla sigue con la
        // cola de Planta, como antes.
        const fuentes = [
            { origen: 'planta', conectada: true },
            { origen: 'carla', conectada: false },
            { origen: 'julia', conectada: false }
        ];
        const origenesBitacora = origenes.length ? origenes.filter(o => ORIGENES_BITACORA.includes(o)) : ORIGENES_BITACORA;
        try {
            // «Conectada» = ya llegó al menos un aviso de ese origen (aunque no sea de estos días)
            const ultimos = await BitacoraAviso.findAll({
                attributes: ['origen', [BitacoraAviso.sequelize.fn('MAX', BitacoraAviso.sequelize.col('created_at')), 'ultimo']],
                group: ['origen'],
                raw: true
            });
            for (const u of ultimos) {
                const f = fuentes.find(x => x.origen === u.origen);
                if (f) Object.assign(f, { conectada: true, ultimo: u.ultimo });
            }
            if (origenesBitacora.length) {
                const where = { origen: { [Op.in]: origenesBitacora }, enviado_en: { [Op.gte]: desde } };
                if (destinos.length) where.destino = { [Op.in]: destinos };
                const bitacora = await BitacoraAviso.findAll({
                    where,
                    attributes: ['id', 'origen', 'destino', 'texto', 'enviado_en', 'proyecto', 'obra_id'],
                    order: [['enviado_en', 'DESC'], ['id', 'DESC']],
                    limit: 300
                });
                for (const b of bitacora) {
                    avisos.push({
                        id: `bitacora-${b.id}`,
                        origen: b.origen,
                        destino: b.destino,
                        tipo: 'bitacora',
                        titulo: tituloDeAviso(b.texto),
                        texto: b.texto,
                        cuando: b.enviado_en,
                        dia: DIA_MX.format(b.enviado_en),
                        hora: HORA_MX.format(b.enviado_en),
                        estado: 'enviado', // Finanzas solo anota lo que sí salió
                        enviadoEn: b.enviado_en,
                        error: null,
                        proyecto: b.proyecto,
                        obra: b.obra_id
                    });
                }
                if (bitacora.length) avisos.sort((x, y) => new Date(y.cuando) - new Date(x.cuando));
            }
        } catch (e) {
            console.error('No se pudo leer la bitácora de avisos (se muestra solo la cola de Planta):', e.message);
        }

        res.json({
            success: true,
            data: {
                avisos: avisos.filter(a => !dia || a.dia === dia),
                dias,
                desde: desde.toISOString(),
                hoy: DIA_MX.format(new Date()),
                // Qué fuentes ya llegan a esta pantalla
                fuentes
            }
        });
    } catch (error) {
        console.error('Error al listar los avisos de Producción:', error);
        res.status(500).json({ success: false, message: 'Error al listar los avisos de Producción' });
    }
});

/** Solo pasa quien traiga el token compartido del puente. */
const verificarPuente = (req, res, next) => {
    const esperado = process.env.WHATSAPP_PUENTE_TOKEN;

    if (!esperado) {
        return res.status(503).json({ success: false, message: 'Puente de WhatsApp no configurado' });
    }

    const recibido = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (recibido !== esperado) {
        console.warn('⚠️ Acceso al puente de WhatsApp con token inválido');
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    next();
};

router.use(verificarPuente);

/**
 * GET /api/avisos-whatsapp/pendientes
 * Avisos que faltan por publicar, del más viejo al más nuevo.
 *
 * D7 · PLA-18 (HORARIO_AVISOS, apagada por omisión = como hoy): fuera de horario (D-11: lunes a sábado de 8:00 a
 * 21:00) solo se entregan los avisos `urgente`; los demás esperan en la cola y salen al abrir, en el mismo orden.
 * Un aviso de autorización que quedó reemplazado (A9) antes de salir se descarta: ya no se publica.
 * Lo que recibe Julia no cambia de forma.
 *
 * D1 · PLA-15: si la consulta trae las cabeceras X-3G-Latido-* (Julia con FIN-08), Planta guarda el latido de la línea
 * del contable para GET /api/sistemas/v1/latidos (ver routes/sistemas/latidos.js). No cambia ni retrasa la respuesta;
 * sin cabeceras (Julia de antes) todo sigue igual.
 */
const descartarReemplazados = async () => {
    const [n] = await AvisoWhatsApp.update(
        { estado: 'descartado', error: 'Reemplazado por un aviso más nuevo de la misma orden antes de salir (no se publica)' },
        { where: { estado: 'pendiente', reemplazado_por_id: { [Op.ne]: null } } }
    );
    if (n) console.log(`[horario-avisos] ${n} aviso(s) reemplazado(s) descartado(s) antes de salir`);
};

router.get('/pendientes', async (req, res) => {
    anotarLatido(req.headers); // D1 · PLA-15: nunca lanza ni espera
    try {
        const limite = Math.min(parseInt(req.query.limit) || 20, 50);

        const where = {
            estado: 'pendiente',
            intentos: { [Op.lt]: 5 } // tras 5 intentos fallidos deja de reintentarse
        };
        const ventana = ventanaAvisos();
        if (ventana) {
            await descartarReemplazados();
            where.reemplazado_por_id = null;
            if (!dentroDeHorario(new Date(), ventana)) where.urgente = true;
        }

        const avisos = await AvisoWhatsApp.findAll({
            where,
            order: [['id', 'ASC']], // el id autoincremental ya da el orden cronológico
            limit: limite,
            attributes: ['id', 'destino', 'mensaje', 'intentos', 'tipo', 'referencia_id']
        });

        res.json({ success: true, data: { avisos } });
    } catch (error) {
        console.error('Error al listar avisos pendientes:', error);
        // El detalle sí se devuelve: esta ruta solo la ve el bot (va con token),
        // y sin él es imposible diagnosticar el puente desde el otro extremo.
        res.status(500).json({ success: false, message: 'Error al listar avisos', error: error.message });
    }
});

/**
 * POST /api/avisos-whatsapp/:id/resultado
 * El bot reporta si pudo publicarlo. Body: { ok: boolean, error?: string }
 */
/**
 * POST /api/avisos-whatsapp/reintentar
 * Devuelve a la cola los avisos que se dieron por perdidos (estado 'error').
 *
 * Un aviso se rinde a los 5 intentos para no reintentar por siempre un mensaje roto. Pero si
 * lo que falló fue WhatsApp —el 28-sep-2026 la sesión pasó 5 horas sin arrancar—, el mensaje
 * estaba bien y lo que se perdió fue el reporte de producción que alguien sí subió.
 *
 * Body opcional: { horas = 24, destino }.
 */
router.post('/reintentar', async (req, res) => {
    try {
        const horas = Math.min(Number(req.body?.horas) || 24, 24 * 7);
        const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
        const where = { estado: 'error', created_at: { [Op.gte]: desde } };
        if (req.body?.destino) where.destino = req.body.destino;

        const avisos = await AvisoWhatsApp.findAll({ where, order: [['id', 'ASC']] });
        for (const a of avisos) await a.update({ estado: 'pendiente', intentos: 0, error: null });

        console.log(`🔁 ${avisos.length} aviso(s) devueltos a la cola`);
        res.json({
            success: true,
            data: {
                reencolados: avisos.length,
                avisos: avisos.map(a => ({ id: a.id, destino: a.destino, mensaje: a.mensaje.slice(0, 80) }))
            }
        });
    } catch (error) {
        console.error('Error al reencolar avisos:', error);
        res.status(500).json({ success: false, message: 'Error al reencolar', error: error.message });
    }
});

router.post('/:id/resultado', async (req, res) => {
    try {
        const aviso = await AvisoWhatsApp.findByPk(req.params.id);
        if (!aviso) {
            return res.status(404).json({ success: false, message: 'Aviso no encontrado' });
        }

        if (req.body?.ok) {
            await aviso.update({ estado: 'enviado', enviado_at: new Date(), error: null });
        } else {
            const intentos = aviso.intentos + 1;
            await aviso.update({
                intentos,
                // Se rinde a los 5 intentos para no reintentar por siempre un mensaje roto
                estado: intentos >= 5 ? 'error' : 'pendiente',
                error: (req.body?.error || 'error desconocido').slice(0, 500)
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error al marcar el aviso:', error);
        res.status(500).json({ success: false, message: 'Error al marcar el aviso' });
    }
});

/** Deja un teléfono en sus últimos 10 dígitos, para comparar sin importar el formato. */
const soloDigitos = (valor) => (valor || '').toString().replace(/\D/g, '').slice(-10);

/**
 * POST /api/avisos-whatsapp/:id/decision
 * El bot reporta que alguien reaccionó sobre un aviso de autorización.
 *
 * Body: { aprobado: boolean, telefono: string, motivo?: string }
 *
 * Solo autorizan los ADMINISTRADORES activos cuyo teléfono esté registrado en
 * Usuarios: la reacción de cualquier otro integrante del grupo no mueve nada.
 */
router.post('/:id/decision', async (req, res) => {
    try {
        const { aprobado, telefono, motivo } = req.body || {};

        const aviso = await AvisoWhatsApp.findByPk(req.params.id);
        if (!aviso) {
            return res.status(404).json({ success: false, message: 'Aviso no encontrado' });
        }
        if (aviso.tipo !== 'aprobacion_orden' || !aviso.referencia_id) {
            return res.status(400).json({ success: false, message: 'Ese aviso no espera autorización' });
        }

        // ¿Quién reaccionó? Debe ser un administrador activo con ese teléfono.
        const digitos = soloDigitos(telefono);
        if (!digitos) {
            return res.status(400).json({ success: false, message: 'No se recibió el teléfono de quien reaccionó' });
        }

        // Lista blanca opcional: si está puesta, solo esos números autorizan aunque
        // haya otros administradores con teléfono capturado.
        const listaBlanca = (process.env.ORDENES_APROBADORES || '')
            .split(',')
            .map(n => soloDigitos(n))
            .filter(Boolean);

        if (listaBlanca.length > 0 && !listaBlanca.includes(digitos)) {
            return res.status(403).json({
                success: false,
                message: 'Ese número no está autorizado para aprobar órdenes de compra'
            });
        }

        const administradores = await Usuario.findAll({
            where: { rol: 'administrador', activo: true },
            attributes: ['id', 'nombre', 'telefono']
        });
        const autorizador = administradores.find(u => soloDigitos(u.telefono) === digitos);

        if (!autorizador) {
            // Distinguir "no eres tú" de "nadie puede": si ningún administrador
            // tiene teléfono capturado, la autorización por WhatsApp no funciona
            // para nadie y conviene decirlo en vez de dejarlo en un "no autorizado".
            const conTelefono = administradores.filter(u => soloDigitos(u.telefono));
            const message = conTelefono.length === 0
                ? 'Ningún administrador tiene teléfono registrado en Usuarios, así que no se puede autorizar por WhatsApp. Captúralo en el sistema.'
                : `El número ${digitos} no corresponde a ningún administrador. Captúralo en el usuario que va a autorizar.`;

            return res.status(403).json({ success: false, message });
        }

        const orden = await OrdenCompra.findByPk(aviso.referencia_id, {
            include: [
                { model: Usuario, as: 'creador', attributes: ['id', 'nombre', 'email'], required: false },
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false },
                {
                    model: DetalleOrdenCompra,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad'] }]
                }
            ]
        });

        if (!orden) {
            return res.status(404).json({ success: false, message: 'La orden ya no existe' });
        }

        // Si ya se resolvió (por correo o desde el sistema), no se vuelve a mover.
        if (orden.estado !== 'pendiente_aprobacion') {
            return res.json({
                success: true,
                yaProcesada: true,
                message: `La orden ${orden.ticket_id} ya estaba ${orden.estado}`
            });
        }

        // A9 · PLA-06: la orden se editó y se volvió a pedir la autorización con un mensaje nuevo. Una reacción sobre
        // el mensaje viejo no mueve la orden; Julia publica este texto y da el mensaje por resuelto (Julia no cambia).
        if (aviso.reemplazado_por_id) {
            console.log(`🛒 Reacción sobre el aviso ${aviso.id}, reemplazado por el ${aviso.reemplazado_por_id}: la orden ${orden.ticket_id} no se mueve`);
            return res.json({
                success: true,
                yaProcesada: true,
                message: `La orden ${orden.ticket_id} cambió después de ese mensaje: autoriza el mensaje más reciente.`
            });
        }

        if (aprobado) {
            await orden.update({
                estado: 'enviada',
                motivo_rechazo: null,
                aprobado_por_id: autorizador.id,
                fecha_aprobacion: new Date(),
                fecha_envio: new Date()
            });
        } else {
            await orden.update({
                estado: 'rechazada',
                aprobado_por_id: autorizador.id,
                fecha_aprobacion: new Date(),
                motivo_rechazo: motivo || `Rechazada por ${autorizador.nombre} desde WhatsApp`
            });
            // Igual que al rechazar desde el sistema: el material vuelve a la lista de
            // solicitudes para corregirlo. La marca [Revertida automáticamente] es la que
            // evita que el aviso de Compras lo anuncie de nuevo como si fuera material nuevo.
            await SolicitudCompra.update(
                {
                    estado: 'pendiente',
                    orden_compra_id: null,
                    observaciones: `[Revertida automáticamente] La orden ${orden.ticket_id} fue rechazada desde WhatsApp. Solicitud vuelve a estado pendiente.`
                },
                { where: { orden_compra_id: orden.id, estado: { [Op.in]: ['cancelada', 'en_orden'] } } }
            ).catch(e => console.error('No se pudieron revertir las solicitudes:', e.message));
        }

        // Avisos al creador; que fallen no debe deshacer la autorización
        try {
            await crearNotificacion({
                usuario_id: orden.usuario_creador_id,
                tipo: 'orden_estado_cambiado',
                titulo: aprobado ? '✅ Orden de compra aprobada' : '❌ Orden de compra rechazada',
                mensaje: `Tu orden ${orden.ticket_id} fue ${aprobado ? 'aprobada' : 'rechazada'} por ${autorizador.nombre} desde WhatsApp.`,
                url: '/ordenes-compra'
            });
        } catch (e) { /* el aviso es secundario */ }

        enviarEmailEstadoOrden(orden, aprobado ? 'aprobada' : 'rechazada', motivo || null, `${autorizador.nombre} (por WhatsApp)`)
            .catch(e => console.error('Error al avisar por correo:', e.message));

        // Aprobada = ya se pidió: almacén tiene que saber qué va a llegar y cuándo.
        if (aprobado) {
            import('../services/whatsapp.service.js')
                .then(({ avisarRequisicionesOrdenAprobada }) => avisarRequisicionesOrdenAprobada(orden))
                .catch(e => console.error('Error al avisar a Requisiciones:', e.message));
        }

        console.log(`🛒 Orden ${orden.ticket_id} ${aprobado ? 'aprobada' : 'rechazada'} por ${autorizador.nombre} desde WhatsApp`);

        res.json({
            success: true,
            message: aprobado
                ? `Orden ${orden.ticket_id} autorizada por ${autorizador.nombre}. Ya puede enviarse al proveedor.`
                // Con el rechazo a secas nadie sabía qué seguía: la orden queda ahí y el
                // material se vuelve a listar solo. Se dice dónde corregirla.
                : `Orden ${orden.ticket_id} rechazada por ${autorizador.nombre}.\nEl material vuelve a la lista para corregirlo:\n${urlSolicitudes()}`
        });

    } catch (error) {
        console.error('Error al procesar la decisión:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la decisión', error: error.message });
    }
});

/**
 * POST /api/avisos-whatsapp/costos
 * Precios de una factura de proveedor, que manda el bot contable al leer su CFDI.
 *
 * Las órdenes de compra nacen en $0 porque el catálogo de costos está vacío, y sin importe
 * nadie puede decidir qué orden pagó un depósito. El precio real ya viene en cada factura:
 * aquí se guarda, por proveedor y en el artículo, para que la siguiente orden nazca con su
 * importe.
 *
 * Reglas, en este orden:
 *  1. Se cruza por el CÓDIGO del proveedor (`sku_proveedor`), que es lo que almacén ya enseña
 *     al cruzar una factura en la recepción.
 *  2. Si no hay código, por nombre EXACTO del artículo (normalizado). Nada de parecidos: un
 *     precio en el artículo equivocado se arrastra a todas sus órdenes.
 *  3. Si la unidad de la factura no es la del artículo (cajas contra piezas), NO se escribe:
 *     el precio sería de otra cosa.
 * Lo que no cruza se ignora. Nunca se dan de alta artículos desde aquí.
 *
 * Body: { uuid, proveedor_rfc, proveedor_nombre, fecha, partidas: [{ descripcion, codigo, unidad, cantidad, valor_unitario }] }
 */
const normalizarTexto = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s/."]/g, ' ').replace(/\s+/g, ' ').trim();

router.post('/costos', async (req, res) => {
    try {
        const { uuid, proveedor_rfc, proveedor_nombre, partidas } = req.body || {};
        if (!Array.isArray(partidas) || partidas.length === 0) {
            return res.status(400).json({ success: false, message: 'La factura no trae partidas con precio' });
        }

        // El proveedor se busca por RFC (la prueba dura del CFDI) y si no, por nombre.
        let proveedor = null;
        if (proveedor_rfc) proveedor = await Proveedor.findOne({ where: { rfc: proveedor_rfc } });
        if (!proveedor && proveedor_nombre) {
            const todos = await Proveedor.findAll({ attributes: ['id', 'nombre'] });
            const buscado = normalizarTexto(proveedor_nombre);
            proveedor = todos.find(p => normalizarTexto(p.nombre) === buscado) || null;
        }

        const resultado = { uuid, proveedor: proveedor?.nombre || null, actualizados: 0, sin_cruce: 0, unidad_distinta: 0 };

        for (const partida of partidas) {
            const precio = parseFloat(partida.valor_unitario) || 0;
            if (precio <= 0) { resultado.sin_cruce += 1; continue; }

            let articulo = null;

            // 1) Por código del proveedor
            const codigo = String(partida.codigo || '').trim();
            if (proveedor && codigo) {
                const rel = await ArticuloProveedor.findOne({
                    where: { proveedor_id: proveedor.id, sku_proveedor: codigo }
                });
                if (rel) articulo = await Articulo.findByPk(rel.articulo_id);
            }

            // 2) Por nombre exacto del artículo
            if (!articulo) {
                const buscado = normalizarTexto(partida.descripcion);
                if (buscado.length >= 4) {
                    const candidatos = await Articulo.findAll({ where: { activo: true }, attributes: ['id', 'nombre', 'unidad', 'costo_unitario'] });
                    const iguales = candidatos.filter(a => normalizarTexto(a.nombre) === buscado);
                    if (iguales.length === 1) articulo = await Articulo.findByPk(iguales[0].id);
                }
            }

            if (!articulo) { resultado.sin_cruce += 1; continue; }

            // 3) La unidad tiene que ser la misma o el precio es de otra cosa.
            const uFactura = normalizarTexto(partida.unidad);
            const uArticulo = normalizarTexto(articulo.unidad);
            if (uFactura && uArticulo && uFactura !== uArticulo
                && !uFactura.startsWith(uArticulo.slice(0, 3)) && !uArticulo.startsWith(uFactura.slice(0, 3))) {
                resultado.unidad_distinta += 1;
                continue;
            }

            // Precio del proveedor (se crea la relación si no existía) y costo del artículo,
            // que es el que la orden de compra usa para calcular su total.
            if (proveedor) {
                const [rel] = await ArticuloProveedor.findOrCreate({
                    where: { articulo_id: articulo.id, proveedor_id: proveedor.id },
                    defaults: { articulo_id: articulo.id, proveedor_id: proveedor.id, costo_unitario: precio, sku_proveedor: codigo || null }
                });
                await rel.update({ costo_unitario: precio, ...(codigo && !rel.sku_proveedor ? { sku_proveedor: codigo } : {}) });
            }
            await articulo.update({ costo_unitario: precio });
            resultado.actualizados += 1;
        }

        console.log(`🏷️ Costos de ${resultado.proveedor || proveedor_nombre || 'proveedor'}: ${resultado.actualizados} actualizados, ${resultado.sin_cruce} sin cruce`);
        res.json({ success: true, data: resultado });

    } catch (error) {
        console.error('Error al guardar costos de factura:', error);
        res.status(500).json({ success: false, message: 'Error al guardar costos', error: error.message });
    }
});

/**
 * GET /api/avisos-whatsapp/produccion/agenda?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * Proyectos con fecha de INSTALACIÓN en ese rango y qué les falta de producción.
 *
 * La fecha del calendario (`fecha_limite`) es el día en que el proyecto SE VA a instalar, así
 * que producción tiene que haberlo entregado el día anterior. El bot contable usa esto para
 * los recordatorios del grupo de PRODUCCIÓN: de aquí saca qué falta, no lo adivina.
 *
 * Solo lectura: no cambia nada del proyecto.
 */
router.get('/produccion/agenda', async (req, res) => {
    try {
        const { desde, hasta, fresco } = req.query;
        if (!desde || !hasta) {
            return res.status(400).json({ success: false, message: 'Faltan las fechas desde/hasta' });
        }

        // El calendario se mueve durante el día: un proyecto que en la mañana se instalaba
        // mañana, a mediodía ya se recorrió. Antes de avisar al grupo se relee la hoja, para
        // no mandar un recordatorio de algo que ya cambió. La sincronización automática corre
        // cada 5 minutos; esto es la pasada de más que se hace justo antes de hablar.
        let sincronizado = false;
        if (fresco === '1' || fresco === 'true') {
            try {
                const { sincronizarSheetsAutomatico } = await import('../jobs/sincronizarSheets.job.js');
                await sincronizarSheetsAutomatico();
                sincronizado = true;
            } catch (e) {
                // Que la hoja falle no deja al grupo sin aviso: se responde con lo que hay en
                // la base y se dice que no se pudo releer.
                console.error('No se pudo releer el calendario antes de la agenda:', e.message);
            }
        }

        // La fecha que manda es la del CALENDARIO de instalaciones cuando va antes que la col D
        // (la misma regla del dashboard). Antes solo se miraba la col D y un proyecto adelantado
        // en el calendario (COLEGIO ATENAS, 21-sep) nunca entraba a los recordatorios.
        const proyectos = await proyectosAbiertos();
        let fechas = null;
        let calendarioLeido = false;
        try {
            fechas = resolverFechasInstalacion(proyectos, await leerCitasCercanas());
            calendarioLeido = true;
        } catch (e) {
            // Sin calendario se contesta con la col D, como antes: mejor un aviso con la fecha
            // del Índice que ninguno.
            console.error('No se pudo leer el calendario para la agenda:', e.message);
        }

        const agenda = proyectos
            .map(p => ({ p, fecha: fechas ? fechas.get(p.id)?.fecha : p.fecha_limite }))
            .filter(({ fecha }) => fecha && fecha >= desde && fecha <= hasta)
            .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.p.nombre.localeCompare(y.p.nombre))
            .map(({ p, fecha }) => ({
                id: p.id,
                proyecto: p.nombre,
                fecha_instalacion: fecha,
                fecha_indice: p.fecha_limite,
                etapa_actual: p.etapa_actual,
                ...resumenProduccion(p),
                produccion_completado_en: p.produccion_completado_en
            }));

        res.json({ success: true, data: { agenda, sincronizado, calendarioLeido } });

    } catch (error) {
        console.error('Error al listar la agenda de producción:', error);
        res.status(500).json({ success: false, message: 'Error al listar la agenda', error: error.message });
    }
});

/**
 * GET /api/avisos-whatsapp/produccion/citas?fecha=YYYY-MM-DD
 * Las citas del calendario de ese día, tal como están escritas, con su horario.
 *
 * El bot contable lo usa para la confirmación del calendario: a Susana se le pregunta por
 * TODAS las citas del día siguiente (instalaciones, MTO, garantías, retiros), no solo por lo
 * que pasa por producción, porque el calendario se confirma completo.
 *
 * Solo lectura: no cambia nada.
 */
router.get('/produccion/citas', async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ success: false, message: 'Falta la fecha' });

        // Quién encabeza cada equipo, del apartado de DISTRIBUCIÓN DE EQUIPOS de la pestaña
        // del mes (GERAS, MIGUEL, MANE…). El color de la celda de la hora dice de qué equipo
        // es la cita; aquí se le pone nombre y apellido a ese color.
        const MESES_TAB = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const responsables = new Map();
        const porColor = new Map();
        const claveColor = (c) => (c ? `${c.red},${c.green},${c.blue}` : '');
        const mesIdx = Number(String(fecha).slice(5, 7)) - 1;
        for (const mes of [MESES_TAB[mesIdx], MESES_TAB[(mesIdx + 1) % 12]]) {
            try {
                const d = await obtenerDistribucionEquipos(mes);
                for (const e of d?.data?.equipos || []) {
                    if (e.nombre && e.responsable && !responsables.has(e.nombre)) responsables.set(e.nombre, e.responsable);
                    // La tabla es la fuente: si un mes cambia el tono de un equipo, el color
                    // pintado ahí sigue siendo el mismo que el de sus citas.
                    const k = claveColor(e.color);
                    if (k && e.nombre && !porColor.has(k)) porColor.set(k, e.nombre);
                }
                if (responsables.size) break;
            } catch (e) {
                console.error(`No se pudo leer la distribución de equipos de ${mes}:`, e.message);
            }
        }

        const citas = (await leerCitasCercanas())
            // Sin horario no es una cita: son las notas del calendario (ASUETO, "27 CUMPLE
            // VICENTE", "CONTROL - C1"). Confirmar eso con el cliente no tiene sentido.
            .filter(c => c.fecha === fecha && c.nombre && c.hora)
            .map(c => {
                const nombre = String(c.nombre).trim();
                const cliente = (c.cliente || '').trim();
                // La celda del calendario trae el cliente en el segundo renglón, y ahí es donde
                // suele decir de qué es la cita: "MARCO ANTONIO ZAVALA" + "MTO".
                const completo = cliente ? `${nombre} / ${cliente}` : nombre;
                const equipo = c.equipoHora || porColor.get(claveColor(c.colorHora)) || null;
                return {
                    nombre,
                    cliente: cliente || null,
                    etiqueta: completo,
                    hora: c.hora || null,
                    // El equipo sale del color de la hora; sin color asignado todavía no se
                    // sabe quién va, y entonces no hay a quién nombrar.
                    equipo: equipo || null,
                    responsable: (equipo && responsables.get(equipo)) || null,
                    tipo: /retiro/i.test(completo) ? 'RETIRO'
                        : /gtia|garant/i.test(completo) ? 'GTIA'
                            : /\bmto\b|mantenim/i.test(completo) ? 'MTO' : 'INSTALACION',
                    falla: c.equipoHora === 'FALLA'
                };
            });

        // El mismo proyecto puede aparecer en varias celdas del día (equipos distintos).
        const vistas = new Set();
        const unicas = citas.filter(c => {
            const k = `${c.nombre}|${c.hora || ''}`;
            if (vistas.has(k)) return false;
            vistas.add(k);
            return true;
        });

        res.json({ success: true, data: { fecha, citas: unicas } });
    } catch (error) {
        console.error('Error al listar las citas del día:', error);
        res.status(500).json({ success: false, message: 'Error al listar las citas', error: error.message });
    }
});

/**
 * GET /api/avisos-whatsapp/produccion/tickets-abiertos?proyectos=A|B
 *
 * Los tickets que almacén (Charly) no ha cerrado (pendiente/aprobado, de proyectos
 * abiertos). Con `proyectos` (separados por |) solo los de esos proyectos: el bot
 * contable pregunta a las 16:00 por los que se instalan mañana.
 *
 * Solo lectura: no cambia nada.
 */
router.get('/produccion/tickets-abiertos', async (req, res) => {
    try {
        const filtro = String(req.query.proyectos || '').split('|').map(x => x.trim()).filter(Boolean);

        const pedidos = await Movimiento.findAll({
            where: { tipo: 'pedido', estado: { [Op.in]: ['pendiente', 'aprobado'] } },
            attributes: ['id', 'ticket_id', 'proyecto', 'estado', 'fecha_hora'],
            include: [
                { model: Equipo, as: 'equipo', attributes: ['nombre'] },
                { model: DetalleMovimiento, as: 'detalles', attributes: ['dispersado'] }
            ],
            order: [['fecha_hora', 'ASC']]
        });

        const nombresAbiertos = await getNombresProyectosAbiertos();
        const tickets = pedidos
            .filter(p => pedidoEsDeProyectoAbierto(p.proyecto, nombresAbiertos))
            .map(p => {
                const total = p.detalles?.length || 0;
                const surtidos = (p.detalles || []).filter(d => d.dispersado).length;
                return {
                    ticket_id: p.ticket_id,
                    proyecto: p.proyecto || p.equipo?.nombre || 'Sin proyecto',
                    // El nombre del proyecto de la agenda con el que se cruzó (si se pidió filtro)
                    proyecto_agenda: filtro.find(f => p.proyecto && mismosProyectos(p.proyecto, f)) || null,
                    estado: p.estado,
                    fecha: new Date(p.fecha_hora).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
                    progreso: total ? Math.round((surtidos / total) * 100) : 0
                };
            })
            .filter(t => !filtro.length || t.proyecto_agenda);

        res.json({ success: true, data: { total: tickets.length, tickets } });
    } catch (error) {
        console.error('Error al listar tickets abiertos para el aviso:', error);
        res.status(500).json({ success: false, message: 'Error al listar los tickets abiertos', error: error.message });
    }
});

export default router;
