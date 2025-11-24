import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BackLink from "../components/BackLink";

export default function LoginUsuario() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || loading) return;

    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      const { token, user } = data;
      
      console.debug('[AUTH] login result', { status: res.status, hasToken: !!token, userId: user?._id, role: user?.role });
      
      // lógica existente
      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("user", JSON.stringify(user));

      // Disparar evento para actualizar Header
      window.dispatchEvent(new Event("auth:changed"));

      // redirección por rol
      if (user.role === "admin" || user.role === "editor") navigate("/admin", { replace: true });
      else navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setErrorMsg("Error en el servidor. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl">
        <BackLink to="/" label="Volver al inicio" />

        {/* Encabezado */}
        <header className="mb-8 text-center">
          <h1 className="mt-3 bg-gradient-to-r from-red-500 via-red-400 to-rose-400 bg-clip-text text-3xl font-extrabold text-transparent md:text-4xl">
            Inicia sesión
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/70">
            Accede con tu correo y contraseña.
          </p>
        </header>

        {/* Card estilo Romper */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg md:bg-white/10 md:backdrop-blur-md md:p-8">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Email */}
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                {t("email") || "Correo"}
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

            {/* Password */}
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-white">
                {t("password") || "Contraseña"}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-20 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60"
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

            {/* Botón principal (mismo rojo fijo que Romper) */}
            <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ WebkitAppearance: "none", backgroundColor: "#dc2626" }}
              >
                {loading ? "Ingresando…" : "Iniciar sesión"}
              </button>

              <div className="text-center text-sm text-white/70 sm:text-right">
                ¿No tienes cuenta?{" "}
                <a href="/registro" className="text-white hover:underline">
                  Crear cuenta
                </a>
                {"  •  "}
                <a href="/forgot-password" className="text-white hover:underline">
                  ¿Olvidaste tu contraseña?
                </a>
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
