# Instalación de dependencias para generación desde URL

## Dependencias requeridas

Para que funcione la generación de borradores desde URLs, necesitas instalar las siguientes dependencias:

```bash
npm install jsdom @mozilla/readability
```

## Descripción

- **jsdom**: Permite parsear y manipular HTML del lado del servidor (simula un DOM)
- **@mozilla/readability**: Biblioteca de Mozilla para extraer el contenido principal de páginas web (elimina ads, navegación, etc.)

## Uso

Una vez instaladas las dependencias, el sistema podrá:
1. Extraer contenido de URLs permitidas
2. Usar el LLM del Redactor IA para reescribir el contenido
3. Rellenar automáticamente título, categoría, bajada y contenido en el formulario de noticias

## Verificación

Después de instalar, reinicia el servidor backend:
```bash
npm run dev  # o el comando que uses para arrancar el servidor
```

El endpoint `/api/redactor-ia/generar-desde-url` debería funcionar correctamente.
