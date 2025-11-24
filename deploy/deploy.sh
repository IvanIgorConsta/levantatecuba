#!/bin/bash

# ============================================================================
# SCRIPT DE DEPLOY - LEVANTATECUBA PRODUCCIÓN
# Deploy completo: Frontend + Backend
# ============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
PROJECT_DIR="/var/www/levantatecuba"
REPO_URL="https://github.com/tu-usuario/levantatecuba.git"  # Cambiar por tu repo
BRANCH="main"
BACKUP_DIR="/var/backups/levantatecuba"

echo -e "${BLUE}🚀 Iniciando deploy de LevántateCuba...${NC}"

# ============================================================================
# 1. CREAR BACKUP DEL DEPLOY ANTERIOR
# ============================================================================
create_backup() {
    echo -e "${YELLOW}📦 Creando backup...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}"
    
    mkdir -p $BACKUP_DIR
    
    if [ -d "$PROJECT_DIR" ]; then
        cp -r $PROJECT_DIR $BACKUP_PATH
        echo -e "${GREEN}✅ Backup creado en: $BACKUP_PATH${NC}"
    else
        echo -e "${YELLOW}⚠️ No existe deploy anterior, saltando backup${NC}"
    fi
}

# ============================================================================
# 2. CLONAR O ACTUALIZAR CÓDIGO
# ============================================================================
update_code() {
    echo -e "${YELLOW}📥 Actualizando código...${NC}"
    
    if [ -d "$PROJECT_DIR/.git" ]; then
        echo "Actualizando repositorio existente..."
        cd $PROJECT_DIR
        git fetch origin
        git reset --hard origin/$BRANCH
        git clean -fd
    else
        echo "Clonando repositorio..."
        rm -rf $PROJECT_DIR
        git clone -b $BRANCH $REPO_URL $PROJECT_DIR
        cd $PROJECT_DIR
    fi
    
    echo -e "${GREEN}✅ Código actualizado${NC}"
}

# ============================================================================
# 3. CONFIGURAR VARIABLES DE ENTORNO
# ============================================================================
setup_environment() {
    echo -e "${YELLOW}⚙️ Configurando variables de entorno...${NC}"
    
    cd $PROJECT_DIR
    
    # Verificar si existe archivo .env
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ Error: Archivo .env no encontrado${NC}"
        echo -e "${YELLOW}💡 Copia el archivo deploy/env-template.txt como .env y configúralo${NC}"
        echo -e "${YELLOW}   cp deploy/env-template.txt .env${NC}"
        echo -e "${YELLOW}   nano .env${NC}"
        exit 1
    fi
    
    # Verificar variables críticas
    if ! grep -q "MONGODB_URI=mongodb" .env || ! grep -q "JWT_SECRET=" .env; then
        echo -e "${RED}❌ Error: Variables de entorno críticas no configuradas${NC}"
        echo -e "${YELLOW}💡 Revisa y completa el archivo .env${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Variables de entorno verificadas${NC}"
}

# ============================================================================
# 4. INSTALAR DEPENDENCIAS DEL BACKEND
# ============================================================================
install_backend_deps() {
    echo -e "${YELLOW}📦 Instalando dependencias del backend...${NC}"
    
    cd $PROJECT_DIR/server
    
    # Limpiar cache de npm
    npm cache clean --force
    
    # Instalar dependencias de producción
    npm ci --only=production --no-audit
    
    echo -e "${GREEN}✅ Dependencias del backend instaladas${NC}"
}

# ============================================================================
# 5. BUILD Y DEPLOY DEL FRONTEND
# ============================================================================
build_frontend() {
    echo -e "${YELLOW}⚛️ Building frontend React...${NC}"
    
    cd $PROJECT_DIR
    
    # Instalar dependencias del frontend
    npm ci --no-audit
    
    # Build de producción
    npm run build
    
    # Verificar que se generó el build
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ Error: Build del frontend falló${NC}"
        exit 1
    fi
    
    # Copiar build a directorio web
    rm -rf /var/www/levantatecuba/public
    cp -r dist /var/www/levantatecuba/public
    
    # Configurar permisos
    chown -R www-data:www-data /var/www/levantatecuba/public
    chmod -R 755 /var/www/levantatecuba/public
    
    echo -e "${GREEN}✅ Frontend deployado${NC}"
}

# ============================================================================
# 6. ACTUALIZAR CONFIGURACIÓN DE NGINX
# ============================================================================
update_nginx() {
    echo -e "${YELLOW}🌐 Actualizando configuración de Nginx...${NC}"
    
    # Actualizar configuración si es necesario
    if [ -f "$PROJECT_DIR/deploy/nginx.conf" ]; then
        cp $PROJECT_DIR/deploy/nginx.conf /etc/nginx/sites-available/levantatecuba
    fi
    
    # Verificar configuración
    nginx -t
    
    if [ $? -eq 0 ]; then
        systemctl reload nginx
        echo -e "${GREEN}✅ Nginx actualizado${NC}"
    else
        echo -e "${RED}❌ Error en configuración de Nginx${NC}"
        exit 1
    fi
}

# ============================================================================
# 7. DEPLOY DEL BACKEND CON PM2
# ============================================================================
deploy_backend() {
    echo -e "${YELLOW}🖥️ Deploying backend con PM2...${NC}"
    
    cd $PROJECT_DIR
    
    # Copiar configuración de PM2
    if [ -f "deploy/pm2.config.js" ]; then
        cp deploy/pm2.config.js ./pm2.config.js
    fi
    
    # Detener aplicación si existe
    pm2 stop levantatecuba 2>/dev/null || true
    pm2 delete levantatecuba 2>/dev/null || true
    
    # Iniciar aplicación
    pm2 start pm2.config.js --env production
    
    # Guardar configuración de PM2
    pm2 save
    
    # Verificar que está funcionando
    sleep 3
    if pm2 list | grep -q "levantatecuba.*online"; then
        echo -e "${GREEN}✅ Backend deployado y funcionando${NC}"
    else
        echo -e "${RED}❌ Error: Backend no se inició correctamente${NC}"
        pm2 logs levantatecuba --lines 20
        exit 1
    fi
}

# ============================================================================
# 8. VERIFICACIONES POST-DEPLOY
# ============================================================================
verify_deployment() {
    echo -e "${YELLOW}🔍 Verificando deployment...${NC}"
    
    # Verificar Nginx
    if ! systemctl is-active --quiet nginx; then
        echo -e "${RED}❌ Nginx no está funcionando${NC}"
        exit 1
    fi
    
    # Verificar backend
    if ! pm2 list | grep -q "levantatecuba.*online"; then
        echo -e "${RED}❌ Backend no está funcionando${NC}"
        exit 1
    fi
    
    # Verificar que el sitio responde
    if ! curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200"; then
        echo -e "${YELLOW}⚠️ El sitio no responde en localhost${NC}"
    fi
    
    # Verificar certificados SSL
    if [ -f "/etc/letsencrypt/live/levantatecuba.com/fullchain.pem" ]; then
        CERT_EXPIRY=$(openssl x509 -in /etc/letsencrypt/live/levantatecuba.com/fullchain.pem -noout -dates | grep notAfter | cut -d= -f2)
        echo -e "${GREEN}📋 Certificado SSL válido hasta: $CERT_EXPIRY${NC}"
    fi
    
    echo -e "${GREEN}✅ Verificaciones completadas${NC}"
}

# ============================================================================
# 9. LIMPIAR ARCHIVOS TEMPORALES
# ============================================================================
cleanup() {
    echo -e "${YELLOW}🧹 Limpiando archivos temporales...${NC}"
    
    cd $PROJECT_DIR
    
    # Limpiar node_modules del frontend
    rm -rf node_modules
    
    # Limpiar logs antiguos
    find /var/log/levantatecuba -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
    
    # Limpiar backups antiguos (más de 7 días)
    find $BACKUP_DIR -type d -name "backup_*" -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    
    echo -e "${GREEN}✅ Limpieza completada${NC}"
}

# ============================================================================
# 10. MOSTRAR ESTADO FINAL
# ============================================================================
show_status() {
    echo ""
    echo -e "${GREEN}🎉 ¡DEPLOY COMPLETADO EXITOSAMENTE!${NC}"
    echo ""
    echo -e "${BLUE}📊 Estado del Sistema:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Estado de servicios
    echo -e "${YELLOW}📋 Servicios:${NC}"
    systemctl is-active nginx && echo -e "  🟢 Nginx: ACTIVO" || echo -e "  🔴 Nginx: INACTIVO"
    pm2 list | grep -q "levantatecuba.*online" && echo -e "  🟢 Backend: ACTIVO" || echo -e "  🔴 Backend: INACTIVO"
    
    # Información del proyecto
    echo ""
    echo -e "${YELLOW}🗂️ Proyecto:${NC}"
    echo "  📁 Directorio: $PROJECT_DIR"
    echo "  🌐 Sitio web: https://levantatecuba.com"
    echo "  🗄️ API: https://levantatecuba.com/api"
    
    # Logs útiles
    echo ""
    echo -e "${YELLOW}📝 Logs importantes:${NC}"
    echo "  🖥️ Backend: pm2 logs levantatecuba"
    echo "  🌐 Nginx: tail -f /var/log/nginx/levantatecuba_error.log"
    echo "  📊 Sistema: tail -f /var/log/levantatecuba/app.log"
    
    echo ""
    echo -e "${BLUE}✨ ¡LevántateCuba está listo para cambiar Cuba!${NC}"
}

# ============================================================================
# FUNCIÓN MAIN - EJECUTAR TODO EL PROCESO
# ============================================================================
main() {
    echo -e "${BLUE}🚀 INICIO DEL DEPLOY - $(date)${NC}"
    echo ""
    
    # Verificar que estamos ejecutando como root
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ Este script debe ejecutarse como root${NC}"
        echo -e "${YELLOW}💡 Usa: sudo ./deploy.sh${NC}"
        exit 1
    fi
    
    # Ejecutar pasos del deploy
    create_backup
    update_code
    setup_environment
    install_backend_deps
    build_frontend
    update_nginx
    deploy_backend
    verify_deployment
    cleanup
    show_status
    
    echo ""
    echo -e "${BLUE}🏁 DEPLOY COMPLETADO - $(date)${NC}"
}

# ============================================================================
# MANEJO DE ERRORES
# ============================================================================
trap 'echo -e "\n${RED}❌ Error durante el deploy. Revisa los logs.${NC}"; exit 1' ERR

# Ejecutar función main
main "$@"
