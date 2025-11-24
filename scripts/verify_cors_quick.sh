#!/bin/bash
# ============================================================================
# VERIFICACIÓN CORS RÁPIDA - LINUX/MAC
# Ejecutar desde la raíz del proyecto: bash scripts/verify_cors_quick.sh
# ============================================================================

echo ""
echo "================================"
echo "   VERIFICACIÓN CORS RÁPIDA"
echo "================================"
echo ""

# Test 1: Preflight OPTIONS para IP LAN
echo "[1/3] Probando preflight OPTIONS con IP LAN..."
curl -i -X OPTIONS http://localhost:5000/api/donate \
  -H "Origin: http://192.168.1.137:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
echo ""
echo ""

# Test 2: Preflight OPTIONS para localhost
echo "[2/3] Probando preflight OPTIONS con localhost..."
curl -i -X OPTIONS http://localhost:5000/api/donate \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
echo ""
echo ""

# Test 3: POST real con JSON (simulando frontend)
echo "[3/3] Probando POST real con datos..."
curl -i -X POST http://localhost:5000/api/donate \
  -H "Origin: http://192.168.1.137:5173" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10}'
echo ""
echo ""

echo "================================"
echo "   VERIFICACIÓN COMPLETADA"
echo "================================"
echo ""
echo "RESULTADOS ESPERADOS:"
echo "- Status: 204 No Content o 200 OK (preflight)"
echo "- Headers: Access-Control-Allow-Origin presente"
echo "- POST: Status 200 con {url: \"https://checkout.stripe.com/...\"}"
echo ""
