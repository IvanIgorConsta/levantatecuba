# Modo Cuba Estricto - Implementación Completa

## Resumen

Se ha implementado un nuevo comportamiento para el **Modo Cuba estricto** en el Redactor IA de LevántateCuba. Cuando está activado, el sistema escanea directamente tres fuentes cubanas principales (CiberCuba, ElToque y Martí Noticias) sin pasar por NewsAPI ni filtros globales.

---

## Comportamiento

### Modo Cuba Estricto: OFF (comportamiento actual)
- Escaneo global con NewsAPI + RSS fallback
- Filtros de impacto, confianza, frescura, categoría
- Lógica completa de scoring y agrupación
- Múltiples fuentes internacionales

### Modo Cuba Estricto: ON (nuevo comportamiento)
- **Escaneo directo** de 3 fuentes cubanas verificadas
- **No usa NewsAPI**
- **Sin filtros complejos** de impacto/scoring
- **Ordenamiento estricto** por fecha de publicación (más reciente primero)
- **Límite configurable** (maxTopicsPerScan)
- **Ventana de frescura**: últimas 48 horas por defecto

---

## Arquitectura

### Backend

#### 1. Servicio de Escaneo Cuba Estricto
**Archivo**: `server/redactor_ia/services/cubaStrictScanner.js`

**Funciones principales**:
- `scanCubaStrict({ limit, hoursWindow })` - Función principal de escaneo
- `fetchCiberCubaArticles({ hoursWindow, limit })` - Helper para CiberCuba
- `fetchElToqueArticles({ hoursWindow, limit })` - Helper para ElToque
- `fetchMartiNoticiasArticles({ hoursWindow, limit })` - Helper para Martí Noticias
- `normalizeToTopics(rawArticles, tenantId)` - Normaliza artículos al formato AiTopic

**Características técnicas**:
- Parser RSS nativo sin dependencias externas
- Keep-alive HTTP agent para conexiones reutilizables
- Retry automático con backoff exponencial
- Timeout de 8 segundos por request
- Logs detallados por fuente

**RSS URLs probadas**:

**CiberCuba**:
- `https://www.cibercuba.com/rss.xml`
- `https://www.cibercuba.com/feeds/posts/default?alt=rss`

**ElToque**:
- `https://eltoque.com/rss.xml`
- `https://eltoque.com/feed`
- `https://eltoque.com/rss`

**Martí Noticias**:
- `https://www.martinoticias.com/api/zitqte$ovi`
- `https://www.martinoticias.com/api/zov_ojevpvi`
- `https://www.radiotelevisionmarti.com/api/zitqte$ovi`

#### 2. Integración en Endpoint de Escaneo
**Archivo**: `server/redactor_ia/routes/redactorIA.js`

**Endpoint**: `POST /api/redactor-ia/scan`

**Flujo condicional**:
```javascript
if (config.strictCuba) {
  // FLUJO CUBA ESTRICTO
  scanCubaStrict({ limit, hoursWindow })
} else {
  // FLUJO GLOBAL
  scanSources()
}
```

**Respuesta JSON (modo Cuba estricto)**:
```json
{
  "message": "Escaneo Cuba estricto iniciado",
  "mode": "cuba_estricto",
  "isScanning": true,
  "sources": ["CiberCuba", "ElToque", "Martí Noticias"]
}
```

#### 3. Formato de Temas Guardados
Compatible con el modelo `AiTopic`:
```javascript
{
  "tenantId": "levantatecuba",
  "idTema": "cuba_1732146812345_xyz",
  "tituloSugerido": "Título del artículo",
  "resumenBreve": "Resumen (máx 500 chars)",
  "fuentesTop": [{
    "medio": "CiberCuba",
    "titulo": "Título",
    "url": "https://...",
    "fecha": "2024-11-20T..."
  }],
  "categoriaSugerida": "General",
  "impacto": 70,
  "confianza": "Alta",
  "detectedAt": "2024-11-20T...",
  "status": "pending",
  "imageUrl": null,
  "metadata": {
    "recencia": 85,
    "consenso": 70,
    "autoridad": 90,
    "tendencia": 60,
    "relevanciaCuba": 100,
    "novedad": 75,
    "originMode": "cuba_estricto",
    "originSources": ["cibercuba"]
  }
}
```

---

### Frontend

#### 1. Configuración
**Archivo**: `src/admin_dashboard/redactor_ia/ConfiguracionIA.jsx`

**Switch actualizado**:
- **Label**: "Modo Cuba estricto (solo noticias relacionadas)"
- **Descripción**: "Si está activo, el escáner obtendrá exclusivamente noticias recientes desde fuentes cubanas principales (CiberCuba, ElToque y Martí Noticias), ignorando NewsAPI y otros países."

#### 2. Cola de Temas
**Archivo**: `src/admin_dashboard/redactor_ia/ColaTemas.jsx`

**Mensaje al iniciar escaneo**:
- Modo Cuba estricto: _"Escaneo Cuba estricto en progreso (CiberCuba, ElToque, Martí Noticias)..."_
- Modo normal: _"Escaneo en progreso..."_

---

## Logs de Depuración

### Logs esperados (escaneo exitoso)

```
[CubaEstricto] 🔒 Modo Cuba estricto activado
[CubaEstricto] Parámetros: limit=20, ventana=48h
[CubaScanner] 🇨🇺 Escaneando CiberCuba...
[CubaScanner] ✅ CiberCuba: 15 artículos recientes
[CubaScanner] 🇨🇺 Escaneando ElToque...
[CubaScanner] ✅ ElToque: 12 artículos recientes
[CubaScanner] 🇨🇺 Escaneando Martí Noticias...
[CubaScanner] ✅ Martí Noticias: 18 artículos recientes
[CubaEstricto] 📊 Artículos combinados: 45
[CubaEstricto] ✅ Temas generados: 20
[CubaEstricto] 📋 Desglose por fuente:
  - CiberCuba: 15
  - ElToque: 12
  - Martí Noticias: 18
[CubaEstricto] 💾 20 temas guardados en base de datos
[CubaEstricto] Tiempo total: 4.23s
[CubaEstricto] ⏱️  Tiempo total de escaneo: 4234ms
```

### Logs esperados (sin resultados)

```
[CubaEstricto] 🔒 Modo Cuba estricto activado
[CubaEstricto] Parámetros: limit=20, ventana=48h
[CubaScanner] 🇨🇺 Escaneando CiberCuba...
[CubaScanner] ❌ Error en CiberCuba (https://www.cibercuba.com/rss.xml): timeout
[CubaScanner] 🇨🇺 Escaneando ElToque...
[CubaScanner] ✅ ElToque: 0 artículos recientes
[CubaScanner] 🇨🇺 Escaneando Martí Noticias...
[CubaScanner] ✅ Martí Noticias: 0 artículos recientes
[CubaEstricto] 📊 Artículos combinados: 0
[CubaEstricto] ⚠️  No se encontraron artículos recientes
[CubaEstricto] ⏱️  Tiempo total de escaneo: 2156ms
```

### Logs API

```
[API] 🔒 Iniciando escaneo Cuba estricto...
[API] ✅ Escaneo Cuba estricto completado: 20 temas guardados
[API] 📋 Fuentes: CiberCuba, ElToque, Martí Noticias
```

---

## Estadísticas y Auditoría

El servicio registra cada escaneo en el sistema de estadísticas:

```javascript
await logScan({
  topicsFound: 20,
  scanType: 'cuba_estricto',
  sources: { 
    cibercuba: 15, 
    eltoque: 12, 
    martinoticias: 18 
  },
  duration: 4234,
  status: 'success',
  tenantId: 'levantatecuba'
});
```

---

## Configuración

### Variables relevantes en AiConfig

- `strictCuba` (Boolean): Activa/desactiva modo Cuba estricto
- `maxTopicsPerScan` (Number, 1-20): Límite de temas a generar
- `defaultTenant` (String): Tenant ID para multi-tenancy

### Parámetros ajustables en código

**En `cubaStrictScanner.js`**:
- `hoursWindow`: Ventana de frescura (por defecto 48h)
- `limit`: Límite de temas (toma valor de `maxTopicsPerScan`)
- `timeout`: Timeout HTTP (8000ms)
- `maxRetries`: Reintentos por fuente (2)

---

## Ventajas del Nuevo Modo

1. **Velocidad**: Escaneo directo sin llamadas a NewsAPI
2. **Relevancia**: 100% noticias cubanas de fuentes verificadas
3. **Simplicidad**: Sin scoring complejo, ordenamiento cronológico puro
4. **Confiabilidad**: Fuentes cubanas principales con alta autoridad
5. **Transparencia**: Logs detallados por fuente
6. **Auditoría**: Metadata incluye `originMode` y `originSources`

---

## Diferencias Clave vs Modo Global

| Aspecto | Modo Global | Modo Cuba Estricto |
|---------|-------------|-------------------|
| **Fuentes** | NewsAPI + RSS configurable | CiberCuba + ElToque + Martí |
| **Scoring** | 6 factores ponderados | Fijo (impacto=70, confianza=Alta) |
| **Filtros** | Múltiples (categoría, impacto, etc.) | Solo fecha (48h) |
| **Ordenamiento** | Score compuesto | Fecha publicación descendente |
| **Idiomas** | es + en (inteligente) | es (implícito en fuentes) |
| **API externa** | NewsAPI requerido | No usa APIs externas |
| **Agrupación** | Temas similares agrupados | 1 artículo = 1 tema |

---

## Mantenimiento

### Añadir una nueva fuente cubana

1. Crear helper en `cubaStrictScanner.js`:
```javascript
async function fetchNuevaFuenteArticles({ hoursWindow, limit }) {
  const rssUrls = ['https://nuevafuente.com/rss.xml'];
  // ... implementación similar
}
```

2. Actualizar `scanCubaStrict()`:
```javascript
const [cibercuba, eltoque, marti, nuevaFuente] = await Promise.all([
  fetchCiberCubaArticles(...),
  fetchElToqueArticles(...),
  fetchMartiNoticiasArticles(...),
  fetchNuevaFuenteArticles(...)
]);
```

3. Actualizar logs y exportaciones

### Debugging

**Activar logs verbose**:
```bash
DEBUG=redactor-ia:* npm start
```

**Variables de entorno útiles**:
```bash
DEBUG_CUBA_FILTER=true  # Para debugging del filtro Cuba (modo global)
NODE_ENV=development     # Para logs detallados
```

---

## Testing

### Test manual

1. Activar "Modo Cuba estricto" en Configuración
2. Ir a Cola de Temas
3. Pulsar "Escanear"
4. Verificar mensaje: _"Escaneo Cuba estricto en progreso..."_
5. Revisar logs del servidor
6. Verificar temas en Cola de Temas
7. Inspeccionar metadata de temas (debe tener `originMode: 'cuba_estricto'`)

### Test de fallback

1. Desconectar internet o bloquear RSS
2. Ejecutar escaneo Cuba estricto
3. Verificar que devuelve 0 temas sin crash
4. Verificar logs de error por fuente

---

## Archivos Modificados

### Backend
- ✅ **Nuevo**: `server/redactor_ia/services/cubaStrictScanner.js` (407 líneas)
- ✅ **Modificado**: `server/redactor_ia/routes/redactorIA.js` (+importación, +flujo condicional)

### Frontend
- ✅ **Modificado**: `src/admin_dashboard/redactor_ia/ConfiguracionIA.jsx` (texto descriptivo)
- ✅ **Modificado**: `src/admin_dashboard/redactor_ia/ColaTemas.jsx` (mensaje específico)

### Documentación
- ✅ **Nuevo**: `CUBA_STRICT_MODE_IMPLEMENTATION.md` (este archivo)

---

## Autor y Fecha

**Implementado por**: Agente Cascade  
**Fecha**: 20 de noviembre de 2024  
**Versión**: 1.0  
**Proyecto**: LevántateCuba - Redactor IA  

---

## Contacto para Soporte

Para dudas o mejoras, revisar:
- Logs del servidor en `/logs` o consola
- Estadísticas de escaneo en panel de Configuración
- Temas generados con metadata en Cola de Temas
