import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackLink from "../components/BackLink";
import { FcGoogle } from "react-icons/fc";

export default function RegisterUsuario() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Si defines VITE_API_BASE_URL (p.ej. http://localhost:5000) se usará;
  // si no, funcionará con proxy de Vite usando rutas relativas.
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
  const api = (path) => `${API_BASE}${path}`;

  // A dónde quieres volver después de OAuth
  const REDIRECT_AFTER_OAUTH = `${window.location.origin}/`;

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    // Limpiar error del campo al escribir
    if (fieldErrors[e.target.name]) {
      setFieldErrors((p) => ({ ...p, [e.target.name]: "" }));
    }
  };

  // Validar email en frontend
  const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Validaciones frontend
    const errors = {};
    if (!form.name.trim()) errors.name = "El nombre es obligatorio";
    if (!form.email.trim()) {
      errors.email = "El email es obligatorio";
    } else if (!isValidEmail(form.email)) {
      errors.email = "Email inválido";
    }
    if (!form.password) {
      errors.password = "La contraseña es obligatoria";
    } else if (form.password.length < 6) {
      errors.password = "Mínimo 6 caracteres";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setErrorMsg("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch(api("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        // Manejar errores de validación del backend
        if (data?.details && Array.isArray(data.details)) {
          const backendErrors = {};
          data.details.forEach((err) => {
            if (err.path) backendErrors[err.path] = err.msg;
          });
          setFieldErrors(backendErrors);
        }
        setErrorMsg(data?.error || "No se pudo crear la cuenta");
        setLoading(false);
        return;
      }

      // sesión inmediata tras registro (token en localStorage)
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role);
      // Solo guardar datos seguros (sin password)
      localStorage.setItem("user", JSON.stringify({
        _id: data.user._id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        avatar: data.user.avatar || ""
      }));
      navigate("/", { replace: true });
    } catch (err) {
      setErrorMsg("Error de conexión. Verifica tu internet.");
    } finally {
      setLoading(false);
    }
  };

  // Redirección al backend para iniciar OAuth con Google
  const handleGoogle = () => {
    window.location.href = `${api('/api/oauth/google')}`;
  };

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl">
        <BackLink to="/" label="Volver al inicio" />

        {/* Encabezado */}
        <header className="mb-8 text-center">
          <h1 className="mt-3 bg-gradient-to-r from-red-500 via-red-400 to-rose-400 bg-clip-text text-3xl font-extrabold text-transparent md:text-4xl">
            Crear cuenta
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/70">
            Regístrate para interactuar con la plataforma.
          </p>
        </header>

        {/* Card */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg md:bg-white/10 md:backdrop-blur-md md:p-8">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          {/* --- Social Sign Up (solo Google) --- */}
          <div className="mb-6">
            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleGoogle}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.15]"
              >
                <FcGoogle size={18} />
                Continuar con Google
              </button>
            </div>

            {/* Separador */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="px-2 py-0.5 rounded-full text-[11px] text-white/70 bg-white/5 border border-white/10">
                Usa tu correo
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </div>

          {/* --- Formulario clásico --- */}
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {/* Nombre */}
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium text-white">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                placeholder="Tu nombre"
                value={form.name}
                onChange={onChange}
                className={`w-full rounded-lg border ${
                  fieldErrors.name ? 'border-red-500' : 'border-white/10'
                } bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60`}
                required
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-400">{fieldErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={onChange}
                className={`w-full rounded-lg border ${
                  fieldErrors.email ? 'border-red-500' : 'border-white/10'
                } bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60`}
                required
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-white">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={onChange}
                className={`w-full rounded-lg border ${
                  fieldErrors.password ? 'border-red-500' : 'border-white/10'
                } bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-red-500/60`}
                required
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password ? (
                <p className="text-xs text-red-400">{fieldErrors.password}</p>
              ) : (
                <p className="text-xs text-white/50">Mínimo 6 caracteres.</p>
              )}
            </div>

            {/* Botón principal */}
            <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading || !form.name || !form.email || !form.password}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ WebkitAppearance: "none", backgroundColor: "#dc2626" }}
              >
                {loading ? "Creando…" : "Crear cuenta"}
              </button>

              <div className="text-center text-sm text-white/70 sm:text-right">
                ¿Ya tienes cuenta?{" "}
                <a href="/login" className="text-white hover:underline">
                  Inicia sesión
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
