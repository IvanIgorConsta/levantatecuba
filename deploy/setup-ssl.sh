#!/bin/bash

# ============================================================================
# SCRIPT DE CONFIGURACIÓN SSL - LEVANTATECUBA
# Configura Let's Encrypt SSL con Certbot
# ============================================================================

set -e

echo "🔐 Configurando SSL para levantatecuba.com..."

# ============================================================================
# 1. CONFIGURAR NGINX (sin SSL primero)
# ============================================================================
echo "⚙️ Configurando Nginx..."

# Backup de configuración actual
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Crear configuración temporal para validación SSL
cat > /etc/nginx/sites-available/levantatecuba << 'EOF'
server {
    listen 80;
    server_name levantatecuba.com www.levantatecuba.com;
    
    root /var/www/levantatecuba;
    index index.html index.htm;
    
    # Permitir validación de Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/levantatecuba;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Habilitar sitio
ln -sf /etc/nginx/sites-available/levantatecuba /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Recargar Nginx
systemctl reload nginx

echo "✅ Configuración básica de Nginx aplicada"

# ============================================================================
# 2. CREAR ARCHIVO HTML TEMPORAL PARA VALIDACIÓN
# ============================================================================
echo "📄 Creando archivo temporal para validación..."
mkdir -p /var/www/levantatecuba
echo "<h1>LevántateCuba - Configurando SSL...</h1>" > /var/www/levantatecuba/index.html
chown -R www-data:www-data /var/www/levantatecuba

# ============================================================================
# 3. OBTENER CERTIFICADOS SSL
# ============================================================================
echo "🔑 Obteniendo certificados SSL de Let's Encrypt..."

# Importante: Cambia admin@levantatecuba.com por tu email real
certbot --nginx \
    -d levantatecuba.com \
    -d www.levantatecuba.com \
    --non-interactive \
    --agree-tos \
    --email admin@levantatecuba.com \
    --redirect

echo "✅ Certificados SSL obtenidos y configurados"

# ============================================================================
# 4. CONFIGURAR RENOVACIÓN AUTOMÁTICA
# ============================================================================
echo "🔄 Configurando renovación automática..."

# Crear script de renovación
cat > /usr/local/bin/renew-ssl.sh << 'EOF'
#!/bin/bash
certbot renew --quiet --nginx
systemctl reload nginx
EOF

chmod +x /usr/local/bin/renew-ssl.sh

# Agregar cron job para renovación automática
(crontab -l 2>/dev/null; echo "0 3 * * 0 /usr/local/bin/renew-ssl.sh") | crontab -

echo "✅ Renovación automática configurada (domingos a las 3 AM)"

# ============================================================================
# 5. APLICAR CONFIGURACIÓN FINAL DE NGINX
# ============================================================================
echo "🔧 Aplicando configuración final de Nginx..."

# Ahora copiar la configuración completa con todas las optimizaciones
cp nginx.conf /etc/nginx/sites-available/levantatecuba

# Agregar configuraciones globales a nginx.conf si no existen
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    # Hacer backup del nginx.conf original
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # Agregar configuraciones de rate limiting
    sed -i '/http {/a\
    # Rate limiting zones\
    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;\
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;\
    \
    # Configuración de buffers\
    client_body_buffer_size 128k;\
    client_max_body_size 50m;\
    client_header_buffer_size 1k;\
    large_client_header_buffers 4 4k;\
    \
    # Configuración de timeouts\
    client_body_timeout 12;\
    client_header_timeout 12;\
    keepalive_timeout 15;\
    send_timeout 10;\
    \
    # Ocultar versión de Nginx\
    server_tokens off;' /etc/nginx/nginx.conf
fi

# Verificar configuración
nginx -t

# Recargar Nginx
systemctl reload nginx

echo "✅ Configuración completa de Nginx aplicada"

# ============================================================================
# 6. VERIFICACIÓN FINAL
# ============================================================================
echo "🔍 Verificando configuración SSL..."

# Verificar que los certificados se crearon correctamente
if [ -f "/etc/letsencrypt/live/levantatecuba.com/fullchain.pem" ]; then
    echo "✅ Certificado SSL encontrado"
    
    # Mostrar información del certificado
    openssl x509 -in /etc/letsencrypt/live/levantatecuba.com/fullchain.pem -text -noout | grep -A2 "Validity"
else
    echo "❌ Error: Certificado SSL no encontrado"
    exit 1
fi

# Verificar que Nginx está funcionando
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx está funcionando correctamente"
else
    echo "❌ Error: Nginx no está funcionando"
    exit 1
fi

echo ""
echo "🎉 ¡CONFIGURACIÓN SSL COMPLETADA!"
echo ""
echo "🌐 Tu sitio ahora está disponible en:"
echo "   https://levantatecuba.com"
echo "   https://www.levantatecuba.com"
echo ""
echo "📋 PRÓXIMOS PASOS:"
echo "1. Subir tu código del proyecto"
echo "2. Configurar variables de entorno"
echo "3. Ejecutar deploy.sh"
echo ""
echo "🔐 CERTIFICADOS SSL:"
echo "   - Válidos por 90 días"
echo "   - Renovación automática configurada"
echo "   - Próxima renovación: $(date -d '+85 days' '+%Y-%m-%d')"
