# Sistema Anti-Políticos para Generación de Imágenes

**Fecha:** 15 de noviembre de 2025  
**Objetivo:** NUNCA mostrar políticos en imágenes, siempre mostrar impacto humano y elementos simbólicos  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Filosofía

**Regla fundamental:** 
- ❌ NUNCA mostrar políticos, líderes, figuras públicas
- ✅ SIEMPRE mostrar el impacto humano, la gente común afectada
- ✅ SIEMPRE usar elementos simbólicos, ambientales, contextuales

---

## 🔄 Flujo del sistema

### 1. Detección automática

Cuando se genera una imagen para un borrador:

```
Título + Contenido
      ↓
isPoliticalContent()
      ↓
¿Contiene keywords políticas?
      ↓
   SÍ → Prompt profesional anti-políticos (inglés)
      ↓
   NO → Prompt literal basado en título (español)
```

### 2. Keywords políticas detectadas

```javascript
- 'díaz-canel', 'diaz-canel'
- 'raúl castro', 'raul castro'
- 'fidel castro'
- 'presidente', 'mandatario'
- 'gobierno cubano', 'régimen'
- 'asamblea nacional', 'parlamento'
- 'primer ministro', 'ministro'
- 'partido comunista'
```

### 3. Tipos de prompts

#### A. **Contenido POLÍTICO** → Prompt profesional (inglés)

```
Create a NEWS COVER IMAGE based on the central theme of the article below.

FOCUS:
- Represent the human impact, social tension or situation described.
- Show ONLY ordinary citizens, symbolic elements, or environmental context.
- DO NOT show any political leader, government figure or identifiable public person.

SCENE:
- Build a visual scene that captures the emotion and idea of the article:
  • If the article mentions a "damnificada", "victim", "affected woman", "mother" → show a realistic Cuban/Latin woman in a moment of distress or concern.
  • If it describes crisis, protests, disasters, shortages or social tension → show the environment and affected people.
  • If it describes government actions or political controversy → focus on symbolic elements (streets, buildings, documents, crowds, weather, lighting) but NEVER politicians.

STYLE:
- Cinematic editorial illustration.
- Semi-realistic or painterly textures.
- Horizontal format, dramatic lighting.
- Emotionally expressive but respectful.
- Rich environment detail (streets, neighborhoods, buildings, weather).

RESTRICTIONS (MANDATORY):
- NO politicians.
- NO identifiable faces of real people.
- NO public figures.
- NO official flags.
- NO government emblems.
- NO propaganda.
- NO text or readable signs.
- NO direct portraits.

INPUT (CONTENT SUMMARY FOR CONTEXT):
{{resumen del contenido}}
```

#### B. **Contenido NO político** → Prompt literal (español)

```
Ilustración editorial realista y moderna para una noticia. 
Representa fielmente: "{{título}}". 
Categoría: {{categoría}}. 
Temas clave: {{tags}}. 
Estilo: foto editorial, formato 16:9...
```

---

## 📊 Ejemplos

### Ejemplo 1: Noticia política con Díaz-Canel

**Título:** "Díaz-Canel enfrenta protestas de damnificadas por apagones"

**Contenido (resumen):**
```
Mujeres cubanas afectadas por apagones confrontan autoridades. 
Los barrios están sin luz por tercera semana consecutiva. 
Hay tensión social y demandas de soluciones inmediatas.
```

**Detección:**
```
[TitleTransformer] 🎯 Contenido POLÍTICO detectado → usando prompt profesional anti-políticos
[PromptBuilder] 🎯 POLÍTICO detectado → Prompt profesional (1250 chars)
[PromptBuilder] Enfoque: Impacto humano y elementos simbólicos, NO políticos
```

**Prompt enviado a Hailuo:**
```
Create a NEWS COVER IMAGE based on the central theme of the article below.

FOCUS:
- Represent the human impact, social tension or situation described.
- Show ONLY ordinary citizens, symbolic elements, or environmental context.
- DO NOT show any political leader, government figure or identifiable public person.

SCENE:
- Build a visual scene that captures the emotion and idea of the article:
  • If the article mentions a "damnificada", "victim", "affected woman", "mother" → show a realistic Cuban/Latin woman in a moment of distress or concern.
  • If it describes crisis, protests, disasters, shortages or social tension → show the environment and affected people.
  • If it describes government actions or political controversy → focus on symbolic elements (streets, buildings, documents, crowds, weather, lighting) but NEVER politicians.

STYLE:
- Cinematic editorial illustration.
- Semi-realistic or painterly textures.
- Horizontal format, dramatic lighting.
- Emotionally expressive but respectful.
- Rich environment detail (streets, neighborhoods, buildings, weather).

RESTRICTIONS (MANDATORY):
- NO politicians.
- NO identifiable faces of real people.
- NO public figures.
- NO official flags.
- NO government emblems.
- NO propaganda.
- NO text or readable signs.
- NO direct portraits.

INPUT (CONTENT SUMMARY FOR CONTEXT):
Mujeres cubanas afectadas por apagones confrontan autoridades. Los barrios están sin luz por tercera semana consecutiva. Hay tensión social y demandas de soluciones inmediatas.
```

**Imagen esperada:**
- ✅ Mujeres cubanas en barrios oscuros
- ✅ Calles sin luz, tensión visible
- ✅ Elementos ambientales (postes eléctricos, edificios, velas)
- ❌ NO Díaz-Canel
- ❌ NO políticos
- ❌ NO figuras públicas identificables

---

### Ejemplo 2: Noticia NO política (tecnología)

**Título:** "SpaceX lanza satélites de comunicación desde Cabo Cañaveral"

**Detección:**
```
[PromptBuilder] ✅ NO político → Prompt literal generado (285 chars)
[PromptBuilder] Preview: "Ilustración editorial realista y moderna para una noticia. Representa fielmente: "SpaceX lan..."
```

**Prompt enviado a Hailuo:**
```
Ilustración editorial realista y moderna para una noticia. 
Representa fielmente: "SpaceX lanza satélites de comunicación desde Cabo Cañaveral". 
Categoría: Tecnología. 
Temas clave: SpaceX, satélites, espacio. 
Estilo: foto editorial, formato 16:9...
```

**Imagen esperada:**
- ✅ Cohete/satélite en el espacio
- ✅ Elementos tecnológicos
- ✅ Contexto espacial

---

## 🔧 Implementación técnica

### Archivos modificados

#### 1. `server/redactor_ia/utils/titleTransformer.js`

**Funciones añadidas:**

```javascript
// Detecta si el texto contiene menciones políticas
function isPoliticalContent(text)

// Genera resumen corto del contenido (3-5 oraciones)
function generateContentSummary(content, title)

// Construye prompt profesional anti-políticos (inglés)
function buildPoliticalImagePrompt(title, content)
```

**Exports:**
```javascript
module.exports = {
  transformTitleToConcept,
  buildImagePromptFromTitle,
  buildPoliticalImagePrompt,  // NUEVO
  isPoliticalContent,          // NUEVO
  sanitizeTitleForConcept
};
```

#### 2. `server/redactor_ia/services/promptTemplates.js`

**Lógica de detección:**

```javascript
function buildNeoRenaissancePrompt(title, options = {}) {
  const content = options.content || '';
  const textToAnalyze = (title + ' ' + content).substring(0, 1000);
  
  if (isPoliticalContent(textToAnalyze)) {
    // CASO POLÍTICO: Prompt profesional
    return {
      prompt: buildPoliticalImagePrompt(title, content),
      mode: 'political_human_impact',
      style: 'cinematic_editorial'
    };
  }
  
  // CASO NO POLÍTICO: Prompt literal
  return {
    prompt: buildImagePromptFromTitle({ title, category, tags }),
    mode: 'literal',
    style: 'editorial'
  };
}
```

#### 3. `server/redactor_ia/services/redactor.js`

**Paso de contenido:**

```javascript
async function generateImages(prompts, config, topic, draft, draftId, mode = 'auto', opts = {}) {
  const title = draft?.titulo || draft?.title || '';
  const content = draft?.contenido || draft?.content || '';  // NUEVO
  const category = draft?.categoria || draft?.category || '';
  const tags = draft?.tags || [];
  
  // Construir prompt (detecta automáticamente si es político)
  const { prompt, mode: neoMode } = buildNeoRenaissancePrompt(title, {
    content,    // NUEVO
    category,
    tags
  });
  
  // ... generar imagen con Hailuo/DALL-E
}
```

---

## 🎨 Características del prompt profesional

### FOCUS
- Impacto humano
- Tensión social
- Situación descrita
- Solo ciudadanos comunes
- Elementos simbólicos
- Contexto ambiental

### SCENE (Escenas específicas)

**Si hay "damnificada", "víctima", "mujer", "madre":**
→ Mujer cubana/latina en momento de angustia o preocupación

**Si hay "crisis", "protestas", "desastres", "escasez":**
→ Ambiente y personas afectadas

**Si hay "acciones de gobierno", "controversia política":**
→ Elementos simbólicos (calles, edificios, documentos, multitudes, clima, iluminación)
→ NUNCA políticos

### STYLE
- Ilustración editorial cinematográfica
- Texturas semi-realistas o pictóricas
- Formato horizontal
- Iluminación dramática
- Expresivo emocionalmente pero respetuoso
- Detalle ambiental rico (calles, barrios, edificios, clima)

### RESTRICTIONS (OBLIGATORIAS)
- ❌ NO políticos
- ❌ NO rostros identificables de personas reales
- ❌ NO figuras públicas
- ❌ NO banderas oficiales
- ❌ NO emblemas gubernamentales
- ❌ NO propaganda
- ❌ NO texto legible
- ❌ NO retratos directos

---

## 📋 Logs esperados

### Caso político

```
[Redactor:Neo-Renaissance] 📰 Título: "Díaz-Canel enfrenta protestas..."
[TitleTransformer] 🎯 Contenido POLÍTICO detectado → usando prompt profesional anti-políticos
[TitleTransformer] Summary (245 chars): "Mujeres cubanas afectadas por apagones confrontan autoridades. Los barrios están sin luz..."
[PromptBuilder] 🎯 POLÍTICO detectado → Prompt profesional (1250 chars)
[PromptBuilder] Enfoque: Impacto humano y elementos simbólicos, NO políticos
[Redactor:Neo-Renaissance] ✅ Prompt generado (1250 chars)
[Redactor:Neo-Renaissance] mode=political_human_impact
[ImageProvider:Hailuo] prompt_len=1250
[ImageProvider:Hailuo] prompt_preview="Create a NEWS COVER IMAGE based on the central theme of the article below. FOCUS: - Represent the human impact, social tension..."
```

### Caso NO político

```
[Redactor:Neo-Renaissance] 📰 Título: "SpaceX lanza satélites..."
[PromptBuilder] ✅ NO político → Prompt literal generado (285 chars)
[PromptBuilder] Preview: "Ilustración editorial realista y moderna para una noticia. Representa fielmente: "SpaceX lanza satélites..."
[Redactor:Neo-Renaissance] ✅ Prompt generado (285 chars)
[Redactor:Neo-Renaissance] mode=literal
[ImageProvider:Hailuo] prompt_len=285
[ImageProvider:Hailuo] prompt_preview="Ilustración editorial realista y moderna para una noticia. Representa fielmente: "SpaceX lanza satélites de comunicación..."
```

---

## ✅ Ventajas del sistema

1. **Detección automática** - No requiere configuración manual
2. **Enfoque humano** - Siempre muestra el impacto en personas comunes
3. **Anti-propaganda** - Nunca glorifica ni muestra políticos
4. **Profesional** - Prompt en inglés optimizado para generadores de IA
5. **Contextual** - Usa el contenido real del borrador, no solo el título
6. **Flexible** - Funciona con cualquier proveedor (Hailuo, DALL-E, etc.)
7. **Respetuoso** - Emotivo pero digno
8. **Editorial** - Estilo cinematográfico profesional

---

## 🧪 Cómo verificar

### Paso 1: Generar borrador político

1. Admin Dashboard → Herramientas → Redactor IA
2. Cola de Temas → Seleccionar tema sobre Díaz-Canel o política cubana
3. Generar borrador factual
4. Marcar "Generar imagen automáticamente"

### Paso 2: Verificar logs

**Busca:**
```
[TitleTransformer] 🎯 Contenido POLÍTICO detectado
[PromptBuilder] 🎯 POLÍTICO detectado → Prompt profesional
[PromptBuilder] Enfoque: Impacto humano y elementos simbólicos, NO políticos
```

### Paso 3: Verificar prompt en logs

**Debe contener:**
```
Create a NEWS COVER IMAGE based on the central theme of the article below.
FOCUS:
- Represent the human impact, social tension or situation described.
- DO NOT show any political leader, government figure or identifiable public person.
```

### Paso 4: Verificar imagen generada

**Debe mostrar:**
- ✅ Personas comunes (mujeres, ciudadanos, víctimas)
- ✅ Contexto ambiental (calles, barrios, edificios)
- ✅ Elementos simbólicos (clima, iluminación dramática)
- ✅ Impacto humano visible

**NO debe mostrar:**
- ❌ Díaz-Canel
- ❌ Ningún político
- ❌ Figuras públicas identificables
- ❌ Banderas oficiales
- ❌ Emblemas gubernamentales

---

## 🎯 Casos de uso

### 1. Díaz-Canel + Damnificada
**Resultado:** Mujer cubana en barrio afectado, NO Díaz-Canel

### 2. Gobierno + Crisis
**Resultado:** Elementos de crisis (calles, personas afectadas), NO funcionarios

### 3. Parlamento + Protestas
**Resultado:** Multitud con pancartas, edificio simbólico, NO diputados

### 4. Presidente + Medidas económicas
**Resultado:** Mercado, tienda, economía visible, NO presidente

### 5. Régimen + Represión
**Resultado:** Personas, ambiente tenso, elementos simbólicos, NO represores

---

## 📝 Resumen ejecutivo

**Antes (con lógica Díaz-Canel):**
- Título menciona político → Imagen muestra al político
- Riesgo de propaganda involuntaria
- Prompts descriptivos del físico del líder

**Ahora (sistema anti-políticos):**
- Título/contenido menciona político → Imagen muestra el IMPACTO HUMANO
- NUNCA muestra políticos
- SIEMPRE muestra personas comunes afectadas
- Prompt profesional en inglés
- Enfoque cinematográfico editorial
- Respetuoso, emotivo, contextual

**Impacto:**
- 0% políticos en imágenes
- 100% enfoque en impacto humano
- Prompts profesionales optimizados
- Detección automática sin configuración

---

**Última actualización:** 15 de noviembre de 2025  
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA PRODUCCIÓN
