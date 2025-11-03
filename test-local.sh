#!/bin/bash

# 🧪 Script de prueba rápida para desarrollo local
# Verifica que backend y frontend estén funcionando correctamente

echo "🧪 Ejecutando pruebas de ambiente local..."
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: PostgreSQL
echo "${BLUE}[TEST 1/7]${NC} Verificando PostgreSQL..."
if pg_isready -q; then
    echo "${GREEN}✅ PostgreSQL está corriendo${NC}"
    ((TESTS_PASSED++))
else
    echo "${RED}❌ PostgreSQL no está corriendo${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Base de datos
echo "${BLUE}[TEST 2/7]${NC} Verificando base de datos 'inventario3g'..."
if psql -lqt | cut -d \| -f 1 | grep -qw inventario3g; then
    echo "${GREEN}✅ Base de datos existe${NC}"
    ((TESTS_PASSED++))
else
    echo "${RED}❌ Base de datos no existe${NC}"
    echo "   Créala con: createdb inventario3g"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Backend .env
echo "${BLUE}[TEST 3/7]${NC} Verificando backend/.env..."
if [ -f "backend/.env" ]; then
    echo "${GREEN}✅ backend/.env existe${NC}"
    echo "   Configuración:"
    grep -E "^(PORT|DB_NAME|NODE_ENV)" backend/.env | sed 's/^/   /'
    ((TESTS_PASSED++))
else
    echo "${RED}❌ backend/.env no existe${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4: Frontend .env
echo "${BLUE}[TEST 4/7]${NC} Verificando frontend/.env..."
if [ -f "frontend/.env" ]; then
    echo "${GREEN}✅ frontend/.env existe${NC}"
    echo "   Configuración:"
    grep -E "^VITE_" frontend/.env | sed 's/^/   /'
    ((TESTS_PASSED++))
else
    echo "${RED}❌ frontend/.env no existe${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 5: Backend corriendo
echo "${BLUE}[TEST 5/7]${NC} Verificando si el backend está corriendo..."
if curl -s http://localhost:5001 > /dev/null 2>&1; then
    echo "${GREEN}✅ Backend responde en http://localhost:5001${NC}"
    ((TESTS_PASSED++))
else
    echo "${YELLOW}⚠️  Backend no está corriendo${NC}"
    echo "   Inícialo con: cd backend && npm run dev"
    ((TESTS_FAILED++))
fi
echo ""

# Test 6: Frontend corriendo
echo "${BLUE}[TEST 6/7]${NC} Verificando si el frontend está corriendo..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "${GREEN}✅ Frontend responde en http://localhost:5173${NC}"
    ((TESTS_PASSED++))
else
    echo "${YELLOW}⚠️  Frontend no está corriendo${NC}"
    echo "   Inícialo con: cd frontend && npm run dev"
    ((TESTS_FAILED++))
fi
echo ""

# Test 7: API funcionando
echo "${BLUE}[TEST 7/7]${NC} Verificando API del backend..."
if curl -s http://localhost:5001/api 2>&1 | grep -q "Inventario"; then
    echo "${GREEN}✅ API responde correctamente${NC}"
    ((TESTS_PASSED++))
else
    echo "${YELLOW}⚠️  API no responde o backend no está corriendo${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Resumen
echo "═══════════════════════════════════════════════════"
if [ $TESTS_FAILED -eq 0 ]; then
    echo "${GREEN}🎉 ¡Todos los tests pasaron! ($TESTS_PASSED/7)${NC}"
    echo "${GREEN}✅ Tu ambiente local está listo para desarrollo${NC}"
else
    echo "${YELLOW}⚠️  $TESTS_PASSED tests pasaron, $TESTS_FAILED fallaron${NC}"
    echo ""
    echo "Para solucionar los problemas:"
    echo "1. Revisa la guía: DESARROLLO_LOCAL.md"
    echo "2. O ejecuta: ./start-local.sh"
fi
echo "═══════════════════════════════════════════════════"
