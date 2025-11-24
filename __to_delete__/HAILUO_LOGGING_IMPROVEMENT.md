# 🔍 Mejoras de logging y parseo para Hailuo (MiniMax)

**Fecha:** 15 de noviembre de 2025  
**Problema:** Hailuo caía siempre en placeholder porque no encontraba la imagen en la respuesta  
**Estado:** ✅ MEJORADO - Ahora con logging detallado y parseo flexible

---

## 🎯 Problema identificado

El código anterior esperaba que MiniMax devolviera la respuesta en un formato específico:

```javascript
const imageUrls = response.data?.data?.image_urls;
```

Si MiniMax usaba una estructura diferente, el código lanzaba inmediatamente:
```
Error: No se recibió imagen en la respuesta de MiniMax
```

**Sin ningún contexto** de qué había devuelto realmente MiniMax, haciendo imposible debuggear el problema.

---

## ✅ Mejoras implementadas

### 1. **Logging detallado de respuesta HTTP** 📡

**Ahora se loguea:**
- Status HTTP: `200 OK`, `400 Bad Request`, etc.
- Keys principales de `response.data`
- Campos específicos de MiniMax: `code`, `message`, `base_resp`

**Ejemplo de logs:**
```
[ImageProvider:Hailuo] 📡 HTTP status=200 OK
[ImageProvider:Hailuo] 📦 Response keys: [code, message, data]
[ImageProvider:Hailuo] 📋 data keys: [task_id, images, created_at]
[ImageProvider:Hailuo] 📊 code=0
```

### 2. **Parseo flexible de imagen** 🎯

**Antes:** Solo buscaba en `response.data.data.image_urls[0]`

**Ahora:** Intenta **10 rutas diferentes** para encontrar la URL de la imagen:

```javascript
const urlPaths = [
  response.data?.data?.image_urls?.[0],           // Minimax format 1
  response.data?.image_urls?.[0],                 // Minimax format 2
  response.data?.data?.images?.[0]?.url,          // Minimax format 3
  response.data?.images?.[0]?.url,                // Format 4
  response.data?.result?.images?.[0]?.url,        // Format 5
  response.data?.data?.url,                       // Format 6
  response.data?.url,                             // Format 7
  response.data?.data?.[0]?.url,                  // Format 8
  response.data?.data?.file_url,                  // Format 9
  response.data?.file_url                         // Format 10
];
```

**Y también busca base64** si no hay URL:
```javascript
const base64Paths = [
  response.data?.data?.image_base64,
  response.data?.image_base64,
  response.data?.data?.images?.[0]?.base64,
  response.data?.images?.[0]?.base64,
  response.data?.result?.image_base64,
  response.data?.data?.b64,
  response.data?.b64
];
```

**Log cuando encuentra la imagen:**
```
[ImageProvider:Hailuo] 🎯 URL encontrada en: https://file.minimax.chat/...
```

### 3. **Detección de errores de MiniMax** ❌

**Ahora detecta errores explícitos de la API:**

```javascript
if (response.data?.code && response.data.code !== 0) {
  throw new Error(`MiniMax API error: code=${response.data.code}, message="${errorMsg}"`);
}
```

**Log de error:**
```
[ImageProvider:Hailuo] ❌ Error: MiniMax API error: code=1002, message="Invalid API key"
```

### 4. **Error detallado si no se encuentra imagen** 📋

**Si después de buscar en todas las rutas no hay imagen:**

```
[ImageProvider:Hailuo] ❌ No se encontró imagen en la respuesta
[ImageProvider:Hailuo] 📋 Estructura completa de response.data:
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123",
    "status": "processing"
  }
}
```

**Esto te permite ver EXACTAMENTE qué devolvió MiniMax.**

### 5. **Logging mejorado de errores HTTP** 🔍

**En el bloque `catch`, ahora loguea:**

```javascript
// Si hay respuesta HTTP (400, 401, 500, etc.)
console.error(`[ImageProvider:Hailuo] 📡 HTTP status=401 Unauthorized`);
console.error(`[ImageProvider:Hailuo] 📦 Response data keys: [code, message, error]`);
console.error(`[ImageProvider:Hailuo] 📊 MiniMax error code=1001`);
console.error(`[ImageProvider:Hailuo] 💬 MiniMax message="Invalid API key"`);
console.error(`[ImageProvider:Hailuo] 📋 Response data: {"code":1001,"message":"Invalid API key"...`);

// Si no hay respuesta (timeout, red caída)
console.error(`[ImageProvider:Hailuo] 🚫 No se recibió respuesta del servidor (timeout o red)`);
```

---

## 📊 Logs esperados según escenarios

### ✅ Escenario 1: Éxito (MiniMax devuelve imagen)

```
[ImageProvider:Hailuo] Generando con MiniMax Image API
[ImageProvider:Hailuo] ✅ Usando prompt contextual desde builder
[ImageProvider:Hailuo] prompt_len=350
[ImageProvider:Hailuo] 📡 HTTP status=200 OK
[ImageProvider:Hailuo] 📦 Response keys: [code, message, data]
[ImageProvider:Hailuo] 📋 data keys: [images, task_id, created_at]
[ImageProvider:Hailuo] 📊 code=0
[ImageProvider:Hailuo] 🎯 URL encontrada en: https://file.minimax.chat/...
[ImageProvider:Hailuo] ✅ Imagen generada (URL): https://file.minimax.chat/...
[ImageProvider:Hailuo] ✅ Imagen descargada y convertida a buffer (523.4KB)
```

### ❌ Escenario 2: API Key inválida

```
[ImageProvider:Hailuo] Generando con MiniMax Image API
[ImageProvider:Hailuo] ❌ Error: MiniMax API error: code=1001, message="Invalid API key"
[ImageProvider:Hailuo] 📡 HTTP status=401 Unauthorized
[ImageProvider:Hailuo] 📦 Response data keys: [code, message]
[ImageProvider:Hailuo] 📊 MiniMax error code=1001
[ImageProvider:Hailuo] 💬 MiniMax message="Invalid API key"
[ImageProvider:Hailuo] 🔄 Fallback a placeholder...
```

### ⚠️ Escenario 3: Cuota agotada

```
[ImageProvider:Hailuo] Generando con MiniMax Image API
[ImageProvider:Hailuo] ❌ Error: MiniMax API error: code=1013, message="Quota exceeded"
[ImageProvider:Hailuo] 📡 HTTP status=429 Too Many Requests
[ImageProvider:Hailuo] 📊 MiniMax error code=1013
[ImageProvider:Hailuo] 💬 MiniMax message="Quota exceeded"
[ImageProvider:Hailuo] 🔄 Fallback a placeholder...
```

### 🔍 Escenario 4: Respuesta inesperada (tarea asíncrona, formato desconocido)

```
[ImageProvider:Hailuo] Generando con MiniMax Image API
[ImageProvider:Hailuo] 📡 HTTP status=200 OK
[ImageProvider:Hailuo] 📦 Response keys: [code, message, data]
[ImageProvider:Hailuo] 📋 data keys: [task_id, status]
[ImageProvider:Hailuo] 📊 code=0
[ImageProvider:Hailuo] ❌ No se encontró imagen en la respuesta
[ImageProvider:Hailuo] 📋 Estructura completa de response.data:
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123",
    "status": "processing"
  }
}
[ImageProvider:Hailuo] ❌ Error: No se encontró URL ni base64 de imagen en la respuesta de MiniMax. Ver logs para detalles.
[ImageProvider:Hailuo] 🔄 Fallback a placeholder...
```

---

## 🧪 Cómo usar esta información

### Paso 1: Ejecutar el test

```bash
node server/redactor_ia/test-hailuo.js
```

### Paso 2: Analizar los logs

**Busca las líneas que empiezan con `[ImageProvider:Hailuo]`:**

1. **Si ves `📡 HTTP status=200 OK`:**
   - ✅ La conexión con MiniMax funciona
   - La API key es válida
   - Continúa leyendo...

2. **Si ves `📊 code=0`:**
   - ✅ MiniMax procesó la request correctamente
   - Continúa leyendo...

3. **Si ves `🎯 URL encontrada en:`:**
   - ✅ El parseo funcionó
   - La imagen debería descargarse correctamente

4. **Si ves `❌ No se encontró imagen`:**
   - ⚠️ MiniMax devolvió una respuesta inesperada
   - Lee la línea `📋 Estructura completa de response.data:`
   - Identifica en qué campo está la imagen
   - **Contacta con soporte o ajusta el parseo**

5. **Si ves `📊 MiniMax error code=...`:**
   - ❌ Error de la API de MiniMax
   - Lee el `💬 MiniMax message=...` para saber qué pasó
   - Posibles causas:
     - API key inválida (`code=1001`)
     - Cuota agotada (`code=1013`)
     - Parámetros inválidos (`code=1002`)
     - Etc.

6. **Si ves `🚫 No se recibió respuesta`:**
   - ❌ Problema de red o timeout
   - Verifica tu conexión a internet
   - Verifica que `MINIMAX_IMAGE_BASE_URL` sea correcto

---

## 🔧 Posibles ajustes según logs

### Si MiniMax devuelve la imagen en un campo diferente:

**Ejemplo:** La imagen está en `response.data.result.file_url` pero no está en la lista.

**Solución:** Añadir esa ruta al array `urlPaths` en `imageProvider.js`:

```javascript
const urlPaths = [
  // ... rutas existentes ...
  response.data?.result?.file_url,  // ← Añadir aquí
];
```

### Si MiniMax usa tarea asíncrona (polling):

**Si los logs muestran:**
```json
{
  "task_id": "abc123",
  "status": "processing"
}
```

**Entonces MiniMax NO devuelve la imagen inmediatamente.** Necesitas:
1. Guardar el `task_id`
2. Hacer polling cada X segundos a un endpoint tipo `/task/status/{task_id}`
3. Cuando `status === 'completed'`, obtener la URL

**Esto requeriría cambios más profundos en el código** (no implementado aún).

---

## 📁 Archivos modificados

- ✅ `server/redactor_ia/services/imageProvider.js` - Función `providerHailuo()`
  - **Líneas 909-989:** Logging detallado de respuesta y parseo flexible
  - **Líneas 1037-1077:** Logging detallado de errores

---

## 🎯 Resumen

**Antes:**
```
[ImageProvider:Hailuo] Error: No se recibió imagen en la respuesta de MiniMax
```
👎 Sin contexto, imposible debuggear

**Ahora:**
```
[ImageProvider:Hailuo] 📡 HTTP status=200 OK
[ImageProvider:Hailuo] 📦 Response keys: [code, message, data]
[ImageProvider:Hailuo] 📋 data keys: [task_id, status]
[ImageProvider:Hailuo] 📊 code=0
[ImageProvider:Hailuo] ❌ No se encontró imagen en la respuesta
[ImageProvider:Hailuo] 📋 Estructura completa de response.data:
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "abc123",
    "status": "processing"
  }
}
```
👍 **Contexto completo, fácil de debuggear**

---

## ✅ Próximos pasos

1. **Ejecutar test:** `node server/redactor_ia/test-hailuo.js`
2. **Leer logs** completos del servidor
3. **Identificar** exactamente qué devuelve MiniMax
4. **Ajustar** el parseo si es necesario (o contactar con soporte de MiniMax)
5. **Generar imagen** desde el Redactor IA para probar en producción

---

**Última actualización:** 15 de noviembre de 2025  
**Estado:** ✅ LISTO PARA DEBUGGEAR CON INFORMACIÓN COMPLETA
