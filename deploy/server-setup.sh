#!/bin/bash

# ============================================================================
# SCRIPT DE CONFIGURACIÓN INICIAL - LEVANTATECUBA PRODUCCIÓN
# Ubuntu 22.04 - Hostinger VPS KVM 1
# ============================================================================

set -e  # Salir si algún comando falla

echo "🚀 Iniciando configuración del servidor para LevántateCuba..."

# ============================================================================
# 1. ACTUALIZAR SISTEMA Y INSTALAR UTILIDADES BÁSICAS
# ============================================================================
echo "📦 Actualizando sistema e instalando utilidades..."
apt update && apt upgrade -y
apt install -y curl git ufw htop nano wget software-properties-common

# ============================================================================
# 2. CONFIGURAR FIREWALL UFW
# ============================================================================
echo "🔥 Configurando firewall UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable
echo "✅ Firewall configurado (puertos: 22, 80, 443)"

# ============================================================================
# 3. INSTALAR NODE.JS LTS (20.x)
# ============================================================================
echo "📦 Instalando Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
echo "✅ Node.js instalado: $(node -v) | npm: $(npm -v)"

# ============================================================================
# 4. INSTALAR PM2 GLOBALMENTE
# ============================================================================
echo "⚙️ Instalando PM2..."
npm install -g pm2
pm2 startup
echo "✅ PM2 instalado y configurado para autostart"

# ============================================================================
# 5. INSTALAR NGINX
# ============================================================================
echo "🌐 Instalando Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx
echo "✅ Nginx instalado y habilitado"

# ============================================================================
# 6. INSTALAR CERTBOT (Let's Encrypt SSL)
# ============================================================================
echo "🔐 Instalando Certbot para SSL..."
apt install -y certbot python3-certbot-nginx
echo "✅ Certbot instalado"

# ============================================================================
# 7. CREAR DIRECTORIOS DEL PROYECTO
# ============================================================================
echo "📁 Creando directorios del proyecto..."
mkdir -p /var/www/levantatecuba
mkdir -p /var/log/levantatecuba
chown -R $USER:www-data /var/www/levantatecuba
chmod -R 755 /var/www/levantatecuba
echo "✅ Directorios creados en /var/www/levantatecuba"

# ============================================================================
# 8. CONFIGURAR LOGS ROTATIVOS
# ============================================================================
echo "📊 Configurando rotación de logs..."
cat > /etc/logrotate.d/levantatecuba << 'EOF'
/var/log/levantatecuba/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Configurar rotación de logs de PM2
cat > /etc/logrotate.d/pm2 << 'EOF'
/home/*/.pm2/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    su root root
}
EOF
echo "✅ Rotación de logs configurada"

# ============================================================================
# 9. OPTIMIZAR SISTEMA
# ============================================================================
echo "⚡ Aplicando optimizaciones del sistema..."

# Aumentar límites de archivos abiertos
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimizar kernel para aplicaciones web
cat >> /etc/sysctl.conf << 'EOF'
# Optimizaciones para aplicaciones web
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_keepalive_time = 15
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5
EOF

sysctl -p
echo "✅ Optimizaciones aplicadas"

echo ""
echo "🎉 ¡CONFIGURACIÓN INICIAL COMPLETADA!"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Configurar Nginx → copiar archivo nginx.conf"
echo "2. Obtener certificados SSL → ejecutar setup-ssl.sh"
echo "3. Subir código del proyecto"
echo "4. Configurar variables de entorno"
echo "5. Ejecutar deploy.sh"
echo ""
echo "🔄 Reinicia el servidor para aplicar todos los cambios:"
echo "sudo reboot"
