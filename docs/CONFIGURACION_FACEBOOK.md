# Configuración de Facebook para Compartir Noticias

Este documento explica cómo configurar las variables de entorno necesarias para el flujo de "Compartir" en Facebook desde el panel administrativo de LevántateCuba.

## Variables de Entorno Requeridas

Agregar las siguientes variables a tu archivo `.env` en la raíz del proyecto servidor:

```env
# === CONFIGURACIÓN GENERAL ===
PUBLIC_ORIGIN=https://levantatecuba.com

# === FACEBOOK GRAPH API ===
FB_PAGE_ID=XXXXXXXXXXXX
FB_PAGE_ACCESS_TOKEN=EAAXXX...
FB_GRAPH_VERSION=v21.0
```

## Cómo Obtener el Token de Página de Facebook

### Paso 1: Crear una App de Facebook
1. Ve a [Facebook for Developers](https://developers.facebook.com/)
2. Crea una nueva app o usa una existente
3. Agrega el producto "Facebook Login for Business"

### Paso 2: Obtener Token de Usuario
1. Ve a [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Selecciona tu app
3. Genera un token de usuario con los permisos:
   - `pages_manage_posts`
   - `pages_read_engagement`

### Paso 3: Obtener Token de Página
1. Usa el token de usuario para obtener el ID de tu página:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?access_token=USER_TOKEN
   ```
2. En la respuesta, encontrarás tu página con su `id` y `access_token`
3. El `access_token` de la página es lo que necesitas para `FB_PAGE_ACCESS_TOKEN`

### Paso 4: Obtener Token de Larga Duración
Para que el token no expire, conviértelo a uno de larga duración:
```
GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
```

## Variables Explicadas

- **PUBLIC_ORIGIN**: URL base de tu sitio web (sin slash final)
- **FB_PAGE_ID**: ID numérico de tu página de Facebook
- **FB_PAGE_ACCESS_TOKEN**: Token de acceso de página con permisos para publicar
- **FB_GRAPH_VERSION**: Versión de la API de Facebook Graph (opcional, por defecto v21.0)

## Ejemplo de Archivo .env

```env
# === CONFIGURACIÓN GENERAL ===
PUBLIC_ORIGIN=https://levantatecuba.com

# === FACEBOOK GRAPH API ===
FB_PAGE_ID=123456789012345
FB_PAGE_ACCESS_TOKEN=EAABsbCS1234ZCgBAIzIZC...
FB_GRAPH_VERSION=v21.0

# === OTRAS VARIABLES EXISTENTES ===
JWT_SECRET=tu_jwt_secret
MONGODB_URI=mongodb://localhost:27017/levantatecuba
```

## Permisos Necesarios

El token de página debe tener los siguientes permisos:
- `pages_manage_posts`: Para publicar en la página
- `pages_read_engagement`: Para leer estadísticas (opcional)

## URLs de Compartido

El sistema generará URLs con parámetros UTM para analytics:

### WhatsApp
```
https://levantatecuba.com/noticias/[ID]?utm_source=whatsapp&utm_medium=share_button&utm_campaign=noticias
```

### Facebook
```
https://levantatecuba.com/noticias/[ID]?utm_source=facebook&utm_medium=share_button&utm_campaign=noticias
```

## Errores Comunes

### 400: "Configuración incompleta"
- Verificar que todas las variables estén definidas en `.env`
- Reiniciar el servidor después de agregar variables

### Error de Facebook: "Invalid access token"
- Token expirado: generar nuevo token de larga duración
- Permisos insuficientes: verificar que el token tenga `pages_manage_posts`

### Error de Facebook: "Application request limit reached"
- Has excedido el límite de rate de la API
- Esperar o usar un token de app diferente

## Testing

Para probar la configuración, puedes usar curl:

```bash
# Probar publicación en página
curl -X POST "https://graph.facebook.com/v21.0/PAGE_ID/feed" \
  -F "message=Prueba de publicación" \
  -F "access_token=PAGE_TOKEN"
```

## Seguridad

- **NUNCA** expongas el `FB_PAGE_ACCESS_TOKEN` al cliente
- Mantén las variables de entorno fuera del control de versiones
- Usa tokens de larga duración para producción
- Considera usar variables de entorno específicas por ambiente (dev/staging/prod)
