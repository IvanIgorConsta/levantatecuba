# Debug y Solución de Errores - Facebook API

## Error #200: Permisos Insuficientes

### Causa del Error

El error `(#200) requires both pages_read_engagement and pages_manage_posts` ocurre cuando:

1. **Estás usando un User Token en lugar de un Page Token**
2. **El token no tiene los permisos necesarios**
3. **La app está en modo development y el usuario no tiene rol**

### Solución Implementada

El sistema ahora incluye:

1. **Detección automática del tipo de token** (User vs Page)
2. **Conversión automática de User Token a Page Token**
3. **Verificación de permisos antes de publicar**
4. **Logs detallados para debugging**

### Variables de Entorno Necesarias

```env
# Obligatorias
FACEBOOK_PAGE_ID=724642430740421
FACEBOOK_PAGE_TOKEN=EAAG...

# Opcionales pero recomendadas para debug completo
FACEBOOK_APP_ID=123456789
FACEBOOK_APP_SECRET=abc123...
FB_GRAPH_VERSION=v21.0
```

## Cómo Ejecutar las Pruebas

### 1. Script de Diagnóstico

```bash
cd server
node utils/test-facebook-api.js
```

Este script verificará:
- ✅ Configuración válida
- ✅ Tipo de token (User/Page)
- ✅ Permisos disponibles
- ✅ Acceso a la página
- ✅ Capacidad de publicación

### 2. Endpoint de Debug (desde el frontend)

```bash
GET /api/social/facebook/debug
```

Requiere autenticación de admin y devuelve:
```json
{
  "status": "ok",
  "config": {
    "status": "ok",
    "pageId": "724642430740421",
    "tokenValid": true
  },
  "app": {
    "mode": "development",
    "id": "123456789"
  },
  "warnings": ["En modo development, solo usuarios con rol en la app pueden publicar"]
}
```

## Obtener los Tokens Correctos

### Opción 1: Page Access Token Directo (Recomendado)

1. Ir a [Meta Business Suite](https://business.facebook.com)
2. Configuración → Integraciones de empresa → Tokens de acceso
3. Generar token para tu página con permisos:
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_show_list`
4. Usar este token como `FACEBOOK_PAGE_TOKEN`

### Opción 2: User Access Token (Fallback Automático)

1. Ir a [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Seleccionar tu app
3. Generar User Token con permisos:
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_show_list`
4. El sistema convertirá automáticamente a Page Token

## Flujo de Publicación

```mermaid
graph TD
    A[Cliente envía petición] --> B[Verificar token configurado]
    B --> C{¿Es Page Token?}
    C -->|Sí| D[Usar directamente]
    C -->|No| E[Es User Token]
    E --> F[Obtener Page Token via /me/accounts]
    F --> G{¿Token válido?}
    D --> G
    G -->|Sí| H[Verificar permisos]
    G -->|No| I[Error 401: Token inválido]
    H --> J{¿Tiene permisos?}
    J -->|Sí| K[Publicar en /{PAGE_ID}/feed]
    J -->|No| L[Error 400: Faltan permisos]
    K --> M{¿Publicación exitosa?}
    M -->|Sí| N[Retornar fbPostId y permalink]
    M -->|No| O{¿Error 200?}
    O -->|Sí| P[Retry con token fresco]
    O -->|No| Q[Retornar error específico]
```

## Logs del Sistema

El sistema ahora genera logs detallados:

```
[FB Config] PAGE_ID: 724642430740421
[FB Config] TOKEN LEN: 202 TAIL: 2AZDZD
[FB Token] Debug info: { isValid: true, type: "USER", isLikelyPageToken: false }
[FB Token] Token identificado como USER token, resolviendo Page Token...
[FB Resolver] ✅ Page Token obtenido para página: LevántateCuba
[FB Preflight] { pageId: "724642430740421", endpoint: "/{PAGE_ID}/feed", tokenOrigin: "USER", scopes: ["pages_manage_posts", "pages_read_engagement"] }
[FB Publisher] POST /{PAGE_ID}/feed → 200 1234ms
[FB Publisher] ✅ Publicado exitosamente: 724642430740421_987654321
```

## Solución de Problemas Comunes

### Error: "Token inválido o expirado"

**Síntomas:**
- Error 190
- Token que antes funcionaba ya no funciona

**Solución:**
1. Regenerar el token en Meta Business Suite
2. Verificar que no haya espacios o saltos de línea en el `.env`
3. Ejecutar el script de prueba para validar

### Error: "Permisos insuficientes"

**Síntomas:**
- Error 200
- Mensaje sobre `pages_manage_posts` o `pages_read_engagement`

**Solución:**
1. Verificar permisos del token con el script de prueba
2. Si es User Token, verificar que el usuario administre la página
3. Regenerar token con todos los permisos necesarios

### Error: "App en modo development"

**Síntomas:**
- Publicación falla solo para algunos usuarios
- Funciona para admins pero no para editores

**Solución:**
1. Añadir usuarios como testers en la app de Facebook
2. O cambiar la app a modo Live (requiere revisión de Facebook)

### Error: "Página no encontrada"

**Síntomas:**
- Error 100 o 33
- El PAGE_ID no es reconocido

**Solución:**
1. Verificar que el `FACEBOOK_PAGE_ID` sea correcto
2. Confirmar que el token tenga acceso a esa página
3. Usar el script de prueba para listar páginas disponibles

## Mejoras Implementadas

1. **Cache de Page Tokens** - Reduce llamadas a la API
2. **Retry automático** - Un reintento si falla con error 200
3. **Smoke tests** - Verificación rápida sin APP_ID/APP_SECRET
4. **Logs estructurados** - Fácil identificación de problemas
5. **Códigos de error mapeados** - Respuestas HTTP apropiadas

## Monitoreo Recomendado

1. **Logs de aplicación** - Buscar patrones de errores 200/190
2. **Métricas de éxito** - % de publicaciones exitosas
3. **Expiración de tokens** - Alertas antes de que expiren
4. **Modo de la app** - Verificar si cambia a development

## Contacto y Soporte

Si continúan los problemas después de seguir esta guía:

1. Verificar el [Facebook API Status](https://developers.facebook.com/status/)
2. Revisar los [Facebook API Docs](https://developers.facebook.com/docs/graph-api/)
3. Contactar soporte técnico con los logs del script de prueba
