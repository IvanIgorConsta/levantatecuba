# Configuración del Sistema de Compartir en Facebook

## Descripción General

Este sistema permite publicar automáticamente las noticias del panel de administración en la página de Facebook de LevantateCuba usando la Graph API v23.0. El sistema maneja estados de publicación, reintentos y errores de forma robusta.

## Variables de Entorno Requeridas

Añadir al archivo `.env` del servidor:

```env
# Facebook Graph API
FACEBOOK_PAGE_ID=TU_PAGE_ID_NUMERICO
FACEBOOK_PAGE_TOKEN=TU_SYSTEM_USER_TOKEN
FB_GRAPH_VERSION=v23.0
```

### Cómo obtener estas variables:

1. **FACEBOOK_PAGE_ID**: 
   - Ve a tu página de Facebook
   - Click en "Información" o "About"
   - Busca "Page ID" al final de la página

2. **FACEBOOK_PAGE_TOKEN**:
   - Accede a [Meta Business Suite](https://business.facebook.com)
   - Ve a Configuración > Configuración del negocio > Usuarios > Usuarios del sistema
   - Crea o selecciona un System User
   - Genera un token con estos permisos:
     - `pages_manage_posts`
     - `pages_read_engagement`
     - `pages_manage_metadata`
     - `pages_read_user_content`
     - `pages_show_list`
     - `business_management`

## Flujo de Publicación

1. **Click en Compartir**: El botón muestra un ícono de compartir azul
2. **Estado "Sharing"**: Semáforo ámbar pulsante mientras se publica
3. **Éxito**: Semáforo verde + enlace para ver la publicación
4. **Error**: Semáforo rojo + botón de reintentar (ícono de refresh)

## Estados del Sistema

### Estados de Facebook (`facebook_status`):
- `not_shared`: No compartido (semáforo gris)
- `sharing`: Publicando (semáforo ámbar pulsante)
- `published`: Publicado exitosamente (semáforo verde)
- `error`: Error al publicar (semáforo rojo)

### Campos en la Base de Datos:
```javascript
{
  facebook_status: String,          // Estado actual
  facebook_post_id: String,         // ID del post en Facebook
  facebook_permalink_url: String,   // URL pública del post
  facebook_last_error: String,      // Último error (si aplica)
  facebook_attempt_count: Number,   // Contador de intentos
  facebook_published_at: Date,      // Fecha de publicación
  facebook_published_by: String     // ID del usuario que publicó
}
```

## Verificación con cURL

### Verificar el token:
```bash
curl -X GET "https://graph.facebook.com/v23.0/debug_token?input_token=TU_TOKEN&access_token=TU_TOKEN"
```

### Publicar manualmente:
```bash
curl -X POST "https://graph.facebook.com/v23.0/TU_PAGE_ID/feed" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Prueba de publicación",
    "link": "https://levantatecuba.com",
    "access_token": "TU_TOKEN"
  }'
```

## Manejo de Errores

### Códigos de Error Comunes:

| Código | Significado | Solución |
|--------|-------------|----------|
| 190 | Token inválido/expirado | Regenerar token en Meta Business Suite |
| 200 | Sin permisos | Verificar permisos del token |
| 100/33 | PAGE_ID inválido | Verificar el ID de la página |
| 4/17 | Límite de rate | Esperar antes de reintentar |
| 368 | Contenido bloqueado | Revisar políticas de contenido |

### Mensajes de Error al Usuario:

- **Token expirado**: "El token de Facebook ha expirado. Por favor, contacta al administrador para renovarlo."
- **Sin permisos**: "Sin permisos para publicar. Verifica la configuración en Meta Business Suite."
- **Límite alcanzado**: "Límite de publicaciones alcanzado. Intenta más tarde."

## Seguridad

### ⚠️ IMPORTANTE:
1. **NUNCA** exponer el token en el frontend
2. **NUNCA** commitear el `.env` con tokens reales
3. **Rotar tokens** cada 60 días por seguridad
4. **Monitorear** el uso del token en Meta Business Suite

### Rotación de Tokens:

1. Generar nuevo token en Meta Business Suite
2. Actualizar `.env` en el servidor
3. Reiniciar el servidor Node.js
4. Verificar funcionamiento con una publicación de prueba

## Logs y Debugging

Los logs del sistema incluyen:

```
[FB Publisher] Publicando en página 123456789
[FB Publisher] ✅ Publicado exitosamente: 123456789_987654321
[FB Publisher] Error 190: Invalid OAuth access token
```

Para debugging detallado, revisar:
- Logs del servidor Node.js
- Network tab del navegador
- Facebook Graph API Explorer

## Migración de Datos

Si tienes noticias con el formato antiguo (`share.fb`), el sistema es compatible y migrará automáticamente al nuevo formato cuando se publiquen.

## Troubleshooting

### "No se puede conectar con Facebook"
- Verificar conexión a internet del servidor
- Verificar que graph.facebook.com no esté bloqueado
- Revisar timeouts en el código (30s por defecto)

### "Publicación exitosa pero no aparece"
- Verificar en Meta Business Suite > Contenido publicado
- Puede haber un delay de 1-2 minutos
- Verificar que la página no tenga restricciones

### "Error 368: Contenido bloqueado"
- Revisar políticas de contenido de Facebook
- Evitar spam words o enlaces sospechosos
- Espaciar las publicaciones (no más de 10 por hora)

## Contacto y Soporte

Para problemas con tokens o permisos, contactar al administrador del Meta Business Suite de la organización.
