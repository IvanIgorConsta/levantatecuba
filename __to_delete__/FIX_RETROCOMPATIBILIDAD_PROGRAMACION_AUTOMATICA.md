# Fix: Retrocompatibilidad Programación Automática

## 🐛 Problema Identificado

**Síntoma:**
- Al pulsar "Recalcular programación ahora" en Configuración → Programación automática, aparece: _"No hay borradores pendientes para programar"_
- Sin embargo, existen borradores visibles en estado "Pendiente" en Borradores IA

**Causa Raíz:**
- El nuevo sistema usa el campo `publishStatus` (`'pendiente'` | `'programado'` | `'publicado'`)
- Borradores creados antes de la implementación NO tienen este campo definido (`publishStatus: undefined`)
- Las consultas filtraban por `publishStatus: 'pendiente'`, excluyendo borradores antiguos

---

## ✅ Solución Implementada

Se aplicó retrocompatibilidad en **5 puntos críticos** del sistema:

### **1. Ruta de Programación Manual** (`/api/redactor-ia/programar/:id`)

**Archivo:** `server/redactor_ia/routes/redactorIA.js` (líneas ~1924-1927)

**Cambio:**
```javascript
// Inicializar publishStatus si no existe (retrocompatibilidad)
if (!draft.publishStatus) {
  draft.publishStatus = 'pendiente';
}
```

**Efecto:** Cuando se programa manualmente un borrador antiguo, se le asigna `publishStatus: 'pendiente'` antes de cambiar a `'programado'`.

---

### **2. Ruta de Programación Automática** (`/api/redactor-ia/auto-schedule`)

**Archivo:** `server/redactor_ia/routes/redactorIA.js` (líneas ~1966-1976)

**Antes:**
```javascript
const pendingDrafts = await AiDraft.find({
  publishStatus: 'pendiente',
  scheduledAt: null,
  publishedAs: null,
  reviewStatus: 'pending'
});
```

**Después:**
```javascript
const pendingDrafts = await AiDraft.find({
  scheduledAt: null,
  publishedAs: null,
  reviewStatus: 'pending',
  $or: [
    { publishStatus: 'pendiente' },
    { publishStatus: { $exists: false } } // ✅ Borradores antiguos
  ]
});
```

**Efecto:** Encuentra tanto borradores nuevos (`publishStatus: 'pendiente'`) como antiguos (sin el campo).

---

### **3. Scheduler de Publicaciones Automáticas**

**Archivo:** `server/jobs/draftPublishScheduler.js` (líneas ~82-89)

**Antes:**
```javascript
const borradores = await AiDraft.find({
  publishStatus: 'programado',
  scheduledAt: { $lte: now },
  publishedAs: null
});
```

**Después:**
```javascript
const borradores = await AiDraft.find({
  scheduledAt: { $lte: now },
  publishedAs: null,
  $or: [
    { publishStatus: 'programado' },
    { publishStatus: { $exists: false } } // ✅ Fallback
  ]
});
```

**Efecto:** Aunque los borradores deberían tener `publishStatus` al llegar aquí (porque pasan por las rutas que lo inicializan), esta consulta robusta previene errores.

---

### **4. Creación de Nuevos Borradores**

**Archivo:** `server/redactor_ia/services/redactor.js` (línea ~526)

**Cambio:**
```javascript
const draft = new AiDraft({
  // ... otros campos ...
  mode: (mode || 'factual').toLowerCase(),
  status: 'draft',
  reviewStatus: 'pending',
  publishStatus: 'pendiente', // ✅ NUEVO: Inicializar siempre
  tenantId: topic.tenantId || config.defaultTenant || 'levantatecuba',
  // ...
});
```

**Efecto:** Todos los borradores creados a partir de ahora tendrán `publishStatus: 'pendiente'` por defecto.

---

### **5. UI - Condición del Botón "Programar"**

**Archivo:** `src/admin_dashboard/redactor_ia/BorradoresIA.jsx` (líneas ~1040, ~1204)

**Antes:**
```jsx
{draft.publishStatus === 'pendiente' && !draft.scheduledAt ? (
  <button>Programar</button>
) : (
  <button>Ver</button>
)}
```

**Después:**
```jsx
{/* Mostrar Programar si: pendiente O sin publishStatus (antiguos) Y sin fecha programada */}
{(!draft.publishStatus || draft.publishStatus === 'pendiente') && !draft.scheduledAt ? (
  <button>Programar</button>
) : (
  <button>Ver</button>
)}
```

**Efecto:** El botón "Programar" aparece tanto para borradores nuevos como antiguos.

---

## 🧪 Validación de la Solución

### Escenarios Probados

| Escenario | Resultado Esperado | ✅ |
|-----------|-------------------|---|
| Borrador nuevo (con `publishStatus`) | Se puede programar automáticamente | ✅ |
| Borrador antiguo (sin `publishStatus`) | Se puede programar automáticamente | ✅ |
| Programación manual de borrador antiguo | Se asigna `publishStatus: 'pendiente'` → `'programado'` | ✅ |
| Recalcular programación con borradores antiguos | Los encuentra y programa | ✅ |
| Scheduler publica borrador programado | Se marca como `'publicado'` | ✅ |
| UI muestra botón Programar | Aparece para borradores con y sin campo | ✅ |

---

## 📊 Impacto de los Cambios

### Archivos Modificados
1. ✅ `server/redactor_ia/routes/redactorIA.js` (2 rutas)
2. ✅ `server/jobs/draftPublishScheduler.js` (1 consulta)
3. ✅ `server/redactor_ia/services/redactor.js` (creación de borradores)
4. ✅ `src/admin_dashboard/redactor_ia/BorradoresIA.jsx` (2 condiciones UI)

### Compatibilidad
- ✅ **Hacia atrás:** Borradores antiguos funcionan sin migración de base de datos
- ✅ **Hacia adelante:** Nuevos borradores incluyen el campo desde el inicio
- ✅ **Sin breaking changes:** Ninguna funcionalidad existente se rompe

---

## 🔍 Logs Esperados Después del Fix

### Antes del Fix
```
[API] Error en auto-programación: No hay borradores pendientes para programar
```

### Después del Fix
```
[API] 15 borradores programados automáticamente
```

### Programación Manual de Borrador Antiguo
```
[API] Borrador 673e8a... programado para: 12/11/2025 14:30:00
  → publishStatus inicializado: undefined → 'programado'
```

---

## 🎯 Recomendaciones Post-Fix

### Opcional: Migración de Base de Datos
Si quieres actualizar todos los borradores existentes de una vez:

```javascript
// Script de migración (ejecutar una sola vez)
const AiDraft = require('./server/models/AiDraft');

async function migratePublishStatus() {
  const result = await AiDraft.updateMany(
    { publishStatus: { $exists: false } },
    { $set: { publishStatus: 'pendiente' } }
  );
  console.log(`✅ ${result.modifiedCount} borradores actualizados`);
}

migratePublishStatus();
```

**Nota:** No es necesario ejecutar esto ya que el sistema funciona sin migración gracias a las consultas `$or`.

---

## 📝 Notas Técnicas

### Consultas MongoDB con `$or`
```javascript
{
  $or: [
    { publishStatus: 'pendiente' },
    { publishStatus: { $exists: false } }
  ]
}
```

Esto encuentra documentos donde:
- `publishStatus === 'pendiente'` (borradores nuevos)
- O `publishStatus` no existe en el documento (borradores antiguos)

### Operador `$exists`
- `{ $exists: false }` → El campo NO está definido en el documento
- `{ $exists: true }` → El campo SÍ está definido (independientemente de su valor)

---

## ✅ Checklist de Validación

- [x] Ruta `/programar/:id` inicializa `publishStatus` si no existe
- [x] Ruta `/auto-schedule` busca borradores con `$or`
- [x] Scheduler busca borradores con `$or`
- [x] Nuevos borradores se crean con `publishStatus: 'pendiente'`
- [x] UI muestra botón "Programar" para borradores sin campo
- [x] Indicadores visuales funcionan con borradores antiguos
- [x] No se rompe ninguna funcionalidad existente

---

## 🚀 Instrucciones de Despliegue

1. **Reiniciar servidor** para cargar los cambios del backend:
   ```bash
   npm run dev
   # o
   pm2 restart levantatecuba
   ```

2. **Verificar en UI:**
   - Ir a Configuración → Programación automática
   - Activar toggle
   - Clic en "Recalcular programación ahora"
   - Verificar toast de confirmación con número de borradores programados

3. **Verificar en Logs:**
   ```
   [API] 15 borradores programados automáticamente
   ```

---

## 📖 Documentación Actualizada

El archivo `SISTEMA_PROGRAMACION_AUTOMATICA_REDACTOR_IA.md` sigue siendo válido. Este fix añade retrocompatibilidad sin cambiar el comportamiento documentado.

---

**Fix implementado por:** Claude 4.5 Sonnet  
**Fecha:** 9 de Noviembre 2025  
**Versión:** 1.0.1 (Hotfix de retrocompatibilidad)
