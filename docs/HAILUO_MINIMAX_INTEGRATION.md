# Integración Hailuo (MiniMax Image API)

**Estado:** ✅ Funcional y listo para producción  
**Fecha:** Noviembre 2025  
**Proveedor:** Minimax - Hailuo AI Image Generation

---

## 📋 Resumen

El proveedor **Hailuo** está completamente integrado en el sistema del Redactor IA de LevántateCuba, permitiendo generar imágenes editoriales usando la API de Minimax.

## 🎯 Características

- ✅ Generación de imágenes 16:9 (1280x720)
- ✅ Optimización automática de prompts (`prompt_optimizer: true`)
- ✅ Integración completa con pipeline contextual
- ✅ Soporte para modo STRICT y AUGMENTED
- ✅ Fallback a placeholder en caso de error
- ✅ Metadata completa (provider, variant, context, keywords)
- ✅ Costos registrados: $0.03 USD por imagen

## 🔧 Configuración

### Variables de entorno requeridas

Agregar en `.env`:

```bash
# API Key de Minimax (REQUERIDO)
MINIMAX_API_KEY=tu_api_key_aquí

# Base URL (OPCIONAL - por defecto usa https://api.minimax.io)
MINIMAX_IMAGE_BASE_URL=https://api.minimax.io
```

### Activar en el panel de configuración

1. Ir a **Admin Dashboard** → **Herramientas** → **Redactor IA**
2. Pestaña **"Configuración"**
3. En **"Proveedor de imágenes"**, seleccionar: **Hailuo (MiniMax)**
4. Guardar cambios

## 🛠️ Arquitectura

### Backend

#### 1. Modelo de configuración

**Archivo:** `server/models/AiConfig.js`

```javascript
imageProvider: {
  type: String,
  default: 'dall-e-3',
  enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'stable-diffusion', 'midjourney']
}
```

#### 2. Función providerHailuo()

**Archivo:** `server/redactor_ia/services/imageProvider.js` (líneas 827-964)

**Flujo:**
1. Validación de `MINIMAX_API_KEY`
2. Validación STRICT_MODE (contexto mínimo)
3. Construcción del prompt (contextual o fallback)
4. Request POST a `/v1/image_generation` con:
   ```json
   {
     "model": "image-01",
     "prompt": "<prompt contextual>",
     "aspect_ratio": "16:9",
     "response_format": "url",
     "n": 1,
     "prompt_optimizer": true
   }
   ```
5. Descarga de imagen desde URL retornada
6. Conversión a buffer y base64
7. Retorno de metadata completa

**Parámetros de entrada:**
- `prompt` - Prompt contextual generado por el pipeline
- `title` - Título de la noticia
- `summary` - Bajada/resumen
- `category` - Categoría
- `draftId` - ID del borrador (para fallback placeholder)
- `tags` - Etiquetas
- `sources` - Fuentes
- `draft` - Objeto draft completo
- `_imageContext` - Contexto de tema pre-decidido

**Respuesta exitosa:**
```javascript
{
  ok: true,
  b64: "<base64_string>",
  buffer: Buffer,
  mimeType: 'image/png',
  provider: 'hailuo',
  attempt: 1,
  promptLevel: 'contextual',
  kind: 'ai',
  imageMeta: {
    provider: 'hailuo',
    variant: 'minimax',
    context: 'general',
    contextKeywords: [],
    country: null,
    economicLevel: 'neutral'
  }
}
```

#### 3. Registry en generateWithProvider()

**Archivo:** `server/redactor_ia/services/imageProvider.js` (líneas 1459-1472)

```javascript
switch (effectiveProvider) {
  case 'hailuo':
    console.log('[ImageProvider] AIProviderSelected=Hailuo (MiniMax)');
    return await providerHailuo({
      prompt,
      title,
      summary,
      category,
      draftId,
      topic,
      tags: draft?.etiquetas || [],
      sources: draft?.fuentes || topic?.fuentesTop || [],
      draft,
      _imageContext
    });
  // ... otros proveedores
}
```

#### 4. Costos

**Archivo:** `server/redactor_ia/services/statsService.js`

```javascript
const pricing = {
  'dall-e-3': 0.04,
  'dall-e-2': 0.02,
  'stable-diffusion': 0.01,
  'midjourney': 0.05,
  'hailuo': 0.03 // $0.03 por imagen 1280x720
};
```

### Frontend

**Archivo:** `src/admin_dashboard/redactor_ia/ConfiguracionIA.jsx` (línea 495)

```jsx
<select
  value={config.imageProvider}
  onChange={(e) => setConfig({ ...config, imageProvider: e.target.value })}
  className="..."
>
  <option value="dall-e-3">DALL-E 3 (OpenAI)</option>
  <option value="dall-e-2">DALL-E 2 (OpenAI)</option>
  <option value="hailuo">Hailuo (MiniMax)</option>
  <option value="stable-diffusion">Stable Diffusion</option>
  <option value="midjourney">Midjourney</option>
</select>
```

## 🧪 Testing

### Test de integración

Ejecutar:

```bash
cd server/redactor_ia
node test-hailuo.js
```

**Salida esperada:**
```
🧪 Test de integración Hailuo (MiniMax)

📋 Variables de entorno:
   MINIMAX_API_KEY: ✅ Configurada
   MINIMAX_IMAGE_BASE_URL: https://api.minimax.io (default)

🎨 Generando imagen de prueba...

✅ Generación exitosa

📊 Resultado:
   Provider: hailuo
   Kind: ai
   Buffer size: 523.4KB
   MIME type: image/png
   Attempt: 1
   Prompt level: contextual

🏷️  Metadata:
   Provider: hailuo
   Variant: minimax
   Context: general
   Keywords: [editorial, periodismo]

✅ TEST EXITOSO - Hailuo funcionando correctamente
```

### Test desde Redactor IA

1. Ir a **Redactor IA** → **Cola de Temas**
2. Seleccionar un tema
3. Click en **"Generar factual"** o **"Generar opinión"**
4. Marcar checkbox **"Generar imagen automáticamente"**
5. Verificar en logs del servidor:
   ```
   [ImageProvider] AIProviderSelected=Hailuo (MiniMax)
   [ImageProvider:Hailuo] Generando con MiniMax Image API
   [ImageProvider:Hailuo] prompt_len=245
   [ImageProvider:Hailuo] ✅ Imagen generada: https://...
   [ImageProvider:Hailuo] ✅ Imagen descargada y convertida a buffer
   ```

## 📊 Logs esperados

### Generación exitosa

```
[ImageProvider] Generando con proveedor: hailuo, mode: auto
[ImageProvider:Hailuo] Generando con MiniMax Image API
[ImageProvider:Hailuo] 🎛️ Modo: AUGMENTED
[ImageProvider:Hailuo] ✅ Contexto mínimo validado: title=true category=true tags=2
[ImageProvider:Hailuo] ✅ Usando prompt contextual desde builder
[ImageProvider:Hailuo] prompt_len=287
[ImageProvider:Hailuo] prompt_preview="Editorial illustration depicting modern journalism scene, professional news desk with digital displays and screens, reporter typing on laptop, clean composition..."
[ImageProvider:Hailuo] ✅ Imagen generada: https://file.minimax.chat/public/...
[ImageProvider:Hailuo] ✅ Imagen descargada y convertida a buffer (523.4KB)
[StatsService] Costo imagen: $0.03 (hailuo)
```

### Error por API Key no configurada

```
[ImageProvider:Hailuo] MINIMAX_API_KEY no configurada
[ImageProvider] result=error reason=missing_api_key
```

### Fallback a placeholder (contexto insuficiente en STRICT_MODE)

```
[ImageProvider:Hailuo] ⚠️ Contexto insuficiente: title=false category=false tags=0 summary=false
[ImageProvider:Hailuo] Retornando placeholder por falta de contexto mínimo
[ImageProvider:Internal] ⚠️ Placeholder generado
```

## 🔄 Flujo completo de generación

```
1. Usuario selecciona tema y genera borrador
   ↓
2. Redactor IA construye contexto de imagen (_imageContext)
   - Tema (theme): disaster, economic, political, general, tech, etc.
   - Keywords: palabras clave contextuales
   - País detectado (country)
   - Locale (es-CU, en-US, etc.)
   ↓
3. Redactor llama a generateWithProvider({ provider: 'hailuo', ... })
   ↓
4. generateWithProvider() rutea a providerHailuo()
   ↓
5. providerHailuo() valida contexto y construye prompt
   ↓
6. Request POST a Minimax API
   ↓
7. Minimax retorna URL de imagen generada
   ↓
8. Descarga y conversión a buffer
   ↓
9. Retorno con metadata completa
   ↓
10. Redactor guarda borrador con imagen en generatedImages.principal
```

## ⚠️ Limitaciones conocidas

1. **Solo formato PNG**: Minimax retorna imágenes en PNG (no JPEG/WebP)
2. **Aspect ratio fijo**: Solo 16:9 (1280x720) configurado
3. **Timeout**: 60 segundos máximo por request
4. **Sin reintentos**: Si falla, retorna error (no hay escalation como en DALL-E)

## 🚀 Ventajas vs DALL-E

- ✅ **Costo menor**: $0.03 vs $0.04 (25% más económico)
- ✅ **Optimización automática**: `prompt_optimizer: true` mejora prompts
- ✅ **Formato consistente**: Siempre 16:9 (ideal para web)
- ⚠️ **Sin reintentos**: DALL-E tiene fallback de 3 niveles

## 🔗 Referencias

- [Minimax API Docs](https://www.minimaxi.com/docs)
- [Pricing](https://www.minimaxi.com/pricing)
- [Archivo principal](../server/redactor_ia/services/imageProvider.js)
- [Test de integración](../server/redactor_ia/test-hailuo.js)

## 📝 Changelog

### 2025-11-15
- ✅ Integración completa de proveedor Hailuo
- ✅ Corrección de parámetros API (aspect_ratio, response_format, prompt_optimizer)
- ✅ Test de integración creado
- ✅ Documentación completa

---

**Estado final:** ✅ **FUNCIONAL Y LISTO PARA PRODUCCIÓN**
