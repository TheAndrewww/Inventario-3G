FROM node:20-slim

# Instalar dependencias para Sharp, PDF rendering y ESC/POS
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpoppler-glib-dev \
    poppler-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json primero para cache de dependencias
COPY package*.json ./
RUN npm install --only=production

# Copiar código fuente
COPY . .

# Crear directorio temporal para PDFs
RUN mkdir -p /app/temp

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PRINTER_IP=192.168.100.200
ENV PRINTER_PORT=9100

# Healthcheck
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const fs = require('fs'); const hb = '/tmp/print_heartbeat'; fs.existsSync(hb) && (Date.now() - parseInt(fs.readFileSync(hb))) < 120000 ? process.exit(0) : process.exit(1)"

CMD ["node", "index.js"]
