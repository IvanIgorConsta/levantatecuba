// src/admin_dashboard/components/URLDraftGenerator.jsx
import React, { useState } from "react";

export default function URLDraftGenerator({ onDraftGenerated }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError("Por favor ingresa una URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/redactor-ia/generar-desde-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
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

      // Limpiar URL después del éxito
      setUrl("");
      setError("");
      
    } catch (err) {
      console.error("Error generando borrador desde URL:", err);
      setError(err.message || "Error al generar el borrador");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-2">
            🔗 Generar desde URL (solo texto)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://ejemplo.com/articulo"
            disabled={loading}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !url.trim()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors duration-200 whitespace-nowrap mt-7"
        >
          {loading ? "Generando..." : "Generar"}
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-xs">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="mt-2 text-xs text-zinc-500">
          ⏳ Extrayendo contenido y generando borrador... Esto puede tardar 10-20 segundos
        </div>
      )}

      <div className="mt-2 text-xs text-zinc-600">
        💡 Solo rellenará campos de texto (título, categoría, contenido). Las imágenes no se modificarán.
      </div>
    </div>
  );
}
