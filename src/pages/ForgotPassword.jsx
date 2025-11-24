// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE_URL || '/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!email || loading) return;

    setMsg("");
    setLoading(true);

    try {
      // ✅ Usa el proxy de Vite en desarrollo
      const res = await fetch(`${API}/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "Error al enviar la solicitud.");
        setLoading(false);
        return;
      }

      toast.success("Solicitud enviada correctamente.");
      setEmail("");
      setMsg("Si el correo existe, recibirás instrucciones para restablecer tu contraseña.");
    } catch {
      setMsg("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Volver */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-white/70 hover:text-white"
          >
            <span className="mr-2">←</span> Volver al inicio
          </Link>
        </div>

        {/* Encabezado */}
        <header className="mb-8 text-center">
          <h1 className="mt-3 bg-gradient-to-r from-red-500 via-red-400 to-rose-400 bg-clip-text text-3xl font-extrabold text-transparent md:text-4xl">
            Restablecer contraseña
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/70">
            Ingresa tu correo y te enviaremos un enlace de recuperación.
          </p>
        </header>

        {/* Card estilo Romper */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg md:bg-white/10 md:backdrop-blur-md md:p-8">
          {msg && (
            <div className="mb-4 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
              {msg}
            </div>
          )}

          <form onSubmit={handleRequest} className="space-y-6" noValidate>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60"
                required
              />
            </div>

            <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading || !email}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ WebkitAppearance: "none", backgroundColor: "#dc2626" }}
              >
                {loading ? "Enviando…" : "Enviar solicitud"}
              </button>

              <div className="text-center text-sm text-white/70 sm:text-right">
                ¿Ya la recordaste?{" "}
                <Link to="/login" className="text-white hover:underline">
                  Inicia sesión
                </Link>
              </div>
            </div>

            <p className="pt-4 text-center text-xs text-white/50">
              Obligados al exilio… no hay abrazo que cierre lo que la dictadura parte.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
