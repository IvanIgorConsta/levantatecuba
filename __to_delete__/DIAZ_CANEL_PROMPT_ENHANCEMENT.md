# ⚠️ OBSOLETO - Mejora de Prompts: Detección de Díaz-Canel y Víctimas

**Fecha:** 15 de noviembre de 2025  
**Estado:** ❌ OBSOLETO - REEMPLAZADO POR SISTEMA ANTI-POLÍTICOS

---

## ⚠️ AVISO IMPORTANTE

**Este documento está OBSOLETO.**

El enfoque de "mostrar a Díaz-Canel con descripción física" fue **reemplazado** por el sistema **anti-políticos** que NUNCA muestra políticos.

**Ver documento actualizado:** `POLITICAL_IMAGE_SYSTEM.md`

---

## 📝 Enfoque anterior (obsoleto)

---

## 🎯 Problema

Cuando el título de una noticia menciona a "Díaz-Canel", el prompt literal podía no ser suficientemente explícito para que el generador de imágenes (Hailuo/DALL-E) represente correctamente al presidente cubano.

**Riesgo:** Imagen genérica de "político" sin características específicas de Díaz-Canel.

---

## ✅ Solución implementada

Se añadió **lógica de detección** en `buildImagePromptFromTitle()` para:

1. **Detectar menciones de Díaz-Canel** (con o sin tilde)
2. **Detectar contexto de víctimas femeninas** (damnificada, afectada, mujer, madre, víctima)
3. **Añadir descripciones específicas** al prompt antes de las instrucciones de estilo

---

## 📋 Lógica de detección

```javascript
// Detección de Díaz-Canel
const hasDiazCanel = 
  titleLower.includes('díaz-canel') || titleLower.includes('diaz-canel');

// Detección de víctima femenina
const hasFemaleVictim = 
  titleLower.includes('damnificada') ||
  titleLower.includes('afectada') ||
  titleLower.includes('víctima') ||
  titleLower.includes('mujer') ||
  titleLower.includes('madre');
```

---

## 🔄 Modificaciones al prompt

### Caso 1: Solo Díaz-Canel

**Título:** "Díaz-Canel anuncia nuevas medidas económicas"

**Añade al prompt:**
```
En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa.
```

**Log:**
```
[TitleTransformer] 🎯 Detectado: Díaz-Canel → añadida descripción del presidente
```

---

### Caso 2: Díaz-Canel + Víctima Femenina

**Título:** "Mujer damnificada enfrenta a Díaz-Canel por falta de ayuda"

**Añade al prompt:**
```
En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa.

Frente a él hay una mujer cubana damnificada, de mediana edad, con ropa sencilla y gesto de preocupación o reclamo, que interactúa directamente con él.
```

**Logs:**
```
[TitleTransformer] 🎯 Detectado: Díaz-Canel → añadida descripción del presidente
[TitleTransformer] 🎯 Detectado: Díaz-Canel + víctima femenina → añadida escena de confrontación
```

---

## 📊 Ejemplos completos

### Ejemplo 1: Política general

**Título:** "Díaz-Canel defiende política económica en asamblea"

**Prompt final:**
```
Ilustración editorial realista y moderna para una noticia. Representa fielmente: "Díaz-Canel defiende política económica en asamblea". Categoría de la noticia: Política. En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa. Estilo: foto editorial o ilustración periodística profesional, formato horizontal 16:9, composición clara y directa.
```

**Imagen esperada:** 
- ✅ Díaz-Canel en asamblea/podio
- ✅ Características físicas correctas
- ✅ Contexto político formal

---

### Ejemplo 2: Confrontación con víctima

**Título:** "Madre damnificada reclama a Díaz-Canel por apagones"

**Prompt final:**
```
Ilustración editorial realista y moderna para una noticia. Representa fielmente: "Madre damnificada reclama a Díaz-Canel por apagones". Categoría de la noticia: Política. En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa. Frente a él hay una mujer cubana damnificada, de mediana edad, con ropa sencilla y gesto de preocupación o reclamo, que interactúa directamente con él. Estilo: foto editorial o ilustración periodística profesional, formato horizontal 16:9, composición clara y directa.
```

**Imagen esperada:**
- ✅ Díaz-Canel (características específicas)
- ✅ Mujer cubana frente a él
- ✅ Interacción/confrontación visible
- ✅ Contexto de crisis (apagones)

---

### Ejemplo 3: Sin Díaz-Canel (no afectado)

**Título:** "Apagones afectan a familias cubanas por tercera semana"

**Prompt final:**
```
Ilustración editorial realista y moderna para una noticia. Representa fielmente: "Apagones afectan a familias cubanas por tercera semana". Categoría de la noticia: Sociedad. Estilo: foto editorial o ilustración periodística profesional, formato horizontal 16:9, composición clara y directa.
```

**Sin cambios:** No se detecta "Díaz-Canel", el prompt permanece literal sin adiciones.

---

## 🔍 Keywords detectadas

### Para Díaz-Canel:
- `díaz-canel` (con tilde)
- `diaz-canel` (sin tilde)

### Para víctimas femeninas:
- `damnificada`
- `afectada`
- `víctima`
- `mujer`
- `madre`

**Nota:** La detección es case-insensitive (minúsculas/mayúsculas no importan).

---

## 📁 Archivo modificado

**Archivo:** `server/redactor_ia/utils/titleTransformer.js`

**Función:** `buildImagePromptFromTitle({ title, category, tags })`

**Líneas añadidas:** 46-70 (25 líneas)

**Cambios:**
```javascript
// LÓGICA ESPECIAL: Detección de Díaz-Canel y víctimas femeninas
const titleLower = title.toLowerCase();
const hasDiazCanel = 
  titleLower.includes('díaz-canel') || titleLower.includes('diaz-canel');

const hasFemaleVictim = 
  titleLower.includes('damnificada') ||
  titleLower.includes('afectada') ||
  titleLower.includes('víctima') ||
  titleLower.includes('mujer') ||
  titleLower.includes('madre');

if (hasDiazCanel) {
  extraBits.push(
    'En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa.'
  );
  console.log('[TitleTransformer] 🎯 Detectado: Díaz-Canel → añadida descripción del presidente');
}

if (hasDiazCanel && hasFemaleVictim) {
  extraBits.push(
    'Frente a él hay una mujer cubana damnificada, de mediana edad, con ropa sencilla y gesto de preocupación o reclamo, que interactúa directamente con él.'
  );
  console.log('[TitleTransformer] 🎯 Detectado: Díaz-Canel + víctima femenina → añadida escena de confrontación');
}
```

---

## ✅ Ventajas

1. **Precisión visual:** Díaz-Canel siempre aparece con características correctas
2. **Contexto adecuado:** Víctimas femeninas representadas cuando corresponde
3. **Logs claros:** Detección visible en logs del servidor
4. **No invasivo:** Solo afecta títulos que mencionan a Díaz-Canel
5. **Extensible:** Fácil añadir más políticos o contextos si es necesario

---

## 🧪 Cómo verificar

### Paso 1: Crear borrador con Redactor IA

1. Admin Dashboard → Herramientas → Redactor IA
2. Cola de Temas → Seleccionar tema sobre Díaz-Canel
3. Generar borrador con imagen

### Paso 2: Verificar logs

**Busca:**
```
[TitleTransformer] 🎯 Detectado: Díaz-Canel → añadida descripción del presidente
```

o (si hay víctima femenina):
```
[TitleTransformer] 🎯 Detectado: Díaz-Canel + víctima femenina → añadida escena de confrontación
```

### Paso 3: Verificar prompt en logs

**Debe contener:**
```
En la escena aparece claramente el presidente cubano Miguel Díaz-Canel, hombre blanco de mediana edad, con cabello corto y canoso, expresión tensa.
```

### Paso 4: Verificar imagen generada

**Debe mostrar:**
- ✅ Hombre de mediana edad
- ✅ Cabello corto y canoso
- ✅ Expresión seria/tensa
- ✅ Si hay víctima: mujer cubana interactuando con él

---

## 🎨 Extensibilidad futura

Si necesitas añadir más políticos o contextos:

```javascript
// Ejemplo: Añadir detección de otro político
const hasPoliticoX = titleLower.includes('nombre-politico');

if (hasPoliticoX) {
  extraBits.push('Descripción específica del político X...');
  console.log('[TitleTransformer] 🎯 Detectado: Político X');
}
```

O añadir más keywords para víctimas:
```javascript
const hasFemaleVictim = 
  titleLower.includes('damnificada') ||
  titleLower.includes('afectada') ||
  titleLower.includes('perjudicada') || // NUEVO
  titleLower.includes('víctima') ||
  titleLower.includes('mujer') ||
  titleLower.includes('madre');
```

---

## 📝 Resumen

- ✅ Detecta "Díaz-Canel" (con/sin tilde) en título
- ✅ Detecta contexto de víctima femenina (5 keywords)
- ✅ Añade descripción física específica de Díaz-Canel
- ✅ Añade escena de confrontación si hay víctima femenina
- ✅ Logs claros de detección
- ✅ Compatible con sistema literal existente
- ✅ Extensible para más políticos/contextos

---

**Última actualización:** 15 de noviembre de 2025  
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA PRUEBAS
