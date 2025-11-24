# Scroll Infinito Solo en Móvil - Página de Noticias

**Fecha:** 16 de noviembre de 2025  
**Archivo modificado:** `src/pages/Noticias.jsx`  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Objetivo

Implementar scroll infinito SOLO en móvil (≤768px) sin modificar el diseño ni la estructura visual existente.

---

## 📋 Cambios implementados

### 1. Estado para detectar móvil

**Línea 27:**
```javascript
const [isMobile, setIsMobile] = useState(false);
```

---

### 2. Hook para detectar tamaño de pantalla

**Líneas 36-43:**
```javascript
// Detectar si estamos en móvil
useEffect(() => {
  const mq = window.matchMedia("(max-width: 768px)");
  const updateIsMobile = () => setIsMobile(mq.matches);
  updateIsMobile();
  mq.addEventListener("change", updateIsMobile);
  return () => mq.removeEventListener("change", updateIsMobile);
}, []);
```

**Características:**
- Usa `matchMedia` para detección responsive
- Se ejecuta al montar el componente
- Escucha cambios de tamaño de ventana
- Cleanup correcto del listener

---

### 3. IntersectionObserver condicional (solo móvil)

**Líneas 128-146:**
```javascript
// Scroll infinito activado SOLO en móvil
useEffect(() => {
  if (!isMobile) return; // Solo ejecutar en móvil

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => prev + 6);
      }
    },
    { threshold: 1 }
  );

  if (sentinelRef.current) {
    observer.observe(sentinelRef.current);
  }

  return () => observer.disconnect();
}, [isMobile]);
```

**Características:**
- Se ejecuta SOLO si `isMobile === true`
- Observa el elemento `sentinelRef`
- Incrementa `visibleCount` en +6 noticias
- Cleanup correcto del observer

---

### 4. Aplicar visibleCount solo en móvil

**Líneas 172-184:**
```javascript
// Paso 1: Ordenar las noticias filtradas
const noticiasOrdenadas = filtrarNoticias
  .sort((a, b) => {
    // 1º destacada, 2º fecha desc
    const byFeatured = (b.destacada === true) - (a.destacada === true);
    if (byFeatured !== 0) return byFeatured;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

// Paso 2: Aplicar slice SOLO en móvil para scroll infinito
const mostrarNoticias = isMobile
  ? noticiasOrdenadas.slice(0, visibleCount)
  : noticiasOrdenadas;
```

**Características:**
- Separado en 2 pasos claros
- `noticiasOrdenadas`: resultado del sort (sin modificar)
- `mostrarNoticias`: con slice solo si `isMobile === true`
- Desktop usa todas las noticias sin límite

---

## 🔄 Flujo completo

### Móvil (≤768px):

```
1. Usuario carga la página
         ↓
2. isMobile = true (detectado por matchMedia)
         ↓
3. IntersectionObserver activado
         ↓
4. mostrarNoticias = slice(0, 9) inicial
         ↓
5. Usuario hace scroll hasta el final
         ↓
6. Sentinel entra en viewport
         ↓
7. visibleCount aumenta de 9 → 15
         ↓
8. mostrarNoticias = slice(0, 15)
         ↓
9. Se renderizan más noticias en las secciones
         ↓
10. Repite desde paso 5
```

### Desktop (>768px):

```
1. Usuario carga la página
         ↓
2. isMobile = false
         ↓
3. IntersectionObserver NO se activa
         ↓
4. mostrarNoticias = todas las noticias
         ↓
5. Carrusel horizontal funciona normalmente
```

---

## ✅ Lo que NO se modificó

- ❌ Estructura de JSX
- ❌ Clases Tailwind
- ❌ Componentes (Carousel, NewsCard, etc.)
- ❌ Fetch de noticias (`/api/news?limit=1000`)
- ❌ Función `agruparNoticiasPorFecha()`
- ❌ Renderizado de secciones ("Hoy", "Esta semana", etc.)
- ❌ Vista de carrusel en tablet/desktop

---

## 📱 Comportamiento esperado

### En móvil:

**Inicial:**
- Página carga con 9 noticias totales (distribuidas en las secciones)
- Secciones "Hoy", "Esta semana", "Este mes", "Anteriores" visibles según contenido

**Al hacer scroll:**
- Usuario llega al final
- Sentinel (elemento invisible) entra en pantalla
- Se cargan +6 noticias más automáticamente
- Las nuevas noticias se distribuyen en sus secciones correspondientes
- Proceso se repite indefinidamente

**Apariencia:**
- Diseño idéntico al actual
- Lista vertical con gap de 6
- Sin cambios visuales, solo más contenido

---

### En desktop/tablet:

**Comportamiento:**
- Todas las noticias se muestran de inmediato
- Carrusel horizontal en cada sección
- Sin scroll infinito
- Sin cambios respecto a la versión actual

---

## 🔧 Detalles técnicos

### Estados utilizados:

```javascript
const [visibleCount, setVisibleCount] = useState(9);  // Existente, reutilizado
const [isMobile, setIsMobile] = useState(false);       // Nuevo
const sentinelRef = useRef(null);                      // Existente, reutilizado
```

### Breakpoint móvil:

```javascript
max-width: 768px  // Coincide con Tailwind sm: breakpoint
```

### Incremento por carga:

```javascript
+6 noticias  // Cada vez que el sentinel entra en viewport
```

### Valor inicial:

```javascript
9 noticias  // Primera carga en móvil
```

---

## 🧪 Cómo verificar

### Paso 1: Probar en móvil

1. Abrir navegador en modo responsive (≤768px)
2. Navegar a `/noticias`
3. Verificar que solo se muestran ~9 noticias inicialmente
4. Hacer scroll hasta el final
5. Verificar que aparecen más noticias
6. Repetir para confirmar que sigue cargando

### Paso 2: Probar en desktop

1. Abrir navegador en modo desktop (>768px)
2. Navegar a `/noticias`
3. Verificar que se muestran TODAS las noticias
4. Verificar que el carrusel funciona correctamente
5. No debe haber scroll infinito

### Paso 3: Probar resize

1. Abrir en desktop
2. Reducir tamaño de ventana a móvil
3. Verificar que cambia a scroll infinito
4. Ampliar ventana a desktop
5. Verificar que muestra todas las noticias

---

## 📊 Ventajas de esta implementación

### Performance:

- ✅ Móvil: Solo renderiza las noticias necesarias
- ✅ Desktop: Mantiene comportamiento actual
- ✅ No afecta el tiempo de fetch (1000 noticias se descargan siempre)
- ✅ Mejora el rendering inicial en móvil

### UX:

- ✅ Móvil: Scroll natural e infinito
- ✅ Desktop: Sin cambios en la experiencia
- ✅ Transición suave al cambiar tamaño de ventana
- ✅ Sin "botones de cargar más"

### Mantenibilidad:

- ✅ Cambios mínimos y localizados
- ✅ No requiere librerías adicionales
- ✅ Usa estados existentes
- ✅ Compatible con estructura actual

---

## 🐛 Consideraciones

### Edge cases:

**1. Menos de 9 noticias totales:**
- Móvil: Muestra todas sin scroll infinito
- Desktop: Muestra todas normalmente

**2. Cambio de categoría/búsqueda:**
- `visibleCount` se resetea a 9
- Scroll infinito reinicia desde el principio

**3. Resize de ventana:**
- Cambio inmediato entre móvil/desktop
- IntersectionObserver se activa/desactiva correctamente

**4. Sentinel siempre visible:**
- No se incrementa infinitamente
- Solo cuando entra en viewport

---

## 📝 Resumen ejecutivo

**Cambios mínimos:**
- +1 estado (`isMobile`)
- +1 useEffect (detección móvil)
- Modificado 1 useEffect (IntersectionObserver condicional)
- Modificada lógica de `mostrarNoticias` (2 pasos con slice condicional)

**Sin cambios:**
- JSX estructura
- Clases Tailwind
- Componentes
- Fetch de datos
- Agrupado por fecha

**Resultado:**
- Móvil: Scroll infinito funcional y performante
- Desktop: Sin cambios, comportamiento idéntico
- Compatible con diseño responsive existente

---

**Última actualización:** 16 de noviembre de 2025  
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA PRUEBAS
