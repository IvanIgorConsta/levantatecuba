# Sistema IIF (Image Instruction Format)

## Descripción General

El sistema IIF es una arquitectura profesional de generación de imágenes contextualizadas que reemplaza el flujo de prompts libres por un sistema estructurado y confiable. Garantiza:

- ✅ Imágenes contextualizadas según país + tema
- ✅ Sin mezclas visuales incorrectas
- ✅ Sin banderas equivocadas
- ✅ Estilo cómic editorial consistente
- ✅ Negative prompts dinámicos según contexto

---

## Arquitectura

### Módulos Principales

#### 1. **Country Profiles** (`countryProfiles*.js`)
Perfiles visuales de ~48 países con:
- `city_style`: Estilo urbano característico
- `architecture`: Arquitectura predominante
- `climate`: Clima típico
- `people_style`: Características demográficas visuales
- `environment`: Ambiente y entorno natural
- `colors`: Paleta de colores característica
- `flags_allowed`: Banderas permitidas en el contexto
- `flags_forbidden`: Banderas explícitamente prohibidas
- `skyline_forbidden`: Skylines prohibidos

**Países incluidos:**
- **América Latina:** Cuba, Venezuela, México, Colombia, Argentina, Chile, Perú, Ecuador, Bolivia, Uruguay, Paraguay
- **Caribe:** República Dominicana, Haití, Puerto Rico
- **América Central:** Costa Rica, Panamá, Honduras, Guatemala, El Salvador, Nicaragua
- **Europa:** España, Francia, Reino Unido, Alemania, Italia, Ucrania, Rusia, Polonia, Países Bajos, Suecia, Noruega
- **Asia:** Japón, China, Corea del Sur, Corea del Norte, India
- **Medio Oriente:** Israel, Palestina, Irán, Arabia Saudita, Turquía, Siria
- **África:** Egipto, Marruecos, Sudáfrica, Nigeria, Kenia
- **América del Norte:** Estados Unidos, Canadá

#### 2. **Theme Profiles** (`themeProfiles.js`)
Perfiles temáticos por tipo de noticia:
- `política`
- `protesta`
- `crisis_social`
- `economía`
- `diplomacia`
- `desastre_natural`
- `conflicto_bélico`
- `justicia`
- `derechos_humanos`
- `educación`
- `salud`
- `tecnología`
- `cultura`
- `deportes`
- `medio_ambiente`

Cada perfil define:
- `scene_type`: Tipo de escena visual
- `emotion`: Emoción/tono de la imagen
- `elements`: Elementos visuales a incluir
- `avoid`: Elementos a evitar
- `composition`: Estilo de composición
- `lighting`: Tipo de iluminación

#### 3. **Image Instruction Builder** (`imageInstructionBuilder.js`)
Construye el bloque IIF estructurado:
```javascript
{
  country: 'Cuba',
  country_code: 'CU',
  region: 'Caribe',
  city_style: '...',
  architecture: '...',
  climate: '...',
  people_style: '...',
  environment: '...',
  colors: '...',
  flags_allowed: [...],
  flags_forbidden: [...],
  skyline_forbidden: [...],
  scene_type: 'press_conference',
  emotion: '...',
  theme_elements: '...',
  composition: '...',
  lighting: '...',
  style: 'comic_editorial',
  avoid: [...],
  news_context: {...}
}
```

#### 4. **IIF Converter** (`iifConverter.js`)
Convierte el IIF a prompt final limpio:
- Ensambla descripción de escena
- Integra ambiente geográfico/cultural
- Aplica estilo artístico
- Construye negative prompt dinámico
- Valida longitud y coherencia

---

## Flujo de Generación

```
1. Entrada: Draft con {title, summary, content, tags, category}
   ↓
2. Detección de país (detectCountry)
   ↓
3. Selección de perfil de país (getCountryProfile)
   ↓
4. Detección de tema (detectThemeFromContent o getThemeProfile)
   ↓
5. Construcción de IIF (buildImageInstructionFormat)
   ↓
6. Conversión a prompt (convertIIFtoPrompt)
   ↓
7. Negative prompt dinámico (buildDynamicNegative)
   ↓
8. Salida: {prompt, negative, metadata}
```

---

## Integración con Pipeline Existente

El sistema IIF está integrado en `buildImagePromptFromDraft`:

```javascript
// Sistema IIF (activo por defecto)
const useIIF = process.env.IMG_USE_IIF !== 'false';

if (useIIF) {
  // 1. Construir IIF
  const iif = buildImageInstructionFormat({ title, summary, content, tags, category, sources });
  
  // 2. Convertir a prompt
  const iifResult = convertIIFtoPrompt(iif);
  
  // 3. Retornar en formato legacy para compatibilidad
  return convertIIFtoLegacyFormat(iif);
}

// Fallback a sistema legacy si IIF falla
```

---

## Configuración

### Variables de Entorno

```bash
# Habilitar/deshabilitar sistema IIF
IMG_USE_IIF=true  # Default: true

# Sistema legacy sigue disponible como fallback
```

---

## Ventajas del Sistema IIF

### 1. **Coherencia Visual**
- Arquitectura correcta según país
- Paleta de colores apropiada
- Clima y ambiente consistentes

### 2. **Restricciones Inteligentes**
- Banderas prohibidas automáticamente
- Skylines incorrectos bloqueados
- Arquitectura incompatible eliminada

### 3. **Negative Prompt Dinámico**
```javascript
// Construido automáticamente según país y tema
const negative = [
  'text, letters, logos, watermarks',
  'bandera estadounidense', // Si país !== US
  'Manhattan skyline',       // Si país !== US
  'corporate boardroom',     // Si tema !== economía
  ...
].join(', ');
```

### 4. **Temas Contextualizados**
- Protesta → multitudes, carteles, tensión
- Desastre natural → aftermath, rescate, clima extremo
- Diplomacia → formal, banderas contextuales, negociación
- Conflicto bélico → tensión, soldados genéricos sin insignias

### 5. **Fallback Robusto**
- Si IIF falla → sistema legacy automático
- Si país no encontrado → perfil global
- Si tema no encontrado → perfil genérico

---

## Ejemplos

### Ejemplo 1: Noticia política en Cuba

**Entrada:**
```javascript
{
  title: 'Gobierno cubano anuncia nuevas medidas económicas',
  summary: 'El presidente anuncia reformas en La Habana',
  category: 'política',
  country: 'Cuba' // detectado automáticamente
}
```

**IIF Generado:**
```javascript
{
  country: 'Cuba',
  city_style: 'Ciudad caribeña colonial con edificios bajos coloridos',
  architecture: 'Colonial española, art déco tropical, arquitectura soviética',
  colors: 'Azul turquesa, amarillo, rosa coral, verde lima',
  flags_allowed: ['bandera cubana (azul, blanco, rojo con estrella)'],
  flags_forbidden: ['bandera estadounidense', 'bandera china', 'bandera rusa'],
  scene_type: 'press_conference',
  emotion: 'seriedad institucional, tensión política'
}
```

**Prompt Final:**
```
Gobierno cubano anuncia nuevas medidas económicas. Emoción: seriedad institucional, tensión política. 
Elementos: micrófonos, podio, banderas de contexto, periodistas, funcionarios genéricos. 
Ilustración editorial a todo color, estilo cómic/novela gráfica moderna. 
Estilo urbano: Ciudad caribeña colonial con edificios bajos coloridos. 
Arquitectura: Colonial española, art déco tropical. Paleta de colores: Azul turquesa, amarillo, rosa coral. 
Composición: formal, centrado. Iluminación: iluminación institucional.
```

**Negative:**
```
text, letters, logos, watermarks, readable signage, bandera estadounidense flag, bandera china flag, 
bandera rusa flag, Manhattan skyline, Miami skyline, Moscú skyline, retratos reconocibles, 
celebraciones, escenas corporativas, corporate boardroom, corporate office
```

### Ejemplo 2: Protesta en Venezuela

**Entrada:**
```javascript
{
  title: 'Miles marchan en Caracas exigiendo cambios',
  summary: 'Ciudadanos protestan en las calles',
  category: 'protesta',
  country: 'Venezuela'
}
```

**IIF:**
```javascript
{
  country: 'Venezuela',
  city_style: 'Ciudad caribeña-andina con torres de apartamentos, barrios en colinas',
  scene_type: 'political_protest',
  emotion: 'tensión social, demanda, inconformidad',
  flags_allowed: ['bandera venezolana (amarillo, azul, rojo con estrellas)'],
  flags_forbidden: ['bandera colombiana', 'bandera cubana']
}
```

---

## Testing

### Verificar país detectado:
```javascript
const { detectCountry } = require('../utils/contextBuilder');
const result = detectCountry({ title: 'Noticia en Cuba', summary: '', tags: [] });
console.log(result.country); // 'Cuba'
```

### Verificar perfil de país:
```javascript
const { getCountryProfile } = require('./countryProfiles');
const profile = getCountryProfile('Cuba');
console.log(profile.flags_allowed);
```

### Verificar tema:
```javascript
const { detectThemeFromContent } = require('./themeProfiles');
const theme = detectThemeFromContent({ 
  title: 'Protesta en la capital', 
  summary: 'Miles marchan', 
  tags: ['protesta'], 
  category: '' 
});
console.log(theme.scene_type); // 'political_protest'
```

### Verificar IIF completo:
```javascript
const { buildImageInstructionFormat } = require('./imageInstructionBuilder');
const iif = buildImageInstructionFormat({
  title: 'Test',
  summary: 'Test summary',
  content: '',
  tags: [],
  category: 'política',
  sources: []
});
console.log(iif);
```

---

## Compatibilidad

✅ Compatible con `imageProvider.js` (DALL-E, internal)  
✅ Compatible con modo AUTO y MANUAL  
✅ Compatible con pipeline AUGMENTED y SIMPLE  
✅ Compatible con `titleOnly` mode (fallback a legacy)  
✅ Compatible con placeholder provider  

---

## Logging

El sistema IIF produce logs claros:

```
[IIF:Builder] 🎨 Construyendo Image Instruction Format
[IIF:Builder] country="Cuba" confidence=0.85
[IIF:Builder] theme="press_conference" emotion="seriedad institucional..."
[IIF:Builder] ✅ IIF construido y validado
[IIF:Converter] 📝 Convirtiendo IIF a prompt final
[IIF:Converter] ✅ Prompt generado: 850 chars
[IIF:Converter] negative_count=25 items
[ImagePromptV2:IIF] ✅ IIF prompt generado: 920 chars
[ImagePromptV2:IIF] negative: 25 items
```

---

## Mantenimiento

### Agregar nuevo país:
1. Editar archivo regional correspondiente (ej: `countryProfiles_latinamerica.js`)
2. Agregar perfil con todos los campos requeridos
3. No requiere reiniciar servidor (hot reload)

### Agregar nuevo tema:
1. Editar `themeProfiles.js`
2. Agregar tema con campos: `scene_type`, `emotion`, `elements`, `avoid`, `composition`, `lighting`

### Deshabilitar IIF temporalmente:
```bash
export IMG_USE_IIF=false
```
El sistema usará legacy automáticamente.

---

## Soporte

Para problemas o dudas sobre el sistema IIF:
1. Revisar logs: buscar `[IIF:*]` o `[ImagePromptV2:IIF]`
2. Verificar variable `IMG_USE_IIF`
3. Revisar fallback a legacy en caso de error
4. Contactar equipo de desarrollo

---

**Fecha de implementación:** Enero 2025  
**Versión:** 1.0.0  
**Estado:** Producción ✅
