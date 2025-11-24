---
trigger: manual
---

{
  "rules": [
    {
      "scope": "workspace",
      "activation_mode": "auto",
      "description": "Reglas locales de LevántateCuba.",
      "prompt": "🧩 Contexto: proyecto LevántateCuba.\nStack: React + Express + MongoDB + TailwindCSS.\n\n🎯 Instrucciones específicas:\n- En tareas de código, devuelve siempre el archivo completo y listo para reemplazar.\n- No mezcles explicaciones con el código.\n- Mantén diseño visual profesional (modern TailwindCSS).\n- Usa imports existentes y conserva la lógica actual.\n- Si se pide actualizar un componente, analiza dependencias relacionadas.\n- Evita funciones duplicadas y comentarios obvios.\n- Prioriza estabilidad y compatibilidad sobre atajos.\n- Usa español profesional para comentarios o mensajes de error.\n\n🚫 No devuelvas texto introductorio, despedidas ni metaexplicaciones.\n✅ Devuelve solo resultados limpios y de producción."
    }
  ]
}
