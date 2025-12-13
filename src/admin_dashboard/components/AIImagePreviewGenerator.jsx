// src/admin_dashboard/components/AIImagePreviewGenerator.jsx
import React, { useState } from "react";

/**
 * Generador de imágenes IA para preview (antes de crear noticia)
 * Usa el mismo módulo que Redactor IA
 */
export default function AIImagePreviewGenerator({
  title,
  content,
  onImageGenerated,
  disabled = false,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const canGenerate = !disabled && !isGenerating && title?.trim();

  const generateCover = async () => {
    if (!canGenerate) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log('[AIPreview] Generando portada para:', title?.substring(0, 50));
      
      const token = localStorage.getItem("token");
      const response = await fetch("/api/ai/generate-cover-preview", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title?.trim(),
          content: content?.trim() || '',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Error al generar portada");
      }
      
      if (data.coverUrl) {
        console.log('[AIPreview] ✅ Portada generada:', data.coverUrl);
        onImageGenerated?.(data.coverUrl);
      } else {
        throw new Error("No se recibió URL de imagen");
      }
      
    } catch (err) {
      console.error('[AIPreview] Error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm text-zinc-400">
            🎨 Generar portada con IA
          </label>
          {!title?.trim() && (
            <p className="text-xs text-zinc-500 mt-1">
              Completa el título para generar la portada
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={generateCover}
          disabled={!canGenerate}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-xs">
          ❌ {error}
        </div>
      )}

      {isGenerating && (
        <div className="mt-2 text-xs text-zinc-500">
          ⏳ Generando imagen con IA... Esto puede tardar 10-20 segundos
        </div>
      )}
    </div>
  );
}
