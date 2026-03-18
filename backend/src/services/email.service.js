import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

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
    const appUrl = frontendUrl || process.env.FRONTEND_URL || 'https://inventario-3-g.vercel.app';
    const aprobarUrl = `${backendUrl}/api/ordenes-compra/aprobar-email?token=${tokenAprobar}`;
    const rechazarUrl = `${appUrl}/ordenes-compra?rechazar=${orden.id}`;

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
                    El botón de aprobar funciona directamente. Para rechazar, serás dirigido al sistema para escribir el motivo.
                    <br>Este enlace expira en 72 horas.
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
            from: '3G Inventario <onboarding@resend.dev>',
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
            from: '3G Inventario <onboarding@resend.dev>',
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
 * Enviar email de notificación al creador cuando se aprueba/rechaza
 */
export const enviarEmailEstadoOrden = async (orden, estado, motivo = null, aprobadoPor = null) => {
    try {
        if (!resend) return false;

        const esAprobada = estado === 'aprobada';
        const creadorEmail = orden.creador?.email;

        // Si no tenemos email del creador, no enviamos
        if (!creadorEmail) return false;

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
            ${esAprobada ? '<p style="font-size: 14px; color: #059669;">Ya puedes enviar la orden al proveedor desde el sistema.</p>' : ''}
        </div>
    </div>
</body>
</html>`;

        const { data, error } = await resend.emails.send({
            from: '3G Inventario <onboarding@resend.dev>',
            to: creadorEmail,
            subject: `${esAprobada ? '✅' : '❌'} Orden ${orden.ticket_id} ${esAprobada ? 'aprobada' : 'rechazada'}`,
            html
        });

        if (error) {
            console.error('❌ [RESEND] Error al enviar email de estado:', error);
            return false;
        }

        console.log(`📧 [RESEND] Email de ${estado} enviado a ${creadorEmail}: ${data.id}`);
        return true;
    } catch (error) {
        console.error('❌ [RESEND] Error al enviar email de estado:', error.message);
        return false;
    }
};

export default {
    enviarEmailAprobacion,
    enviarEmailEstadoOrden,
    generarTokenAprobacion,
    verificarTokenAprobacion
};
