import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import AdminRoutes from "./AdminRoutes";
import { Menu } from "lucide-react";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // ✅ Verificar si hay token al cargar el panel
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  // ✅ Función para cerrar sesión
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:changed"));
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-ui flex min-h-screen bg-[#0d0d0d] text-white">
      {/* Sidebar fijo en escritorio */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Sidebar flotante en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute top-0 left-0 w-64 h-full sidebar border-r border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </div>
        </div>
      )}

      <main className="flex-grow p-4 md:p-8 overflow-y-auto w-full bg-[#0d0d0d] admin-scrollbar text-white">
        {/* Botón menú en móvil */}
        <div className="flex justify-between items-center mb-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/80 hover:text-white"
          >
            <Menu size={28} />
          </button>
          <button
            onClick={logout}
            className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800 text-sm"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          <AdminRoutes />
        </div>
      </main>
    </div>
  );
}
