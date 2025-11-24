# Sistema de Badges Dinámicos por Proveedor de Imagen

**Fecha:** 15 de noviembre de 2025  
**Objetivo:** Mostrar el proveedor real de la imagen en el frontend en vez de texto hardcodeado  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Problema resuelto

**Antes:**
- Badge hardcodeado: `✨ IA (DALL-E)`
- No reflejaba el proveedor real (Hailuo, Stable Diffusion, etc.)
- Backend sabía el proveedor pero frontend no lo mostraba

**Ahora:**
- Badge dinámico: `✨ IA (Hailuo)`, `✨ IA (DALL·E)`, etc.
- Se lee del campo `imageProvider` guardado en BD
- Refleja el proveedor real usado para generar la imagen

---

## 📋 Implementación completa

### 1. Backend: Guardar proveedor en BD

#### A. Modelos (Schema)

**Archivo:** `server/models/AiDraft.js`
```javascript
// Proveedor real que generó la imagen (trackea el proveedor efectivo usado)
imageProvider: {
  type: String,
  enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'internal', 'stable-diffusion', 'midjourney'],
  default: 'dall-e-3'
},
```

**Archivo:** `server/models/News.js`
```javascript
// Proveedor real que generó la imagen (trackea el proveedor efectivo usado)
imageProvider: {
  type: String,
  enum: ['dall-e-3', 'dall-e-2', 'hailuo', 'internal', 'stable-diffusion', 'midjourney'],
  default: 'dall-e-3'
},
```

#### B. Persistencia en redactor.js

**Archivo:** `server/redactor_ia/services/redactor.js`

**Caso 1: Imagen base64 (Hailuo, DALL-E)**
```javascript
// Línea ~2109
draft.imageProvider = images.provider || provider || 'dall-e-3'; // Proveedor real de primer nivel
draft.aiMetadata = draft.aiMetadata || {};
draft.aiMetadata.imageProvider = images.provider || draft.aiMetadata.imageProvider || provider;
```

**Caso 2: URL interna (proveedor internal)**
```javascript
// Línea ~2036
draft.imageProvider = images.provider || provider || 'internal'; // Proveedor real de primer nivel
draft.aiMetadata = draft.aiMetadata || {};
draft.aiMetadata.imageProvider = images.provider || draft.aiMetadata.imageProvider || provider;
```

#### C. Copiar a noticia publicada

**Archivo:** `server/redactor_ia/services/publishDraftHelper.js`
```javascript
// Línea ~70
const newsDoc = await News.create({
  titulo: draft.titulo,
  // ...
  imagen,
  imageProvider: draft.imageProvider || 'dall-e-3', // ✅ Proveedor real de la imagen
  autor,
  // ...
});
```

---

### 2. Frontend: Renderizar badge dinámico

#### A. Función helper de mapeo

**Archivos:**
- `src/admin_dashboard/redactor_ia/BorradoresIA.jsx`
- `src/admin_dashboard/components/DraftPreviewModal.jsx`

```javascript
// Mapeo de proveedor de imagen a label legible
const getProviderLabel = (provider) => {
  const providerMap = {
    'dall-e-3': 'DALL·E',
    'dall-e-2': 'DALL·E 2',
    'hailuo': 'Hailuo',
    'internal': 'Interno',
    'stable-diffusion': 'SD',
    'midjourney': 'MJ'
  };
  return providerMap[provider] || provider || 'DALL·E';
};
```

#### B. Uso en badges

**BorradoresIA.jsx - Badge 1 (lista compacta):**
```jsx
{(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur text-white text-[10px] rounded font-medium">
    {draft.aiMetadata?.usedSource === false 
      ? '✨ IA - sin ref'
      : `✨ IA (${getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})`
    }
  </div>
)}
```

**BorradoresIA.jsx - Badge 2 (lista expandida):**
```jsx
{(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600/80 backdrop-blur text-white text-[10px] rounded font-medium z-10">
    ✨ IA ({getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})
  </div>
)}
```

**DraftPreviewModal.jsx - Badge en modal:**
```jsx
{(draft.imageKind === 'ai' || draft.imageKind === 'real') && (
  <div className="absolute bottom-2 right-2 px-2 py-1 bg-purple-600/90 backdrop-blur text-white text-xs rounded font-medium">
    {draft.aiMetadata?.usedSource === false 
      ? '✨ IA - sin ref'
      : `✨ IA (${getProviderLabel(draft.imageProvider || draft.aiMetadata?.imageProvider)})`
    }
  </div>
)}
```

#### C. Actualización de estado local

**BorradoresIA.jsx - Al generar imagen desde fuente:**
```javascript
// Línea ~127
setDrafts(prev => prev.map(d => 
  d._id === draftId 
    ? { 
        ...d, 
        imageProvider: data.provider || data.draft?.imageProvider || 'internal',
        // ...
      } 
    : d
));
```

**BorradoresIA.jsx - Al generar imagen con IA:**
```javascript
// Línea ~189
setDrafts(prev => prev.map(d => 
  d._id === draftId 
    ? { 
        ...d, 
        imageProvider: data.provider || data.draft?.imageProvider || 'dall-e-3',
        // ...
      } 
    : d
));
```

---

## 🔄 Flujo completo

### Generación de imagen

```
1. Usuario genera imagen con Hailuo
         ↓
2. Backend (redactor.js):
   - Llama a providerHailuo()
   - Recibe: { provider: 'hailuo', b64: '...' }
   - Guarda: draft.imageProvider = 'hailuo'
         ↓
3. API devuelve draft actualizado al frontend
         ↓
4. Frontend (BorradoresIA.jsx):
   - Actualiza estado local: imageProvider: 'hailuo'
   - Badge renderiza: ✨ IA (Hailuo)
```

### Publicación de noticia

```
1. Usuario publica borrador
         ↓
2. Backend (publishDraftHelper.js):
   - Lee: draft.imageProvider = 'hailuo'
   - Copia a News: imageProvider: 'hailuo'
         ↓
3. Noticia publicada tiene proveedor correcto
```

---

## 📊 Ejemplos de badges

### Hailuo (Minimax)
```
✨ IA (Hailuo)
```

### DALL-E 3
```
✨ IA (DALL·E)
```

### DALL-E 2
```
✨ IA (DALL·E 2)
```

### Stable Diffusion
```
✨ IA (SD)
```

### Proveedor interno
```
✨ IA (Interno)
```

### Sin referencia (cualquier proveedor)
```
✨ IA - sin ref
```

---

## ✅ Compatibilidad con datos legacy

**Borradores/Noticias antiguas sin `imageProvider`:**
- Default: `'dall-e-3'`
- Badge mostrará: `✨ IA (DALL·E)`

**Borradores nuevos:**
- Se guarda el proveedor real
- Badge muestra el proveedor correcto

---

## 📁 Archivos modificados

### Backend (4 archivos)

1. **`server/models/AiDraft.js`**
   - Añadido campo `imageProvider` (línea 78-82)

2. **`server/models/News.js`**
   - Añadido campo `imageProvider` (línea 169-173)

3. **`server/redactor_ia/services/redactor.js`**
   - Guardar `imageProvider` cuando se persiste base64 (línea 2109)
   - Guardar `imageProvider` cuando se persiste URL interna (línea 2036)

4. **`server/redactor_ia/services/publishDraftHelper.js`**
   - Copiar `imageProvider` al publicar (línea 70)

### Frontend (2 archivos)

1. **`src/admin_dashboard/redactor_ia/BorradoresIA.jsx`**
   - Función `getProviderLabel()` (línea 507-517)
   - Badge 1 dinámico (línea 698)
   - Badge 2 dinámico (línea 875)
   - Actualizar estado con `imageProvider` (líneas 127, 189)

2. **`src/admin_dashboard/components/DraftPreviewModal.jsx`**
   - Función `getProviderLabel()` (línea 25-35)
   - Badge dinámico en modal (línea 369)

---

## 🧪 Cómo verificar

### Paso 1: Generar imagen con Hailuo

1. Redactor IA → Borradores IA
2. Seleccionar un borrador
3. Click "Generar IA"
4. Esperar a que se complete

### Paso 2: Verificar badge

**En la lista de borradores:**
- Badge debe mostrar: `✨ IA (Hailuo)`

**En el modal de preview:**
- Abrir borrador
- Badge debe mostrar: `✨ IA (Hailuo)`

### Paso 3: Verificar logs del backend

```
[ImageProvider:Hailuo] ✅ Imagen generada: https://...
[Redactor] Imagen IA procesada y persistida: /media/news/.../cover.avif
```

### Paso 4: Verificar en BD

```javascript
// MongoDB
db.aidrafts.findOne({ _id: ObjectId("...") }).imageProvider
// Resultado: "hailuo"
```

### Paso 5: Publicar y verificar noticia

1. Publicar borrador
2. Verificar en News:

```javascript
db.news.findOne({ _id: ObjectId("...") }).imageProvider
// Resultado: "hailuo"
```

---

## 🎨 Mapeo completo de proveedores

| Provider en BD      | Label en Badge | Ejemplo Badge          |
|---------------------|----------------|------------------------|
| `dall-e-3`          | DALL·E         | ✨ IA (DALL·E)         |
| `dall-e-2`          | DALL·E 2       | ✨ IA (DALL·E 2)       |
| `hailuo`            | Hailuo         | ✨ IA (Hailuo)         |
| `internal`          | Interno        | ✨ IA (Interno)        |
| `stable-diffusion`  | SD             | ✨ IA (SD)             |
| `midjourney`        | MJ             | ✨ IA (MJ)             |
| `null` / `undefined`| DALL·E         | ✨ IA (DALL·E)         |

---

## 🔧 Extensibilidad

### Añadir nuevo proveedor

**1. Schema (backend):**
```javascript
// AiDraft.js, News.js
imageProvider: {
  type: String,
  enum: ['dall-e-3', 'hailuo', 'nuevo-proveedor'], // ← Añadir aquí
  default: 'dall-e-3'
}
```

**2. Frontend (mapeo):**
```javascript
// BorradoresIA.jsx, DraftPreviewModal.jsx
const providerMap = {
  'dall-e-3': 'DALL·E',
  'hailuo': 'Hailuo',
  'nuevo-proveedor': 'NuevoLabel' // ← Añadir aquí
};
```

**3. Listo**
- El sistema detectará automáticamente el nuevo proveedor
- Badge mostrará el label correcto

---

## 📝 Resumen ejecutivo

**Antes:**
- ❌ Badge hardcodeado: `✨ IA (DALL-E)` siempre
- ❌ No refleja proveedor real
- ❌ Usuario no sabe si es Hailuo o DALL-E

**Ahora:**
- ✅ Campo `imageProvider` en BD (AiDraft, News)
- ✅ Se guarda el proveedor real al generar imagen
- ✅ Badge dinámico lee de `draft.imageProvider`
- ✅ Mapeo claro: `hailuo` → `Hailuo`, `dall-e-3` → `DALL·E`
- ✅ Compatible con datos legacy (default: `dall-e-3`)
- ✅ Extensible para nuevos proveedores

**Impacto:**
- 100% transparencia sobre el proveedor usado
- Fácil debugging y auditoría
- Mejor UX para el usuario

---

**Última actualización:** 15 de noviembre de 2025  
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA PRODUCCIÓN
