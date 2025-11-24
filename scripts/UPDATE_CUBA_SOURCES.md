# 🔧 Actualizar Fuentes Cubanas en Redactor IA

## Opción 1: Desde la UI (Recomendado)

1. Ve a: **http://localhost:5000/admin/redactor-ia**
2. Click en pestaña **"Configuración"**
3. En "Fuentes confiables", pega esta lista:

```
cibercuba.com
eltoque.com
14ymedio.com
diariodecuba.com
cubanet.org
martinoticias.com
adncuba.com
ddcuba.com
cubanosporelmundo.com
bbc.com
reuters.com
apnews.com
elpais.com
cnn.com
nytimes.com
miamiherald.com
```

4. Marca estas opciones:
   - ✅ **Modo Cuba Estricto**: ON
   - ✅ **Forzar solo fuentes confiables**: ON
   - ✅ **NewsAPI habilitado**: ON

5. Ajusta estos valores:
   - **Max temas por escaneo**: 20
   - **Ventana de frescura**: 24 horas
   - **Cap por fuente**: 5

6. Click **"Guardar Configuración"**

---

## Opción 2: Endpoint API (Rápido)

Con el servidor corriendo, ejecuta en PowerShell:

```powershell
cd C:\Dev\levantatecuba

# Actualizar configuración
node -e "
const axios = require('axios');
axios.patch('http://localhost:5000/api/redactor-ia/config', {
  trustedSources: [
    'cibercuba.com', 'eltoque.com', '14ymedio.com', 'diariodecuba.com',
    'cubanet.org', 'martinoticias.com', 'adncuba.com', 'ddcuba.com',
    'cubanosporelmundo.com', 'bbc.com', 'reuters.com', 'apnews.com',
    'elpais.com', 'cnn.com', 'nytimes.com', 'miamiherald.com'
  ],
  strictCuba: true,
  enforceSourceAllowlist: true,
  maxTopicsPerScan: 20,
  freshnessWindowHours: 24,
  perSourceCap: 5,
  newsApiEnabled: true
}, {
  headers: { 'Authorization': 'Bearer TU_TOKEN_AQUI' }
}).then(r => console.log('✅ Configuración actualizada:', r.data))
  .catch(e => console.error('❌ Error:', e.message));
"
```

*(Reemplaza `TU_TOKEN_AQUI` con tu token de admin)*

---

## Opción 3: Script con MongoDB corriendo

Si MongoDB está corriendo, ejecuta:

```bash
node scripts/config-redactor-cuba-sources.js
```

---

## Resultado Esperado

Tras la configuración, el próximo escaneo debería mostrar:

```
[Crawler] Domains en este batch: cibercuba.com, eltoque.com, 14ymedio.com...
[Crawler] Total artículos recopilados: 85-120
[Crawler] Modo Cuba estricto: 75-90 artículos después de filtro
[Crawler] Top fuentes:
  - cibercuba.com: 25 artículos
  - eltoque.com: 20 artículos
  - diariodecuba.com: 15 artículos
[Crawler] 15-20 temas seleccionados
```

---

## Verificar Configuración

En el panel de Redactor IA, verifica que muestre:
- ✅ 16 fuentes confiables configuradas
- ✅ Modo Cuba estricto: ACTIVO
- ✅ Max temas: 20
- ✅ Ventana: 24h
