# Generador de Borradores desde URL - Documentación

## 📋 Descripción

Sistema para generar borradores de noticias (solo texto) a partir de URLs, reutilizando el pipeline completo del Redactor IA.

## 🏗️ Arquitectura

### Backend

#### 1. **Servicio de Extracción de URLs** (`server/redactor_ia/services/urlExtractor.js`)
- Valida URLs contra allowlist de fuentes confiables
- Extrae hostname de URLs para validación
- Usa `jsdom` + `@mozilla/readability` para extraer contenido limpio
- Retorna: `{ title, content, excerpt, html, url, length }`

**Funciones principales:**
- `extractHostname(url)`: Normaliza URL a hostname
- `isUrlAllowed(url, allowlist)`: Valida contra lista blanca
- `extractArticleContent(url)`: Extrae contenido completo del artículo

#### 2. **Servicio de Generación** (`server/redactor_ia/services/urlDraftGenerator.js`)
- Reutiliza funciones del `redactor.js` existente
- Usa el mismo modelo LLM configurado (Claude/GPT)
- Construye prompts específicos para reescritura
- Convierte Markdown generado a HTML con `marked`
- Deriva categoría automáticamente si falta

**Función principal:**
- `generateDraftFromUrl(url)`: Retorna `{ titulo, categoria, bajada, contenidoHtml, etiquetas, urlOrigen }`

#### 3. **Endpoint API** (`server/redactor_ia/routes/redactorIA.js`)
```
POST /api/redactor-ia/generar-desde-url
Body: { url: string }
Headers: Authorization: Bearer <token>
```

**Flujo:**
1. Valida formato de URL
2. Obtiene allowlist de configuración del Redactor IA
3. Valida URL contra allowlist
4. Extrae contenido con `urlExtractor`
5. Genera borrador con `urlDraftGenerator`
6. Retorna JSON con campos de texto

**Rate limiting:** 20 requests/minuto (reutiliza `generateLimiter`)

**Permisos:** Solo admins y editores

### Frontend

#### 1. **Componente URLDraftGenerator** (`src/admin_dashboard/components/URLDraftGenerator.jsx`)
- Input para URL + botón "Generar"
- Estados: loading, error
- Manejo de Enter key para generar
- Mensajes de estado y ayuda visual
- Callback `onDraftGenerated(draft)` al padre

**Props:**
- `onDraftGenerated`: Callback que recibe el borrador generado

#### 2. **Integración en NewsForm** (`src/admin_dashboard/components/NewsForm.jsx`)
- Componente insertado después del checkbox "destacada"
- Handler `handleDraftGenerated()` actualiza solo campos de texto
- NO modifica campos de imagen (principal ni opcional)
- Respeta contenido existente si el usuario ya escribió algo

## 🔒 Seguridad

### Validación de URLs
- **Allowlist estricta**: Solo dominios configurados en el Redactor IA
- **Fallback a lista confiable**: Si no hay allowlist, usa lista por defecto de 14 fuentes reconocidas
- **Normalización de hostnames**: Elimina esquemas, rutas, subdominios para comparación

### Fuentes por defecto (si allowlist vacía):
- bbc.com, reuters.com, apnews.com, nytimes.com
- theguardian.com, washingtonpost.com, cnn.com
- elpais.com, techcrunch.com, wired.com, theverge.com
- arstechnica.com, axios.com, bloomberg.com

### Rate Limiting
- Mismo límite que generación de borradores: 20/min
- Previene abuso y sobrecarga del LLM

## 💰 Costos

**Por generación:**
- Extracción de URL: Gratis
- LLM (Claude Sonnet): ~$0.003 por 1000 tokens
- Contenido típico: ~5000-8000 tokens = **$0.02-0.04 USD**

**NO incluye:**
- Generación de imágenes (deshabilitada intencionalmente)
- Solo texto

## 🎨 UX

### Flujo de Usuario
1. Usuario pega URL en input arriba del editor
2. Presiona "Generar" o Enter
3. Botón se deshabilita, muestra "Generando..."
4. Mensaje: "Extrayendo contenido... 10-20 segundos"
5. Si éxito:
   - Campos de texto se rellenan automáticamente
   - Input de URL se limpia
   - Usuario puede editar libremente
6. Si error:
   - Mensaje de error descriptivo en rojo
   - Usuario puede corregir URL e intentar de nuevo

### Comportamiento de Campos
- **Título**: Sobrescribe si está vacío, mantiene si usuario ya escribió
- **Categoría**: Sobrescribe con categoría derivada
- **Contenido**: Sobrescribe con HTML generado (⚠️ perderá cambios previos)
- **Imágenes**: NO se tocan (ni principal ni opcional)

### Mejora futura sugerida
Añadir confirmación si el usuario ya tiene contenido escrito:
```javascript
if (prev.contenido && prev.contenido.length > 100) {
  if (!confirm('¿Sobrescribir contenido existente?')) {
    return prev; // Cancelar
  }
}
```

## 🔧 Configuración

### Variables de entorno requeridas
```env
# Ya existentes para Redactor IA
ANTHROPIC_API_KEY=sk-ant-...
# O
OPENAI_API_KEY=sk-...
```

### Configuración del Redactor IA
El sistema usa la configuración existente:
- `aiModel`: Modelo LLM a usar
- `sourceAllowlist`: Lista de fuentes permitidas
- `defaultTenant`: Tenant por defecto

## 📦 Instalación

### 1. Instalar dependencias
```bash
npm install jsdom @mozilla/readability
```

### 2. Archivos creados
**Backend:**
- `server/redactor_ia/services/urlExtractor.js`
- `server/redactor_ia/services/urlDraftGenerator.js`
- `server/redactor_ia/routes/redactorIA.js` (modificado)

**Frontend:**
- `src/admin_dashboard/components/URLDraftGenerator.jsx`
- `src/admin_dashboard/components/NewsForm.jsx` (modificado)

### 3. Reiniciar servidor
```bash
npm run dev
```

## 🧪 Pruebas

### Test manual
1. Ir a `/admin/news`
2. En formulario de crear noticia, ver bloque "Generar desde URL"
3. Pegar URL de artículo (ej: https://bbc.com/news/technology...)
4. Presionar "Generar"
5. Esperar 10-20 segundos
6. Verificar que título, categoría y contenido se rellenan
7. Verificar que imágenes NO se modifican

### Test de validación
- **URL inválida**: Debe mostrar error "URL inválida"
- **URL no permitida**: Debe mostrar "Esta fuente no está en la lista de permitidas"
- **Sin allowlist**: Debe permitir solo fuentes por defecto
- **Contenido muy corto**: Debe mostrar error "contenido demasiado corto"

## 🐛 Troubleshooting

### Error: "Cannot find module 'jsdom'"
**Solución:** `npm install jsdom @mozilla/readability`

### Error: "Esta fuente no está en la lista de permitidas"
**Solución:** 
1. Ir a `/admin/redactor-ia` → Configuración
2. Añadir dominio a "Source Allowlist"
3. Guardar y reintentar

### Error: "No se pudo extraer contenido legible"
**Causas posibles:**
- Página requiere JavaScript (SPA)
- Contenido detrás de paywall
- HTML mal formado
- Anti-scraping activo

**Solución:** Usar URLs de fuentes conocidas (BBC, Reuters, etc.)

### Contenido generado muy corto
**Causa:** Artículo original muy corto o mal extraído
**Solución:** Verificar que la URL apunta a un artículo completo, no a una lista o página de categoría

## 🚀 Mejoras futuras

### Corto plazo
- [ ] Confirmación antes de sobrescribir contenido existente
- [ ] Preview del contenido extraído antes de generar
- [ ] Opción para incluir bajada/lead en el editor
- [ ] Indicador de progreso más detallado

### Mediano plazo
- [ ] Caché de contenido extraído (evitar re-fetch)
- [ ] Soporte para más extractores (Medium, Substack, etc.)
- [ ] Detección automática de idioma y traducción
- [ ] Extracción de imágenes del artículo original (opcional)

### Largo plazo
- [ ] Batch: generar múltiples borradores desde lista de URLs
- [ ] Integración con sistema de favoritos/bookmarks
- [ ] Análisis de plagio/similitud con artículos existentes

## 📝 Notas técnicas

### Reutilización de código
- **LLM calling**: Usa mismas funciones que `redactor.js`
- **Prompts**: Usa `buildSystemPrompt()` del sistema existente
- **Categorización**: Usa `deriveCategory()` de `categoryDeriver.js`
- **Markdown→HTML**: Usa `marked` ya instalado

### Diferencias con generación desde topics
| Aspecto | Desde Topics | Desde URL |
|---------|-------------|-----------|
| Fuente | NewsAPI/RSS | Extracción directa |
| Scoring | Impacto 0-100 | N/A |
| Fuentes múltiples | Sí (consensus) | No (1 URL) |
| Imágenes | Auto-generadas | NO (manual) |
| Verificación | verifications array | NO |
| Prompts | Principal+opcional | NO |

### Limitaciones conocidas
1. No funciona con SPAs (requieren JavaScript para renderizar)
2. No puede acceder a contenido detrás de paywall
3. No extrae imágenes originales (por diseño)
4. Requiere conexión a internet (no offline)
5. Depende de estructura HTML semántica

## 📊 Logs esperados

```
[URLExtractor] Extrayendo contenido desde: https://...
[URLExtractor] ✅ Extraído: Título del artículo (3542 chars)
[URLDraftGenerator] Generando borrador desde URL: https://...
[URLDraftGenerator] Llamando al LLM (claude-3-5-sonnet-20240620)...
[URLDraftGenerator] Respuesta LLM parseada: {titulo: 'Título...', categoria: 'Tecnología', contenidoLength: 4523, etiquetas: 3}
[URLDraftGenerator] Derivando categoría automáticamente...
[URLDraftGenerator] ✅ Borrador generado: Título (4987 chars HTML)
[API] Generando borrador desde URL: https://...
```

## ✅ Checklist de implementación

- [x] Servicio de extracción de URLs
- [x] Servicio de generación de borradores
- [x] Endpoint API con validación
- [x] Componente React URLDraftGenerator
- [x] Integración en NewsForm
- [x] Rate limiting
- [x] Validación de allowlist
- [x] Manejo de errores
- [x] Documentación
- [ ] Instalar dependencias (jsdom, @mozilla/readability)
- [ ] Pruebas manuales
- [ ] Deploy a producción

## 🎯 Conclusión

Sistema completo, seguro y eficiente para generar borradores desde URLs, reutilizando todo el pipeline del Redactor IA. NO genera imágenes (por diseño), solo rellena campos de texto. Validación estricta de fuentes y rate limiting incluidos.
