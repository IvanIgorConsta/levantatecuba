# 🚀 GUÍA COMPLETA DE DEPLOY - LEVANTATECUBA

Esta guía te llevará paso a paso para configurar completamente tu servidor de producción para LevántateCuba en un VPS Hostinger con Ubuntu 22.04.

## 📋 ÍNDICE

1. [Preparación inicial](#preparación-inicial)
2. [Configuración del servidor](#configuración-del-servidor)
3. [Configuración SSL](#configuración-ssl)
4. [Configuración del correo](#configuración-del-correo)
5. [Deploy del proyecto](#deploy-del-proyecto)
6. [Verificación y monitoreo](#verificación-y-monitoreo)
7. [Mantenimiento](#mantenimiento)

---

## 🎯 PREPARACIÓN INICIAL

### 1. Conectar al VPS
```bash
ssh root@tu-ip-del-vps
```

### 2. Subir archivos de configuración
Copia todos los archivos de la carpeta `deploy/` a tu servidor:

```bash
# En tu máquina local
scp -r deploy/ root@tu-ip-del-vps:/tmp/

# En el servidor
mv /tmp/deploy /root/deploy
chmod +x /root/deploy/*.sh
```

---

## ⚙️ CONFIGURACIÓN DEL SERVIDOR

### 1. Ejecutar configuración inicial
```bash
cd /root/deploy
./server-setup.sh
```

Este script instala y configura:
- ✅ Actualizaciones del sistema
- ✅ Firewall UFW (puertos 22, 80, 443)
- ✅ Node.js 20.x LTS
- ✅ PM2 con autostart
- ✅ Nginx
- ✅ Certbot para SSL
- ✅ Directorios del proyecto
- ✅ Optimizaciones del sistema

### 2. Reiniciar el servidor
```bash
sudo reboot
```

Espera 2-3 minutos y vuelve a conectar por SSH.

---

## 🔐 CONFIGURACIÓN SSL

### 1. Configurar Nginx básico
```bash
cd /root/deploy
./setup-ssl.sh
```

**IMPORTANTE**: Antes de ejecutar este script:
- Asegúrate de que tu dominio `levantatecuba.com` apunte a la IP de tu VPS
- Cambia el email en `setup-ssl.sh` línea 75: `--email admin@levantatecuba.com`

### 2. Verificar SSL
Después del script, tu sitio debería estar disponible en:
- ✅ `https://levantatecuba.com`
- ✅ `https://www.levantatecuba.com`

---

## 📧 CONFIGURACIÓN DEL CORREO

### 1. Crear cuenta de correo en Hostinger
1. Ve al panel de Hostinger
2. Busca "Email" o "Correo electrónico"
3. Crea la cuenta: `noreply@levantatecuba.com`
4. Genera una **contraseña de aplicación segura**
5. Anota la contraseña (la necesitarás para el archivo `.env`)

### 2. Configurar variables de entorno
```bash
cd /var/www/levantatecuba
cp /root/deploy/env-template.txt .env
nano .env
```

**Completa TODOS estos campos obligatorios:**

```env
# Base de datos (obtener desde MongoDB Atlas)
MONGODB_URI=mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/levantatecuba

# JWT (generar con: openssl rand -hex 64)
JWT_SECRET=tu_jwt_secret_super_seguro_generado_con_openssl

# Correo Hostinger
EMAIL_USER=noreply@levantatecuba.com
EMAIL_PASS=tu_password_generado_desde_hostinger

# APIs (obtener desde respectivas plataformas)
FACEBOOK_PAGE_TOKEN=tu_facebook_page_token
OPENAI_API_KEY=sk-xxxxxxxxxx
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
```

### 3. Instalar dependencias de email
```bash
cd /var/www/levantatecuba
/root/deploy/install-email-deps.sh
```

### 4. Integrar el servicio de email en tu backend
Copia el archivo `emailService.js` a tu proyecto:

```bash
cp /root/deploy/emailService.js /var/www/levantatecuba/server/services/
```

**Uso en tu backend:**
```javascript
const emailService = require('./services/emailService');

// Email de bienvenida
await emailService.sendWelcomeEmail('usuario@example.com', 'Juan Pérez');

// Email de recuperación de contraseña
await emailService.sendPasswordResetEmail('usuario@example.com', 'token123', 'Juan Pérez');

// Confirmación de denuncia
await emailService.sendReportConfirmationEmail('usuario@example.com', 'REP-001', 'Juan Pérez');
```

---

## 🚀 DEPLOY DEL PROYECTO

### 1. Configurar repositorio Git
Edita el archivo `/root/deploy/deploy.sh` línea 15:
```bash
REPO_URL="https://github.com/tu-usuario/levantatecuba.git"
```

### 2. Ejecutar deploy completo
```bash
cd /root/deploy
./deploy.sh
```

Este script hace:
- ✅ Clona/actualiza el código desde Git
- ✅ Instala dependencias del backend
- ✅ Hace build del frontend React
- ✅ Configura Nginx
- ✅ Inicia el backend con PM2
- ✅ Verifica que todo funcione

### 3. Verificar el deploy
```bash
./check-server.sh
```

---

## 🔍 VERIFICACIÓN Y MONITOREO

### Comandos útiles de verificación:

```bash
# Estado general del servidor
/root/deploy/check-server.sh

# Logs del backend
pm2 logs levantatecuba

# Logs de Nginx
tail -f /var/log/nginx/levantatecuba_error.log

# Estado de PM2
pm2 status

# Estado de servicios
systemctl status nginx
systemctl status ufw

# Uso de recursos
htop
df -h
```

### URLs importantes para verificar:
- 🌐 Frontend: `https://levantatecuba.com`
- 🗄️ API: `https://levantatecuba.com/api`
- 🔍 Health check: `https://levantatecuba.com/api/health` (si tienes esta ruta)

---

## 🔧 MANTENIMIENTO

### Renovación automática de SSL
Ya está configurada, pero puedes verificar:
```bash
# Probar renovación
sudo certbot renew --dry-run

# Ver cron jobs
crontab -l
```

### Actualizar el proyecto
Para actualizar cuando hagas cambios:
```bash
cd /root/deploy
./deploy.sh
```

### Backup manual
```bash
# Crear backup
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/levantatecuba

# Ver backups automáticos
ls -la /var/backups/levantatecuba/
```

### Reiniciar servicios
```bash
# Reiniciar backend
pm2 restart levantatecuba

# Reiniciar Nginx
sudo systemctl restart nginx

# Reiniciar todo el servidor
sudo reboot
```

---

## ⚠️ TROUBLESHOOTING

### Problema: El sitio no carga
```bash
# Verificar Nginx
sudo systemctl status nginx
sudo nginx -t

# Verificar backend
pm2 status
pm2 logs levantatecuba --lines 20
```

### Problema: Error de SSL
```bash
# Verificar certificados
sudo certbot certificates

# Renovar certificados
sudo certbot renew

# Reconfigurar SSL
/root/deploy/setup-ssl.sh
```

### Problema: Emails no se envían
```bash
# Verificar configuración SMTP
cd /var/www/levantatecuba
node -e "
const emailService = require('./server/services/emailService');
emailService.verifyConnection().then(() => console.log('✅ SMTP OK')).catch(e => console.log('❌ SMTP Error:', e));
"
```

### Problema: Backend no inicia
```bash
# Ver logs detallados
pm2 logs levantatecuba --lines 50

# Verificar variables de entorno
cd /var/www/levantatecuba
cat .env | grep -E "(MONGODB_URI|JWT_SECRET|EMAIL_)"

# Verificar dependencias
cd /var/www/levantatecuba/server
npm install
```

---

## 📞 CONTACTO Y SOPORTE

Si tienes problemas con el deploy:

1. **Ejecuta el diagnóstico**: `/root/deploy/check-server.sh`
2. **Revisa los logs**: `pm2 logs levantatecuba`
3. **Verifica la configuración**: `nginx -t`

### Archivos importantes:
- 📄 Variables de entorno: `/var/www/levantatecuba/.env`
- 📄 Configuración Nginx: `/etc/nginx/sites-available/levantatecuba`
- 📄 Configuración PM2: `/var/www/levantatecuba/pm2.config.js`
- 📄 Logs del proyecto: `/var/log/levantatecuba/`

---

## 🎉 ¡LISTO!

Si seguiste todos los pasos correctamente, tu proyecto LevántateCuba debería estar funcionando perfectamente en producción.

**URLs finales:**
- 🌐 **Sitio principal**: `https://levantatecuba.com`
- 🗄️ **API**: `https://levantatecuba.com/api`
- 📧 **Email configurado**: `noreply@levantatecuba.com`

**Servicios activos:**
- ✅ Nginx (puerto 80/443)
- ✅ Backend Node.js (puerto 5000, gestionado por PM2)
- ✅ SSL automático con Let's Encrypt
- ✅ Firewall configurado
- ✅ Logs rotativos
- ✅ Backup automático

¡**LevántateCuba está listo para cambiar Cuba**! 🇨🇺✊
