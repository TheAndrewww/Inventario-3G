/**
 * PM2 Ecosystem Configuration
 * 
 * Este archivo configura todos los servicios locales que corren en la Mac Mini.
 * Para agregar un nuevo servicio, solo agrega otro objeto al array 'apps'.
 * 
 * Comandos útiles:
 *   pm2 start ecosystem.config.cjs          - Iniciar todos los servicios
 *   pm2 start ecosystem.config.cjs --only print-agent   - Iniciar solo uno
 *   pm2 stop all                            - Detener todos
 *   pm2 restart all                         - Reiniciar todos
 *   pm2 logs                                - Ver logs en tiempo real
 *   pm2 logs print-agent                    - Ver logs de un servicio específico
 *   pm2 monit                               - Monitor interactivo
 *   pm2 status                              - Ver estado de todos los servicios
 */

module.exports = {
    apps: [
        // ====================================
        // AGENTE DE IMPRESIÓN
        // Escucha Firebase y envía a la impresora térmica
        // ====================================
        {
            name: 'print-agent',
            script: 'index.js',
            cwd: './print-agent',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production',
                PRINTER_NAME: 'TicketPrinter'
            },
            // Logs
            out_file: './logs/print-agent-out.log',
            error_file: './logs/print-agent-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true
        },

        // ====================================
        // EJEMPLO: Servicio de Leads (descomenta y ajusta)
        // ====================================
        // {
        //   name: 'leads-service',
        //   script: 'index.js',
        //   cwd: './leads-service',  // Ajusta la ruta a tu servicio
        //   watch: false,
        //   autorestart: true,
        //   max_restarts: 10,
        //   restart_delay: 5000,
        //   env: {
        //     NODE_ENV: 'production'
        //   },
        //   out_file: './logs/leads-out.log',
        //   error_file: './logs/leads-error.log',
        //   log_date_format: 'YYYY-MM-DD HH:mm:ss'
        // },

        // ====================================
        // EJEMPLO: Checador (descomenta y ajusta)
        // ====================================
        // {
        //   name: 'checador',
        //   script: 'index.js',
        //   cwd: './checador',  // Ajusta la ruta a tu servicio
        //   watch: false,
        //   autorestart: true,
        //   max_restarts: 10,
        //   restart_delay: 5000,
        //   env: {
        //     NODE_ENV: 'production'
        //   },
        //   out_file: './logs/checador-out.log',
        //   error_file: './logs/checador-error.log',
        //   log_date_format: 'YYYY-MM-DD HH:mm:ss'
        // }
    ]
};
