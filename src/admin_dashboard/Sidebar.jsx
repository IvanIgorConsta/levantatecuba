import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

export default function Sidebar({ onLinkClick }) {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const { pathname } = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem("role");
    if (stored) setRole(stored);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("role");
    localStorage.removeItem("userEmail");
    navigate("/login");
  };

  const handleClick = () => {
    if (window.innerWidth < 768 && onLinkClick) {
      onLinkClick(); // Cierra el sidebar si estás en móvil
    }
  };

  const isActive = (path) => pathname.startsWith(path);

  return (
    <aside className="sidebar">
      <h2 className="sidebar-header">
        {role === "admin" ? "Panel de Administrador" : "Panel de Editor"}
      </h2>

      <nav className="flex flex-col gap-1">
        <div className="sidebar-section">Contenido</div>

        <Link
          to="/admin/news"
          onClick={handleClick}
          className={`group sidebar-link ${isActive("/admin/news") ? "sidebar-link-active" : ""}`}
        >
          <span>Noticias</span>
        </Link>

        <Link
          to="/admin/reports"
          onClick={handleClick}
          className={`group sidebar-link ${isActive("/admin/reports") ? "sidebar-link-active" : ""}`}
        >
          <span>Denuncias</span>
        </Link>

        <Link
          to="/admin/perfil"
          onClick={handleClick}
          className={`group sidebar-link ${isActive("/admin/perfil") ? "sidebar-link-active" : ""}`}
        >
          <span>Mi Perfil</span>
        </Link>

        <div className="sidebar-divider" />

        {/* Herramientas - disponible para admin y editor */}
        <div className="sidebar-section">Herramientas</div>

        <Link
          to="/admin/redactor-ia"
          onClick={handleClick}
          className={`group sidebar-link ${isActive("/admin/redactor-ia") ? "sidebar-link-active" : ""}`}
        >
          <span>Redactor IA</span>
        </Link>

        <div className="sidebar-divider" />

        {role === "admin" && (
          <>
            <div className="sidebar-section">Administración</div>

            <Link
              to="/admin/users"
              onClick={handleClick}
              className={`group sidebar-link ${isActive("/admin/users") ? "sidebar-link-active" : ""}`}
            >
              <span>Usuarios</span>
            </Link>

            <Link
              to="/admin/password-requests"
              onClick={handleClick}
              className={`group sidebar-link ${isActive("/admin/password-requests") ? "sidebar-link-active" : ""}`}
            >
              <ShieldAlert className="sidebar-icon" />
              <span>Solicitudes de contraseña</span>
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}