# ✅ Visual Brief Generado por LLM

## 📋 Filosofía

**El LLM analiza el contexto completo de la noticia y genera una descripción visual optimizada.**

En lugar de construir el prompt de imagen con reglas hardcodeadas, usamos el LLM (Claude/GPT) para:
1. Leer TODO el contenido: título + bajada + contenido + etiquetas
2. Extraer la esencia visual del tema
3. Evitar nombres de personas reales automáticamente
4. Generar una descripción lista para DALL-E

---

## 🎯 Ventajas

### **1. Entiende el contexto completo**
- ✅ No solo el título, sino bajada + contenido + etiquetas
- ✅ Puede detectar matices que un título corto no captura
- ✅ Genera descripciones más precisas y contextuales

### **2. Evita nombres reales naturalmente**
- ✅ El LLM entiende la instrucción: "No menciones nombres de personas"
- ✅ Extrae el contexto sin mencionar figuras específicas
- ✅ Más inteligente que reglas hardcodeadas

### **3. Simplifica el código**
- ✅ No necesitas detectar intent, sanitizar, etc.
- ✅ El LLM hace todo el trabajo de análisis
- ✅ Código más limpio y mantenible

### **4. Mejor calidad visual**
- ✅ Descripciones más ricas y expresivas
- ✅ El LLM sugiere símbolos y metáforas relevantes
- ✅ DALL-E recibe prompts más claros

---

## 🔧 Implementación

### **Función principal: `generateVisualBrief()`**

```javascript
async function generateVisualBrief({ titulo, bajada, contenido, etiquetas = [], model = 'claude-3-5-sonnet-20241022' }) {
  const systemPrompt = `Eres un director de arte especializado en ilustraciones de noticias.
Debes crear una descripción visual para una portada de artículo en estilo cómic editorial.

Analiza el siguiente contenido periodístico y describe una sola escena visual que capture el mensaje central de la noticia.
No menciones nombres de personas ni lugares específicos: enfócate en el contexto, la emoción y los símbolos visuales.
La escena debe reflejar la situación social o política de fondo, usando metáforas o elementos representativos (por ejemplo, banderas, micrófonos, multitudes, edificios dañados, pobreza, crisis, tecnología, etc.).

**Instrucciones de estilo:**
- Estilo: cómic editorial / novela gráfica moderna.
- Composición: clara, expresiva, con colores vivos y líneas marcadas.
- Personajes: genéricos, sin parecido a personas reales.
- No debe contener texto, logotipos ni palabras visibles.
- Enfócate en el contexto, no en retratos.

Devuelve solo la descripción de la escena en español, lista para usar como prompt de imagen.`;

  const userPrompt = `Contenido:
"""
${titulo || ''}
${bajada || ''}
${contenido || ''}
Palabras clave: ${etiquetas.join(', ')}
"""

Devuelve solo la descripción de la escena visual:`;

  const visualBrief = await callLLM({
    model,
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.5,
    timeoutMs: 15000
  });

  return visualBrief;
}
```

---

### **Uso en pipeline titleOnly:**

```javascript
if (opts.titleOnly) {
  console.log('[Redactor:TitleOnly] 🎯 MODO TÍTULO-ONLY ACTIVO - Generando descripción visual con LLM');
  
  // 🔹 Usar LLM para generar descripción visual basada en contexto completo
  const visualBrief = await generateVisualBrief({
    titulo: draft.titulo || draft.title || '',
    bajada: draft.bajada || draft.excerpt || '',
    contenido: draft.contenido_markdown || draft.content || '',
    etiquetas: draft.etiquetas || draft.tags || [],
    model: config.llmModel || 'claude-3-5-sonnet-20241022'
  });
  
  // 🔹 Usar descripción visual como prompt, añadiendo estilo editorial
  const prompt = `${visualBrief}. Estilo: ilustración editorial tipo cómic / novela gráfica moderna, con colores vivos y líneas marcadas.`;
  
  // 🔹 Negative mínimo: solo texto, logos, marcas
  const negative = ['watermark', 'logo', 'text', 'letters', 'caption', 'meme', 'infographic'].join(', ');
  
  // 🔹 Generar imagen con DALL-E
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${prompt}\n\nNEGATIVE: ${negative}`,
    size: '1792x1024',
    quality: 'standard',
    response_format: 'b64_json'
  });
}
```

---

## 📊 Ejemplo Real

### **Entrada:**

```javascript
{
  titulo: "Díaz-Canel pierde los estribos ante damnificada en Cuba",
  bajada: "El presidente cubano reaccionó airadamente durante un encuentro con ciudadanos afectados por el huracán",
  contenido: "Durante una visita oficial a zonas afectadas por el huracán Ian, el presidente Miguel Díaz-Canel protagonizó un tenso intercambio con una mujer que reclamaba ayuda gubernamental. El incidente, capturado en video, muestra al mandatario elevando la voz mientras la ciudadana describe las precarias condiciones en que vive desde el paso del ciclón...",
  etiquetas: ["Cuba", "damnificados", "crisis", "desastre natural", "gobierno"]
}
```

### **Salida del LLM (visualBrief):**

```
"Una mujer cubana afectada por un desastre natural discute con un funcionario en un salón oficial deteriorado. De fondo, banderas rojas y azules y símbolos del régimen, mientras otros ciudadanos observan preocupados. Escena tensa, con tonos cálidos y líneas de cómic editorial."
```

### **Prompt final para DALL-E:**

```
Una mujer cubana afectada por un desastre natural discute con un funcionario en un salón oficial deteriorado. De fondo, banderas rojas y azules y símbolos del régimen, mientras otros ciudadanos observan preocupados. Escena tensa, con tonos cálidos y líneas de cómic editorial. Estilo: ilustración editorial tipo cómic / novela gráfica moderna, con colores vivos y líneas marcadas.

NEGATIVE: watermark, logo, text, letters, caption, meme, infographic
```

### **Imagen generada esperada:**

- ✅ Mujer cubana afectada por desastres (protagonista contextual)
- ✅ Funcionario genérico (sin rostro de Díaz-Canel)
- ✅ Salón oficial deteriorado (ambiente)
- ✅ Banderas rojas y azules (símbolos de Cuba)
- ✅ Símbolos del régimen (contexto político)
- ✅ Otros ciudadanos observando (multitud)
- ✅ Tonos cálidos, estilo cómic editorial
- ❌ SIN texto dentro de la imagen
- ❌ SIN mencionar "Díaz-Canel" explícitamente

---

## 📝 Logs Esperados

```
[Redactor:TitleOnly] 🎯 MODO TÍTULO-ONLY ACTIVO - Generando descripción visual con LLM
[Redactor:VisualBrief] Generado (245 chars): "Una mujer cubana afectada por un desastre natural discute con un funcionario en un salón oficial deteriorado. De fondo, banderas rojas y azules..."
[Redactor:TitleOnly] 🎨 Visual brief generado por LLM
[Redactor:TitleOnly] prompt="Una mujer cubana afectada por un desastre natural discute con un funcionario en un salón oficial deteriorado. De fondo, banderas rojas y azules y símbolos del régimen, mientras otros ciudadanos observan preocupados. Escena tensa, con tonos cálidos y líneas de cómic editorial. Estilo: ilustración editorial tipo cómic / novela gráfica moderna, con colores vivos y líneas marcadas..."
[Redactor:TitleOnly] negative="watermark, logo, text, letters, caption, meme, infographic"
[Redactor:TitleOnly] ✅ Imagen generada exitosamente (1245.3KB)
```

---

## 🔄 Flujo Completo

```
1. Usuario solicita generar borrador con imagen (titleOnly: true)
                    ↓
2. Sistema llama a generateVisualBrief()
                    ↓
3. LLM (Claude/GPT) analiza:
   - Título: "Díaz-Canel pierde los estribos ante damnificada en Cuba"
   - Bajada: "El presidente cubano reaccionó airadamente..."
   - Contenido completo: "Durante una visita oficial..."
   - Etiquetas: ["Cuba", "damnificados", "crisis"]
                    ↓
4. LLM genera descripción visual:
   "Una mujer cubana afectada por un desastre natural discute con un funcionario..."
                    ↓
5. Sistema añade estilo:
   "...Estilo: ilustración editorial tipo cómic / novela gráfica moderna..."
                    ↓
6. DALL-E genera imagen basándose en la descripción
                    ↓
7. Imagen guardada y asociada al borrador
```

---

## 💰 Costos

### **LLM (generación de visual brief):**
- **Claude 3.5 Sonnet:**
  - Input: ~500 tokens (título + bajada + contenido)
  - Output: ~100 tokens (descripción visual)
  - Costo: ~$0.002 por visual brief
  
- **GPT-4:**
  - Similar, ~$0.003 por visual brief

### **DALL-E 3:**
- **Standard 1792x1024:** $0.080 por imagen
- **HD 1792x1024:** $0.120 por imagen

### **Total por imagen:**
- **Claude + DALL-E Standard:** ~$0.082
- **GPT-4 + DALL-E Standard:** ~$0.083

---

## ⚡ Rendimiento

- **generateVisualBrief():** ~2-4 segundos
- **DALL-E generación:** ~10-15 segundos
- **Total:** ~12-19 segundos por imagen

---

## 🎯 Comparación: Antes vs Ahora

| Aspecto | Antes (reglas hardcodeadas) | Ahora (LLM genera descripción) |
|---------|----------------------------|--------------------------------|
| **Análisis de contexto** | Solo título | Título + bajada + contenido + etiquetas |
| **Detección de nombres** | Regex patterns | LLM entiende instrucción |
| **Calidad del prompt** | Genérico, plantilla fija | Contextual, rico en detalles |
| **Mantenibilidad** | Añadir reglas por cada caso | Instrucciones claras al LLM |
| **Tiempo de generación** | ~10-15s (solo DALL-E) | ~12-19s (LLM + DALL-E) |
| **Costo adicional** | $0 | ~$0.002 por visual brief |
| **Coherencia** | Media (plantillas genéricas) | Alta (contexto completo) |

---

## ✅ Ventajas Finales

1. **Inteligencia real:** El LLM entiende matices que reglas no pueden capturar
2. **Evita nombres naturalmente:** Sin necesidad de listas de dictadores o políticos
3. **Descripciones ricas:** Más detalles visuales → mejores imágenes
4. **Código limpio:** Sin sanitizers, intent detectors, ni lógica compleja
5. **Escalable:** Funciona para cualquier tema sin modificar código

---

## 📂 Archivos Modificados

1. ✅ `server/redactor_ia/services/redactor.js`
   - Nueva función `generateVisualBrief()`
   - Pipeline titleOnly actualizado para usar visual brief
   - Logs actualizados

---

**Implementación completada:** 2025-01-09  
**Sistema:** LevántateCuba Redactor IA v2.0  
**Estrategia:** Visual Brief Generado por LLM  
**Costo adicional:** ~$0.002 por imagen  
**Tiempo adicional:** ~2-4 segundos
