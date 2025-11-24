#!/bin/bash

# ============================================================================
# SCRIPT DE VERIFICACIÓN DEL SERVIDOR - LEVANTATECUBA
# Verifica que todos los servicios estén funcionando correctamente
# ============================================================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 VERIFICACIÓN DEL SERVIDOR LEVANTATECUBA${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Variables
PROJECT_DIR="/var/www/levantatecuba"
DOMAIN="levantatecuba.com"

# ============================================================================
# 1. VERIFICAR SERVICIOS BÁSICOS
# ============================================================================
echo -e "${YELLOW}🔧 Servicios del Sistema:${NC}"

# Verificar Nginx
if systemctl is-active --quiet nginx; then
    echo -e "  🟢 Nginx: ACTIVO"
    NGINX_STATUS="✅"
else
    echo -e "  🔴 Nginx: INACTIVO"
    NGINX_STATUS="❌"
fi

# Verificar UFW (Firewall)
if ufw status | grep -q "Status: active"; then
    echo -e "  🟢 UFW (Firewall): ACTIVO"
    UFW_STATUS="✅"
else
    echo -e "  🔴 UFW (Firewall): INACTIVO"
    UFW_STATUS="❌"
fi

# Verificar PM2
if pm2 list | grep -q "levantatecuba.*online"; then
    echo -e "  🟢 Backend (PM2): FUNCIONANDO"
    PM2_STATUS="✅"
else
    echo -e "  🔴 Backend (PM2): NO FUNCIONA"
    PM2_STATUS="❌"
fi

echo ""

# ============================================================================
# 2. VERIFICAR CONECTIVIDAD
# ============================================================================
echo -e "${YELLOW}🌐 Conectividad:${NC}"

# Verificar HTTP local
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
    echo -e "  🟢 HTTP localhost: RESPONDE"
    HTTP_LOCAL="✅"
else
    echo -e "  🔴 HTTP localhost: NO RESPONDE"
    HTTP_LOCAL="❌"
fi

# Verificar HTTPS si está configurado
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
        echo -e "  🟢 HTTPS $DOMAIN: RESPONDE"
        HTTPS_STATUS="✅"
    else
        echo -e "  🔴 HTTPS $DOMAIN: NO RESPONDE"
        HTTPS_STATUS="❌"
    fi
else
    echo -e "  🟡 HTTPS: SSL NO CONFIGURADO"
    HTTPS_STATUS="⚠️"
fi

# Verificar API Backend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null | grep -q "200"; then
    echo -e "  🟢 API Backend: RESPONDE"
    API_STATUS="✅"
else
    echo -e "  🔴 API Backend: NO RESPONDE"
    API_STATUS="❌"
fi

echo ""

# ============================================================================
# 3. VERIFICAR ARCHIVOS Y PERMISOS
# ============================================================================
echo -e "${YELLOW}📁 Archivos y Permisos:${NC}"

# Verificar directorio del proyecto
if [ -d "$PROJECT_DIR" ]; then
    echo -e "  🟢 Directorio proyecto: EXISTE"
    PROJECT_DIR_STATUS="✅"
    
    # Verificar archivos principales
    if [ -f "$PROJECT_DIR/server/server.js" ]; then
        echo -e "  🟢 Backend server.js: EXISTE"
        SERVER_FILE="✅"
    else
        echo -e "  🔴 Backend server.js: NO EXISTE"
        SERVER_FILE="❌"
    fi
    
    if [ -d "$PROJECT_DIR/public" ] || [ -d "/var/www/levantatecuba/public" ]; then
        echo -e "  🟢 Frontend build: EXISTE"
        FRONTEND_BUILD="✅"
    else
        echo -e "  🔴 Frontend build: NO EXISTE"
        FRONTEND_BUILD="❌"
    fi
    
    # Verificar archivo .env
    if [ -f "$PROJECT_DIR/.env" ]; then
        echo -e "  🟢 Archivo .env: EXISTE"
        ENV_FILE="✅"
    else
        echo -e "  🔴 Archivo .env: NO EXISTE"
        ENV_FILE="❌"
    fi
else
    echo -e "  🔴 Directorio proyecto: NO EXISTE"
    PROJECT_DIR_STATUS="❌"
    SERVER_FILE="❌"
    FRONTEND_BUILD="❌"
    ENV_FILE="❌"
fi

echo ""

# ============================================================================
# 4. VERIFICAR LOGS
# ============================================================================
echo -e "${YELLOW}📝 Estado de Logs:${NC}"

# Verificar logs de Nginx
if [ -f "/var/log/nginx/levantatecuba_error.log" ]; then
    ERROR_COUNT=$(tail -n 100 /var/log/nginx/levantatecuba_error.log 2>/dev/null | grep "$(date +%Y/%m/%d)" | wc -l)
    if [ $ERROR_COUNT -eq 0 ]; then
        echo -e "  🟢 Nginx logs: SIN ERRORES HOY"
        NGINX_LOGS="✅"
    else
        echo -e "  🟡 Nginx logs: $ERROR_COUNT errores hoy"
        NGINX_LOGS="⚠️"
    fi
else
    echo -e "  🔴 Nginx logs: NO ENCONTRADO"
    NGINX_LOGS="❌"
fi

# Verificar logs de PM2
if pm2 logs levantatecuba --lines 10 --nostream 2>/dev/null | grep -q "error\|Error\|ERROR"; then
    echo -e "  🟡 PM2 logs: CON ERRORES RECIENTES"
    PM2_LOGS="⚠️"
else
    echo -e "  🟢 PM2 logs: SIN ERRORES RECIENTES"
    PM2_LOGS="✅"
fi

echo ""

# ============================================================================
# 5. VERIFICAR CERTIFICADOS SSL
# ============================================================================
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${YELLOW}🔐 Certificados SSL:${NC}"
    
    # Verificar validez del certificado
    CERT_END_DATE=$(openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -enddate | cut -d= -f2)
    CERT_END_TIMESTAMP=$(date -d "$CERT_END_DATE" +%s)
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_LEFT=$(( (CERT_END_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
    
    if [ $DAYS_LEFT -gt 30 ]; then
        echo -e "  🟢 Certificado SSL: VÁLIDO ($DAYS_LEFT días restantes)"
        SSL_STATUS="✅"
    elif [ $DAYS_LEFT -gt 7 ]; then
        echo -e "  🟡 Certificado SSL: EXPIRA PRONTO ($DAYS_LEFT días restantes)"
        SSL_STATUS="⚠️"
    else
        echo -e "  🔴 Certificado SSL: EXPIRA MUY PRONTO ($DAYS_LEFT días restantes)"
        SSL_STATUS="❌"
    fi
    
    echo -e "  📅 Vence: $CERT_END_DATE"
    echo ""
else
    SSL_STATUS="❌"
fi

# ============================================================================
# 6. VERIFICAR RECURSOS DEL SISTEMA
# ============================================================================
echo -e "${YELLOW}💾 Recursos del Sistema:${NC}"

# Uso de CPU
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')
echo -e "  🖥️ CPU: $CPU_USAGE en uso"

# Uso de RAM
RAM_USAGE=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
echo -e "  🧠 RAM: $RAM_USAGE en uso"

# Uso de disco
DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}')
echo -e "  💾 Disco: $DISK_USAGE en uso"

# Procesos de Node.js
NODE_PROCESSES=$(ps aux | grep node | grep -v grep | wc -l)
echo -e "  ⚡ Procesos Node.js: $NODE_PROCESSES"

echo ""

# ============================================================================
# 7. RESUMEN FINAL
# ============================================================================
echo -e "${BLUE}📊 RESUMEN DE VERIFICACIÓN${NC}"
echo -e "${BLUE}═══════════════════════════${NC}"

# Calcular puntuación general
SCORE=0
TOTAL=12

services=("$NGINX_STATUS" "$PM2_STATUS" "$UFW_STATUS" "$HTTP_LOCAL" "$HTTPS_STATUS" "$API_STATUS" "$PROJECT_DIR_STATUS" "$SERVER_FILE" "$FRONTEND_BUILD" "$ENV_FILE" "$NGINX_LOGS" "$PM2_LOGS")

for status in "${services[@]}"; do
    if [ "$status" = "✅" ]; then
        ((SCORE++))
    fi
done

echo ""
echo -e "${YELLOW}🏆 Puntuación General: $SCORE/$TOTAL${NC}"

# Determinar estado general
if [ $SCORE -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 ESTADO: EXCELENTE - Todo funcionando perfectamente${NC}"
elif [ $SCORE -ge 9 ]; then
    echo -e "${GREEN}✅ ESTADO: BUENO - Sistema funcionando correctamente${NC}"
elif [ $SCORE -ge 6 ]; then
    echo -e "${YELLOW}⚠️ ESTADO: REGULAR - Necesita atención${NC}"
else
    echo -e "${RED}❌ ESTADO: CRÍTICO - Requiere intervención inmediata${NC}"
fi

echo ""

# ============================================================================
# 8. ACCIONES RECOMENDADAS
# ============================================================================
if [ $SCORE -lt $TOTAL ]; then
    echo -e "${YELLOW}💡 ACCIONES RECOMENDADAS:${NC}"
    
    if [ "$NGINX_STATUS" = "❌" ]; then
        echo -e "  🔧 Reiniciar Nginx: sudo systemctl start nginx"
    fi
    
    if [ "$PM2_STATUS" = "❌" ]; then
        echo -e "  🔧 Reiniciar Backend: pm2 restart levantatecuba"
    fi
    
    if [ "$HTTPS_STATUS" = "❌" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        echo -e "  🔧 Verificar configuración SSL en Nginx"
    fi
    
    if [ "$ENV_FILE" = "❌" ]; then
        echo -e "  🔧 Crear archivo .env desde template: cp deploy/env-template.txt .env"
    fi
    
    if [ "$SSL_STATUS" = "⚠️" ] || [ "$SSL_STATUS" = "❌" ]; then
        echo -e "  🔧 Renovar certificado SSL: sudo certbot renew"
    fi
    
    echo ""
fi

echo -e "${BLUE}🔍 Para más detalles, revisa:${NC}"
echo -e "  📝 Logs Nginx: sudo tail -f /var/log/nginx/levantatecuba_error.log"
echo -e "  📝 Logs Backend: pm2 logs levantatecuba"
echo -e "  📝 Estado PM2: pm2 status"
echo -e "  📝 Estado servicios: sudo systemctl status nginx"

echo ""
echo -e "${GREEN}✨ Verificación completada - $(date)${NC}"
