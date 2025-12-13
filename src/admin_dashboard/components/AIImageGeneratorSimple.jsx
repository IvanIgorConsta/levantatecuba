import React, { useState } from "react";

/**
 * Generador de imágenes IA simplificado
 * - Solo genera portada principal
 * - Usa el mismo flujo directo de Redactor IA
 * - Sin opciones de estilo ni imagen secundaria
 */
export default function AIImageGeneratorSimple({
  newsId,
  title,
  content,
  onImageGenerated,
  disabled = false,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const canGenerate = !disabled && !isGenerating && title?.trim() && newsId;

  const generateCover = async () => {
    if (!canGenerate) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log('[AISimple] Generando portada para:', title?.substring(0, 50));
      
      const response = await fetch("/api/ai/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsId,
          title: title?.trim(),
          content: content?.trim() || '',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Error al generar portada");
      }
      
      if (data.coverUrl) {
        console.log('[AISimple] ✅ Portada generada:', data.coverUrl);
        onImageGenerated?.(data.coverUrl, data);
      } else {
        throw new Error("No se recibió URL de imagen");
      }
      
    } catch (err) {
      console.error('[AISimple] Error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <fieldset className="mt-6 border border-zinc-700 rounded-lg p-4">
      <legend className="px-2 text-white/80">Generar portada con IA</legend>

      {disabled && !title?.trim() && (
        <div className="mb-3 text-xs text-white/60">
          Completa el título para generar la portada con IA.
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          onClick={generateCover}
          disabled={!canGenerate}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white disabled:opacity-60 transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></span>
              Generando...
            </span>
          ) : (
            "Generar Portada IA"
          )}
        </button>
        
        <span className="text-xs text-white/40">
          Usa el título para crear una imagen relevante
        </span>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          {error}
        </div>
      )}
    </fieldset>
  );
}
