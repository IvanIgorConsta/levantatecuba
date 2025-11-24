// src/pages/ResetPassword.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL || '/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Lee el token del query string ?token=...
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token") || "";
    setToken(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!token) {
      setErr("Token inválido o ausente. Vuelve a solicitar el enlace.");
      return;
    }
    if (!password || !confirm) {
      setErr("Completa ambos campos de contraseña.");
      return;
    }
    if (password.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      // ✅ Usa el proxy de Vite en desarrollo
      const res = await fetch(`${API}/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErr(data?.error || "No se pudo cambiar la contraseña.");
        setLoading(false);
        return;
      }

      setMsg("Contraseña actualizada. Ya puedes iniciar sesión.");
      // Opcional: redirigir al login tras unos segundos
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch {
      setErr("No se pudo conectar con el servidor.");
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
            Definir nueva contraseña
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/70">
            Crea tu nueva contraseña para continuar.
          </p>
        </header>

        {/* Card estilo Romper */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg md:bg-white/10 md:backdrop-blur-md md:p-8">
          {msg && (
            <div className="mb-4 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
              {msg}
            </div>
          )}
          {err && (
            <div className="mb-4 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Nueva contraseña */}
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-white">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-20 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-white/70 hover:text-white"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Confirmación */}
            <div className="grid gap-2">
              <label htmlFor="confirm" className="text-sm font-medium text-white">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-20 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60"
                  placeholder="Repite la contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-white/70 hover:text-white"
                  aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                >
                  {showConfirm ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {/* Botón principal */}
            <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ WebkitAppearance: "none", backgroundColor: "#dc2626" }}
              >
                {loading ? "Guardando…" : "Guardar nueva contraseña"}
              </button>

              <div className="text-center text-sm text-white/70 sm:text-right">
                ¿Recordaste tu clave?{" "}
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
