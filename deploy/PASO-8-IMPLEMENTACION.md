# 🚀 PASO 8 - GUÍA DE IMPLEMENTACIÓN
## Infraestructura, Cloudflare, NGINX Optimizado

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ **Inmediato (Ya aplicado en el código)**
- [x] Límites de upload estandarizados en `routes/news.js`
- [x] Configuración NGINX optimizada creada (`deploy/nginx-optimized.conf`)
- [x] Configuración global NGINX creada (`deploy/nginx-global.conf`)

### 🔄 **Por Aplicar en el Servidor**
- [ ] Actualizar configuración NGINX
- [ ] Habilitar rate limiting en NGINX
- [ ] Instalar módulo Brotli (opcional pero recomendado)
- [ ] Configurar Cloudflare
- [ ] Activar HTTP/3 en NGINX
- [ ] Aplicar límites globales

---

## 1️⃣ ACTUALIZAR NGINX EN EL SERVIDOR

### **Paso 1: Backup de configuración actual**
```bash
ssh root@tu-servidor

# Backup
cp /etc/nginx/sites-available/levantatecuba /etc/nginx/sites-available/levantatecuba.backup
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
```

### **Paso 2: Subir nueva configuración**
```bash
# En tu máquina local
scd deploy/nginx-optimized.conf root@tu-servidor:/tmp/
scp deploy/nginx-global.conf root@tu-servidor:/tmp/

# En el servidor
mv /tmp/nginx-optimized.conf /etc/nginx/sites-available/levantatecuba
```

### **Paso 3: Aplicar configuración global**
```bash
# Abrir nginx.conf
nano /etc/nginx/nginx.conf

# Buscar el bloque http { ... }
# Añadir DENTRO de http {} las configuraciones de nginx-global.conf
# (Copiar líneas 18-127 de nginx-global.conf)
```

**Contenido a añadir:**
```nginx
http {
    # ... configuración existente ...
    
    # ============ AÑADIR ESTAS LÍNEAS ============
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    
    # Buffers y límites
    client_body_buffer_size 128k;
    client_max_body_size 20m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;
    
    # Timeouts
    client_body_timeout 30s;
    client_header_timeout 12s;
    keepalive_timeout 65s;
    send_timeout 30s;
    
    # Seguridad
    server_tokens off;
    limit_conn addr 10;
    
    # Logging extendido
    log_format main_ext '$remote_addr - $remote_user [$time_local] "$request" '
                        '$status $body_bytes_sent "$http_referer" '
                        '"$http_user_agent" "$http_x_forwarded_for" '
                        'rt=$request_time uct="$upstream_connect_time" '
                        'uht="$upstream_header_time" urt="$upstream_response_time"';
    
    # ... resto de configuración ...
}
```

### **Paso 4: Verificar y recargar**
```bash
# Test de configuración
nginx -t

# Si todo está OK:
systemctl reload nginx

# Verificar que funciona
systemctl status nginx
```

---

## 2️⃣ INSTALAR BROTLI (OPCIONAL PERO RECOMENDADO)

### **¿Qué es Brotli?**
Compresión 20-30% mejor que Gzip. Reduce tamaño de transferencia.

### **Instalación en Ubuntu/Debian:**
```bash
# Instalar módulo
sudo apt update
sudo apt install -y libbrotli-dev

# Verificar si nginx ya tiene soporte
nginx -V 2>&1 | grep brotli

# Si NO aparece "http_brotli", instalar desde fuente:
cd /tmp
git clone https://github.com/google/ngx_brotli.git
cd ngx_brotli
git submodule update --init

# Recompilar nginx con módulo (complejo, mejor usar Docker o instalar nginx-extras)
# O instalar nginx-extras que ya lo incluye:
sudo apt install nginx-extras
```

### **Activar Brotli:**
```bash
# Editar nginx.conf
nano /etc/nginx/nginx.conf

# Al inicio del archivo (FUERA del bloque http {}), añadir:
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;

# Dentro de http {}, descomentar líneas de brotli en nginx-optimized.conf
```

---

## 3️⃣ CONFIGURAR CLOUDFLARE

### **Paso 1: Crear cuenta y añadir sitio**
1. Ir a https://dash.cloudflare.com
2. "Add a Site" → `levantatecuba.com`
3. Seleccionar plan **Free**
4. Cloudflare escaneará DNS automáticamente

### **Paso 2: Cambiar Nameservers en Hostinger**
1. Ir al panel de Hostinger
2. Dominios → levantatecuba.com → Gestión DNS
3. Cambiar nameservers por los de Cloudflare:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
4. Esperar propagación (5-30 minutos)

### **Paso 3: Configuración SSL/TLS**
```
Cloudflare Dashboard:
SSL/TLS → Overview
✅ Encryption mode: Full (strict)

IMPORTANTE: NO usar "Flexible" (rompe la comunicación)
```

### **Paso 4: Optimizaciones de Speed**
```
Speed → Optimization:
✅ Auto Minify:
   - JavaScript: ON
   - CSS: ON
   - HTML: ON

✅ Brotli: ON
✅ Early Hints: ON
✅ HTTP/3 (with QUIC): ON
✅ Rocket Loader: OFF (puede romper React)
✅ Mirage: OFF
✅ Polish: OFF (solo en plan Pro+)
```

### **Paso 5: Cache Rules**
```
Caching → Cache Rules → Create Rule:

Regla 1: "Cache Static Assets"
  Expression:
  (http.request.uri.path matches "/uploads/.*") or
  (http.request.uri.path matches "/media/.*") or
  (http.request.uri.path matches "/img/.*") or
  (http.request.uri.path matches ".*\\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|avif)$")
  
  Then:
  - Cache status: Eligible for cache
  - Edge Cache TTL: 7 days
  - Browser Cache TTL: 1 day

Regla 2: "Bypass API Cache"
  Expression:
  http.request.uri.path starts with "/api"
  
  Then:
  - Cache status: Bypass cache
```

### **Paso 6: WAF (Firewall)**
```
Security → WAF → Managed Rules:
✅ Cloudflare Managed Ruleset: ON
✅ OWASP Core Ruleset: ON
✅ Sensitivity: Medium

Security → Settings:
✅ Security Level: Medium
✅ Challenge Passage: 30 minutes
✅ Browser Integrity Check: ON
```

### **Paso 7: Rate Limiting en Cloudflare**
```
Security → WAF → Rate limiting rules:

Regla 1: "Protect Login"
  If incoming requests match:
  - URI Path equals: /api/auth/login
  - HTTP Method: POST
  
  With the same:
  - IP Address
  
  When rate exceeds:
  - 5 requests per 10 minutes
  
  Then:
  - Block for 60 seconds

Regla 2: "Protect Registration"
  If incoming requests match:
  - URI Path equals: /api/auth/register
  - HTTP Method: POST
  
  With the same:
  - IP Address
  
  When rate exceeds:
  - 3 requests per 10 minutes
  
  Then:
  - Block for 300 seconds

Regla 3: "Global API Protection"
  If incoming requests match:
  - URI Path starts with: /api/
  
  With the same:
  - IP Address
  
  When rate exceeds:
  - 100 requests per minute
  
  Then:
  - Managed Challenge
```

### **Paso 8: Page Rules (Free plan: 3 reglas)**
```
Rules → Page Rules:

Regla 1: Cache Everything en assets
  URL: levantatecuba.com/uploads/*
  Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month

Regla 2: Bypass cache en API
  URL: levantatecuba.com/api/*
  Settings:
  - Cache Level: Bypass

Regla 3: HTTPS obligatorio
  URL: *levantatecuba.com/*
  Settings:
  - Always Use HTTPS: ON
```

---

## 4️⃣ HABILITAR HTTP/3 EN NGINX

### **Verificar soporte HTTP/3:**
```bash
nginx -V 2>&1 | grep http_v3
```

### **Si no está compilado:**
```bash
# Opción 1: Usar nginx mainline (tiene HTTP/3)
sudo add-apt-repository ppa:ondrej/nginx-mainline
sudo apt update
sudo apt upgrade nginx

# Opción 2: Compilar desde fuente con BoringSSL
# (Complejo, recomendado solo para usuarios avanzados)
```

### **Si ya está compilado:**
```bash
# La configuración ya está en nginx-optimized.conf
# Líneas 24-30:
listen 443 quic reuseport;
http3 on;
add_header Alt-Svc 'h3=":443"; ma=86400';
```

### **Abrir puerto UDP 443 en firewall:**
```bash
sudo ufw allow 443/udp
sudo ufw status
```

### **Test HTTP/3:**
```bash
# Instalar curl con soporte HTTP/3
sudo apt install curl

# Test
curl -I --http3 https://levantatecuba.com
```

O usar: https://http3check.net/

---

## 5️⃣ VERIFICACIÓN POST-IMPLEMENTACIÓN

### **Checklist de verificación:**

#### **✅ NGINX**
```bash
# Estado
systemctl status nginx

# Test configuración
nginx -t

# Ver versión y módulos
nginx -V

# Ver logs en tiempo real
tail -f /var/log/nginx/levantatecuba_error.log
```

#### **✅ Headers HTTP**
```bash
curl -I https://levantatecuba.com
```

**Deberías ver:**
```
HTTP/2 200
alt-svc: h3=":443"; ma=86400
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
strict-transport-security: max-age=31536000; includeSubDomains; preload
content-encoding: gzip
```

#### **✅ Compresión**
```bash
curl -H "Accept-Encoding: gzip" -I https://levantatecuba.com/api/news
```

Verificar: `content-encoding: gzip`

#### **✅ SSL**
```bash
# Test SSL
openssl s_client -connect levantatecuba.com:443 -servername levantatecuba.com

# O usar:
nmap --script ssl-enum-ciphers -p 443 levantatecuba.com
```

#### **✅ Rate Limiting**
```bash
# Test 10 requests rápidos
for i in {1..10}; do curl https://levantatecuba.com/api/auth/login -X POST; done
```

Después de 5 requests, deberías ver: `429 Too Many Requests`

#### **✅ Uploads**
```bash
# Test upload pequeño (OK)
curl -X POST https://levantatecuba.com/api/news \
  -F "imagen=@test-5mb.jpg"

# Test upload grande (debería fallar >10MB)
curl -X POST https://levantatecuba.com/api/news \
  -F "imagen=@test-15mb.jpg"
```

Esperado: `413 Request Entity Too Large`

---

## 6️⃣ TESTS ONLINE RECOMENDADOS

### **Seguridad:**
- https://securityheaders.com/?q=levantatecuba.com
  - **Meta:** A+ rating
  
- https://www.ssllabs.com/ssltest/analyze.html?d=levantatecuba.com
  - **Meta:** A+ rating

### **Performance:**
- https://pagespeed.web.dev/
  - **Meta:** >90 en mobile y desktop
  
- https://gtmetrix.com/
  - **Meta:** Grade A

### **HTTP/3:**
- https://http3check.net/?host=levantatecuba.com
  - **Meta:** HTTP/3 supported

### **Cloudflare:**
- https://www.cdn77.com/cdn-speedtest
  - Verificar que Cloudflare está activo

---

## 7️⃣ MÉTRICAS DE ÉXITO

### **Antes vs Después:**

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Headers seguros | 4/6 | 6/6 | +50% |
| SSL Rating | A | A+ | +5% |
| Compresión | Gzip | Gzip + Brotli | +20% |
| HTTP Version | HTTP/2 | HTTP/2 + HTTP/3 | +10% latencia |
| Rate limiting | Parcial | Completo | +100% |
| Uploads controlados | No | Sí | -100% riesgo |
| Cache hits | 0% | >80% | +400% velocidad |
| DDoS protection | No | Cloudflare | Ilimitado |

---

## 8️⃣ TROUBLESHOOTING

### **Error: "502 Bad Gateway"**
```bash
# Verificar backend
pm2 status
pm2 logs levantatecuba --lines 20

# Verificar proxy
tail -f /var/log/nginx/levantatecuba_error.log

# Test conexión local
curl http://localhost:5000/api/health
```

### **Error: "413 Request Entity Too Large" inesperado**
```bash
# Verificar límites
grep client_max_body_size /etc/nginx/nginx.conf

# Debería ser 20m, si no:
nano /etc/nginx/nginx.conf
# Añadir: client_max_body_size 20m;

nginx -t && systemctl reload nginx
```

### **Cloudflare no aplica cache**
```bash
# Ver headers de respuesta
curl -I https://levantatecuba.com/uploads/test.jpg

# Verificar: cf-cache-status: HIT (después del segundo request)
```

Si dice `BYPASS` o `MISS` siempre:
- Verificar Cache Rules en Cloudflare
- Asegurarse de que NGINX no envíe headers `no-cache`

### **HTTP/3 no funciona**
```bash
# Verificar puerto UDP 443
sudo ufw status | grep 443

# Verificar soporte nginx
nginx -V 2>&1 | grep http_v3

# Si no está, recompilar o usar nginx mainline
```

---

## 🎯 RESULTADO ESPERADO

### **Security Headers Test:**
```
A+ Rating:
✅ Strict-Transport-Security
✅ Content-Security-Policy
✅ X-Frame-Options
✅ X-Content-Type-Options
✅ Referrer-Policy
✅ Permissions-Policy
```

### **SSL Labs Test:**
```
A+ Rating:
✅ TLS 1.3 supported
✅ TLS 1.2 supported
✅ Strong cipher suites
✅ HSTS enabled
✅ Certificate valid
```

### **Performance:**
```
Google PageSpeed:
✅ Desktop: 95+
✅ Mobile: 90+

GTmetrix:
✅ Grade: A
✅ Performance: 95%+
✅ Structure: 95%+
```

---

## 📞 SOPORTE

Si encuentras problemas:

1. Revisa logs: `tail -f /var/log/nginx/levantatecuba_error.log`
2. Test configuración: `nginx -t`
3. Verifica backend: `pm2 logs levantatecuba`
4. Revisa Cloudflare Dashboard → Analytics

---

## ✅ CHECKLIST FINAL

- [ ] NGINX actualizado con nginx-optimized.conf
- [ ] Configuración global aplicada en /etc/nginx/nginx.conf
- [ ] Rate limiting zones activadas
- [ ] client_max_body_size = 20m
- [ ] Brotli instalado y activado (opcional)
- [ ] HTTP/3 habilitado (opcional)
- [ ] Cloudflare configurado
- [ ] SSL mode: Full (strict)
- [ ] Cache rules configuradas
- [ ] WAF habilitado
- [ ] Rate limiting en Cloudflare
- [ ] Tests de seguridad pasados (A+)
- [ ] Tests de performance pasados (>90)

---

**¡Tu infraestructura estará lista para producción a escala!** 🚀
