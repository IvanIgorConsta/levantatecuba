# Estrategia Editorial: Estilo Cómic Editorial

## 📋 Resumen

Sistema con estilo cómic/novela gráfica editorial **PARA TODAS LAS NOTICIAS**:
- **Todas las noticias** → Estilo cómic/novela gráfica moderna (líneas marcadas, colores vivos)
- **Noticias políticas** → Políticos genéricos estilo caricatura editorial (sin personas reales específicas)
- **Otras noticias** → Escenas metafóricas con personajes y elementos simbólicos

⚠️ **Importante:** No se generan caricaturas de personas reales específicas (viola políticas de OpenAI)

---

## 🎯 Implementación Actual

### ✅ Archivos modificados

1. **`server/redactor_ia/services/redactor.js`**
   - Nuevas funciones: `isPoliticalOrPersonality()` y `buildComicEditorialPrompt()`
   - Bloque titleOnly reescrito con estilo cómic editorial forzado
   - Negativos actualizados: bloquean fotorealismo, no elementos visuales

2. **`server/redactor_ia/utils/sanitizeImagePrompt.js`**
   - Eliminada lógica de detección de dictadores específicos
   - Estilo cómic editorial aplicado SIEMPRE
   - Fallbacks actualizados con estilo cómic consistente

3. **`server/redactor_ia/services/imageProvider.js`**
   - `createNeutralPrompt()` - Usa cómic editorial
   - Modo RAW fallback - Usa cómic editorial

---

## 🔍 Detección de Contexto Político

La función `isPoliticalOrPersonality()` detecta si la noticia tiene contexto político o personalidades:

### Categorías políticas:
- `política`
- `socio político`
- `internacional`

### Roles políticos:
- `presidente`, `dictador`, `rey`, `reina`
- `líder`, `ministro`, `gobernador`
- `alcalde`, `canciller`, `senador`, `diputado`

### Patrón de nombres propios:
- Detecta patrones de nombres completos (Primera Segunda)
- Ejemplo: "Miguel Díaz-Canel", "Joe Biden", "Pedro Sánchez"

**Comportamiento:**
- Si detecta contexto político → "político genérico estilo caricatura editorial"
- Si no detecta → "escena metafórica con personajes simbólicos"
- **Nunca** menciona nombres reales específicos en el prompt

---

## 🎨 Estilo Aplicado

### **Estilo Cómic Editorial (TODAS las noticias)**

**Español:**
```
Ilustración editorial a todo color, estilo cómic / novela gráfica moderna.
Líneas de contorno marcadas, colores planos y vivos, sombreado simple.
Estética de caricatura editorial de periódico, NO foto realista, NO 3D.
Composición limpia tipo portada de noticia digital.

[Si es política:]
Escena con un político genérico estilo caricatura editorial,
sin parecerse exactamente a ninguna persona real ni a figuras públicas concretas,
con gesto expresivo y lenguaje corporal fuerte.
Puede haber banderas, micrófonos, público o escenario de discurso si encaja con la noticia.

[Si NO es política:]
Escena metafórica con personajes y elementos simbólicos
que representen el tema principal de la noticia.

Tema del titular: "[TÍTULO]".
```

**Inglés:**
```
Editorial illustration in full color, modern comic / graphic novel style.
Bold contour lines, flat vivid colors, simple shading.
Newspaper editorial cartoon aesthetic, NOT photorealistic, NOT 3D.
Clean composition like digital news cover.

[If political:]
Scene with a generic politician in editorial cartoon style,
without resembling any real person or specific public figure,
with expressive gesture and strong body language.
May include flags, microphones, audience or speech stage if it fits the news.

[If NOT political:]
Metaphorical scene with symbolic characters and elements
that represent the main theme of the news.

Headline theme: "[TITLE]".
```

**Características:**
- Líneas de contorno marcadas
- Colores planos y vivos
- Estética de caricatura editorial
- NO foto realista, NO 3D
- Políticos genéricos (sin personas reales específicas)
- Escenas metafóricas para temas no políticos

---

## 📋 Ejemplos de Uso

### ✅ Título: "Biden anuncia nuevas sanciones contra sectores comerciales"
**Detección:** Contexto político detectado ("Biden", patrón de nombre)  
**Prompt generado:** "...Escena con un político genérico estilo caricatura editorial, sin parecerse exactamente a ninguna persona real..."  
**Log:** `[Redactor:TitleOnly] 🎨 Estilo: CÓMIC EDITORIAL`

---

### ✅ Título: "Díaz-Canel arremete contra Cuba Decide por censo de presos políticos"
**Detección:** Contexto político detectado (patrón de nombre + categoría política)  
**Prompt generado:** "...Escena con un político genérico estilo caricatura editorial, sin parecerse exactamente a ninguna persona real..."  
**Log:** `[Redactor:TitleOnly] 🎨 Estilo: CÓMIC EDITORIAL`

⚠️ **Nota:** El prompt NO menciona "Díaz-Canel" específicamente (viola políticas OpenAI)

---

### ✅ Título: "El régimen cubano intensifica represión contra activistas"
**Detección:** Contexto político detectado (categoría "internacional" o "política")  
**Prompt generado:** "...Escena con un político genérico estilo caricatura editorial..."  
**Log:** `[Redactor:TitleOnly] 🎨 Estilo: CÓMIC EDITORIAL`

---

### ✅ Título: "Nueva tecnología promete revolucionar la agricultura"
**Detección:** NO es política  
**Prompt generado:** "...Escena metafórica con personajes y elementos simbólicos que representen el tema principal..."  
**Log:** `[Redactor:TitleOnly] 🎨 Estilo: CÓMIC EDITORIAL`

---

## 🔧 Aplicación en Pipeline AUGMENTED (opcional)

Si usas el pipeline AUGMENTED con contextos visuales enriquecidos, puedes aplicar la misma lógica:

### En `contextBuilder.js` o donde se construyen contextos:

```javascript
const { isDictatorMention } = require('../utils/sanitizeImagePrompt');

function buildContextPrompt({ title, context, economicLevel }) {
  const baseContext = CONTEXT_TAXONOMY[context];
  
  // Detectar si es noticia sobre dictador
  const isRepressive = isDictatorMention(title);
  
  let styleHint = '';
  if (isRepressive) {
    // Forzar caricatura satírica
    styleHint = 'Style: political satirical cartoon with caricatured faces, critical tone, contrasting colors.';
  } else {
    // Semi-realista editorial
    styleHint = 'Style: semi-realistic editorial illustration, modern magazine aesthetic, natural faces.';
  }
  
  return {
    prompt: `${baseContext.promptContext}. ${styleHint}`,
    negative: baseContext.negative,
    style: isRepressive ? 'satirical_cartoon' : 'editorial_semi_realistic'
  };
}
```

### En `promptTemplates.js`:

```javascript
const { isDictatorMention } = require('../utils/sanitizeImagePrompt');

function buildPrompt(theme, signals) {
  const { title } = signals;
  const isRepressive = isDictatorMention(title);
  
  let styleTemplate;
  if (isRepressive) {
    styleTemplate = {
      positive: 'Political satirical cartoon: caricatured faces, critical humor, bold colors, editorial magazine style.',
      negative: 'text, letters, logos, watermarks, readable signage'
    };
  } else {
    styleTemplate = {
      positive: 'Semi-realistic editorial illustration: natural human faces, soft lighting, modern magazine cover aesthetic.',
      negative: 'text, letters, logos, watermarks, readable signage'
    };
  }
  
  // Continuar con construcción normal del prompt...
  const prompt = `${title}. ${styleTemplate.positive}`;
  const negative = styleTemplate.negative;
  
  return { prompt, negative, locale, style, context };
}
```

---

## 🎯 Ventajas

### **Consistencia Editorial**
- Automático, sin intervención manual
- Reglas claras y predecibles
- Aplicado en todos los puntos de generación

### **Tono Crítico Apropiado**
- Caricatura satírica para dictadores = tono editorial crítico
- Semi-realista para noticias generales = profesionalismo

### **Identidad Visual Diferenciada**
- Noticias de dictadores se destacan visualmente
- Lectores identifican rápidamente el tono de la cobertura

### **Facilidad de Extensión**
- Agregar más figuras: solo añadir al array
- Cambiar estilos: modificar los prompts
- Sin romper código existente

---

## 🔄 Cómo Extender

### **Agregar más figuras represivas:**

```javascript
// En sanitizeImagePrompt.js
const repressiveFigures = [
  // ... lista actual ...
  'nuevo dictador',
  'nueva figura represiva'
];
```

### **Ajustar estilos:**

```javascript
// Cambiar intensidad de caricatura
if (isRepressive) {
  return `Caricatura MUY exagerada con rasgos amplificados...`; // Más satírico
  // O
  return `Caricatura sutil con ligera exageración...`; // Más moderado
}
```

### **Agregar categorías:**

```javascript
function isDictatorMention(title) {
  // ...código actual...
}

function isHumanRightsViolation(title) {
  const violations = ['represión', 'tortura', 'preso político', 'desaparecido'];
  return violations.some(term => title.toLowerCase().includes(term));
}

// Luego en sanitizeImagePrompt:
if (isDictatorMention(title) || isHumanRightsViolation(title)) {
  // Caricatura satírica
}
```

---

## 📝 Logs Esperados

### **Noticia general:**
```
[ImageSafety:Sanitizer] (NO-OP) Título sin cambios: "Biden anuncia nuevas sanciones..."
[ImageProvider:DALL-E] 🎯 Construyendo prompt DIRECTO desde título (sin filtros)
[Redactor:TitleOnly] prompt="Ilustración editorial digital de estilo semi-realista..."
```

### **Noticia con dictador:**
```
[ImageSafety:Sanitizer] (NO-OP) 🎭 CARICATURA SATÍRICA detectada: "Díaz-Canel arremete..."
[ImageProvider:DALL-E] 🎯 Construyendo prompt DIRECTO desde título (sin filtros)
[Redactor:TitleOnly] prompt="Caricatura política satírica de estilo editorial..."
```

---

## ✅ Estado Actual

- ✅ Detección automática implementada
- ✅ Estilos diferenciados por tipo de noticia
- ✅ Fallbacks consistentes
- ✅ Logs informativos
- ✅ Función exportada para uso en otros módulos
- ✅ Negativos mínimos (solo texto/logos)
- ✅ Sin restricciones visuales adicionales

---

## 🚀 Próximos Pasos (opcional)

1. **Monitorear resultados:** Ver cómo DALL-E interpreta los prompts de caricatura
2. **Ajustar intensidad:** Si las caricaturas son muy/poco exageradas
3. **Extender lista:** Agregar más figuras represivas según cobertura
4. **Métricas:** Trackear % de imágenes generadas en cada estilo
5. **A/B Testing:** Comparar engagement con/sin caricatura satírica

---

**Documentación generada:** 2025-01-09  
**Sistema:** LevántateCuba Redactor IA v2.0
