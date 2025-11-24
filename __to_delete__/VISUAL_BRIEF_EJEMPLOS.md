# 📸 Visual Brief: Ejemplos Reales

## 📋 Casos de Uso

Ejemplos de cómo `generateVisualBrief()` analiza diferentes tipos de noticias y genera descripciones visuales optimizadas.

---

## Ejemplo 1: Noticia Política (Cuba)

### **Entrada:**

```javascript
{
  titulo: "Díaz-Canel pierde los estribos ante damnificada en Cuba",
  bajada: "El presidente cubano reaccionó airadamente durante un encuentro con ciudadanos afectados por el huracán Ian",
  contenido: "Durante una visita oficial a zonas afectadas por el huracán Ian, el presidente Miguel Díaz-Canel protagonizó un tenso intercambio con una mujer que reclamaba ayuda gubernamental. El incidente, capturado en video, muestra al mandatario elevando la voz mientras la ciudadana describe las precarias condiciones en que vive desde el paso del ciclón. La escena refleja la creciente frustración de la población cubana ante la lenta respuesta gubernamental a la crisis humanitaria generada por el desastre natural.",
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

### **Elementos visuales esperados:**

- ✅ Mujer cubana (protagonista contextual, no el político)
- ✅ Funcionario genérico (sin rostro de Díaz-Canel)
- ✅ Salón oficial deteriorado
- ✅ Bandera de Cuba (azul y roja)
- ✅ Símbolos del régimen
- ✅ Otros ciudadanos observando
- ✅ Tensión visual

---

## Ejemplo 2: Protesta Internacional

### **Entrada:**

```javascript
{
  titulo: "Protestas masivas en Francia por reforma de pensiones",
  bajada: "Miles de ciudadanos salen a las calles de París para rechazar el aumento de la edad de jubilación",
  contenido: "Una nueva jornada de protestas paralizó el centro de París este martes, con más de 500,000 manifestantes según cifras de los sindicatos. Los ciudadanos rechazan la propuesta del gobierno de elevar la edad de jubilación de 62 a 64 años. Las protestas incluyeron bloqueos a refinerías, huelgas en el transporte público y enfrentamientos con la policía en las principales avenidas de la capital francesa.",
  etiquetas: ["Francia", "protestas", "pensiones", "manifestación", "huelga"]
}
```

### **Salida del LLM (visualBrief):**

```
"Multitud de manifestantes franceses con pancartas en alto en las calles de París. De fondo, banderas tricolores francesas ondeando y humo de barricadas. La multitud avanza con determinación, algunos con chalecos reflectantes. Atmósfera de tensión social y energía de protesta. Estilo cómic con colores vivos y trazos dinámicos."
```

### **Elementos visuales esperados:**

- ✅ Multitud de manifestantes
- ✅ Pancartas en alto (sin texto legible)
- ✅ Banderas francesas (tricolor)
- ✅ Humo de barricadas
- ✅ Chalecos reflectantes (amarillos)
- ✅ Atmósfera de tensión social
- ❌ SIN políticos específicos

---

## Ejemplo 3: Crisis Económica

### **Entrada:**

```javascript
{
  titulo: "Venezuela enfrenta nueva crisis de combustible",
  bajada: "Largas colas en estaciones de servicio mientras escasea la gasolina en todo el país",
  contenido: "La crisis de combustible en Venezuela se agudizó esta semana con filas de vehículos que se extienden por kilómetros en las principales ciudades. A pesar de contar con las mayores reservas de petróleo del mundo, el país sudamericano enfrenta una severa escasez de gasolina debido al colapso de su infraestructura petrolera y las sanciones internacionales. Los ciudadanos reportan esperas de hasta 12 horas para llenar sus tanques.",
  etiquetas: ["Venezuela", "crisis", "combustible", "economía", "escasez"]
}
```

### **Salida del LLM (visualBrief):**

```
"Larga fila de vehículos esperando en una estación de servicio deteriorada bajo el sol ardiente. Ciudadanos cansados esperan junto a sus autos con bidones vacíos. De fondo, infraestructura petrolera oxidada y banderas venezolanas. Colores cálidos y secos, sensación de espera interminable. Estilo cómic editorial con trazos expresivos."
```

### **Elementos visuales esperados:**

- ✅ Fila de vehículos
- ✅ Estación de servicio deteriorada
- ✅ Ciudadanos esperando
- ✅ Bidones vacíos
- ✅ Infraestructura oxidada
- ✅ Bandera de Venezuela
- ✅ Sensación de espera y frustración

---

## Ejemplo 4: Tecnología

### **Entrada:**

```javascript
{
  titulo: "OpenAI lanza GPT-5 con capacidades revolucionarias",
  bajada: "El nuevo modelo supera a su predecesor en razonamiento y puede procesar videos en tiempo real",
  contenido: "OpenAI presentó oficialmente GPT-5, su modelo de inteligencia artificial más avanzado hasta la fecha. La nueva versión incorpora capacidades multimodales mejoradas, incluyendo procesamiento de video en tiempo real, razonamiento lógico avanzado y generación de código más preciso. La empresa afirma que GPT-5 representa un salto cualitativo en el desarrollo de IA general, acercándose a capacidades cognitivas humanas en múltiples dominios.",
  etiquetas: ["tecnología", "inteligencia artificial", "OpenAI", "GPT-5", "innovación"]
}
```

### **Salida del LLM (visualBrief):**

```
"Escena futurista con múltiples pantallas holográficas mostrando código, imágenes y videos procesándose simultáneamente. En el centro, un cerebro digital interconectado con circuitos luminosos. Ambiente tecnológico limpio con tonos azules y verdes neón. Estilo cómic de ciencia ficción con detalles precisos y composición dinámica."
```

### **Elementos visuales esperados:**

- ✅ Pantallas holográficas
- ✅ Código en pantallas (no legible)
- ✅ Cerebro digital
- ✅ Circuitos luminosos
- ✅ Tonos azules y verdes
- ✅ Ambiente futurista
- ❌ SIN logos de OpenAI

---

## Ejemplo 5: Desastre Natural

### **Entrada:**

```javascript
{
  titulo: "Terremoto de 7.8 grados devasta Turquía y Siria",
  bajada: "Miles de personas atrapadas bajo escombros tras el potente sismo que sacudió la región",
  contenido: "Un devastador terremoto de magnitud 7.8 golpeó la frontera entre Turquía y Siria en la madrugada del lunes, dejando miles de edificios colapsados y un número creciente de víctimas. Equipos de rescate trabajan contrarreloj para localizar sobrevivientes entre los escombros mientras las temperaturas bajo cero dificultan las labores. La ONU estima que millones de personas necesitarán asistencia humanitaria en las próximas semanas.",
  etiquetas: ["terremoto", "Turquía", "Siria", "desastre natural", "rescate"]
}
```

### **Salida del LLM (visualBrief):**

```
"Equipos de rescate buscando entre escombros de edificios colapsados al amanecer. Figuras humanas con chalecos naranjas y cascos amarillos trabajan con herramientas. De fondo, más edificios dañados y humo. Atmósfera dramática con tonos grises y naranjas del amanecer. Banderas turcas y sirias visibles entre los escombros. Estilo cómic periodístico con urgencia y esperanza."
```

### **Elementos visuales esperados:**

- ✅ Equipos de rescate
- ✅ Edificios colapsados
- ✅ Escombros
- ✅ Chalecos naranjas, cascos amarillos
- ✅ Amanecer dramático
- ✅ Banderas turcas y sirias
- ✅ Sensación de urgencia y esperanza

---

## Ejemplo 6: Migración

### **Entrada:**

```javascript
{
  titulo: "Crisis migratoria en la frontera México-EEUU alcanza niveles récord",
  bajada: "Más de 200,000 cruces irregulares registrados en un solo mes según autoridades",
  contenido: "Las autoridades estadounidenses reportaron cifras récord de cruces irregulares en la frontera con México durante el último mes, con más de 200,000 detenciones. Las familias centroamericanas representan el mayor porcentaje de migrantes, huyendo de la violencia y la pobreza en sus países de origen. Los albergues fronterizos están saturados y organizaciones humanitarias advierten sobre una crisis humanitaria en desarrollo.",
  etiquetas: ["migración", "frontera", "México", "EEUU", "crisis humanitaria"]
}
```

### **Salida del LLM (visualBrief):**

```
"Familias migrantes con mochilas y niños caminando por un paisaje árido hacia un horizonte incierto. De fondo, muro fronterizo y torres de vigilancia. Colores cálidos del desierto, sensación de esperanza y determinación mezclada con incertidumbre. Banderas mexicana y estadounidense visibles en elementos del paisaje. Estilo cómic humanista con rostros genéricos pero expresivos."
```

### **Elementos visuales esperados:**

- ✅ Familias migrantes
- ✅ Mochilas, niños
- ✅ Paisaje árido del desierto
- ✅ Muro fronterizo
- ✅ Torres de vigilancia
- ✅ Banderas de México y EEUU
- ✅ Esperanza y determinación
- ❌ SIN rostros identificables

---

## 📊 Patrón Común en las Descripciones

El LLM consistentemente:

1. **Identifica protagonistas contextuales** - Víctimas, afectados, manifestantes (no políticos)
2. **Incluye símbolos relevantes** - Banderas, edificios, tecnología, naturaleza
3. **Captura la emoción** - Tensión, urgencia, esperanza, frustración
4. **Define paleta de colores** - Cálidos/fríos según el tema
5. **Evita nombres específicos** - "Un funcionario", "equipos de rescate", "manifestantes"
6. **Sugiere estilo visual** - Cómic editorial, tonos específicos, líneas expresivas

---

## ✅ Beneficios Observados

### **1. Coherencia temática**
Todas las descripciones capturan la esencia del tema sin necesidad de reglas específicas por categoría.

### **2. Riqueza de detalles**
El LLM sugiere elementos visuales específicos (chalecos naranjas, cascos amarillos, humo, banderas) que enriquecen la imagen.

### **3. Evita nombres naturalmente**
Sin listas de políticos o figuras públicas, el LLM entiende la instrucción de no mencionar nombres específicos.

### **4. Adaptabilidad**
Funciona igual de bien para política, tecnología, desastres, economía, etc.

---

**Conclusión:** El enfoque de visual brief generado por LLM es superior a reglas hardcodeadas en todos los aspectos: calidad, coherencia, mantenibilidad y escalabilidad.
