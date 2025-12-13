// src/admin_dashboard/components/TextDraftGenerator.jsx
import React, { useState } from "react";

export default function TextDraftGenerator({ onDraftGenerated }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("factual"); // 'factual' o 'opinion'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim() || text.trim().length < 100) {
      setError("El texto debe tener al menos 100 caracteres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/generar-desde-texto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          texto: text.trim(),
          mode: mode 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Error al generar borrador");
      }

      // Pasar los datos generados al componente padre
      onDraftGenerated({
        titulo: data.titulo || "",
        categoria: data.categoria || "",
        bajada: data.bajada || "",
        contenidoHtml: data.contenidoHtml || "",
        etiquetas: data.etiquetas || [],
      });

      // Limpiar texto después del éxito
      setText("");
      setError("");
      setExpanded(false);
      
    } catch (err) {
      console.error("Error generando borrador desde texto:", err);
      setError(err.message || "Error al generar el borrador");
    } finally {
      setLoading(false);
    }
  };

  const charCount = text.length;
  const isValidLength = charCount >= 100;

  return (
    <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <label className="text-sm text-zinc-400 cursor-pointer">
          📝 Generar desde texto (pegar noticia)
        </label>
        <span className="text-zinc-500 text-xs">
          {expanded ? "▲ Cerrar" : "▼ Expandir"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Área de texto */}
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pega aquí el texto de la noticia que deseas procesar con IA..."
              disabled={loading}
              rows={6}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
            />
            <div className={`text-xs mt-1 ${isValidLength ? 'text-zinc-500' : 'text-amber-500'}`}>
              {charCount} caracteres {!isValidLength && "(mínimo 100)"}
            </div>
          </div>

          {/* Selector de modo */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">Modo:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="draftMode"
                value="factual"
                checked={mode === "factual"}
                onChange={(e) => setMode(e.target.value)}
                disabled={loading}
                className="accent-red-500"
              />
              <span className="text-sm text-white">Factual</span>
              <span className="text-xs text-zinc-500">(estructura rígida)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="draftMode"
                value="opinion"
                checked={mode === "opinion"}
                onChange={(e) => setMode(e.target.value)}
                disabled={loading}
                className="accent-red-500"
              />
              <span className="text-sm text-white">Opinión</span>
              <span className="text-xs text-zinc-500">(más libre)</span>
            </label>
          </div>

          {/* Botón de generar */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !isValidLength}
              className="btn-primary text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando con IA..." : "Procesar con IA"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-xs">
              ❌ {error}
            </div>
          )}

          {/* Indicador de carga */}
          {loading && (
            <div className="text-xs text-zinc-500">
              ⏳ Procesando texto con IA... Esto puede tardar 15-30 segundos dependiendo del modo.
            </div>
          )}

          {/* Info sobre modos */}
          <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-2 mt-2">
            <strong>Factual:</strong> Genera artículo con secciones obligatorias (Contexto, Causa/Consecuencia, Por qué es importante, Qué viene después).
            <br />
            <strong>Opinión:</strong> Genera artículo con estructura más libre y tono editorial.
          </div>
        </div>
      )}
    </div>
  );
}
