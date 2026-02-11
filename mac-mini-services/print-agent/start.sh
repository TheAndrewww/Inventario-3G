#!/bin/bash

# Iniciar CUPS en background
cupsd

# Esperar a que CUPS inicie
sleep 3

# Configurar la impresora de red
# Usamos socket directo para impresoras térmicas
lpadmin -p TicketPrinter -E -v "socket://${PRINTER_IP}:${PRINTER_PORT}" -m raw

# Establecer como impresora por defecto
lpadmin -d TicketPrinter

echo "🖨️  Impresora configurada: TicketPrinter -> ${PRINTER_IP}:${PRINTER_PORT}"

# Iniciar la aplicación Node.js
exec node index.js
