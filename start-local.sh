#!/bin/bash

# 🚀 Script de inicio rápido para desarrollo local
# Este script inicia el backend y frontend automáticamente

echo "🚀 Iniciando Inventario 3G en modo desarrollo local..."
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para limpiar al salir
cleanup() {
    echo ""
    echo "${YELLOW}🛑 Deteniendo servidores...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "${GREEN}✅ Servidores detenidos${NC}"
    exit 0
}

# Capturar Ctrl+C
trap cleanup INT TERM

# Verificar que estemos en el directorio correcto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "${RED}❌ Error: Este script debe ejecutarse desde la raíz del proyecto${NC}"
    echo "   Ruta actual: $(pwd)"
    echo "   Por favor navega a: /Users/andrewww/Documents/Inventario-3G/"
    exit 1
fi

# Verificar PostgreSQL
echo "${BLUE}🔍 Verificando PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo "${RED}❌ PostgreSQL no está instalado${NC}"
    echo "   Instálalo con: brew install postgresql@14"
    exit 1
fi

# Verificar que PostgreSQL esté corriendo
if ! pg_isready -q; then
    echo "${YELLOW}⚠️  PostgreSQL no está corriendo. Intentando iniciar...${NC}"
    brew services start postgresql@14
    sleep 3
    if ! pg_isready -q; then
        echo "${RED}❌ No se pudo iniciar PostgreSQL${NC}"
        exit 1
    fi
fi
echo "${GREEN}✅ PostgreSQL está corriendo${NC}"
echo ""

# Verificar base de datos
echo "${BLUE}🔍 Verificando base de datos...${NC}"
if ! psql -lqt | cut -d \| -f 1 | grep -qw inventario_3g; then
    echo "${YELLOW}⚠️  Base de datos 'inventario_3g' no existe. Creándola...${NC}"
    createdb inventario_3g
    if [ $? -eq 0 ]; then
        echo "${GREEN}✅ Base de datos creada${NC}"
    else
        echo "${RED}❌ Error al crear la base de datos${NC}"
        exit 1
    fi
else
    echo "${GREEN}✅ Base de datos 'inventario_3g' existe${NC}"
fi
echo ""

# Verificar archivos .env
echo "${BLUE}🔍 Verificando archivos de configuración...${NC}"
if [ ! -f "backend/.env" ]; then
    echo "${RED}❌ Falta backend/.env${NC}"
    echo "   Copia backend/.env.example y configúralo"
    exit 1
fi
if [ ! -f "frontend/.env" ]; then
    echo "${RED}❌ Falta frontend/.env${NC}"
    echo "   Copia frontend/.env.example y configúralo"
    exit 1
fi
echo "${GREEN}✅ Archivos .env encontrados${NC}"
echo ""

# Instalar dependencias si es necesario
echo "${BLUE}📦 Verificando dependencias...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo "${YELLOW}⚠️  Instalando dependencias del backend...${NC}"
    cd backend && npm install && cd ..
fi
if [ ! -d "frontend/node_modules" ]; then
    echo "${YELLOW}⚠️  Instalando dependencias del frontend...${NC}"
    cd frontend && npm install && cd ..
fi
echo "${GREEN}✅ Dependencias instaladas${NC}"
echo ""

# Iniciar Backend
echo "${BLUE}🚀 Iniciando Backend en http://localhost:5001${NC}"
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3

# Verificar que el backend haya iniciado
if ! curl -s http://localhost:5001 > /dev/null; then
    echo "${RED}❌ Error al iniciar el backend${NC}"
    echo "   Revisa backend.log para más detalles"
    cat backend.log
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo "${GREEN}✅ Backend corriendo (PID: $BACKEND_PID)${NC}"
echo ""

# Iniciar Frontend
echo "${BLUE}🚀 Iniciando Frontend en http://localhost:5173${NC}"
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 3

# Verificar que el frontend haya iniciado
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "${YELLOW}⚠️  Frontend está iniciando... (puede tomar unos segundos)${NC}"
fi
echo "${GREEN}✅ Frontend corriendo (PID: $FRONTEND_PID)${NC}"
echo ""

# Resumen
echo "${GREEN}═══════════════════════════════════════════════════${NC}"
echo "${GREEN}🎉 ¡Todo está listo!${NC}"
echo "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "📍 Backend:  ${BLUE}http://localhost:5001${NC}"
echo "📍 Frontend: ${BLUE}http://localhost:5173${NC}"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 Para detener: presiona ${YELLOW}Ctrl+C${NC}"
echo ""
echo "${YELLOW}Abriendo navegador...${NC}"
sleep 2
open http://localhost:5173

# Mantener el script corriendo
echo "${GREEN}✨ Servidores corriendo...${NC}"
echo "${YELLOW}Presiona Ctrl+C para detener${NC}"
echo ""

# Mostrar logs en tiempo real (opcional)
tail -f backend.log frontend.log 2>/dev/null

# Esperar indefinidamente
wait
