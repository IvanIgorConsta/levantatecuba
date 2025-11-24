import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Header() {
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        return;
      }
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          if (res.ok) return res.json();
          throw new Error(`HTTP ${res.status}`);
        })
        .then((data) => setUser(data))
        .catch(() => setUser(null));
    };
    checkAuth();
    const onChange = () => checkAuth();
    window.addEventListener("storage", onChange);
    window.addEventListener("auth:changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("auth:changed", onChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
    window.dispatchEvent(new Event("auth:changed"));
    navigate("/");
  };

  let timeoutId;
  const handleMouseEnter = () => {
    clearTimeout(timeoutId);
    setShowMenu(true);
  };
  const handleMouseLeave = () => {
    timeoutId = window.setTimeout(() => setShowMenu(false), 150);
  };

  return (
    <header id="app-header" className="flex flex-wrap justify-between items-center px-4 md:px-6 py-3 md:py-4 bg-red-800 text-white shadow-md z-50 relative">
      {/* Logo */}
      <Link
        to="/"
        className="text-lg md:text-2xl font-extrabold tracking-tight hover:text-gray-200 transition"
      >
        LevántateCuba
      </Link>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 md:gap-4 items-center relative mt-2 md:mt-0">
        {!user ? (
          <>
            <Link
              to="/login"
              className="text-xs md:text-sm px-3 md:px-5 py-1.5 md:py-2 rounded-full border border-white/40 hover:bg-white hover:text-black transition-all duration-200 font-medium whitespace-nowrap"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="text-xs md:text-sm px-3 md:px-5 py-1.5 md:py-2 rounded-full bg-white text-black hover:bg-black hover:text-white transition-all duration-200 font-semibold shadow whitespace-nowrap"
            >
              Crear cuenta
            </Link>
          </>
        ) : (
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Botón usuario */}
            <button
              className="inline-flex items-center gap-2 text-xs md:text-sm px-3 md:px-5 py-1.5 md:py-2 rounded-full bg-black/85 text-white border border-white/15 hover:border-white/30 hover:bg-black transition-colors duration-200 font-semibold shadow whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              {user.name.split(" ")[0]}
            </button>

            {/* Menú */}
            {showMenu && (
              <div className="absolute right-0 mt-2 z-50">
                {/* Caret (piquito) */}
                <div className="relative h-3">
                  <div className="absolute right-6 top-0 h-3 w-3 rotate-45 bg-zinc-900/95 ring-1 ring-white/10" />
                </div>

                <div
                  className="
                    relative w-48 
                    bg-zinc-900/95 text-white 
                    rounded-2xl shadow-2xl ring-1 ring-white/10 
                    backdrop-blur-md overflow-hidden
                    origin-top-right
                    transition
                    duration-150
                    ease-out
                    opacity-100 scale-100
                  "
                >
                  {/* Opcional: título */}
                  <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-white/50">
                    Cuenta
                  </div>

                  <div className="py-1">
                    {(user.role === "admin" || user.role === "editor") && (
                      <Link
                        to="/admin"
                        className="block px-4 py-2 text-sm text-white/90 hover:bg-white/5 active:bg-white/10 transition"
                      >
                        🔧 Panel Admin
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-white/10" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-white/90 hover:bg-white/5 active:bg-white/10 transition"
                  >
                    🔓 Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
