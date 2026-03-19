import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import { generarPDFOrdenCompra } from '../utils/ordenCompraPDF.js';
import { Usuario } from '../models/index.js';

// Inicializar Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Destinatarios de notificaciones de órdenes
const ADMIN_EMAILS = [
    'direccion@3gvelarias.com',
    '3gvelarias@gmail.com'
];

/**
 * Generar token seguro para aprobar por email
 */
export const generarTokenAprobacion = (ordenId, accion) => {
    return jwt.sign(
        { orden_id: ordenId, accion },
        process.env.JWT_SECRET,
        { expiresIn: '72h' } // Token válido por 72 horas
    );
};

/**
 * Verificar token de aprobación por email
 */
export const verificarTokenAprobacion = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Generar HTML del email para aprobación de orden
 */
const generarEmailAprobacion = (orden, tokenAprobar, frontendUrl) => {
    const detallesHTML = orden.detalles?.map(d => `
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
                ${d.articulo?.nombre || 'Sin nombre'}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: center;">
                ${parseFloat(d.cantidad_solicitada).toFixed(0)} ${d.articulo?.unidad || ''}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right;">
                $${parseFloat(d.costo_unitario || 0).toFixed(2)}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 600; color: #374151; text-align: right;">
                $${parseFloat(d.subtotal || 0).toFixed(2)}
            </td>
        </tr>
    `).join('') || '';

    const backendUrl = process.env.BACKEND_URL || 'https://inventario-3g-production.up.railway.app';
    const tokenRechazar = generarTokenAprobacion(orden.id, 'rechazar');
    const aprobarUrl = `${backendUrl}/api/ordenes-compra/aprobar-email?token=${tokenAprobar}`;
    const rechazarUrl = `${backendUrl}/api/ordenes-compra/rechazar-email?token=${tokenRechazar}`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">
                🔔 Orden de Compra Pendiente
            </h1>
            <p style="color: #fecaca; margin: 8px 0 0; font-size: 14px;">
                Requiere tu aprobación
            </p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">

            <!-- Info principal -->
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                    <strong>${orden.creador?.nombre || 'Un usuario'}</strong> ha creado una nueva orden de compra y necesita tu aprobación.
                </p>
            </div>

            <!-- Datos de la orden -->
            <table style="width: 100%; margin-bottom: 24px;">
                <tr>
                    <td style="padding: 8px 0;">
                        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Ticket</span><br>
                        <span style="font-size: 16px; font-weight: 700; color: #111827;">${orden.ticket_id}</span>
                    </td>
                    <td style="padding: 8px 0;">
                        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Total Estimado</span><br>
                        <span style="font-size: 16px; font-weight: 700; color: #059669;">$${parseFloat(orden.total_estimado || 0).toFixed(2)}</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;">
                        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Proveedor</span><br>
                        <span style="font-size: 14px; color: #374151;">${orden.proveedor?.nombre || 'Sin proveedor'}</span>
                    </td>
                    <td style="padding: 8px 0;">
                        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Creado por</span><br>
                        <span style="font-size: 14px; color: #374151;">${orden.creador?.nombre || 'N/A'}</span>
                    </td>
                </tr>
                ${orden.observaciones ? `
                <tr>
                    <td colspan="2" style="padding: 8px 0;">
                        <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Observaciones</span><br>
                        <span style="font-size: 14px; color: #374151;">${orden.observaciones}</span>
                    </td>
                </tr>
                ` : ''}
            </table>

            <!-- Tabla de artículos -->
            <h3 style="font-size: 14px; color: #374151; margin: 0 0 12px; font-weight: 600;">📦 Artículos (${orden.detalles?.length || 0})</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Artículo</th>
                        <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Cantidad</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Costo Unit.</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${detallesHTML}
                </tbody>
                <tfoot>
                    <tr style="background: #f0fdf4;">
                        <td colspan="3" style="padding: 12px; font-size: 14px; font-weight: 700; color: #374151; text-align: right;">Total:</td>
                        <td style="padding: 12px; font-size: 16px; font-weight: 700; color: #059669; text-align: right;">$${parseFloat(orden.total_estimado || 0).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Botones de acción -->
            <div style="text-align: center; margin-top: 32px;">
                <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">¿Qué deseas hacer con esta orden?</p>

                <table style="width: 100%; max-width: 400px; margin: 0 auto;">
                    <tr>
                        <td style="padding: 0 8px;">
                            <a href="${aprobarUrl}" style="display: block; background: #059669; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 700; text-align: center;">
                                ✅ Aprobar Orden
                            </a>
                        </td>
                        <td style="padding: 0 8px;">
                            <a href="${rechazarUrl}" style="display: block; background: #dc2626; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; font-weight: 700; text-align: center;">
                                ❌ Rechazar
                            </a>
                        </td>
                    </tr>
                </table>

                <p style="font-size: 11px; color: #9ca3af; margin: 16px 0 0;">
                    Ambos botones funcionan directamente desde el email. Al rechazar, se abrirá un formulario para escribir el motivo.
                    <br>Estos enlaces expiran en 72 horas.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                3G Arquitectura Textil — Sistema de Inventario
            </p>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Enviar email de aprobación de orden usando Resend
 */
export const enviarEmailAprobacion = async (orden) => {
    try {
        console.log('📧 [RESEND] Iniciando envío de email de aprobación para orden:', orden?.ticket_id);
        console.log('📧 [RESEND] RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'configurado (' + process.env.RESEND_API_KEY.substring(0, 10) + '...)' : 'NO configurado');

        if (!resend) {
            console.log('⚠️ RESEND_API_KEY no configurado, no se puede enviar email');
            return false;
        }

        const tokenAprobar = generarTokenAprobacion(orden.id, 'aprobar');
        const html = generarEmailAprobacion(orden, tokenAprobar);

        const { data, error } = await resend.emails.send({
            from: '3G Inventario <notificaciones@3gvelarias.com>',
            to: ADMIN_EMAILS,
            subject: `🔔 Orden ${orden.ticket_id} pendiente de aprobación — $${parseFloat(orden.total_estimado || 0).toFixed(2)}`,
            html
        });

        if (error) {
            console.error('❌ [RESEND] Error al enviar email:', error);
            return false;
        }

        console.log(`📧 [RESEND] ✅ Email enviado exitosamente: ${data.id}`);
        return true;
    } catch (error) {
        console.error('❌ [RESEND] Error al enviar email de aprobación:', error.message);
        console.error('❌ [RESEND] Stack:', error.stack);
        return false;
    }
};

/**
 * Enviar un email de prueba para verificar configuración
 */
export const testEmail = async (req, res) => {
    try {
        const config = {
            RESEND_API_KEY: process.env.RESEND_API_KEY ? `configurado (${process.env.RESEND_API_KEY.substring(0, 10)}...)` : 'NO configurado',
            BACKEND_URL: process.env.BACKEND_URL || 'NO configurado'
        };

        console.log('🧪 [TEST EMAIL] Config:', config);

        if (!resend) {
            return res.json({ success: false, message: 'RESEND_API_KEY no configurado', config });
        }

        const { data, error } = await resend.emails.send({
            from: '3G Inventario <notificaciones@3gvelarias.com>',
            to: ADMIN_EMAILS,
            subject: '🧪 Email de prueba - Inventario 3G',
            html: '<h1>✅ Email de prueba exitoso</h1><p>Si ves este email, la configuración de Resend está correcta.</p>'
        });

        if (error) {
            console.error('❌ [TEST EMAIL] Error:', error);
            return res.json({ success: false, error: error.message, config });
        }

        return res.json({ success: true, messageId: data.id, config });
    } catch (error) {
        console.error('❌ [TEST EMAIL] Error:', error.message);
        return res.json({
            success: false,
            error: error.message,
            config: {
                RESEND_API_KEY: process.env.RESEND_API_KEY ? 'configurado' : 'NO'
            }
        });
    }
};

/**
 * Enviar email de notificación cuando se aprueba/rechaza una orden
 * - Si se aprueba: envía a usuarios con rol 'compras' con el PDF adjunto
 * - Si se rechaza: envía al creador con el motivo
 */
export const enviarEmailEstadoOrden = async (orden, estado, motivo = null, aprobadoPor = null) => {
    try {
        console.log(`📧 [enviarEmailEstadoOrden] Iniciando envío para orden ${orden?.ticket_id || 'sin ticket'}, estado: ${estado}`);

        if (!resend) {
            console.error('❌ [enviarEmailEstadoOrden] Resend no está configurado (RESEND_API_KEY faltante)');
            return false;
        }

        const esAprobada = estado === 'aprobada';
        let destinatarios = [];

        if (esAprobada) {
            console.log('📧 [enviarEmailEstadoOrden] Buscando usuarios con rol "compras" activos...');

            // Si la orden fue aprobada, enviar a usuarios con rol 'compras'
            const usuariosCompras = await Usuario.findAll({
                where: { rol: 'compras', activo: true },
                attributes: ['email', 'nombre', 'rol', 'activo']
            });

            console.log(`📧 [enviarEmailEstadoOrden] Usuarios encontrados: ${usuariosCompras.length}`);
            usuariosCompras.forEach(u => {
                console.log(`   - ${u.nombre} (${u.email || 'SIN EMAIL'}) - rol: ${u.rol}, activo: ${u.activo}`);
            });

            if (!usuariosCompras || usuariosCompras.length === 0) {
                console.error('❌ [enviarEmailEstadoOrden] No hay usuarios con rol "compras" activos en la base de datos');
                return false;
            }

            destinatarios = usuariosCompras.map(u => u.email).filter(e => e && e.trim());

            if (destinatarios.length === 0) {
                console.error('❌ [enviarEmailEstadoOrden] Usuarios de compras encontrados pero ninguno tiene email válido');
                return false;
            }

            console.log(`📧 [enviarEmailEstadoOrden] Enviando email de aprobación a ${destinatarios.length} usuario(s) de compras: ${destinatarios.join(', ')}`);
        } else {
            // Si la orden fue rechazada, enviar al creador
            const creadorEmail = orden.creador?.email;

            console.log(`📧 [enviarEmailEstadoOrden] Enviando email de rechazo al creador: ${creadorEmail || 'SIN EMAIL'}`);

            if (!creadorEmail) {
                console.error('❌ [enviarEmailEstadoOrden] No se pudo enviar email: creador sin email');
                return false;
            }

            destinatarios = [creadorEmail];
        }

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${esAprobada ? '#059669' : '#dc2626'}; border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">
                ${esAprobada ? '✅ Orden Aprobada' : '❌ Orden Rechazada'}
            </h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
            <p style="font-size: 14px; color: #374151;">
                Tu orden <strong>${orden.ticket_id}</strong> ha sido
                <strong style="color: ${esAprobada ? '#059669' : '#dc2626'};">
                    ${esAprobada ? 'aprobada' : 'rechazada'}
                </strong>
                por <strong>${aprobadoPor || 'un administrador'}</strong>.
            </p>
            ${!esAprobada && motivo ? `
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <p style="font-size: 12px; color: #991b1b; font-weight: 600; margin: 0 0 4px;">Motivo del rechazo:</p>
                <p style="font-size: 14px; color: #7f1d1d; margin: 0;">${motivo}</p>
            </div>
            ` : ''}
            ${esAprobada ? '<p style="font-size: 14px; color: #059669;">Ya puedes enviar la orden al proveedor desde el sistema. El PDF adjunto contiene los detalles completos.</p>' : ''}
        </div>
    </div>
</body>
</html>`;

        const emailData = {
            from: '3G Inventario <notificaciones@3gvelarias.com>',
            to: destinatarios,
            subject: `${esAprobada ? '✅' : '❌'} Orden ${orden.ticket_id} ${esAprobada ? 'aprobada' : 'rechazada'}`,
            html
        };

        // Si la orden fue aprobada, generar y adjuntar el PDF
        if (esAprobada) {
            try {
                console.log(`📄 [enviarEmailEstadoOrden] Generando PDF para orden: ${orden.ticket_id}`);
                const pdfBuffer = await generarPDFOrdenCompra(orden);
                emailData.attachments = [{
                    filename: `Orden-Compra-${orden.ticket_id}.pdf`,
                    content: pdfBuffer
                }];
                console.log(`✅ [enviarEmailEstadoOrden] PDF generado exitosamente (${pdfBuffer.length} bytes)`);
            } catch (pdfError) {
                console.error(`❌ [enviarEmailEstadoOrden] Error al generar PDF:`, pdfError);
                console.error(`   Stack:`, pdfError.stack);
                // Continuar enviando el email sin el PDF
            }
        }

        console.log(`📧 [enviarEmailEstadoOrden] Enviando email a través de Resend...`);
        console.log(`   From: ${emailData.from}`);
        console.log(`   To: ${emailData.to.join(', ')}`);
        console.log(`   Subject: ${emailData.subject}`);

        const { data, error } = await resend.emails.send(emailData);

        if (error) {
            console.error(`❌ [enviarEmailEstadoOrden] Error al enviar email de estado:`, error);
            console.error(`   Error details:`, JSON.stringify(error, null, 2));
            return false;
        }

        console.log(`✅ [enviarEmailEstadoOrden] Email enviado exitosamente. ID: ${data?.id}`);
        console.log(`   Destinatarios: ${destinatarios.join(', ')}`);
        return true;
    } catch (error) {
        console.error(`❌ [enviarEmailEstadoOrden] Error inesperado:`, error);
        console.error(`   Stack:`, error.stack);
        return false;
    }
};

/**
 * Enviar email de notificación cuando un no-administrador cancela una orden
 * @param {Object} orden - Orden de compra cancelada con sus relaciones
 * @param {string} motivo - Motivo de la cancelación
 * @param {string} canceladoPor - Nombre del usuario que canceló
 * @param {string} rolUsuario - Rol del usuario que canceló
 * @returns {Promise<boolean>} - true si se envió exitosamente
 */
export const enviarEmailOrdenCancelada = async (orden, motivo, canceladoPor, rolUsuario) => {
    try {
        console.log(`📧 [enviarEmailOrdenCancelada] Notificando cancelación de orden ${orden?.ticket_id || 'sin ticket'}`);
        console.log(`   Cancelado por: ${canceladoPor} (${rolUsuario})`);

        if (!resend) {
            console.error('❌ [enviarEmailOrdenCancelada] Resend no está configurado (RESEND_API_KEY faltante)');
            return false;
        }

        // Generar detalles de artículos
        const detallesHTML = orden.detalles?.map(d => `
            <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
                    ${d.articulo?.nombre || 'Sin nombre'}
                </td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: center;">
                    ${parseFloat(d.cantidad_solicitada).toFixed(0)} ${d.articulo?.unidad || ''}
                </td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right;">
                    $${parseFloat(d.costo_unitario || 0).toFixed(2)}
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #9ca3af;">Sin artículos</td></tr>';

        const totalGeneral = orden.detalles?.reduce((sum, d) =>
            sum + (parseFloat(d.cantidad_solicitada) * parseFloat(d.costo_unitario || 0)), 0
        ) || 0;

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orden Cancelada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header con alerta roja -->
            <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Orden de Compra Cancelada</h1>
            </div>

            <!-- Contenido -->
            <div style="padding: 32px 24px;">
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f1d1d; font-size: 15px; line-height: 1.6;">
                        <strong>${canceladoPor}</strong> (${rolUsuario}) ha cancelado la orden de compra <strong>${orden.ticket_id}</strong>.
                    </p>
                </div>

                <!-- Información de la orden -->
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">Información de la Orden</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Orden ID:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${orden.ticket_id}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Proveedor:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${orden.proveedor?.nombre || 'Sin proveedor'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Estado anterior:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${orden.estado}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Creado por:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${orden.creador?.nombre || 'N/A'}</td>
                        </tr>
                    </table>
                </div>

                <!-- Motivo de cancelación -->
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px; font-weight: 600;">Motivo de Cancelación</h2>
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${motivo}</p>
                    </div>
                </div>

                <!-- Artículos de la orden -->
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">Artículos</h2>
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f9fafb;">
                                    <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Artículo</th>
                                    <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Cantidad</th>
                                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Costo Unit.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detallesHTML}
                            </tbody>
                            <tfoot>
                                <tr style="background-color: #f9fafb;">
                                    <td colspan="2" style="padding: 16px 12px; font-weight: 600; font-size: 15px; color: #111827;">Total</td>
                                    <td style="padding: 16px 12px; font-weight: 700; font-size: 16px; color: #111827; text-align: right;">$${totalGeneral.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Información adicional -->
                <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
                        ℹ️ Esta es una notificación automática porque un usuario con rol <strong>${rolUsuario}</strong> canceló una orden.
                        Si tiene dudas, contacte a <strong>${canceladoPor}</strong>.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Sistema de Inventario 3G Velarias</p>
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">Este es un mensaje automático, por favor no responder a este correo</p>
            </div>
        </div>
    </div>
</body>
</html>`;

        const emailData = {
            from: '3G Inventario <notificaciones@3gvelarias.com>',
            to: ADMIN_EMAILS,
            subject: `⚠️ Orden ${orden.ticket_id} cancelada por ${canceladoPor}`,
            html
        };

        console.log(`📧 [enviarEmailOrdenCancelada] Enviando email a través de Resend...`);
        console.log(`   From: ${emailData.from}`);
        console.log(`   To: ${emailData.to.join(', ')}`);
        console.log(`   Subject: ${emailData.subject}`);

        const { data, error } = await resend.emails.send(emailData);

        if (error) {
            console.error(`❌ [enviarEmailOrdenCancelada] Error al enviar email:`, error);
            console.error(`   Error details:`, JSON.stringify(error, null, 2));
            return false;
        }

        console.log(`✅ [enviarEmailOrdenCancelada] Email enviado exitosamente. ID: ${data?.id}`);
        console.log(`   Destinatarios: ${ADMIN_EMAILS.join(', ')}`);
        return true;
    } catch (error) {
        console.error(`❌ [enviarEmailOrdenCancelada] Error inesperado:`, error);
        console.error(`   Stack:`, error.stack);
        return false;
    }
};

export default {
    enviarEmailAprobacion,
    enviarEmailEstadoOrden,
    enviarEmailOrdenCancelada,
    generarTokenAprobacion,
    verificarTokenAprobacion
};
