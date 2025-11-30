// ============================================================================
// BOTÓN DE DONACIÓN – CTA moderno (sin ícono) para LevántateCuba
// Mantiene la integración existente con Stripe Checkout vía /api/donate
// ============================================================================

import { useState } from "react";

export default function DonateButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDonate = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10 }), // mismo monto fijo (USD)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error procesando la donación");
      if (!data?.url) throw new Error("No se pudo crear la sesión de pago");

      window.location.href = data.url; // Stripe Checkout
    } catch (e) {
      console.error("[DonateButton] Error:", e);
      setError("No se pudo procesar la donación. Intenta nuevamente.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CTA centrado */}
      <div className="flex justify-center mt-8">
        <button
          onClick={handleDonate}
          disabled={loading}
          aria-label="Apoyar este proyecto con una donación"
          aria-busy={loading}
          className="
            relative inline-flex items-center justify-center
            px-8 py-3 rounded-full
            font-semibold tracking-wide text-white
            bg-gradient-to-r from-red-600 to-red-500
            shadow-[0_0_20px_rgba(239,68,68,0.35)]
            transition-all duration-300
            hover:shadow-[0_0_32px_rgba(239,68,68,0.55)]
            hover:scale-[1.03] active:scale-[0.98]
            disabled:opacity-60 disabled:cursor-not-allowed
            outline-none focus-visible:ring-4 focus-visible:ring-red-500/30
            before:absolute before:inset-0 before:rounded-full
            before:bg-white/0 hover:before:bg-white/5 before:transition-colors
            animate-[subtlePulse_2.8s_ease-in-out_infinite]
          "
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0c-5.523 0-10 4.477-10 10h2z"
                />
              </svg>
              Procesando…
            </span>
          ) : (
            <span className="leading-none">Apoyar</span>
          )}
        </button>
      </div>

      {/* Toast de error accesible */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div
            className="
              fixed bottom-4 right-4 left-4 sm:left-auto
              max-w-sm mx-auto sm:mx-0 z-50
              bg-red-900/90 text-white backdrop-blur
              px-4 py-3 rounded-lg shadow-lg
            "
            role="alert"
          >
            <p className="font-medium">Error de donación</p>
            <p className="text-sm opacity-90 mt-0.5">{error}</p>
          </div>
        )}
      </div>

      {/* Animación sutil del CTA */}
      <style>{`
        @keyframes subtlePulse {
          0%,
          100% {
            transform: translateZ(0) scale(1);
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.35);
          }
          50% {
            transform: translateZ(0) scale(1.01);
            box-shadow: 0 0 28px rgba(239, 68, 68, 0.5);
          }
        }
      `}</style>
    </>
  );
}
