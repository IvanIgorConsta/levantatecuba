import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || "Error al iniciar sesión");
        return;
      }

      const { token, user } = data;

      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("userEmail", user.email);

      toast.success("✅ Inicio de sesión exitoso");

      // Navegación según el rol
      if (user.role === "admin" || user.role === "editor") {
        navigate("/admin");
      } else {
        navigate("/");
      }

      // 🔄 Esperar brevemente y luego recargar para actualizar el Header
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (err) {
      setMsg("❌ No se pudo conectar con el servidor.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-800 to-red-400">
      <form
        onSubmit={handleLogin}
        className="glass p-8 rounded-lg shadow-lg w-full max-w-md text-white text-center space-y-4"
      >
        <h2 className="text-2xl font-bold">Acceso Administrativo</h2>

        {msg && (
          <div className="bg-white/10 text-white p-2 rounded text-sm border border-white/20">
            {msg}
          </div>
        )}

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 placeholder-white text-white focus:outline-none"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 rounded bg-white/10 border border-white/20 placeholder-white text-white focus:outline-none"
          required
        />

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition"
        >
          Iniciar Sesión
        </button>

        <div className="mt-4 text-sm text-white">
          ¿Olvidaste tu contraseña?{" "}
          <Link to="/forgot-password" className="text-white underline hover:text-gray-300">
            Recuperarla
          </Link>
        </div>
      </form>
    </div>
  );
}
