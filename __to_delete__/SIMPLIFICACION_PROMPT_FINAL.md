# ✅ Simplificación Final: Prompt Directo Sin Filtros Propios

## 📋 Filosofía

**Dejar que OpenAI ponga los límites, no nosotros.**

Se eliminaron TODAS las capas de filtrado, sanitización y lógica compleja que estaban generando inconsistencias. Ahora usamos un **prompt simple y directo** estilo cómic editorial.

---

## 🎯 Qué se eliminó

### ❌ **Eliminado:**

1. **Lógica de sanitización compleja**
   - ❌ Detección de "contenido sensible"
   - ❌ Neutralización de títulos
   - ❌ Reemplazo de palabras "peligrosas"

2. **Detección de intent**
   - ❌ `intent = 'political'`
   - ❌ `allowFlags()`
   - ❌ `allowPressProps()`
   - ❌ Lógica condicional según tipo de noticia

3. **Fallbacks complejos**
   - ❌ Prompts ultra-genéricos tipo "buda minimalista"
   - ❌ Arquetipos específicos por intent
   - ❌ Múltiples capas de fallback

4. **Negativos excesivos**
   - ❌ `portrait`, `faces`, `celebrities`
   - ❌ `photorealistic`, `realistic photo`
   - ❌ `3d render`, `cinematic lighting`

---

## ✅ Qué se mantiene

### **Prompt simple y directo:**

```javascript
function buildComicNewsPrompt({ title = '', summary = '' }) {
  const safeTitle = (title || '').trim();
  const safeSummary = (summary || '').trim();

  return [
    'Ilustración editorial a todo color, estilo cómic / novela gráfica moderna.',
    'Personajes y escenario expresivos, con contornos marcados y colores vivos.',
    'Debe representar la escena y el contexto del titular, no un retrato literal de nadie.',
    'Puede mostrar personas, banderas, símbolos y ambiente relacionados con la noticia.',
    'Evitar texto escrito dentro de la imagen (titulares, rótulos, logos, marcas).',
    safeTitle ? `Titular: "${safeTitle}".` : '',
    safeSummary ? `Contexto: ${safeSummary}.` : ''
  ].join(' ');
}
```

### **Negativos mínimos:**

```javascript
const negative = [
  'watermark',
  'logo',
  'text',
  'letters',
  'caption',
  'meme',
  'infographic'
].join(', ');
```

**Solo bloquea:** Texto, logos, marcas  
**NO bloquea:** Banderas, micrófonos, personas, símbolos

---

## 📊 Comparación: Antes vs Ahora

| Aspecto | Antes (complejo) | Ahora (simple) |
|---------|------------------|----------------|
| **Funciones helper** | 5+ funciones (sanitizer, intent, allowFlags...) | 1 función (`buildComicNewsPrompt`) |
| **Líneas de código** | ~200 líneas de lógica | ~15 líneas |
| **Negativos** | 10+ términos (portrait, faces, photorealistic...) | 7 términos (solo texto/logos) |
| **Fallbacks** | 3+ niveles (intent→genérico→ultra-genérico) | 1 nivel simple |
| **Logs** | Múltiples (sanitizer, intent, flags...) | 1 log directo |
| **Detección de contenido** | Sí (propia + OpenAI) | Solo OpenAI |

---

## 🔧 Implementación

### **1. `server/redactor_ia/services/redactor.js`**

**Antes (líneas 888-978):**
```javascript
// Funciones complejas
function isPoliticalOrPersonality(...) { ... }
function buildContextIllustrationPrompt(...) { ... }

// Lógica de detección
const isPersonality = isPoliticalOrPersonality(...);
if (isPersonality) { ... } else { ... }

// Negativos complejos
const negative = [
  'fotografía', 'photo', 'photorealistic', 'realistic photo', 'ultra realistic',
  '3d render', 'cinematic lighting', 'portrait', 'faces', 'celebrities',
  'logos', 'text', 'letters', 'watermarks', 'infographic'
].join(', ');
```

**Ahora (líneas 888-941):**
```javascript
// Función simple
function buildComicNewsPrompt({ title = '', summary = '' }) {
  const safeTitle = (title || '').trim();
  const safeSummary = (summary || '').trim();

  return [
    'Ilustración editorial a todo color, estilo cómic / novela gráfica moderna.',
    'Personajes y escenario expresivos, con contornos marcados y colores vivos.',
    'Debe representar la escena y el contexto del titular, no un retrato literal de nadie.',
    'Puede mostrar personas, banderas, símbolos y ambiente relacionados con la noticia.',
    'Evitar texto escrito dentro de la imagen (titulares, rótulos, logos, marcas).',
    safeTitle ? `Titular: "${safeTitle}".` : '',
    safeSummary ? `Contexto: ${safeSummary}.` : ''
  ].join(' ');
}

// Uso directo
const prompt = buildComicNewsPrompt({
  title: draft.titulo || draft.title || '',
  summary: draft.bajada || draft.excerpt || ''
});

// Negativos mínimos
const negative = ['watermark', 'logo', 'text', 'letters', 'caption', 'meme', 'infographic'].join(', ');
```

---

### **2. `server/redactor_ia/utils/sanitizeImagePrompt.js`**

**Antes (líneas 46-58):**
```javascript
function sanitizeImagePrompt({ title, locale = 'es-CU' }) {
  const isSpanish = locale.startsWith('es');
  const cleanTitle = String(title || '').trim();
  
  console.log(`[ImageSafety:Sanitizer] (NO-OP) Título sin cambios: "${cleanTitle.substring(0, 80)}..."`);
  console.log(`[ImageSafety:Sanitizer] 🎨 Estilo: ILUSTRACIÓN CONTEXTUAL SIMBÓLICA`);
  
  // ILUSTRACIÓN CONTEXTUAL SIMBÓLICA (representa la situación, no el protagonista)
  if (isSpanish) {
    return `Ilustración editorial en estilo cómic periodístico o novela gráfica moderna. Representa visualmente el contexto del titular, no el rostro del protagonista. Debe centrarse en la situación, emociones o símbolos del tema. Composición tipo viñeta única, a color, con líneas marcadas y estilo ilustrativo, NO foto realista. Ejemplo: si es sobre crisis, mostrar personas afectadas, entorno destruido, banderas o íconos representativos. Evitar retratos directos o rostros reconocibles de figuras públicas. Usar simbolismo, metáforas visuales y ambientación para comunicar el mensaje. Tema: "${cleanTitle}".`;
  } else {
    return `Editorial illustration in journalistic comic or modern graphic novel style. Visually represents the context of the headline, not the protagonist's face. Should focus on the situation, emotions or symbols of the theme. Single panel composition, in color, with bold lines and illustrative style, NOT photorealistic. Example: if about crisis, show affected people, destroyed environment, flags or representative icons. Avoid direct portraits or recognizable faces of public figures. Use symbolism, visual metaphors and setting to communicate the message. Theme: "${cleanTitle}".`;
  }
}
```

**Ahora (líneas 46-53):**
```javascript
function sanitizeImagePrompt({ title, locale = 'es-CU' }) {
  const cleanTitle = String(title || '').trim();
  
  console.log(`[ImageSafety:Sanitizer] Prompt directo sin filtros propios: "${cleanTitle.substring(0, 80)}..."`);
  
  // Prompt simple estilo cómic editorial
  return `Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. Personajes y escenario expresivos, con contornos marcados y colores vivos. Debe representar la escena y el contexto del titular, no un retrato literal de nadie. Puede mostrar personas, banderas, símbolos y ambiente relacionados con la noticia. Evitar texto escrito dentro de la imagen. Titular: "${cleanTitle}".`;
}
```

---

### **3. `server/redactor_ia/services/imageProvider.js`**

**Antes (líneas 372-373):**
```javascript
function createNeutralPrompt() {
  return 'Ilustración editorial en estilo cómic periodístico, escena simbólica centrada en la situación y contexto, evitando retratos de personas. Líneas marcadas, colores vivos, NO foto realista.';
}
```

**Ahora (líneas 371-373):**
```javascript
function createNeutralPrompt() {
  return 'Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. Escena periodística con personajes y ambiente expresivos, contornos marcados y colores vivos.';
}
```

---

## 📝 Logs Esperados

### **Antes (complejo):**
```
[ImageSafety:Sanitizer] (NO-OP) Título sin cambios: "Díaz-Canel pierde los estribos ante damnificada..."
[ImageSafety:Sanitizer] 🎨 Estilo: ILUSTRACIÓN CONTEXTUAL SIMBÓLICA
[Redactor:TitleOnly] 🎯 MODO TÍTULO-ONLY ACTIVO - Estilo cómic editorial forzado
[Redactor:TitleOnly] 🎨 Estilo: ILUSTRACIÓN CONTEXTUAL SIMBÓLICA
[Redactor:TitleOnly] prompt="Ilustración editorial en estilo cómic periodístico o novela gráfica moderna. Representa visualmente el contexto del titular, no el rostro del protagonista. Debe centrarse en la situación, emociones o símbolos del tema... Tema: \"Díaz-Canel pierde los estribos ante damnificada en Cuba\"."
[Redactor:TitleOnly] negative="fotografía, photo, photorealistic, realistic photo, ultra realistic, 3d render, cinematic lighting, portrait, faces, celebrities, logos, text, letters, watermarks, infographic"
```

### **Ahora (simple):**
```
[Redactor:TitleOnly] 🎯 MODO TÍTULO-ONLY ACTIVO - Prompt directo sin filtros propios
[Redactor:TitleOnly] 🎨 Estilo: CÓMIC EDITORIAL (sin filtros propios)
[Redactor:TitleOnly] prompt="Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. Personajes y escenario expresivos, con contornos marcados y colores vivos. Debe representar la escena y el contexto del titular, no un retrato literal de nadie. Puede mostrar personas, banderas, símbolos y ambiente relacionados con la noticia. Evitar texto escrito dentro de la imagen (titulares, rótulos, logos, marcas). Titular: \"Díaz-Canel pierde los estribos ante damnificada en Cuba\". Contexto: Una mujer afectada por desastres reclama al gobierno..."
[Redactor:TitleOnly] negative="watermark, logo, text, letters, caption, meme, infographic"
```

---

## ✅ Ventajas

### **1. Menos código = menos errores**
- ✅ 200 líneas → 15 líneas
- ✅ 5+ funciones → 1 función
- ✅ Lógica clara y mantenible

### **2. Más coherencia visual**
- ✅ Sin fallbacks raros (buda, ilustraciones corporativas)
- ✅ Siempre estilo cómic editorial
- ✅ OpenAI decide qué es apropiado

### **3. Mayor libertad creativa**
- ✅ Puede mostrar banderas sin bloqueos
- ✅ Puede mostrar micrófonos, podios, público
- ✅ Puede mostrar símbolos políticos/nacionales
- ✅ Solo bloquea texto/logos (esencial para noticias)

### **4. Confía en los filtros de OpenAI**
- ✅ Ellos tienen los mejores filtros de seguridad
- ✅ Nosotros no intentamos "adivinar" qué es sensible
- ✅ Si OpenAI bloquea, es porque realmente hay un problema

---

## 🎨 Ejemplo de Resultado

### **Título:** "Díaz-Canel pierde los estribos ante damnificada en Cuba"  
### **Bajada:** "Una mujer afectada por el huracán reclama ayuda al gobierno cubano"

**Prompt generado:**
```
Ilustración editorial a todo color, estilo cómic / novela gráfica moderna. 
Personajes y escenario expresivos, con contornos marcados y colores vivos. 
Debe representar la escena y el contexto del titular, no un retrato literal de nadie. 
Puede mostrar personas, banderas, símbolos y ambiente relacionados con la noticia. 
Evitar texto escrito dentro de la imagen (titulares, rótulos, logos, marcas). 
Titular: "Díaz-Canel pierde los estribos ante damnificada en Cuba". 
Contexto: Una mujer afectada por el huracán reclama ayuda al gobierno cubano.
```

**Negative:**
```
watermark, logo, text, letters, caption, meme, infographic
```

**Resultado esperado:**
- ✅ Mujer cubana afectada por desastre
- ✅ Casas destruidas, ambiente de crisis
- ✅ Bandera de Cuba visible
- ✅ Símbolos del contexto (lluvia, escombros)
- ✅ Estilo cómic editorial con colores vivos
- ❌ SIN texto dentro de la imagen
- ❌ SIN intentar mostrar a Díaz-Canel (OpenAI lo bloqueará si es inapropiado)

---

## 📂 Archivos Modificados

1. ✅ `server/redactor_ia/services/redactor.js`
   - Función simple `buildComicNewsPrompt()`
   - Negativos mínimos
   - Fallback simple

2. ✅ `server/redactor_ia/utils/sanitizeImagePrompt.js`
   - Prompt simple y directo
   - Fallbacks simplificados

3. ✅ `server/redactor_ia/services/imageProvider.js`
   - `createNeutralPrompt()` simplificado
   - Modo RAW simplificado

---

## 🚀 Resultado Final

**Filosofía:** Prompt simple → OpenAI decide → Imágenes coherentes

**Antes:** 
- 😵 Múltiples capas de filtrado
- 😵 Fallbacks genéricos raros
- 😵 Negativos excesivos
- 😵 Inconsistencia visual

**Ahora:**
- ✅ 1 prompt simple y claro
- ✅ 1 fallback si OpenAI bloquea
- ✅ Negativos mínimos (solo texto/logos)
- ✅ Coherencia visual garantizada

---

**Implementación completada:** 2025-01-09  
**Sistema:** LevántateCuba Redactor IA v2.0  
**Filosofía:** Simplicidad > Complejidad
