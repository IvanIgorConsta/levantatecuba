# Sistema de Programación Automática - Redactor IA

## 📅 Resumen

Sistema completo de programación automática de publicaciones para borradores del Redactor IA en LevántateCuba. Permite programar manualmente borradores individuales o distribuir automáticamente fechas de publicación según configuración de intervalo y franja horaria.

---

## 🎯 Funcionalidades Implementadas

### 1. **Programación Manual**
- Botón "Programar" reemplaza "Ver" cuando el borrador está en estado `pendiente` sin fecha programada
- Modal con selector `datetime-local` para elegir fecha/hora específica
- Validación de fecha futura
- Indicador visual de fecha programada en cada tarjeta de borrador

### 2. **Programación Automática**
- Distribuye automáticamente fechas de publicación a todos los borradores pendientes
- Respeta configuración de:
  - **Intervalo**: 5-120 minutos entre publicaciones (default: 10 min)
  - **Franja horaria**: Hora inicio y fin (default: 07:00 - 23:00)
- Si la hora actual está fuera de la franja, programa para el siguiente día
- Botón "Recalcular programación ahora" en Configuración

### 3. **Scheduler Automático**
- Se ejecuta cada minuto (cron: `0 * * * * *`)
- Busca borradores con `publishStatus = 'programado'` y `scheduledAt <= now`
- Publica automáticamente creando la noticia correspondiente
- Límite de 10 publicaciones por minuto para evitar saturación
- Logs detallados de cada publicación

---

## 📂 Archivos Modificados/Creados

### **Backend**

#### Modelos
- ✅ `server/models/AiDraft.js`
  - Añadidos: `scheduledAt`, `publishStatus` (`pendiente` | `programado` | `publicado`)

- ✅ `server/models/AiConfig.js`
  - Añadidos: `autoScheduleEnabled`, `autoScheduleInterval`, `autoScheduleStartHour`, `autoScheduleEndHour`

#### Rutas
- ✅ `server/redactor_ia/routes/redactorIA.js`
  - **POST** `/api/redactor-ia/programar/:id` - Programar borrador manualmente
  - **POST** `/api/redactor-ia/auto-schedule` - Distribuir fechas automáticamente
  - Actualizado: Añadidos campos de programación a `allowedFields` y parseo de valores

#### Schedulers
- ✅ `server/jobs/draftPublishScheduler.js` (NUEVO)
  - Scheduler dedicado para borradores IA programados
  - Se ejecuta cada minuto
  - Función `publishDraft()` replica lógica del endpoint manual
  - Manejo de errores robusto

#### Integración
- ✅ `server/server.js`
  - Inicialización del scheduler de borradores IA al arrancar el servidor

### **Frontend**

#### Componentes
- ✅ `src/admin_dashboard/redactor_ia/BorradoresIA.jsx`
  - Importado `Calendar` de lucide-react
  - Añadido estado `scheduleModal`
  - Función `handleSchedule()` para programar borradores
  - Botón "Programar" condicional (solo cuando `publishStatus === 'pendiente' && !scheduledAt`)
  - Modal compacto de programación con input `datetime-local`
  - Indicadores visuales de fecha programada debajo del título:
    - 🕐 **Programada**: fecha y hora (cyan)
    - ✅ **Publicada**: badge verde
  - Implementado tanto para móvil como desktop

- ✅ `src/admin_dashboard/redactor_ia/ConfiguracionIA.jsx`
  - Nueva sección "Programación automática" antes de Estadísticas
  - Controles:
    - Toggle: Activar programación automática
    - Select: Intervalo entre publicaciones (5-120 min)
    - Selects: Hora inicio y fin de franja horaria (0-23)
    - Botón: "Recalcular programación ahora"
    - Explicación de funcionamiento
  - Función `handleAutoSchedule()` para llamar endpoint
  - Campos añadidos al `payload` de guardar configuración

---

## 🔧 Configuración

### Variables de Entorno
No se requieren nuevas variables de entorno. Todo se configura desde la UI.

### Configuración por Defecto
```javascript
{
  autoScheduleEnabled: false,
  autoScheduleInterval: 10,      // minutos
  autoScheduleStartHour: 7,      // 07:00
  autoScheduleEndHour: 23        // 23:00
}
```

### Estados de Publicación
```javascript
publishStatus: {
  'pendiente',   // Borrador sin programar
  'programado',  // Fecha asignada, esperando publicación
  'publicado'    // Ya publicado como noticia
}
```

---

## 🚀 Flujo de Uso

### Programación Manual
1. Navegar a **Redactor IA** → **Borradores IA**
2. Filtrar por estado: `Borradores`
3. Hacer clic en **Programar** (solo visible si `publishStatus === 'pendiente'`)
4. Seleccionar fecha y hora futura
5. Guardar programación
6. El borrador muestra: `🕐 Programada: 12 nov 2025 – 14:30`
7. El scheduler publica automáticamente cuando llega la hora

### Programación Automática
1. Navegar a **Redactor IA** → **Configuración**
2. Sección "Programación automática"
3. Activar toggle: **Activar programación automática de publicaciones**
4. Configurar intervalo (ej: 10 minutos)
5. Configurar franja horaria (ej: 07:00 - 23:00)
6. Hacer clic en **Recalcular programación ahora**
7. El sistema distribuye fechas a todos los borradores pendientes
8. Toast de confirmación: `X borradores programados exitosamente`

### Comportamiento del Scheduler
```
Cada minuto:
  ├─ Buscar borradores con publishStatus='programado' y scheduledAt <= now
  ├─ Limitar a 10 borradores por ejecución
  ├─ Para cada borrador:
  │   ├─ Crear noticia con datos del borrador
  │   ├─ Marcar borrador como publicado
  │   └─ Log: ✅ Publicado: "Título..." → /noticia/{id}
  └─ Log: ✅ {N}/{M} borrador(es) IA publicado(s) automáticamente
```

---

## 📊 Logs Esperados

### Programación Manual
```
[API] Borrador 673e8a... programado para: 12/11/2025 14:30:00
```

### Programación Automática
```
[API] 15 borradores programados automáticamente
```

### Scheduler en Ejecución
```
🕐 Iniciando scheduler de borradores IA programados (cada minuto)...
✅ Scheduler de borradores IA iniciado correctamente

📅 Publicando 3 borrador(es) IA programado(s)...
  ✅ Publicado: "Cuba anuncia reformas económicas..." → /noticia/673e8b...
  ✅ Publicado: "Protestas en La Habana alcanzan..." → /noticia/673e8c...
  ✅ Publicado: "Gobierno cubano responde a críticas..." → /noticia/673e8d...
✅ 3/3 borrador(es) IA publicado(s) automáticamente
```

---

## ⚠️ Validaciones y Límites

### Programación Manual
- ✅ Fecha debe ser futura
- ✅ Solo borradores en estado `pendiente`
- ✅ No se permite reprogramar borradores ya publicados

### Programación Automática
- ✅ Requiere `autoScheduleEnabled = true`
- ✅ Solo afecta borradores con `publishStatus = 'pendiente'` y `scheduledAt = null`
- ✅ Solo borradores con `reviewStatus = 'pending'`
- ✅ Límite de 50 borradores por ejecución

### Scheduler
- ✅ Máximo 10 publicaciones por minuto
- ✅ Evita ejecuciones concurrentes
- ✅ Timezone: UTC (consistente con scheduler de noticias)

---

## 🎨 Diseño UI

### Botones
- **Programar**: `bg-indigo-600` con icono `Calendar`
- **Ver**: `bg-cyan-600` con icono `Eye` (aparece cuando ya está programado o publicado)

### Modal de Programación
- Fondo: `bg-zinc-900` con borde `border-zinc-700`
- Input: `datetime-local` con validación `min={now}`
- Botones: Cancelar (zinc) y Guardar (indigo)

### Indicadores de Estado
- **Programada**: `text-cyan-400` con icono `Clock`
- **Publicada**: `text-green-400` con icono `CheckCircle`

### Sección de Configuración
- Color: `text-amber-400` para destacar la sección
- Controles deshabilitados si toggle está OFF
- Botón "Recalcular": `bg-amber-600`
- Explicación contextual en caja amarilla

---

## 🧪 Testing Manual

### Programación Manual
1. Crear un borrador IA
2. Verificar que muestra botón "Programar"
3. Abrir modal y seleccionar fecha futura (ej: +5 minutos)
4. Guardar y verificar indicador "Programada: ..."
5. Esperar 5 minutos
6. Verificar que se publicó automáticamente
7. Revisar que el borrador muestra "✅ Publicada"

### Programación Automática
1. Tener 5+ borradores pendientes
2. Ir a Configuración → Programación automática
3. Activar toggle
4. Configurar intervalo: 5 minutos
5. Configurar franja: hora actual - hora actual + 2h
6. Hacer clic en "Recalcular programación ahora"
7. Verificar toast de confirmación
8. Ir a Borradores y verificar que muestran fechas programadas escalonadas cada 5 min
9. Esperar y verificar que se van publicando automáticamente

### Edge Cases
- ✅ Programar fuera de franja horaria → debe ir al siguiente día
- ✅ Borradores aprobados → siguen publicándose inmediatamente (no afectados)
- ✅ Reprogramar borrador → NO permitido (debe cancelar primero)
- ✅ Desactivar programación automática → borradores ya programados siguen su curso

---

## 📝 Notas Técnicas

### Compatibilidad
- ✅ Respeta flujo existente de borradores aprobados (publicación inmediata)
- ✅ No rompe el botón "Publicar" del modal PublishDraftModal
- ✅ Compatible con sistema de revisión por IA
- ✅ Mantiene auditoría completa (timestamps, usuario, etc.)

### Performance
- ✅ Scheduler usa índices en `publishStatus` y `scheduledAt`
- ✅ Límite de 10 publicaciones/minuto previene sobrecarga
- ✅ Query optimizado: `{ publishStatus: 'programado', scheduledAt: { $lte: now }, publishedAs: null }`

### Seguridad
- ✅ Rutas protegidas con `requireEditor` (admins + editores)
- ✅ Validación de fecha futura en backend
- ✅ Parseo seguro de valores numéricos (min/max)

---

## 🔮 Posibles Mejoras Futuras

1. **Cancelar programación**: Botón para desprogramar borradores individuales
2. **Editar fecha programada**: Modal para reprogramar sin cancelar
3. **Vista calendario**: Visualizar distribución de publicaciones programadas
4. **Notificaciones**: Alertar cuando se publique un borrador programado
5. **Estadísticas**: Métricas de borradores programados vs publicados manualmente
6. **Prioridad**: Sistema de priorización para adelantar/atrasar borradores
7. **Zonas horarias**: Soporte para múltiples timezones
8. **Rollback**: Opción de despublicar y volver a estado programado

---

## ✅ Checklist de Implementación

- [x] Actualizar modelo `AiDraft` con campos `scheduledAt` y `publishStatus`
- [x] Actualizar modelo `AiConfig` con configuración de auto-schedule
- [x] Crear scheduler `draftPublishScheduler.js`
- [x] Añadir rutas de programación al backend
- [x] Integrar scheduler en `server.js`
- [x] Modificar `BorradoresIA.jsx` con botón y modal
- [x] Añadir sección en `ConfiguracionIA.jsx`
- [x] Añadir indicadores visuales de estado
- [x] Actualizar allowlist de campos en ruta PATCH config
- [x] Parseo de valores en ruta PATCH config
- [x] Testing manual completo
- [x] Documentación completa

---

## 📧 Soporte

Para dudas o problemas con el sistema de programación automática, revisar:
- Logs del servidor: `[Scheduler]`, `[API]`
- Estado de configuración: `/api/redactor-ia/config`
- Estado de borradores: `/api/redactor-ia/drafts?status=draft`

---

**Implementado por:** Claude 4.5 Sonnet  
**Fecha:** Noviembre 2025  
**Versión:** 1.0.0
