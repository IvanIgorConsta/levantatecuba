// src/admin_dashboard/components/TextDraftGenerator.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TextDraftGenerator({ onDraftGenerated }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("factual"); // 'factual' o 'opinion'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [success, setSuccess] = useState(null); // Para mostrar mensaje de éxito
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!text.trim() || text.trim().length < 100) {
      setError("El texto debe tener al menos 100 caracteres");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(null);

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

      // El borrador se crea en Redactor IA, mostrar mensaje de éxito
      setSuccess({
        titulo: data.titulo,
        draftId: data.draftId,
        message: data.message || 'Borrador creado en Redactor IA'
      });

      // Limpiar texto después del éxito
      setText("");
      setError("");
      
    } catch (err) {
      console.error("Error generando borrador desde texto:", err);
      setError(err.message || "Error al generar el borrador");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToRedactor = () => {
    navigate("/admin/redactor-ia?tab=borradores");
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
          ✨ Crear borrador desde texto
        </label>
        <span className="text-zinc-500 text-xs">
          {expanded ? "▲ Cerrar" : "▼ Expandir"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Mensaje de éxito */}
          {success && (
            <div className="p-4 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✅</span>
                <div className="flex-1">
                  <h4 className="text-emerald-400 font-medium mb-1">
                    ¡Borrador creado en Redactor IA!
                  </h4>
                  <p className="text-sm text-emerald-300/80 mb-2">
                    <strong>"{success.titulo}"</strong>
                  </p>
                  <p className="text-xs text-zinc-400 mb-3">
                    El borrador está listo para revisión. La imagen con IA se está generando automáticamente.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGoToRedactor}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Ir a Redactor IA →
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuccess(null)}
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                    >
                      Crear otro
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Formulario (solo si no hay éxito) */}
          {!success && (
            <>
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
                  ⏳ Procesando texto con IA y creando borrador en Redactor IA... Esto puede tardar 15-30 segundos.
                </div>
              )}

              {/* Info sobre modos */}
              <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-2 mt-2">
                <strong>Factual:</strong> Genera artículo con secciones obligatorias (Contexto, Causa/Consecuencia, Por qué es importante, Qué viene después).
                <br />
                <strong>Opinión:</strong> Genera artículo con estructura más libre y tono editorial.
                <br />
                <span className="text-cyan-600">📝 El borrador se creará en Redactor IA para revisión antes de publicar.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
