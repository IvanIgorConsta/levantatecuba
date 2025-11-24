# Implementación del Sistema de Compartir en Facebook

## Resumen de Cambios

### Backend

#### 1. Nuevo Servicio: `server/services/facebookPublisher.js`
- Maneja la publicación en Facebook Graph API v23.0
- Mapeo inteligente de errores con mensajes amigables
- Funciones: `publishToFacebook()`, `getPostPermalink()`, `validateAccessToken()`
- Timeouts configurados para evitar bloqueos

#### 2. Modelo Actualizado: `server/models/News.js`
- Nuevos campos para el estado de Facebook:
  ```javascript
  facebook_status: "not_shared" | "sharing" | "published" | "error"
  facebook_post_id: String
  facebook_permalink_url: String
  facebook_last_error: String
  facebook_attempt_count: Number
  facebook_published_at: Date
  facebook_published_by: String
  ```
- Mantiene campos legacy (`share.fb`) para compatibilidad

#### 3. Nueva Ruta API: `POST /api/social/facebook/share`
- Endpoint: `/api/social/facebook/share`
- Body: `{ postId, message, link }`
- Respuestas:
  - 200 OK: `{ status: "ok", postId, fbPostId, permalink }`
  - Error: `{ status: "error", code, message }`
- Manejo robusto de estados y errores

#### 4. Rutas Eliminadas
- Removidos endpoints antiguos de `/api/news/:id/share`
- Eliminada funcionalidad de WhatsApp completamente

### Frontend

#### 1. AdminNews.jsx
- Nueva función `shareToFacebook()` que:
  - Construye mensaje con resumen + hashtags
  - Actualiza estado local en tiempo real
  - Maneja errores con mensajes específicos
  - Soporta reintentos automáticos

#### 2. NewsListPanel.jsx
- Semáforo de estado actualizado:
  - Gris: No compartido
  - Ámbar (pulsante): Publicando
  - Verde: Publicado
  - Rojo: Error
- Botón de compartir inteligente:
  - Deshabilitado si ya está publicado
  - Se convierte en "Reintentar" si hay error
  - Tooltips contextuales según estado
- Link directo a la publicación en Facebook cuando existe

### Migración de Datos

El sistema es **100% compatible** con datos existentes:
- Lee campos legacy (`share.fb.status`) si existen
- Escribe en ambos formatos para compatibilidad
- No requiere migración manual de base de datos

### Flujo de Usuario

1. **Click en Compartir** → Estado "sharing" (ámbar)
2. **Publicación exitosa** → Estado "published" (verde) + link
3. **Error** → Estado "error" (rojo) + botón reintentar
4. **Reintentar** → Vuelve a intentar la publicación

### Configuración Requerida

```env
FACEBOOK_PAGE_ID=123456789
FACEBOOK_PAGE_TOKEN=EAAxxxxx...
FB_GRAPH_VERSION=v23.0
```

### Seguridad

- Token nunca expuesto en frontend
- Validación de permisos (admin/editor)
- Logs estructurados sin información sensible
- Timeouts para evitar bloqueos

### Testing

Para probar la implementación:

1. Configurar variables de entorno
2. Crear/editar una noticia y publicarla
3. Click en el botón de compartir
4. Verificar que aparezca el semáforo verde
5. Click en el link para ver la publicación

### Rollback

Si necesitas volver al sistema anterior:
1. Restaurar `server/routes/news.js` con los endpoints antiguos
2. Restaurar `AdminNews.jsx` con `handleShare` original
3. El modelo de datos es compatible, no requiere cambios

---

**Nota**: Esta implementación mantiene exactamente el mismo diseño visual del panel, solo cambia la lógica interna para usar exclusivamente Facebook.
