# ✅ CORRECCIÓN: Etiqueta "FB pendiente" ahora coincide con candidatos reales

## 🎯 Problema identificado

### ❌ Antes
- **Scheduler:** `candidatesCount: 4` (con filtros de frescura por categoría)
- **Backend/UI:** 36+ noticias marcadas como "FB pendiente" (sin filtros de frescura)

### 🔍 Causa raíz
El scheduler aplica **reglas de frescura** al contar candidatos:
- **Cuba:** máximo 7 días de antigüedad
- **Tendencia:** máximo 7 días
- **Tecnología:** máximo 7 días  
- **Otras categorías:** máximo 5 días
- **Evergreen:** sin límite

PERO `buildFacebookCandidatesFilter()` solo verificaba:
- `status === 'published'`
- `publishedToFacebook === false`
- `facebook_status === 'not_shared'`

**NO** incluía filtros de fecha → discrepancia entre scheduler (4) y UI (36+).

---

## ✅ Solución implementada

### 1. **Función `isNewsAFacebookCandidate()` corregida**
**Archivo:** `server/redactor_ia/services/facebookAutoPublisher.js`

**Cambios:**
- Agregados filtros de frescura **idénticos** al scheduler
- Verifica antigüedad según categoría
- Respeta flag `isEvergreen`

```javascript
function isNewsAFacebookCandidate(news) {
  // ... validaciones base (status, publishedToFacebook, facebook_status)
  
  // ========================================
  // FILTROS DE FRESCURA (IGUAL QUE SCHEDULER)
  // ========================================
  const ageInDays = (Date.now() - new Date(publishedAt)) / (1000 * 60 * 60 * 24);
  
  // Evergreen: siempre candidato
  if (news.isEvergreen === true) return true;
  
  // Cuba: hasta 7 días
  if (categoria === 'Cuba') return ageInDays <= 7;
  
  // Tendencia: hasta 7 días
  if (categoria === 'Tendencia') return ageInDays <= 7;
  
  // Tecnología: hasta 7 días
  if (categoria === 'Tecnología') return ageInDays <= 7;
  
  // Otras categorías: hasta 5 días
  return ageInDays <= 5;
}
```

### 2. **Backend usa la función corregida**
**Archivo:** `server/routes/news.js`

**Cambios:**

#### a) Conteo de FB pendientes
```javascript
// ANTES: usaba buildFacebookCandidatesFilter() sin fechas
News.countDocuments({ ...buildFacebookCandidatesFilter() })

// AHORA: filtra con isNewsAFacebookCandidate() que incluye frescura
const allPublishedNews = await News.find({ status: "published" })
  .select('publishedAt categoria isEvergreen ...')
  .lean();

const fbPendingCount = allPublishedNews
  .filter(news => isNewsAFacebookCandidate(news))
  .length;
```

#### b) Campo `isFacebookCandidate` en cada noticia
```javascript
// Cada noticia incluye este flag calculado con filtros de frescura
const noticiasWithCandidate = noticias.map(noticia => ({
  ...noticia,
  isFacebookCandidate: isNewsAFacebookCandidate(noticia)
}));
```

#### c) Filtro de FB pendientes
```javascript
// Cuando fbStatus=pending, aplica filtro de frescura post-query
if (applyFreshnessFilter) {
  noticias = noticias.filter(noticia => 
    isNewsAFacebookCandidate(noticia)
  );
  // Recalcula total con filtro de frescura
}
```

### 3. **Frontend sin cambios**
**Archivo:** `src/admin_dashboard/components/NewsListPanel.jsx`

El frontend ya usaba `noticia.isFacebookCandidate` correctamente:
```jsx
{noticia.isFacebookCandidate && (
  <span className="...">FB pendiente</span>
)}
```

Como el backend ahora calcula `isFacebookCandidate` correctamente (con filtros de frescura), el frontend automáticamente muestra la etiqueta solo en candidatos reales.

---

## 🔧 Endpoint de diagnóstico

**Nuevo endpoint:** `GET /api/redactor-ia/facebook/debug-candidates`

Compara:
- **Lista A:** candidatos según scheduler (`candidatesCount`)
- **Lista B:** noticias marcadas como `isFacebookCandidate` en backend

Devuelve:
- Conteo de cada lista
- ¿Coinciden? ✅ / ❌
- Lista de candidatos reales (con edad, categoría)
- Lista de noticias excluidas (con razón: "Cuba: 12 días (máx 7)")

**Ejemplo de uso:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/redactor-ia/facebook/debug-candidates
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "comparison": {
    "schedulerCount": 4,
    "realCandidatesCount": 4,
    "match": true,
    "realCandidates": [...],
    "notCandidates": [
      {
        "titulo": "Noticia antigua...",
        "categoria": "Cuba",
        "ageInDays": 12,
        "reason": "Cuba: 12 días (máx 7)"
      }
    ]
  },
  "message": "✅ Los números coinciden perfectamente"
}
```

---

## 📊 Verificación

### Paso 1: Ver logs del scheduler
```bash
# En la consola del servidor, busca:
[API:Facebook] Resumen generado: {
  enabled: true,
  candidatesCount: 4,  # <-- Este número
  ...
}
```

### Paso 2: Verificar en /admin/news
1. Abre el panel de administración
2. Click en pestaña "FB pendientes"
3. El badge debe mostrar: **FB pendientes (4)**  ← mismo número
4. Solo 4 noticias deben tener la etiqueta "FB pendiente"

### Paso 3: Ejecutar diagnóstico
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/redactor-ia/facebook/debug-candidates
```

Debe devolver: `"match": true`

---

## 📝 Resumen de archivos modificados

| Archivo | Cambios |
|---------|---------|
| `server/redactor_ia/services/facebookAutoPublisher.js` | ✅ `isNewsAFacebookCandidate()` con filtros de frescura |
| `server/routes/news.js` | ✅ Conteo y filtrado usando `isNewsAFacebookCandidate()` |
| `server/redactor_ia/routes/redactorIA.js` | ✅ Endpoint de diagnóstico `/facebook/debug-candidates` |
| `src/admin_dashboard/components/NewsListPanel.jsx` | ✅ Sin cambios (ya usa `isFacebookCandidate` correctamente) |

---

## 🎉 Resultado final

**ANTES:**
- Scheduler: 4 candidatos
- UI: 36 noticias con "FB pendiente"  
- ❌ **Inconsistencia total**

**AHORA:**
- Scheduler: 4 candidatos
- UI: 4 noticias con "FB pendiente"  
- ✅ **Coincidencia perfecta**

---

## 🧪 Logs de debug

El backend ahora muestra logs detallados:

```
🔍 [DEBUG Backend] Aplicando filtro FB pendientes (con filtros de frescura)
🔍 [DEBUG Backend] Aplicando filtro de frescura a 36 noticias
🔍 [DEBUG Backend] Después de filtro de frescura: 4 noticias
🔍 [DEBUG Backend] Total real de FB pendientes: 4

[FB DEBUG] ============================================
[FB DEBUG] RESUMEN:
[FB DEBUG] - Scheduler count: 4
[FB DEBUG] - Real candidates: 4
[FB DEBUG] - Match: ✅ SÍ
[FB DEBUG] ============================================
[FB DEBUG] Noticias EXCLUIDAS por frescura:
[FB DEBUG]   - Noticia antigua 1 (Cuba, 12d)
[FB DEBUG]   - Noticia antigua 2 (Tecnología, 9d)
[FB DEBUG]   ... y 30 más
```

---

## ⚠️ Notas importantes

1. **Las reglas de frescura son fijas:**
   - Cuba/Tendencia/Tecnología: 7 días
   - Otras categorías: 5 días
   - Evergreen: sin límite

2. **El campo `publishedAt` es crítico:**
   - Noticias sin `publishedAt` NO son candidatos
   - Se calcula antigüedad desde `publishedAt`, no desde `createdAt`

3. **El filtro es dinámico:**
   - Se recalcula cada vez que se consultan noticias
   - Las noticias "envejecen" automáticamente

4. **Performance:**
   - Para FB pendientes, se obtienen todas las published y se filtran en memoria
   - Esto es aceptable porque son pocas noticias (<100 típicamente)
   - Si hay miles, considerar optimizar con aggregate pipeline
