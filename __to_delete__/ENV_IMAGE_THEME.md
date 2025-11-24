# Variables de Entorno - ImageThemeEngine

Añadir estas variables al archivo `.env` del proyecto para controlar el nuevo pipeline de generación de imágenes.

## Feature Flags

```bash
# ========== Pipeline de Detección de Tema ==========

# Activar/desactivar nuevo pipeline de detección de tema
# Default: true (activado)
IMG_THEME_ENABLE=true

# Umbral de confianza para activar modo desastre (0-1)
# Default: 0.75
IMG_THEME_DISASTER_THRESHOLD=0.75

# Número mínimo de keywords requeridas para match de tema
# Default: 2
IMG_THEME_KEYWORDS_THRESHOLD=2

# Activar modo QA minimalista (solo anti-texto)
# Default: true (activado)
IMG_THEME_QA_MINIMAL=true

# ========== Modo Editorial (Imágenes Reales) ==========

# Activar búsqueda de imágenes editoriales reales para personas identificables
# Default: true (activado)
IMG_USE_EDITORIAL_COVER=true

# API Key de Bing Image Search (Azure Cognitive Services)
# Requerida para modo editorial - sin ella se usa stub (fallback a IA)
BING_IMAGE_SEARCH_API_KEY=your_key_here

# DESACTIVADO: Modo de referencia estilizada (no implementado por seguridad)
# Default: false
# IMG_ALLOW_STYLIZED_REFERENCE=false
```

## Descripción

### IMG_THEME_ENABLE
- `true`: Usa ImageThemeEngine para detección de tema limpia basada en contenido
- `false`: Usa modo legacy (heurísticas antiguas)

### IMG_THEME_DISASTER_THRESHOLD
- Umbral de confianza (0-1) para activar flag de desastre
- Valores más altos = más estricto (requiere más evidencia)
- Valores más bajos = más permisivo

### IMG_THEME_KEYWORDS_THRESHOLD
- Número mínimo de keywords de un tema que deben aparecer para match
- Default: 2 (requiere al menos 2 keywords de politics, economy, etc.)
- Para justice solo requiere 1 keyword (más específico)

### IMG_THEME_QA_MINIMAL
- `true`: Solo aplica negativos anti-texto (sin clima/interior/exterior)
- `false`: Aplica negativos completos legacy (anti-desastre, anti-warehouse, etc.)

### IMG_USE_EDITORIAL_COVER
- `true`: Intenta buscar imágenes editoriales reales cuando se detecta una persona identificable
- `false`: Siempre usa generación IA (sin búsqueda editorial)

**Flujo con modo editorial activado:**
1. Detecta persona principal con NER (ej: "Alejandro Gil")
2. Si `confidence >= 60%`, busca imagen editorial en Bing Image Search
3. Si encuentra imagen con licencia adecuada → descarga y usa (kind='editorial')
4. Si no encuentra → fallback a pipeline IA limpio

### BING_IMAGE_SEARCH_API_KEY
- API Key de Azure Cognitive Services - Bing Image Search v7
- **Requerida** para que el modo editorial funcione
- Sin API key: se registra en logs pero siempre cae a modo IA (stub)
- Cómo obtenerla: [Azure Portal](https://portal.azure.com) → Cognitive Services → Bing Search v7

**Filtros aplicados en búsqueda:**
- `license`: Public, Share, ShareCommercially (uso editorial permitido)
- `safeSearch`: Strict
- `aspect`: Wide (aprox. 3:2)
- `size`: Large (≥1024px)
- `freshness`: Month (preferir imágenes recientes)

## Ejemplo de Configuración Recomendada

```bash
# Configuración óptima para evitar imágenes fuera de contexto + modo editorial
IMG_THEME_ENABLE=true
IMG_THEME_DISASTER_THRESHOLD=0.75
IMG_THEME_KEYWORDS_THRESHOLD=2
IMG_THEME_QA_MINIMAL=true

# Modo editorial (imágenes reales para personas identificables)
IMG_USE_EDITORIAL_COVER=true
BING_IMAGE_SEARCH_API_KEY=your_azure_key_here
```

## Logging de Auditoría

Con estas variables activas, el sistema logueará:

### Caso 1: Modo Editorial (Persona Detectada + Hit Editorial)

```
[Redactor] Intentando modo editorial (persona real)...
[PersonDetector] Personaje detectado: "Alejandro Gil" (menciones: 3, inTags: true, confidence: 85)
[Redactor:Editorial] Persona detectada: "Alejandro Gil" (confidence=85)
[EditorialResolver] Buscando imagen editorial para: "Alejandro Gil"
[EditorialResolver] Query Bing: "Alejandro Gil exministro Cuba foto editorial"
[EditorialResolver] ✅ Editorial hit: diariodecuba.com (score=120)
[EditorialResolver] URL: https://...
[EditorialResolver] Imagen editorial descargada y guardada: /media/news/.../editorial_abc123.png
[Redactor:Editorial] ✅ Imagen editorial guardada: /media/news/.../editorial_abc123.png
[Redactor:Editorial] person="Alejandro Gil" editorialHit=true provider=diariodecuba.com license=Editorial fallback=none
```

### Caso 2: Modo Editorial (Persona Detectada, NO Hit → Fallback a IA)

```
[Redactor] Intentando modo editorial (persona real)...
[PersonDetector] Personaje detectado: "Alejandro Gil" (menciones: 3, inTags: true, confidence: 85)
[Redactor:Editorial] Persona detectada: "Alejandro Gil" (confidence=85)
[EditorialResolver] Buscando imagen editorial para: "Alejandro Gil"
[EditorialResolver] No results from Bing
[Redactor:Editorial] No se encontró imagen editorial para "Alejandro Gil" → fallback a IA
[Redactor:Editorial] person="Alejandro Gil" editorialHit=false fallback=ai
[ImageTheme] contextId=justice disaster=false confidence=0.95
[ImageTheme] keywords=[exministro, espionaje, delitos, cubano, alejandro]
[ImageTheme] reasons=[justice_keywords=4]
[ImageTheme] finalPrompt="Exministro cubano Alejandro Gil enfrenta cargos de espionaje..."
[ImageProvider:QA] Minimal mode active - only anti-text rules applied
```

### Caso 3: Sin Persona Detectada → IA Directa

```
[Redactor] Intentando modo editorial (persona real)...
[Redactor:Editorial] No se detectó persona con suficiente confianza → modo IA genérico
[ImageTheme] contextId=economy disaster=false confidence=0.84
[ImageTheme] keywords=[inflación, cuba, alcanza, niveles, récord]
[ImageTheme] reasons=[economy_keywords=3]
[ImageProvider:QA] Minimal mode active - only anti-text rules applied
```

## Override Manual (para pruebas)

Puedes probar temas específicos añadiendo query params al endpoint de generación de imagen:

```
?imageTheme=justice&forceDisaster=false
?imageTheme=disaster&forceDisaster=true
?imageTheme=economy
```
