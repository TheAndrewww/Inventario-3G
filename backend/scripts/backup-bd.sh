#!/bin/bash

# Script para crear backup de la base de datos antes de limpiar

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  Creando backup de la base de datos...${NC}\n"

# Directorio de backups
BACKUP_DIR="../backups"
mkdir -p "$BACKUP_DIR"

# Nombre del archivo con timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/inventario_3g_backup_$TIMESTAMP.sql"

# Obtener configuración de la base de datos desde .env
if [ -f ../.env ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Usar valores por defecto si no están en .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-inventario_3g}
DB_USER=${DB_USER:-$(whoami)}

echo -e "${YELLOW}📋 Configuración:${NC}"
echo "   Host: $DB_HOST"
echo "   Puerto: $DB_PORT"
echo "   Base de datos: $DB_NAME"
echo "   Usuario: $DB_USER"
echo ""

# Crear backup
echo -e "${BLUE}💾 Creando backup...${NC}"

PGPASSWORD=$DB_PASSWORD pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -b \
    -v \
    -f "$BACKUP_FILE" 2>&1 | grep -v "NOTICE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "\n${GREEN}✅ Backup creado exitosamente!${NC}"
    echo -e "${GREEN}   Archivo: $BACKUP_FILE${NC}"
    echo -e "${GREEN}   Tamaño: $BACKUP_SIZE${NC}"

    # También crear un backup en formato SQL plano para revisión
    SQL_BACKUP_FILE="$BACKUP_DIR/inventario_3g_backup_$TIMESTAMP.sql.plain"
    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --column-inserts \
        --data-only \
        -f "$SQL_BACKUP_FILE" 2>&1 | grep -v "NOTICE"

    echo -e "${GREEN}   SQL plano: $SQL_BACKUP_FILE${NC}"

    echo -e "\n${YELLOW}ℹ️  Para restaurar este backup:${NC}"
    echo "   pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $BACKUP_FILE"
else
    echo -e "\n${RED}❌ Error al crear el backup${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 Proceso completado${NC}"
