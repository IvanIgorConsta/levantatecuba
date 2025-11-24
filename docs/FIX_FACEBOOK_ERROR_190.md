# Solución Error 190 Facebook Graph API

## Problema Original
- Error 190: "Invalid OAuth access token - Cannot parse access token"
- Las variables de entorno tenían nombres inconsistentes
- El servicio enviaba el body como JSON en lugar de form-urlencoded

## Cambios Realizados

### 1. Unificación de Variables de Entorno

**Antes:** El código usaba `FB_PAGE_ID` y `FB_PAGE_ACCESS_TOKEN`  
**Ahora:** Usa `FACEBOOK_PAGE_ID` y `FACEBOOK_PAGE_TOKEN`

Tu archivo `.env` debe contener exactamente:
```env
FACEBOOK_PAGE_ID=123456789012345              # ID numérico de la página (NO el App ID)
FACEBOOK_PAGE_TOKEN=EAAGxxxxxxxxxxxxx         # Page Access Token (empieza con EAAG)
FB_GRAPH_VERSION=v23.0                        # Versión de Graph API
```

### 2. Nueva Utilidad de Configuración

Creado `server/utils/getFacebookConfig.js` que:
- Limpia y valida las variables de entorno
- Elimina espacios, comillas y saltos de línea del token
- Valida que el PAGE_ID sea numérico
- Valida que el TOKEN empiece con "EA" y tenga longitud mínima
- Loguea solo la longitud y últimos 6 caracteres del token

### 3. Corrección del Servicio de Facebook

En `server/services/facebookPublisher.js`:
- Cambió de `application/json` a `application/x-www-form-urlencoded`
- Usa `URLSearchParams` para formatear correctamente el body
- Implementa logs mejorados con tiempos de respuesta
- Usa la nueva utilidad de configuración

### 4. Script de Prueba

Creado `server/utils/test-facebook-config.js` para verificar:
- Configuración válida
- Acceso a la página
- Permisos del token

## Cómo Probar

### 1. Verificar Configuración
```bash
node server/utils/test-facebook-config.js
```

### 2. Prueba Manual con cURL
```bash
# Obtener info de la página
curl "https://graph.facebook.com/v23.0/TU_PAGE_ID?fields=id,name&access_token=TU_TOKEN"

# Publicar prueba
curl -X POST "https://graph.facebook.com/v23.0/TU_PAGE_ID/feed" \
  -d "message=Prueba desde LevántateCuba" \
  -d "access_token=TU_TOKEN"
```

### 3. Probar desde el Panel
1. Ir al panel de administración
2. Seleccionar una noticia publicada
3. Click en "Compartir en Facebook"
4. Verificar que el semáforo pase de ámbar a verde

## Solución de Problemas

### Error 190
- Verifica que el token no tenga espacios ni saltos de línea
- Asegúrate de usar el Page Access Token (EAAG...), no el App Token
- El token debe ser del System User con permisos pages_manage_posts

### Error 100/33
- Verifica que FACEBOOK_PAGE_ID sea el ID de la página, NO el App ID
- El ID debe ser solo números (ej: 72464230740421)

### Error 200
- El token necesita permisos: pages_manage_posts, pages_read_engagement
- Verifica en Meta Business Suite que el System User tenga acceso a la página

## Logs Esperados

Cuando funcione correctamente verás:
```
[FB Config] PAGE_ID: 123456789012345
[FB Config] TOKEN LEN: 183 TAIL: abc123
[FB Config] VERSION: v23.0
[Social Routes] Publicando noticia 68ae533659ce43abb4b8e49e en Facebook
[FB Publisher] Publicando en página 123456789012345
[FB Publisher] POST /feed → 200 245ms
[FB Publisher] ✅ Publicado exitosamente: 123456789012345_987654321
[FB Publisher] permalink: https://www.facebook.com/LevantateCuba/posts/987654321
```

## Archivos Modificados

1. `server/utils/getFacebookConfig.js` - Nueva utilidad de configuración
2. `server/services/facebookPublisher.js` - Servicio corregido
3. `server/utils/test-facebook-config.js` - Script de prueba
4. `docs/FIX_FACEBOOK_ERROR_190.md` - Esta documentación
